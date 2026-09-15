/**
 * Locale + route contract (V3-BUILD-PLAN D1/D2, owned by WP0).
 *
 * - English lives at `/`, Kazakh at `/kk/`. The locale root always keeps its trailing slash.
 * - The route is resolved ONCE per document load (main.tsx). Switching locale or page is a
 *   plain `<a href>` full navigation, so WebGL / Lenis / the journey stay one-document-per-load.
 * - Pure module: no React, no DOM access, so node scripts (scripts/test-routes.mjs) can import it.
 */

export type Locale = 'en' | 'kk'
export type Page = 'home' | 'members' | 'handbook' | 'notFound'
export type LocaleBase = '/' | '/kk/'

export interface Route {
  locale: Locale
  page: Page
  base: LocaleBase
}

/** A per-section dictionary: `satisfies Dict<SectionText>` makes TS enforce KK completeness. */
export type Dict<T> = { en: T; kk: T }

export type HrefTarget = '/' | 'members' | 'handbook' | `#${string}` | `handbook#${string}`

export const LOCALES: readonly Locale[] = ['en', 'kk']

/** localStorage key written by the locale switcher (always inside try/catch). */
export const LOCALE_STORAGE_KEY = 'qh.locale'

export function localeBase(locale: Locale): LocaleBase {
  return locale === 'kk' ? '/kk/' : '/'
}

/**
 * `pathname` → `{ locale, page, base }`.
 *
 * `/` home·en, `/kk` + `/kk/` home·kk, `/members` + `/members/` members·en, `/kk/members`
 * members·kk, `/handbook` handbook·en, `/kk/handbook` handbook·kk, anything else notFound with
 * the locale taken from the prefix. `.html` / `index.html` spellings (what Pages serves) map to
 * the same page.
 */
export function parseRoute(pathname: string): Route {
  let path = pathname || '/'
  try {
    path = decodeURI(path)
  } catch {
    /* malformed escape: keep the raw path, it will fall through to notFound */
  }
  path = path.replace(/\/{2,}/g, '/')
  if (!path.startsWith('/')) path = `/${path}`

  let locale: Locale = 'en'
  if (path === '/kk' || path.startsWith('/kk/')) {
    locale = 'kk'
    path = path.slice(3) || '/'
  }

  path = path.replace(/\/index\.html$/, '/').replace(/\.html$/, '')
  const slug = path.replace(/^\/+|\/+$/g, '')

  let page: Page
  if (slug === '') page = 'home'
  else if (slug === 'members') page = 'members'
  else if (slug === 'handbook') page = 'handbook'
  else page = 'notFound'

  return { locale, page, base: localeBase(locale) }
}

/** The canonical path of a page in a locale. notFound has no path of its own → locale home. */
export function pagePath(page: Page, locale: Locale): string {
  const base = localeBase(locale)
  if (page === 'members') return `${base}members`
  if (page === 'handbook') return `${base}handbook`
  return base
}

/**
 * A locale-aware link from the current route:
 *   href(r, '/')            → '/'            | '/kk/'
 *   href(r, '#offer')       → '/#offer'      | '/kk/#offer'
 *   href(r, 'members')      → '/members'     | '/kk/members'
 *   href(r, 'handbook#faq') → '/handbook#faq' | '/kk/handbook#faq'
 * Never produces `/kk#x` (pathname `/kk` ≠ `/kk/` would force a reload).
 */
export function href(route: Pick<Route, 'locale'>, to: HrefTarget): string {
  const base = localeBase(route.locale)
  if (to === '/') return base
  if (to.startsWith('#')) return `${base}${to}`
  if (to === 'members') return `${base}members`
  if (to === 'handbook') return `${base}handbook`
  // `handbook#anchor`
  return `${base}${to}`
}

/**
 * The same page in another locale, keeping the hash: `/members#x` ↔ `/kk/members#x`.
 * notFound switches to the other locale's home. `hash` may be given with or without `#`.
 */
export function switchLocaleHref(route: Route, to: Locale, hash?: string): string {
  const path = pagePath(route.page, to)
  if (!hash || hash === '#') return path
  return `${path}${hash.startsWith('#') ? hash : `#${hash}`}`
}

/** Tiny `{name}` interpolation for dictionary strings such as "{title}, row {n}". */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? String(vars[key]) : m))
}

/** Plain-text version of an accented headline ("*word*" → "word") for aria-labels and titles. */
export function stripAccent(text: string): string {
  return text.replace(/\*([^*]+)\*/g, '$1')
}
