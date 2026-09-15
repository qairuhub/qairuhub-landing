/** 404 copy (CONTENT-V3 §20 + CONTENT-V3.kk §20). Owned by WP10. */
import type { Dict } from '../i18n/locale'

export interface NotFoundText {
  eyebrow: string
  title: string
  body: string
  cta: string
  handbook: string
}

export const text = {
  en: {
    eyebrow: '404',
    title: 'Nothing *here*.',
    body: 'The page may have moved, or the link is out of date.',
    cta: 'Back home',
    handbook: 'The QairuHub Handbook',
  },
  kk: {
    eyebrow: '404',
    title: 'Мұнда *ештеңе* жоқ.',
    body: 'Бет басқа жерге көшкен немесе сілтеме ескірген болуы мүмкін.',
    cta: 'Басты бетке',
    handbook: 'The QairuHub Handbook',
  },
} satisfies Dict<NotFoundText>
