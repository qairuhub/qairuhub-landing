import clsx from 'clsx'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type JSX,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { Section } from '../components/ui/Section'
import { Grid, Col } from '../components/ui/Grid'
import { Reveal, RevealGroup, useInView } from '../components/ui/Reveal'
import { Button } from '../components/ui/Button'
import { Pill } from '../components/ui/Pill'
import {
  ArrowUpRight,
  Book,
  Calendar,
  Check,
  ChevronDown,
  Folder,
  Globe,
  Grid2,
  Search,
  Sparkle,
  Users,
  type IconComponent,
} from '../components/ui/icons'
import { useDocumentVisible, useReducedMotion } from '../lib/media'
import { useT } from '../i18n/LocaleProvider'
import { Accent } from '../i18n/Accent'
import { fmt } from '../i18n/locale'
import { links, sectionIds } from '../i18n/shared'
import { text, type PlatformScreen, type PlatformText } from './platform.i18n'
import './ProductDemo.css'

/* ------------------------------------------------------------------ Static, locale-invariant maps */
/** 9 s per tab (CONTENT-V3 §8.1 `platform.autoAdvanceMs`). */
const DURATION = 9000
const TAB_COUNT = 4

/** Live demo on the platform's own landing (DECISIONS brief: "Try the live demo"). */
const LIVE_DEMO_HREF = `${links.platform}/#demo`

const TAB_ICONS: Record<PlatformScreen, IconComponent> = {
  finder: Search,
  projects: Folder,
  events: Calendar,
  people: Users,
}

/** Sidebar glyphs in the order of `app.sidebar`: Home · Team Finder · Projects · Events · People · Clubs · Resources. */
const SIDEBAR_ICONS: readonly IconComponent[] = [Grid2, Search, Folder, Calendar, Users, Sparkle, Book]
/** Highlighted sidebar entry per screen. */
const SIDEBAR_ACTIVE: Record<PlatformScreen, number> = { finder: 1, projects: 2, events: 3, people: 4 }

/* ------------------------------------------------------------------ Helpers */
/** "Aruzhan S." → "AS", "Айгерім Н." → "АН". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}]/gu, '').charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** Date tile: "Oct 2" → { day: "2", month: "Oct" }, "2 қаз." → { day: "2", month: "қаз." }. */
function splitDate(label: string): { day: string; month: string } {
  const day = label.match(/\d+/)?.[0] ?? ''
  const month = label.replace(/\d+/, '').replace(/\s+/g, ' ').trim()
  return { day, month }
}

/** A team of `n` as up to four small overlapping circles (the count is written next to it). */
function TeamDots({ n }: { n: number }) {
  const shown = Math.min(n, 4)
  return (
    <span className="pd-team" aria-hidden="true">
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className={`pd-team__dot pd-team__dot--${i}`} />
      ))}
    </span>
  )
}

/** Mock select / filter chips (decorative, not interactive). */
function Filters({ items, active = 0, select }: { items: readonly string[]; active?: number; select?: boolean }) {
  return (
    <div className="pd-filters" aria-hidden="true">
      {items.map((label, i) => (
        <span key={label} className={clsx('pd-filter', select ? 'pd-filter--select' : i === active && 'is-on')}>
          <span>{label}</span>
          {select && <ChevronDown size={11} />}
        </span>
      ))}
    </div>
  )
}

