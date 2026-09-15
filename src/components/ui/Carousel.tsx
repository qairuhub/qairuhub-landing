import clsx from 'clsx'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { useDocumentVisible, useReducedMotion } from '../../lib/media'
import { ChevronLeft, ChevronRight, Pause, Play } from './icons'
import { useInView } from './Reveal'

export interface CarouselLabels {
  /** [a11y] region label, e.g. "Highlighted projects" */
  region: string
  prev: string
  next: string
  pause: string
  play: string
  /** [a11y] per-slide position, e.g. "3 of 9" */
  slideOf: (n: number, total: number) => string
  /** [a11y] announced after a manual move, e.g. "Project 3 of 9: theqairubook" */
  current: (n: number, total: number, index: number) => string
}

export interface CarouselProps<T> {
  items: readonly T[]
  getKey: (item: T) => string
  renderItem: (item: T, index: number) => ReactNode
  labels: CarouselLabels
  /** Extra class per slide (e.g. the dashed "Your project here" slot). */
  slideClassName?: (item: T) => string | undefined
  /** Autoplay step in ms (plan WP8: 6 s). */
  interval?: number
  className?: string
}

/** Slack (px) when comparing scroll positions: snap + subpixel layout never land exactly. */
const EPS = 4

/**
 * Horizontal scroll-snap carousel (V3-BUILD-PLAN WP8). Styles live in `src/sections/Projects.css`
 * (`.qcar*`), its only consumer, so this file stays inside WP8's ownership.
 *
 * - **Native scroller.** The track is a real `overflow-x: auto` list with `scroll-snap`, so touch
 *   swipe, trackpads and tabbing into an offscreen card work without JS. Buttons and arrow keys call
 *   `scrollTo` on it; the current index is read back from the scroll position.
 * - **Loops.** Next at the end returns to the first card; Previous at the start goes to the last.
 * - **Autoplay** advances every `interval` ms only while the carousel is in view, the tab is
 *   visible, the mouse is not over it, keyboard focus is not inside it, no finger is on it and the
 *   user has not paused it. It never runs under `prefers-reduced-motion` (the pause/play control is
 *   then hidden, since nothing moves). Any move restarts the step.
 * - **Screen readers.** A labelled region (`aria-roledescription="carousel"`) holding a list; each
 *   item starts with a visually hidden "n of total". Manual moves are announced in a polite live
 *   region; autoplay moves are not.
 * - **No layout shift.** Everything renders from build-time data at its final size; the progress
 *   thumb moves with a transform written straight to the DOM (no re-render per scroll frame).
 */
