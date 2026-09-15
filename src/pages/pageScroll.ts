/**
 * Sub-page helpers shared by the Members, Handbook and 404 pages (WP10).
 */
import { useEffect } from 'react'
import { ANCHOR_OFFSET, useLenis } from '../lib/SmoothScroll'

/**
 * Deep links into a lazily loaded page (`/handbook#privacy-on-this-site`).
 *
 * SmoothScroll places the hash target on the first frame, on `fonts.ready` and on `load`, but a
 * sub-page is its own lazy chunk: on a cold load the target may not exist yet at any of those
 * moments (a dynamic import does not hold the load event). This hook runs once the page has
 * mounted and lands the target below the fixed header with Lenis (instant: it is the initial
 * position, not a glide). Lenis caches its scroll limit, so it is resized before every jump (else a
 * jump made while the short loading placeholder was mounted is clamped). It keeps re-placing as
 * the page grows (fonts, lazy content, a ResizeObserver on body) for about 3s, and stops as soon
 * as the visitor scrolls on their own. A reload / back-forward keeps the browser's
 * restored position, exactly like SmoothScroll does on home.
 */
export function useDeepLinkLanding() {
  const lenis = useLenis()

  useEffect(() => {
    if (!lenis) return
    const hash = window.location.hash
    if (!hash || hash === '#') return

    let id: string
    try {
      id = decodeURIComponent(hash.slice(1))
    } catch {
      return
    }

    const entry = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined
    const fresh = (entry?.type ?? 'navigate') === 'navigate'

    let userScrolled = false
    let disposed = false
    const stop = () => {
      userScrolled = true
    }
    const opts: AddEventListenerOptions = { passive: true, once: true }
    window.addEventListener('wheel', stop, opts)
    window.addEventListener('touchstart', stop, opts)
    window.addEventListener('keydown', stop, opts)

    const place = () => {
      if (disposed || userScrolled) return
      const el = document.getElementById(id)
      if (!el) return
      // On a reload / back-forward only correct a native jump that left the target under the header.
      if (!fresh && Math.abs(el.getBoundingClientRect().top) >= 2) return
      // Refresh Lenis' cached limit first: it may still hold the short placeholder's height.
      lenis.resize()
      lenis.scrollTo(el, { offset: ANCHOR_OFFSET, immediate: true, force: true })
    }

    place()
    const raf = requestAnimationFrame(place)
    document.fonts?.ready.then(place)
    // The page keeps growing after mount (lazy sections, images, reflow): follow it for ~3s.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => place())
    ro?.observe(document.body)
    const settle = window.setTimeout(() => ro?.disconnect(), 3000)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.clearTimeout(settle)
      ro?.disconnect()
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('keydown', stop)
    }
  }, [lenis])
}

/** DOM event the floating assistant (WP3) listens for. A handler calls `preventDefault()` to claim it. */
export const ASSISTANT_OPEN_EVENT = 'qh:assistant-open'

/** Accessible name of the floating launcher (`assistant.launcher`, EN + KK). */
const LAUNCHER_LABEL = /\bAsk Q\b|Q[-‑]дан сұра/

/**
 * "Ask Q" from a page button. Order of attempts:
 *   1. a cancelable `qh:assistant-open` event on window: a handler that calls preventDefault claims it;
 *   2. the floating launcher is mounted (`[data-assistant-launcher]`, or the button labelled
 *      `assistant.launcher`): it listens for that event and has already opened its panel
 *      synchronously, so nothing more is done. Clicking the launcher here would toggle the panel
 *      it just opened back to closed;
 *   3. nothing: the caller's link (the home Ask bar) is followed as a normal navigation.
 * Returns `true` when the assistant was opened in place.
 */
export function openAssistant(): boolean {
  const event = new CustomEvent(ASSISTANT_OPEN_EVENT, { cancelable: true })
  if (!window.dispatchEvent(event)) return true

  const launcher =
    document.querySelector<HTMLElement>('[data-assistant-launcher]') ??
    Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label]')).find((b) =>
      LAUNCHER_LABEL.test(b.getAttribute('aria-label') ?? ''),
    )
  return launcher !== undefined && launcher !== null
}
