#!/usr/bin/env node
/**
 * Post-build HTML generator (V3-BUILD-PLAN D2, owned by WP0). Runs after `vite build`.
 *
 * Rewrites the Vite template `dist/index.html` into one real HTML file per route, so Cloudflare
 * Pages serves the right head with a 200 (and a real 404 status for unknown paths):
 *
 *   dist/index.html         /             home · en
 *   dist/kk/index.html      /kk/          home · kk
 *   dist/members.html       /members      members · en
 *   dist/kk/members.html    /kk/members   members · kk
 *   dist/handbook.html      /handbook     handbook · en
 *   dist/kk/handbook.html   /kk/handbook  handbook · kk
 *   dist/404.html           any other miss   notFound · en
 *   dist/kk/404.html        misses under /kk/ notFound · kk (Pages picks the nearest 404.html)
 *
 * Each file gets: <html lang>, <title>, meta description, canonical, hreflang en/kk/x-default,
 * og:* (og:locale en_US / kk_KZ) and per-route font preloads.
 *
 * Inputs: src/i18n/meta.json (titles/descriptions), src/styles/fonts.preload.json (WP11; optional,
 * falls back to the v2 TTF set), env SITE_ORIGIN (default https://qairuhub-landing.pages.dev).
 * Idempotent: running it twice on the same dist gives the same output.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const SITE_ORIGIN = (process.env.SITE_ORIGIN || 'https://qairuhub-landing.pages.dev').replace(/\/+$/, '')

const HEAD_START = '<!--qh:head:start-->'
const HEAD_END = '<!--qh:head:end-->'

function fail(message) {
  console.error(`build-html: ${message}`)
  process.exit(1)
}

const templatePath = resolve(dist, 'index.html')
if (!existsSync(templatePath)) fail('dist/index.html not found; run `vite build` first.')
const template = readFileSync(templatePath, 'utf8')

const meta = JSON.parse(readFileSync(resolve(root, 'src/i18n/meta.json'), 'utf8'))

/* ------------------------------------------------------------------ font preloads */
const FALLBACK_PRELOADS = {
  common: ['/fonts/Inter-Variable.ttf', '/fonts/Anton-Regular.ttf', '/fonts/Caveat-Variable.ttf'],
  home: ['/fonts/Courgette-Regular.ttf'],
  kk: [],
}

function loadPreloads() {
  const file = resolve(root, 'src/styles/fonts.preload.json')
  if (!existsSync(file)) {
    console.warn('build-html: src/styles/fonts.preload.json missing, using the v2 TTF preload set.')
    return FALLBACK_PRELOADS
  }
  const json = JSON.parse(readFileSync(file, 'utf8'))
  return { common: json.common ?? [], home: json.home ?? [], kk: json.kk ?? [] }
}

const preloads = loadPreloads()
const missingFonts = new Set()

/** Fonts parsed by the 3D wordmark (src/lib/ttf.ts, via fetch), never by an @font-face. */
const GLYF_FONTS = /\/(Courgette-Regular|DancingScript-Variable)\.ttf$/

function fontType(href) {
  if (href.endsWith('.woff2')) return 'font/woff2'
  if (href.endsWith('.woff')) return 'font/woff'
  if (href.endsWith('.otf')) return 'font/otf'
  return 'font/ttf'
}

function preloadsFor(page, locale) {
  const list = [...preloads.common]
  if (page === 'home') list.push(...preloads.home)
  if (locale === 'kk') list.push(...preloads.kk)
  return [...new Set(list)].filter((href) => {
    const onDisk = existsSync(resolve(dist, href.replace(/^\/+/, '')))
    if (!onDisk) missingFonts.add(href)
    return onDisk
  })
}

/* ------------------------------------------------------------------ head */
const esc = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const ROUTES = [
  { page: 'home', locale: 'en', out: 'index.html' },
  { page: 'home', locale: 'kk', out: 'kk/index.html' },
  { page: 'members', locale: 'en', out: 'members.html' },
  { page: 'members', locale: 'kk', out: 'kk/members.html' },
  { page: 'handbook', locale: 'en', out: 'handbook.html' },
  { page: 'handbook', locale: 'kk', out: 'kk/handbook.html' },
  { page: 'notFound', locale: 'en', out: '404.html' },
  // Pages serves the nearest 404.html walking up from the missing path, so /kk/* misses get a KK head.
  { page: 'notFound', locale: 'kk', out: 'kk/404.html' },
]