export function Carousel<T>({
  items,
  getKey,
  renderItem,
  labels,
  slideClassName,
  interval = 6000,
  className,
}: CarouselProps<T>) {
  const trackRef = useRef<HTMLUListElement | null>(null)
  const thumbRef = useRef<HTMLSpanElement | null>(null)
  const rafRef = useRef(0)
  // Labels are usually an inline object: read them through a ref so a re-render never restarts autoplay.
  const labelsRef = useRef(labels)
  labelsRef.current = labels

  const { ref: rootRef, inView } = useInView<HTMLDivElement>({ once: false, threshold: 0.25, rootMargin: '0px' })
  const reduced = useReducedMotion()
  const docVisible = useDocumentVisible()

  const [index, setIndex] = useState(0)
  const [edges, setEdges] = useState({ start: true, end: false, overflow: true })
  const [userPaused, setUserPaused] = useState(false)
  const [hover, setHover] = useState(false)
  const [focusInside, setFocusInside] = useState(false)
  const [touching, setTouching] = useState(false)
  const [announce, setAnnounce] = useState('')

  const total = items.length

  /* ---------------------------------------------------------------- measure */

  const measure = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const slides = track.children
    if (!slides.length) return
    const base = (slides[0] as HTMLElement).offsetLeft
    const left = track.scrollLeft
    const max = track.scrollWidth - track.clientWidth

    let nearest = 0
    let best = Infinity
    for (let i = 0; i < slides.length; i++) {
      const d = Math.abs((slides[i] as HTMLElement).offsetLeft - base - left)
      if (d < best) {
        best = d
        nearest = i
      }
    }
    const overflow = max > EPS
    const start = left <= EPS
    const end = left >= max - EPS
    setIndex((prev) => (prev === nearest ? prev : nearest))
    setEdges((prev) =>
      prev.start === start && prev.end === end && prev.overflow === overflow ? prev : { start, end, overflow },
    )

    const thumb = thumbRef.current
    if (thumb && track.scrollWidth > 0 && track.clientWidth > 0) {
      thumb.style.width = `${(track.clientWidth / track.scrollWidth) * 100}%`
      thumb.style.transform = `translateX(${(left / track.clientWidth) * 100}%)`
    }
  }, [])

  const onScroll = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      measure()
    })
  }, [measure])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    measure()
    const ro = new ResizeObserver(() => measure())
    ro.observe(track)
    return () => {
      ro.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [measure, total])

  /* ---------------------------------------------------------------- move */

  const goTo = useCallback(
    (target: number, manual: boolean) => {
      const track = trackRef.current
      if (!track || !total) return
      const i = ((target % total) + total) % total
      const slides = track.children
      const base = (slides[0] as HTMLElement).offsetLeft
      const max = track.scrollWidth - track.clientWidth
      const left = Math.max(0, Math.min((slides[i] as HTMLElement).offsetLeft - base, max))
      track.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' })
      if (manual) setAnnounce(labelsRef.current.current(i + 1, total, i))
    },
    [reduced, total],
  )

  const next = useCallback((manual: boolean) => goTo(edges.end ? 0 : index + 1, manual), [edges.end, goTo, index])
  const prev = useCallback(
    (manual: boolean) => goTo(edges.start ? total - 1 : index - 1, manual),
    [edges.start, goTo, index, total],
  )

  /* ---------------------------------------------------------------- autoplay */

  const playing =
    !reduced && !userPaused && inView && docVisible && !hover && !focusInside && !touching && edges.overflow

  useEffect(() => {
    if (!playing) return
    const id = window.setTimeout(() => next(false), interval)
    return () => window.clearTimeout(id)
  }, [playing, next, interval])

  /* ---------------------------------------------------------------- input */

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    switch (e.key) {
      case 'ArrowRight':
        next(true)
        break
      case 'ArrowLeft':
        prev(true)
        break
      case 'Home':
        goTo(0, true)
        break
      case 'End':
        goTo(total - 1, true)
        break
      default:
        return
    }
    e.preventDefault()
  }

  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    // Pause for keyboard focus only: a mouse click on Next / Play must not stop autoplay.
    let keyboard = true
    try {
      keyboard = e.target.matches(':focus-visible')
    } catch {
      /* engines without :focus-visible: treat every focus as keyboard focus */
    }
    if (keyboard) setFocusInside(true)
  }
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusInside(false)
  }
  const onPointerEnter = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') setHover(true)
  }
  const onPointerLeave = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') setHover(false)
  }

  return (
    <div
      ref={rootRef}
      className={clsx('qcar', className)}
      role="region"
      aria-roledescription="carousel"
      aria-label={labels.region}
      data-playing={playing || undefined}
      onFocus={onFocus}
      onBlur={onBlur}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <ul
        ref={trackRef}
        className="qcar__track no-scrollbar"
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        onTouchStart={() => setTouching(true)}
        onTouchEnd={() => setTouching(false)}
        onTouchCancel={() => setTouching(false)}
      >
        {items.map((item, i) => (
          <li key={getKey(item)} className={clsx('qcar__slide', slideClassName?.(item))}>
            <span className="sr-only">{labels.slideOf(i + 1, total)}</span>
            {renderItem(item, i)}
          </li>
        ))}
      </ul>

      <div className="qcar__controls">
        <span className="qcar__count u-body-3" aria-hidden="true">
          {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
        <span className="qcar__progress" aria-hidden="true">
          <span ref={thumbRef} className="qcar__thumb" />
        </span>
        <div className="qcar__buttons">
          <button type="button" className="qcar__btn" aria-label={labels.prev} onClick={() => prev(true)}>
            <ChevronLeft size={18} />
          </button>
          {!reduced && (
            <button
              type="button"
              className="qcar__btn"
              aria-label={userPaused ? labels.play : labels.pause}
              onClick={() => setUserPaused((p) => !p)}
            >
              {userPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          )}
          <button type="button" className="qcar__btn" aria-label={labels.next} onClick={() => next(true)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </p>
    </div>
  )
}
