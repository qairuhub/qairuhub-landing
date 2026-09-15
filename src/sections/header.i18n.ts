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

export type ProgramsKey = 'events' | 'hackathons' | 'mentorship' | 'demoDay' | 'accelerator'
export type PlatformKey = 'teamFinder' | 'showcase' | 'events' | 'clubs' | 'signUp'
export type AboutKey = 'handbook' | 'members' | 'principles' | 'github' | 'telegram'
export type NavKey = 'programs' | 'platform' | 'projects' | 'news' | 'about'
export type MenuNavKey = 'programs' | 'platform' | 'about'

export interface NavSubDef {
  link: NavLink
  icon: IconKey
}

export interface NavMenuDef<K extends string> {
  items: Record<K, NavSubDef>
  cta: NavLink
  /** the CTA also opens the Q assistant panel (About → "Ask Q") */
  opensAssistant?: boolean
}

/** Top-level order and destinations (CONTENT-V3 §2.1–2.4). */
export const NAV = {
  programs: {
    link: route('#offer'),
    menu: {
      items: {
        events: { link: route('#offer'), icon: 'calendar' },
        hackathons: { link: route('#offer'), icon: 'bolt' },
        mentorship: { link: route('#offer'), icon: 'users' },
        demoDay: { link: route('#offer'), icon: 'sparkle' },
        accelerator: { link: route('#accelerator'), icon: 'rocket' },
      },
      cta: route('#news'),
    } satisfies NavMenuDef<ProgramsKey>,
  },
  platform: {
    link: route('#platform'),
    menu: {
      items: {
        teamFinder: { link: ext(links.platformTeamFinder), icon: 'search' },
        showcase: { link: ext(links.platformShowcase), icon: 'folder' },
        events: { link: ext(links.platformEvents), icon: 'calendar' },
        clubs: { link: ext(links.platformClubs), icon: 'grid' },
        signUp: { link: ext(links.platformSignUp), icon: 'checkCircle' },
      },
      cta: route('#platform'),
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
        principles: { link: route('handbook#qairuhubs-principles'), icon: 'checkCircle' },
        github: { link: ext(links.github), icon: 'folder' },
        telegram: { link: ext(links.telegram), icon: 'pencil' },
      },
      cta: route('#launchpad'),
      opensAssistant: true,
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

export interface CtaText {
  title: string
  description: string
  cta: string
}

export interface MenuText<K extends string> {
  label: string
  items: Record<K, SubText>
  cta: CtaText
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
    programs: MenuText<ProgramsKey>
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
      programs: {
        label: 'Programs',
        items: {
          events: { title: 'Events & masterclasses', description: 'Workshops, meetups and hands-on sessions' },
          hackathons: { title: 'Hackathons & prep', description: 'Get hackathon-ready and find a team' },
          mentorship: { title: 'Mentorship', description: 'Learn from people one step ahead' },
          demoDay: { title: 'QairuHub Demo Day', description: 'A stage for what you built · planned, date TBA' },
          accelerator: { title: 'QairuHub Accelerator', description: 'For teams past the demo · dates TBA' },
        },
        cta: {
          title: 'Latest news',
          description: 'Events, hackathon prep and what is coming next.',
          cta: 'See the news',
        },
      },
      platform: {
        label: 'Platform',
        items: {
          teamFinder: { title: 'Team Finder', description: 'Open roles and people by skill' },
          showcase: { title: 'Projects showcase', description: 'Public student projects, no login needed' },
          events: { title: 'Events', description: 'Sign up and get a Telegram reminder' },
          clubs: { title: 'Clubs', description: 'Every student club, straight into Telegram' },
          signUp: { title: 'Create an account', description: 'With your @qairu.edu.kz email' },
        },
        cta: {
          title: 'This is the Hub',
          description: 'See how the platform works before you sign up.',
          cta: 'Take the tour',
        },
      },
      projects: { label: 'Projects' },
      news: { label: 'News' },
      about: {
        label: 'About',
        items: {
          handbook: { title: 'The QairuHub Handbook', description: 'Everything about QairuHub, in one place' },
          members: { title: 'Members', description: 'The people who run QairuHub' },
          principles: { title: 'Our principles', description: 'Builders over talkers, and five more' },
          github: { title: 'GitHub', description: 'Our code, in the open' },
          telegram: { title: 'Telegram channel', description: 'News lands here first' },
        },
        cta: {
          title: 'Ask Q',
          description: 'Got a question about QairuHub? Our snail answers.',
          cta: 'Ask now',
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
      programs: {
        label: 'Бағдарламалар',
        items: {
          events: { title: 'Іс-шаралар мен мастер-кластар', description: 'Воркшоптар, митаптар және практикалық сессиялар' },
          hackathons: { title: 'Хакатондар және дайындық', description: 'Хакатонға дайындал, команда тап' },
          mentorship: { title: 'Менторлық', description: 'Сенен бір қадам алда жүргендерден үйрен' },
          demoDay: { title: 'QairuHub Demo Day', description: 'Жобаңа арналған сахна · жоспарда, күні кейін хабарланады' },
          accelerator: {
            title: 'QairuHub Accelerator',
            description: 'Демоға жеткен командаларға · күні кейін хабарланады',
          },
        },
        cta: {
          title: 'Соңғы жаңалықтар',
          description: 'Іс-шаралар, хакатонға дайындық және алдағы жоспарлар.',
          cta: 'Жаңалықтарды көру',
        },
      },
      platform: {
        label: 'Платформа',
        items: {
          teamFinder: { title: 'Команда табу', description: 'Ашық рөлдер және дағды бойынша адамдар' },
          showcase: { title: 'Жобалар витринасы', description: 'Студенттердің ашық жобалары, кірусіз көруге болады' },
          events: { title: 'Іс-шаралар', description: 'Тіркел, Telegram өзі еске салады' },
          clubs: { title: 'Клубтар', description: 'Студенттік клубтардың бәрі, Telegram-ға тікелей өту' },
          signUp: { title: 'Аккаунт ашу', description: '@qairu.edu.kz поштасымен' },
        },
        cta: {
          title: 'Міне, Hub',
          description: 'Тіркелмей тұрып, платформаның қалай жұмыс істейтінін көр.',
          cta: 'Көріп шығу',
        },
      },
      projects: { label: 'Жобалар' },
      news: { label: 'Жаңалықтар' },
      about: {
        label: 'Біз туралы',
        items: {
          handbook: { title: 'The QairuHub Handbook', description: 'QairuHub туралы бәрі бір жерде' },
          members: { title: 'Мүшелер', description: 'QairuHub-ты жүргізетін адамдар' },
          principles: { title: 'Қағидаттарымыз', description: '«Сөз емес, іс» және тағы бес қағидат' },
          github: { title: 'GitHub', description: 'Кодымыз ашық' },
          telegram: { title: 'Telegram арнасы', description: 'Жаңалықтар алдымен осында шығады' },
        },
        cta: {
          title: 'Q‑дан сұра',
          description: 'QairuHub туралы сұрағың бар ма? Ұлу жауап береді.',
          cta: 'Сұрау',
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
