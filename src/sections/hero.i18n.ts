import type { Dict } from '../i18n/locale'

/**
 * Hero copy (CONTENT-V3 §3, lead line per V3-DECISIONS §2). The visible wordmark is the 3D
 * `brand.wordmark` drawn by SkyScene and stays lowercase Latin in both locales, so the only
 * text here is the screen-reader page title.
 */
export interface HeroText {
  /** sr-only h1 of the home page */
  srTitle: string
}

export const text = {
  en: {
    srTitle: 'QairuHub — a Kazakhstan tech community, born at QAIRU. Learn it. Build it. Launch it.',
  },
  kk: {
    srTitle: 'QairuHub — QAIRU-да дүниеге келген қазақстандық технологиялық қауымдастық. Үйрен. Құр. Іске қос.',
  },
} satisfies Dict<HeroText>
