import Lenis from 'lenis'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onScroll, scrollState, setScroll, type ScrollState } from './scroll'
import { addTick } from './ticker'

const LenisContext = createContext<Lenis | null>(null)

declare global {
  interface Window {
    __lenis?: Lenis
  }
}

/** Fixed header height (mirrors `--header-height` in global.css): anchors land just below it. */
export const ANCHOR_OFFSET = -72

/* ------------------------------------------------------------------ anchors */

/**
 * Resolve a click to an in-page hash we should smooth-scroll to, or `null` to leave the
 * browser alone (modified clicks, new-tab links, downloads, other pages, already handled).
 * `'#'` (the wordmark's empty hash, which Lenis' own `anchors` handler ignores) means "top".
 */
function anchorHashFromClick(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null

  const link = event.composedPath().find((n): n is HTMLAnchorElement => n instanceof HTMLAnchorElement)
  if (!link) return null
  if (link.target && link.target !== '_self') return null
  if (link.hasAttribute('download')) return null

  const raw = link.getAttribute('href') ?? ''
  let url: URL
  try {
    url = new URL(link.href, window.location.href)
  } catch {
    return null
  }
  if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) return null
  if (url.search !== window.location.search) return null

  if (url.hash) return decodeURIComponent(url.hash)
  return raw.endsWith('#') ? '#' : null
}

function resolveAnchor(hash: string): { el: HTMLElement | null; top: boolean } | null {
  if (hash === '#' || hash === '#top') return { el: null, top: true }
  const el = document.getElementById(hash.slice(1))
  return el ? { el, top: false } : null
}

/** Move keyboard/AT focus to the anchor target like native fragment navigation would.
 *  Non-focusable targets (sections) get a transient tabindex; the focus ring is suppressed
 *  for that transient focus only (skip-link pattern — native fragment jumps draw none). */
function focusAnchor(el: HTMLElement) {
  el.focus({ preventScroll: true })
  if (document.activeElement === el) return
  const prevOutline = el.style.outline
  el.setAttribute('tabindex', '-1')
  el.style.outline = 'none'
  el.addEventListener(
    'blur',
    () => {
      el.removeAttribute('tabindex')
      el.style.outline = prevOutline
    },
    { once: true },
  )
  el.focus({ preventScroll: true })
}

/**
 * Smooth-scroll to an in-page hash (`'#features'`, `'#'`/`'#top'`) with the header offset,
 * update the URL and hand focus to the target. Returns `false` when the target does not exist
 * so the caller can fall back to native behaviour. Instant under `prefers-reduced-motion`
 * (Lenis `respectReducedMotion`).
 */
export function scrollToAnchor(lenis: Lenis, hash: string, opts: { push?: boolean } = {}) {
  const resolved = resolveAnchor(hash)
  if (!resolved) return false
  const { el, top } = resolved

  if (opts.push) {
    const next = top ? window.location.pathname + window.location.search : hash
    const current = window.location.pathname + window.location.search + window.location.hash
    if (next !== current) history.pushState(null, '', next)
  }

  lenis.scrollTo(top ? 0 : el!, {
    offset: top ? 0 : ANCHOR_OFFSET,
    onComplete: () => {
      // A CTA may open a dialog (e.g. the Q assistant) while the glide runs; never pull
      // focus out from under an open modal.
      if (el && !document.activeElement?.closest('[role="dialog"], dialog')) focusAnchor(el)
    },
  })
  return true
}

/* ------------------------------------------------------------------ provider */

