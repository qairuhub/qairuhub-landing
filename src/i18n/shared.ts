/**
 * Locale-invariant data (V3-BUILD-PLAN D1, owned by WP0): brand, external links, section ids,
 * select option VALUES, and the ecosystem / tools item lists. Translatable copy lives in the
 * section dictionaries (`src/sections/<name>.i18n.ts`), never here.
 *
 * Public data only: no emails, phone numbers, personal handles or private invite links.
 */
import type { Dict } from './locale'

/** Production origin of this landing. build-html.mjs reads SITE_ORIGIN from env with this default. */
export const SITE_ORIGIN = 'https://qairuhub-landing.pages.dev'

export const brand = {
  name: 'QairuHub',
  /** The 3D + DOM wordmark stays lowercase Latin in both locales (no Cyrillic in Courgette). */
  wordmark: 'qairuhub',
  tagline: {
    en: 'Learn it. Build it. Launch it.',
    kk: 'Үйрен. Құр. Іске қос.',
  } satisfies Dict<string>,
} as const

const PLATFORM = 'https://community.qairuhub.com'

/** Every external URL the site links to. Q's link allowlist can derive from `Object.values(links)`. */
export const links = {
  /* community.qairuhub.com: public routes link directly, auth routes via /sign-in?next= */
  platform: PLATFORM,
  platformSignUp: `${PLATFORM}/sign-up`,
  platformSignIn: `${PLATFORM}/sign-in`,
  platformShowcase: `${PLATFORM}/showcase`,
  platformClubs: `${PLATFORM}/clubs`,
  platformTeamFinder: `${PLATFORM}/sign-in?next=/find`,
  platformPeople: `${PLATFORM}/sign-in?next=/people`,
  platformProjects: `${PLATFORM}/sign-in?next=/projects`,
  platformEvents: `${PLATFORM}/sign-in?next=/events`,

  /* channels */
  telegram: 'https://t.me/qairuhub',
  instagram: 'https://instagram.com/qairuhub',
  github: 'https://github.com/qairuhub',

  /* QairuHub web properties and source code */
  website: 'https://qairuhub.com',
  websiteSource: 'https://github.com/qairuhub/qairuhub-web',
  /** "Source code of this site" (private repo for now; no "private" label on the site, DECISIONS §1). */
  landingSource: 'https://github.com/tairqaldy/qairuhub-landing-clean',

  /* theqairubook (Highlighted projects card, DECISIONS §1) */
  theqairubookApp: 'https://theqairubook-app-production.up.railway.app',
  theqairubookSource: 'https://github.com/tairqaldy/theqairubook',

  /* ecosystem */
  hackalem: 'https://hackalem.ai',
} as const

export type LinkKey = keyof typeof links

/** DOM ids of the home sections (CONTENT-V3 §0, plan D5). */
export const sectionIds = {
  top: 'top',
  launchpad: 'launchpad',
  ecosystem: 'ecosystem',
  accelerator: 'accelerator',
  supersize: 'supersize',
  platform: 'platform',
  offer: 'offer',
  projects: 'projects',
  news: 'news',
  cta: 'cta',
  tools: 'tools',
  story: 'story',
  join: 'join',
  footer: 'footer',
} as const

export type SectionId = (typeof sectionIds)[keyof typeof sectionIds]

/** Join form "interest" option values (CONTENT-V3 §15.3). Labels live in form.i18n.ts. */
export const interestValues = ['build', 'project', 'events', 'media', 'business', 'mentor', 'partner', 'other'] as const

export type InterestValue = (typeof interestValues)[number]

export function isInterestValue(value: unknown): value is InterestValue {
  return typeof value === 'string' && (interestValues as readonly string[]).includes(value)
}

/** Look of a text wordmark placeholder (matches LogoMark's styles). */
export type WordmarkStyle = 'caps' | 'sans' | 'mono' | 'serif' | 'script'

export interface WordmarkItem {
  name: string
  style: WordmarkStyle
}

/**
 * Ecosystem marquee (DECISIONS §4): text wordmarks only, no third-party logo files. Never pair
 * these names with "partner", "sponsor", "backed by" or "in partnership with".
 */
export const ecosystemRows: readonly [readonly WordmarkItem[], readonly WordmarkItem[]] = [
  [
    { name: 'Alem.ai', style: 'mono' },
    { name: 'Astana Hub', style: 'sans' },
    { name: 'HackAlem AI', style: 'caps' },
    { name: 'QairuHub Accelerator', style: 'serif' },
    { name: 'QairuHub Community', style: 'sans' },
  ],
  [
    { name: 'Anthropic Claude', style: 'serif' },
    { name: 'OpenAI', style: 'sans' },
    { name: 'Google Gemini', style: 'sans' },
    { name: 'Cursor', style: 'mono' },
    { name: 'Lovable', style: 'script' },
    { name: 'Qaldy AI', style: 'caps' },
  ],
]

/** Both ecosystem rows, flattened in order. */
export const ecosystemItems: readonly WordmarkItem[] = [...ecosystemRows[0], ...ecosystemRows[1]]

/** Tools row (DECISIONS §4): developer tools only; must not repeat ecosystem row 2. */
export const toolItems: readonly WordmarkItem[] = [
  { name: 'GitHub', style: 'sans' },
  { name: 'Telegram', style: 'sans' },
  { name: 'Figma', style: 'sans' },
  { name: 'Cloudflare', style: 'sans' },
  { name: 'Vercel', style: 'caps' },
  { name: 'Railway', style: 'mono' },
  { name: 'Hugging Face', style: 'sans' },
  { name: 'Python', style: 'mono' },
  { name: 'TypeScript', style: 'sans' },
  { name: 'Codex', style: 'mono' },
]
