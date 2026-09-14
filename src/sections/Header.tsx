import clsx from 'clsx'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type SVGProps,
} from 'react'
import { nav, type NavColumn, type NavCta, type NavSubItem } from '../content'
import { Button } from '../components/ui/Button'
import { Wordmark } from '../components/ui/Wordmark'
import {
  ArrowUpRight,
  Bolt,
  Book,
  Calendar,
  CheckCircle,
  ChevronDown,
  Close,
  Folder,
  Grid2,
  Menu,
  Pencil,
  Rocket,
  Search,
  Sparkle,
  Users,
} from '../components/ui/icons'
import { useLenis } from '../lib/SmoothScroll'
import { scrollState } from '../lib/scroll'
import { useTick } from '../lib/ticker'
import { journey, smoothstep } from './sky/journey'
import './Header.css'

/* ------------------------------------------------------------------ icons */
type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
const ICONS: Record<NavSubItem['icon'], IconComponent> = {
  sparkle: Sparkle,
  bolt: Bolt,
  rocket: Rocket,
  users: Users,
  folder: Folder,
  pencil: Pencil,
  calendar: Calendar,
  book: Book,
  grid: Grid2,
  search: Search,
  check: CheckCircle,
}

/**
 * Mouse-leave grace before a mega menu closes. The label's bottom edge (y 52) and the panel's
 * hover bridge (y 56–88) leave a thin dead band, and the between-label gaps are outside every
 * <li>: a diagonal move from a label toward the panel's far CTA card crosses ~40px of that at
 * ~150px/s (≈270ms), so the grace must comfortably outlast it.
 */
const HOVER_GRACE_MS = 300
/**
 * The DOM wordmark is hidden whenever the 3D glass lettering is on screen (hero or footer run),
 * exactly like the reference: it shows only while both journey presences are below this.
 */
const LOGO_HIDE_AT = 0.05

/** mobile panel footer: lets the full-width login row wrap above the two 50 % CTAs */
const MOBILE_FOOTER_STYLE: CSSProperties = { flexWrap: 'wrap' }
const MOBILE_LOGIN_STYLE: CSSProperties = {
  flex: '0 0 100%',
  width: '100%',
  justifyContent: 'flex-start',
  minHeight: 38,
  padding: 0,
}