/** Lenis smooth scroll (reference html.lenis). Lower scroll sensitivity per JOURNEY-SPEC
 *  v2.1 §5: `wheelMultiplier 0.65` (one wheel tick moves ~⅔ of the native distance so a
 *  small flick no longer flies past a section), `touchMultiplier 1.3` (touch still feels
 *  direct — fingers expect ≥ 1:1), `lerp 0.09` (a touch more glide to match). Keyboard and
 *  anchor scrolling are untouched. Honours prefers-reduced-motion (`respectReducedMotion`:
 *  lerp → 1, programmatic scrolls instant). In-page anchors are intercepted here so every
 *  hash link — header nav, mega-menu, CTAs, footer, the `#` wordmark — glides with Lenis
 *  (driving the scroll-linked scenes) and lands below the fixed 72px header instead of
 *  jumping natively.
 *
 *  Lenis is stepped from the shared page ticker (priority -1) so `scrollState` is fresh
 *  before any DOM animation registered on the same ticker reads it, and the page runs one
 *  rAF loop instead of one per section. */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null)

  useEffect(() => {
    const instance = new Lenis({
      lerp: 0.09,
      wheelMultiplier: 0.65,
      touchMultiplier: 1.3,
      autoRaf: false,
      respectReducedMotion: true,
    })
    window.__lenis = instance

    const offTick = addTick((t) => instance.raf(t), -1)

    instance.on('scroll', (e: Lenis) => {
      setScroll({
        y: e.scroll,
        progress: e.limit > 0 ? e.scroll / e.limit : 0,
        velocity: e.velocity,
        limit: e.limit,
        direction: (e.direction as 1 | -1 | 0) ?? 0,
      })
    })

    /* --- document height: `limit` is only refreshed by Lenis on scroll, but the page grows
       without one (web fonts swap, lazy sections mount, the viewport resizes). Observe the
       body so every consumer of scrollState.limit / progress (the journey backdrop, the
       triptych) sees the new range immediately. --- */
    const syncLimit = () => {
      instance.resize()
      const limit = Math.max(1, instance.limit || document.documentElement.scrollHeight - window.innerHeight)
      setScroll({ limit, progress: Math.min(1, Math.max(0, scrollState.y / limit)) })
    }
    // Seed initial state (e.g. reload mid-page)
    setScroll({ y: window.scrollY, limit: Math.max(1, document.documentElement.scrollHeight - window.innerHeight) })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncLimit) : null
    ro?.observe(document.body)
    window.addEventListener('resize', syncLimit, { passive: true })

    /* --- in-page anchors: Lenis' own `anchors` option neither prevents the native jump
       (one-frame flash at the target before the glide) nor handles an empty `#` hash, so
       intercept ourselves. Bubble phase on document: React handlers on the same click run
       first (a mobile-menu link closes the menu, whose effect calls lenis.start() — and
       start() resets any in-flight animation), and any component may opt out with
       preventDefault(). The scroll itself is deferred one frame for the same reason. --- */
    let pendingScroll = 0
    const onClick = (event: MouseEvent) => {
      const hash = anchorHashFromClick(event)
      if (hash === null || !resolveAnchor(hash)) return
      event.preventDefault()
      cancelAnimationFrame(pendingScroll)
      pendingScroll = requestAnimationFrame(() => scrollToAnchor(instance, hash, { push: true }))
    }
    document.addEventListener('click', onClick)

    /* --- deep link on load (`/#features`): the sections mount after the browser's own
       fragment-scroll attempt, so on a fresh navigation nothing scrolls unless we do it —
       land the target below the header ourselves (instant: it is the initial position, not
       a glide). A reload / back-forward restores the previous scroll position instead; there
       we only correct a native jump that evidently happened (target flush with the viewport
       top, under the header). The browser retries its fragment scroll once the document has
       finished loading — by then the section exists, so it re-lands it at the viewport top —
       hence we run again on `load` (and a frame later) and re-correct whenever the target is
       found under the header. If the target is not in the DOM yet (lazy sections), the
       fonts-ready / load attempts also cover the first placement. --- */
    const isFreshNavigation = (() => {
      const entry = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined
      return (entry?.type ?? 'navigate') === 'navigate'
    })()
    const deepLinkTarget = (): HTMLElement | null => {
      const hash = window.location.hash
      if (!hash || hash === '#') return null
      try {
        return document.getElementById(decodeURIComponent(hash.slice(1)))
      } catch {
        return null
      }
    }
    let placed = false
    const deepLink = () => {
      const el = deepLinkTarget()
      if (!el) return
      const underHeader = Math.abs(el.getBoundingClientRect().top) < 2
      if ((isFreshNavigation && !placed) || underHeader) {
        instance.scrollTo(el, { offset: ANCHOR_OFFSET, immediate: true, force: true })
        placed = true
      }
    }
    const onLoadHash = requestAnimationFrame(deepLink)
    let afterLoad = 0
    let disposed = false
    document.fonts?.ready.then(() => {
      if (!disposed) deepLink()
    })
    const onLoad = () => {
      deepLink()
      afterLoad = requestAnimationFrame(deepLink)
    }
    if (document.readyState !== 'complete') window.addEventListener('load', onLoad, { once: true })

    setLenis(instance)
    return () => {
      disposed = true
      offTick()
      ro?.disconnect()
      window.removeEventListener('resize', syncLimit)
      window.removeEventListener('load', onLoad)
      cancelAnimationFrame(pendingScroll)
      cancelAnimationFrame(onLoadHash)
      cancelAnimationFrame(afterLoad)
      document.removeEventListener('click', onClick)
      instance.destroy()
      delete window.__lenis
    }
  }, [])

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>
}

export function useLenis() {
  return useContext(LenisContext)
}

/** Subscribe to scroll updates without re-rendering. `cb` should be stable (useCallback). */
export function useScrollListener(cb: (s: ScrollState) => void) {
  useEffect(() => onScroll(cb), [cb])
}
