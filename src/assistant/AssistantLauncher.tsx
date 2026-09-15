import clsx from 'clsx'
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../i18n/LocaleProvider'
import { launcherText } from './assistant.i18n'
import { SnailQ, SNAIL_NAVY } from './SnailQ'
import { closePanel, getState, openPanel, useAssistantValue } from './store'
import './Assistant.css'

/**
 * The floating "Ask Q" launcher (DECISIONS §7, AGENT-SPEC §11, CONTENT-V3 §19), mounted once on
 * every page by App.tsx. A 56 px white disc with the navy snail, bottom-right inside the safe
 * area, a soft ring on hover, a 3 s idle bob (off under reduced motion), the "Ask Q" label on
 * hover/focus and a one-time "Questions? Ask Q." hint (after 8 s, desktop pointers only).
 *
 * The panel (`Assistant.tsx` + Answer/Markdown) is a lazy chunk requested on the first hover,
 * focus or click; the network client is requested with it, Turnstile only once a question input
 * is focused.
 *
 * Opening from elsewhere (contract for other sections and pages):
 *   - `window.dispatchEvent(new CustomEvent('qh:assistant-open'))` (Header's About → "Ask Q"), or
 *   - any clicked element with a `data-assistant-open` attribute (e.g. the Handbook "Ask Q" button).
 *   When that click also navigates to another document (a sub-page link to `/#launchpad`), the
 *   intent is carried over in sessionStorage and the panel opens on arrival.
 *
 * Steps aside for the mobile nav (`html[data-nav-open]`, set by Header) and lifts itself above
 * footer controls it would otherwise cover (footer socials at 390 px).
 */

export const ASSISTANT_OPEN_EVENT = 'qh:assistant-open'
export const ASSISTANT_OPEN_ATTR = 'data-assistant-open'

const loadPanel = () => import('./Assistant')
const Assistant = lazy(loadPanel)
/** The live region (and its strings) loads with the first question, like the answer view. */
const Announcer = lazy(() => import('./Announcer'))

const INTENT_KEY = 'qh.ask.open'
const INTENT_ARM_MS = 2500
const INTENT_MAX_AGE_MS = 10_000
const HINT_KEY = 'qh.ask.hint'
const HINT_DELAY_MS = 8000
const HINT_VISIBLE_MS = 7000
const HINT_QUERY = '(hover: hover) and (pointer: fine) and (min-width: 769px)'
const AVOID_SELECTOR = '[data-assistant-avoid], #footer a, #footer button, #footer p'
const AVOID_GAP = 12

function takeIntent(): boolean {
  try {
    const raw = window.sessionStorage.getItem(INTENT_KEY)
    if (!raw) return false
    window.sessionStorage.removeItem(INTENT_KEY)
    return Date.now() - Number(raw) < INTENT_MAX_AGE_MS
  } catch {
    return false
  }
}

