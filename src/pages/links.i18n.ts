/**
 * Links page copy. One entry per id in `src/data/links.ts`; `satisfies Dict<LinksText>` makes the
 * Kazakh side impossible to forget, and `Record<LinkId, …>` makes a link without copy a type error.
 */
import type { Dict } from '../i18n/locale'
import type { LinkId } from '../data/links'

export interface LinksText {
  eyebrow: string
  title: string
  intro: string
  items: Record<LinkId, { label: string; note: string }>
  /** shown on the row we want pressed first */
  featuredBadge: string
  footerNote: string
  a11y: { list: string; newTab: string }
}

export const text = {
  en: {
    eyebrow: 'Links',
    title: 'Everything QairuHub, in one place',
    intro: 'The links we hand out most often. Start with whatever is open right now.',
    items: {
      masterclass: {
        label: 'Vibe Coding Masterclass — sign up',
        note: 'Build your first AI app in one evening. No coding experience needed.',
      },
      telegram: { label: 'Telegram channel', note: 'News, dates and reminders land here first.' },
      instagram: { label: 'Instagram', note: 'Faces, events and what the club actually looks like.' },
      site: { label: 'qairuhub.com', note: 'What QairuHub is, our programs and projects.' },
      handbook: { label: 'The QairuHub Handbook', note: 'Everything about QairuHub in one document.' },
    },
    featuredBadge: 'Open now',
    footerNote: 'A Kazakhstan tech community, born at QAIRU.',
    a11y: { list: 'QairuHub links', newTab: '(opens in a new tab)' },
  },
  kk: {
    eyebrow: 'Сілтемелер',
    title: 'QairuHub-тың бәрі — бір бетте',
    intro: 'Жиі беретін сілтемелеріміз. Қазір ашық тұрғанынан баста.',
    items: {
      masterclass: {
        label: 'Vibe Coding шеберлік сыныбы — тіркелу',
        note: 'Бір кеште алғашқы AI қосымшаңызды жасайсыз. Код жазу тәжірибесі қажет емес.',
      },
      telegram: { label: 'Telegram арнасы', note: 'Жаңалықтар мен күндер алдымен осында шығады.' },
      instagram: { label: 'Instagram', note: 'Іс-шаралар мен клуб өмірі суреттермен.' },
      site: { label: 'qairuhub.com', note: 'QairuHub деген не, бағдарламалар мен жобалар.' },
      handbook: { label: 'The QairuHub Handbook', note: 'QairuHub туралы бәрі бір құжатта.' },
    },
    featuredBadge: 'Қазір ашық',
    footerNote: 'QAIRU-да дүниеге келген қазақстандық технологиялық қауымдастық.',
    a11y: { list: 'QairuHub сілтемелері', newTab: '(жаңа бетте ашылады)' },
  },
} satisfies Dict<LinksText>
