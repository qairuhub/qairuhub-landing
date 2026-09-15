/**
 * Latest news (CONTENT-V3 §11.1 + DECISIONS §3), owned by WP8.
 *
 * Build-time data only (no runtime fetch → stable page height, landing-map risk #6). The order is
 * the CONTENT order: the first three sit in the top row on desktop.
 *
 * `expires` is an ISO datetime in Astana time (+05:00). After it the card keeps its place and
 * shows the "Past" label; it is never removed at runtime, so the layout never shifts.
 */
import type { Dict } from '../i18n/locale'
import { links } from '../i18n/shared'
import type { DataLink } from './projects'

export interface NewsItem {
  id: string
  /** ISO date (Astana) the item is about, or null for undated items. */
  date: string | null
  dateLabel: Dict<string>
  tag: Dict<string>
  title: Dict<string>
  body: Dict<string>
  link: DataLink
  /** ISO datetime; after it the card shows the "Past" label. */
  expires?: string
  /** Note for editors, never rendered. */
  verify?: string
}

export const news: readonly NewsItem[] = [
  {
    id: 'hackathon-mentorship-2026-09-15',
    date: '2026-09-15',
    dateLabel: { en: 'Sep 15, 2026 · 14:00', kk: '2026 жылғы 15 қыркүйек · 14:00' },
    tag: { en: 'Event', kk: 'Іс-шара' },
    title: {
      en: 'QairuHub Hackathon Mentorship with Sanzhar Madiyev, Head of Education & Hackathon at BAITC',
      kk: 'BAITC-тің білім беру және хакатондар жөніндегі жетекшісі Санжар Мадиевпен QairuHub Hackathon Mentorship',
    },
    body: {
      en: 'Our first offline session, with the organiser of HackAlem AI: how to prepare for HackAlem AI, what judges look for, and help finding a team. 14:00, Shai Cafeteria.',
      kk: 'HackAlem AI ұйымдастырушысымен алғашқы офлайн сессиямыз: HackAlem AI-ға қалай дайындалу керек, қазылар нені бағалайды және команда табуға көмек. Сағат 14:00, Shai кафетерийі.',
    },
    link: { label: { en: 'Details on Telegram', kk: 'Толығырақ Telegram-да' }, href: links.telegram, external: true },
    expires: '2026-09-15T23:59:59+05:00',
  },
  {
    id: 'vibe-coding-masterclass',
    date: null,
    dateLabel: { en: 'Coming soon', kk: 'Жақында' },
    tag: { en: 'Masterclass', kk: 'Мастер-класс' },
    title: { en: 'Vibe-coding Masterclass', kk: 'Vibe-coding Masterclass' },
    body: {
      en: "A hands-on session on building faster with AI coding tools. We're preparing it now; the date and place will be announced on the channel.",
      kk: 'AI кодинг құралдарымен жылдамырақ жасауды үйрететін практикалық сессия. Қазір дайындап жатырмыз, күні мен орны арнада жарияланады.',
    },
    link: { label: { en: 'Follow the channel', kk: 'Арнаға жазылу' }, href: links.telegram, external: true },
  },
  {
    id: 'your-project-featured',
    date: null,
    dateLabel: { en: 'Open to everyone', kk: 'Барлығына ашық' },
    tag: { en: 'Your project', kk: 'Сенің жобаң' },
    title: { en: 'Your project could be featured here', kk: 'Сенің жобаң да осында шығуы мүмкін' },
    body: {
      en: "News and the projects carousel aren't just for the core team. Publish your project on community.qairuhub.com, show a demo, and tell us. The media team picks projects to share here, on Telegram and on Instagram.",
      kk: 'Жаңалықтар мен жобалар каруселі тек негізгі командаға арналмаған. Жобаңды community.qairuhub.com-да жарияла, демо көрсет және бізге айт. Медиа команда осында, Telegram мен Instagram-да бөлісетін жобаларды таңдайды.',
    },
    link: {
      label: { en: 'How to get featured', kk: 'Қалай көрсетуге болады' },
      href: 'handbook#getting-your-project-featured-on-this-site',
    },
  },
  {
    id: 'hackalem-registration-closes',
    date: '2026-09-19',
    dateLabel: { en: 'Sep 19, 2026', kk: '2026 жылғы 19 қыркүйек' },
    tag: { en: 'Hackathon', kk: 'Хакатон' },
    title: { en: 'HackAlem AI registration closes Sep 19', kk: 'HackAlem AI-ға тіркелу 19 қыркүйекте жабылады' },
    body: {
      en: 'The agentic-AI hackathon by Alem with OpenAI runs on Sep 23 at Astana EXPO. Teams of up to three, 18+. Register as a QAIRU student.',
      kk: 'Alem OpenAI-мен бірге өткізетін AI-агенттер хакатоны 23 қыркүйекте Astana EXPO-да өтеді. Командада үш адамға дейін, 18+. QAIRU студенті ретінде тіркел.',
    },
    link: { label: { en: 'hackalem.ai', kk: 'hackalem.ai' }, href: links.hackalem, external: true },
    expires: '2026-09-19T23:59:59+05:00',
  },
  {
    id: 'platform-first-version',
    date: '2026-09',
    dateLabel: { en: 'Sep 2026', kk: '2026 жылғы қыркүйек' },
    tag: { en: 'Platform', kk: 'Платформа' },
    title: { en: 'community.qairuhub.com: first version online', kk: 'community.qairuhub.com: алғашқы нұсқасы онлайн' },
    body: {
      en: 'An early version of our platform is online: Team Finder, projects, events and people. Sign up with your @qairu.edu.kz email; an admin approves each account.',
      kk: 'Платформамыздың алғашқы нұсқасы жұмыс істеп тұр: команда табу, жобалар, іс-шаралар және адамдар. @qairu.edu.kz поштаңмен тіркел, әр аккаунтты әкімші растайды.',
    },
    link: { label: { en: 'Open the platform', kk: 'Платформаны ашу' }, href: links.platform, external: true },
  },
  {
    id: 'club-fair-2026-09-09',
    date: '2026-09-09',
    dateLabel: { en: 'Sep 9, 2026', kk: '2026 жылғы 9 қыркүйек' },
    tag: { en: 'Community', kk: 'Қауымдастық' },
    title: { en: 'QairuHub met the campus at the Club Fair', kk: 'QairuHub клубтар жәрмеңкесінде кампуспен танысты' },
    body: {
      en: 'Two days after our founding session, we opened registration at the QAIRU Club Fair. Missed it? The form is at the bottom of this page.',
      kk: 'Құрылтай сессиямыздан екі күн өткен соң QAIRU клубтар жәрмеңкесінде тіркеуді аштық. Үлгермей қалдың ба? Форма осы беттің төменгі жағында.',
    },
    link: { label: { en: 'Join', kk: 'Қосылу' }, href: '#join' },
  },
]

/** `true` once `now` is after the item's `expires` (items without one never go past). */
export function isNewsPast(item: Pick<NewsItem, 'expires'>, now: number): boolean {
  if (!item.expires) return false
  const t = Date.parse(item.expires)
  return Number.isFinite(t) && now > t
}
