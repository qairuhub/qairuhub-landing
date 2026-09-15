import clsx from 'clsx'
import type { CSSProperties, ReactNode } from 'react'
import { useReducedMotion } from '../../lib/media'
import { useInView } from './Reveal'

export interface AutoCarouselProps {
  items: ReactNode[]
  /** seconds for one full loop */
  speed?: number
  direction?: 'normal' | 'reverse'
  /** horizontal gap between items (reference: 80px) */
  gap?: number
  /** item height (reference: 80px) */
  itemHeight?: number
  tint?: 'white' | 'black' | 'none'
  /** fade the edges (reference default: on) */
  mask?: boolean
  paused?: boolean
  /**
   * How many times the item list is laid out inside ONE loop set (default 1). Raise it for short
   * lists, so a set is always wider than the row and the loop never shows an empty tail. Only the
   * first pass is exposed to assistive tech.
   */
  repeat?: number
  className?: string
  itemClassName?: string
  /** Accessible name of the marquee (localized by the caller). */
  ariaLabel?: string
}

/** Static style for a paused track: drop the compositor layer while nothing moves. */
const IDLE_TRACK: CSSProperties = { willChange: 'auto' }

/**
 * Reference AutoCarousel: an infinite, linear marquee. The item set is rendered twice and the
 * track translates by -50% per loop, so it is seamless at any item widths.
 *
 * Motion rules (V3-BUILD-PLAN §5):
 * - paused whenever the row is offscreen (IntersectionObserver, re-arms when it scrolls back);
 * - never animates under `prefers-reduced-motion` (the hook below, plus the global.css rule);
 * - a paused track gives up its `will-change` layer.
 * The duplicate set (and any `repeat` pass) is `aria-hidden`, so assistive tech reads every name
 * exactly once.
 */
export function AutoCarousel({
  items,
  speed = 40,
  direction = 'normal',
  gap = 80,
  itemHeight = 80,
  tint = 'none',
  mask = true,
  paused,
  repeat = 1,
  className,
  itemClassName,
  ariaLabel,
}: AutoCarouselProps) {
  const passes = Math.max(1, Math.floor(repeat))
  const { ref, inView } = useInView<HTMLDivElement>({ once: false, threshold: 0, rootMargin: '0px' })
  const reduced = useReducedMotion()
  const idle = Boolean(paused) || reduced || !inView

  return (
    <div
      ref={ref}
      className={clsx(
        'carousel',
        mask && 'carousel--mask',
        tint === 'white' && 'carousel--tint-white',
        tint === 'black' && 'carousel--tint-black',
        idle && 'u-animation-paused',
        className,
      )}
      style={
        {
          '--h-gap': `${gap}px`,
          '--speed': `${speed}s`,
          '--dir': direction,
          '--item-h': `${itemHeight}px`,
        } as CSSProperties
      }
      role="marquee"
      aria-label={ariaLabel}
      data-paused={idle || undefined}
    >
      <div className="carousel__track" style={idle ? IDLE_TRACK : undefined}>
        {[0, 1].map((copy) => (
          <div className="carousel__set" key={copy} aria-hidden={copy === 1 || undefined}>
            {Array.from({ length: passes }, (_, pass) =>
              items.map((item, i) => (
                <div
                  className={clsx('carousel__item', itemClassName)}
                  key={`${pass}-${i}`}
                  aria-hidden={(copy === 0 && pass > 0) || undefined}
                >
                  {item}
                </div>
              )),
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
