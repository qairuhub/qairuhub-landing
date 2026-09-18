#!/usr/bin/env node
/** Contrast of the footer copy over what is really behind it: shoot twice (text visible / text
 *  transparent), take the 95th-percentile background luminance in each text box, compare. */
import { chromium } from 'file:///C:/Users/tairc/Documents/codespace/qairuhub-test-landing/node_modules/playwright/index.mjs'
const base = process.argv[2]
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--ignore-gpu-blocklist'] })
for (const [path, w, h] of [['/', 1440, 900], ['/', 390, 844], ['/kk/', 1440, 900], ['/kk/', 390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' })
  await page.goto(base + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(4000)
  const boxes = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('.footer a, .footer p, .footer small, .footer span')) {
      const r = el.getBoundingClientRect()
      if (r.width < 8 || r.height < 6 || r.bottom < 0 || r.top > innerHeight) continue
      const cs = getComputedStyle(el)
      if (!el.textContent.trim()) continue
      out.push({ text: el.textContent.trim().slice(0, 22), color: cs.color, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), size: parseFloat(cs.fontSize) })
    }
    return out.slice(0, 14)
  })
  const shot = await page.screenshot()
  await page.addStyleTag({ content: '.footer a, .footer p, .footer small, .footer span { color: transparent !important; text-shadow: none !important; }' })
  await page.waitForTimeout(600)
  const plate = await page.screenshot()
  const { PNG } = await import('file:///C:/Users/tairc/Documents/codespace/qairuhub-test-landing/node_modules/pngjs/lib/png.js').catch(() => ({ PNG: null }))
  if (!PNG) { console.log('pngjs missing'); break }
  const bg = PNG.sync.read(plate)
  let worst = { r: 99 }
  for (const b of boxes) {
    const lums = []
    for (let y = b.y; y < Math.min(b.y + b.h, bg.height); y += 2) for (let x = b.x; x < Math.min(b.x + b.w, bg.width); x += 2) {
      const i = (bg.width * y + x) << 2
      lums.push(lum([bg.data[i], bg.data[i + 1], bg.data[i + 2]]))
    }
    if (!lums.length) continue
    lums.sort((p, q) => p - q)
    const p95 = lums[Math.floor(lums.length * 0.95)]
    const m = b.color.match(/[\d.]+/g).map(Number)
    const alpha = m[3] ?? 1
    const back = lums[Math.floor(lums.length * 0.5)]
    const eff = [0, 1, 2].map((k) => m[k] * alpha + (k === 0 ? 255 * 0 : 0) * (1 - alpha))
    const textL = lum(alpha >= 0.99 ? m : eff.map((v, k) => v + (bg.data[0] * 0) + (1 - alpha) * 255 * back))
    const r = ratio(textL, p95)
    if (r < worst.r) worst = { r, ...b }
  }
  console.log(`${path} ${w}x${h}: worst ${worst.r.toFixed(2)}:1 on "${worst.text}" (${worst.size}px, ${worst.color})`)
  await page.close()
}
await browser.close()
