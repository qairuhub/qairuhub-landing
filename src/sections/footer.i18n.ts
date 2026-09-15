import type { Dict } from '../i18n/locale'
import { links } from '../i18n/shared'
import type { NavLink } from './header.i18n'

/**
 * Footer copy + structure (CONTENT-V3 §16, V3-DECISIONS §1).
 *
 * `FOOTER_LINKS` is the main link row, `FOOTER_SOURCE_LINKS` the quieter open-source row
 * (DECISIONS §1: "Source code of this site" plus theqairubook live + source). Socials are
 * Telegram / Instagram / GitHub only; their labels are the same in both locales.
 */

export type FooterLinkKey =
  | 'programs'
  | 'platform'
  | 'projects'
  | 'news'
  | 'join'
  | 'members'
  | 'handbook'
  | 'privacy'
  | 'community'

export type FooterSourceKey = 'landingSource' | 'theqairubookApp' | 'theqairubookSource'

export const FOOTER_LINKS: readonly (readonly [FooterLinkKey, NavLink])[] = [
  ['programs', { kind: 'route', to: '#offer' }],
  ['platform', { kind: 'route', to: '#platform' }],
  ['projects', { kind: 'route', to: '#projects' }],
  ['news', { kind: 'route', to: '#news' }],
  ['join', { kind: 'route', to: '#join' }],
  ['members', { kind: 'route', to: 'members' }],
  ['handbook', { kind: 'route', to: 'handbook' }],
  ['privacy', { kind: 'route', to: 'handbook#privacy-on-this-site' }],
  ['community', { kind: 'ext', href: links.platform }],
]

export const FOOTER_SOURCE_LINKS: readonly (readonly [FooterSourceKey, string])[] = [
  ['landingSource', links.landingSource],
  ['theqairubookApp', links.theqairubookApp],
  ['theqairubookSource', links.theqairubookSource],
]

export const FOOTER_SOCIALS = [
  { label: 'Telegram', href: links.telegram, icon: 'telegram' },
  { label: 'Instagram', href: links.instagram, icon: 'instagram' },
  { label: 'GitHub', href: links.github, icon: 'github' },
] as const

export interface FooterText {
  links: Record<FooterLinkKey, string>
  source: Record<FooterSourceKey, string>
  copyright: string
  tagline: string
  a11y: {
    footerNav: string
    sourceNav: string
    socials: string
  }
}

export const text = {
  en: {
    links: {
      programs: 'Programs',
      platform: 'Platform',
      projects: 'Projects',
      news: 'News',
      join: 'Join',
      members: 'Members',
      handbook: 'The QairuHub Handbook',
      privacy: 'Privacy',
      community: 'community.qairuhub.com',
    },
    source: {
      landingSource: 'Source code of this site',
      theqairubookApp: 'theqairubook',
      theqairubookSource: 'theqairubook source code',
    },
    copyright: '© 2026 QairuHub. A Kazakhstan tech community, born at QAIRU.',
    tagline: 'Learn it. Build it. Launch it.',
    a11y: {
      footerNav: 'Footer',
      sourceNav: 'Open source',
      socials: 'QairuHub on social media',
    },
  },
  kk: {
    links: {
      programs: 'Бағдарламалар',
      platform: 'Платформа',
      projects: 'Жобалар',
      news: 'Жаңалықтар',
      join: 'Қосылу',
      members: 'Мүшелер',
      handbook: 'The QairuHub Handbook',
      privacy: 'Құпиялылық',
      community: 'community.qairuhub.com',
    },
    source: {
      landingSource: 'Осы сайттың бастапқы коды',
      theqairubookApp: 'theqairubook',
      theqairubookSource: 'theqairubook бастапқы коды',
    },
    copyright: '© 2026 QairuHub. QAIRU-да дүниеге келген қазақстандық технологиялық қауымдастық.',
    tagline: 'Үйрен. Құр. Іске қос.',
    a11y: {
      footerNav: 'Төменгі мәзір',
      sourceNav: 'Ашық код',
      socials: 'QairuHub әлеуметтік желілерде',
    },
  },
} satisfies Dict<FooterText>
