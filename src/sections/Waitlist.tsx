import clsx from 'clsx'
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { Section } from '../components/ui/Section'
import { Grid, Col } from '../components/ui/Grid'
import { Reveal, RevealGroup, useInView } from '../components/ui/Reveal'
import { Pill } from '../components/ui/Pill'
import { Button } from '../components/ui/Button'
import { waitlist, form as formCopy } from '../content'
import { isAbortError, subscribeWaitlist } from '../lib/submit'
import './Waitlist.css'

/** Reference: one step every 1.5s; the row cycles through all steps then resets. */
const STEP_MS = 1500
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Waitlist (Accelerator): pill · two-line title with a cursive second line · body ·
 * ghost email input + primary "Notify me" · then a large light media card that stands in
 * for the reference product video (caption + animated step row over a faint 12-col grid).
 */
export default function Waitlist() {
  const [email, setEmail] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [done, setDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Cancel an in-flight request if the section unmounts mid-submit.
  useEffect(() => () => abortRef.current?.abort(), [])

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy) return
    if (!EMAIL_RE.test(email.trim())) {
      setInvalid(true)
      inputRef.current?.focus()
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setFailed(false)
    try {
      await subscribeWaitlist(email.trim(), { signal: controller.signal })
      setDone(true)
    } catch (err) {
      if (!isAbortError(err)) setFailed(true)
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setBusy(false)
      }
    }
  }

  return (
    <Section id="accelerator">
      {/* Top block: centered 8 columns, each child revealed with a 150ms stagger */}
      <Grid center>
        <Col large={8} medium={10} small={12}>
          <RevealGroup className="text-air wl-text">
            <Pill>{waitlist.pill}</Pill>
            <h2 className="u-h2">
              {waitlist.titleLine1}
              <br />
              <i>{waitlist.titleLine2}</i>
            </h2>
            <p className="u-body-1 max-w-[48ch]">{waitlist.body}</p>
            <div className="wl-form mt-2" aria-live="polite">
              {done ? (
                <p className="wl-confirm u-body-1" role="status">
                  {formCopy.successTitle}
                </p>
              ) : (
                <form className="wl-form__row" onSubmit={onSubmit} noValidate>
                  <label htmlFor="wl-email" className="sr-only">
                    {waitlist.placeholder}
                  </label>
                  <input
                    ref={inputRef}
                    id="wl-email"
                    className="input-air input-air--ghost wl-input"
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder={waitlist.placeholder}
                    value={email}
                    aria-invalid={invalid || undefined}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (invalid) setInvalid(false)
                    }}
                  />
                  <Button variant="primary" type="submit" disabled={busy}>
                    {waitlist.cta}
                  </Button>
                  {failed && (
                    <p className="wl-error u-body-3" role="alert">
                      {formCopy.submitFailed}
                    </p>
                  )}
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
            <MediaCard />
          </Reveal>
        </Col>
      </Grid>
    </Section>
  )
}

/** Light grey card with a caption and the Idea → MVP → Demo Day → Astana Hub step row. */
function MediaCard() {
  // Pause the step animation while the card is offscreen (once:false → toggles back on).
  const { ref, inView } = useInView<HTMLDivElement>({ once: false, threshold: 0, rootMargin: '0px' })
  const steps = waitlist.demoSteps
  const n = steps.length

  return (
    <div ref={ref} className={clsx('wl-card', !inView && 'u-animation-paused')}>
      <div className="wl-card__grid" aria-hidden="true" />
      <div className="wl-card__body">
        <p className="u-h2-large wl-card__caption">{waitlist.demoCaption}</p>
      </div>
      <ol className="wl-steps" style={{ '--wl-n': n, '--wl-cycle': `${n * STEP_MS}ms` } as CSSProperties}>
        {steps.map((step, i) => (
          <li key={step} className="wl-step" style={{ '--seg': i } as CSSProperties}>
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
