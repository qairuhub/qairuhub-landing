import type { Dict, HrefTarget } from '../i18n/locale'
import { links } from '../i18n/shared'
import type { IconKey } from '../components/ui/icons'

/**
 * Header copy + structure (CONTENT-V3 §2 / CONTENT-V3.kk §2).
 *
 * Locale-invariant structure (hrefs, icons, order) lives in `NAV` below; the dictionaries hold
 * only visible strings, keyed by the same item keys so `satisfies Dict<HeaderText>` makes
 * TypeScript enforce that every Kazakh label exists. In-page targets are `HrefTarget`s and go
 * through `href(route, …)` at render time (`/#offer` on EN, `/kk/#offer` on KK).
 */

/** A nav destination: an internal, locale-aware target or an external URL (new tab). */
export type NavLink = { kind: 'route'; to: HrefTarget } | { kind: 'ext'; href: string }

const route = (to: HrefTarget): NavLink => ({ kind: 'route', to })
const ext = (href: string): NavLink => ({ kind: 'ext', href })

export type PlatformKey = 'teamFinder' | 'showcase' | 'events' | 'signUp'
export type AboutKey = 'handbook' | 'members' | 'telegram' | 'github'
export type NavKey = 'programs' | 'platform' | 'projects' | 'news' | 'about'
export type MenuNavKey = 'platform' | 'about'

export interface NavSubDef {
  link: NavLink
  icon: IconKey
}

export interface NavMenuDef<K extends string> {
  items: Record<K, NavSubDef>
}

/** Top-level order and destinations (CONTENT-V3 §2.1–2.4). */
export const NAV = {
  programs: { link: route('#offer') },
  platform: {
    link: route('#platform'),
    menu: {
      items: {
        teamFinder: { link: ext(links.platformTeamFinder), icon: 'search' },
        showcase: { link: ext(links.platformShowcase), icon: 'folder' },
        events: { link: ext(links.platformEvents), icon: 'calendar' },
        signUp: { link: ext(links.platformSignUp), icon: 'checkCircle' },
      },
    } satisfies NavMenuDef<PlatformKey>,
  },
  projects: { link: route('#projects') },
  news: { link: route('#news') },
  about: {
    link: route('handbook'),
    menu: {
      items: {
        handbook: { link: route('handbook'), icon: 'book' },
        members: { link: route('members'), icon: 'users' },
        telegram: { link: ext(links.telegram), icon: 'telegram' },
        github: { link: ext(links.github), icon: 'github' },
      },
    } satisfies NavMenuDef<AboutKey>,
  },
} as const

export const NAV_ORDER: readonly NavKey[] = ['programs', 'platform', 'projects', 'news', 'about']

/** Right-side actions (CONTENT-V3 §2.5). */
export const ACTIONS = {
  members: route('members'),
  join: route('#join'),
  openPlatform: ext(links.platform),
} as const

export interface SubText {
  title: string
  description: string
}

export interface MenuText<K extends string> {
  label: string
  items: Record<K, SubText>
}

export interface LocaleSwitchText {
  /** [a11y] group label */
  label: string
  en: string
  kk: string
  enTitle: string
  kkTitle: string
}

export interface HeaderText {
  nav: {
    programs: { label: string }
    platform: MenuText<PlatformKey>
    projects: { label: string }
    news: { label: string }
    about: MenuText<AboutKey>
  }
  actions: {
    members: string
    join: string
    openPlatform: string
  }
  localeSwitch: LocaleSwitchText
  a11y: {
    primaryNav: string
    openMenu: string
    closeMenu: string
    newTab: string
    home: string
  }
}

export const text = {
  en: {
    nav: {
      programs: { label: 'Programs' },
      platform: {
        label: 'Platform',
        items: {
          teamFinder: { title: 'Team Finder', description: 'Open roles and people by skill' },
          showcase: { title: 'Projects showcase', description: 'Public student projects, no login needed' },
          events: { title: 'Events', description: 'Sign up and get a Telegram reminder' },
          signUp: { title: 'Create an account', description: 'With your @qairu.edu.kz email' },
        },
      },
      projects: { label: 'Projects' },
      news: { label: 'News' },
      about: {
        label: 'About',
        items: {
          handbook: { title: 'The QairuHub Handbook', description: 'Everything about QairuHub, in one place' },
          members: { title: 'Members', description: 'The people who run QairuHub' },
          telegram: { title: 'Telegram channel', description: 'News lands here first' },
          github: { title: 'GitHub', description: 'Our code, in the open' },
        },
      },
    },
    actions: {
      members: 'Members',
      join: 'Join',
      openPlatform: 'Open platform',
    },
    localeSwitch: {
      label: 'Language',
      en: 'EN',
      kk: 'ҚАЗ',
      enTitle: 'English',
      kkTitle: 'Қазақша',
    },
    a11y: {
      primaryNav: 'Primary',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      newTab: '(opens in a new tab)',
      home: 'QairuHub home',
    },
  },
  kk: {
    nav: {
      programs: { label: 'Бағдарламалар' },
      platform: {
        label: 'Платформа',
        items: {
          teamFinder: { title: 'Команда табу', description: 'Ашық рөлдер және дағды бойынша адамдар' },
          showcase: { title: 'Жобалар витринасы', description: 'Студенттердің ашық жобалары, кірусіз көруге болады' },
          events: { title: 'Іс-шаралар', description: 'Тіркел, Telegram өзі еске салады' },
          signUp: { title: 'Аккаунт ашу', description: '@qairu.edu.kz поштасымен' },
        },
      },
      projects: { label: 'Жобалар' },
      news: { label: 'Жаңалықтар' },
      about: {
        label: 'Біз туралы',
        items: {
          handbook: { title: 'The QairuHub Handbook', description: 'QairuHub туралы бәрі бір жерде' },
          members: { title: 'Мүшелер', description: 'QairuHub-ты жүргізетін адамдар' },
          telegram: { title: 'Telegram арнасы', description: 'Жаңалықтар алдымен осында шығады' },
          github: { title: 'GitHub', description: 'Кодымыз ашық' },
        },
      },
    },
    actions: {
      members: 'Мүшелер',
      join: 'Қосылу',
      openPlatform: 'Платформаны ашу',
    },
    localeSwitch: {
      label: 'Тіл',
      en: 'EN',
      kk: 'ҚАЗ',
      enTitle: 'English',
      kkTitle: 'Қазақша',
    },
    a11y: {
      primaryNav: 'Негізгі мәзір',
      openMenu: 'Мәзірді ашу',
      closeMenu: 'Мәзірді жабу',
      newTab: '(жаңа бетте ашылады)',
      home: 'QairuHub басты беті',
    },
  },
} satisfies Dict<HeaderText>
