import clsx from 'clsx'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import { agentic } from '../content'
import { Button } from '../components/ui/Button'
import { Grid, Col } from '../components/ui/Grid'
import { Reveal, useInView } from '../components/ui/Reveal'
import { Section, SectionText } from '../components/ui/Section'
import { Check, Sparkle } from '../components/ui/icons'
import { DUR } from '../lib/ease'
import { useReducedMotion } from '../lib/media'
import './AgenticCards.css'

/* ------------------------------------------------------------------ timings (reference) */
type Phase = 'idle' | 'typing' | 'holding' | 'collapsing'

const TYPE_MS = DUR.typewriter // 800 — text width 0 → measured
const HOLD_MS = 2200 // full prompt on screen
const COLLAPSE_MS = 400 // width → 0
const REDUCED_CYCLE_MS = 3400 // reduced motion: crossfade period
const FADE_MS = 400
/** Horizontal chrome around the typed text: padding 20+20, icon 28, icon gap 8, caret 2 + gap 8. */
const PILL_CHROME = 86

/** Content-neutral labels for the "Build" bento mock (design brief). Purely decorative, aria-hidden. */
const BENTO_LABELS = ['Team', 'Repo', 'Demo', 'Sprint'] as const

/** Named card visuals (mirrors `features.items[].visual`) — bound by key, never by array position. */
type Visual = 'learn' | 'build' | 'launch'
const VISUAL_KEYS: readonly Visual[] = ['learn', 'build', 'launch']

/** Shape of an `agentic.cards` entry; `visual` is optional so content.ts may name the mock explicitly. */
interface AgenticCard {
  title: string
  body: string
  visual?: Visual
}

const isVisual = (v: string): v is Visual => (VISUAL_KEYS as readonly string[]).includes(v)

/**
 * Resolve which mock a card gets: an explicit `visual` wins, otherwise the card title is matched
 * against the known keys (`Learn` → 'learn'). An unmatched card gets no mock (and a DEV warning)
 * rather than silently repeating another card's visual.
 */
function visualFor(card: AgenticCard): Visual | null {
  if (card.visual) return card.visual
  const key = card.title.trim().toLowerCase()
  if (isVisual(key)) return key
  if (import.meta.env.DEV) {
    console.warn(`[AgenticCards] no visual for card "${card.title}" — add \`visual: ${VISUAL_KEYS.map((k) => `'${k}'`).join(' | ')}\` in content.ts`)
  }
  return null
}

/* ------------------------------------------------------------------ Typewriter pill */
interface TypewriterPillProps {
  text: string
  phase: Phase
  reduced: boolean
  fading: boolean
}

/**
 * Reference typewriter: a 48px rounded-full pill, absolutely centered in a 48px row. The text
 * "types" by animating its WIDTH from 0 to the measured width (800ms ease-out) — not char by char.
 * The width is measured from an invisible absolutely-positioned twin span.
 */