function ScreenHead({ title, subtitle, count }: { title: string; subtitle: string; count: string }) {
  return (
    <div className="pd-head">
      <div className="pd-head__text">
        <p className="pd-head__title">{title}</p>
        <p className="pd-head__sub">{subtitle}</p>
      </div>
      <p className="pd-head__count">{count}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ Screens */
type ScreenProps = { t: PlatformText }

function FinderScreen({ t }: ScreenProps) {
  const f = t.finder
  const c = f.columns
  return (
    <>
      <ScreenHead title={f.title} subtitle={f.subtitle} count={fmt(f.count, { n: f.rows.length })} />
      <div className="pd-toolbar" aria-hidden="true">
        <span className="pd-seg">
          <span className="pd-seg__item is-on">{f.modes[0]}</span>
          <span className="pd-seg__item">{f.modes[1]}</span>
        </span>
        <Filters items={f.filters} select />
      </div>
      <div className="pd-table">
        <div className="pd-tr pd-tr--head" aria-hidden="true">
          <span>{c.role}</span>
          <span>{c.project}</span>
          <span>{c.skill}</span>
          <span>{c.hours}</span>
          <span>{c.deadline}</span>
          <span />
        </div>
        <ul className="pd-tbody">
          {f.rows.map((row) => (
            <li className="pd-tr" key={`${row.role}-${row.project}`}>
              <span className="pd-td pd-td--role">
                <span className="sr-only">{c.role}: </span>
                {row.role}
              </span>
              <span className="pd-td pd-td--project">
                <span className="sr-only">{c.project}: </span>
                {row.project}
              </span>
              <span className="pd-td pd-td--skill">
                <span className="sr-only">{c.skill}: </span>
                <span className="pd-tag">{row.skill}</span>
              </span>
              <span className="pd-td pd-td--hours">
                <span className="sr-only">{c.hours}: </span>
                {row.hours}
              </span>
              <span className="pd-td pd-td--deadline">
                <span className="pd-td__label" aria-hidden="true">
                  {c.deadline}
                </span>
                <span className="sr-only">{c.deadline}: </span>
                {row.deadline}
              </span>
              <span className="pd-td pd-td--action" aria-hidden="true">
                <span className="pd-btn">{f.action}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

function ProjectsScreen({ t }: ScreenProps) {
  const p = t.projects
  return (
    <>
      <ScreenHead title={p.title} subtitle={p.subtitle} count={fmt(p.count, { n: p.rows.length })} />
      <Filters items={p.filters} />
      <ul className="pd-cards pd-cards--projects">
        {p.rows.map((row) => (
          <li className="pd-card" key={row.name}>
            <div className="pd-card__top">
              <span className="pd-card__name">{row.name}</span>
              <span className={clsx('pd-status', `pd-status--${row.status}`)}>
                <span className="pd-status__dot" aria-hidden="true" />
                {p.status[row.status]}
              </span>
            </div>
            <p className="pd-card__body">{row.promise}</p>
            <div className="pd-card__foot">
              <TeamDots n={row.team} />
              <span className="pd-muted">{fmt(p.team, { n: row.team })}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

function EventsScreen({ t }: ScreenProps) {
  const e = t.events
  return (
    <>
      <ScreenHead title={e.title} subtitle={e.subtitle} count={fmt(e.count, { n: e.rows.length })} />
      <Filters items={e.filters} />
      <ul className="pd-events">
        {e.rows.map((row, i) => {
          const { day, month } = splitDate(row.date)
          const joined = i === 0
          return (
            <li className="pd-event" key={`${row.date}-${row.title}`}>
              <span className="pd-date" aria-hidden="true">
                <span className="pd-date__month">{month}</span>
                <span className="pd-date__day">{day}</span>
              </span>
              <span className="sr-only">{row.date}: </span>
              <span className="pd-event__main">
                <span className="pd-event__title">{row.title}</span>
                <span className="pd-event__meta">
                  <span className="pd-tag">{row.type}</span>
                  <span>
                    {row.time} · {row.place}
                  </span>
                </span>
              </span>
              <span className="pd-event__cap">
                <span className="pd-meter" aria-hidden="true">
                  <span
                    className="pd-meter__fill"
                    style={{ '--w': `${Math.round((row.going / row.capacity) * 100)}%` } as CSSProperties}
                  />
                </span>
                <span className="pd-muted">{fmt(e.going, { x: row.going, cap: row.capacity })}</span>
              </span>
              <span className="pd-event__action" aria-hidden="true">
                <span className={clsx('pd-btn', joined && 'pd-btn--dark')}>
                  {joined && <Check size={11} />}
                  {e.action}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function PeopleScreen({ t }: ScreenProps) {
  const p = t.people
  return (
    <>
      <ScreenHead title={p.title} subtitle={p.subtitle} count={fmt(p.count, { n: p.cards.length })} />
      <Filters items={p.filters} select />
      <ul className="pd-cards pd-cards--people">
        {p.cards.map((card, i) => (
          <li className="pd-card pd-person" key={card.name}>
            <span className={clsx('pd-avatar', i === 0 && 'pd-avatar--blue')} aria-hidden="true">
              {initials(card.name)}
            </span>
            <div className="pd-person__id">
              <span className="pd-card__name">{card.name}</span>
              <span className="pd-muted">
                {card.program} · {card.year}
              </span>
            </div>
            <div className="pd-person__skills">
              {card.skills.map((skill) => (
                <span className="pd-tag" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
            <span className={clsx('pd-status', `pd-status--${card.availability}`)}>
              <span className="pd-status__dot" aria-hidden="true" />
              {p.availability[card.availability]}
            </span>
            <span className="pd-btn pd-person__action" aria-hidden="true">
              {p.action}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

const SCREENS: Record<PlatformScreen, (props: ScreenProps) => JSX.Element> = {
  finder: FinderScreen,
  projects: ProjectsScreen,
  events: EventsScreen,
  people: PeopleScreen,
}

/* ------------------------------------------------------------------ App window */
function AppWindow({ screen, t }: { screen: PlatformScreen; t: PlatformText }) {
  const Body = SCREENS[screen]
  const activeNav = SIDEBAR_ACTIVE[screen]
  const me = t.people.cards[0]
  return (
    <div className="pd-app" data-theme="light">
      <div className="pd-app__bar">
        <div className="pd-app__brand" aria-hidden="true">
          <span className="pd-app__logo">Q</span>
          <span className="pd-app__name">{t.app.name}</span>
        </div>
        <div className="pd-app__search" aria-hidden="true">
          <Search size={12} />
          <span>{t.app.search}</span>
        </div>
        <div className="pd-app__actions">
          <span className="pd-sample">
            <span className="pd-sample__dot" aria-hidden="true" />
            {t.sampleBadge}
          </span>
          <span className="pd-btn pd-app__secondary" aria-hidden="true">
            {t.app.secondary}
          </span>
          <span className="pd-btn pd-btn--dark pd-app__primary" aria-hidden="true">
            {t.app.primary}
          </span>
        </div>
      </div>
      <div className="pd-app__body">
        <div className="pd-app__side" aria-hidden="true">
          {t.app.sidebar.map((label, i) => {
            const Icon = SIDEBAR_ICONS[i] ?? Grid2
            return (
              <div className={clsx('pd-app__nav', i === activeNav && 'is-active')} key={label}>
                <Icon size={14} />
                <span>{label}</span>
              </div>
            )
          })}
          {me && (
            <div className="pd-app__me">
              <span className="pd-avatar pd-avatar--blue pd-avatar--sm">{initials(me.name)}</span>
              <span className="pd-app__me-text">
                <span>{me.name}</span>
                <span className="pd-muted">{me.year}</span>
              </span>
            </div>
          )}
        </div>
        <div className="pd-app__main">
          <Body t={t} />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Section */
/**
 * Platform showcase (#platform): a light app-window mock that cross-fades between four screens
 * (Team Finder · Projects · Events · People), driven by a glass tab bar with a sliding white
 * indicator and a 9 s timer line. The timer auto-advances only while the block is on screen,
 * the document is visible, the pointer is not over it and focus is not inside it; reduced
 * motion turns auto-advance off. Keyboard: roving tabs with Left / Right / Home / End.
 */
export default function ProductDemo() {
  const t = useT(text)
  const [active, setActive] = useState(0)
  /** bump to restart the timer without changing the tab (re-click on the active tab) */
  const [cycle, setCycle] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  const reduced = useReducedMotion()
  const docVisible = useDocumentVisible()
  const { ref: wrapRef, inView } = useInView<HTMLDivElement>({ once: false, threshold: 0.15 })
  const running = inView && docVisible && !reduced && !hovered && !focused

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

  /* ---- Timer: run while allowed; on pause keep the leftover time */
  useEffect(() => {
    if (!running) return
    const remaining = remainingRef.current
    const startedAt = performance.now()
    const id = window.setTimeout(() => {
      setActive((a) => (a + 1) % TAB_COUNT)
    }, remaining)
    return () => {
      window.clearTimeout(id)
      remainingRef.current = Math.max(0, remaining - (performance.now() - startedAt))
    }
  }, [running, active, cycle])

  /* ---- Indicator: measure the active tab on mount, change, resize and font load */
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

  /* ---- Pause while a mouse rests on the block or keyboard focus is inside it */
  const onPointerEnter = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') setHovered(true)
  }
  const onPointerLeave = () => setHovered(false)
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
  }

  return (
    <Section id={sectionIds.platform} aria-labelledby="platform-heading">
      {/* Heading */}
      <Grid center>
        <Col large={8} medium={10} small={12}>
          <RevealGroup className="text-air on-sky">
            <div>
              <Pill size="sm" icon={<Globe size={14} />}>
                {t.pill}
              </Pill>
            </div>
            <h2 id="platform-heading" className="u-h2-large">
              <Accent text={t.title} />
            </h2>
            <p className="u-body-1 max-w-[62ch]">{t.body}</p>
          </RevealGroup>
        </Col>
      </Grid>

      <div
        ref={wrapRef}
        className="pd-wrap"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onFocus={() => setFocused(true)}
        onBlur={onBlur}
      >
        {/* Stage: all four windows share one grid cell, so the height is the tallest screen */}
        <Reveal>
          <Grid center>
            <Col large={10} medium={12}>
              <div className="pd-stage">
                {t.tabs.map((tab, i) => (
                  <div
                    key={tab.screen}
                    id={`pd-panel-${tab.screen}`}
                    role="tabpanel"
                    aria-labelledby={`pd-tab-${tab.screen}`}
                    aria-hidden={i !== active}
                    tabIndex={i === active ? 0 : -1}
                    className={clsx('pd-stage__item', i === active && 'is-active')}
                  >
                    <AppWindow screen={tab.screen} t={t} />
                  </div>
                ))}
              </div>
            </Col>
          </Grid>
        </Reveal>

        {/* Tab bar + caption */}
        <Reveal delay={150}>
          <Grid center>
            <Col large={8} medium={12}>
              <div
                ref={tabbarRef}
                className={clsx('pd-tabbar', !running && 'is-paused')}
                role="tablist"
                aria-label={t.tablistLabel}
                style={{ '--pd-dur': `${DURATION}ms` } as CSSProperties}
              >
                <div className="pd-indicator" aria-hidden="true">
                  {!reduced && <span key={`${active}-${cycle}`} className="pd-timer" />}
                </div>
                {t.tabs.map((tab, i) => {
                  const Icon = TAB_ICONS[tab.screen]
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
                      <span className="pd-tab__label">{tab.label}</span>
                    </button>
                  )
                })}
              </div>
              <div className="pd-captions on-sky">
                {t.tabs.map((tab, i) => (
                  <p
                    key={tab.screen}
                    className={clsx('pd-caption u-body-2', i === active && 'is-active')}
                    aria-hidden={i !== active}
                  >
                    {tab.caption}
                  </p>
                ))}
              </div>
            </Col>
          </Grid>
        </Reveal>
      </div>

      {/* CTA row + access note */}
      <Grid center>
        <Col large={8} medium={10} small={12}>
          <RevealGroup className="pd-cta on-sky">
            <div className="pd-cta__buttons">
              <Button variant="primary" href={links.platform} external newTabLabel={t.newTab} iconRight={<ArrowUpRight size={14} />}>
                {t.ctaPrimary}
              </Button>
              <Button variant="secondary" href={LIVE_DEMO_HREF} external newTabLabel={t.newTab} iconRight={<ArrowUpRight size={14} />}>
                {t.ctaSecondary}
              </Button>
            </div>
            <p className="pd-cta__note u-caption">{t.accessNote}</p>
          </RevealGroup>
        </Col>
      </Grid>
    </Section>
  )
}
