import { useEffect, useState } from 'react'

/**
 * Shared environment hooks (matchMedia / document visibility).
 *
 * All initialisers are guarded for non-browser renders (Astro / Next SSR) so importing a section
 * never throws before hydration; the effect re-syncs the real value on mount.
 */

/** Reactive matchMedia — re-renders when the query flips. `false` during SSR. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false))

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** `true` when the OS asks for reduced motion — sections must use static / instant fallbacks. */
export const useReducedMotion = (): boolean => useMediaQuery(REDUCED_MOTION_QUERY)

/** `true` while the tab is visible (`!document.hidden`); use it to pause timers / render loops. `true` during SSR. */
export function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(() => (typeof document !== 'undefined' ? !document.hidden : true))

  useEffect(() => {
    const onChange = () => setVisible(!document.hidden)
    setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  return visible
}
