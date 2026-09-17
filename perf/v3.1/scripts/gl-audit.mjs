#!/usr/bin/env node
/**
 * WebGL buffer / texture upload audit across the whole home journey (installed Chrome, headed,
 * real GPU). For each config: load, settle at the hero, step the scroll to the footer (Lenis
 * `scrollTo(..., { immediate })` in 0.25 vh steps, 120 ms each, so every journey phase renders),
 * settle at the footer, walk back to the top, then map every recorded upload to its owner.
 *
 *   node perf/v3.1/scripts/gl-audit.mjs [baseUrl] [--only=high-1440,...] [--corrupt=1048576:zero]
 *
 * Output: perf/v3.1/mac-safari/gl-audit-<config>.json (+ hero/footer screenshots) and a summary on stdout.
 * With --corrupt the ARRAY/ELEMENT buffers above the limit are damaged (Mac failure model) and
 * the outputs are suffixed `-corrupt-<mode>`.
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '..', 'mac-safari')
mkdirSync(outDir, { recursive: true })
const args = process.argv.slice(2)
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=')
const base = (args.find((a) => !a.startsWith('--')) || 'http://127.0.0.1:4391').replace(/\/+$/, '')
const only = flag('only')?.split(',')
const corruptArg = flag('corrupt')
const corrupt = corruptArg ? { limit: Number(corruptArg.split(':')[0]), mode: corruptArg.split(':')[1] || 'zero' } : null
const initSrc = readFileSync(join(here, 'gl-audit-init.js'), 'utf8')

const CONFIGS = [
  { id: 'high-1440', q: 'high', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  { id: 'medium-1440', q: 'medium', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  { id: 'low-1440', q: 'low', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  { id: 'low-390', q: 'low', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
].filter((c) => !only || only.includes(c.id))

const KiB = 1024

/** Owners three.js does not expose through a scene (renderer internals), by shape. */
function guessOwner(r, cfg, canvas) {
  if (r.owner) return r.owner
  if (r.w === 336 && r.h === 256) return 'three PMREMGenerator CubeUV target (env map of the 64² <Environment>, internal)'
  if (r.target === 'TEXTURE_CUBE_MAP' || /^CUBE_FACE/.test(r.target)) return 'drei <Environment> WebGLCubeRenderTarget (64² × 6)'
  if (r.target === 'RENDERBUFFER') {
    if (canvas && Math.abs(r.w - canvas.w) <= 1 && Math.abs(r.h - canvas.h) <= 1) return 'canvas-size renderbuffer (three transmission / MSAA resolve)'
    if ([512, 384, 256].includes(r.w) && r.w === r.h) return 'drei MeshTransmissionMaterial FBO depth'
    if (r.w === 32 && r.h === 32) return 'drei backside FBO depth (32²)'
    if (r.w === 64 && r.h === 64) return 'drei <Environment> cube RT depth'
    return 'renderbuffer (render target depth)'
  }
  if (r.target === 'ARRAY_BUFFER' || r.target === 'ELEMENT_ARRAY_BUFFER') return 'three internal geometry (PMREM LOD planes / background) — not in a scene'
  return null
}
const fmt = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(2)} MiB` : `${(b / KiB).toFixed(1)} KiB`)

const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--ignore-gpu-blocklist', '--disable-features=Translate'] })
const results = []
for (const cfg of CONFIGS) {
  const suffix = corrupt ? `-corrupt-${corrupt.mode}` : ''
  const context = await browser.newContext({
    viewport: cfg.viewport,
    deviceScaleFactor: cfg.deviceScaleFactor,
    isMobile: !!cfg.isMobile,
    hasTouch: !!cfg.hasTouch,
    userAgent: cfg.isMobile
      ? 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'
      : undefined,
  })
  if (corrupt) await context.addInitScript(`window.__GL_AUDIT_CORRUPT = ${JSON.stringify(corrupt)};`)
  await context.addInitScript(initSrc)
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 300))
  })
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 300)))

  const t0 = Date.now()
  await page.goto(`${base}/?q=${cfg.q}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(4000)
  const renderer = await page.evaluate(() => {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    const e = gl && gl.getExtension('WEBGL_debug_renderer_info')
    return gl ? gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : 'none'
  })
  await page.screenshot({ path: join(outDir, `gl-${cfg.id}${suffix}-hero.png`), scale: 'css' })

  await page.evaluate(() => (window.__glAudit.mark = 'scroll-down'))
  const geo = await page.evaluate(() => ({ limit: document.documentElement.scrollHeight - window.innerHeight, vh: window.innerHeight }))
  const step = Math.round(geo.vh * 0.25)
  for (let y = 0; y <= geo.limit + step; y += step) {
    await page.evaluate((v) => {
      window.__lenis?.scrollTo(v, { immediate: true, force: true })
      window.scrollTo(0, v)
    }, Math.min(y, geo.limit))
    await page.waitForTimeout(120)
  }
  // the page can grow while lazy sections mount; land on the true end
  const limit2 = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
  await page.evaluate((v) => {
    window.__lenis?.scrollTo(v, { immediate: true, force: true })
    window.scrollTo(0, v)
  }, limit2)
  await page.evaluate(() => (window.__glAudit.mark = 'footer'))
  await page.waitForTimeout(3500)
  await page.screenshot({ path: join(outDir, `gl-${cfg.id}${suffix}-footer.png`), scale: 'css' })

  // A little real wheel input at the end (Lenis path), then back to the top.
  await page.evaluate(() => (window.__glAudit.mark = 'scroll-up'))
  for (let y = limit2; y >= 0; y -= step * 4) {
    await page.evaluate((v) => window.__lenis?.scrollTo(v, { immediate: true, force: true }), Math.max(0, y))
    await page.waitForTimeout(60)
  }
  await page.evaluate(() => {
    window.__lenis?.scrollTo(0, { immediate: true, force: true })
    window.__glAudit.mark = 'top-again'
  })
  if (!cfg.isMobile) {
    await page.mouse.move(700, 450)
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 240)
      await page.waitForTimeout(150)
    }
  }
  await page.waitForTimeout(1500)

  const meta = await page.evaluate(() => window.__glAuditOwners())
  const recs = await page.evaluate(() =>
    window.__glAudit.recs.map((r) => {
      const { marks, ...rest } = r
      return { ...rest, marks }
    }),
  )
  for (const r of recs) {
    if (r.owner) continue
    const g = guessOwner(r, cfg, meta.canvases[0])
    if (g) {
      r.owner = g
      r.ownerGuessed = true
    }
  }
  const corrupted = await page.evaluate(() => window.__glAudit.corrupted)
  const result = { config: cfg, url: `${base}/?q=${cfg.q}`, renderer, limit: limit2, ms: Date.now() - t0, meta, errors, corrupted, recs }
  writeFileSync(join(outDir, `gl-audit-${cfg.id}${suffix}.json`), JSON.stringify(result, null, 1))
  results.push(result)

  const uploads = recs.filter((r) => r.upload)
  const big = recs.filter((r) => r.bytes > 256 * KiB)
  console.log(`\n== ${cfg.id}${suffix}  renderer=${renderer}  canvases=${JSON.stringify(meta.canvases)}  scenes=${meta.scenes}`)
  console.log(`   records ${recs.length}, uploads ${uploads.length}, upload bytes ${fmt(uploads.reduce((s, r) => s + (r.fn === 'bufferSubData' ? 0 : r.bytes || 0), 0))}, errors ${errors.length}`)
  for (const r of big.sort((a, b) => b.bytes - a.bytes)) {
    console.log(
      `   ${r.bytes > 1048576 ? '>1MiB ' : '>256K '} ${fmt(r.bytes).padStart(11)} ${r.fn.padEnd(16)} ${String(r.target).padEnd(20)} ${r.upload ? 'upload' : 'alloc '} ${r.w ? r.w + 'x' + r.h + (r.d > 1 ? 'x' + r.d : '') + ' ' + r.ifmt : ''} ${r.attr || ''} mark=${r.mark} -> ${r.owner || '(unowned) ' + (r.stack || []).slice(0, 3).join(' < ')}`,
    )
  }
  if (errors.length) console.log('   errors:', errors.slice(0, 5))
  if (corrupted.length) console.log('   corrupted:', JSON.stringify(corrupted))
  await context.close()
}
await browser.close()
