import clsx from 'clsx'
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { Section } from '../components/ui/Section'
import { Grid, Col } from '../components/ui/Grid'
import { Reveal, RevealGroup, useInView } from '../components/ui/Reveal'
import { Pill } from '../components/ui/Pill'
import { Button } from '../components/ui/Button'
import { Accent } from '../i18n/Accent'
import { useRoute, useT } from '../i18n/LocaleProvider'
import { sectionIds } from '../i18n/shared'
import { isAbortError, subscribeWaitlist, SubmitError, warmFormToken } from '../lib/submit'
import { text, type WaitlistText } from './waitlist.i18n'
import './Waitlist.css'

/** Reference: one step every 1.5s; the row cycles through all steps then resets. */
const STEP_MS = 1500
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const EMAIL_MAX = 254

type Status = 'idle' | 'sending' | 'success'
type ErrorKey = 'errorEmail' | 'errorRateLimited' | 'errorVerify' | 'errorFailed'

/** `/api/join` error → copy key. A duplicate email is a success on the server, so it never lands here. */
function errorKeyFor(err: unknown): ErrorKey {
  if (err instanceof SubmitError) {
    if (err.code === 'invalid') return 'errorEmail'
    if (err.code === 'rate_limited') return 'errorRateLimited'
    if (err.code === 'verify_failed') return 'errorVerify'
  }
  return 'errorFailed'
}

/**
 * QairuHub Accelerator waitlist (`#accelerator`, CONTENT-V3 §6): "planned" pill · two-line title
 * with one cursive accent · body · ghost email input + primary "Notify me" · consent line · then a
 * large media card with the Idea → Team → Demo Day → Accelerator step row.
 *
 * Submission goes through `subscribeWaitlist` (src/lib/submit.ts: honeypot, minimum fill time,
 * Turnstile when configured). Every state has localized copy: sending, success (also for an email
 * that is already on the list), invalid email, rate limited, verification failed and failure.
 */
export default function Waitlist() {
  const t = useT(text)
  const { locale } = useRoute()

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<ErrorKey | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  /** When the person started typing: the minimum-fill-time token (DECISIONS §5). */
  const startedAtRef = useRef(0)

  // Cancel an in-flight request if the section unmounts mid-submit.
  useEffect(() => () => abortRef.current?.abort(), [])

  const busy = status === 'sending'

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy) return
    const value = email.trim()
    if (!EMAIL_RE.test(value) || value.length > EMAIL_MAX) {
      setError('errorEmail')
      inputRef.current?.focus()
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    setStatus('sending')
    setError(null)
    try {
      await subscribeWaitlist(value, {
        signal: controller.signal,
        locale,
        startedAt: startedAtRef.current || undefined,
      })
      setStatus('success')
    } catch (err) {
      if (isAbortError(err)) return
      const key = errorKeyFor(err)
      setError(key)
      setStatus('idle')
      if (key === 'errorEmail') inputRef.current?.focus()
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  const invalid = error === 'errorEmail'

  return (
    <Section id={sectionIds.accelerator} aria-labelledby="accelerator-title">
      {/* Top block: centered 8 columns, each child revealed with a 150ms stagger */}
      <Grid center>
        <Col large={8} medium={10} small={12}>
          <RevealGroup className="text-air wl-text">
            <Pill>{t.pill}</Pill>
            <h2 id="accelerator-title" className="u-h2">
              {t.titleLine1}
              <br />
              <Accent text={t.titleLine2} />
            </h2>
            <p className="u-body-1 max-w-[48ch]">{t.body}</p>
            <div className="wl-form mt-2">
              {status === 'success' ? (
                <p className="wl-confirm u-body-1" role="status">
                  {t.success}
                </p>
              ) : (
                <form className="wl-form__row" onSubmit={onSubmit} noValidate aria-busy={busy || undefined}>
                  <label htmlFor="wl-email" className="sr-only">
                    {t.placeholder}
                  </label>
                  <input
                    ref={inputRef}
                    id="wl-email"
                    className="input-air input-air--ghost wl-input"
                    type="email"
                    name="email"
                    inputMode="email"
                    autoComplete="email"
                    spellCheck={false}
                    maxLength={EMAIL_MAX}
                    required
                    placeholder={t.placeholder}
                    value={email}
                    readOnly={busy}
                    aria-invalid={invalid || undefined}
                    aria-describedby={error ? 'wl-error wl-consent' : 'wl-consent'}
                    onFocus={warmFormToken}
                    onChange={(e) => {
                      if (!startedAtRef.current) startedAtRef.current = Date.now()
                      setEmail(e.target.value)
                      if (error) setError(null)
                    }}
                  />
                  <Button variant="primary" type="submit" disabled={busy}>
                    {busy ? t.sending : t.cta}
                  </Button>
                  {/* Always mounted, so the alert region announces a new error reliably. */}
                  <p id="wl-error" className="wl-error u-body-3" role="alert" hidden={!error}>
                    {error ? t[error] : ''}
                  </p>
                  <p id="wl-consent" className="wl-consent u-body-3">
                    {t.consent}
                  </p>
                </form>
              )}
            </div>
          </RevealGroup>
        </Col>
      </Grid>

      {/* Media card */}
      <Grid center>
        <Col large={10} medium={12} small={12}>
          <Reveal delay={200}>
            <MediaCard t={t} />
          </Reveal>
        </Col>
      </Grid>
    </Section>
  )
}

/** Light grey card with a caption and the Idea → Team → Demo Day → Accelerator step row. */
function MediaCard({ t }: { t: WaitlistText }) {
  // Pause the step animation while the card is offscreen (once:false → toggles back on).
  const { ref, inView } = useInView<HTMLDivElement>({ once: false, threshold: 0, rootMargin: '0px' })
  const steps = t.demoSteps
  const n = steps.length

  return (
    <div ref={ref} className={clsx('wl-card', !inView && 'u-animation-paused')}>
      <div className="wl-card__grid" aria-hidden="true" />
      <div className="wl-card__body">
        <p className="u-h2-large wl-card__caption">{t.demoCaption}</p>
      </div>
      <ol className="wl-steps" style={{ '--wl-n': n, '--wl-cycle': `${n * STEP_MS}ms` } as CSSProperties}>
        {steps.map((step, i) => (
          <li key={i} className="wl-step" style={{ '--seg': i } as CSSProperties}>
            <Pill size="sm" className="wl-step__pill">
              {step}
            </Pill>
            {i < n - 1 && (
              <span className="wl-step__track" aria-hidden="true">
                <span className="wl-step__fill" />
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
