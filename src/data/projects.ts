/**
 * Highlighted projects (CONTENT-V3 §10.1 + DECISIONS §1), owned by WP8.
 *
 * Build-time data only: no runtime fetch, so the section height is stable and the journey's
 * bottom-anchored phases never move after load (landing-map risk #6).
 *
 * Public facts only (docs/HANDBOOK.md "Products QairuHub builds"). No project card names a person,
 * except the builder credit on theqairubook, which DECISIONS §1 allows on that one card.
 */
import { href, type Dict, type HrefTarget, type Route } from '../i18n/locale'
import { links } from '../i18n/shared'

export type ProjectStatus = 'idea' | 'recruiting' | 'inProgress' | 'demoShown' | 'completed' | 'stopped'
export type ProjectBadge = 'live' | 'internal' | 'openSource'

/**
 * A card link. External links open in a new tab; internal ones are locale-aware targets resolved
 * with `href(route, to)` (`'handbook#…'`, `'#join'`), so KK pages link to `/kk/…`.
 */
export interface ExternalLink {
  label: Dict<string>
  href: string
  external: true
}
export interface InternalLink {
  label: Dict<string>
  href: HrefTarget
  external?: false
}
export type DataLink = ExternalLink | InternalLink

/**
 * Button/anchor props for a data link: external → new tab (with the localized sr-only suffix),
 * internal → locale-aware path (`/kk/#join`, `/kk/handbook#…`).
 */
export function linkProps(route: Pick<Route, 'locale'>, link: DataLink, newTabLabel: string) {
  return link.external
    ? { href: link.href, external: true as const, newTabLabel }
    : { href: href(route, link.href), external: false as const }
}

export interface ProjectItem {
  id: string
  /** Locale-invariant product name, unless `localName` is set. */
  name: string
  /** A translated display name (e.g. "This landing + Q" / «Осы сайт + Q»). */
  localName?: Dict<string>
  tagline: Dict<string>
  status: ProjectStatus | null
  badges: ProjectBadge[]
  tags: string[]
  /** 0–2 links, first one is the primary action. */
  links: DataLink[]
  /** Builder credit ("by Tair Kaldybayev"). Only theqairubook carries one (DECISIONS §1). */
  credit?: Dict<string>
  /** The dashed "Your project here" card. Always last. */
  slot?: boolean
}

const HANDBOOK_FEATURED: HrefTarget = 'handbook#getting-your-project-featured-on-this-site'

