import clsx from 'clsx'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type SyntheticEvent,
} from 'react'
import { Button } from '../components/ui/Button'
import { Wordmark } from '../components/ui/Wordmark'
import { ArrowUpRight, ChevronDown, Close, Menu, icons } from '../components/ui/icons'
import { useRoute, useT } from '../i18n/LocaleProvider'
import { LOCALE_STORAGE_KEY, href, switchLocaleHref, type Locale, type Route } from '../i18n/locale'
import { scrollToAnchor, useLenis } from '../lib/SmoothScroll'
import { scrollState } from '../lib/scroll'
import { useTick } from '../lib/ticker'
import { footerWordmarkWeight, heroWordmarkWeight, journey } from './sky/journey'
import {
  ACTIONS,
  NAV,
  NAV_ORDER,
  text as headerText,
  type NavLink,
  type NavMenuDef,
  type SubText,
} from './header.i18n'
import './Header.css'

/**
 * Mouse-leave grace before a mega menu closes. The label's bottom edge (y 52) and the panel's
 * hover bridge (y 56–88) leave a thin dead band, and the between-label gaps are outside every
 * <li>: a diagonal move from a label toward the panel's last item crosses ~40px of that at
 * ~150px/s (≈270ms), so the grace must comfortably outlast it.
 */
const HOVER_GRACE_MS = 300
/**
 * The DOM wordmark is hidden whenever the 3D glass lettering is on screen (hero or footer run),
 * exactly like the reference: it shows only while both journey presences are below this.
 */
const LOGO_HIDE_AT = 0.05

/**
 * Window event that asks the assistant launcher (WP3) to open its panel.
 */
export const ASSISTANT_OPEN_EVENT = 'qh:assistant-open'
/**
 * Attribute set on <html> while the mobile nav panel is open, so the floating assistant launcher
 * (WP3) can hide itself with CSS: `html[data-nav-open] .q-launcher { … }`.
 */
export const NAV_OPEN_ATTR = 'data-nav-open'

/**
 * First width at which the full nav bar returns (Header.css "Burger mode"). Kazakh labels run
 * ~50% longer, so KK keeps the burger up to 1023px.
 */
const BURGER_EXIT_QUERY: Record<Locale, string> = {
  en: '(min-width: 769px)',
  kk: '(min-width: 1024px)',
}

/** Tabbable elements considered by the mobile panel's focus trap. */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/* ------------------------------------------------------------------ links */
function resolveLink(route: Route, link: NavLink): { href: string; external: boolean } {
  return link.kind === 'ext' ? { href: link.href, external: true } : { href: href(route, link.to), external: false }
}

/** `target` / `rel` for an external link (new tab, no opener, no referrer). */
function extProps(external: boolean) {
  return external ? { target: '_blank', rel: 'noopener noreferrer' } : {}
}

/* ------------------------------------------------------------------ locale switch */
/**
 * Segmented `EN | ҚАЗ` control: two plain links (a locale switch is a full navigation, plan D1).
 * Each points at the same page in its locale and keeps the current hash, which can change
 * without a re-render (Lenis pushes anchors), so the href is refreshed from `location.hash`
 * right before it can be followed (hover, focus, pointer down, click). The choice is stored in
 * `localStorage['qh.locale']` for main.tsx's bare-`/` redirect. Announced as
 * "Language, group · EN, current".
 */
