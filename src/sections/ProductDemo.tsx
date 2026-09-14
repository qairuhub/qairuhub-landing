import clsx from 'clsx'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
} from 'react'
import { Section } from '../components/ui/Section'
import { Grid, Col } from '../components/ui/Grid'
import { Reveal, useInView } from '../components/ui/Reveal'
import { Sparkle, Bolt, Rocket, Search, Grid2, Calendar, Users, Folder, CheckCircle, Book } from '../components/ui/icons'
import { useDocumentVisible, useReducedMotion } from '../lib/media'
import { productDemo } from '../content'
import { productDemoCopy } from './productDemo.content'
import './ProductDemo.css'

/* ------------------------------------------------------------------ Types + static maps */
type Tab = (typeof productDemo.tabs)[number]
type TabIcon = Tab['icon']
type Screen = Tab['screen']

const TAB_ICONS: Record<TabIcon, typeof Sparkle> = { sparkle: Sparkle, bolt: Bolt, rocket: Rocket }
/** Sidebar glyphs, in the order of productDemo.app.sidebar */
const SIDEBAR_ICONS = [Grid2, Calendar, Users, Folder, CheckCircle, Book] as const
/** Which sidebar entry is highlighted for each screen (Programs / Events / Members / Projects / Decisions / Playbooks) */
const SIDEBAR_ACTIVE: Record<Screen, number> = { schedule: 1, leaderboard: 3, cohort: 0 }
/** Deterministic leaderboard progress (40–90%) */
const PROGRESS = [88, 72, 58, 44]

const { heading: SECTION_HEADING, tablistLabel: TABLIST_LABEL, chrome: CHROME } = productDemoCopy

/** Month grid mock: 5 rows × 7 columns, the first day sits in the third column. */
const CAL_CELLS = 35
const CAL_OFFSET = 2
const CAL_DAYS = 30

const DURATION = productDemo.autoAdvanceMs
const TAB_COUNT = productDemo.tabs.length

