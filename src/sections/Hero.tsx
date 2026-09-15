import { useT } from '../i18n/LocaleProvider'
import { sectionIds } from '../i18n/shared'
import { text } from './hero.i18n'

/**
 * Hero: 100lvh + 80px spacer (reference: the first section title lands ≈ 200px below the fold).
 * The glass 3D wordmark is drawn by SkyScene (fixed canvas); it turns 360°, recedes and leaves the
 * frame by `HERO_EXIT_VH` (sky/journey.ts). The page title is screen-reader only.
 */
export default function Hero() {
  const t = useT(text)
  return (
    <section id={sectionIds.top} data-theme="dark" className="relative w-full" style={{ height: 'calc(100lvh + 80px)' }}>
      <h1 className="sr-only">{t.srTitle}</h1>
    </section>
  )
}
