/**
 * Output guards for streamed answers (AGENT-SPEC §6).
 *
 * `PiiFilter` keeps a rolling buffer: text is released only up to a whitespace boundary at least
 * HOLD characters behind the newest token, after emails and phone numbers in the whole buffer were
 * replaced. An email has no spaces, so it is never split across releases; a phone number is
 * shorter than HOLD, so a partial one is always still held.
 *
 * `LeakGuard` ends the answer when it repeats 12+ consecutive words of the system prompt.
 */

const PLACEHOLDER = '[contact via t.me/qairuhub]'
const HOLD = 32

const PATTERNS: RegExp[] = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
  /\+\s?\d[\d\s().-]{8,}\d/g,
  /(?<!\d)8[\s(-]*7\d{2}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?!\d)/g,
  /(?<![\d.])\d(?:[\s().-]?\d){9,}(?![\d.])/g,
]

export function redact(text: string): string {
  let out = text
  for (const re of PATTERNS) out = out.replace(re, PLACEHOLDER)
  return out
}

export class PiiFilter {
  private buffer = ''

  /** Adds streamed text; returns the part that is safe to forward now (may be empty). */
  push(text: string): string {
    this.buffer = redact(this.buffer + text)
    const limit = this.buffer.length - HOLD
    if (limit <= 0) return ''
    let cut = -1
    for (let i = limit; i > 0; i--) {
      if (/\s/.test(this.buffer[i])) {
        cut = i
        break
      }
    }
    if (cut <= 0) return ''
    const out = this.buffer.slice(0, cut)
    this.buffer = this.buffer.slice(cut)
    return out
  }

  /** Releases everything left, redacted. */
  flush(): string {
    const out = redact(this.buffer)
    this.buffer = ''
    return out
  }
}

const SHINGLE = 12

function normWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

export class LeakGuard {
  private readonly shingles = new Set<string>()
  private words: string[] = []
  private pending = ''

  constructor(secretText: string) {
    const w = normWords(secretText)
    for (let i = 0; i + SHINGLE <= w.length; i++) this.shingles.add(w.slice(i, i + SHINGLE).join(' '))
  }

  /** Adds streamed text; returns true when the answer now contains a 12-word run of the prompt. */
  push(text: string): boolean {
    this.pending += text
    const boundary = this.pending.search(/[^\p{L}\p{N}][\p{L}\p{N}]*$/u)
    const complete = boundary >= 0 ? this.pending.slice(0, boundary + 1) : ''
    this.pending = boundary >= 0 ? this.pending.slice(boundary + 1) : this.pending
    return this.check(normWords(complete))
  }

  finish(): boolean {
    const leaked = this.check(normWords(this.pending))
    this.pending = ''
    return leaked
  }

  private check(newWords: string[]): boolean {
    for (const w of newWords) {
      this.words.push(w)
      if (this.words.length > SHINGLE) this.words.shift()
      if (this.words.length === SHINGLE && this.shingles.has(this.words.join(' '))) return true
    }
    return false
  }
}