/* ------------------------------------------------------------------ Mock furniture (decorative, no copy) */
/** Three overlapping avatar circles. */
function Avatars() {
  return (
    <span className="pd-avatars" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

/** Thin progress track with a black fill. */
function Progress({ value }: { value: number }) {
  return (
    <span className="pd-bar" aria-hidden="true">
      <span className="pd-bar__fill" style={{ '--w': `${value}%` } as CSSProperties} />
    </span>
  )
}

/**
 * Right-hand "details" panel: a heading + meta line + chip reused from the screen's own data,
 * then generic furniture (avatars, progress, skeleton lines) so the window reads as a real
 * two-pane app instead of four rows over empty white. Hidden on ≤768 (see ProductDemo.css).
 */
function Details({
  heading,
  meta,
  chip,
  progress,
  legend,
}: {
  heading: string
  meta: string
  chip?: string
  progress: number
  legend?: { label: string; count: number }[]
}) {
  const max = legend ? Math.max(1, ...legend.map((l) => l.count)) : 1
  return (
    <div className="pd-app__aside" aria-hidden="true">
      <div className="pd-aside__head">
        <p className="pd-aside__title">{heading}</p>
        <p className="pd-aside__meta">{meta}</p>
      </div>
      {chip && <span className="pd-chip pd-aside__chip">{chip}</span>}
      <div className="pd-aside__row">
        <Avatars />
        <Progress value={progress} />
      </div>
      {legend ? (
        <div className="pd-legend">
          {legend.map((l) => (
            <div className="pd-legend__row" key={l.label}>
              <span className="pd-legend__label">{l.label}</span>
              <span className="pd-legend__track">
                <span className="pd-legend__fill" style={{ '--w': `${(l.count / max) * 100}%` } as CSSProperties} />
              </span>
              <span className="pd-legend__count">{l.count}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="pd-aside__lines">
          <span className="pd-skel" style={{ width: '92%' }} />
          <span className="pd-skel" style={{ width: '76%' }} />
          <span className="pd-skel" style={{ width: '58%' }} />
        </div>
      )}
      <div className="pd-aside__foot">
        <span className="pd-skel" style={{ width: '40%' }} />
        <span className="pd-app__btn">{CHROME.create}</span>
      </div>
    </div>
  )
}

/** Month grid: day numbers with the schedule's dates highlighted (numbers only, no copy). */
function MonthGrid({ days }: { days: number[] }) {
  return (
    <div className="pd-cal" aria-hidden="true">
      <div className="pd-cal__head">
        {Array.from({ length: 7 }, (_, i) => (
          <span className="pd-skel" key={i} />
        ))}
      </div>
      <div className="pd-cal__grid">
        {Array.from({ length: CAL_CELLS }, (_, i) => {
          const n = i - CAL_OFFSET + 1
          const valid = n >= 1 && n <= CAL_DAYS
          return (
            <span className={clsx('pd-cal__cell', valid && days.includes(n) && 'is-on')} key={i}>
              {valid ? n : ''}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** Mini bar chart under the leaderboard: one bar per team (labels reuse the team names). */
function MiniChart({ labels }: { labels: string[] }) {
  return (
    <div className="pd-chart" aria-hidden="true">
      {labels.map((label, i) => (
        <div className="pd-chart__col" key={label}>
          <span className="pd-chart__track">
            <span className="pd-chart__fill" style={{ '--h': `${PROGRESS[i % PROGRESS.length]}%` } as CSSProperties} />
          </span>
          <span className="pd-chart__label">{label}</span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ App window screens */
function ScheduleScreen() {
  const { title, rows } = productDemo.app.schedule
  const first = rows[0]
  const days = rows.map((row) => Number.parseInt(row[0].replace(/\D+/g, ''), 10)).filter((n) => Number.isFinite(n))
  return (
    <>
      <p className="pd-app__title">{title}</p>
      <div className="pd-app__content">
        <div className="pd-app__primary">
          <div className="pd-rows">
            {rows.map((row) => (
              <div className="pd-row" key={row[1]}>
                <span className="pd-row__date">{row[0]}</span>
                <span className="pd-row__title">{row[1]}</span>
                <span className="pd-chip">{row[2]}</span>
              </div>
            ))}
          </div>
          <MonthGrid days={days} />
        </div>
        {first && <Details heading={first[1]} meta={first[0]} chip={first[2]} progress={PROGRESS[1]} />}
      </div>
    </>
  )
}

function LeaderboardScreen() {
  const { title, rows } = productDemo.app.leaderboard
  const first = rows[0]
  return (
    <>
      <p className="pd-app__title">{title}</p>
      <div className="pd-app__content">
        <div className="pd-app__primary">
          <div className="pd-rows">
            {rows.map((row, i) => (
              <div className="pd-row" key={row[0]}>
                <span className="pd-row__rank">{i + 1}</span>
                <span className="pd-row__team">{row[0]}</span>
                <span className="pd-row__project">{row[1]}</span>
                <Progress value={PROGRESS[i % PROGRESS.length]} />
                <span className="pd-chip">{row[2]}</span>
              </div>
            ))}
          </div>
          <MiniChart labels={rows.map((row) => row[0])} />
        </div>
        {first && <Details heading={first[0]} meta={first[1]} chip={first[2]} progress={PROGRESS[0]} />}
      </div>
    </>
  )
}

function CohortScreen() {
  const { title, columns, counts } = productDemo.app.cohort
  const legend = columns.map((label, i) => ({ label, count: counts[i] ?? 0 }))
  const total = counts.reduce((a, b) => a + b, 0)
  const done = counts[counts.length - 1] ?? 0
  return (
    <>
      <p className="pd-app__title">{title}</p>
      <div className="pd-app__content">
        <div className="pd-app__primary">
          <div className="pd-kanban">
            {columns.map((label, i) => (
              <div className="pd-kanban__col" key={label}>
                <div className="pd-kanban__label">
                  <span>{label}</span>
                  <span>{counts[i] ?? 0}</span>
                </div>
                {Array.from({ length: counts[i] ?? 0 }, (_, j) => (
                  <div className="pd-kanban__card" key={j} aria-hidden="true">
                    <span className="pd-skel" />
                    <span className="pd-skel pd-skel--short" />
                    <span className="pd-kanban__foot">
                      <Avatars />
                      <span className="pd-skel pd-skel--tag" />
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <Details
          heading={columns[columns.length - 1] ?? title}
          meta={title}
          progress={total ? Math.round((done / total) * 100) : 0}
          legend={legend}
        />
      </div>
    </>
  )
}

const SCREENS: Record<Screen, () => JSX.Element> = {
  schedule: ScheduleScreen,
  leaderboard: LeaderboardScreen,
  cohort: CohortScreen,
}

function AppWindow({ screen }: { screen: Screen }) {
  const { name, sidebar } = productDemo.app
  const Body = SCREENS[screen]
  const activeNav = SIDEBAR_ACTIVE[screen]
  return (
    <div className="pd-app" data-theme="light">
      <div className="pd-app__bar">
        <div className="pd-app__brand">
          <span className="pd-app__avatar" aria-hidden="true" />
          <span>{name}</span>
        </div>
        <div className="pd-app__search" aria-hidden="true">
          <Search size={12} />
          <span>{CHROME.search}</span>
        </div>
        <div className="pd-app__actions" aria-hidden="true">
          <span className="pd-app__btn">{CHROME.upload}</span>
          <span className="pd-app__btn pd-app__btn--dark">{CHROME.create}</span>
        </div>
      </div>
      <div className="pd-app__body">
        <div className="pd-app__side">
          {sidebar.map((label, i) => {
            const Icon = SIDEBAR_ICONS[i % SIDEBAR_ICONS.length]
            return (
              <div className={clsx('pd-app__nav', i === activeNav && 'is-active')} key={label}>
                <Icon size={14} />
                <span>{label}</span>
              </div>
            )
          })}
          {/* sidebar footer: a small skeleton "workspace" block keeps the rail from ending mid-air */}
          <div className="pd-app__side-foot" aria-hidden="true">
            <span className="pd-skel" style={{ width: '54%' }} />
            <span className="pd-skel" style={{ width: '72%' }} />
            <span className="pd-skel" style={{ width: '38%' }} />
          </div>
        </div>
        <div className="pd-app__main">
          <Body />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Section */
/**
 * Product demo: light app-window mock (10 cols) that cross-fades between three screens,
 * driven by a 36px glass tab bar (8 cols) with a sliding white indicator and a 3px timer
 * line that grows over 9s, then auto-advances. Clicking a tab selects it and restarts the
 * timer; the timer pauses while the section is offscreen or the document is hidden.
 */
export default function ProductDemo() {
  const [active, setActive] = useState(0)
  /** bump to restart the timer without changing the tab (re-click on the active tab) */
  const [cycle, setCycle] = useState(0)

  const reduced = useReducedMotion()
  const docVisible = useDocumentVisible()
  const { ref: wrapRef, inView } = useInView<HTMLDivElement>({ once: false, threshold: 0.15 })
  const running = inView && docVisible && !reduced

  const tabbarRef = useRef<HTMLDivElement | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const remainingRef = useRef(DURATION)

  const select = useCallback((i: number) => {
    setActive(i)
    setCycle((c) => c + 1)
  }, [])

  /* ---- Timer: a new cycle starts on every tab change / restart (reset remaining time) */
  useEffect(() => {
    remainingRef.current = DURATION
  }, [active, cycle])

  /* ---- Timer: run while visible; on pause (offscreen / hidden tab) keep the leftover time */
  useEffect(() => {
    if (!running) return
    const remaining = remainingRef.current
    const startedAt = performance.now()
    const t = window.setTimeout(() => {
      setActive((a) => (a + 1) % TAB_COUNT)
    }, remaining)
    return () => {
      window.clearTimeout(t)
      remainingRef.current = Math.max(0, remaining - (performance.now() - startedAt))
    }
  }, [running, active, cycle])

  /* ---- Indicator: measure the active tab on mount, change and resize */
  const measure = useCallback(() => {
    const bar = tabbarRef.current
    const btn = tabRefs.current[active]
    if (!bar || !btn) return
    bar.style.setProperty('--x', `${btn.offsetLeft}px`)
    bar.style.setProperty('--width', `${btn.offsetWidth}px`)
  }, [active])

  useLayoutEffect(() => {
    measure()
    const bar = tabbarRef.current
    if (!bar) return
    const ro = new ResizeObserver(measure)
    ro.observe(bar)
    return () => ro.disconnect()
  }, [measure])

  useEffect(() => {
    let cancelled = false
    document.fonts?.ready.then(() => {
      if (!cancelled) measure()
    })
    return () => {
      cancelled = true
    }
  }, [measure])

  /* ---- Keyboard: roving tabs (Left/Right/Home/End) */
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next: number | null = null
    if (e.key === 'ArrowRight') next = (i + 1) % TAB_COUNT
    else if (e.key === 'ArrowLeft') next = (i - 1 + TAB_COUNT) % TAB_COUNT
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TAB_COUNT - 1
    if (next === null) return
    e.preventDefault()
    select(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <Section id="demo" aria-labelledby="pd-heading">
      <h2 id="pd-heading" className="sr-only">
        {SECTION_HEADING}
      </h2>
      <div ref={wrapRef} className="flex flex-col gap-12">
        {/* Stage */}
        <Reveal>
          <Grid center>
            <Col large={10} medium={12}>
              <div className="pd-stage">
                {productDemo.tabs.map((tab, i) => (
                  <div
                    key={tab.screen}
                    id={`pd-panel-${tab.screen}`}
                    role="tabpanel"
                    aria-labelledby={`pd-tab-${tab.screen}`}
                    aria-hidden={i !== active}
                    className={clsx('pd-stage__item', i === active && 'is-active')}
                  >
                    <AppWindow screen={tab.screen} />
                  </div>
                ))}
              </div>
            </Col>
          </Grid>
        </Reveal>

        {/* Tab bar */}
        <Reveal delay={150}>
          <Grid center>
            <Col large={8} medium={12}>
              <div
                ref={tabbarRef}
                className={clsx('pd-tabbar', !running && 'is-paused')}
                role="tablist"
                aria-label={TABLIST_LABEL}
                style={{ '--pd-dur': `${DURATION}ms` } as CSSProperties}
              >
                <div className="pd-indicator" aria-hidden="true">
                  {!reduced && <span key={`${active}-${cycle}`} className="pd-timer" />}
                </div>
                {productDemo.tabs.map((tab, i) => {
                  const Icon = TAB_ICONS[tab.icon]
                  const selected = i === active
                  return (
                    <button
                      key={tab.screen}
                      ref={(el) => {
                        tabRefs.current[i] = el
                      }}
                      type="button"
                      role="tab"
                      id={`pd-tab-${tab.screen}`}
                      aria-selected={selected}
                      aria-controls={`pd-panel-${tab.screen}`}
                      tabIndex={selected ? 0 : -1}
                      className="pd-tab u-body-3"
                      onClick={() => select(i)}
                      onKeyDown={(e) => onKeyDown(e, i)}
                    >
                      <Icon size={14} />
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </div>
            </Col>
          </Grid>
        </Reveal>
      </div>
    </Section>
  )
}
