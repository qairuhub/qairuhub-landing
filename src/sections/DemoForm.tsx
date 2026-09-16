import clsx from 'clsx'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Section } from '../components/ui/Section'
import { Grid, Col } from '../components/ui/Grid'
import { Reveal, RevealGroup } from '../components/ui/Reveal'
import { Button } from '../components/ui/Button'
import { ArrowRight, CheckCircle } from '../components/ui/icons'
import { Accent } from '../i18n/Accent'
import { useRoute, useT } from '../i18n/LocaleProvider'
import { fmt, href } from '../i18n/locale'
import { interestValues, isInterestValue, links } from '../i18n/shared'
import { SubmitError, isAbortError, submitJoin, warmFormToken, type JoinFieldKey, type SubmitErrorCode } from '../lib/submit'
import { primeTurnstileNear } from '../lib/turnstile'
import { text, type FormText } from './form.i18n'
import './DemoForm.css'

/* ------------------------------------------------------------------ model */

type FieldKey = JoinFieldKey
/** Form state: `interest` is '' until a value is chosen. */
type Values = Record<FieldKey, string>
type Errors = Partial<Record<FieldKey, string>>
type Touched = Partial<Record<FieldKey, boolean>>
/** `error` = the last submission was rejected; the form stays editable and can be resent. */
type Status = 'idle' | 'sending' | 'success' | 'error'

const FIELD_ORDER: readonly FieldKey[] = ['name', 'email', 'telegram', 'interest', 'message']

/** CONTENT-V3 §15.2 rules (mirrored by the server). */
const LIMITS = { name: 80, email: 120, telegram: 33, message: 1000 } as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const TELEGRAM_RE = /^@?[A-Za-z0-9_]{5,32}$/

const EMPTY: Values = { name: '', email: '', telegram: '', interest: '', message: '' }
const ALL_TOUCHED: Touched = { name: true, email: true, telegram: true, interest: true, message: true }

function validate(v: Values, e: FormText['errors']): Errors {
  const out: Errors = {}
  const name = v.name.trim()
  if (name.length < 2) out.name = e.required
  else if (name.length > LIMITS.name) out.name = fmt(e.tooLong, { max: LIMITS.name })

  const email = v.email.trim()
  if (!email) out.email = e.required
  else if (email.length > LIMITS.email) out.email = fmt(e.tooLong, { max: LIMITS.email })
  else if (!EMAIL_RE.test(email)) out.email = e.email

  const telegram = v.telegram.trim()
  if (!telegram) out.telegram = e.required
  else if (!TELEGRAM_RE.test(telegram)) out.telegram = e.telegram

  if (!isInterestValue(v.interest)) out.interest = e.choose

  if (v.message.trim().length > LIMITS.message) out.message = fmt(e.tooLong, { max: LIMITS.message })
  return out
}

/** Copy for a field the server reported as invalid (`422 { fields }`). */
function serverFieldError(field: FieldKey, e: FormText['errors']): string {
  switch (field) {
    case 'email':
      return e.email
    case 'telegram':
      return e.telegram
    case 'interest':
      return e.choose
    case 'message':
      return fmt(e.tooLong, { max: LIMITS.message })
    default:
      return e.required
  }
}

function submitErrorCopy(code: SubmitErrorCode, e: FormText['errors']): string {
  if (code === 'rate_limited') return e.rateLimited
  if (code === 'verify_failed') return e.verify
  return e.failed
}

/** "Full name*" → ["Full name", true] */
function splitRequired(label: string): [string, boolean] {
  return label.endsWith('*') ? [label.slice(0, -1), true] : [label, false]
}

/* ------------------------------------------------------------------ field */

interface FieldProps {
  name: FieldKey
  label: string
  idBase: string
  error?: string
  span?: 3 | 6
  /** Full width on phones (≤ 560px), where a half-width label or option would truncate. */
  wideOnPhone?: boolean
  children: (a11y: {
    id: string
    'aria-required'?: true
    'aria-invalid'?: true
    'aria-describedby'?: string
  }) => ReactNode
}

