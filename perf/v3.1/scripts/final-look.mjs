import { chromium } from 'file:///C:/Users/tairc/Documents/codespace/qairuhub-test-landing/node_modules/playwright/index.mjs'
import { mkdirSync } from 'node:fs'
const base = process.argv[2]
const out = 'perf/v3.1/final'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--ignore-gpu-blocklist'] })
const errors = []
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' })
  page.on('pageerror', (e) => errors.push(`${w}: ${e.message.slice(0, 120)}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${w} console: ${m.text().slice(0, 120)}`) })
  for (const [name, path] of [['home', '/'], ['kk', '/kk/'], ['members', '/members']]) {
    await page.goto(base + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3500)
    await page.screenshot({ path: `${out}/${name}-top-${w}.png` })
    if (name !== 'members') {
      const total = await page.evaluate(() => document.documentElement.scrollHeight)
      for (const frac of [0.5, 0.8, 1]) {
        await page.evaluate((y) => window.scrollTo(0, y), Math.round(total * frac))
        await page.waitForTimeout(1200)
        await page.screenshot({ path: `${out}/${name}-${Math.round(frac * 100)}-${w}.png` })
      }
    }
  }
  await page.close()
}
console.log('errors:', errors.length ? errors.slice(0, 6).join(' | ') : 'none')
await browser.close()
