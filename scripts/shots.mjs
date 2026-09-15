#!/usr/bin/env node
/**
 * v3 screenshots + layout QA (V3-BUILD-PLAN §WP12, owned by WP12).
 *
 *   node scripts/shots.mjs [baseUrl] [outDir]
 *   node scripts/shots.mjs http://localhost:4173 shots/v3          (defaults)
 *   node scripts/shots.mjs https://qairuhub-landing.pages.dev shots/v3-prod
 *
 * Env: SHOTS_ONLY=desktop|mobile · SHOTS_LOCALE=en|kk · SHOTS_PAGES=home,members,handbook,notFound
 *      SHOTS_MAX=40 (max frames per page) · SHOTS_Q=high|medium|low (forces the sky tier via ?q=)
 *
 * Matrix: EN + KK × desktop 1440×900 + mobile 390×844 (touch, isMobile) for
 *   - home (/ and /kk/): a frame every 900 px (every 844 px on mobile, so nothing falls between frames)
 *   - /members, /handbook, /kk/members, /kk/handbook: the same stepping, capped at SHOTS_MAX frames
 *   - /nope (404, expected status 404): one frame per viewport
 * Home frames are also taken at the top of every section id (`#launchpad` … `#footer`), named by id.
 *
 * Checks, printed as JSON (and written to <outDir>/report.json):
 *   - HTTP status per route (404 expected only for /nope)
 *   - console errors + page errors per route (Turnstile / api noise is NOT filtered: fix or explain it)
 *   - horizontal overflow at every frame (documentElement.scrollWidth > innerWidth), with the
 *     first few offending elements (tag#id.class and their right edge)
 *   - <html lang> per route
 * Exit code 2 if any route has console errors, overflow, a wrong status or a wrong lang.
 *
 * Needs a server: `pnpm build && pnpm preview` (static, 404.html is not served by vite preview:
 * the /nope status check is only meaningful against `pnpm dev:api` or the deployed site).
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const base = (process.argv[2] || process.env.SHOTS_URL || 'http://localhost:4173').replace(/\/+$/, '')
const out = process.argv[3] || process.env.SHOTS_DIR || 'shots/v3'
const only = process.env.SHOTS_ONLY
const onlyLocale = process.env.SHOTS_LOCALE
const onlyPages = process.env.SHOTS_PAGES ? new Set(process.env.SHOTS_PAGES.split(',')) : null
const maxFrames = Number(process.env.SHOTS_MAX || 40)
const forcedTier = process.env.SHOTS_Q
mkdirSync(out, { recursive: true })

const SECTION_IDS = ['top', 'launchpad', 'ecosystem', 'accelerator', 'supersize', 'platform', 'offer', 'projects', 'news', 'cta', 'tools', 'story', 'join', 'footer']

const VIEWPORTS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, step: 900, opts: {} },
  { name: 'mobile', viewport: { width: 390, height: 844 }, step: 844, opts: { isMobile: true, hasTouch: true } },
].filter((v) => !only || v.name === only)

const ROUTES = [
  { page: 'home', locale: 'en', path: '/', status: 200 },
  { page: 'home', locale: 'kk', path: '/kk/', status: 200 },
  { page: 'members', locale: 'en', path: '/members', status: 200 },
  { page: 'members', locale: 'kk', path: '/kk/members', status: 200 },
  { page: 'handbook', locale: 'en', path: '/handbook', status: 200 },
  { page: 'handbook', locale: 'kk', path: '/kk/handbook', status: 200 },
  { page: 'notFound', locale: 'en', path: '/nope', status: 404 },
].filter((r) => (!onlyLocale || r.locale === onlyLocale) && (!onlyPages || onlyPages.has(r.page)))

const slug = (p) => (p === '/' ? 'home' : p.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'home')

const browser = await chromium.launch()
const report = { base, out, routes: [] }

async function scrollTo(page, y) {
  await page.evaluate((v) => {
    if (window.__lenis) window.__lenis.scrollTo(v, { immediate: true, force: true })
    window.scrollTo(0, v)
  }, y)
}

async function overflowAt(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth
    const doc = document.documentElement.scrollWidth
    if (doc <= vw) return null
    const offenders = []
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.right <= vw + 1) continue
      // report the outermost offender only
      if (offenders.some((o) => o.el.contains(el))) continue
      offenders.push({ el, right: Math.round(r.right) })
      if (offenders.length >= 5) break
    }
    return {
      scrollWidth: doc,
      viewport: vw,
      offenders: offenders.map(({ el, right }) => {
        const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''
        return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls} right=${right}`
      }),
    }
  })
}

async function shoot(route, vp) {
  const name = `${slug(route.path)}-${vp.name}`
  const context = await browser.newContext({ viewport: vp.viewport, deviceScaleFactor: 1, ...vp.opts })
  const page = await context.newPage()
  const entry = { route: route.path, viewport: vp.name, status: null, lang: null, frames: 0, consoleErrors: [], overflow: [], problems: [] }
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    // The expected 404 document status on the notFound route is not a page error.
    const loc = m.location()?.url || ''
    if (route.status === 404 && /status of 404/.test(m.text()) && loc.replace(/\/+$/, '') === (base + route.path).replace(/\/+$/, '')) return
    entry.consoleErrors.push(m.text().slice(0, 300))
  })
  page.on('pageerror', (e) => entry.consoleErrors.push(`pageerror: ${e.message.slice(0, 300)}`))

  const url = base + route.path + (forcedTier ? `?q=${forcedTier}` : '')
  const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => {
    entry.problems.push(`navigation failed: ${e.message.split('\n')[0]}`)
    return null
  })
  if (!res) {
    await context.close()
    return entry
  }
  entry.status = res.status()
  if (entry.status !== route.status) entry.problems.push(`status ${entry.status}, expected ${route.status}`)
  await page.waitForTimeout(route.page === 'home' ? 3000 : 1800)
  entry.lang = await page.evaluate(() => document.documentElement.lang)
  if (entry.lang !== route.locale) entry.problems.push(`lang "${entry.lang}", expected "${route.locale}"`)

  const frame = async (label, y) => {
    await scrollTo(page, y)
    await page.waitForTimeout(route.page === 'home' ? 1400 : 700)
    await page.screenshot({ path: join(out, `${name}-${label}.png`) })
    entry.frames++
    const o = await overflowAt(page)
    if (o) entry.overflow.push({ at: label, ...o })
  }

  if (route.page === 'notFound') {
    await frame('00-y0', 0)
  } else {
    const total = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
    let i = 0
    for (let y = 0; y <= total && i < maxFrames; y += vp.step, i++) await frame(`${String(i).padStart(2, '0')}-y${y}`, y)
    if (total % vp.step !== 0 && i < maxFrames) await frame(`${String(i).padStart(2, '0')}-end`, total)
    if (route.page === 'home') {
      const offsets = await page.evaluate(
        (ids) => ids.map((id) => {
          const el = document.getElementById(id)
          return el ? { id, y: Math.round(el.getBoundingClientRect().top + window.scrollY) } : { id, y: null }
        }),
        SECTION_IDS,
      )
      for (const { id, y } of offsets) {
        if (y === null) {
          entry.problems.push(`missing section #${id}`)
          continue
        }
        await frame(`section-${id}`, Math.max(0, Math.min(total, y - 72)))
      }
    }
  }

  if (entry.consoleErrors.length) entry.problems.push(`${entry.consoleErrors.length} console error(s)`)
  if (entry.overflow.length) entry.problems.push(`horizontal overflow at ${entry.overflow.length} frame(s)`)
  await context.close()
  return entry
}

for (const vp of VIEWPORTS) {
  for (const route of ROUTES) {
    const entry = await shoot(route, vp)
    report.routes.push(entry)
    console.error(`${entry.problems.length ? 'FAIL' : 'ok  '} ${vp.name.padEnd(7)} ${route.path.padEnd(14)} ${entry.frames} frames${entry.problems.length ? '  ' + entry.problems.join('; ') : ''}`)
  }
}
await browser.close()

report.failed = report.routes.filter((r) => r.problems.length).length
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (report.failed) process.exitCode = 2
