import clsx from 'clsx'
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import { Button } from '../components/ui/Button'
import { useInView } from '../components/ui/Reveal'
import { Send, Sparkle, Stop } from '../components/ui/icons'
import { useRoute, useT } from '../i18n/LocaleProvider'
import { links } from '../i18n/shared'
import { useDocumentVisible, useReducedMotion } from '../lib/media'
import { askText } from './assistant.i18n'
import { ask, openPanel, preloadClient, stop, useAssistant } from './store'
import './Assistant.css'

/**
 * The Launchpad Ask bar (CONTENT-V3 §4.2–§4.3, AGENT-SPEC §11): a solid card (no blur) with the
 * input, Send/Stop, six suggestion chips and the note. While the input is empty, unfocused and
 * idle, a typewriter cycles the suggestions in place of the placeholder. An answer to a question
 * asked here renders inline under the bar (max-height 360, scrolls) with its Handbook sources,
 * "Continue in chat" (opens the panel on the same thread) and "Ask something else".
 *
 * The answer view (Answer + Markdown) and the network client are lazy chunks, warmed on the first
 * focus or hover; Turnstile's config is requested on the first focus only.
 */

const Answer = lazy(() => import('./Answer'))

type Phase = 'idle' | 'typing' | 'holding' | 'collapsing'
const PHASE_MS: Record<Exclude<Phase, 'idle'>, number> = { typing: 800, holding: 2200, collapsing: 400 }
const START_DELAY_MS = 400
const REDUCED_CYCLE_MS = 3400

/* ------------------------------------------------------------------ typewriter */