/** Inset-label field: the label sits inside the 48px control, so labels stay visible at no extra height. */
function Field({ name, label, idBase, error, span = 3, wideOnPhone, children }: FieldProps) {
  const id = `${idBase}-${name}`
  const errId = `${id}-error`
  const [text, required] = splitRequired(label)
  return (
    <div className={clsx('jf', span === 6 && 'jf--full', wideOnPhone && 'jf--wide-phone', error && 'is-invalid')}>
      <label className="jf__label" htmlFor={id}>
        {text}
        {required && (
          <span className="jf__req" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({
        id,
        'aria-required': required || undefined,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? errId : undefined,
      })}
      {error && (
        <p id={errId} className="jf__error">
          {error}
        </p>
      )}
    </div>
  )
}

/** Renders "… follow t.me/qairuhub for events." with the channel as a real link. */
function WithTelegramLink({ body }: { body: string }) {
  const token = 't.me/qairuhub'
  const at = body.indexOf(token)
  if (at < 0) return <>{body}</>
  return (
    <>
      {body.slice(0, at)}
      <a href={links.telegram} target="_blank" rel="noopener noreferrer">
        {token}
      </a>
      {body.slice(at + token.length)}
    </>
  )
}

/* ------------------------------------------------------------------ section */

/**
 * Compact join form (`#join`, CONTENT-V3 §15, V3-BUILD-PLAN §WP9).
 *
 * ≥ 1024px: the headline sits beside a 6-column translucent card; below that they stack. The
 * card holds name + email, telegram + interest, a 3-row message, an inline Turnstile slot (only
 * used when `/api/config` returns a site key) and a footer row with the legal line and Send.
 * Controlled, blur-validated, Send disabled until valid, honeypot `company`, minimum fill time
 * and Turnstile handled by `submitJoin` (src/lib/submit.ts). Errors map from `SubmitError` codes;
 * success replaces the fields in place (the card keeps its height) and takes focus.
 */
export default function DemoForm() {
  const t = useT(text)
  const route = useRoute()
  const idBase = useId().replace(/[^a-zA-Z0-9_-]/g, '')

  const [values, setValues] = useState<Values>(EMPTY)
  const [company, setCompany] = useState('')
  const [touched, setTouched] = useState<Touched>({})
  const [serverErrors, setServerErrors] = useState<Errors>({})
  const [status, setStatus] = useState<Status>('idle')
  const [errorCode, setErrorCode] = useState<SubmitErrorCode | null>(null)
  const [turnstileOn, setTurnstileOn] = useState(false)

  const inflight = useRef<AbortController | null>(null)
  const startedAt = useRef<number | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const successRef = useRef<HTMLDivElement | null>(null)
  const turnstileRef = useRef<HTMLDivElement | null>(null)
  const focusAfterReset = useRef(false)
  const focusInvalid = useRef(false)

  const clientErrors = useMemo(() => validate(values, t.errors), [values, t.errors])
  const valid = Object.keys(clientErrors).length === 0

  // Config + Turnstile script load only once the form is within 400px of the viewport.
  useEffect(() => primeTurnstileNear(formRef.current, setTurnstileOn), [])

  const markStarted = useCallback(() => {
    if (startedAt.current === null) {
      startedAt.current = Date.now()
      warmFormToken()
    }
  }, [])

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const name = e.target.name as FieldKey
      const { value } = e.target
      markStarted()
      setValues((v) => ({ ...v, [name]: value }))
      setServerErrors((s) => (s[name] ? { ...s, [name]: undefined } : s))
      // A select has no meaningful "blur before valid" moment: show its state as soon as it changes.
      if (e.target instanceof HTMLSelectElement) setTouched((tt) => (tt[name] ? tt : { ...tt, [name]: true }))
    },
    [markStarted],
  )

  const onBlur = useCallback((e: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const name = e.target.name as FieldKey
    // Leaving an untouched empty field is not an error yet (e.g. tabbing through).
    if (!e.target.value) return
    setTouched((tt) => (tt[name] ? tt : { ...tt, [name]: true }))
  }, [])

  const busy = status === 'sending'

  const onSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (busy || status === 'success') return
      if (!valid || !isInterestValue(values.interest)) {
        setTouched(ALL_TOUCHED)
        focusInvalid.current = true
        return
      }
      const controller = new AbortController()
      inflight.current?.abort()
      inflight.current = controller
      setStatus('sending')
      setErrorCode(null)
      submitJoin(
        { ...values, interest: values.interest, company },
        {
          signal: controller.signal,
          locale: route.locale,
          container: turnstileRef.current ?? undefined,
          startedAt: startedAt.current ?? undefined,
        },
      )
        .then(() => setStatus('success'))
        .catch((err: unknown) => {
          // An aborted request (reset / unmount) is not a failure: the caller already moved on.
          if (isAbortError(err)) return
          const se = err instanceof SubmitError ? err : new SubmitError('failed')
          if (se.code === 'invalid') {
            const fields = (se.fields ?? []).filter((f): f is FieldKey => (FIELD_ORDER as readonly string[]).includes(f))
            if (fields.length) {
              setServerErrors(Object.fromEntries(fields.map((f) => [f, serverFieldError(f, t.errors)])) as Errors)
              setTouched(ALL_TOUCHED)
              focusInvalid.current = true
              setStatus('idle')
              return
            }
          }
          setErrorCode(se.code === 'invalid' ? 'failed' : se.code)
          setStatus('error')
        })
        .finally(() => {
          if (inflight.current === controller) inflight.current = null
        })
    },
    [busy, status, valid, values, company, route.locale, t.errors],
  )

  const reset = useCallback(() => {
    inflight.current?.abort()
    inflight.current = null
    focusAfterReset.current = true
    startedAt.current = null
    setValues(EMPTY)
    setCompany('')
    setTouched({})
    setServerErrors({})
    setErrorCode(null)
    setStatus('idle')
  }, [])

  const errorFor = (name: FieldKey): string | undefined =>
    serverErrors[name] ?? (touched[name] ? clientErrors[name] : undefined)

  // Focus: into the success message; back to the first field after "Send another"; to the first
  // invalid field after a rejected submit.
  useEffect(() => {
    if (status === 'success') {
      successRef.current?.focus({ preventScroll: true })
      return
    }
    if (status === 'idle' && focusAfterReset.current) {
      focusAfterReset.current = false
      formRef.current?.querySelector<HTMLInputElement>(`#${idBase}-name`)?.focus({ preventScroll: true })
      return
    }
    if (focusInvalid.current) {
      focusInvalid.current = false
      const first = FIELD_ORDER.find((f) => serverErrors[f] ?? clientErrors[f])
      if (first) formRef.current?.querySelector<HTMLElement>(`#${idBase}-${first}`)?.focus({ preventScroll: true })
    }
  }, [status, touched, serverErrors, clientErrors, idBase])

  // Abort an in-flight submission on unmount so it cannot set state afterwards.
  useEffect(
    () => () => {
      inflight.current?.abort()
      inflight.current = null
    },
    [],
  )

  const f = t.fields
  const titleId = `${idBase}-title`
  const submitErrorId = `${idBase}-submit-error`

  return (
    <Section id="join" className="join" spacing="none" aria-labelledby={titleId}>
      <Grid className="join__grid">
        <Col large={5} medium={10} small={12} className="join__intro">
          <RevealGroup className="text-air text-air--left on-sky join__text">
            <h2 id={titleId} className="u-h2-large join__title">
              {t.titleLine1}
              <br />
              <Accent text={`${t.titleLine2Before}${t.titleLine2Cursive}${t.titleLine2After}`} />
            </h2>
            <p className="u-body-1 join__body">{t.body}</p>
            <div className="join__signup">
              <Button variant="primary" href={links.platformSignUp} iconRight={<ArrowRight size={16} />}>
                {t.signUpCta}
              </Button>
              <p className="u-body-3 join__signup-note">{t.signUpNote}</p>
            </div>
          </RevealGroup>
        </Col>

        <Col large={6} offsetLarge={1} medium={10} offsetMedium={0} small={12}>
          <Reveal>
            <div className={clsx('joincard', status === 'success' && 'is-success')}>
              <form
                ref={formRef}
                className="joincard__form"
                noValidate
                inert={status === 'success'}
                aria-busy={busy || undefined}
                aria-describedby={status === 'error' ? submitErrorId : undefined}
                onFocusCapture={markStarted}
                onSubmit={onSubmit}
              >
                {/* Honeypot: off-screen, out of the tab order; people never fill it, bots do. */}
                <div className="joincard__hp">
                  <label htmlFor={`${idBase}-company`}>{f.honeypot.label}</label>
                  <input
                    id={`${idBase}-company`}
                    name="company"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>

                <Field name="name" label={f.name.label} idBase={idBase} error={errorFor('name')}>
                  {(a11y) => (
                    <input
                      {...a11y}
                      name="name"
                      type="text"
                      className="jf__control"
                      autoComplete="name"
                      maxLength={LIMITS.name}
                      value={values.name}
                      onChange={onChange}
                      onBlur={onBlur}
                    />
                  )}
                </Field>
                <Field name="email" label={f.email.label} idBase={idBase} error={errorFor('email')}>
                  {(a11y) => (
                    <input
                      {...a11y}
                      name="email"
                      type="email"
                      inputMode="email"
                      className="jf__control"
                      autoComplete="email"
                      spellCheck={false}
                      maxLength={LIMITS.email}
                      value={values.email}
                      onChange={onChange}
                      onBlur={onBlur}
                    />
                  )}
                </Field>
                <Field name="telegram" label={f.telegram.label} idBase={idBase} error={errorFor('telegram')} wideOnPhone>
                  {(a11y) => (
                    <input
                      {...a11y}
                      name="telegram"
                      type="text"
                      className="jf__control"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      maxLength={LIMITS.telegram}
                      placeholder={f.telegram.placeholder}
                      value={values.telegram}
                      onChange={onChange}
                      onBlur={onBlur}
                    />
                  )}
                </Field>
                <Field name="interest" label={f.interest.label} idBase={idBase} error={errorFor('interest')} wideOnPhone>
                  {(a11y) => (
                    <select
                      {...a11y}
                      name="interest"
                      className="jf__control jf__control--select"
                      data-empty={!values.interest || undefined}
                      value={values.interest}
                      onChange={onChange}
                      onBlur={onBlur}
                    >
                      <option value="" disabled>
                        {f.interest.placeholder}
                      </option>
                      {interestValues.map((value) => (
                        <option key={value} value={value}>
                          {t.interestOptions[value]}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field name="message" label={f.message.label} idBase={idBase} error={errorFor('message')} span={6}>
                  {(a11y) => (
                    <textarea
                      {...a11y}
                      name="message"
                      rows={3}
                      className="jf__control jf__control--area"
                      autoComplete="off"
                      maxLength={LIMITS.message}
                      placeholder={f.message.placeholder}
                      value={values.message}
                      onChange={onChange}
                      onBlur={onBlur}
                    />
                  )}
                </Field>

                {/* Inline Turnstile slot: empty (and collapsed) unless Cloudflare needs a click. */}
                <div ref={turnstileRef} className="joincard__turnstile" hidden={!turnstileOn} />

                {status === 'error' && errorCode && (
                  <p id={submitErrorId} className="joincard__alert" role="alert">
                    {submitErrorCopy(errorCode, t.errors)}
                  </p>
                )}

                <div className="joincard__foot">
                  <p className="joincard__legal">
                    {t.legalBefore}
                    <a href={href(route, 'handbook#platform-rules')}>{t.legalLink1}</a>
                    {t.legalMiddle}
                    <a href={href(route, 'handbook#privacy-on-this-site')}>{t.legalLink2}</a>
                    {t.legalAfter}
                    {turnstileOn && <span className="joincard__ts-note"> {t.turnstileNote}</span>}
                  </p>
                  <Button
                    variant="primary"
                    type="submit"
                    className="joincard__submit"
                    disabled={!valid || busy}
                    iconRight={busy ? undefined : <ArrowRight size={16} aria-hidden="true" />}
                  >
                    {busy ? t.sending : t.submit}
                  </Button>
                </div>
              </form>

              {status === 'success' && (
                <div ref={successRef} className="joincard__success" role="status" tabIndex={-1}>
                  <CheckCircle size={28} aria-hidden="true" className="joincard__success-icon" />
                  <p className="u-h4 joincard__success-title">{t.successTitle}</p>
                  <p className="joincard__success-body">
                    <WithTelegramLink body={t.successBody} />
                  </p>
                  <div className="joincard__success-actions">
                    <Button variant="primary" href={links.platformSignUp}>
                      {t.successCta}
                    </Button>
                    <Button variant="secondary" onClick={reset}>
                      {t.sendAnother}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Reveal>
        </Col>
      </Grid>
    </Section>
  )
}
