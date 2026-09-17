#!/usr/bin/env node
/**
 * Visual parity: the local build vs production (https://qairuhub.com), real headed Chrome.
 *
 *   node perf/v3.1/scripts/compare-visual.mjs <localBase> [tag]
 *
 * Shoots hero / mid / footer on the home page plus /members and /kk/ at 1440x900 and 390x844,
 * on BOTH sites, and reports the share of differing pixels. Runs with prefers-reduced-motion so
 * the sky animation, the Lenis glide and the Ask-bar typewriter are stilled — otherwise the diff
 * only measures animation phase. Production is reached through the host-resolver trick because
 * this ISP drops TLS to some Cloudflare anycast addresses.
 *
 * Writes perf/v3.1/visual/<tag>-<case>-{local,prod,diff}.png and prints a table.
 */
import { chromium } from 'file:///C:/Users/tairc/Documents/codespace/qairuhub-test-landing/node_modules/playwright/index.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '..', 'visual')
mkdirSync(outDir, { recursive: true })
const [local, tag = 'v31'] = process.argv.slice(2)
const PROD = 'https://qairuhub.com'

const VIEWPORTS = [
  { name: '1440', w: 1440, h: 900, mobile: false },
  { name: '390', w: 390, h: 844, mobile: true },
]
/** where: 'hero' | 'mid' | 'footer' */
const CASES = [
  { page: 'home', path: '/', where: 'hero' },
  { page: 'home', path: '/', where: 'mid' },
  { page: 'home', path: '/', where: 'footer' },
  { page: 'members', path: '/members', where: 'hero' },
  { page: 'kk', path: '/kk/', where: 'hero' },
]

async function shoot(ctx, base, { path, where }, vp) {
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(base + path, { waitUntil: 'load', timeout: 60000 })
  // wait for the sky canvas to be revealed (or accept that this page has none)
  await page
    .waitForFunction(() => { const c = document.querySelector('canvas'); return !c || c.style.opacity === '1' || getComputedStyle(c).opacity === '1' }, null, { timeout: 30000 })
    .catch(() => {})
  await page.waitForTimeout(2500)
  if (where !== 'hero') {
    const total = await page.evaluate(() => document.documentElement.scrollHeight)
    const target = where === 'footer' ? total : Math.round(total * 0.5)
    for (let y = 0; y <= target; y += Math.max(300, Math.round(vp.h * 0.8))) {
      await page.evaluate((v) => window.scrollTo(0, v), y)
      await page.waitForTimeout(160)
    }
    await page.evaluate((v) => window.scrollTo(0, v), target)
    await page.waitForTimeout(3000)
  }
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: vp.w, height: vp.h } })
  await page.close()
  return { buf, errors }
}

/** Diff two PNG buffers inside the browser (no native image dependency in this repo). */
async function diff(page, a, b) {
  return page.evaluate(
    async ([da, db]) => {
      const load = (d) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = d })
      const [ia, ib] = await Promise.all([load(da), load(db)])
      if (ia.width !== ib.width || ia.height !== ib.height) return { size: `${ia.width}x${ia.height} vs ${ib.width}x${ib.height}`, pct: null, out: null }
      const c = document.createElement('canvas')
      c.width = ia.width
      c.height = ia.height
      const x = c.getContext('2d', { willReadFrequently: true })
      x.drawImage(ia, 0, 0)
      const A = x.getImageData(0, 0, c.width, c.height)
      x.clearRect(0, 0, c.width, c.height)
      x.drawImage(ib, 0, 0)
      const B = x.getImageData(0, 0, c.width, c.height)
      const O = x.createImageData(c.width, c.height)
      let n = 0
      for (let i = 0; i < A.data.length; i += 4) {
        const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2])
        const hit = d > 24 // ignore 1-step AA / dithering noise
        if (hit) n++
        O.data[i] = hit ? 255 : A.data[i] >> 2
        O.data[i + 1] = hit ? 0 : A.data[i + 1] >> 2
        O.data[i + 2] = hit ? 0 : A.data[i + 2] >> 2
        O.data[i + 3] = 255
      }
      x.putImageData(O, 0, 0)
      return { size: `${c.width}x${c.height}`, pct: (100 * n) / (c.width * c.height), out: c.toDataURL('image/png') }
    },
    [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`],
  )
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--ignore-gpu-blocklist', '--host-resolver-rules=MAP qairuhub.com 188.114.97.1'],
})
const rows = []
const util = await browser.newContext()
const utilPage = await util.newPage()
await utilPage.goto('about:blank')

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    reducedMotion: 'reduce',
  })
  for (const c of CASES) {
    const name = `${c.page}-${c.where}-${vp.name}`
    let L, P, d
    try {
      L = await shoot(ctx, local, c, vp)
      P = await shoot(ctx, PROD, c, vp)
      writeFileSync(join(outDir, `${tag}-${name}-local.png`), L.buf)
      writeFileSync(join(outDir, `${tag}-${name}-prod.png`), P.buf)
      d = await diff(utilPage, L.buf, P.buf)
      if (d.out) writeFileSync(join(outDir, `${tag}-${name}-diff.png`), Buffer.from(d.out.split(',')[1], 'base64'))
    } catch (e) {
      rows.push({ name, pct: null, note: 'ERROR ' + e.message.slice(0, 120) })
      continue
    }
    rows.push({ name, pct: d.pct, size: d.size, localErrors: L.errors.length, prodErrors: P.errors.length })
  }
  await ctx.close()
}
await browser.close()
console.log('\n| case | differing pixels | size | local page errors | prod page errors |')
console.log('|---|---|---|---|---|')
for (const r of rows) console.log(`| ${r.name} | ${r.pct == null ? (r.note ?? 'n/a') : r.pct.toFixed(3) + ' %'} | ${r.size ?? ''} | ${r.localErrors ?? ''} | ${r.prodErrors ?? ''} |`)
