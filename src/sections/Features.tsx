import clsx from 'clsx'
import { useEffect, useState, type CSSProperties } from 'react'
import { Section, SectionText } from '../components/ui/Section'
import { Grid, Col } from '../components/ui/Grid'
import { Reveal, useInView } from '../components/ui/Reveal'
import { AnimatedBorder } from '../components/ui/AnimatedBorder'
import { ArrowUpRight, Calendar, Grid2, Pencil, Search, Users, type IconComponent } from '../components/ui/icons'
import { Accent } from '../i18n/Accent'
import { useT } from '../i18n/LocaleProvider'
import { sectionIds } from '../i18n/shared'
import { useReducedMotion } from '../lib/media'
import { text, type OfferText } from './offer.i18n'
import './Features.css'

/* ------------------------------------------------------------------ layout (locale-invariant) */

type Visual = 'schedule' | 'chart' | 'links' | 'timeline'

/** Card i of `text.items`: column span at >=768px and its mock. The grid is 7/5 · 5/7 · 4/4/4. */
const LAYOUT: readonly { cols: number; visual: Visual | null }[] = [
  { cols: 7, visual: 'schedule' },
  { cols: 5, visual: 'chart' },
  { cols: 5, visual: 'links' },
  { cols: 7, visual: 'timeline' },
  { cols: 4, visual: null },
  { cols: 4, visual: null },
  { cols: 4, visual: null },
]

type Mock = OfferText['mock']

/* ------------------------------------------------------------------ mock visuals (decorative, aria-hidden) */

/** Card 1: the real upcoming schedule (§9.2): date · title · detail. The first row is the next one. */
function ScheduleMock({ rows }: { rows: Mock['schedule'] }) {
  return (
    <div className="feature-mock feature-mock--schedule">
      {rows.map((row, i) => (
        <div
          className={clsx('fm-row', i === 0 && 'is-next')}
          key={i}
          style={{ '--d': `${i * 90}ms` } as CSSProperties}
        >
          <span className="fm-row__date">{row.date}</span>
          <span className="fm-row__text">
            <span className="fm-row__title">{row.title}</span>
            <span className="fm-row__detail">{row.detail}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

/** Card 2: the road to HackAlem AI, four rising steps with a label under each bar (no invented numbers). */
const STEP_HEIGHTS = [38, 58, 80, 100] as const
function ChartMock({ chart }: { chart: Mock['chart'] }) {
  return (
    <div className="feature-mock feature-mock--chart">
      <div className="fm-chart__head">
        <Calendar size={14} />
        <span className="fm-chart__label">{chart.label}</span>
      </div>
      <div className="fm-chart__bars">
        {chart.bars.map((label, i) => (
          <div
            className="fm-bar"
            key={i}
            style={
              { '--h': `${STEP_HEIGHTS[i] ?? 100}%`, '--d': `${i * 90}ms`, '--o': 0.4 + i * 0.18 } as CSSProperties
            }
          >
            <div className="fm-bar__track">
              <span className="fm-bar__fill" />
            </div>
            <span className="fm-bar__label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Card 3: the platform address and its three destinations. */
const LINK_ICONS: readonly IconComponent[] = [Users, Pencil, Grid2]
function LinksMock({ items }: { items: Mock['links'] }) {
  return (
    <div className="feature-mock feature-mock--links">
      <div className="fm-search">
        <Search size={14} />
        <span className="fm-search__text">community.qairuhub.com</span>
      </div>
      {items.map((label, i) => {
        const Icon = LINK_ICONS[i] ?? Grid2
        return (
          <div className="fm-link" key={i} style={{ '--d': `${120 + i * 110}ms` } as CSSProperties}>
            <span className="fm-link__thumb">
              <Icon size={16} />
            </span>
            <span className="fm-link__label">{label}</span>
            <ArrowUpRight size={14} className="fm-link__arrow" />
          </div>
        )
      })}
    </div>
  )
}

/** Card 4: the path to Demo Day. 10 dots with milestones at 1 / 4 / 7 / 10; the last one is the stage. */
const DOTS = 10
const MILESTONE_DOTS = [1, 4, 7, 10] as const
function TimelineMock({ labels }: { labels: Mock['milestones'] }) {
  const pct = (dot: number) => ((dot - 1) / (DOTS - 1)) * 100
  const last = MILESTONE_DOTS.length - 1
  return (
    <div className="feature-mock feature-mock--timeline">
      <div className="fm-tl__labels">
        {MILESTONE_DOTS.map((dot, i) => (
          <span
            className={clsx('fm-tl__label', i === last && 'is-stage')}
            key={dot}
            style={{ '--x': `${pct(dot)}%`, '--d': `${i * 160}ms` } as CSSProperties}
            data-edge={i === 0 ? 'start' : i === last ? 'end' : undefined}
          >
            {labels[i]}
          </span>
        ))}
      </div>
      <div className="fm-tl__track">
        <span className="fm-tl__fill" />
        {Array.from({ length: DOTS }, (_, i) => i + 1).map((dot) => (
          <span
            className={clsx(
              'fm-tl__dot',
              (MILESTONE_DOTS as readonly number[]).includes(dot) && 'is-milestone',
              dot === DOTS && 'is-stage',
            )}
            key={dot}
            style={{ '--x': `${pct(dot)}%`, '--d': `${dot * 110}ms` } as CSSProperties}
          />
        ))}
      </div>
    </div>
  )
}

function FeatureVisual({ kind, mock }: { kind: Visual; mock: Mock }) {
  switch (kind) {
    case 'schedule':
      return <ScheduleMock rows={mock.schedule} />
    case 'chart':
      return <ChartMock chart={mock.chart} />
    case 'links':
      return <LinksMock items={mock.links} />
    case 'timeline':
      return <TimelineMock labels={mock.milestones} />
  }
}

/* ------------------------------------------------------------------ section */

/** What we offer (`#offer`, CONTENT-V3 §9): 7 AnimatedBorder cards on the 7/5 · 5/7 · 4/4/4 grid. */
export default function Features() {
  const t = useT(text)
  // One observer for the whole grid: pauses every border stroke offscreen and arms the mock animations.
  const { ref, inView } = useInView<HTMLDivElement>({ once: false, threshold: 0, rootMargin: '0px' })
  // Reduced motion: the mocks render in their final state immediately and follow a live OS change.
  const reduced = useReducedMotion()
  const [seen, setSeen] = useState(reduced)
  useEffect(() => {
    if (inView || reduced) setSeen(true)
  }, [inView, reduced])

  return (
    <Section id={sectionIds.offer} spacing="large">
      <SectionText titleAs="h2" titleClass="u-h3" title={<Accent text={t.title} />} body={t.body} />

      <div ref={ref} className={clsx('features', seen && 'is-in')}>
        <Grid>
          {t.items.map((item, i) => {
            const { cols, visual } = LAYOUT[i] ?? { cols: 4, visual: null }
            return (
              <Col key={i} large={cols} medium={cols} small={12} flex>
                <Reveal index={i} stagger={200} className="flex w-full">
                  <AnimatedBorder radius={12} paused={!inView} className="feature-ab">
                    <article className="feature">
                      <div className="feature__text">
                        <h3 className="u-h5">{item.title}</h3>
                        <p className="u-body-1-alt">{item.body}</p>
                      </div>
                      {visual && (
                        <div className="feature__media" aria-hidden="true">
                          <FeatureVisual kind={visual} mock={t.mock} />
                        </div>
                      )}
                    </article>
                  </AnimatedBorder>
                </Reveal>
              </Col>
            )
          })}
        </Grid>
      </div>
    </Section>
  )
}
