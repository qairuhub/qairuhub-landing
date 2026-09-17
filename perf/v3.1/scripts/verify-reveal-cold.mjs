/**
 * Independent cold-cache reveal measurement (verify round 2, re-check item 2).
 *   node perf/v3.1/scripts/verify-reveal-cold.mjs <baseUrl> [1440x900] [runs]
 *
 * A fresh Chrome user-data dir per run, so the GPU program cache is cold. Times the FIRST
 * drawArrays/drawElements issued while the DEFAULT framebuffer is bound, i.e. the first frame the
 * reader could actually see, plus FCP and the moment the canvas reaches full opacity.
 */
import { chromium } from 'playwright'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const base = process.argv[2] ?? 'http://127.0.0.1:8806'
const [w, h] = (process.argv[3] ?? '1440x900').split('x').map(Number)
const runs = Number(process.argv[4] ?? 3)

const INIT = () => {
  window.__r = {}
  const mark = (k) => { if (window.__r[k] === undefined) window.__r[k] = performance.now() }
  // First draw of any kind (warm-up / PMREM included) and the first bindFramebuffer(null) draw.
  let toDefault = false
  for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const bind = proto.bindFramebuffer
    if (bind) proto.bindFramebuffer = function (target, fb) { toDefault = fb === null; return bind.call(this, target, fb) }
    for (const fn of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const orig = proto[fn]
      if (!orig) continue
      proto[fn] = function (...args) {
        mark('firstDraw')
        if (toDefault) mark('firstDefaultDraw')
        return orig.apply(this, args)
      }
    }
  }
  // The 700 ms fade sits on an ANCESTOR of the canvas (the element whose transition is on
  // opacity), not on the canvas itself. Walk up to find it.
  const fadeHost = (c) => {
    for (let el = c; el && el !== document.body; el = el.parentElement) {
      const st = getComputedStyle(el)
      if (/opacity/.test(st.transitionProperty) || st.opacity !== '1') return el
    }
    return null
  }
  const tick = () => {
    const c = document.querySelector('canvas')
    if (c) {
      mark('canvasInDom')
      const host = fadeHost(c)
      window.__r.fadeHost = host ? host.className || host.tagName : 'none'
      if (host && Number(getComputedStyle(host).opacity) >= 0.99) mark('skyVisible')
      else if (!host) mark('skyVisible')
    }
    if (window.__r.skyVisible === undefined) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__r.fcp = e.startTime })
    .observe({ type: 'paint', buffered: true })
}

const out = []
for (let i = 0; i < runs; i++) {
  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'qh-cold-')), {
    channel: 'chrome',
    headless: false,
    viewport: { width: w, height: h },
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)))
  await page.addInitScript(INIT)
  await page.goto(base + '/', { waitUntil: 'load' })
  await page.waitForFunction(() => window.__r?.skyVisible !== undefined, { timeout: 30_000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const r = await page.evaluate(() => {
    const o = {}
    for (const [k, v] of Object.entries(window.__r)) o[k] = typeof v === 'number' ? Math.round(v) : v
    // The two reveal stages the build marks itself (sky/warmup.ts `markReveal`): the sky's programs
    // linked (the canvas starts drawing and fading in) and the wordmark's linked (it switches on).
    for (const name of ['qh-sky-ready', 'qh-wordmark-ready']) {
      const e = performance.getEntriesByName(name)[0]
      if (e) o[name === 'qh-sky-ready' ? 'skyReady' : 'wordmarkReady'] = Math.round(e.startTime)
    }
    return o
  })
  out.push({ run: i, ...r, errors })
  await ctx.close()
}
const med = (k) => {
  const v = out.map((o) => o[k]).filter((x) => typeof x === 'number').sort((a, b) => a - b)
  return v.length ? v[Math.floor(v.length / 2)] : null
}
console.log(
  JSON.stringify(
    {
      viewport: `${w}x${h}`,
      runs: out,
      median: {
        fcp: med('fcp'),
        canvasInDom: med('canvasInDom'),
        firstDraw: med('firstDraw'),
        skyReady: med('skyReady'),
        firstDefaultDraw: med('firstDefaultDraw'),
        skyVisible: med('skyVisible'),
        wordmarkReady: med('wordmarkReady'),
      },
    },
    null,
    1,
  ),
)
