import { useSyncExternalStore } from 'react'
import type { Locale } from '../i18n/locale'

/**
 * One conversation with Q, shared by the Launchpad Ask bar and the floating panel
 * (AGENT-SPEC §11). A tiny external store (no library): the thread, the id of the answer in
 * flight, the panel's open state and the one-shot live-region announcement.
 *
 * - The thread survives page loads in `sessionStorage['qh.ask.thread']` (last 12 settled
 *   messages, every access in try/catch).
 * - The network client (`sseClient.ts`, and through it Turnstile and the offline Handbook search)
 *   is a lazy chunk: importing this module costs nothing on the network.
 * - One AbortController: Stop, closing the panel, New chat or a new question abort the answer in
 *   flight immediately (the UI flips to "stopped" synchronously, well inside 100 ms).
 */

export type AnswerMode = 'ai' | 'offline'
/** Server reasons (AGENT-SPEC §5.2) plus `client`: the browser answered from /handbook-index.json. */
export type OfflineReason = 'no_key' | 'disabled' | 'daily_cap' | 'upstream' | 'client'
export type AskErrorCode = 'error' | 'rateLimited' | 'tooLong'
export type MessageStatus = 'pending' | 'streaming' | 'done' | 'stopped' | 'error'

export interface AnswerSource {
  id: string
  title: string
  url: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  status: MessageStatus
  mode?: AnswerMode
  reason?: OfflineReason
  sources?: AnswerSource[]
  error?: AskErrorCode
}

export interface Announcement {
  id: string
  text: string
  error?: AskErrorCode
  reason?: OfflineReason
}

export interface AssistantState {
  messages: readonly ChatMessage[]
  /** the assistant message currently being answered */
  activeId: string | null
  panelOpen: boolean
  /** a finished answer for the polite live region (announced once) */
  announcement: Announcement | null
}

export interface AskOptions {
  locale: Locale
  /** where Turnstile may render an interactive check (ask bar / panel slot) */
  container?: HTMLElement | null
}

const STORAGE_KEY = 'qh.ask.thread'
const STORED_MAX = 12
/** in-memory cap (the panel never renders an unbounded list) */
const MEMORY_MAX = 40
const HISTORY_MAX = 6
const FLUSH_MS = 40

/* ------------------------------------------------------------------ persistence */

function isMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false
  const m = value as Record<string, unknown>
  return typeof m.id === 'string' && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string'
}

function load(): ChatMessage[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isMessage).map((m) => {
      const settled: MessageStatus =
        m.status === 'done' || m.status === 'stopped' || m.status === 'error' ? m.status : 'stopped'
      return {
        id: m.id,
        role: m.role,
        text: m.text,
        status: settled,
        mode: m.mode === 'ai' || m.mode === 'offline' ? m.mode : undefined,
        reason: m.reason,
        sources: Array.isArray(m.sources) ? m.sources.filter((s) => s && typeof s.url === 'string') : undefined,
        error: m.error,
      }
    })
  } catch {
    return []
  }
}

function save(messages: readonly ChatMessage[]) {
  try {
    const settled = messages.filter((m) => m.status !== 'pending' && m.status !== 'streaming')
    if (!settled.length) window.sessionStorage.removeItem(STORAGE_KEY)
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(settled.slice(-STORED_MAX)))
  } catch {
    /* storage full or blocked: the thread just won't survive a reload */
  }
}

/* ------------------------------------------------------------------ store core */

let state: AssistantState = {
  messages: typeof window !== 'undefined' ? load() : [],
  activeId: null,
  panelOpen: false,
  announcement: null,
}
const listeners = new Set<() => void>()

function set(patch: Partial<AssistantState>) {
  state = { ...state, ...patch }
  for (const fn of listeners) fn()
}

