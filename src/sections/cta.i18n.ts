import type { Dict } from '../i18n/locale'

/** CTA card copy (CONTENT-V3 §12 / .kk §12). The button goes to the Handbook page, same tab. */
export interface CtaText {
  /** Headline, exactly one `*accent*` word. */
  title: string
  subtitle: string
  body: string
  button: string
}

export const text = {
  en: {
    title: 'Start where you *are*.',
    subtitle: "Beginner or already shipping, there's a place for you.",
    body: "Never written code? Come and learn. Already building? Come and lead. It's free, and whatever you build stays 100% yours.",
    button: 'Read the QairuHub Handbook',
  },
  kk: {
    title: 'Қазіргі деңгейіңнен *баста*.',
    subtitle: 'Жаңадан бастасаң да, әлдеқашан жоба шығарып жүрсең де, мұнда саған орын бар.',
    body: 'Код жазып көрмедің бе? Келіп үйрен. Жоба құрып жүрсің бе? Келіп басқалардың жетекшісі бол. Бәрі тегін, ал жасағаның 100% сенікі болып қалады.',
    button: 'The QairuHub Handbook-ты оқу',
  },
} satisfies Dict<CtaText>
