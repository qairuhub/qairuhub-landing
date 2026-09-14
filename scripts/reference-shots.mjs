/**
 * Capture the reference landing (air.inc) for side-by-side comparison.
 *   node scripts/reference-shots.mjs   → reference/air/*.png
 * Desktop 1440×900 every 900px, mobile 375×812, plus hover/menu states.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const out = 'reference/air'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.goto('https://air.inc', { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
await page.waitForTimeout(6000)
// dismiss cookie banner if present
for (const sel of ['#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', '#CybotCookiebotDialogBodyButtonDecline', 'button:has-text("Decline")']) {
  const b = await page.$(sel); if (b) { await b.click().catch(() => {}); await page.waitForTimeout(500); break }
}
const total = await page.evaluate(() => document.documentElement.scrollHeight)
let i = 0
for (let y = 0; y < total; y += 900) {
  await page.evaluate((v) => window.scrollTo(0, v), y)
  await page.waitForTimeout(2200)
  await page.screenshot({ path: `${out}/desktop-${String(i).padStart(2, '0')}-y${y}.png` })
  i++
}
// interaction states at top
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(1500)
const features = page.locator('header >> text=Features').first()
if (await features.count()) { await features.hover(); await page.waitForTimeout(900); await page.screenshot({ path: `${out}/state-menu-features.png` }) }
const solutions = page.locator('header >> text=Solutions').first()
if (await solutions.count()) { await solutions.hover(); await page.waitForTimeout(900); await page.screenshot({ path: `${out}/state-menu-solutions.png` }) }
await page.mouse.move(10, 400); await page.waitForTimeout(600)
const start = page.locator('header >> text=Start for free').first()
if (await start.count()) { await start.hover(); await page.waitForTimeout(700); await page.screenshot({ path: `${out}/state-hover-primary.png`, clip: { x: 1000, y: 0, width: 440, height: 80 } }); await page.waitForTimeout(1200); await page.screenshot({ path: `${out}/state-hover-primary-late.png`, clip: { x: 1000, y: 0, width: 440, height: 80 } }) }
const demo = page.locator('header >> text=Book a demo').first()
if (await demo.count()) { await demo.hover(); await page.waitForTimeout(700); await page.screenshot({ path: `${out}/state-hover-secondary.png`, clip: { x: 1000, y: 0, width: 440, height: 80 } }) }
await page.close()
// mobile
const m = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
const mp = await m.newPage()
await mp.goto('https://air.inc', { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
await mp.waitForTimeout(6000)
const mt = await mp.evaluate(() => document.documentElement.scrollHeight)
i = 0
for (let y = 0; y < mt; y += 812) {
  await mp.evaluate((v) => window.scrollTo(0, v), y)
  await mp.waitForTimeout(1800)
  await mp.screenshot({ path: `${out}/mobile-${String(i).padStart(2, '0')}-y${y}.png` })
  i++
}
await mp.evaluate(() => window.scrollTo(0, 0)); await mp.waitForTimeout(1000)
const burger = mp.locator('header button').last()
if (await burger.count()) { await burger.click().catch(() => {}); await mp.waitForTimeout(900); await mp.screenshot({ path: `${out}/state-mobile-menu.png` }) }
await browser.close()
console.log('done', { desktopTotal: total, mobileTotal: mt })
