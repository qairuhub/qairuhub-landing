import type { Dict } from '../i18n/locale'

/**
 * Supersize line (CONTENT-V3 §7 / .kk §7). Rendered uppercase in the compressed display face:
 * Anton for Latin, Oswald 600 for Cyrillic (same "Anton" family via unicode-range, plan D6).
 */
export interface SupersizeText {
  text: string
}

export const text = {
  en: {
    text: 'Builders over talkers. Projects over lectures.',
  },
  kk: {
    text: 'Сөз емес, іс. Лекция емес, жоба.',
  },
} satisfies Dict<SupersizeText>
