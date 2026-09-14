/**
 * Tiny scroll store fed by Lenis. Read `scrollState` directly inside rAF/useFrame loops
 * (no React re-render), or subscribe with `onScroll` for imperative updates.
 */
export interface ScrollState {
  /** current scroll position in px */
  y: number
  /** 0..1 over the whole document */
  progress: number
  velocity: number
  /** max scroll (document height - viewport) */
  limit: number
  direction: 1 | -1 | 0
}

export const scrollState: ScrollState = { y: 0, progress: 0, velocity: 0, limit: 1, direction: 0 }

type Listener = (s: ScrollState) => void
const listeners = new Set<Listener>()

export function setScroll(next: Partial<ScrollState>) {
  Object.assign(scrollState, next)
  listeners.forEach((l) => l(scrollState))
}

export function onScroll(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** Progress (0..1) of an element through the viewport: 0 when its top hits the bottom edge,
 *  1 when its bottom leaves the top edge. Safe to call every frame. */
export function elementProgress(el: HTMLElement, viewportH = window.innerHeight) {
  const r = el.getBoundingClientRect()
  const total = r.height + viewportH
  return Math.min(1, Math.max(0, (viewportH - r.top) / total))
}
