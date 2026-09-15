import type { Dict } from '../i18n/locale'

/**
 * Tools row copy (CONTENT-V3 §13 / .kk §13). The items are developer tools only
 * (`toolItems` in src/i18n/shared.ts, V3-DECISIONS §4); none of them is a partner.
 */
export interface ToolsText {
  /** Section headline, one `*accent*` word. */
  title: string
  /** Small caption under the row. */
  note: string
  /** [a11y] marquee label */
  a11yLabel: string
}

export const text = {
  en: {
    title: 'The *tools* our teams build with',
    note: 'Tools we use, not partnerships.',
    a11yLabel: 'Tools our teams use',
  },
  kk: {
    title: 'Командаларымыз қолданатын *құралдар*',
    note: 'Бұл біз қолданатын құралдар, серіктестік емес.',
    a11yLabel: 'Командаларымыз қолданатын құралдар',
  },
} satisfies Dict<ToolsText>