function patchMessage(id: string, patch: Partial<ChatMessage>) {
  let found = false
  const messages = state.messages.map((m) => {
    if (m.id !== id) return m
    found = true
    return { ...m, ...patch }
  })
  if (found) set({ messages })
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getState(): AssistantState {
  return state
}

/** `const s = useAssistant()` — re-renders on every store change (streaming included). */
export function useAssistant(): AssistantState {
  return useSyncExternalStore(subscribe, getState, getState)
}

/** A primitive slice (`s => s.panelOpen`): re-renders only when that value changes. */
export function useAssistantValue<T extends string | number | boolean | null>(select: (s: AssistantState) => T): T {
  const get = () => select(state)
  return useSyncExternalStore(subscribe, get, get)
}

let seq = 0
function newId(): string {
  seq += 1
  return `${Date.now().toString(36)}-${seq}`
}

/* ------------------------------------------------------------------ streaming buffer */

let pending = ''
let pendingId: string | null = null
let flushTimer = 0

function flush() {
  window.clearTimeout(flushTimer)
  flushTimer = 0
  if (!pendingId || !pending) return
  const id = pendingId
  const add = pending
  pending = ''
  const msg = state.messages.find((m) => m.id === id)
  if (msg) patchMessage(id, { text: msg.text + add, status: msg.status === 'pending' ? 'streaming' : msg.status })
}

function appendDelta(id: string, text: string) {
  if (pendingId !== id) {
    flush()
    pendingId = id
  }
  pending += text
  if (!flushTimer) flushTimer = window.setTimeout(flush, FLUSH_MS)
}

/* ------------------------------------------------------------------ actions */

let controller: AbortController | null = null

/** Markdown → one plain line for the live region. */
export function toPlainText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__/g, '')
    .replace(/(^|\s)[*_]([^*_\n]+)[*_]/g, '$1$2')
    .replace(/^\s*(?:[-*•]|\d+\.)\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function settle(id: string, patch: Partial<ChatMessage>) {
  flush()
  patchMessage(id, patch)
  const msg = state.messages.find((m) => m.id === id)
  // Announce finished answers and errors; a stopped answer was the user's own choice.
  const announcement: Announcement | null =
    msg && msg.status !== 'stopped'
      ? { id: `${id}:${msg.status}`, text: toPlainText(msg.text), error: msg.error, reason: msg.reason }
      : null
  set({ activeId: state.activeId === id ? null : state.activeId, announcement })
  save(state.messages)
}

/** Warm the network client on first intent (input focus, launcher hover). Never throws. */
export function preloadClient(): void {
  void import('./sseClient').then((m) => m.warmUp()).catch(() => undefined)
}

/**
 * Ask Q. Aborts any answer in flight, appends the question and a pending answer, and streams
 * into it. Returns the id of the new assistant message ('' for an empty question).
 */
export function ask(question: string, opts: AskOptions): string {
  const q = question.trim()
  if (!q) return ''
  stop()

  const history = state.messages
    .filter((m) => m.text.trim() && (m.role === 'user' || m.status !== 'pending'))
    .slice(-HISTORY_MAX)
    .map((m) => ({ role: m.role, content: m.text }))

  const userMsg: ChatMessage = { id: newId(), role: 'user', text: q, status: 'done' }
  const botMsg: ChatMessage = { id: newId(), role: 'assistant', text: '', status: 'pending' }
  const botId = botMsg.id
  set({ messages: [...state.messages, userMsg, botMsg].slice(-MEMORY_MAX), activeId: botId, announcement: null })

  const ctl = new AbortController()
  controller = ctl

  void (async () => {
    try {
      const { streamAsk } = await import('./sseClient')
      if (ctl.signal.aborted) return
      const outcome = await streamAsk(
        { question: q, history, locale: opts.locale, signal: ctl.signal, container: opts.container ?? null },
        {
          onMeta: (meta) => patchMessage(botId, { mode: meta.mode, reason: meta.reason, sources: meta.sources }),
          onDelta: (t) => appendDelta(botId, t),
        },
      )
      if (ctl.signal.aborted) return
      flush()
      if (outcome.kind === 'done') settle(botId, { status: 'done' })
      else settle(botId, { status: 'error', error: outcome.code })
    } catch {
      if (ctl.signal.aborted) return
      settle(botId, { status: 'error', error: 'error' })
    } finally {
      if (controller === ctl) controller = null
    }
  })()

  return botId
}

/** Stop the answer in flight (keeps what already arrived). */
export function stop(): void {
  const id = state.activeId
  if (controller) {
    controller.abort()
    controller = null
  }
  if (!id) return
  flush()
  const msg = state.messages.find((m) => m.id === id)
  if (msg && (msg.status === 'pending' || msg.status === 'streaming')) settle(id, { status: 'stopped' })
  else set({ activeId: null })
}

/** New chat: abort and forget the thread. */
export function reset(): void {
  stop()
  pending = ''
  pendingId = null
  set({ messages: [], activeId: null, announcement: null })
  save([])
}

export function openPanel(): void {
  if (!state.panelOpen) set({ panelOpen: true })
}

/** Closing the panel also stops the answer in flight (AGENT-SPEC §5.2). */
export function closePanel(): void {
  if (!state.panelOpen) return
  stop()
  set({ panelOpen: false })
}
