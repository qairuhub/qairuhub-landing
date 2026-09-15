import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import { Section } from '../components/ui/Section'
import { Reveal } from '../components/ui/Reveal'
import { useT } from '../i18n/LocaleProvider'
import { scrollState } from '../lib/scroll'
import { addTick } from '../lib/ticker'
import { clamp } from '../lib/ease'
import { useReducedMotion } from '../lib/media'
import { smoothstep } from './sky/journey'
import { text } from './story.i18n'
import './Storytelling.css'

const SHIFT_PX = 120

/**
 * Storytelling triptych LEARN · BUILD · LAUNCH · MEET (reference StorytellingTriptych). A 6×viewport
 * runway (1.5×100lvh per item: the v2 per-frame length, now with N = 4) with a
 * sticky 100lvh stage; item i owns the slice t ∈ [0,1] of P·N and rises in from +120px
 * (enter: smoothstep −0.15→0.3) then drifts up to −120px and fades (exit: 0.7→1.15).
 * All per-frame work is imperative — refs + style writes from the shared page ticker
 * (src/lib/ticker.ts); the tick is only registered while an IntersectionObserver reports the
 * runway within one viewport of the screen.
 */
export default function Storytelling() {
  const t = useT(text)
  // Read from the locale dictionary inside the component, never at module scope.
  const N = t.items.length
  // Follows the OS setting live (src/lib/media.ts).
  const reduced = useReducedMotion()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (reduced) return
    const root = rootRef.current
    if (!root) return

    let offTick: (() => void) | null = null
    let lastY = Number.NaN
    let lastH = 0
    let dirty = true
    // Cached last-written values so we only touch the DOM when something changed.
    const lastOpacity = new Array<number>(N).fill(-1)
    const lastY0 = new Array<number>(N).fill(Number.NaN)
    const lastScale = new Array<number>(N).fill(Number.NaN)
    const lastPE = new Array<boolean | null>(N).fill(null)

    const apply = (i: number, opacity: number, ty: number, scale: number) => {
      const el = itemRefs.current[i]
      if (!el) return
      const o = Math.round(opacity * 1000) / 1000
      const y = Math.round(ty * 100) / 100
      const s = Math.round(scale * 10000) / 10000
      if (o !== lastOpacity[i]) {
        el.style.opacity = String(o)
        lastOpacity[i] = o
      }
      if (y !== lastY0[i] || s !== lastScale[i]) {
        el.style.transform = `translate3d(0, ${y}px, 0) scale(${s})`
        lastY0[i] = y
        lastScale[i] = s
      }
      const hidden = o < 0.05
      if (hidden !== lastPE[i]) {
        el.style.pointerEvents = hidden ? 'none' : ''
        lastPE[i] = hidden
      }
    }

    const tick = () => {
      const innerH = window.innerHeight
      const y = scrollState.y
      if (!dirty && y === lastY && innerH === lastH) return
      lastY = y
      lastH = innerH

      const rect = root.getBoundingClientRect()
      // Skip work when the runway is nowhere near the viewport (but always run once).
      if (!dirty && (rect.bottom < -innerH || rect.top > innerH * 2)) return
      dirty = false

      const range = Math.max(1, rect.height - innerH)
      const P = clamp(-rect.top / range)

      for (let i = 0; i < N; i++) {
        const t = P * N - i
        // First item is fully present from P=0; last item holds at P=1.
        const tc = i === 0 ? Math.max(t, 0.3) : i === N - 1 ? Math.min(t, 0.7) : t
        const enter = smoothstep(-0.15, 0.3, tc)
        const exit = smoothstep(0.7, 1.15, tc)
        const presence = enter * (1 - exit)
        const opacity = presence
        const ty = (1 - enter) * SHIFT_PX - exit * SHIFT_PX
        const scale = 0.96 + 0.04 * presence
        apply(i, opacity, ty, scale)
      }
    }

    const onResize = () => {
      dirty = true
    }
    window.addEventListener('resize', onResize)
    // Layout above the runway can shift without a scroll (fonts, lazy sections) — resync.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null
    ro?.observe(document.body)

    const start = () => {
      if (offTick) return
      dirty = true
      offTick = addTick(tick)
    }
    const stop = () => {
      offTick?.()
      offTick = null
    }
    // Gate the tick on proximity: one viewport above/below the runway. Leaving the runway
    // runs one last settled frame so the items rest in their end state for that side.
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            ([entry]) => {
              if (entry.isIntersecting) start()
              else {
                stop()
                dirty = true
                tick()
              }
            },
            { rootMargin: '100% 0px' },
          )
        : null
    if (io) io.observe(root)
    else start()
    // Always run one frame now so a reload mid-runway shows the right item immediately.
    tick()

    return () => {
      stop()
      io?.disconnect()
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
      // Leave the DOM clean for the reduced-motion / static layout.
      for (const el of itemRefs.current) {
        if (!el) continue
        el.style.opacity = ''
        el.style.transform = ''
        el.style.pointerEvents = ''
      }
    }
  }, [reduced, N])

  return (
    <Section id="story" spacing="none" aria-label={t.a11yLabel}>
      <div ref={rootRef} className={clsx('triptych', reduced && 'triptych--static')}>
        <div className="triptych__inner">
          <div className="triptych__content">
            {t.items.map((item, i) => {
              const content = (
                <>
                  <h2 className="u-h1-small triptych__title">{item.title}</h2>
                  <p className="u-body-1 triptych__body">{item.body}</p>
                </>
              )
              if (reduced) {
                return (
                  <Reveal key={item.title} className="triptych__item" index={i}>
                    {content}
                  </Reveal>
                )
              }
              return (
                <div
                  key={item.title}
                  className="triptych__item"
                  // Pre-frame state: only the first item is present until the rAF loop takes over.
                  style={i === 0 ? undefined : { opacity: 0, pointerEvents: 'none' }}
                  ref={(el) => {
                    itemRefs.current[i] = el
                  }}
                >
                  {content}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Section>
  )
}
