/**
 * Engine check: load the pages in one engine, record page errors / failed requests, and take
 * screenshots to be read afterwards.
 *   node perf/v3.1/scripts/verify-engine.mjs <baseUrl> <chrome|webkit> [desktop|phone]
 * Screenshots go to $SHOT_DIR (default perf/v3.1/shots/).
 */
import { chromium, webkit } from 'playwright'
import { mkdirSync } from 'node:fs'

const base = process.argv[2] ?? 'http://127.0.0.1:8806'
const engine = process.argv[3] ?? 'webkit'
const form = process.argv[4] ?? 'desktop'
const outDir = process.env.SHOT_DIR ?? 'perf/v3.1/shots/'
mkdirSync(outDir, { recursive: true })

const browser =
  engine === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ channel: 'chrome', headless: false })
const context = await browser.newContext(
  form === 'phone'
    ? { viewport: { width: 390, height: 844 }, isMobile: engine !== 'webkit', hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1440, height: 900 } },
)
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`)
})
page.on('requestfailed', (r) => {
  const f = r.failure()?.errorText ?? ''
  if (!/ERR_ABORTED/.test(f)) errors.push(`requestfailed: ${r.url().slice(0, 120)} ${f}`)
})

const report = []
for (const [name, path] of [
  ['home', '/'],
  ['members', '/members'],
]) {
  await page.goto(base + path, { waitUntil: 'load' })
  await page.waitForTimeout(5000)
  const info = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim().slice(0, 60) ?? null,
    canvases: document.querySelectorAll('canvas').length,
    rootChildren: document.getElementById('root')?.childElementCount ?? 0,
    height: Math.round(document.documentElement.scrollHeight),
    launcher: !!document.querySelector('.qa-fab__btn'),
  }))
  await page.screenshot({ path: `${outDir}${engine}-${form}-${name}.png` })
  report.push({ name, ...info })
}
await browser.close()
console.log(JSON.stringify({ engine, form, report, errors }, null, 2))
