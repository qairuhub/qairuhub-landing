#!/usr/bin/env node
/**
 * Deep links must end with the target 72 px below the viewport top (ANCHOR_OFFSET), and stay
 * there while the page settles: the home page no longer preloads Anton / Caveat, so those faces
 * swap in after `load` and change the height above the target (SmoothScroll re-lands it for 4 s).
 *
 *   node perf/v3.1/scripts/check-deeplinks.mjs <baseUrl> <vw> <vh> [waitMs]
 *
 * Also reports document scrollHeight, which must match the baseline (staged section mounting
 * must not change the layout).
 */
import { chromium } from 'file:///C:/Users/tairc/Documents/codespace/qairuhub-test-landing/node_modules/playwright/index.mjs'

const [base, vw = '1440', vh = '900', waitMs = '7000'] = process.argv.slice(2)
const W = Number(vw)
const H = Number(vh)
const HASHES = ['#platform', '#join', '#news', '#launchpad']

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--ignore-gpu-blocklist', '--host-resolver-rules=MAP qairuhub.com 188.114.97.1'] })
const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: W < 768, hasTouch: W < 768 })
const rows = []
for (const hash of HASHES) {
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${base}/${hash}`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(Number(waitMs))
  const r = await page.evaluate((h) => {
    const el = document.getElementById(h.slice(1))
    return el ? { top: Math.round(el.getBoundingClientRect().top), y: Math.round(window.scrollY), height: document.documentElement.scrollHeight } : null
  }, hash)
  rows.push({ hash, ...(r ?? { top: null, y: null, height: null }), errors: errors.length })
  await page.close()
}
// Scroll height of a plain load, after everything has mounted.
const page = await ctx.newPage()
await page.goto(base + '/', { waitUntil: 'load', timeout: 60000 })
await page.waitForTimeout(Number(waitMs))
const height = await page.evaluate(() => document.documentElement.scrollHeight)
await page.close()
await browser.close()
console.log(`\n${base}  ${W}x${H}  (target must land at top = 72 px)`)
console.log('| hash | target top (px) | scrollY | scrollHeight | page errors |')
console.log('|---|---|---|---|---|')
for (const r of rows) console.log(`| ${r.hash} | ${r.top ?? 'NOT FOUND'} | ${r.y} | ${r.height} | ${r.errors} |`)
console.log(`\nplain load scrollHeight: ${height}`)
