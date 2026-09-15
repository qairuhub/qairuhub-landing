/**
 * Members page data (CONTENT-V3 §17, V3-DECISIONS §6). Owned by WP10.
 *
 * Locale-invariant only: ids and names. Roles, focus lines and the who-to-ask copy live in
 * `src/pages/members.i18n.ts`, keyed by these ids, so TypeScript keeps both locales complete.
 *
 * PUBLIC DATA ONLY. No emails, phone numbers, Telegram / GitHub handles or invite links, ever.
 * Names stay in Latin letters on both locales (CONTENT-V3.kk translation decision 6).
 */

/** Executive board seat ids, in display order. */
export type BoardId = 'president' | 'cto' | 'finance' | 'media' | 'community'

export interface BoardMember {
  id: BoardId
  /** Full name as confirmed on 10 September 2026 (DECISIONS §6). */
  name: string
}

/** Elected at the Founding Session on 7 Sep 2026; role names as confirmed on 10 Sep 2026. */
export const board: readonly BoardMember[] = [
  { id: 'president', name: 'Tair Kaldybayev' },
  { id: 'cto', name: 'Mustafa Kassym' },
  { id: 'finance', name: 'Alikhan Altayev' },
  { id: 'media', name: 'Tamerlan Shaigali' },
  { id: 'community', name: 'Nazar Akanov' },
]

/**
 * The builders ("Team") list is public (DECISIONS §6 overrides the plan's `false`).
 *
 * Inclusion rule: only people whose name is spelled the same way in every research source
 * (CONTENT-V3 §17.3, the founding record, the team chat digests). Where a surname is uncertain the
 * entry would be first name + last initial; none of the kept entries has a known surname, so they
 * show the first name only. Role is "Team" unless a public role is confirmed.
 *
 * Left out on purpose (ambiguous): the two members both called Yernur; "Artem" / "Artyom"
 * (spelled differently across sources); the member listed as "Tair Khanapin" in the founding
 * record but under another display name elsewhere (and easily confused with the President);
 * founding-record names with no second source.
 */
export const SHOW_BUILDERS = true

export type BuilderId = 'nurik' | 'aidos' | 'miras' | 'nurkhan' | 'ibragim'

export interface Builder {
  id: BuilderId
  name: string
}

export const builders: readonly Builder[] = [
  { id: 'nurik', name: 'Nurik' },
  { id: 'aidos', name: 'Aidos' },
  { id: 'miras', name: 'Miras' },
  { id: 'nurkhan', name: 'Nurkhan' },
  { id: 'ibragim', name: 'Ibragim' },
]

/** Who-to-ask rows (HANDBOOK.md "Who to ask about what"): each row points at one board seat. */
export type AskRowId = 'start' | 'event' | 'platform' | 'money' | 'media' | 'serious'

export const askRows: readonly { id: AskRowId; seat: BoardId }[] = [
  { id: 'start', seat: 'community' },
  { id: 'event', seat: 'community' },
  { id: 'platform', seat: 'cto' },
  { id: 'money', seat: 'finance' },
  { id: 'media', seat: 'media' },
  { id: 'serious', seat: 'president' },
]

/** Two-letter monogram for a board card ("Tair Kaldybayev" → "TK"). Decorative only. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}
