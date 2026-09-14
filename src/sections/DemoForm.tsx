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
} from 'react'
import { form } from '../content'
import { Section, SectionText } from '../components/ui/Section'
import { Grid, Col } from '../components/ui/Grid'
import { Reveal } from '../components/ui/Reveal'
import { Button } from '../components/ui/Button'
import { submitJoin, isAbortError, type JoinFieldKey, type JoinValues } from '../lib/submit'
import './DemoForm.css'

/* ------------------------------------------------------------------ model */

type FieldKey = JoinFieldKey
type Values = JoinValues
type Errors = Partial<Record<FieldKey, string>>
type Touched = Partial<Record<FieldKey, boolean>>
/** `error` = the last submission was rejected; the form is editable and can be resubmitted. */
type Status = 'idle' | 'sending' | 'success' | 'error'

const REQUIRED: readonly FieldKey[] = ['firstName', 'lastName', 'email', 'telegram', 'year', 'source']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const EMPTY: Values = {
  firstName: '',
  lastName: '',
  email: '',
  telegram: '',
  year: '',
  source: '',
  message: '',
}

/**
 * Validation + status copy. `submitFailed` comes from content.ts (`form.submitFailed`, shared with Waitlist).
 * TODO(content): move `errors.*` and `sendAnother` into `form` in src/content.ts as
 * `errors: { required, choose, email }` and `sendAnother` — content.ts is owned by another
 * fixer this round, so these three strings stay here as the sole local fallback for now.
 */
const MSG = {
  errors: {
    required: 'This field is required',
    choose: 'Please choose an option',
    email: 'Enter a valid email address',
  },
  sendAnother: 'Send another',
} as const

function validate(v: Values): Errors {
  const e: Errors = {}
  for (const k of REQUIRED) {
    if (!v[k].trim()) e[k] = k === 'year' || k === 'source' ? MSG.errors.choose : MSG.errors.required
  }
  if (!e.email && !EMAIL_RE.test(v.email.trim())) e.email = MSG.errors.email
  return e
}

const ALL_TOUCHED: Touched = Object.fromEntries(REQUIRED.map((k) => [k, true])) as Touched

/* ------------------------------------------------------------------ fields */

interface FieldBaseProps {
  name: FieldKey
  label: string
  value: string
  error?: string
  touched?: boolean
  required?: boolean
  idBase: string
  onBlur: (e: FocusEvent<HTMLInputElement | HTMLSelectElement>) => void
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
}

interface TextFieldProps extends FieldBaseProps {
  type?: 'text' | 'email'
  autoComplete?: string
  inputMode?: 'text' | 'email'
}

