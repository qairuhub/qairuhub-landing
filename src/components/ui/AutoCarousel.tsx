import clsx from 'clsx'
import type { CSSProperties, ReactNode } from 'react'
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
  className?: string
  itemClassName?: string
  ariaLabel?: string
}

/**
 * Reference AutoCarousel: an infinite, linear marquee. The item set is rendered twice and the
 * track translates by -50% per loop, so it is seamless at any item widths. Pauses offscreen.
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
  className,
  itemClassName,
  ariaLabel,
}: AutoCarouselProps) {
  const { ref, inView } = useInView<HTMLDivElement>({ once: false, threshold: 0, rootMargin: '0px' })
  return (
    <div
      ref={ref}
      className={clsx(
        'carousel',
        mask && 'carousel--mask',
        tint === 'white' && 'carousel--tint-white',
        tint === 'black' && 'carousel--tint-black',
        (paused || !inView) && 'u-animation-paused',
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
    >
      <div className="carousel__track">
        {[0, 1].map((copy) => (
          <div className="carousel__set" key={copy} aria-hidden={copy === 1 || undefined}>
            {items.map((item, i) => (
              <div className={clsx('carousel__item', itemClassName)} key={i}>
                {item}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
