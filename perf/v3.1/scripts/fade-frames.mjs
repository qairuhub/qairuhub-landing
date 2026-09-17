#!/usr/bin/env node
/** Screencast frames across the wordmark fade (visual check only; the capture perturbs timing). */
import { chromium } from 'file:///C:/Users/tairc/Documents/codespace/qairuhub-test-landing/node_modules/playwright/index.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
const base = process.argv[2] || 'http://127.0.0.1:8810'
const out = 'perf/v3.1/reveal'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const cdp = await page.context().newCDPSession(page)
const frames = []
cdp.on('Page.screencastFrame', async (f) => {
  frames.push({ t: Date.now(), data: f.data })
  try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }) } catch {}
})
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 1 })
const t0 = Date.now()
await page.goto(base, { waitUntil: 'commit' })
await page.waitForTimeout(6000)
await cdp.send('Page.stopScreencast')
// brightness inside the wordmark box per frame
const picks = []
for (let i = 0; i < frames.length; i++) picks.push({ i, ms: frames[i].t - t0 })
console.log('frames', frames.length, 'span', picks.at(-1)?.ms, 'ms')
const saved = []
for (const p of picks) {
  if (p.ms < 1500 || p.ms > 5000) continue
  if (saved.length && p.ms - saved.at(-1).ms < 120) continue
  const file = `${out}/fade-${String(p.ms).padStart(4, '0')}ms.jpg`
  writeFileSync(file, Buffer.from(frames[p.i].data, 'base64'))
  saved.push({ ms: p.ms, file })
}
console.log(saved.map((s) => `${s.ms}ms ${s.file}`).join('\n'))
await browser.close()