function TextField({
  name,
  label,
  value,
  error,
  touched,
  required,
  idBase,
  type = 'text',
  autoComplete,
  inputMode,
  onBlur,
  onChange,
}: TextFieldProps) {
  const id = `${idBase}-${name}`
  const errId = `${id}-error`
  const showError = Boolean(touched && error)
  return (
    <div className="formcard__field">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className={clsx('input-air', showError && 'is-invalid')}
        placeholder={label}
        value={value}
        required={required}
        aria-required={required || undefined}
        aria-invalid={showError || undefined}
        aria-describedby={showError ? errId : undefined}
        onBlur={onBlur}
        onChange={onChange}
      />
      {showError && (
        <p id={errId} className="formcard__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

interface SelectFieldProps extends FieldBaseProps {
  options: readonly string[]
}

function SelectField({ name, label, value, error, touched, required, idBase, options, onBlur, onChange }: SelectFieldProps) {
  const id = `${idBase}-${name}`
  const errId = `${id}-error`
  const showError = Boolean(touched && error)
  return (
    <div className="formcard__field">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        name={name}
        className={clsx('input-air', showError && 'is-invalid')}
        value={value}
        required={required}
        data-empty={!value}
        aria-required={required || undefined}
        aria-invalid={showError || undefined}
        aria-describedby={showError ? errId : undefined}
        onBlur={onBlur}
        onChange={onChange}
      >
        <option value="" disabled hidden>
          {label}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {showError && (
        <p id={errId} className="formcard__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ section */

/**
 * Reference "Form" section: u-h2-large two-line title with a cursive word, body,
 * and a white 7-col card (radius 12, padding 40) holding the join form.
 * Controlled inputs, blur-validated, submit disabled until valid, async submit through
 * `submitJoin` (src/lib/submit.ts — the only place to touch to wire a backend),
 * inline error state on rejection, in-card success overlay with a "send another" reset.
 */
export default function DemoForm() {
  const idBase = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [values, setValues] = useState<Values>(EMPTY)
  const [touched, setTouched] = useState<Touched>({})
  const [status, setStatus] = useState<Status>('idle')

  const inflight = useRef<AbortController | null>(null)
  const successRef = useRef<HTMLDivElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const focusFirstAfterReset = useRef(false)

  const errors = useMemo(() => validate(values), [values])
  const valid = Object.keys(errors).length === 0

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setValues((v) => ({ ...v, [name]: value }))
  }, [])

  const onBlur = useCallback((e: FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const name = e.target.name as FieldKey
    setTouched((t) => (t[name] ? t : { ...t, [name]: true }))
  }, [])

  const canSubmit = status === 'idle' || status === 'error'

  const onSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!canSubmit) return
      if (!valid) {
        setTouched(ALL_TOUCHED)
        return
      }
      const controller = new AbortController()
      inflight.current?.abort()
      inflight.current = controller
      setStatus('sending')
      submitJoin(values, { signal: controller.signal })
        .then(() => setStatus('success'))
        .catch((err: unknown) => {
          // An aborted request (reset / unmount) is not a failure — the caller already moved on.
          if (!isAbortError(err)) setStatus('error')
        })
        .finally(() => {
          if (inflight.current === controller) inflight.current = null
        })
    },
    [canSubmit, valid, values],
  )

  const reset = useCallback(() => {
    inflight.current?.abort()
    inflight.current = null
    focusFirstAfterReset.current = true
    setValues(EMPTY)
    setTouched({})
    setStatus('idle')
  }, [])

  // Move focus into the success state for keyboard / screen-reader users,
  // and back to the first input after "Send another".
  useEffect(() => {
    if (status === 'success') {
      successRef.current?.focus({ preventScroll: true })
    } else if (status === 'idle' && focusFirstAfterReset.current) {
      focusFirstAfterReset.current = false
      formRef.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
    }
  }, [status])

  // Abort an in-flight submission on unmount so it cannot set state afterwards.
  useEffect(
    () => () => {
      inflight.current?.abort()
      inflight.current = null
    },
    [],
  )

  const f = form.fields
  const fieldProps = (name: FieldKey) => ({
    name,
    value: values[name],
    error: errors[name],
    touched: touched[name],
    required: REQUIRED.includes(name),
    idBase,
    onBlur,
    onChange,
  })

  return (
    <Section id="join" aria-labelledby={`${idBase}-title`}>
      <SectionText
        titleAs="h2"
        titleClass="u-h2-large"
        title={
          <span id={`${idBase}-title`}>
            {form.titleLine1}
            <br />
            {form.titleLine2Before}
            <i>{form.titleLine2Cursive}</i>
            {form.titleLine2After}
          </span>
        }
        body={form.body}
      />

      <Grid center>
        <Col large={7} medium={8} small={12}>
          <Reveal>
            <div className="formcard" data-theme="light">
              <form
                ref={formRef}
                className="formcard__form"
                noValidate
                inert={status === 'success'}
                aria-busy={status === 'sending' || undefined}
                aria-describedby={status === 'error' ? `${idBase}-submit-error` : undefined}
                onSubmit={onSubmit}
              >
                <div className="formcard__row">
                  <TextField {...fieldProps('firstName')} label={f.firstName} autoComplete="given-name" />
                  <TextField {...fieldProps('lastName')} label={f.lastName} autoComplete="family-name" />
                </div>
                <TextField {...fieldProps('email')} label={f.email} type="email" inputMode="email" autoComplete="email" />
                <TextField {...fieldProps('telegram')} label={f.telegram} autoComplete="username" />
                <SelectField {...fieldProps('year')} label={f.year.label} options={f.year.options} />
                <SelectField {...fieldProps('source')} label={f.source.label} options={f.source.options} />
                <TextField {...fieldProps('message')} label={f.message} autoComplete="off" />

                <div className="formcard__submit">
                  <Button variant="primary" type="submit" disabled={!valid || !canSubmit}>
                    {form.submit}
                  </Button>
                </div>

                {status === 'error' && (
                  <p id={`${idBase}-submit-error`} className="formcard__error text-center" role="alert">
                    {form.submitFailed}
                  </p>
                )}

                <p className="u-body-3 formcard__legal">
                  {form.legalBefore}
                  <a href={form.legalLink1.href} target="_blank" rel="noreferrer">
                    {form.legalLink1.label}
                  </a>
                  {form.legalMiddle}
                  <a href={form.legalLink2.href}>{form.legalLink2.label}</a>
                </p>
              </form>

              {status === 'success' && (
                <div ref={successRef} className="formcard__success" role="status" aria-live="polite" tabIndex={-1}>
                  <p className="u-h4">{form.successTitle}</p>
                  <p className="formcard__success__body">{form.successBody}</p>
                  <Button variant="tertiary" onClick={reset}>
                    {MSG.sendAnother}
                  </Button>
                </div>
              )}
            </div>
          </Reveal>
        </Col>
      </Grid>
    </Section>
  )
}
