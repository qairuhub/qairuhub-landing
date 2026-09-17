import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App'
import { LOCALE_STORAGE_KEY, parseRoute, type Locale } from './i18n/locale'
import { RouteProvider } from './i18n/LocaleProvider'
import meta from './i18n/meta.json'
import { installDomGuard } from './lib/domGuard'

function storedLocale(): Locale | null {
  try {
    const value = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    return value === 'en' || value === 'kk' ? value : null
  } catch {
    return null
  }
}

function hasSameOriginReferrer(): boolean {
  try {
    return document.referrer !== '' && new URL(document.referrer).origin === window.location.origin
  } catch {
    return false
  }
}

/**
 * Stored-preference rule (plan D1): only a bare `/` entry, with `kk` stored by the switcher and no
 * same-origin referrer (so clicking "EN" or an internal link never bounces back), goes to `/kk/`.
 * Never redirects away from `/kk/`, never looks at navigator.language.
 */
function shouldRedirectToKk(): boolean {
  return window.location.pathname === '/' && storedLocale() === 'kk' && !hasSameOriginReferrer()
}

if (shouldRedirectToKk()) {
  window.location.replace(`/kk/${window.location.search}${window.location.hash}`)
} else {
  const route = parseRoute(window.location.pathname)
  document.documentElement.lang = route.locale
  // 404.html is served for every unknown path, so its head is EN; give /kk/* misses the KK title.
  if (route.page === 'notFound') document.title = meta.pages.notFound[route.locale].title

  // Browser translators (Chrome → Russian on a Mac) move text nodes React still owns.
  installDomGuard()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouteProvider route={route}>
        <App />
      </RouteProvider>
    </StrictMode>,
  )
}
