import { hero } from '../content'

/**
 * Hero: 100vh + 80px spacer (reference: the first section title lands ≈200px below the fold).
 * The glass 3D wordmark is drawn by SkyScene (fixed canvas).
 */
export default function Hero() {
  return (
    <section id="Hero" data-theme="dark" className="relative w-full" style={{ height: 'calc(100lvh + 80px)' }}>
      <h1 className="sr-only">{hero.srTitle}</h1>
    </section>
  )
}
