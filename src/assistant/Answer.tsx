import { memo, useEffect, useRef, useState } from 'react'
import { useRoute, useT } from '../i18n/LocaleProvider'
import { addTick } from '../lib/ticker'
import { useReducedMotion } from '../lib/media'
import { panelText } from './panel.i18n'
import Markdown, { resolveLink } from './Markdown'
import type { ChatMessage } from './store'
import './Answer.css'

/**
 * One answer from Q: thinking state, the streamed Markdown, the daily-cap preface, error copy and
 * the Handbook sources. Shared by the Ask bar (lazy) and the panel, so both render the same thread
 * the same way. Lazy chunk together with Markdown.tsx.
 *
 * Streaming text is revealed on the shared ticker at an adaptive, frame-rate independent pace (a
 * backlog drains exponentially, τ 0.16 s, never below 90 chars/s), which smooths token bursts and
 * the single-delta offline answers alike. Reduced motion, restored messages and stopped answers show everything at once.
 *
 * Memoised: the store keeps a message's identity until it is patched, so a settled answer doesn't
 * re-render while another one streams or while the reader types (pass a stable `onInternalLink`).
 */

/** the backlog drains exponentially with this time constant (s), frame-rate independent */
const DRAIN_TAU = 0.16
/** …but never slower than this many characters per second */
const MIN_RATE = 90

function useReveal(text: string, animate: boolean): string {
  const len = text.length
  const [shown, setShown] = useState(() => (animate ? 0 : len))
  const lenRef = useRef(len)
  lenRef.current = len
  const caughtUp = shown >= len

  useEffect(() => {
    if (!animate || caughtUp) return
    return addTick((_t, dt) => {
      const step = dt || 1 / 60
      setShown((cur) => {
        const backlog = lenRef.current - cur
        if (backlog <= 0) return cur
        const n = Math.max(MIN_RATE * step, backlog * (1 - Math.exp(-step / DRAIN_TAU)))
        return Math.min(lenRef.current, cur + Math.ceil(n))
      })
    })
  }, [animate, caughtUp])

  return animate ? text.slice(0, Math.min(shown, len)) : text
}

export interface AnswerProps {
  message: ChatMessage
  /** same-document link clicked (the panel closes itself) */
  onInternalLink?: () => void
}

function Answer({ message, onInternalLink }: AnswerProps) {
  const { locale } = useRoute()
  const t = useT(panelText)
  const reduced = useReducedMotion()

  // Animate only answers that were live while this view was mounted.
  const live = message.status === 'pending' || message.status === 'streaming'
  const wasLive = useRef(live)
  if (live) wasLive.current = true
  const animate = !reduced && wasLive.current && message.status !== 'stopped' && message.status !== 'error'
  const visible = useReveal(message.text, animate)
  const revealing = animate && visible.length < message.text.length

  const thinking = live && !visible
  const settled = !live && !revealing
  const errorCopy = message.error ? t[message.error] : null
  const sources = settled && message.status !== 'error' ? (message.sources ?? []) : []

  return (
    <div className="qa-answer" aria-busy={live || revealing}>
      {thinking && <p className="qa-answer__thinking">{t.thinking}</p>}
      {message.reason === 'daily_cap' && visible && <p className="qa-answer__preface">{t.dailyCap}</p>}
      {visible && (
        <Markdown
          className="qa-md"
          text={visible}
          locale={locale}
          newTabLabel={t.newTab}
          onInternalLink={onInternalLink}
        />
      )}
      {settled && errorCopy && <p className="qa-answer__error">{errorCopy}</p>}
      {sources.length > 0 && (
        <div className="qa-sources">
          <p className="qa-sources__label">{t.sources}</p>
          <ul className="qa-sources__list">
            {sources.map((s) => {
              const link = resolveLink(s.url, locale)
              if (!link) return null
              return (
                <li key={s.url}>
                  <a className="qa-source" href={link.href} onClick={onInternalLink && !link.external ? onInternalLink : undefined}>
                    {s.title || s.url}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export default memo(Answer)
