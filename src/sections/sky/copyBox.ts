/**
 * How tall the last block of copy over the sky is — the home footer's `.footer__content`, in CSS
 * pixels, plus the margin that holds it off the bottom of the frame.
 *
 * ONE number, written by the Footer through a ResizeObserver (not per frame, not React state) and
 * read by SkyDome. It exists so the golden-hour ending can place its hot band relative to the copy
 * it must stay out of, instead of against a hard-coded screen fraction per viewport
 * (docs/GOLDEN-HOUR-BRIEF, Readability). Adding a footer row, or a Kazakh string that wraps to an
 * extra line, moves the band on its own.
 *
 * `heightPx` is 0 until the Footer measures itself (and on a sub-page, which has no such block);
 * `copyTopFraction` then reports 1 — no copy over the sky — and the band is placed by the terrain
 * alone, which is the right answer for a page without a tall footer.
 */
export const copyBox = { heightPx: 0, marginPx: 0 }

/** The Footer's ResizeObserver: the content block's own height and its bottom margin, in CSS px. */
export function setCopyBox(heightPx: number, marginPx: number): void {
  copyBox.heightPx = heightPx
  copyBox.marginPx = marginPx
}

/**
 * Where the top of that block sits at the end of the journey, as a fraction of the frame
 * (0 top, 1 bottom). The block is pinned `marginPx` above the bottom, so this is scroll-independent:
 * it is where the copy lands once the page has been scrolled all the way down.
 */
export function copyTopFraction(viewportHeight: number): number {
  if (copyBox.heightPx <= 0 || viewportHeight <= 0) return 1
  return Math.min(1, Math.max(0, 1 - (copyBox.heightPx + copyBox.marginPx) / viewportHeight))
}
