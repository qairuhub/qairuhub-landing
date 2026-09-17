/**
 * One guarded reload when a lazy chunk can't be loaded (audit A2-01).
 *
 * The usual cause late in a visit is a deploy that removed the tab's chunk (hashed file names), and
 * a reload fetches the new build. Early failures are left alone: in the first 30 s they are
 * network failures (the KZ ISP drops TLS intermittently), a reload would fetch the same flaky
 * chunk again, and the island's `ChunkBoundary` fallback already keeps the page usable.
 *
 * At most one reload per 5 minutes per tab (`sessionStorage['qh.chunkReload']`), so a chunk that
 * is missing for good can't cause a reload loop. Without working storage there is no guard, so
 * there is no reload either.
 *
 * Callers: `ChunkBoundary onError` for the sub-page boundary (src/App.tsx) and for the assistant
 * panel (src/assistant/AssistantLauncher.tsx). There is deliberately NO `vite:preloadError`
 * listener: that event also fires for the chunks this app warms up in the background (the sky, the
 * home islands, the assistant on hover), so registering it would let a stale tab reload itself out
 * from under a reader who only moved the mouse. A failed island keeps its own fallback instead.
 */

const STORAGE_KEY = 'qh.chunkReload'
const STARTUP_MS = 30_000
const MIN_GAP_MS = 5 * 60_000

export function reloadOnceForChunkError(): void {
  if (typeof window === 'undefined') return
  if (typeof performance !== 'undefined' && performance.now() < STARTUP_MS) return
  const now = Date.now()
  try {
    const last = Number(window.sessionStorage.getItem(STORAGE_KEY))
    if (last > 0 && Math.abs(now - last) < MIN_GAP_MS) return
  } catch {
    return
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(now))
  } catch {
    return
  }
  window.location.reload()
}
