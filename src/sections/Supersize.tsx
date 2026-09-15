import { Fragment, useEffect, useMemo, useRef } from 'react'
import { Section } from '../components/ui/Section'
import { useT } from '../i18n/LocaleProvider'
import { sectionIds } from '../i18n/shared'
import { text } from './supersize.i18n'
import { clamp } from '../lib/ease'
import { scrollState } from '../lib/scroll'
import { addTick } from '../lib/ticker'
import './Supersize.css'
import './SupersizeWipe.css'

/** Where a line is fully lit, as a fraction of the viewport height (a touch below centre). */
const MID = 0.55
/** Half the height of the wipe band, as a fraction of the viewport height: a line goes from
 *  dim to lit while its centre travels from MID + BAND to MID - BAND. */
const BAND = 0.08
/** Per-word travel while dimmed, px. */
const LIFT = 12
/** Smallest change of the fill that is worth a style write. */
const EPSILON = 0.0005

/** Offset of `el`'s top from the top of the document, from layout (transforms ignored). */
function docTop(el: HTMLElement) {
  let y = 0
  let node: HTMLElement | null = el
  while (node) {
    y += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return y
}

/**
 * Supersize display text (reference "AnimatedText"): one uppercase compressed sentence,
 * left-aligned, ending inside the viewport. Each LINE wipes from 15% → 100% top-to-bottom
 * (a `--fill` custom property clipped to the glyphs in SupersizeWipe.css) and lifts 12px as that
 * line crosses the middle of the viewport. The fill is driven by each word's own position in
 * the viewport — words sharing a line share an offset, so they light together — measured
 * once per layout change and combined every frame with a single section rect read. Styles
 * are written on refs from the shared page ticker (src/lib/ticker.ts) — no private rAF loop,
 * no React state per frame — and the tick is only registered while an IntersectionObserver
 * says the section is within a viewport of the screen.
 *
 * Copy: supersize.i18n.ts. Kazakh renders through the same "Anton" family, whose Cyrillic range is
 * Oswald 600 (global.css, plan D6), so KK display text never falls back to a system face.
 */
export default function Supersize() {
  const textRef = useRef<HTMLHeadingElement | null>(null)
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([])
  const t = useT(text)
  const words = useMemo(() => t.text.split(/\s+/).filter(Boolean), [t.text])

  useEffect(() => {
    // Position is measured on the whole section so `docTop` deltas stay valid across padding.
    const section = textRef.current?.closest<HTMLElement>('.supersize')
    if (!section) return
    const spans = wordRefs.current.filter((s): s is HTMLSpanElement => s != null)
    const n = spans.length
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')

    let offTick: (() => void) | null = null
    /** Layout changed (resize, font swap, first frame) → re-measure the word offsets. */
    let dirty = true
    let lastY = Number.NaN
    let near = false
    /** Centre of each word relative to the section top, px (layout, transform-free). */
    const offsets = new Float64Array(n)
    /** Last fill written per word, so an unchanged word costs no style write. */
    const lastT = new Float64Array(n).fill(-1)

    const measure = () => {
      const sectionTop = docTop(section)
      for (let i = 0; i < n; i++) {
        const el = spans[i]
        offsets[i] = docTop(el) - sectionTop + el.offsetHeight / 2
      }
    }

    const write = (i: number, t: number) => {
      if (Math.abs(t - lastT[i]) < EPSILON) return
      lastT[i] = t
      const el = spans[i]
      el.style.setProperty('--fill', t.toFixed(3))
      el.style.transform = `translate3d(0, ${((1 - t) * LIFT).toFixed(2)}px, 0)`
    }

    const tick = () => {
      // Skip all work while nothing moved (scroll idle, no layout change).
      if (!dirty && scrollState.y === lastY) return
      if (dirty) measure()
      dirty = false
      lastY = scrollState.y
      // One layout read per frame: every word's viewport centre derives from the section top.
      const top = section.getBoundingClientRect().top
      const vh = window.innerHeight
      const mid = vh * MID
      const band = vh * BAND
      for (let i = 0; i < n; i++) {
        const cy = top + offsets[i]
        write(i, clamp((mid - cy + band) / (2 * band)))
      }
    }

    const invalidate = () => {
      dirty = true
    }

    const showAll = () => {
      for (let i = 0; i < n; i++) {
        lastT[i] = -1
        const el = spans[i]
        el.style.setProperty('--fill', '1')
        el.style.transform = 'none'
      }
    }

    const start = () => {
      if (offTick) return
      dirty = true
      lastT.fill(-1)
      offTick = addTick(tick)
    }
    const stop = () => {
      offTick?.()
      offTick = null
    }

    // Only tick while the section is within one viewport of the screen. Whenever the
    // observer flips to "near" the first frame re-measures and repaints unconditionally
    // (`dirty`), so a jump straight into the section (anchor / reload) lands on the right state.
    const apply = () => {
      if (mq.matches) {
        stop()
        showAll()
      } else if (near) {
        start()
      } else {
        stop()
        // Settle the words at their resting state for the side we left on (the clamp gives
        // 0 below the viewport, 1 above it).
        dirty = true
        lastY = Number.NaN
        lastT.fill(-1)
        tick()
      }
    }

    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            ([entry]) => {
              near = entry.isIntersecting
              apply()
            },
            { rootMargin: '100% 0px' },
          )
        : null
    if (io) io.observe(section)
    else near = true

    apply()
    mq.addEventListener('change', apply)
    window.addEventListener('resize', invalidate)
    // Web-font swap changes line wrapping → word offsets.
    const fontsReady = document.fonts?.ready
    let cancelled = false
    fontsReady?.then(() => {
      if (!cancelled) invalidate()
    })

    return () => {
      cancelled = true
      stop()
      io?.disconnect()
      mq.removeEventListener('change', apply)
      window.removeEventListener('resize', invalidate)
    }
  }, [words])

  return (
    <Section id={sectionIds.supersize} spacing="none" className="supersize">
      <h2 ref={textRef} className="u-h1 supersize__text">
        {words.map((word, i) => (
          <Fragment key={`${word}-${i}`}>
            {i > 0 && ' '}
            <span
              className="supersize__word"
              ref={(el) => {
                wordRefs.current[i] = el
              }}
            >
              {/* Transparent duplicate carrying the .on-sky glow beneath the clipped fill. */}
              <span className="supersize__glow" aria-hidden="true">
                {word}
              </span>
              <span className="supersize__fill">{word}</span>
            </span>
          </Fragment>
        ))}
      </h2>
    </Section>
  )
}