export const projects: readonly ProjectItem[] = [
  {
    id: 'community',
    name: 'QairuHub Community',
    tagline: {
      en: 'The platform for people, projects and events at QAIRU.',
      kk: 'QAIRU адамдарына, жобалары мен іс-шараларына арналған платформа.',
    },
    status: 'inProgress',
    badges: ['live'],
    tags: ['Next.js', 'Supabase', 'Telegram'],
    links: [{ label: { en: 'Open', kk: 'Ашу' }, href: links.platform, external: true }],
  },
  {
    id: 'qairuhub-com',
    name: 'qairuhub.com',
    tagline: {
      en: "QairuHub's open-source website.",
      kk: 'QairuHub-тың ашық кодты сайты.',
    },
    status: 'inProgress',
    badges: ['live', 'openSource'],
    tags: ['Astro', 'Cloudflare'],
    links: [{ label: { en: 'Source code', kk: 'Бастапқы код' }, href: links.websiteSource, external: true }],
  },
  {
    id: 'core',
    name: 'core.qairuhub.com',
    tagline: {
      en: 'Internal tools for the core team: tasks, progress and a visual schedule.',
      kk: 'Негізгі командаға арналған ішкі құралдар: тапсырмалар, прогресс және көрнекі кесте.',
    },
    status: 'inProgress',
    badges: ['internal'],
    tags: ['TypeScript'],
    links: [],
  },
  {
    id: 'landing',
    name: 'This landing + Q',
    localName: { en: 'This landing + Q', kk: 'Осы сайт + Q' },
    tagline: {
      en: 'A WebGL journey from space to night, with Q, an assistant that answers from the QairuHub Handbook.',
      kk: 'Ғарыштан түнге дейінгі WebGL сапар және The QairuHub Handbook бойынша жауап беретін Q көмекшісі.',
    },
    status: 'inProgress',
    badges: ['live'],
    tags: ['React', 'three.js', 'OpenAI'],
    links: [
      { label: { en: 'Source code', kk: 'Бастапқы код' }, href: links.landingSource, external: true },
      { label: { en: 'Read the QairuHub Handbook', kk: 'The QairuHub Handbook-ты оқу' }, href: 'handbook' },
    ],
  },
  {
    id: 'theqairubook',
    name: 'theqairubook',
    tagline: {
      en: 'A 2004 thefacebook for QAIRU students: profiles, walls, pokes, chat and Reddit-style boards.',
      kk: 'QAIRU студенттеріне арналған 2004 жылғы thefacebook: профильдер, қабырғалар, «поктар», чат және Reddit тәрізді талқылау тақталары.',
    },
    status: null,
    badges: ['live', 'openSource'],
    tags: ['TypeScript', 'Railway'],
    links: [
      { label: { en: 'Open app', kk: 'Қосымшаны ашу' }, href: links.theqairubookApp, external: true },
      { label: { en: 'Source code', kk: 'Бастапқы код' }, href: links.theqairubookSource, external: true },
    ],
    credit: { en: 'by Tair Kaldybayev', kk: 'Авторы: Tair Kaldybayev' },
  },
  {
    id: 'ios',
    name: 'QairuHub iOS app',
    localName: { en: 'QairuHub iOS app', kk: 'QairuHub iOS қосымшасы' },
    tagline: {
      en: "QairuHub's community on your phone.",
      kk: 'QairuHub қауымдастығы телефоныңда.',
    },
    status: 'idea',
    badges: [],
    tags: ['iOS'],
    links: [],
  },
  {
    id: 'ideas-bot',
    name: 'Team ideas bot',
    localName: { en: 'Team ideas bot', kk: 'Идеялар боты' },
    tagline: {
      en: "A Telegram bot that collects the team's ideas and sends a daily digest.",
      kk: 'Команданың идеяларын жинап, күн сайын қорытынды жіберетін Telegram бот.',
    },
    status: 'inProgress',
    badges: ['internal'],
    tags: ['Telegram', 'Gemini'],
    links: [],
  },
  {
    id: 'cowork',
    name: 'QairuHub Cowork',
    tagline: {
      en: 'A cowork-time and schedule tool, built by new contributors with a mentor.',
      kk: 'Жаңа контрибьюторлар ментормен бірге жасап жатқан коворкинг уақыты мен кесте құралы.',
    },
    status: 'inProgress',
    badges: ['internal'],
    tags: ['TypeScript'],
    links: [],
  },
  {
    id: 'your-project',
    name: 'Your project here',
    localName: { en: 'Your project here', kk: 'Мұнда сенің жобаң' },
    tagline: {
      en: "Student projects get featured too. Publish yours on community.qairuhub.com, show a demo and tell us, and it can be featured here.",
      kk: 'Студенттердің жобалары да осында шығады. Жобаңды community.qairuhub.com-да жарияла, демо көрсет және бізге айт — ол осында көрсетілуі мүмкін.',
    },
    status: null,
    badges: [],
    tags: [],
    links: [
      { label: { en: 'Tell us about it', kk: 'Бізге айту' }, href: '#join' },
      { label: { en: 'Publish on the platform', kk: 'Платформада жариялау' }, href: links.platform, external: true },
    ],
    slot: true,
  },
]

/** The "How to get featured" Handbook anchor, shown as a small link on the slot card. */
export const featuredHowTo: InternalLink = {
  label: { en: 'How to get featured', kk: 'Қалай көрсетуге болады' },
  href: HANDBOOK_FEATURED,
}
