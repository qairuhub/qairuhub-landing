import type { Dict } from '../i18n/locale'

/** Latest news copy (CONTENT-V3 §11 / CONTENT-V3.kk §11). Card data: src/data/news.ts. */
export interface NewsText {
  /** Headline with one *accent* word. */
  title: string
  body: string
  allLink: string
  pastLabel: string
  /** [a11y] list label */
  listLabel: string
  /** [a11y] "(opens in a new tab)" */
  newTab: string
}

export const text = {
  en: {
    title: 'Latest *news*',
    body: "What's happening in QairuHub right now. The full feed is on t.me/qairuhub.",
    allLink: 'All updates on Telegram',
    pastLabel: 'Past',
    listLabel: 'Latest news',
    newTab: '(opens in a new tab)',
  },
  kk: {
    title: 'Соңғы *жаңалықтар*',
    body: 'QairuHub-та дәл қазір не болып жатыр. Толық лента t.me/qairuhub арнасында.',
    allLink: 'Барлық жаңалық Telegram-да',
    pastLabel: 'Өтті',
    listLabel: 'Соңғы жаңалықтар',
    newTab: '(жаңа бетте ашылады)',
  },
} satisfies Dict<NewsText>
