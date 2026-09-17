#!/usr/bin/env node
/**
 * Load-timeline recorder (AUDIT 1). Installed Chrome, headed (real GPU), one fresh context per run:
 * CDP CPU throttling, a Chrome performance trace (timeline + V8 CPU profiler + screenshots) for
 * `--seconds` after navigation, plus the page-side probes of trace-init.js (FCP / LCP, long tasks,
 * first canvas draw, first wordmark draw, shader link waits, resource timings).
 *
 *   node perf/v3.1/scripts/trace-load.mjs [baseUrl] [--only=phone-390,laptop-1440] [--path=/] [--seconds=10] [--tag=]
 *
 * Writes <scratch>/traces/<id>.json (raw trace) and perf/v3.1/traces/<id>-probe.json.
 * Analyse with analyze-trace.mjs.
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '..', 'traces')
const rawDir = process.env.TRACE_RAW_DIR || outDir
mkdirSync(outDir, { recursive: true })
mkdirSync(rawDir, { recursive: true })
const args = process.argv.slice(2)
const flag = (n, d) => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=') ?? d
const base = (args.find((a) => !a.startsWith('--')) || 'http://127.0.0.1:8801').replace(/\/+$/, '')
const only = flag('only')?.split(',')
// Accepts 'members' or '/members' (Git Bash rewrites a leading slash to C:/Program Files/Git/…).
const path = '/' + flag('path', '/').replace(/^[A-Za-z]:\/.*?\/Git\//, '').replace(/^\/+/, '')
const seconds = Number(flag('seconds', 10))
const tag = flag('tag', '')
const initSrc = readFileSync(join(here, 'trace-init.js'), 'utf8')

const CONFIGS = [
  { id: 'phone-390', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, cpu: 4 },
  { id: 'laptop-1440', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, cpu: 1 },
  { id: 'laptop-1024-cpu2', viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1, cpu: 2 },
].filter((c) => !only || only.includes(c.id))

const CATEGORIES = [
  '-*',
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'toplevel',
  'loading',
  'blink.user_timing',
  'latencyInfo',
  'v8.execute',
  'v8',
  'disabled-by-default-v8.cpu_profiler',
  'disabled-by-default-devtools.screenshot',
]

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--ignore-gpu-blocklist', '--disable-features=Translate', '--no-first-run'],
})

for (const cfg of CONFIGS) {
  const id = `${cfg.id}${path === '/' ? '' : path.replace(/[^a-z0-9]+/gi, '-')}${tag}`
  const context = await browser.newContext({
    viewport: cfg.viewport,
    deviceScaleFactor: cfg.deviceScaleFactor,
    isMobile: !!cfg.isMobile,
    hasTouch: !!cfg.hasTouch,
    serviceWorkers: 'block',
  })
  await context.addInitScript(initSrc)
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  if (cfg.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.cpu })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text().slice(0, 200)}`)
  })

  await page.goto('about:blank')
  await browser.startTracing(page, { categories: CATEGORIES, screenshots: true })
  const t0 = Date.now()
  await page.goto(`${base}${path}`, { waitUntil: 'commit' })
  await page.waitForTimeout(seconds * 1000)
  const buf = await browser.stopTracing()
  const rawPath = join(rawDir, `${id}.json`)
  writeFileSync(rawPath, buf)

  const probe = await page.evaluate(() => {
    const q = window.__qh
    const res = performance.getEntriesByType('resource').map((r) => ({
      name: r.name.replace(location.origin, ''),
      type: r.initiatorType,
      start: Math.round(r.startTime),
      end: Math.round(r.responseEnd),
      transfer: r.transferSize,
      body: r.decodedBodySize,
    }))
    const nav = performance.getEntriesByType('navigation')[0]
    // What the sky decided (GPU string + tier inputs), read the same way quality.ts does.
    let renderer = null
    try {
      const c = document.createElement('canvas')
      const gl = c.getContext('webgl2')
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info')
      renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch {}
    const canvas = document.querySelector('canvas')
    // Fonts actually used + whether they are loaded.
    const fonts = [...document.fonts].map((f) => ({ family: f.family, status: f.status, range: f.unicodeRange.slice(0, 20) }))
    // What is above the fold: visible text elements and their computed font families.
    const fold = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const seen = new Set()
    while (walker.nextNode()) {
      const n = walker.currentNode
      if (!n.textContent.trim()) continue
      const el = n.parentElement
      if (!el || seen.has(el)) continue
      const r = el.getBoundingClientRect()
      if (r.bottom <= 0 || r.top >= innerHeight || r.width === 0 || r.height === 0) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none') continue
      if (el.closest('.sr-only')) continue
      seen.add(el)
      fold.push({ text: n.textContent.trim().slice(0, 30), font: cs.fontFamily.split(',')[0], opacity: cs.opacity })
    }
    return {
      q,
      nav: nav ? { dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), ttfb: Math.round(nav.responseStart) } : null,
      res,
      renderer,
      dpr: devicePixelRatio,
      canvas: canvas ? { w: canvas.width, h: canvas.height, cssW: canvas.clientWidth } : null,
      fonts,
      fold,
      hc: navigator.hardwareConcurrency,
      docH: document.documentElement.scrollHeight,
    }
  })
  probe.errors = errors
  probe.config = cfg
  probe.path = path
  probe.wallMs = Date.now() - t0
  writeFileSync(join(outDir, `${id}-probe.json`), JSON.stringify(probe, null, 1))
  const g = probe.q.gl
  console.log(
    `${id}: FCP ${probe.q.fcp?.toFixed(0)} LCP ${probe.q.lcp.at(-1)?.t.toFixed(0)} (${probe.q.lcp.at(-1)?.el}) ctx ${g.contexts.map((c) => c.t.toFixed(0)).join(',')} ` +
      `firstScreenDraw ${g.firstScreenDraw?.t.toFixed(0)} wordmark ${g.firstWordmarkDraw?.t.toFixed(0)} links ${g.links} linkWait ${g.linkWaitMs.toFixed(0)} ms ` +
      `parallelExt ${g.parallelExt} renderer ${probe.renderer} longtasks ${probe.q.longtasks.length} (${probe.q.longtasks.reduce((s, l) => s + l.d, 0).toFixed(0)} ms) errors ${errors.length}`,
  )
  await context.close()
}
await browser.close()
