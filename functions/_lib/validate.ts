/**
 * Request validation for /api/ask (AGENT-SPEC §5.1) and /api/join (CONTENT-V3 §15.2–§15.3).
 * Unknown fields are ignored. Nothing here logs values.
 */

export type Locale = 'en' | 'kk'

/** CONTENT-V3 §15.3 option values; keep in sync with `interestValues` in src/i18n/shared.ts. */
export const INTEREST_VALUES = ['build', 'project', 'events', 'media', 'business', 'mentor', 'partner', 'other'] as const
export type Interest = (typeof INTEREST_VALUES)[number]

// C0/C1 control characters except tab and newline.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g

export function clean(value: unknown): string {
  return typeof value === 'string' ? value.replace(CONTROL, '').replace(/\r\n?/g, '\n').trim() : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/* ---------------------------------------------------------------------------------------- */
/* /api/ask                                                                                 */
/* ---------------------------------------------------------------------------------------- */

export const QUESTION_MAX = 500
const HISTORY_MAX = 6
const USER_ITEM_MAX = 800
const ASSISTANT_ITEM_MAX = 1200

export interface AskInput {
  question: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  locale: Locale
  turnstileToken?: string
}

export type AskValidation = { ok: true; value: AskInput } | { ok: false; status: 400 | 413; code: 'bad_request' | 'too_long' }

export function validateAsk(body: unknown): AskValidation {
  if (!isRecord(body)) return { ok: false, status: 400, code: 'bad_request' }
  const question = clean(body.question)
  if (!question) return { ok: false, status: 400, code: 'bad_request' }
  if ([...question].length > QUESTION_MAX) return { ok: false, status: 413, code: 'too_long' }

  const history: AskInput['history'] = []
  if (Array.isArray(body.history)) {
    for (const item of body.history.slice(-HISTORY_MAX)) {
      if (!isRecord(item)) continue
      const role = item.role === 'user' || item.role === 'assistant' ? item.role : null
      const content = clean(item.content)
      if (!role || !content) continue
      history.push({ role, content: content.slice(0, role === 'user' ? USER_ITEM_MAX : ASSISTANT_ITEM_MAX) })
    }
  }
  const locale: Locale = body.locale === 'kk' ? 'kk' : 'en'
  const token = typeof body.turnstileToken === 'string' && body.turnstileToken ? body.turnstileToken : undefined
  return { ok: true, value: { question, history, locale, turnstileToken: token } }
}

/* ---------------------------------------------------------------------------------------- */
/* /api/join                                                                                */
/* ---------------------------------------------------------------------------------------- */

export interface JoinSubmission {
  kind: 'join' | 'waitlist'
  locale: Locale
  email: string
  name: string | null
  telegram: string | null
  interest: Interest | null
  message: string | null
}

export type JoinValidation = { ok: true; value: JoinSubmission } | { ok: false; fields: string[] }

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/
const TELEGRAM = /^@?[A-Za-z0-9_]{5,32}$/

export function validateJoin(body: Record<string, unknown>): JoinValidation {
  const fields: string[] = []
  const kind = body.kind === 'join' || body.kind === 'waitlist' ? body.kind : null
  if (!kind) fields.push('kind')
  const locale = body.locale === 'en' || body.locale === 'kk' ? body.locale : null
  if (!locale) fields.push('locale')

  const email = clean(body.email).toLowerCase()
  if (!email || email.length > 120 || !EMAIL.test(email)) fields.push('email')

  let name: string | null = null
  let telegram: string | null = null
  let interest: Interest | null = null
  let message: string | null = null
  if (kind === 'join') {
    name = clean(body.name).replace(/\s+/g, ' ')
    const nameLength = [...name].length
    if (nameLength < 2 || nameLength > 80) fields.push('name')

    telegram = clean(body.telegram)
    if (!TELEGRAM.test(telegram)) fields.push('telegram')
    else telegram = `@${telegram.replace(/^@/, '')}`

    const rawInterest = clean(body.interest)
    interest = (INTEREST_VALUES as readonly string[]).includes(rawInterest) ? (rawInterest as Interest) : null
    if (!interest) fields.push('interest')

    message = clean(body.message) || null
    if (message && [...message].length > 1000) fields.push('message')
  }

  if (fields.length || !kind || !locale) return { ok: false, fields }
  return { ok: true, value: { kind, locale, email, name, telegram, interest, message } }
}
