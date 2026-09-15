import type { Dict } from '../i18n/locale'

/**
 * Q panel and answer copy (CONTENT-V3 §19.1–§19.3, KK from CONTENT-V3.kk.md). Lazy: imported only by
 * the panel, the answer view and the live-region announcer. `fallbackIntro` / `fallbackNone` are
 * rendered by `shared/handbookSearch.ts` (server and browser offline answers) and kept here so the
 * dictionary mirrors the content keys; `newTab` is the shared `a11y.newTab` suffix.
 */
export interface PanelText {
  title: string
  greeting: string
  placeholder: string
  /** [a11y] */
  send: string
  /** [a11y] */
  close: string
  reset: string
  disclaimer: string
  thinking: string
  sources: string
  suggestions: readonly [string, string, string]
  fallbackIntro: string
  fallbackNone: string
  notAnnounced: string
  offTopic: string
  rateLimited: string
  dailyCap: string
  tooLong: string
  error: string
  readMore: string
  /** [a11y] suffix for links that open a new tab */
  newTab: string
}

export const panelText = {
  en: {
    title: 'Q · QairuHub assistant',
    greeting:
      "Hi, I'm Q, the QairuHub snail. Slow on legs, quick with answers. Ask me about joining, events, projects or the Accelerator.",
    placeholder: 'Ask Q…',
    send: 'Send',
    close: 'Close assistant',
    reset: 'New chat',
    disclaimer: "Q answers from the QairuHub Handbook and can make mistakes. Don't share passwords or personal data.",
    thinking: 'Q is thinking…',
    sources: 'From the QairuHub Handbook',
    suggestions: ['How do I join?', "What's happening this week?", 'How do I get my project featured?'],
    fallbackIntro: "I can't reach my AI brain right now, so here's what the QairuHub Handbook says:",
    fallbackNone: "I couldn't find that in the QairuHub Handbook. Try rephrasing, or check t.me/qairuhub.",
    notAnnounced: "That hasn't been announced yet. Follow t.me/qairuhub for the news.",
    offTopic: 'I only know about QairuHub, so ask me anything about that!',
    rateLimited: 'I need a short break. Try again in a minute, or read the QairuHub Handbook.',
    dailyCap: "I've answered a lot of questions today and I'm resting until tomorrow. The QairuHub Handbook has most answers.",
    tooLong: "That's a long one. Please keep questions under 500 characters.",
    error: 'Something went wrong on my side. Please try again.',
    readMore: 'Read more in the QairuHub Handbook',
    newTab: '(opens in a new tab)',
  },
  kk: {
    title: 'Q · QairuHub көмекшісі',
    greeting:
      'Сәлем, мен Q, QairuHub ұлуымын. Жүрісім баяу болса да, жауабым жылдам. QairuHub-қа қосылу, іс-шаралар, жобалар немесе Accelerator туралы сұра.',
    placeholder: 'Q‑ға сұрақ қой…',
    send: 'Жіберу',
    close: 'Көмекшіні жабу',
    reset: 'Жаңа чат',
    disclaimer: 'Q The QairuHub Handbook бойынша жауап береді және қателесуі мүмкін. Құпиясөзіңді және жеке деректеріңді жазба.',
    thinking: 'Q ойланып жатыр…',
    sources: 'The QairuHub Handbook-тан',
    suggestions: ['Қалай қосыламын?', 'Осы аптада не болады?', 'Жобамды қалай көрсетуге болады?'],
    fallbackIntro: 'Қазір AI миыма қосыла алмай тұрмын, сондықтан The QairuHub Handbook-та жазылғанын көрсетемін:',
    fallbackNone: 'Бұл The QairuHub Handbook-тан табылмады. Сұрақты басқаша қойып көр немесе t.me/qairuhub арнасын қара.',
    notAnnounced: 'Бұл әлі жарияланған жоқ. Жаңалықтарды t.me/qairuhub арнасынан қадағала.',
    offTopic: 'Мен тек QairuHub туралы білемін, сол туралы кез келген сұрақ қой!',
    rateLimited: 'Маған сәл демалыс керек. Бір минуттан кейін қайталап көр немесе The QairuHub Handbook-ты оқы.',
    dailyCap: 'Бүгін көп сұраққа жауап бердім, ертеңге дейін демаламын. Жауаптардың көбі The QairuHub Handbook-та бар.',
    tooLong: 'Сұрақ тым ұзын. 500 таңбадан аспасын.',
    error: 'Менің жағымда бірдеңе дұрыс болмады. Қайталап көр.',
    readMore: 'The QairuHub Handbook-тан толығырақ оқу',
    newTab: '(жаңа бетте ашылады)',
  },
} satisfies Dict<PanelText>
