#!/usr/bin/env node
/**
 * Low-perturbation filmstrip: ONE screenshot per run, taken at a fixed delay after navigation,
 * so nothing is captured before the moment being measured (a CDP screencast encodes a JPEG per
 * frame and visibly slows the very reveal it is trying to time).
 *
 *   node perf/v3.1/scripts/filmstrip.mjs <baseUrl> <tag> <vw> <vh> <cpu> <ms,ms,ms...>
 *
 * Writes perf/v3.1/reveal/<tag>-<ms>ms.png and prints the fraction of bright pixels inside the
 * wordmark box for each mark — the wordmark is a big light shape on a dark sky, so the fraction
 * goes from ~0 % (sky only) to ~14 % (wordmark fully faded in).
 */
import { chromium } from 'file:///C:/Users/tairc/Documents/codespace/qairuhub-test-landing/node_modules/playwright/index.mjs'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '..', 'reveal')
mkdirSync(outDir, { recursive: true })
const [base, tag, vw = '1440', vh = '900', cpu = '1', marksArg = '1000,1500,2000,2500,3000,4000,5000'] = process.argv.slice(2)
const W = Number(vw)
const H = Number(vh)
const CPU = Number(cpu)
const mobile = W < 768
const marks = marksArg.split(',').map(Number)
const BOX = { x0: 0.18, x1: 0.84, y0: 0.34, y1: 0.64 }

const rows = []
for (const mark of marks) {
  const profile = mkdtempSync(join(tmpdir(), 'qh-film-'))
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
  if (CPU > 1) {
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  }
  await page.addInitScript(() => { window.__t0 = performance.now() })
  await page.goto(base, { waitUntil: 'commit' })
  await page.waitForFunction((m) => performance.now() - window.__t0 >= m, mark, { polling: 16, timeout: mark + 30000 })
  const file = join(outDir, `${tag}-${mark}ms.png`)
  writeFileSync(file, await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } }))
  const at = await page.evaluate(() => performance.now())
  const util = await ctx.newPage()
  await util.goto('about:blank')
  const bright = await util.evaluate(
    async ([d, box]) => {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = d })
      const c = document.createElement('canvas')
      const X0 = Math.round(img.width * box.x0); const X1 = Math.round(img.width * box.x1)
      const Y0 = Math.round(img.height * box.y0); const Y1 = Math.round(img.height * box.y1)
      c.width = X1 - X0; c.height = Y1 - Y0
      const x = c.getContext('2d', { willReadFrequently: true })
      x.drawImage(img, X0, Y0, c.width, c.height, 0, 0, c.width, c.height)
      const p = x.getImageData(0, 0, c.width, c.height).data
      let n = 0
      for (let i = 0; i < p.length; i += 4) if (0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2] > 120) n++
      return (4 * n) / p.length
    },
    [`data:image/png;base64,${(await import('node:fs')).readFileSync(file).toString('base64')}`, BOX],
  )
  rows.push({ mark, actual: Math.round(at), bright })
  await ctx.close()
  try { rmSync(profile, { recursive: true, force: true }) } catch { /* Windows handle */ }
}
console.log(`\n${tag}  ${W}x${H}  cpu ${CPU}x  ${base}`)
console.log('| shot at (ms) | measured (ms) | bright px in the wordmark box |')
console.log('|---|---|---|')
for (const r of rows) console.log(`| ${r.mark} | ${r.actual} | ${(100 * r.bright).toFixed(2)} % |`)
