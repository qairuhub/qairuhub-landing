import clsx from 'clsx'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import { Close, Send, Stop } from '../components/ui/icons'
import { useRoute, useT } from '../i18n/LocaleProvider'
import Answer from './Answer'
import Announcer from './Announcer'
import { askText } from './assistant.i18n'
import { panelText } from './panel.i18n'
import { SnailQ, SNAIL_NAVY } from './SnailQ'
import { ask, closePanel, preloadClient, reset, stop, useAssistant } from './store'
import './Panel.css'

/**
 * Q's floating chat panel (CONTENT-V3 §19, AGENT-SPEC §11). Lazy chunk, mounted by
 * AssistantLauncher only while open.
 *
 * - `role="dialog"` + `aria-modal`, labelled by the title; focus lands in the input on open, Tab
 *   is trapped inside, Esc closes and returns focus to the launcher; a pointer press outside the
 *   panel (and the launcher) closes it without moving focus.
 * - Greeting, then the three suggestions (empty thread only) and the disclaimer; the thread is the
 *   one the Ask bar writes to. The polite live region announces only finished answers.
 * - Solid surface, no backdrop-filter (it would re-blur over the WebGL canvas every frame).
 */

const STICK_PX = 48
const INPUT_MAX_PX = 120

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Assistant({ launcherRef }: { launcherRef: RefObject<HTMLButtonElement | null> }) {
  const { locale } = useRoute()
  const t = useT(panelText)
  const at = useT(askText)
  const { messages, activeId } = useAssistant()
  const [value, setValue] = useState('')

  const panelRef = useRef<HTMLDivElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const actionRef = useRef<HTMLButtonElement | null>(null)
  const turnstileRef = useRef<HTMLDivElement | null>(null)
  const stick = useRef(true)
  const parked = useRef(false)
  const busy = activeId !== null

  const close = useCallback(
    (returnFocus: boolean) => {
      closePanel()
      if (returnFocus) launcherRef.current?.focus({ preventScroll: true })
    },
    [launcherRef],
  )

  // Open: focus the input, warm the client (Turnstile config), start at the latest message.
  // Opened mid-answer ("Continue in chat" while streaming) the input is disabled, so focus parks
  // on the Stop button inside the dialog and returns to the input once the answer settles.
  useEffect(() => {
    preloadClient()
    const input = inputRef.current
    if (input && !input.disabled) {
      input.focus({ preventScroll: true })
    } else {
      parked.current = true
      ;(actionRef.current ?? panelRef.current)?.focus({ preventScroll: true })
    }
    const body = bodyRef.current
    if (body) body.scrollTop = body.scrollHeight
  }, [])

  // A press outside the panel and the launcher closes it (focus stays where the user pressed).
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (!target || panelRef.current?.contains(target) || launcherRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('[data-turnstile-host]')) return
      closePanel()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [launcherRef])

  // Keep the newest text in view while the reader sits at the bottom.
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (body && stick.current) body.scrollTop = body.scrollHeight
  }, [messages])
  useEffect(() => {
    const body = bodyRef.current
    const content = contentRef.current
    if (!body || !content || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (stick.current) body.scrollTop = body.scrollHeight
    })
    ro.observe(content)
    return () => ro.disconnect()
  }, [])

  // Hand focus back to the input after an answer typed there settles.
  const wasBusy = useRef(false)
  useEffect(() => {
    if (wasBusy.current && !busy) {
      if (parked.current && document.activeElement === actionRef.current) inputRef.current?.focus({ preventScroll: true })
      parked.current = false
    }
    wasBusy.current = busy
  }, [busy])

  const resize = () => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_PX)}px`
  }

  const send = (text: string) => {
    const q = text.trim()
    if (!q) {
      inputRef.current?.focus()
      return
    }
    parked.current = document.activeElement === inputRef.current
    if (panelRef.current?.contains(document.activeElement)) actionRef.current?.focus({ preventScroll: true })
    stick.current = true
    ask(q, { locale, container: turnstileRef.current })
    setValue('')
    requestAnimationFrame(resize)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (busy) stop()
    else send(value)
  }

  const onInputKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (!busy) send(value)
    }
  }

  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close(true)
      return
    }
    if (e.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || !panel.contains(active))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
      e.preventDefault()
      first.focus()
    }
  }

  const onReset = () => {
    reset()
    setValue('')
    inputRef.current?.focus({ preventScroll: true })
  }

  return (
    <div
      ref={panelRef}
      className="qa-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qa-panel-title"
      tabIndex={-1}
      data-theme="dark"
      onKeyDown={onPanelKey}
    >
      <div className="qa-panel__head">
        <span className="qa-panel__avatar" aria-hidden="true">
          <SnailQ size={24} color={SNAIL_NAVY} />
        </span>
        <h2 id="qa-panel-title" className="qa-panel__title">
          {t.title}
        </h2>
        {messages.length > 0 && (
          <button type="button" className="qa-panel__reset" onClick={onReset}>
            {t.reset}
          </button>
        )}
        <button type="button" className="qa-icon-btn" aria-label={t.close} onClick={() => close(true)}>
          <Close size={18} />
        </button>
      </div>

      <div
        ref={bodyRef}
        className="qa-panel__body"
        data-lenis-prevent=""
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX
        }}
      >
        <div ref={contentRef} className="qa-panel__content">
          <div className="qa-msg qa-msg--bot">
            <p className="qa-greeting">{t.greeting}</p>
          </div>
          {messages.length === 0 && (
            <div className="qa-suggest" role="group" aria-label={at.suggestionsLabel}>
              {t.suggestions.map((s) => (
                <button key={s} type="button" className="ask__chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <p className="qa-disclaimer">{t.disclaimer}</p>
          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="qa-msg qa-msg--user">
                <p>{m.text}</p>
              </div>
            ) : (
              <div key={m.id} className="qa-msg qa-msg--bot">
                <Answer message={m} onInternalLink={() => close(false)} />
              </div>
            ),
          )}
        </div>
      </div>

      <form className="qa-panel__form" onSubmit={onSubmit}>
        <div ref={turnstileRef} className="qa-turnstile" />
        <div className="qa-panel__row">
          <textarea
            ref={inputRef}
            className="qa-panel__input"
            rows={1}
            name="question"
            enterKeyHint="send"
            maxLength={500}
            aria-label={at.label}
            placeholder={t.placeholder}
            value={value}
            disabled={busy}
            onChange={(e) => {
              setValue(e.target.value)
              resize()
            }}
            onKeyDown={onInputKey}
          />
          <button
            ref={actionRef}
            type="submit"
            className={clsx('ask__action', busy && 'is-stop')}
            aria-label={busy ? at.stop : t.send}
          >
            {busy ? <Stop size={16} /> : <Send size={16} />}
          </button>
        </div>
      </form>
      <Announcer />
    </div>
  )
}
