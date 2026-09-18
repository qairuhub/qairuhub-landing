#!/usr/bin/env node
/** Shoot the footer twice (copy visible / copy transparent) plus the text boxes, for contrast.mjs' Python half. */
import { chromium } from 'file:///C:/Users/tairc/Documents/codespace/qairuhub-test-landing/node_modules/playwright/index.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
const base = process.argv[2]
const out = 'perf/v3.1/contrast'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--ignore-gpu-blocklist'] })
const cases = []
for (const [path, w, h] of [['/', 1440, 900], ['/', 390, 844], ['/kk/', 1440, 900], ['/kk/', 390, 844], ['/', 1024, 768]]) {
  const tag = `${path === '/' ? 'en' : 'kk'}-${w}x${h}`
  const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' })
  await page.goto(base + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(4500)
  const boxes = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('.footer a, .footer p, .footer small, .footer span, .footer div')) {
      if (el.children.length || !el.textContent.trim()) continue
      const r = el.getBoundingClientRect()
      if (r.width < 8 || r.height < 6 || r.bottom < 0 || r.top > innerHeight) continue
      const cs = getComputedStyle(el)
      out.push({ text: el.textContent.trim().slice(0, 24), color: cs.color, size: parseFloat(cs.fontSize), weight: cs.fontWeight, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) })
    }
    return out
  })
  await page.screenshot({ path: `${out}/${tag}-text.png` })
  await page.addStyleTag({ content: '.footer a, .footer p, .footer small, .footer span, .footer div { color: transparent !important; text-shadow: none !important; }' })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${out}/${tag}-plate.png` })
  cases.push({ tag, boxes })
  await page.close()
}
writeFileSync(`${out}/boxes.json`, JSON.stringify(cases, null, 1))
console.log('cases:', cases.map((c) => `${c.tag}:${c.boxes.length}`).join(' '))
await browser.close()
