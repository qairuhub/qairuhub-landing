import { brand } from '../../i18n/shared'
import { preloadTTFFont } from '../../lib/ttf'

/**
 * Courgette (Dancing Script as the fallback): TrueType glyf fonts parsed at runtime by lib/ttf.ts
 * for the 3D wordmark. Its own tiny module so App can start the download together with the sky
 * chunk request, without waiting for three + r3f to arrive (audit-loading L4).
 */
export const WORDMARK_FONTS = ['/fonts/Courgette-Regular.ttf', '/fonts/DancingScript-Variable.ttf'] as const

export function preloadWordmarkFont(): void {
  preloadTTFFont(WORDMARK_FONTS, brand.wordmark)
}