export function LocaleSwitch({ className }: { className?: string }) {
  const route = useRoute()
  const t = useT(headerText).localeSwitch

  const refresh = (to: Locale) => (e: SyntheticEvent<HTMLAnchorElement>) => {
    e.currentTarget.setAttribute('href', switchLocaleHref(route, to, window.location.hash))
  }
  const onClick = (to: Locale) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (to === route.locale) {
      // already here: nothing to navigate to
      e.preventDefault()
      return
    }
    refresh(to)(e)
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, to)
    } catch {
      /* storage blocked: the switch still navigates */
    }
  }

  const option = (to: Locale, label: string, title: string) => {
    const current = to === route.locale
    return (
      <a
        className={clsx('lsw__opt', current && 'is-current')}
        href={switchLocaleHref(route, to)}
        hrefLang={to}
        lang={to}
        title={title}
        aria-current={current ? 'true' : undefined}
        onMouseEnter={refresh(to)}
        onFocus={refresh(to)}
        onPointerDown={refresh(to)}
        onClick={onClick(to)}
      >
        {label}
      </a>
    )
  }

  return (
    <div className={clsx('lsw', className)} role="group" aria-label={t.label}>
      {option('en', t.en, t.enTitle)}
      {option('kk', t.kk, t.kkTitle)}
    </div>
  )
}

/* ------------------------------------------------------------------ menu parts */
function SubItem({
  sub,
  def,
  index,
  newTab,
  onNavigate,
}: {
  sub: SubText
  def: NavMenuDef<string>['items'][string]
  index: number
  newTab: string
  onNavigate: () => void
}) {
  const route = useRoute()
  const Icon = icons[def.icon]
  const { href: to, external } = resolveLink(route, def.link)
  return (
    <li>
      <a
        className="hdr__sub"
        href={to}
        {...extProps(external)}
        style={{ '--i': index } as CSSProperties}
        onClick={onNavigate}
      >
        <span className="hdr__sub-icon" aria-hidden="true">
          <Icon size={16} />
        </span>
        <span className="hdr__sub-text">
          <span className="hdr__sub-title">
            {sub.title}
            {external && <ArrowUpRight size={14} />}
          </span>
          <span className="hdr__sub-desc">{sub.description}</span>
          {external && <span className="sr-only"> {newTab}</span>}
        </span>
      </a>
    </li>
  )
}

