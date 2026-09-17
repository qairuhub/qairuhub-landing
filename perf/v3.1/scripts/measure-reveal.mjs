#!/usr/bin/env node
/**
 * How long after navigation the 3D wordmark becomes visible.
 *
 *   node perf/v3.1/scripts/measure-reveal.mjs <baseUrl> <tag> <vw> <vh> [cpuThrottle] [runs]
 *   e.g. node perf/v3.1/scripts/measure-reveal.mjs http://127.0.0.1:8805 laptop 1440 900 1 3
 *        node perf/v3.1/scripts/measure-reveal.mjs http://127.0.0.1:8805 phone  390 844 4 3
 *
 * Reported milestones, all relative to navigationStart:
 *   canvasMount  the <canvas> element is in the DOM (still fully transparent)
 *   firstDraw    the first WebGL draw call into the DEFAULT framebuffer, i.e. the first on-screen
 *                frame of the scene (warm-up render-to-texture passes are excluded)
 *   wordmarkDraw the first on-screen draw of the wordmark mesh itself (>= 20k indices)
 *   revealStart  SkyScene flips the canvas to opacity:1 and the 700 ms CSS fade begins
 *   reveal 50%   the scene is half faded in (the moment the wordmark reads on screen)
 *   revealFull   the canvas has actually reached opacity 1 (fade finished, wordmark fully opaque)
 * Also records FCP / LCP and writes a screenshot of the hero at revealFull.
 *
 * Every run uses a fresh browser context AND a fresh Chrome user-data dir, so the GPU shader
 * cache and localStorage (`qh.gpu`) are cold — a warm cache makes repeat runs optimistic.
 */
import { chromium } from 'file:///C:/Users/tairc/Documents/codespace/qairuhub-test-landing/node_modules/playwright/index.mjs'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const shotDir = resolve(here, '..', 'reveal')
mkdirSync(shotDir, { recursive: true })

const [base, tag, vw = '1440', vh = '900', throttle = '1', runs = '3', path = '/'] = process.argv.slice(2)
const W = Number(vw)
const H = Number(vh)
const CPU = Number(throttle)
const mobile = W < 768

const init = () => {
  const R = (window.__reveal = { canvasMount: null, firstDraw: null, revealStart: null, revealHalf: null, revealFull: null, wordmarkDraw: null, fcp: null, lcp: null, tier: null, drawCalls: 0 })
  const now = () => performance.now()
  const WORDMARK_INDICES = 20000
  for (const Ctx of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!Ctx) continue
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const orig = Ctx.prototype[name]
      if (!orig) continue
      const indexed = name.startsWith('drawElements')
      Ctx.prototype[name] = function (...a) {
        if (R.firstDraw === null || (indexed && R.wordmarkDraw === null && a[1] >= WORDMARK_INDICES)) {
          try {
            if (this.getParameter(this.FRAMEBUFFER_BINDING) === null && this.canvas && this.canvas.isConnected) {
              if (R.firstDraw === null) R.firstDraw = now()
              // The extruded glass wordmark is by far the biggest indexed draw in the scene
              // (~88k indices); the sky dome, the cloud quads and the grass chunks are all
              // an order of magnitude smaller, and the stars are a drawArrays POINTS call.
              if (indexed && a[1] >= WORDMARK_INDICES) R.wordmarkDraw = now()
            }
          } catch { /* ignore */ }
        }
        R.drawCalls++
        return orig.apply(this, a)
      }
    }
  }
  /**
   * r3f puts the <Canvas style> on its WRAPPER div, not on the <canvas>, and the 700 ms fade
   * lives there — so the visible opacity is the product down the ancestor chain.
   */
  const effectiveOpacity = (el) => {
    let o = 1
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const v = Number.parseFloat(getComputedStyle(n).opacity)
      if (!Number.isNaN(v)) o *= v
    }
    return o
  }
  const tick = () => {
    const c = document.querySelector('canvas')
    if (c) {
      if (R.canvasMount === null) R.canvasMount = now()
      const op = effectiveOpacity(c)
      if (R.revealStart === null && op > 0.01) R.revealStart = now()
      if (R.revealHalf === null && op >= 0.5) R.revealHalf = now()
      if (R.revealFull === null && op >= 0.995) R.revealFull = now()
    }
    // Keep polling until BOTH milestones exist: on a build without the fade the canvas is opaque
    // from the first commit, so revealFull lands long before anything is actually drawn.
    if (R.revealFull === null || R.wordmarkDraw === null) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') R.fcp = e.startTime }).observe({ type: 'paint', buffered: true })
    new PerformanceObserver((l) => { const e = l.getEntries(); R.lcp = e[e.length - 1]?.startTime ?? R.lcp }).observe({ type: 'largest-contentful-paint', buffered: true })
  } catch { /* ignore */ }
}

const rows = []
for (let i = 1; i <= Number(runs); i++) {
  const profile = mkdtempSync(join(tmpdir(), 'qh-reveal-'))
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    headless: false,
    // The host-resolver rule is harmless for localhost and lets a production run through this
    // ISP (it drops TLS to some Cloudflare anycast addresses).
    args: ['--ignore-gpu-blocklist', '--host-resolver-rules=MAP qairuhub.com 188.114.97.1'],
    viewport: { width: W, height: H },
    deviceScaleFactor: mobile ? 3 : 1,
    isMobile: mobile,
    hasTouch: mobile,
  })
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  await page.addInitScript(init)
  if (CPU > 1) {
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  }
  await page.goto(base + path, { waitUntil: 'commit' })
  await page.waitForFunction(() => window.__reveal?.revealFull !== null && window.__reveal?.wordmarkDraw !== null, null, { timeout: 60000 }).catch(() => {})
  const r = await page.evaluate(() => ({ ...window.__reveal, tier: document.querySelector('canvas')?.dataset?.tier ?? null }))
  await page.screenshot({ path: join(shotDir, `${tag}-r${i}-reveal.png`), clip: { x: 0, y: 0, width: W, height: Math.min(H, 700) } })
  rows.push({ run: i, ...r, errors: errors.length })
  await ctx.close()
  try { rmSync(profile, { recursive: true, force: true }) } catch { /* Windows keeps a handle sometimes */ }
}

const ms = (v) => (v == null ? 'n/a' : Math.round(v))
const med = (k) => { const s = rows.map((r) => r[k]).filter((v) => v != null).sort((a, b) => a - b); return s.length ? s[(s.length - 1) >> 1] : null }
console.log(`\n${tag}  ${W}x${H}  cpu ${CPU}x  ${path}  (${rows.length} cold-profile runs, ms after navigationStart)`)
console.log('| run | FCP | LCP | canvasMount | firstDraw | wordmark drawn | revealStart | reveal 50% | revealFull | page errors |')
console.log('|---|---|---|---|---|---|---|---|---|---|')
for (const r of rows) console.log(`| ${r.run} | ${ms(r.fcp)} | ${ms(r.lcp)} | ${ms(r.canvasMount)} | ${ms(r.firstDraw)} | ${ms(r.wordmarkDraw)} | ${ms(r.revealStart)} | ${ms(r.revealHalf)} | ${ms(r.revealFull)} | ${r.errors} |`)
console.log(`| **median** | ${ms(med('fcp'))} | ${ms(med('lcp'))} | ${ms(med('canvasMount'))} | ${ms(med('firstDraw'))} | ${ms(med('wordmarkDraw'))} | ${ms(med('revealStart'))} | ${ms(med('revealHalf'))} | ${ms(med('revealFull'))} | |`)
console.log(JSON.stringify({ tag, W, H, CPU, path, rows }))