function headBlock({ page, locale }) {
  const entry = meta.pages[page]?.[locale]
  if (!entry) fail(`meta.json has no entry for ${page}.${locale}`)
  const other = locale === 'en' ? 'kk' : 'en'
  const lines = []

  if (entry.path) {
    const url = (loc) => `${SITE_ORIGIN}${meta.pages[page][loc].path}`
    lines.push(`<link rel="canonical" href="${esc(url(locale))}" />`)
    lines.push(`<link rel="alternate" hreflang="en" href="${esc(url('en'))}" />`)
    lines.push(`<link rel="alternate" hreflang="kk" href="${esc(url('kk'))}" />`)
    lines.push(`<link rel="alternate" hreflang="x-default" href="${esc(url('en'))}" />`)
    lines.push(`<meta property="og:url" content="${esc(url(locale))}" />`)
  } else {
    // The 404 document is served for every unknown URL: no canonical, never indexed.
    lines.push('<meta name="robots" content="noindex" />')
  }

  lines.push(`<meta property="og:type" content="website" />`)
  lines.push(`<meta property="og:site_name" content="${esc(meta.siteName)}" />`)
  lines.push(`<meta property="og:title" content="${esc(entry.title)}" />`)
  lines.push(`<meta property="og:description" content="${esc(entry.description)}" />`)
  lines.push(`<meta property="og:locale" content="${esc(meta.ogLocale[locale])}" />`)
  lines.push(`<meta property="og:locale:alternate" content="${esc(meta.ogLocale[other])}" />`)
  lines.push(`<meta name="twitter:card" content="summary" />`)

  for (const href of preloadsFor(page, locale)) {
    // The 3D wordmark reads its TTF with fetch() (src/lib/ttf.ts), not through @font-face: a
    // font-typed preload would never be consumed (unused-preload warning + a second request).
    lines.push(
      GLYF_FONTS.test(href)
        ? `<link rel="preload" href="${esc(href)}" as="fetch" crossorigin />`
        : `<link rel="preload" href="${esc(href)}" as="font" type="${fontType(href)}" crossorigin />`,
    )
  }

  return `${HEAD_START}\n    ${lines.join('\n    ')}\n    ${HEAD_END}`
}

function render(route) {
  const entry = meta.pages[route.page][route.locale]
  let html = template

  // <html lang> — keep the other attributes (class="lenis", the #03040c background) as they are.
  if (!/<html\b[^>]*\blang="[^"]*"/.test(html)) fail('template <html> has no lang attribute')
  html = html.replace(/(<html\b[^>]*\blang=")[^"]*(")/, `$1${route.locale}$2`)

  if (!/<title>[\s\S]*?<\/title>/.test(html)) fail('template has no <title>')
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(entry.title)}</title>`)

  const descRe = /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/
  if (!descRe.test(html)) fail('template has no meta description')
  html = html.replace(descRe, `<meta name="description" content="${esc(entry.description)}" />`)

  const block = headBlock(route)
  const generatedRe = new RegExp(`${HEAD_START}[\\s\\S]*?${HEAD_END}`)
  const markerRe = /<!--qh:head[\s\S]*?-->/
  if (generatedRe.test(html)) html = html.replace(generatedRe, block)
  else if (markerRe.test(html)) html = html.replace(markerRe, block)
  else html = html.replace(/(<meta\s+name="viewport"[^>]*>)/, `$1\n    ${block}`)

  return html
}

/* Render everything from the pristine template first, then write (dist/index.html is both). */
const outputs = ROUTES.map((route) => ({ route, html: render(route) }))
for (const { route, html } of outputs) {
  const file = resolve(dist, route.out)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html)
  console.log(`build-html: dist/${route.out}  (${route.page} · ${route.locale})`)
}
for (const href of missingFonts) console.warn(`build-html: preload ${href} not found in dist, skipped.`)
