/**
 * The CSS stand-in for the journey's first phase: a plain gradient in the SPACE palette that
 * sits where the WebGL canvas will be. It is painted before the three chunk arrives (App.tsx
 * Suspense fallback) and stays underneath the canvas as the no-WebGL fallback (SkyScene.tsx),
 * so the first frame is already the top of the journey and the hand-off is invisible.
 *
 * Derived from `PALETTE` so retuning the palette can never desync the placeholder from the
 * canvas. journey.ts imports only lib/scroll — no three — so App can use this without pulling
 * the WebGL chunk into the initial bundle.
 */
import { PALETTE } from './journey'

export const FALLBACK_GRADIENT = `linear-gradient(180deg, ${PALETTE.space.top} 0%, ${PALETTE.space.bottom} 100%)`

/** The static night sky of /members and /handbook (SkyScene's `night` preset), as a CSS gradient. */
export const NIGHT_FALLBACK_GRADIENT = `linear-gradient(180deg, ${PALETTE.night.top} 0%, ${PALETTE.night.mid} 55%, ${PALETTE.night.bottom} 100%)`

/**
 * The placeholder for a sky preset: `space` for home (its journey starts there) and the 404,
 * `night` for the other sub-pages. Pure string lookup, safe for the entry bundle.
 */
export function fallbackGradientFor(preset: 'night' | 'space'): string {
  return preset === 'night' ? NIGHT_FALLBACK_GRADIENT : FALLBACK_GRADIENT
}
