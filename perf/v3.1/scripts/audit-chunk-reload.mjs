// A2-01: the guarded reload (src/components/ui/chunkReload.ts). A chunk that fails late must
// reload the tab once, and a chunk that stays missing must not loop.
//   node perf/v3.1/scripts/mac-static-server.mjs <dist> 4831
//   node perf/v3.1/scripts/audit-chunk-reload.mjs http://127.0.0.1:4831
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://127.0.0.1:4831'
const browser = await chromium.launch({ headless: true })
const out = []
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  let loads = 0
  page.on('load', () => loads++)
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)))
  await page.route(/\/assets\/Assistant-[^/]+\.js$/, (r) => r.abort('connectionreset'))
  await page.goto(base + '/?q=low', { waitUntil: 'load' })

  // 1. early failure (< 30 s after load): fallback only, no reload
  await page.waitForTimeout(2000)
  await page.click('button.qa-fab__btn')
  await page.waitForTimeout(2000)
  out.push({
    step: 'early click (t≈4s)',
    loads,
    stored: await page.evaluate(() => sessionStorage.getItem('qh.chunkReload')),
    dialog: await page.locator('[role="dialog"]').count(),
    blank: (await page.evaluate(() => document.getElementById('root')?.childElementCount ?? -1)) === 0,
  })

  // 2. failure after 30 s: exactly one reload
  await page.waitForTimeout(30_000)
  await page.click('button.qa-fab__btn')
  await page.waitForTimeout(4000)
  const afterLate = {
    step: 'late click (t≈36s)',
    loads,
    stored: await page.evaluate(() => sessionStorage.getItem('qh.chunkReload')),
    blank: (await page.evaluate(() => document.getElementById('root')?.childElementCount ?? -1)) === 0,
    launcher: await page.locator('button.qa-fab__btn').count(),
  }
  out.push(afterLate)

  // 3. the chunk is still missing: the next failures must not reload again (5 min guard)
  await page.waitForTimeout(31_000)
  await page.click('button.qa-fab__btn')
  await page.waitForTimeout(2500)
  await page.click('button.qa-fab__btn')
  await page.waitForTimeout(2500)
  out.push({
    step: 'two more late clicks',
    loads,
    stored: await page.evaluate(() => sessionStorage.getItem('qh.chunkReload')),
    dialog: await page.locator('[role="dialog"]').count(),
    blank: (await page.evaluate(() => document.getElementById('root')?.childElementCount ?? -1)) === 0,
    launcher: await page.locator('button.qa-fab__btn').count(),
    errors: [...new Set(errors)].slice(0, 4),
  })
  await ctx.close()
} finally {
  await browser.close()
}
console.log(JSON.stringify(out, null, 1))
