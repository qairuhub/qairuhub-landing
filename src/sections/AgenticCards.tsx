import clsx from 'clsx'
import { useCallback, useState } from 'react'
import AskBar from '../assistant/AskBar'
import { Button } from '../components/ui/Button'
import { Grid, Col } from '../components/ui/Grid'
import { Reveal } from '../components/ui/Reveal'
import { Section, SectionText } from '../components/ui/Section'
import { Check } from '../components/ui/icons'
import { Accent } from '../i18n/Accent'
import { useRoute, useT } from '../i18n/LocaleProvider'
import { href } from '../i18n/locale'
import { sectionIds } from '../i18n/shared'
import { text, type LaunchpadVisual } from './launchpad.i18n'
import './AgenticCards.css'

/**
 * Launchpad (`#launchpad`, CONTENT-V3 §4): title with one cursive accent, subtitle, "Join QairuHub",
 * the Ask bar (Q, `src/assistant/AskBar.tsx`) and three cards. The file keeps its v2 name
 * (plan D5). Card mocks are bound by explicit `visual` keys; the card matching the Ask bar's
 * typewriter suggestion is active (suggestion % 3), overridden by a hovered or focused card.
 */

/* ------------------------------------------------------------------ Card media mocks (monochrome CSS) */
function Bar({ w, strong }: { w: number | string; strong?: boolean }) {
  return <span className={clsx('ac-bar', strong && 'ac-bar--strong')} style={{ width: w }} />
}

/** New here? A small stack of three "session" cards, slightly fanned. */
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

/** Have an idea? A 2×2 bento of translucent tiles (Team · Repo · Demo · Stage). */
function BuildVisual({ labels }: { labels: readonly string[] }) {
  return (
    <div className="ac-vis">
      <div className="ac-bento">
        {labels.map((label, i) => (
          <div className={clsx('ac-tile', `ac-tile--${i}`)} key={i}>
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

/** Have a demo? A tall product silhouette with a floating settings panel. */
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

/** The mock for a card, chosen by its explicit `visual` key. */
function CardVisual({ visual, bentoLabels }: { visual: LaunchpadVisual; bentoLabels: readonly string[] }) {
  if (visual === 'learn') return <LearnVisual />
  if (visual === 'build') return <BuildVisual labels={bentoLabels} />
  return <LaunchVisual />
}

/* ------------------------------------------------------------------ Section */
export default function AgenticCards() {
  const route = useRoute()
  const t = useT(text)

  const [promptIdx, setPromptIdx] = useState(0)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [focusIdx, setFocusIdx] = useState<number | null>(null)
  const onPromptChange = useCallback((i: number) => setPromptIdx(i), [])

  const active = hoverIdx ?? focusIdx ?? promptIdx % t.cards.length

  return (
    <Section id={sectionIds.launchpad}>
      <SectionText
        titleAs="h2"
        titleClass="u-h2-large"
        title={<Accent text={t.title} />}
        body={t.subtitle}
        ctas={
          <Button variant="primary" href={href(route, `#${sectionIds.join}`)}>
            {t.cta.label}
          </Button>
        }
      />

      <Grid center>
        <Col large={8} medium={10} small={12}>
          <Reveal index={0}>
            <AskBar onPromptChange={onPromptChange} />
          </Reveal>
        </Col>
      </Grid>

      <Grid>
        {t.cards.map((card, i) => {
          return (
            <Col key={card.visual} large={4} medium={6} small={12}>
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
                    <CardVisual visual={card.visual} bentoLabels={t.bentoLabels} />
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
