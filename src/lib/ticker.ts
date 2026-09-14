import { useEffect, useRef } from 'react'

/**
 * One shared requestAnimationFrame loop for every scroll-linked DOM animation on the page
 * (Lenis, the Supersize word wipe, the Storytelling triptych …). Multiple private rAF loops
 * each wake the main thread separately; one loop keeps the per-frame overhead to a single
 * callback and lets the browser batch the style writes that follow.
 *
 * The loop only runs while at least one tick is registered and stops itself when the last one
 * is removed, so an idle page costs nothing. `requestAnimationFrame` is already paused by the
 * browser while the tab is hidden; on return `dt` is clamped so nothing jumps.
 *
 *   const off = addTick((t, dt) => { … })   // t: DOMHighResTimeStamp ms, dt: seconds (≤ 0.1)
 *   off()
 *
 * Ticks run in ascending `priority` order — Lenis registers at -1 so `scrollState` is fresh
 * before any DOM animation reads it in the same frame.
 */
export type TickFn = (t: number, dt: number) => void

interface Entry {
  fn: TickFn
  priority: number
}

const entries: Entry[] = []
let raf = 0
let last = 0
let running = false
/** Registrations made during a frame are picked up next frame (never mutate `entries` mid-loop). */
let snapshot: Entry[] = []
let dirty = true

const MAX_DT = 0.1

function frame(t: number) {
  raf = requestAnimationFrame(frame)
  if (dirty) {
    snapshot = entries.slice()
    dirty = false
  }
  const dt = last ? Math.min(MAX_DT, (t - last) / 1000) : 0
  last = t
  for (let i = 0; i < snapshot.length; i++) snapshot[i].fn(t, dt)
}

function start() {
  if (running) return
  running = true
  last = 0
  raf = requestAnimationFrame(frame)
}

function stop() {
  if (!running) return
  running = false
  cancelAnimationFrame(raf)
  raf = 0
}

/** Register a per-frame callback. Returns the unsubscribe function. */
export function addTick(fn: TickFn, priority = 0): () => void {
  const entry: Entry = { fn, priority }
  // Stable insertion sorted by priority (a handful of ticks — linear is fine).
  let i = entries.length
  while (i > 0 && entries[i - 1].priority > priority) i--
  entries.splice(i, 0, entry)
  dirty = true
  start()
  let active = true
  return () => {
    if (!active) return
    active = false
    const idx = entries.indexOf(entry)
    if (idx >= 0) entries.splice(idx, 1)
    dirty = true
    if (entries.length === 0) stop()
  }
}

/**
 * Hook form (Header's wordmark tick): runs `fn` every frame while `enabled`. The latest `fn` is
 * always called (kept in a ref) so callers can pass an inline closure without re-registering
 * every render.
 */
export function useTick(fn: TickFn, enabled = true, priority = 0) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (!enabled) return
    return addTick((t, dt) => ref.current(t, dt), priority)
  }, [enabled, priority])
}
