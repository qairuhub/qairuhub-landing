/**
 * The CSS stand-in for the sky: a plain gradient in the page's first palette (SPACE for home and
 * the 404, NIGHT for /members and /handbook) that sits where the WebGL canvas will be. It is
 * painted before the three chunk arrives (App.tsx placeholder and Suspense fallback) and stays
 * underneath the canvas as the no-WebGL fallback (SkyScene.tsx), so the first frame already shows
 * the right sky and the hand-off is invisible.
 *
 * Derived from `PALETTE` so retuning the palette can never desync the placeholder from the
 * canvas. journey.ts imports only lib/scroll — no three — so App can use this without pulling
 * the WebGL chunk into the initial bundle.
 */
import type { Page } from '../../i18n/locale'
import { PALETTE } from './journey'

export const FALLBACK_GRADIENT = `linear-gradient(180deg, ${PALETTE.space.top} 0%, ${PALETTE.space.bottom} 100%)`

/** The static night sky of /members and /handbook (SkyScene's `night` preset), as a CSS gradient. */
export const NIGHT_FALLBACK_GRADIENT = `linear-gradient(180deg, ${PALETTE.night.top} 0%, ${PALETTE.night.mid} 55%, ${PALETTE.night.bottom} 100%)`

/** A page without a scroll story renders one frozen journey preset (V3-BUILD-PLAN WP1 C). */
export type StaticPreset = 'night' | 'space'

/**
 * The placeholder for a sky preset: `space` for home (its journey starts there) and the 404,
 * `night` for the other sub-pages. Pure string lookup, safe for the entry bundle.
 */
export function fallbackGradientFor(preset: StaticPreset): string {
  return preset === 'night' ? NIGHT_FALLBACK_GRADIENT : FALLBACK_GRADIENT
}

/**
 * home: the scroll journey (null); 404: space (the top of the journey); every other page: night.
 * Lives here (not in SkyScene) so App's placeholder uses the same palette before the chunk loads:
 * a space-coloured placeholder on /members jumped to night when the sky arrived.
 */
export function presetForPage(page: Page): StaticPreset | null {
  if (page === 'home') return null
  return page === 'notFound' ? 'space' : 'night'
}
