/**
 * Bindings, vars and secrets of the Pages project (wrangler.toml, V3-BUILD-PLAN §WP4, DECISIONS §5).
 * Secrets are never in files: set them with `wrangler pages secret put`. Locally, `.dev.vars`.
 * This module exports types and pure helpers only, so Pages registers no route for it.
 */
export interface Env {
  /** D1: submissions + counters (migrations/0001_init.sql) */
  DB?: D1Database
  /** Service binding to the internal `qairuhub-edge` Worker, which holds the OpenAI key (Secrets Store). */
  EDGE?: Fetcher

  /* secrets (optional in local dev) */
  OPENAI_API_KEY?: string
  TURNSTILE_SECRET_KEY?: string
  SESSION_SIGNING_KEY?: string
  RATE_LIMIT_SALT?: string
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_CHAT_ID?: string

  /* plain vars */
  TURNSTILE_SITE_KEY?: string
  OPENAI_MODEL?: string
  OPENAI_REASONING_EFFORT?: string
  OPENAI_MAX_OUTPUT_TOKENS?: string
  OPENAI_BASE_URL?: string
  ASK_ENABLED?: string
  ASK_DAILY_CAP?: string
  ASK_PER_IP_PER_MINUTE?: string
  ASK_PER_IP_PER_DAY?: string
  ASK_TOP_K?: string
  ASK_MIN_SCORE?: string
  ASK_CONTEXT_CHARS?: string
  JOIN_PER_IP_PER_10MIN?: string
  SUBMISSION_RETENTION_DAYS?: string
  ALLOWED_ORIGINS?: string
  SITE_ORIGIN?: string
}

/** What `_middleware.ts` hands to the route handlers in `context.data`. */
export interface RequestData extends Record<string, unknown> {
  /** parsed JSON body of a POST (size-capped, JSON-only) */
  body?: unknown
  /** sha256(ip + RATE_LIMIT_SALT), first 32 hex chars */
  ipHash?: string
}

export type Handler = PagesFunction<Env, string, RequestData>

export function numVar(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function boolVar(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback
  return !/^(false|0|off|no)$/i.test(value.trim())
}

export function strVar(value: string | undefined, fallback: string): string {
  return value && value.trim() ? value.trim() : fallback
}

export const DEFAULTS = {
  model: 'gpt-5.6-luna',
  reasoningEffort: 'low',
  maxOutputTokens: 700,
  baseUrl: 'https://api.openai.com/v1',
  dailyCap: 1500,
  perIpPerMinute: 6,
  perIpPerDay: 40,
  topK: 5,
  minScore: 0.8,
  contextChars: 9000,
  joinPerIpPer10Min: 5,
  retentionDays: 180,
  siteOrigin: 'https://qairuhub-landing.pages.dev',
} as const

const warned = new Set<string>()
/** One warning per isolate per missing secret; never logs values. */
export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return
  warned.add(key)
  console.warn(JSON.stringify({ level: 'warn', msg: message }))
}
