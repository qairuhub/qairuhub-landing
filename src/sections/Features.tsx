import clsx from 'clsx'
import { useEffect, useState, type CSSProperties } from 'react'
import { Section, SectionText } from '../components/ui/Section'
import { Grid, Col } from '../components/ui/Grid'
import { Reveal, useInView } from '../components/ui/Reveal'
import { AnimatedBorder } from '../components/ui/AnimatedBorder'
import { ArrowUpRight, Search } from '../components/ui/icons'
import { useReducedMotion } from '../lib/media'
import { features } from '../content'
import { featuresMock } from './features.content'
import './Features.css'

type Visual = (typeof features.items)[number]['visual']

/* ------------------------------------------------------------------ mock visuals (decorative) */

/** Schedule list: 4 rows — time @48px, title, chip. Rows are the Features card's own copy (featuresMock.schedule). */
function ScheduleMock() {
  return (
    <div className="feature-mock feature-mock--schedule">
      {featuresMock.schedule.map(([time, title, kind], i) => (
        <div className="fm-row" key={i} style={{ '--d': `${i * 90}ms` } as CSSProperties}>
          <span className="fm-row__time">{time}</span>
          <span className="fm-row__title">{title}</span>
          <span className="fm-chip">{kind}</span>
        </div>
      ))}
    </div>
  )
}

/** Analytics bars: 8 columns, value label above each bar, 20px tile below (reference look). */
const CHART = [42, 58, 35, 76, 64, 88, 52, 100] as const
function ChartMock() {
  return (
    <div className="feature-mock feature-mock--chart">
      {CHART.map((v, i) => (
        <div className="fm-bar" key={i} style={{ '--h': `${v}%`, '--d': `${i * 60}ms` } as CSSProperties}>
          <div className="fm-bar__track">
            <span className="fm-bar__val">{v}</span>
            <span className="fm-bar__fill" />
          </div>
          <span className="fm-bar__tile" />
        </div>
      ))}
    </div>
  )
}

/** Search pill + two stacked link cards (thumbnail, two skeleton lines, ↗). */
function LinksMock() {
  return (
    <div className="feature-mock feature-mock--links">
      <div className="fm-search">
        <Search size={14} />
        <span className="fm-line" style={{ width: '38%' }} />
      </div>
      {[0, 1].map((i) => (
        <div className="fm-link" key={i} style={{ '--d': `${120 + i * 120}ms` } as CSSProperties}>
          <span className="fm-link__thumb" />
          <span className="fm-link__lines">
            <span className="fm-line fm-line--strong" style={{ width: i === 0 ? '64%' : '52%' }} />
            <span className="fm-line" style={{ width: i === 0 ? '40%' : '30%' }} />
          </span>
          <ArrowUpRight size={14} className="fm-link__arrow" />
        </div>
      ))}
    </div>
  )
}

/** 10-week track: a dot per week, progress filled to week 7, 4 milestone labels (weeks 1/4/7/10) from featuresMock.milestones. */
const WEEKS = 10
const FILLED_WEEK = 7
const MILESTONE_WEEKS = [1, 4, 7, 10] as const
function TimelineMock() {
  const pct = (week: number) => ((week - 1) / (WEEKS - 1)) * 100
  const labels = featuresMock.milestones
  return (
    <div className="feature-mock feature-mock--timeline">
      <div className="fm-tl__labels">
        {MILESTONE_WEEKS.map((w, i) => (
          <span
            className={clsx('fm-tl__label', w <= FILLED_WEEK && 'is-done')}
            key={w}
            style={{ '--x': `${pct(w)}%`, '--d': `${i * 120}ms` } as CSSProperties}
            data-edge={i === 0 ? 'start' : i === MILESTONE_WEEKS.length - 1 ? 'end' : undefined}
          >
            {labels[i]}
          </span>
        ))}
      </div>
      <div className="fm-tl__track">
        <span className="fm-tl__fill" style={{ '--w': `${pct(FILLED_WEEK)}%` } as CSSProperties} />
        {Array.from({ length: WEEKS }, (_, i) => i + 1).map((w) => (
          <span
            className={clsx(
              'fm-tl__dot',
              w <= FILLED_WEEK && 'is-done',
              (MILESTONE_WEEKS as readonly number[]).includes(w) && 'is-milestone',
            )}
            key={w}
            style={{ '--x': `${pct(w)}%`, '--d': `${w * 70}ms` } as CSSProperties}
          />
        ))}
      </div>
    </div>
  )
}

function FeatureVisual({ kind }: { kind: Exclude<Visual, null> }) {
  switch (kind) {
    case 'schedule':
      return <ScheduleMock />
    case 'chart':
      return <ChartMock />
    case 'links':
      return <LinksMock />
    case 'timeline':
      return <TimelineMock />
  }
}

/* ------------------------------------------------------------------ section */

export default function Features() {
  // One observer for the whole grid: pauses the border strokes offscreen and arms the mock animations.
  const { ref, inView } = useInView<HTMLDivElement>({ once: false, threshold: 0, rootMargin: '0px' })
  // Reduced motion: the mocks render in their final state immediately (no arming wait) and follow a live OS change.
  const reduced = useReducedMotion()
  const [seen, setSeen] = useState(reduced)
  useEffect(() => {
    if (inView || reduced) setSeen(true)
  }, [inView, reduced])

  return (
    <Section id="features" spacing="large">
      <SectionText
        titleAs="h2"
        titleClass="u-h3"
        title={
          <>
            {features.titleBefore}
            <i>{features.titleCursive}</i>
            {features.titleAfter}
          </>
        }
        body={features.body}
      />

      <div ref={ref} className={clsx('features', seen && 'is-in')}>
        <Grid>
          {features.items.map((item, i) => (
            <Col key={item.title} large={item.cols} medium={item.cols} small={12} flex>
              <Reveal index={i} stagger={200} className="flex w-full">
                <AnimatedBorder radius={12} paused={!inView} className="feature-ab">
                  <article className="feature">
                    <div className="feature__text">
                      <h3 className="u-h5">{item.title}</h3>
                      <p className="u-body-1-alt">{item.body}</p>
                    </div>
                    {item.visual && (
                      <div className="feature__media" aria-hidden="true">
                        <FeatureVisual kind={item.visual} />
                      </div>
                    )}
                  </article>
                </AnimatedBorder>
              </Reveal>
            </Col>
          ))}
        </Grid>
      </div>
    </Section>
  )
}
