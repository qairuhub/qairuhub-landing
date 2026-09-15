import type { Dict } from '../i18n/locale'

/**
 * Ecosystem marquee copy (V3-DECISIONS §4, which replaces CONTENT-V3 §5's title and item list).
 * The items themselves are locale-invariant Latin names in `ecosystemRows` (src/i18n/shared.ts).
 * Never pair those names with "partner", "sponsor", "backed by" or "in partnership with".
 */
export interface EcosystemText {
  /** Section headline, one `*accent*` word. */
  title: string
  /** Small caption under the two rows. */
  caption: string
  /** [a11y] marquee row label: `{title}` (plain text) and `{n}` (1-based row number). */
  marqueeRow: string
}

export const text = {
  en: {
    title: 'The *ecosystem* and tools we build with',
    caption: 'Tools, platforms and ecosystem around our builders.',
    marqueeRow: '{title}, row {n}',
  },
  kk: {
    title: 'Біз бірге құратын *экожүйе* мен құралдар',
    caption: 'Жоба құрушыларымызды қоршаған құралдар, платформалар мен экожүйе.',
    marqueeRow: '{title}, {n}-қатар',
  },
} satisfies Dict<EcosystemText>
