/**
 * Deep-link landing + first-visit reveal timing, in the installed Chrome (real GPU).
 *   node perf/v3.1/scripts/verify-deeplinks.mjs <baseUrl> [1440x900|390x844]
 *
 * 1. /#<id> for every deep-linked section: the section's top must settle at the 72 px header
 *    offset, after the late font swap (Anton/Caveat are no longer preloaded).
 * 2. Cold-cache reveal: time from navigation start until the sky canvas is opaque, with a fresh
 *    user-data dir each run so the GPU program cache is cold.
 */
import { chromium } from 'playwright'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const base = process.argv[2] ?? 'http://127.0.0.1:8806'
const [w, h] = (process.argv[3] ?? '1440x900').split('x').map(Number)
const TARGET_TOP = 72
const TOLERANCE = 2

const out = { viewport: `${w}x${h}`, deepLinks: [], reveal: null, errors: [] }

/* ---------------------------------------------------------------- deep links */
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'qh-deeplink-')), {
  channel: 'chrome',
  headless: false,
  viewport: { width: w, height: h },
})
const REPEATS = Number(process.env.REPEATS ?? 2)
for (let run = 0; run < REPEATS; run++) {
  for (const id of ['platform', 'join', 'news', 'launchpad']) {
    // A fresh page per hash: goto() between two hashes of the same URL is a same-document
    // navigation, which never reloads and so never exercises the deep-link placement.
    const page = await ctx.newPage()
    page.on('pageerror', (e) => out.errors.push(`pageerror: ${e.message}`))
    await page.goto(`${base}/#${id}`, { waitUntil: 'load' })
    await page.waitForTimeout(6000) // past the 4 s deep-link settle window
    const top = await page.evaluate((sel) => {
      const el = document.getElementById(sel)
      return el ? Math.round(el.getBoundingClientRect().top) : null
    }, id)
    out.deepLinks.push({ run, id, top, pass: top !== null && Math.abs(top - TARGET_TOP) <= TOLERANCE })
    await page.close()
  }
}
await ctx.close()

/* ---------------------------------------------------------------- cold reveal */
const ctx2 = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'qh-cold-')), {
  channel: 'chrome',
  headless: false,
  viewport: { width: w, height: h },
})
const p2 = await ctx2.newPage()
p2.on('pageerror', (e) => out.errors.push(`pageerror(cold): ${e.message}`))
await p2.addInitScript(() => {
  window.__marks = {}
  const check = () => {
    const c = document.querySelector('canvas')
    if (c && !window.__marks.canvasInDom) window.__marks.canvasInDom = performance.now()
    if (c && !window.__marks.canvasOpaque) {
      const op = Number(getComputedStyle(c).opacity)
      if (op >= 0.99) window.__marks.canvasOpaque = performance.now()
    }
    if (!window.__marks.canvasOpaque) requestAnimationFrame(check)
  }
  requestAnimationFrame(check)
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__marks.fcp = e.startTime
  }).observe({ type: 'paint', buffered: true })
})
await p2.goto(`${base}/`, { waitUntil: 'load' })
await p2.waitForFunction(() => window.__marks?.canvasOpaque !== undefined, { timeout: 30_000 }).catch(() => {})
out.reveal = await p2.evaluate(() => ({
  fcp: Math.round(window.__marks.fcp ?? -1),
  canvasInDom: Math.round(window.__marks.canvasInDom ?? -1),
  canvasOpaque: Math.round(window.__marks.canvasOpaque ?? -1),
}))
await ctx2.close()

console.log(JSON.stringify(out, null, 2))
