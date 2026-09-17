/**
 * Task scheduling helpers for the load sequence (audit-loading L3/L4).
 * `postTask` uses the Prioritized Task Scheduling API where it exists (Chromium) so below-the-fold
 * section batches (`background`) never delay the sky's user-visible work; elsewhere it degrades
 * to a macrotask.
 */
export type TaskPriority = 'user-blocking' | 'user-visible' | 'background'

interface SchedulerLike {
  postTask?: (cb: () => void, opts?: { priority?: TaskPriority; signal?: AbortSignal }) => Promise<unknown>
}

export function postTask(cb: () => void, priority: TaskPriority): () => void {
  const s = (globalThis as { scheduler?: SchedulerLike }).scheduler
  if (s?.postTask) {
    const ctrl = new AbortController()
    s.postTask(cb, { priority, signal: ctrl.signal }).catch(() => {})
    return () => ctrl.abort()
  }
  const id = window.setTimeout(cb, priority === 'background' ? 16 : 0)
  return () => window.clearTimeout(id)
}

/**
 * Runs `cb` in a new task after the next frame has been presented. A hidden or occluded window gets
 * no animation frames, so a timer (`maxWaitMs`) fires it anyway.
 */
export function afterNextPaint(cb: () => void, priority: TaskPriority = 'user-visible', maxWaitMs = 300): () => void {
  let fired = false
  let cancel = () => {}
  const fire = () => {
    if (fired) return
    fired = true
    cancelAnimationFrame(raf)
    window.clearTimeout(timer)
    cancel = postTask(cb, priority)
  }
  const raf = requestAnimationFrame(fire)
  const timer = window.setTimeout(fire, maxWaitMs)
  return () => {
    fired = true
    cancelAnimationFrame(raf)
    window.clearTimeout(timer)
    cancel()
  }
}

/** First sign the reader wants to move (scroll / touch / key). */
export function onFirstIntent(cb: () => void): () => void {
  const events = ['wheel', 'touchstart', 'keydown', 'pointerdown', 'scroll'] as const
  let done = false
  const fire = () => {
    if (done) return
    done = true
    off()
    cb()
  }
  const off = () => events.forEach((e) => window.removeEventListener(e, fire, true))
  events.forEach((e) => window.addEventListener(e, fire, { capture: true, passive: true }))
  return off
}

/**
 * After the first contentful paint (text painted with its web font or the fallback), then one more
 * frame. Requests started before that paint count as LCP dependencies (Lighthouse) and compete with
 * the critical path on a slow link; `timeoutMs` covers browsers without paint timing.
 */
export function afterFirstContentfulPaint(cb: () => void, priority: TaskPriority = 'user-visible', timeoutMs = 3000): () => void {
  let done = false
  let cancel = () => {}
  let observer: PerformanceObserver | null = null
  const go = () => {
    if (done) return
    done = true
    observer?.disconnect()
    window.clearTimeout(timer)
    cancel = afterNextPaint(cb, priority)
  }
  const timer = window.setTimeout(go, timeoutMs)
  try {
    if (performance.getEntriesByName('first-contentful-paint').length > 0) go()
    else {
      observer = new PerformanceObserver((list) => {
        if (list.getEntriesByName('first-contentful-paint').length > 0) go()
      })
      observer.observe({ type: 'paint', buffered: true })
    }
  } catch {
    go()
  }
  return () => {
    done = true
    observer?.disconnect()
    window.clearTimeout(timer)
    cancel()
  }
}
