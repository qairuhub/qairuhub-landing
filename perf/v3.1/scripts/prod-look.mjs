import { chromium } from 'file:///C:/Users/tairc/Documents/codespace/qairuhub-test-landing/node_modules/playwright/index.mjs'
import { mkdirSync } from 'node:fs'
mkdirSync('perf/v3.1/prod', { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--ignore-gpu-blocklist', '--host-resolver-rules=MAP qairuhub.com 188.114.97.1'] })
const errors = []
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' })
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 120)) })
  await page.goto('https://qairuhub.com/', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: `perf/v3.1/prod/hero-${w}.png` })
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(4500)
  await page.screenshot({ path: `perf/v3.1/prod/end-${w}.png` })
  await page.close()
}
console.log('page errors:', errors.length ? errors.slice(0, 5).join(' | ') : 'none')
await browser.close()
