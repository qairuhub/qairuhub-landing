import { createContext, useContext, type ReactNode } from 'react'
import { parseRoute, type Dict, type Locale, type Route } from './locale'

/**
 * Route context (V3-BUILD-PLAN D2, owned by WP0). main.tsx resolves the route once and wraps the
 * app in <RouteProvider>; Header, Footer, SkyScene, pages and the assistant read `useRoute()`
 * themselves, so no component signature changes across work packages.
 *
 * The default value is EN home, so a component rendered outside the provider (a harness, a test)
 * still gets a valid route instead of throwing.
 */
const RouteContext = createContext<Route>(parseRoute('/'))

export function RouteProvider({ route, children }: { route: Route; children: ReactNode }) {
  return <RouteContext.Provider value={route}>{children}</RouteContext.Provider>
}

export function useRoute(): Route {
  return useContext(RouteContext)
}

export function useLocale(): Locale {
  return useContext(RouteContext).locale
}

/** `const t = useT(text)` → the section dictionary for the page locale. */
export function useT<T>(dict: Dict<T>): T {
  return dict[useContext(RouteContext).locale]
}