function TypewriterPill({ text, phase, reduced, fading }: TypewriterPillProps) {
  const rowRef = useRef<HTMLDivElement | null>(null)
  const twinRef = useRef<HTMLSpanElement | null>(null)
  const [width, setWidth] = useState(0)
  const [capped, setCapped] = useState(false)

  const measure = useCallback(() => {
    const twin = twinRef.current
    const row = rowRef.current
    if (!twin || !row) return
    const measured = Math.ceil(twin.getBoundingClientRect().width)
    const available = Math.max(0, Math.floor(row.clientWidth - PILL_CHROME))
    setCapped(measured > available)
    setWidth(Math.min(measured, available))
  }, [])

  // Measure synchronously whenever the prompt changes (before paint → the width transition starts from 0).
  useLayoutEffect(measure, [measure, text])

  // Re-measure on resize and once the web fonts have loaded (font-display: swap).
  useEffect(() => {
    let raf = 0
    let alive = true
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    window.addEventListener('resize', onResize)
    document.fonts.ready.then(() => {
      if (alive) measure()
    })
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [measure])

  const open = reduced || phase === 'typing' || phase === 'holding'
  const typing = !reduced && phase === 'typing'

  return (
    <div ref={rowRef} className="ac-pill-row">
      <div
        className={clsx('ac-pill', reduced && 'is-reduced')}
        aria-hidden="true"
        style={{ '--w': `${open ? width : 0}px` } as CSSProperties}
      >
        <span className="ac-pill__icon">
          <Sparkle size={14} />
        </span>
        <span
          className={clsx(
            'ac-pill__text',
            phase === 'collapsing' && 'is-collapsing',
            capped && phase === 'holding' && 'is-capped',
            fading && 'is-fading',
          )}
        >
          <span className="ac-pill__label">{text}</span>
          <span ref={twinRef} className="ac-pill__twin">
            {text}
          </span>
        </span>
        <span className={clsx('ac-pill__caret', typing && 'is-on')} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Card media mocks (monochrome CSS) */
function Bar({ w, strong }: { w: number | string; strong?: boolean }) {
  return <span className={clsx('ac-bar', strong && 'ac-bar--strong')} style={{ width: w }} />
}

/** Learn — a small stack of three "session" cards, slightly fanned, with a date chip + skeleton lines. */
function LearnVisual() {
  return (
    <div className="ac-vis">
      <div className="ac-stack">
        {[0, 1, 2].map((k) => (
          <div className="ac-stack__card" key={k}>
            <div className="ac-stack__head">
              <span className="ac-chip">
                <Bar w={30} strong />
              </span>
              <span className="ac-dot" />
            </div>
            <Bar w="74%" strong />
            <Bar w="90%" />
            <Bar w="58%" />
            <div className="ac-stack__foot">
              <span className="ac-avatars">
                <span />
                <span />
                <span />
              </span>
              <Bar w={36} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Build — a 2×2 bento of translucent tiles, each with a tiny glyph and a label. */
function BuildVisual() {
  return (
    <div className="ac-vis">
      <div className="ac-bento">
        {BENTO_LABELS.map((label, i) => (
          <div className={clsx('ac-tile', `ac-tile--${i}`)} key={label}>
            <div className="ac-tile__art">
              {i === 0 && (
                <span className="ac-team">
                  <span />
                  <span />
                  <span />
                </span>
              )}
              {i === 1 && (
                <span className="ac-repo">
                  <Bar w="70%" strong />
                  <Bar w="52%" />
                  <Bar w="84%" />
                </span>
              )}
              {i === 2 && (
                <span className="ac-play">
                  <span />
                </span>
              )}
              {i === 3 && (
                <span className="ac-sprint">
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
              )}
            </div>
            <span className="ac-tile__label u-body-3">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Launch — a tall product silhouette with a floating settings panel (4 rows of label + control). */
function LaunchVisual() {
  return (
    <div className="ac-vis">
      <div className="ac-silhouette">
        <span className="ac-silhouette__screen" />
        <span className="ac-silhouette__notch" />
      </div>
      <div className="ac-panel">
        <div className="ac-panel__head">
          <Bar w={64} strong />
          <span className="ac-dot" />
        </div>
        <div className="ac-panel__row">
          <Bar w="54%" />
          <span className="ac-toggle">
            <span className="ac-toggle__knob" />
          </span>
        </div>
        <div className="ac-panel__row">
          <Bar w="40%" />
          <span className="ac-toggle ac-toggle--late">
            <span className="ac-toggle__knob" />
          </span>
        </div>
        <div className="ac-panel__row">
          <Bar w="62%" />
          <span className="ac-check">
            <Check size={12} />
          </span>
        </div>
        <div className="ac-panel__row">
          <Bar w="46%" />
          <span className="ac-check ac-check--late">
            <Check size={12} />
          </span>
        </div>
      </div>
    </div>
  )
}

const VISUALS: Record<Visual, ComponentType> = { learn: LearnVisual, build: BuildVisual, launch: LaunchVisual }

/* ------------------------------------------------------------------ Section */
export default function AgenticCards() {
  const reduced = useReducedMotion()
  const prompts = agentic.prompts
  const n = prompts.length
  const cardCount = agentic.cards.length

  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [fading, setFading] = useState(false)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [focusIdx, setFocusIdx] = useState<number | null>(null)
  const paused = hoverIdx !== null || focusIdx !== null

  // The cycle only starts once the pill scrolls into view (so the first prompt is seen typing).
  const { ref: startRef, inView } = useInView<HTMLDivElement>({ once: true, threshold: 0.3 })
  useEffect(() => {
    if (!inView || phase !== 'idle') return
    const t = window.setTimeout(() => setPhase('typing'), 200)
    return () => window.clearTimeout(t)
  }, [inView, phase])

  // State machine: type 800ms → hold ~2200ms → collapse 400ms → next prompt.
  // Hover/focus on a card pauses at the "holding" step; leaving resumes.
  useEffect(() => {
    if (reduced || phase === 'idle') return
    let t = 0
    if (phase === 'typing') {
      t = window.setTimeout(() => setPhase('holding'), TYPE_MS)
    } else if (phase === 'holding') {
      if (paused) return
      t = window.setTimeout(() => setPhase('collapsing'), HOLD_MS)
    } else {
      t = window.setTimeout(() => {
        setIdx((i) => (i + 1) % n)
        setPhase('typing')
      }, COLLAPSE_MS)
    }
    return () => window.clearTimeout(t)
  }, [phase, paused, reduced, n])

  // Reduced motion: full prompt shown, crossfade to the next one every 3.4s.
  useEffect(() => {
    if (!reduced || paused) return
    let t2 = 0
    const t1 = window.setTimeout(() => {
      setFading(true)
      t2 = window.setTimeout(() => {
        setIdx((i) => (i + 1) % n)
        setFading(false)
      }, FADE_MS)
    }, REDUCED_CYCLE_MS - FADE_MS)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      setFading(false)
    }
  }, [reduced, paused, n, idx])

  // Active card = current prompt % 3, overridden by a hovered / focused card.
  const active = hoverIdx ?? focusIdx ?? idx % cardCount

  return (
    <Section id="agentic">
      <SectionText
        titleAs="h2"
        titleClass="u-h2-large"
        title={agentic.title}
        body={agentic.subtitle}
        ctas={
          <Button variant="primary" href={agentic.cta.href}>
            {agentic.cta.label}
          </Button>
        }
      />

      <Grid>
        <Col large={12}>
          <Reveal index={0}>
            <div ref={startRef}>
              <TypewriterPill text={prompts[idx] ?? ''} phase={phase} reduced={reduced} fading={fading} />
            </div>
          </Reveal>
          <ul className="sr-only">
            {prompts.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Col>
      </Grid>

      <Grid>
        {agentic.cards.map((card: AgenticCard, i) => {
          const visual = visualFor(card)
          const Visual = visual ? VISUALS[visual] : null
          return (
            <Col key={card.title} large={4} medium={6} small={12}>
              <Reveal index={i} className="h-full">
                <article
                  className={clsx('ac-card', active === i && 'is-active')}
                  tabIndex={0}
                  onPointerEnter={(e) => {
                    if (e.pointerType === 'mouse') setHoverIdx(i)
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === 'mouse') setHoverIdx((h) => (h === i ? null : h))
                  }}
                  onFocus={() => setFocusIdx(i)}
                  onBlur={() => setFocusIdx((f) => (f === i ? null : f))}
                >
                  <div className="ac-card__media" aria-hidden="true">
                    {Visual && <Visual />}
                  </div>
                  <div className="ac-card__body flex flex-col">
                    <h3 className="u-h2 ac-card__title">{card.title}</h3>
                    <p className="u-body-1 ac-card__text">{card.body}</p>
                  </div>
                </article>
              </Reveal>
            </Col>
          )
        })}
      </Grid>
    </Section>
  )
}