function Typewriter({
  prompts,
  running,
  hidden,
  reduced,
  onIndex,
}: {
  prompts: readonly string[]
  running: boolean
  /** stays mounted while hidden, so the cycle resumes where it was */
  hidden: boolean
  reduced: boolean
  onIndex?: (index: number) => void
}) {
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [width, setWidth] = useState(0)
  const textRef = useRef<HTMLSpanElement | null>(null)
  const n = prompts.length

  useLayoutEffect(() => {
    const el = textRef.current
    if (el) setWidth(el.offsetWidth)
  }, [idx, prompts])

  useEffect(() => {
    onIndex?.(idx)
  }, [idx, onIndex])

  // Leaving the running state collapses instantly, so the next start types in from zero.
  useEffect(() => {
    if (!running) setPhase('idle')
  }, [running])

  useEffect(() => {
    if (!running || !n) return
    if (reduced) {
      const t = window.setTimeout(() => setIdx((i) => (i + 1) % n), REDUCED_CYCLE_MS)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(
      () => {
        if (phase === 'idle') setPhase('typing')
        else if (phase === 'typing') setPhase('holding')
        else if (phase === 'holding') setPhase('collapsing')
        else {
          setIdx((i) => (i + 1) % n)
          setPhase('typing')
        }
      },
      phase === 'idle' ? START_DELAY_MS : PHASE_MS[phase],
    )
    return () => window.clearTimeout(t)
  }, [running, reduced, phase, n, idx])

  const open = reduced || phase === 'typing' || phase === 'holding'
  return (
    <span
      className={clsx('ask__tw', open && 'is-open', reduced && 'is-reduced', hidden && 'is-hidden')}
      style={{ '--w': `${width}px` } as CSSProperties}
      aria-hidden="true"
    >
      <span ref={textRef} className="ask__tw-text">
        {prompts[idx]}
      </span>
      <span className="ask__tw-caret" />
    </span>
  )
}

/* ------------------------------------------------------------------ note with its channel link */

function Note({ text, newTab }: { text: string; newTab: string }) {
  const marker = 't.me/qairuhub'
  const at = text.indexOf(marker)
  if (at < 0) return <p className="ask__note">{text}</p>
  return (
    <p className="ask__note">
      {text.slice(0, at)}
      <a href={links.telegram} target="_blank" rel="noopener noreferrer">
        {marker}
        <span className="sr-only"> {newTab}</span>
      </a>
      {text.slice(at + marker.length)}
    </p>
  )
}

/* ------------------------------------------------------------------ bar */

export interface AskBarProps {
  /** index of the suggestion the typewriter shows (drives the Launchpad's active card) */
  onPromptChange?: (index: number) => void
}

export default function AskBar({ onPromptChange }: AskBarProps) {
  const { locale } = useRoute()
  const t = useT(askText)
  const reduced = useReducedMotion()
  const docVisible = useDocumentVisible()
  const { messages, activeId } = useAssistant()
  const { ref: rootRef, inView } = useInView<HTMLDivElement>({ once: false, threshold: 0, rootMargin: '0px' })

  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [inlineId, setInlineId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const actionRef = useRef<HTMLButtonElement | null>(null)
  const turnstileRef = useRef<HTMLDivElement | null>(null)
  const warmed = useRef(false)
  const parked = useRef(false)

  const answerIndex = inlineId ? messages.findIndex((m) => m.id === inlineId) : -1
  const answer = answerIndex >= 0 ? messages[answerIndex] : null
  const question = answerIndex > 0 ? messages[answerIndex - 1] : null
  const busy = activeId !== null && activeId === inlineId
  const settled = !!answer && answer.status !== 'pending' && answer.status !== 'streaming'

  const warm = useCallback((withNetwork: boolean) => {
    void import('./Answer')
    if (withNetwork && !warmed.current) {
      warmed.current = true
      preloadClient()
    }
  }, [])

  const submit = useCallback(
    (text: string) => {
      const q = text.trim()
      if (!q) {
        inputRef.current?.focus()
        return
      }
      warm(true)
      // Keep keyboard focus alive: the input is disabled and the chips unmount while it streams.
      // Only a question typed in the input gets focus handed back to the input afterwards.
      parked.current = document.activeElement === inputRef.current
      if (rootRef.current?.contains(document.activeElement)) actionRef.current?.focus({ preventScroll: true })
      const id = ask(q, { locale, container: turnstileRef.current })
      setInlineId(id || null)
      setValue('')
    },
    [locale, warm, rootRef],
  )

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (busy) stop()
    else submit(value)
  }

  // When the answer settles, hand focus back to the input if it was parked on Send/Stop.
  const wasBusy = useRef(false)
  useEffect(() => {
    if (wasBusy.current && !busy) {
      if (parked.current && document.activeElement === actionRef.current) inputRef.current?.focus({ preventScroll: true })
      parked.current = false
    }
    wasBusy.current = busy
  }, [busy])

  const askAgain = () => {
    parked.current = false
    if (busy) stop()
    setInlineId(null)
    // While streaming, the input is still `disabled` until the re-render lands, so a synchronous
    // focus() would be dropped and focus would fall to <body>. Hand it over on the next frame.
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
  }

  const showTypewriter = !value && !focused && !busy && !answer
  const typewriterRunning = showTypewriter && inView && docVisible

  return (
    <div ref={rootRef} className={clsx('ask', answer && 'has-answer')} data-theme="dark">
      <form className="ask__form" onSubmit={onSubmit} role="search" aria-label={t.label}>
        <Sparkle size={18} className="ask__icon" />
        <div className="ask__field">
          <input
            ref={inputRef}
            className={clsx('ask__input', showTypewriter && 'has-tw')}
            type="text"
            name="question"
            enterKeyHint="send"
            autoComplete="off"
            maxLength={500}
            aria-label={t.label}
            placeholder={t.placeholder}
            value={value}
            disabled={busy}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => {
              setFocused(true)
              warm(true)
            }}
            onBlur={() => setFocused(false)}
            onPointerEnter={() => warm(false)}
          />
          <Typewriter
            prompts={t.suggestions}
            running={typewriterRunning}
            hidden={!showTypewriter}
            reduced={reduced}
            onIndex={onPromptChange}
          />
        </div>
        <button
          ref={actionRef}
          className={clsx('ask__action', busy && 'is-stop')}
          type="submit"
          aria-label={busy ? t.stop : t.submit}
        >
          {busy ? <Stop size={16} /> : <Send size={16} />}
        </button>
      </form>
      <div ref={turnstileRef} className="ask__turnstile" />

      {answer ? (
        <div className="ask__answer">
          {question && <p className="ask__q">{question.text}</p>}
          <div className="ask__scroll" data-lenis-prevent="">
            <Suspense fallback={<p className="qa-answer__thinking">{t.thinking}</p>}>
              <Answer message={answer} />
            </Suspense>
          </div>
          <div className="ask__actions">
            <Button variant="secondary" onClick={() => openPanel()}>
              {t.continue}
            </Button>
            {(settled || busy) && (
              <Button variant="tertiary" onClick={askAgain}>
                {t.again}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="ask__chips" role="group" aria-label={t.suggestionsLabel}>
          {t.suggestions.map((s) => (
            <button key={s} type="button" className="ask__chip" onClick={() => submit(s)} onPointerEnter={() => warm(false)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <Note text={t.note} newTab={t.newTab} />
    </div>
  )
}
