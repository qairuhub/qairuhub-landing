/**
 * Screenshot the running site at desktop + mobile, scrolling through the whole page.
 *   SHOTS_URL=http://localhost:5173 SHOTS_DIR=shots node scripts/shots.mjs
 * Also reports console errors and horizontal overflow.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const base = process.env.SHOTS_URL || 'http://localhost:5173'
const out = process.env.SHOTS_DIR || 'shots'
const only = process.env.SHOTS_ONLY // 'desktop' | 'mobile' | 'tablet'
mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const report = { consoleErrors: [], overflow: {}, heights: {} }

async function run(name, viewport, step, opts = {}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, ...opts })
  page.on('console', (m) => {
    if (m.type() === 'error') report.consoleErrors.push(`[${name}] ${m.text()}`)
  })
  page.on('pageerror', (e) => report.consoleErrors.push(`[${name}] pageerror: ${e.message}`))
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  const total = await page.evaluate(() => document.documentElement.scrollHeight)
  report.heights[name] = total
  report.overflow[name] = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  let i = 0
  for (let y = 0; y < total; y += step) {
    await page.evaluate((v) => {
      if (window.__lenis) window.__lenis.scrollTo(v, { immediate: true })
      window.scrollTo(0, v)
    }, y)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: join(out, `${name}-${String(i).padStart(2, '0')}-y${y}.png`) })
    i++
  }
  await page.close()
}

if (!only || only === 'desktop') await run('desktop', { width: 1440, height: 900 }, 900)
if (!only || only === 'tablet') await run('tablet', { width: 768, height: 1024 }, 1024)
if (!only || only === 'mobile') await run('mobile', { width: 375, height: 812 }, 812, { isMobile: true, hasTouch: true })

await browser.close()
console.log(JSON.stringify(report, null, 2))
if (report.consoleErrors.length) process.exitCode = 2
