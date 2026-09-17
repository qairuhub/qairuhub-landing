#!/usr/bin/env node
/**
 * When does the 3D wordmark actually become VISIBLE on screen?
 *
 *   node perf/v3.1/scripts/measure-wordmark.mjs <baseUrl> <tag> <vw> <vh> [cpuThrottle] [runs]
 *
 * `measure-reveal.mjs` reports the instrumented milestones (first draw, fade). This one is
 * pixel-based and build-agnostic, so the current build and the deployed one can be compared:
 * it records a CDP screencast of the hero from navigation and finds the frame where the
 * wordmark box turns bright. The wordmark is a big light shape on a dark sky, so the fraction
 * of bright pixels inside its box is a clean, wordmark-specific signal (stars are sparse).
 *
 *   wordmark50 / wordmark90  first frame at 50 % / 90 % of the settled bright-pixel fraction
 *   skyFirst                 first frame where the box stops being the flat CSS gradient
 *
 * Caveat: the screencast itself costs a few ms per frame, and a run against production also
 * pays real network latency; compare like with like.
 */
import { chromium } from 'file:///C:/Users/tairc/Documents/codespace/qairuhub-test-landing/node_modules/playwright/index.mjs'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '..', 'reveal')
mkdirSync(outDir, { recursive: true })
const [base, tag, vw = '1440', vh = '900', throttle = '1', runs = '3', settle = '9000'] = process.argv.slice(2)
const W = Number(vw)
const H = Number(vh)
const CPU = Number(throttle)
const mobile = W < 768
/** The wordmark box as a fraction of the viewport (covers both the 1440 and the 390 layout). */
const BOX = { x0: 0.18, x1: 0.84, y0: 0.34, y1: 0.64 }

const analyse = async (page, frames) =>
  page.evaluate(
    async ([list, box]) => {
      const load = (d) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = d })
      const c = document.createElement('canvas')
      const x = c.getContext('2d', { willReadFrequently: true })
      const out = []
      for (const f of list) {
        const img = await load('data:image/jpeg;base64,' + f.data)
        const X0 = Math.round(img.width * box.x0)
        const X1 = Math.round(img.width * box.x1)
        const Y0 = Math.round(img.height * box.y0)
        const Y1 = Math.round(img.height * box.y1)
        c.width = X1 - X0
        c.height = Y1 - Y0
        x.drawImage(img, X0, Y0, c.width, c.height, 0, 0, c.width, c.height)
        const d = x.getImageData(0, 0, c.width, c.height).data
        let bright = 0
        let sum = 0
        let sum2 = 0
        const n = d.length / 4
        for (let i = 0; i < d.length; i += 4) {
          const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
          if (l > 120) bright++
          sum += l
          sum2 += l * l
        }
        out.push({ t: f.t, bright: bright / n, std: Math.sqrt(Math.max(0, sum2 / n - (sum / n) ** 2)) })
      }
      return out
    },
    [frames, BOX],
  )

const rows = []
for (let i = 1; i <= Number(runs); i++) {
  const profile = mkdtempSync(join(tmpdir(), 'qh-wm-'))
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    headless: false,
    args: ['--ignore-gpu-blocklist', '--host-resolver-rules=MAP qairuhub.com 188.114.97.1'],
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
  })
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  const cdp = await ctx.newCDPSession(page)
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  const frames = []
  cdp.on('Page.screencastFrame', async (f) => {
    frames.push({ t: f.metadata.timestamp * 1000, data: f.data })
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }) } catch { /* closed */ }
  })
  // Downscale and cap the rate: a full-size JPEG per frame costs enough main-thread time to
  // move the very number we are measuring, and 200 full frames also blow up the analysis payload.
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1, maxWidth: 640, maxHeight: 640 })
  await page.goto(base, { waitUntil: 'commit' })
  await page.waitForTimeout(Number(settle))
  await cdp.send('Page.stopScreencast').catch(() => {})
  const origin = await page.evaluate(() => performance.timeOrigin)
  const util = await ctx.newPage()
  await util.goto('about:blank')
  const all = frames.map((f) => ({ t: f.t - origin, data: f.data }))
  const series = []
  for (let k = 0; k < all.length; k += 25) series.push(...(await analyse(util, all.slice(k, k + 25))))
  series.sort((a, b) => a.t - b.t)
  writeFileSync(join(outDir, `${tag}-r${i}-series.json`), JSON.stringify(series))
  const tail = series.slice(-8)
  const settled = tail.reduce((s, p) => s + p.bright, 0) / Math.max(1, tail.length)
  const baseBright = series[0]?.bright ?? 0
  const baseStd = series[0]?.std ?? 0
  const maxStd = Math.max(...series.map((p) => p.std))
  const at = (f) => series.find((p) => p.bright >= baseBright + f * (settled - baseBright))?.t ?? null
  const skyFirst = series.find((p) => p.std > baseStd + 0.25 * (maxStd - baseStd))?.t ?? null
  if (frames.length) writeFileSync(join(outDir, `${tag}-r${i}-last.jpg`), Buffer.from(frames[frames.length - 1].data, 'base64'))
  rows.push({ run: i, frames: series.length, skyFirst, w50: at(0.5), w90: at(0.9), settledBright: settled })
  await ctx.close()
  try { rmSync(profile, { recursive: true, force: true }) } catch { /* Windows handle */ }
}
const ms = (v) => (v == null ? 'n/a' : Math.round(v))
const med = (k) => { const s = rows.map((r) => r[k]).filter((v) => v != null).sort((a, b) => a - b); return s.length ? s[(s.length - 1) >> 1] : null }
console.log(`\n${tag}  ${W}x${H}  cpu ${CPU}x  ${base}  (ms after navigationStart, screencast)`)
console.log('| run | frames | sky first paint | wordmark 50 % | wordmark 90 % | settled bright px |')
console.log('|---|---|---|---|---|---|')
for (const r of rows) console.log(`| ${r.run} | ${r.frames} | ${ms(r.skyFirst)} | ${ms(r.w50)} | ${ms(r.w90)} | ${(100 * r.settledBright).toFixed(1)} % |`)
console.log(`| **median** | | ${ms(med('skyFirst'))} | ${ms(med('w50'))} | ${ms(med('w90'))} | |`)
