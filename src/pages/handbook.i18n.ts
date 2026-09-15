/**
 * QairuHub Handbook page copy (CONTENT-V3 §18 + CONTENT-V3.kk §18, V3-DECISIONS §1 / §10). Owned by WP10.
 *
 * The plan's `book.*` keys are renamed for the Handbook (DECISIONS §1); the title is the QairuHub
 * Handbook, never "The Qairu Book". The body itself is English on both locales (DECISIONS §10);
 * the KK page shows `kkNote` above it.
 */
import type { Dict } from '../i18n/locale'

export interface HandbookText {
  eyebrow: string
  title: string
  intro: string
  /** "{date}" is filled from `handbook.updated` so the page never drifts from HANDBOOK.md */
  updated: string
  months: readonly [string, string, string, string, string, string, string, string, string, string, string, string]
  legend: string
  tocLabel: string
  tocToggle: string
  askCta: string
  platformCta: string
  feedback: string
  /** Kazakh page only; empty on EN */
  kkNote: string
  backToTop: string
  a11y: { newTab: string; toc: string; article: string }
}

export const text = {
  en: {
    eyebrow: 'Knowledge base',
    title: 'The QairuHub *Handbook*',
    intro:
      "What QairuHub is, how to join, what's coming and how we work, in one place. Q, our assistant, answers from this page, so if it isn't here, Q won't make it up.",
    updated: 'Last updated {date}',
    months: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    legend: 'Status labels: Confirmed · Planned · To be announced',
    tocLabel: 'Contents',
    tocToggle: 'Show contents',
    askCta: 'Ask Q',
    platformCta: 'Open platform',
    feedback: 'Something wrong or out of date? Tell us through the form or on t.me/qairuhub.',
    kkNote: '',
    backToTop: 'Back to top',
    a11y: { newTab: '(opens in a new tab)', toc: 'Handbook contents', article: 'The QairuHub Handbook' },
  },
  kk: {
    eyebrow: 'Білім базасы',
    title: 'The QairuHub *Handbook*',
    intro:
      'QairuHub деген не, қалай қосылуға болады, алда не бар және біз қалай жұмыс істейміз — бәрі бір жерде. Көмекшіміз Q осы бет бойынша жауап береді, сондықтан мұнда жоқ нәрсені Q ойдан шығармайды.',
    updated: 'Соңғы жаңарту: {date}',
    months: [
      'қаңтар',
      'ақпан',
      'наурыз',
      'сәуір',
      'мамыр',
      'маусым',
      'шілде',
      'тамыз',
      'қыркүйек',
      'қазан',
      'қараша',
      'желтоқсан',
    ],
    legend: 'Мәтіндегі белгілер: Confirmed (расталған) · Planned (жоспарда) · TBA (кейін хабарланады)',
    tocLabel: 'Мазмұны',
    tocToggle: 'Мазмұнды көрсету', // review
    askCta: 'Q‑дан сұра',
    platformCta: 'Платформаны ашу',
    feedback: 'Қате немесе ескірген ақпарат көрдің бе? Форма немесе t.me/qairuhub арқылы айт.',
    kkNote: 'The QairuHub Handbook әзірге ағылшын тілінде. Q сұрақтарыңа қазақша жауап бере алады.',
    backToTop: 'Жоғарыға', // review
    a11y: { newTab: '(жаңа бетте ашылады)', toc: 'Handbook мазмұны', article: 'The QairuHub Handbook' },
  },
} satisfies Dict<HandbookText>

/** "2026-09-14" → "14 September 2026" (EN) · "2026 жылғы 14 қыркүйек" (KK). */
export function formatHandbookDate(iso: string, locale: 'en' | 'kk', months: HandbookText['months']): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const [, y, mo, d] = m
  const month = months[Number(mo) - 1] ?? mo
  const day = String(Number(d))
  return locale === 'kk' ? `${y} жылғы ${day} ${month}` : `${day} ${month} ${y}`
}