function Column({
  def,
  items,
  newTab,
  onNavigate,
}: {
  def: NavMenuDef<string>
  items: Record<string, SubText>
  newTab: string
  onNavigate: () => void
}) {
  return (
    <ul className="hdr__col">
      {Object.keys(def.items).map((key, i) => (
        <SubItem key={key} sub={items[key]} def={def.items[key]} index={i} newTab={newTab} onNavigate={onNavigate} />
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ header */
export default function Header() {
  const route = useRoute()
  const t = useT(headerText)
  const isHome = route.page === 'home'
  const lenis = useLenis()
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileExpanded, setMobileExpanded] = useState<number | null>(null)
  // sub-pages have no 3D wordmark run: the DOM logo is always there
  const [showLogo, setShowLogo] = useState(!isHome)

  const logoVisibleRef = useRef(!isHome)
  const navRef = useRef<HTMLElement>(null)
  const burgerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const mobileRef = useRef<HTMLDivElement>(null)
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([])
  const menuRefs = useRef<(HTMLDivElement | null)[]>([])
  const graceRef = useRef<number | null>(null)
  /** last known mouse position while a mega menu is open (viewport px); null = unknown */
  const pointerRef = useRef<{ x: number; y: number } | null>(null)

  /* --- wordmark visibility (home only): driven by the journey, state flips only on change --- */
  useTick(() => {
    const vh = Math.max(1, window.innerHeight)
    const y = scrollState.y / vh
    // `journey` is written by SkyScene's frame loop. While that loop is not running (chunk still
    // loading, tab hidden, no WebGL) it keeps its last values, so evaluate the very same curves
    // (journey.ts exports) from the scroll position: the DOM wordmark must still appear once the
    // hero has scrolled away even without the 3D run.
    const live = Math.abs(journey.vh - y) < 0.25
    const end = Math.max(4, scrollState.limit / vh)
    const hero = live ? journey.wordmarkHero : heroWordmarkWeight(y)
    const footer = live ? journey.wordmarkFooter : footerWordmarkWeight(y, end)
    const next = hero < LOGO_HIDE_AT && footer < LOGO_HIDE_AT
    if (next !== logoVisibleRef.current) {
      logoVisibleRef.current = next
      setShowLogo(next)
    }
  }, isHome)

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
   * when it leaves a label sideways and heads for a column or the CTA card.
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

  // lock page scroll while the mobile panel is open; move focus into the panel and keep it there
  // (Tab / Shift+Tab wrap inside it); flag <html> so the floating assistant launcher steps aside
  useEffect(() => {
    if (!mobileOpen) return
    lenis?.stop()
    const root = document.documentElement
    root.setAttribute(NAV_OPEN_ATTR, '')
    const t = window.setTimeout(() => closeRef.current?.focus(), 60)
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const panel = mobileRef.current
      if (!panel) return
      // visible and not inside a collapsed (inert) sub-list
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => !el.closest('[inert]') && el.getClientRects().length > 0,
      )
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      const inside = active instanceof Node && panel.contains(active)
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onTab)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onTab)
      root.removeAttribute(NAV_OPEN_ATTR)
      lenis?.start()
    }
  }, [mobileOpen, lenis])

  // leaving burger mode closes the panel (Header.css: EN ≤ 768, KK ≤ 1023)
  useEffect(() => {
    const mq = window.matchMedia(BURGER_EXIT_QUERY[route.locale])
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) closeMobile()
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [closeMobile, route.locale])

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
    const target = e.target as HTMLElement
    if (target.matches(':focus-visible')) openAt(i)
  }
  const onItemBlur = (i: number) => (e: FocusEvent<HTMLLIElement>) => {
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    setOpenMenu((cur) => (cur === i ? null : cur))
  }

  /* --- logo: the locale home; on home itself it glides back to the top instead of reloading --- */
  const onLogoClick = (e: MouseEvent<HTMLAnchorElement>) => {
    closeMobile()
    if (!isHome || !lenis) return
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    scrollToAnchor(lenis, '#', { push: true })
  }

  const members = resolveLink(route, ACTIONS.members)
  const join = resolveLink(route, ACTIONS.join)
  const platform = resolveLink(route, ACTIONS.openPlatform)

  return (
    <header
      className={clsx('hdr', mobileOpen && 'is-mobile-open', !isHome && 'hdr--sub')}
      data-locale={route.locale}
      data-page={route.page}
    >
      <div className="hdr__shade" aria-hidden="true" />

      <div className="grid-air grid-air--hero hdr__inner">
        {/* ---------------- left nav (≥769) ---------------- */}
        <nav className="hdr__nav" aria-label={t.a11y.primaryNav} ref={navRef}>
          <ul className="hdr__list">
            {NAV_ORDER.map((key, i) => {
              const item = NAV[key]
              const label = t.nav[key].label
              if (!('menu' in item)) {
                return (
                  <li className="hdr__item" key={key}>
                    <a className="hdr__link" href={resolveLink(route, item.link).href}>
                      {label}
                    </a>
                  </li>
                )
              }
              const menuText = t.nav[key as 'platform' | 'about']
              const menuDef = item.menu as NavMenuDef<string>
              const isOpen = openMenu === i
              const menuId = `hdr-menu-${key}`
              return (
                <li
                  className="hdr__item"
                  key={key}
                  onMouseEnter={() => openAt(i)}
                  onMouseLeave={() => closeSoon(i)}
                  onFocus={onItemFocus(i)}
                  onBlur={onItemBlur(i)}
                >
                  <button
                    type="button"
                    className="hdr__trigger"
                    aria-expanded={isOpen}
                    aria-controls={menuId}
                    onClick={onTriggerClick(i)}
                    ref={(el) => {
                      triggerRefs.current[i] = el
                    }}
                  >
                    {label}
                    <ChevronDown size={16} className="hdr__chev" />
                  </button>
                  <div
                    id={menuId}
                    className={clsx('hdr__menu', isOpen && 'is-open')}
                    data-theme="light"
                    role="group"
                    aria-label={label}
                    inert={!isOpen}
                    ref={(el) => {
                      menuRefs.current[i] = el
                    }}
                  >
                    <Column
                      def={menuDef}
                      items={menuText.items as Record<string, SubText>}
                      newTab={t.a11y.newTab}
                      onNavigate={closeMenu}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* ---------------- wordmark (centred on wide screens) ---------------- */}
        <a
          className={clsx('hdr__logo', showLogo && 'is-visible')}
          href={route.base}
          aria-label={t.a11y.home}
          tabIndex={showLogo ? 0 : -1}
          aria-hidden={!showLogo}
          onClick={onLogoClick}
        >
          <Wordmark decorative />
        </a>

        {/* ---------------- right actions ---------------- */}
        <div className="hdr__actions">
          <LocaleSwitch className="hdr__lsw" />
          <Button variant="tertiary" href={members.href} className="hdr__login" active={route.page === 'members'}>
            {t.actions.members}
          </Button>
          <Button
            variant="primary"
            href={platform.href}
            external
            newTabLabel={t.a11y.newTab}
            className="hdr__primary"
            iconRight={<ArrowUpRight size={14} />}
          >
            {t.actions.openPlatform}
          </Button>
          <button
            type="button"
            className="hdr__iconbtn hdr__burger"
            aria-label={mobileOpen ? t.a11y.closeMenu : t.a11y.openMenu}
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
        ref={mobileRef}
      >
        <div className="hdr__m-inner">
          <div className="hdr__m-top">
            <a href={route.base} className="hdr__m-logo" aria-label={t.a11y.home} onClick={onLogoClick}>
              <Wordmark decorative />
            </a>
            <div className="hdr__m-tools">
              <LocaleSwitch />
              <button
                type="button"
                className="hdr__iconbtn"
                aria-label={t.a11y.closeMenu}
                onClick={closeMobile}
                ref={closeRef}
              >
                <Close size={18} />
              </button>
            </div>
          </div>

          <ul className="hdr__m-list">
            {NAV_ORDER.map((key, i) => {
              const item = NAV[key]
              const label = t.nav[key].label
              if (!('menu' in item)) {
                return (
                  <li className="hdr__m-row" key={key}>
                    <a className="hdr__m-trigger" href={resolveLink(route, item.link).href} onClick={closeMobile}>
                      {label}
                    </a>
                  </li>
                )
              }
              const menuText = t.nav[key as 'platform' | 'about']
              const menuDef = item.menu as NavMenuDef<string>
              const expanded = mobileExpanded === i
              const subId = `hdr-m-sub-${key}`
              return (
                <li className="hdr__m-row" key={key}>
                  <button
                    type="button"
                    className="hdr__m-trigger"
                    aria-expanded={expanded}
                    aria-controls={subId}
                    onClick={() => setMobileExpanded((cur) => (cur === i ? null : i))}
                  >
                    {label}
                    <ChevronDown size={16} className="hdr__chev" />
                  </button>
                  <div id={subId} className={clsx('hdr__m-sub', expanded && 'is-open')} inert={!expanded}>
                    <div className="hdr__m-sub-inner">
                      <Column
                        def={menuDef}
                        items={menuText.items as Record<string, SubText>}
                        newTab={t.a11y.newTab}
                        onNavigate={closeMobile}
                      />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="hdr__m-footer">
            <Button variant="tertiary" href={members.href} onClick={closeMobile} className="hdr__m-login">
              {t.actions.members}
            </Button>
            <Button
              variant="primary"
              href={platform.href}
              external
              newTabLabel={t.a11y.newTab}
              onClick={closeMobile}
              iconRight={<ArrowUpRight size={14} />}
            >
              {t.actions.openPlatform}
            </Button>
            <Button variant="secondary" href={join.href} onClick={closeMobile}>
              {t.actions.join}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
