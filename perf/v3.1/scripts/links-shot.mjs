import { chromium } from 'file:///C:/Users/tairc/Documents/codespace/qairuhub-test-landing/node_modules/playwright/index.mjs'
import { mkdirSync } from 'node:fs'
mkdirSync('perf/v3.1/links', { recursive: true })
const base = process.argv[2]
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--ignore-gpu-blocklist'] })
const errors = []
for (const [path, w, h, tag] of [['/links', 1440, 900, 'en-1440'], ['/links', 390, 844, 'en-390'], ['/kk/links', 390, 844, 'kk-390']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' })
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message.slice(0, 120)}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} console: ${m.text().slice(0, 120)}`) })
  await page.goto(base + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3500)
  await page.screenshot({ path: `perf/v3.1/links/${tag}.png`, fullPage: w < 700 })
  const info = await page.evaluate(() => ({ title: document.title, rows: [...document.querySelectorAll('.link-row')].map((a) => ({ href: a.getAttribute('href'), text: a.innerText.replace(/\n/g, ' | ').slice(0, 80) })) }))
  console.log(tag, JSON.stringify(info))
  await page.close()
}
console.log('errors:', errors.length ? errors.join(' | ') : 'none')
await browser.close()