/* ------------------------------------------------------------------ sub item */
function SubItem({ item, index, onNavigate }: { item: NavSubItem; index: number; onNavigate: () => void }) {
  const Icon = ICONS[item.icon]
  const external = item.external === true
  return (
    <li>
      <a
        className="hdr__sub"
        href={item.href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer' : undefined}
        style={{ '--i': index } as CSSProperties}
        onClick={onNavigate}
      >
        <span className="hdr__sub-icon" aria-hidden="true">
          <Icon size={20} />
        </span>
        <span className="hdr__sub-text">
          <span className="hdr__sub-title">
            {item.title}
            {external && <ArrowUpRight size={14} />}
          </span>
          <span className="hdr__sub-desc">{item.description}</span>
        </span>
      </a>
    </li>
  )
}

function Columns({ columns, onNavigate }: { columns: NavColumn[]; onNavigate: () => void }) {
  return (
    <>
      {columns.map((col, c) => (
        <ul className="hdr__col" key={c}>
          {col.title && <li className="hdr__col-title">{col.title}</li>}
          {col.items.map((item, i) => (
            <SubItem key={item.title} item={item} index={i} onNavigate={onNavigate} />
          ))}
        </ul>
      ))}
    </>
  )
}

function CtaCard({ cta, onNavigate }: { cta: NavCta; onNavigate: () => void }) {
  return (
    <div className="hdr__cta">
      <div className="hdr__cta-card">
        <p className="hdr__cta-title">{cta.title}</p>
        <p className="hdr__cta-desc">{cta.description}</p>
        <Button variant="secondary" href={cta.href} onClick={onNavigate}>
          {cta.cta}
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ header */
export default function Header() {
  const lenis = useLenis()
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileExpanded, setMobileExpanded] = useState<number | null>(null)
  const [showLogo, setShowLogo] = useState(false)

  const logoVisibleRef = useRef(false)
  const navRef = useRef<HTMLElement>(null)
  const burgerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([])
  const menuRefs = useRef<(HTMLDivElement | null)[]>([])
  const graceRef = useRef<number | null>(null)
  /** last known mouse position while a mega menu is open (viewport px); null = unknown */
  const pointerRef = useRef<{ x: number; y: number } | null>(null)

  /* --- wordmark visibility: driven by the journey, state flips only on change --- */
  useTick(() => {
    const vh = Math.max(1, window.innerHeight)
    const y = scrollState.y / vh
    // `journey` is written by SkyScene's frame loop (priority -100). While that loop is not
    // running — chunk still loading, tab hidden, no WebGL — it keeps its last values, so fall
    // back to the very same curves evaluated from the scroll position: the DOM wordmark must
    // still appear once the hero has scrolled away even without the 3D run.
    const live = Math.abs(journey.vh - y) < 0.25
    const end = Math.max(4, scrollState.limit / vh)
    const hero = live ? journey.wordmarkHero : 1 - smoothstep(0, 1.4, y)
    const footer = live ? journey.wordmarkFooter : smoothstep(end - 1.4, end - 0.3, y)
    const next = hero < LOGO_HIDE_AT && footer < LOGO_HIDE_AT
    if (next !== logoVisibleRef.current) {
      logoVisibleRef.current = next
      setShowLogo(next)
    }
  })

  /* --- desktop mega menu open/close with hover grace --- */
  const clearGrace = useCallback(() => {
    if (graceRef.current !== null) {
      window.clearTimeout(graceRef.current)
      graceRef.current = null
    }
  }, [])
  const openAt = useCallback(
    (i: number) => {
      clearGrace()
      setOpenMenu(i)
    },
    [clearGrace],
  )
  const closeMenu = useCallback(() => {
    clearGrace()
    setOpenMenu(null)
  }, [clearGrace])
  /**
   * Aim-aware: is the mouse still "on its way" into menu `i`? True while it sits inside the open
   * panel's box extended straight up to its trigger's bottom edge — the corridor a hand crosses
   * when it leaves a label sideways and heads for a column or the CTA card. Entering the panel
   * itself re-fires mouseenter on the <li> and cancels the timer, so this only has to cover the
   * dead band the CSS bridge cannot.
   */
  const isAimingAt = useCallback((i: number) => {
    const p = pointerRef.current
    const panel = menuRefs.current[i]
    if (!p || !panel) return false
    const box = panel.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) return false
    const trigger = triggerRefs.current[i]?.getBoundingClientRect()
    const top = trigger ? Math.min(trigger.bottom, box.top) : box.top
    return p.x >= box.left && p.x <= box.right && p.y >= top && p.y <= box.bottom
  }, [])
  const closeSoon = useCallback(
    (i: number) => {
      clearGrace()
      const tick = () => {
        graceRef.current = null
        if (isAimingAt(i)) {
          // still crossing the corridor: keep it open and look again shortly
          graceRef.current = window.setTimeout(tick, HOVER_GRACE_MS)
          return
        }
        setOpenMenu((cur) => (cur === i ? null : cur))
      }
      graceRef.current = window.setTimeout(tick, HOVER_GRACE_MS)
    },
    [clearGrace, isAimingAt],
  )
  useEffect(() => clearGrace, [clearGrace])

  /* --- mobile menu --- */
  const closeMobile = useCallback(() => {
    setMobileOpen(false)
    setMobileExpanded(null)
  }, [])
  const toggleMobile = useCallback(() => {
    setMobileOpen((v) => {
      if (v) setMobileExpanded(null)
      return !v
    })
    setOpenMenu(null)
  }, [])

  // lock page scroll while the mobile panel is open; move focus into the panel
  useEffect(() => {
    if (!mobileOpen) return
    lenis?.stop()
    const t = window.setTimeout(() => closeRef.current?.focus(), 60)
    return () => {
      window.clearTimeout(t)
      lenis?.start()
    }
  }, [mobileOpen, lenis])

  // leaving the mobile breakpoint closes the panel
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)')
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) closeMobile()
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [closeMobile])

  /* --- escape + click outside --- */
  useEffect(() => {
    if (openMenu === null && !mobileOpen) return
    const onPointer = (e: PointerEvent) => {
      if (openMenu !== null && navRef.current && !navRef.current.contains(e.target as Node)) closeMenu()
    }
    // The dead band between a label and its panel is over pointer-events:none header chrome, so
    // the position has to be sampled at document level; a ref write only, no render per move.
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const p = pointerRef.current
      if (p) {
        p.x = e.clientX
        p.y = e.clientY
      } else pointerRef.current = { x: e.clientX, y: e.clientY }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (mobileOpen) {
        closeMobile()
        burgerRef.current?.focus()
      }
      if (openMenu !== null) {
        triggerRefs.current[openMenu]?.focus()
        closeMenu()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    if (openMenu !== null) document.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointermove', onMove)
      pointerRef.current = null
    }
  }, [openMenu, mobileOpen, closeMenu, closeMobile])

  /* --- per-item handlers (desktop) --- */
  const onTriggerClick = (i: number) => (e: MouseEvent<HTMLButtonElement>) => {
    // keyboard-activated clicks (detail 0) always open; pointer clicks toggle
    if (openMenu === i && e.detail !== 0) closeMenu()
    else openAt(i)
  }
  const onItemFocus = (i: number) => (e: FocusEvent<HTMLLIElement>) => {
    // open on keyboard focus only — pointer clicks are handled by the trigger toggle
    const t = e.target as HTMLElement
    if (t.matches(':focus-visible')) openAt(i)
  }
  const onItemBlur = (i: number) => (e: FocusEvent<HTMLLIElement>) => {
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    setOpenMenu((cur) => (cur === i ? null : cur))
  }

  return (
    <header className={clsx('hdr', mobileOpen && 'is-mobile-open')}>
      <div className="hdr__shade" aria-hidden="true" />

      <div className="grid-air grid-air--hero hdr__inner">
        {/* ---------------- left nav (≥768) ---------------- */}
        <nav className="hdr__nav" aria-label="Primary" ref={navRef}>
          <ul className="hdr__list">
            {nav.items.map((item, i) => {
              const hasMenu = !!item.columns?.length
              if (!hasMenu) {
                return (
                  <li className="hdr__item" key={item.label}>
                    <a className="hdr__link" href={item.href}>
                      {item.label}
                    </a>
                  </li>
                )
              }
              const isOpen = openMenu === i
              const menuId = `hdr-menu-${i}`
              return (
                <li
                  className="hdr__item"
                  key={item.label}
                  onMouseEnter={() => openAt(i)}
                  onMouseLeave={() => closeSoon(i)}
                  onFocus={onItemFocus(i)}
                  onBlur={onItemBlur(i)}
                >
                  <button
                    type="button"
                    className="hdr__trigger"
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                    aria-controls={menuId}
                    onClick={onTriggerClick(i)}
                    ref={(el) => {
                      triggerRefs.current[i] = el
                    }}
                  >
                    {item.label}
                    <ChevronDown size={16} className="hdr__chev" />
                  </button>
                  <div
                    id={menuId}
                    className={clsx('hdr__menu', isOpen && 'is-open')}
                    data-theme="light"
                    aria-label={item.label}
                    inert={!isOpen}
                    ref={(el) => {
                      menuRefs.current[i] = el
                    }}
                  >
                    <Columns columns={item.columns ?? []} onNavigate={closeMenu} />
                    {item.cta && <CtaCard cta={item.cta} onNavigate={closeMenu} />}
                  </div>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* ---------------- center wordmark ---------------- */}
        <a
          className={clsx('hdr__logo', showLogo && 'is-visible')}
          href="#"
          tabIndex={showLogo ? 0 : -1}
          aria-hidden={!showLogo}
        >
          <Wordmark />
        </a>

        {/* ---------------- right actions ---------------- */}
        <div className="hdr__actions">
          <Button variant="tertiary" href={nav.login.href} className="hdr__login">
            {nav.login.label}
          </Button>
          <Button variant="primary" href={nav.primary.href}>
            {nav.primary.label}
          </Button>
          <Button variant="secondary" href={nav.secondary.href} className="hdr__secondary">
            {nav.secondary.label}
          </Button>
          <button
            type="button"
            className="hdr__iconbtn hdr__burger"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="hdr-mobile-menu"
            onClick={toggleMobile}
            ref={burgerRef}
          >
            {mobileOpen ? <Close size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* ---------------- mobile menu (≤768) ---------------- */}
      <div
        id="hdr-mobile-menu"
        className={clsx('hdr__mobile', mobileOpen && 'is-open')}
        data-theme="light"
        data-lenis-prevent=""
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
      >
        <div className="hdr__m-inner">
          <div className="hdr__m-top">
            <a href="#" className="hdr__m-logo" onClick={closeMobile}>
              <Wordmark />
            </a>
            <button type="button" className="hdr__iconbtn" aria-label="Close menu" onClick={closeMobile} ref={closeRef}>
              <Close size={18} />
            </button>
          </div>

          <ul className="hdr__m-list">
            {nav.items.map((item, i) => {
              const hasMenu = !!item.columns?.length
              if (!hasMenu) {
                return (
                  <li className="hdr__m-row" key={item.label}>
                    <a className="hdr__m-trigger" href={item.href} onClick={closeMobile}>
                      {item.label}
                    </a>
                  </li>
                )
              }
              const expanded = mobileExpanded === i
              const subId = `hdr-m-sub-${i}`
              return (
                <li className="hdr__m-row" key={item.label}>
                  <button
                    type="button"
                    className="hdr__m-trigger"
                    aria-expanded={expanded}
                    aria-controls={subId}
                    onClick={() => setMobileExpanded((cur) => (cur === i ? null : i))}
                  >
                    {item.label}
                    <ChevronDown size={16} className="hdr__chev" />
                  </button>
                  <div id={subId} className={clsx('hdr__m-sub', expanded && 'is-open')} inert={!expanded}>
                    <div className="hdr__m-sub-inner">
                      <Columns columns={item.columns ?? []} onNavigate={closeMobile} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          {/* The bar's tertiary "Members" link is hidden at ≤768, so the panel carries it as a
              full-width row above the two CTAs. Layout overrides are inline because this file
              owns no stylesheet of its own: they lift the footer's 50 % button split for this
              one row (flex-wrap on the footer, full basis + left alignment on the link). */}
          <div className="hdr__m-footer" style={MOBILE_FOOTER_STYLE}>
            <Button
              variant="tertiary"
              href={nav.login.href}
              onClick={closeMobile}
              className="hdr__m-login"
              style={MOBILE_LOGIN_STYLE}
            >
              {nav.login.label}
            </Button>
            <Button variant="primary" href={nav.primary.href} onClick={closeMobile}>
              {nav.primary.label}
            </Button>
            <Button variant="secondary" href={nav.secondary.href} onClick={closeMobile}>
              {nav.secondary.label}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