export default function AssistantLauncher() {
  const t = useT(launcherText)
  const panelOpen = useAssistantValue((s) => s.panelOpen)
  const hasThread = useAssistantValue((s) => s.messages.length > 0)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const fabRef = useRef<HTMLDivElement | null>(null)
  const [hint, setHint] = useState(false)

  const warm = useCallback(() => {
    void loadPanel()
    void import('./sseClient')
  }, [])

  const open = useCallback(() => {
    warm()
    setHint(false)
    openPanel()
  }, [warm])

  /* ---- open requests: window event, [data-assistant-open] clicks, intent from the previous page */
  useEffect(() => {
    let armedUntil = 0
    const onPageHide = () => {
      if (Date.now() > armedUntil) return
      try {
        window.sessionStorage.setItem(INTENT_KEY, String(Date.now()))
      } catch {
        /* ignore */
      }
    }
    const request = () => {
      armedUntil = Date.now() + INTENT_ARM_MS
      open()
    }
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target.closest(`[${ASSISTANT_OPEN_ATTR}]`) : null
      if (el) request()
    }
    window.addEventListener(ASSISTANT_OPEN_EVENT, request)
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('click', onClick)
    if (takeIntent()) open()
    return () => {
      window.removeEventListener(ASSISTANT_OPEN_EVENT, request)
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('click', onClick)
    }
  }, [open])

  /* ---- one-time hint: once per visitor, after 8 s, never on touch / narrow screens */
  useEffect(() => {
    if (typeof window.matchMedia !== 'function' || !window.matchMedia(HINT_QUERY).matches) return
    try {
      if (window.localStorage.getItem(HINT_KEY)) return
    } catch {
      return
    }
    const timer = window.setTimeout(() => {
      const s = getState()
      if (s.panelOpen || s.messages.length) return
      setHint(true)
      try {
        window.localStorage.setItem(HINT_KEY, '1')
      } catch {
        /* ignore */
      }
    }, HINT_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])
  useEffect(() => {
    if (!hint) return
    const timer = window.setTimeout(() => setHint(false), HINT_VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [hint])

  /* ---- lift above footer controls while the footer is on screen */
  useEffect(() => {
    const fab = fabRef.current
    const footer = document.getElementById('footer')
    if (!fab || !footer || typeof IntersectionObserver === 'undefined') return
    let lift = 0
    let raf = 0
    let targets: Element[] = []
    const apply = (next: number) => {
      if (Math.abs(next - lift) < 0.5) return
      lift = next
      fab.style.setProperty('--qa-lift', `${Math.round(lift)}px`)
    }
    const measure = () => {
      raf = 0
      const btn = btnRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const top = r.top + lift
      const bottom = r.bottom + lift
      const boxes = targets
        .map((el) => el.getBoundingClientRect())
        .filter((box) => box.width && box.height && box.right > r.left - AVOID_GAP && box.left < r.right + AVOID_GAP)
      // Lift until the launcher clears every control; a lift can land on the next row up, so repeat.
      let next = 0
      for (let pass = 0; pass < 8; pass++) {
        let changed = false
        for (const box of boxes) {
          if (box.bottom > top - next - AVOID_GAP && box.top < bottom - next + AVOID_GAP) {
            const need = bottom - box.top + AVOID_GAP
            if (need > next) {
              next = need
              changed = true
            }
          }
        }
        if (!changed) break
      }
      apply(next)
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    let listening = false
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !listening) {
          listening = true
          targets = [...document.querySelectorAll(AVOID_SELECTOR)]
          window.addEventListener('scroll', schedule, { passive: true })
          window.addEventListener('resize', schedule, { passive: true })
          // footer rows reveal with a transform: re-measure once they settle, not only on scroll
          footer.addEventListener('transitionend', schedule)
          schedule()
        } else if (!entry.isIntersecting && listening) {
          listening = false
          window.removeEventListener('scroll', schedule)
          window.removeEventListener('resize', schedule)
          footer.removeEventListener('transitionend', schedule)
          apply(0)
        }
      },
      { rootMargin: '0px 0px 120px 0px' },
    )
    io.observe(footer)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      footer.removeEventListener('transitionend', schedule)
    }
  }, [])

  return (
    <>
      {panelOpen && (
        <Suspense fallback={null}>
          <Assistant launcherRef={btnRef} />
        </Suspense>
      )}
      <div ref={fabRef} className={clsx('qa-fab', panelOpen && 'is-open')}>
        {hint && !panelOpen && (
          <p className="qa-hint" aria-hidden="true">
            {t.hint}
          </p>
        )}
        <button
          ref={btnRef}
          type="button"
          className="qa-fab__btn"
          aria-label={t.launcher}
          aria-haspopup="dialog"
          aria-expanded={panelOpen}
          onPointerEnter={warm}
          onFocus={warm}
          onClick={() => (getState().panelOpen ? closePanel() : open())}
        >
          <span className="qa-fab__disc">
            <SnailQ size={38} color={SNAIL_NAVY} />
          </span>
          <span className="qa-fab__label" aria-hidden="true">
            {t.label}
          </span>
        </button>
      </div>
      {!panelOpen && hasThread && (
        <Suspense fallback={null}>
          <Announcer />
        </Suspense>
      )}
    </>
  )
}
