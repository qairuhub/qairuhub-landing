/**
 * The text LeakGuard watches for (AGENT-SPEC §9): SYSTEM_PROMPT minus the parts Q is *told* to say.
 *
 * Building the guard from the whole prompt made ordinary answers count as leaks — "how do you work?"
 * (the prompt scripts that reply) or "how do I contact the team?" (the prompt lists t.me, /#join and
 * /members) shares 12+ words with it and the stream was cut off. So these sayable parts are removed:
 * the scope/topic list, the Latin-names list, the link allowlist, the contact-the-team sentence and
 * the "If asked how you work, say: …" clause. Each cut becomes a paragraph break; shingles that span
 * a cut never occur in real answers, so they cannot cause false positives.
 *
 * Derived at module load, so it stays in sync with SYSTEM_PROMPT. If a marker ever stops matching
 * (the prompt was edited), that cut is skipped: the guard falls back to stricter, never weaker.
 */
import { SYSTEM_PROMPT } from './systemPrompt'

/** [start, end) markers; the span from `start` up to and including `end` is removed. */
const CUTS: ReadonlyArray<readonly [start: string, end: string]> = [
  // YOUR JOB topic list — Q restates it whenever asked "what can you help with?"
  ['- Answer questions about QairuHub:', 'this website and you.'],
  // Latin-names list — Q repeats these names in every Kazakh/Russian answer.
  ['Keep these names in Latin letters:', 'community.qairuhub.com.'],
  // Link allowlist — Q may legitimately cite several of these links in one answer.
  ['- Only use links that appear in the excerpts or in this list:', 'as "Read more" at the end.'],
  // Contact-the-team sentence — the answer to "how do I contact the team?".
  ['For contacting the team, point to', 'the Members page /members.'],
  // Scripted self-description — the answer to "how do you work?".
  ['If asked how you work, say:', 'and you can make mistakes.'],
]

function withoutSayableParts(prompt: string): string {
  let text = prompt
  for (const [start, end] of CUTS) {
    const from = text.indexOf(start)
    const to = from < 0 ? -1 : text.indexOf(end, from)
    if (from < 0 || to < 0) continue
    text = `${text.slice(0, from)}\n\n${text.slice(to + end.length)}`
  }
  return text
}

export const LEAK_GUARD_TEXT = withoutSayableParts(SYSTEM_PROMPT)
