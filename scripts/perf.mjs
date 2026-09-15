#!/usr/bin/env node
/**
 * Runtime + bundle performance probe (V3-BUILD-PLAN §5 and §WP12, owned by WP12).
 * Measures BY SECTION ID, not by scroll percentage, so the numbers survive page-height changes.
 *
 *   node scripts/perf.mjs [url] [--headed] [--cpu=4] [--tier=medium] [--out=perf/perf-<date>.json]
 *   node scripts/perf.mjs --bundle-only            only the dist/ size + font preload budgets
 *
 *   url       default http://localhost:4173 (run `pnpm build && pnpm preview` first)
 *   --headed  real GPU. The budgets in §5 are for the user's Intel UHD laptop, headed, medium tier.
 *             Headless Chromium uses software GL: its fps are relative numbers only (the report says so).
 *   --cpu=N   CDP CPU throttling (4 = 4× slower)
 *   --tier=   appends ?q=high|medium|low (sky/quality.ts debug override)
 *   --out=    also write the JSON report to this path (the perf/ directory is committed)
 *   Env equivalents of the v2 script still work: PERF_URL, PERF_CPU, PERF_HEADLESS=0, PERF_W, PERF_H.
 *
 * Runtime positions (all resolved from the live DOM):
 *   hero-0       y = 0                      budget ≥ 55 fps
 *   hero-0.7vh   y = 0.7 × innerHeight      budget ≥ 55 fps (the wordmark turn + recede)
 *   hero-1.3vh   y = 1.3 × innerHeight      budget ≥ 55 fps (whiteout peak, end of the hero run)
 *   #launchpad #ecosystem #accelerator #supersize #platform  (reported, no budget)
 *   #offer #projects #news                  budget ≥ 60 fps (mid-page)
 *   #cta #tools #story #join                (reported, no budget)
 *   footer-end   y = scroll limit           budget ≥ 52 fps (field + footer wordmark)
 * Each position: 900 ms settle, then fps / p95 / worst frame over 2.5 s idle.
 * Then a wheel scroll top → bottom (Lenis) for fps while scrolling, long tasks over the whole run
 * (budget: none > 200 ms, total ≤ 2000 ms after load), CLS, canvas count, JS heap and console errors.
 *
 * Bundle budgets (from dist/, gzip level 9, if dist/ exists):
 *   entry JS (the <script type=module> of dist/index.html) ≤ 45 KB · `three-*` / `r3f-*` reported
 *   (no-growth rule vs 185 / 72 KB) · any chunk whose name contains Assistant ≤ 20 KB · HandbookPage ≤ 40 KB
 *   preloaded fonts: dist/index.html ≤ 700 KB · dist/kk/index.html ≤ 800 KB
 *
 * Exit code 2 when a budget fails (fps and long-task budgets only enforce with --headed: software GL
 * turns every frame into a long task).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
const url = (args.find((a) => !a.startsWith('--')) || process.env.PERF_URL || 'http://localhost:4173').replace(/\/+$/, '')
const headed = args.includes('--headed') || process.env.PERF_HEADLESS === '0'
const cpu = Number(flag('cpu') || process.env.PERF_CPU || 1)
const tier = flag('tier')
const outPath = flag('out')
const bundleOnly = args.includes('--bundle-only')
const width = Number(process.env.PERF_W || 1440)
const height = Number(process.env.PERF_H || 900)

const failures = []
const KB = 1024

/* ------------------------------------------------------------------ bundle budgets */
function bundleReport() {
  const dist = resolve(root, 'dist')
  if (!existsSync(join(dist, 'index.html'))) return { skipped: 'dist/index.html not found (run pnpm build)' }
  const assets = join(dist, 'assets')
  const chunks = readdirSync(assets)
    .filter((f) => f.endsWith('.js') || f.endsWith('.css'))
    .map((f) => {
      const buf = readFileSync(join(assets, f))
      return { file: f, raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length }
    })
    .sort((a, b) => b.gzip - a.gzip)
  const html = readFileSync(join(dist, 'index.html'), 'utf8')
  const entryFile = html.match(/<script[^>]+type="module"[^>]+src="\/assets\/([^"]+\.js)"/)?.[1]
  const entry = chunks.find((c) => c.file === entryFile)
  const find = (re) => chunks.filter((c) => re.test(c.file))
  const kb = (n) => Math.round((n / KB) * 10) / 10

  const budgets = []
  const budget = (name, bytes, limitKb) => {
    if (bytes == null) return budgets.push({ name, value: null, limitKb, pass: null, note: 'chunk not found' })
    const pass = bytes <= limitKb * KB
    budgets.push({ name, kb: kb(bytes), limitKb, pass })
    if (!pass) failures.push(`${name}: ${kb(bytes)} KB > ${limitKb} KB`)
  }
  budget('entry JS (app index)', entry?.gzip, 45)
  budget('assistant chunk(s)', find(/assistant/i).reduce((a, c) => a + c.gzip, 0) || null, 20)
  budget('handbook page chunk(s)', find(/handbook/i).filter((c) => c.file.endsWith('.js')).reduce((a, c) => a + c.gzip, 0) || null, 40)
  const three = find(/^three-/)[0]
  const r3f = find(/^r3f-/)[0]
  budgets.push({ name: 'three chunk (no growth vs 185 KB)', kb: three ? kb(three.gzip) : null, limitKb: 185, pass: three ? three.gzip <= 185 * KB * 1.02 : null })
  budgets.push({ name: 'r3f chunk (no growth vs 72 KB)', kb: r3f ? kb(r3f.gzip) : null, limitKb: 72, pass: r3f ? r3f.gzip <= 72 * KB * 1.02 : null })

  const preloads = (file) => {
    const p = join(dist, file)
    if (!existsSync(p)) return null
    const h = readFileSync(p, 'utf8')
    const hrefs = [...h.matchAll(/<link[^>]+rel="preload"[^>]*>/g)]
      .map((m) => m[0])
      .filter((tag) => /as="font"/.test(tag))
      .map((tag) => tag.match(/href="([^"]+)"/)?.[1])
      .filter(Boolean)
    const bytes = hrefs.reduce((a, href) => {
      const f = join(dist, href.replace(/^\//, ''))
      return a + (existsSync(f) ? statSync(f).size : 0)
    }, 0)
    return { hrefs, bytes }
  }
  const en = preloads('index.html')
  const kk = preloads(join('kk', 'index.html'))
  budget('preloaded fonts EN home', en?.bytes ?? null, 700)
  budget('preloaded fonts KK home', kk?.bytes ?? null, 800)
  // JS/CSS budgets are gzip sizes; font budgets are raw bytes (woff2/ttf transfer size)
  return { entry: entryFile, budgets, preloads: { en: en?.hrefs, kk: kk?.hrefs }, chunks: chunks.slice(0, 15).map((c) => ({ ...c, raw: kb(c.raw), gzip: kb(c.gzip) })) }
}

const report = { url, headed, cpuThrottle: cpu, tier: tier ?? 'auto', viewport: { width, height }, date: new Date().toISOString() }
report.bundle = bundleReport()

/* ------------------------------------------------------------------ runtime */
if (!bundleOnly) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({
    headless: !headed,
    args: headed ? ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-zero-copy'] : [],
  })
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })

  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.addInitScript(() => {
    window.__longTasks = []
    window.__cls = 0
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__longTasks.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) })
      }).observe({ type: 'longtask', buffered: true })
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value
      }).observe({ type: 'layout-shift', buffered: true })
    } catch {}
  })

  const t0 = Date.now()
  await page.goto(url + '/' + (tier ? `?q=${tier}` : ''), { waitUntil: 'networkidle', timeout: 60000 })
  report.loadMs = Date.now() - t0
  await page.waitForTimeout(3000)
  report.renderer = await page.evaluate(() => {
    try {
      const gl = document.createElement('canvas').getContext('webgl2')
      const ext = gl?.getExtension('WEBGL_debug_renderer_info')
      return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown'
    } catch {
      return 'unknown'
    }
  })

  const measureIdle = (ms) =>
    page.evaluate(
      (ms) =>
        new Promise((done) => {
          const times = []
          let last = performance.now()
          const start = last
          const f = (t) => {
            times.push(t - last)
            last = t
            if (t - start < ms) requestAnimationFrame(f)
            else {
              times.shift()
              const sorted = [...times].sort((a, b) => a - b)
              const avg = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length)
              done({ fps: Math.round(1000 / avg), p95: Math.round((sorted[Math.floor(sorted.length * 0.95)] || 0) * 10) / 10, worst: Math.round(sorted[sorted.length - 1] || 0) })
            }
          }
          requestAnimationFrame(f)
        }),
      ms,
    )
  const scrollTo = (y) =>
    page.evaluate((v) => {
      if (window.__lenis) window.__lenis.scrollTo(v, { immediate: true, force: true })
      window.scrollTo(0, v)
    }, y)

  const SECTIONS = ['launchpad', 'ecosystem', 'accelerator', 'supersize', 'platform', 'offer', 'projects', 'news', 'cta', 'tools', 'story', 'join']
  const BUDGET = { hero: 55, mid: 60, footer: 52 }
  const MID = new Set(['offer', 'projects', 'news'])

  const geo = await page.evaluate((ids) => {
    const limit = document.documentElement.scrollHeight - window.innerHeight
    const top = (id) => {
      const el = document.getElementById(id)
      return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null
    }
    return { limit, vh: window.innerHeight, ids: Object.fromEntries(ids.map((id) => [id, top(id)])) }
  }, SECTIONS)

  const positions = [
    { at: 'hero-0', y: 0, budget: BUDGET.hero },
    { at: 'hero-0.7vh', y: Math.round(0.7 * geo.vh), budget: BUDGET.hero },
    { at: 'hero-1.3vh', y: Math.round(1.3 * geo.vh), budget: BUDGET.hero },
    ...SECTIONS.map((id) => ({ at: `#${id}`, y: geo.ids[id], budget: MID.has(id) ? BUDGET.mid : null })),
    { at: 'footer-end', y: geo.limit, budget: BUDGET.footer },
  ]

  report.positions = []
  for (const p of positions) {
    if (p.y == null) {
      report.positions.push({ at: p.at, missing: true })
      failures.push(`section ${p.at} not found in the DOM`)
      continue
    }
    // sections: park the section top just under the 72 px header, clamped to the scroll range
    const y = p.at.startsWith('#') ? Math.max(0, Math.min(geo.limit, p.y - 72)) : p.y
    await scrollTo(y)
    await page.waitForTimeout(900)
    const m = await measureIdle(2500)
    const pass = p.budget == null ? null : m.fps >= p.budget
    report.positions.push({ at: p.at, y, yVh: Math.round((y / geo.vh) * 100) / 100, ...m, budget: p.budget, pass })
    if (headed && pass === false) failures.push(`${p.at}: ${m.fps} fps < ${p.budget}`)
  }

  // wheel scroll top → bottom while counting frames
  await scrollTo(0)
  await page.waitForTimeout(600)
  const wheelSteps = 80
  const scrollMs = wheelSteps * 100 + 500
  const scrolling = page.evaluate(
    (ms) =>
      new Promise((done) => {
        const times = []
        let last = performance.now()
        const start = last
        const f = (t) => {
          times.push(t - last)
          last = t
          if (t - start < ms) requestAnimationFrame(f)
          else {
            const sorted = [...times].sort((a, b) => a - b)
            done({ fps: Math.round(1000 / (times.reduce((a, b) => a + b, 0) / times.length)), p95: Math.round((sorted[Math.floor(sorted.length * 0.95)] || 0) * 10) / 10, worst: Math.round(sorted[sorted.length - 1] || 0) })
          }
        }
        requestAnimationFrame(f)
      }),
    scrollMs,
  )
  await page.mouse.move(width / 2, height / 2)
  for (let i = 0; i < wheelSteps; i++) {
    await page.mouse.wheel(0, Math.ceil(geo.limit / wheelSteps / 0.65)) // Lenis wheelMultiplier 0.65
    await page.waitForTimeout(100)
  }
  report.scrolling = await scrolling

  const longTasks = await page.evaluate(() => window.__longTasks || [])
  const afterLoad = longTasks.filter((t) => t.start > report.loadMs)
  report.longTasks = {
    maxMs: afterLoad.reduce((a, t) => Math.max(a, t.dur), 0),
    totalMs: afterLoad.reduce((a, t) => a + t.dur, 0),
    over200: afterLoad.filter((t) => t.dur > 200),
    budget: 'none > 200 ms, total ≤ 2000 ms after load',
  }
  if (headed && report.longTasks.over200.length) failures.push(`${report.longTasks.over200.length} long task(s) > 200 ms after load`)
  if (headed && report.longTasks.totalMs > 2000) failures.push(`long tasks total ${report.longTasks.totalMs} ms > 2000 ms`)
  report.cls = Math.round((await page.evaluate(() => window.__cls)) * 1000) / 1000
  if (report.cls > 0.05) failures.push(`CLS ${report.cls} > 0.05`)
  report.canvases = await page.evaluate(() => document.querySelectorAll('canvas').length)
  report.heapMb = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null))
  report.errors = errors
  if (errors.length) failures.push(`${errors.length} console error(s)`)
  if (!headed) report.note = 'headless = software GL: fps are relative only; fps and long-task budgets not enforced. Re-run with --headed on the Intel UHD laptop.'
  await browser.close()
}

report.failures = failures
const json = JSON.stringify(report, null, 2)
console.log(json)
if (outPath) {
  mkdirSync(dirname(resolve(root, outPath)), { recursive: true })
  writeFileSync(resolve(root, outPath), json)
}
if (failures.length) process.exitCode = 2
