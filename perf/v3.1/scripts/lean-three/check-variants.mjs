// AUDIT 2: renders two builds (default base vs lean2) with reduced motion (frameloop "demand", time 0,
// so frames are deterministic) at ?q=low|medium|high, hero + footer, plus /members; collects page
// errors / console errors and writes PNGs + md5s. Headless = SwiftShader, which is enough for a
// pixel-parity check; the real-GPU / Mac buffer check stays with verify.mjs.
//
//   node perf/v3.1/scripts/lean-three/build-variant.mjs base
//   node perf/v3.1/scripts/lean-three/build-variant.mjs lean2
//   node perf/v3.1/scripts/lean-three/check-variants.mjs base lean2
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../../..')
const outBase = process.env.OUT_DIR ?? join(tmpdir(), 'qh-lean-three')
const [a = 'base', b = 'lean2'] = process.argv.slice(2)
const variants = { [a]: 4811, [b]: 4812 }
const server = join(root, 'perf/v3.1/scripts/mac-static-server.mjs')
for (const v of Object.keys(variants)) {
  const dir = join(outBase, `out-${v}`)
  // build-html.mjs is not part of the prototype build: the index template also serves /members here
  if (!existsSync(join(dir, 'members.html'))) copyFileSync(join(dir, 'index.html'), join(dir, 'members.html'))
}
const procs = Object.entries(variants).map(([v, port]) => spawn(process.execPath, [server, join(outBase, `out-${v}`), String(port)], { stdio: 'ignore' }))
await new Promise((r) => setTimeout(r, 1200))
const md5 = (file) => createHash('md5').update(readFileSync(file)).digest('hex')
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const report = {}
const noise = /KHR_parallel_shader_compile|GPU stall due to ReadPixels/
try {
  for (const [v, port] of Object.entries(variants)) {
    for (const q of ['low', 'medium', 'high']) {
      const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' })
      const page = await ctx.newPage()
      const errors = []
      page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
      page.on('console', (m) => {
        if ((m.type() === 'error' || m.type() === 'warning') && !noise.test(m.text())) errors.push(`${m.type()}: ${m.text().slice(0, 160)}`)
      })
      await page.goto(`http://127.0.0.1:${port}/?q=${q}`, { waitUntil: 'load' })
      await page.waitForTimeout(9000)
      const hero = join(outBase, `${v}-${q}-hero.png`)
      await page.screenshot({ path: hero })
      await page.evaluate(() => window.__lenis?.scrollTo(document.documentElement.scrollHeight, { immediate: true, force: true }))
      await page.waitForTimeout(5000)
      const footer = join(outBase, `${v}-${q}-footer.png`)
      await page.screenshot({ path: footer })
      report[`${v}-${q}`] = { errors: [...new Set(errors)], hero: md5(hero), footer: md5(footer) }
      await ctx.close()
    }
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
    await page.goto(`http://127.0.0.1:${port}/members?q=medium`, { waitUntil: 'load' })
    await page.waitForTimeout(6000)
    report[`${v}-members`] = { errors }
    await ctx.close()
  }
} finally {
  await browser.close()
  procs.forEach((p) => p.kill())
}
const identical = ['low', 'medium', 'high'].every(
  (q) => report[`${a}-${q}`].hero === report[`${b}-${q}`].hero && report[`${a}-${q}`].footer === report[`${b}-${q}`].footer,
)
writeFileSync(join(here, `check-${b}.json`), JSON.stringify({ identical, report }, null, 1))
console.log(JSON.stringify({ identical, report }, null, 1))
