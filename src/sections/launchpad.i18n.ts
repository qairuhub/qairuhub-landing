import type { Dict } from '../i18n/locale'

/**
 * Launchpad copy (CONTENT-V3 §4.1 + §4.4, KK from CONTENT-V3.kk.md). The Ask bar strings live
 * next to the assistant (`src/assistant/assistant.i18n.ts`). Every card names its mock with an
 * explicit `visual` key; nothing is derived from the (translated) title.
 */
export type LaunchpadVisual = 'learn' | 'build' | 'launch'

export interface LaunchpadCard {
  visual: LaunchpadVisual
  title: string
  body: string
}

export interface LaunchpadText {
  /** one `*accent*` word */
  title: string
  subtitle: string
  cta: { label: string }
  cards: readonly [LaunchpadCard, LaunchpadCard, LaunchpadCard]
  /** decorative (aria-hidden) labels of the "build" bento mock */
  bentoLabels: readonly [string, string, string, string]
}

export const text = {
  en: {
    title: 'Your launchpad for AI *builders*',
    subtitle: 'A Kazakhstan tech community, born at QAIRU. Everyone is welcome, at any skill level. Ask Q anything about QairuHub and get a straight answer.',
    cta: { label: 'Join QairuHub' },
    cards: [
      {
        visual: 'learn',
        title: 'New here?',
        body: 'Come to an event or a mentorship session. No experience needed, and nobody expects a project on day one.',
      },
      {
        visual: 'build',
        title: 'Have an idea?',
        body: 'Publish it on community.qairuhub.com, open roles with skills and hours, and invite developers from your university.',
      },
      {
        visual: 'launch',
        title: 'Have a demo?',
        body: 'Take it to QairuHub Demo Day, then on to hackathons and QairuHub Accelerator. It stays 100% yours.',
      },
    ],
    bentoLabels: ['Team', 'Repo', 'Demo', 'Stage'],
  },
  kk: {
    title: 'AI-мен жоба құратындарға арналған *старт* алаңы',
    subtitle: 'QAIRU-да дүниеге келген қазақстандық технологиялық қауымдастық. Кез келген деңгейдегі адамға орын бар. QairuHub туралы кез келген сұрағыңды Q‑ға қой, нақты жауап ал.',
    cta: { label: 'QairuHub-қа қосылу' },
    cards: [
      {
        visual: 'learn',
        title: 'Жаңадан келдің бе?',
        body: 'Іс-шараға немесе менторлық сессияға кел. Тәжірибе керек емес, бірінші күннен-ақ сенен ешкім жоба күтпейді.',
      },
      {
        visual: 'build',
        title: 'Идеяң бар ма?',
        body: 'Оны community.qairuhub.com-да жарияла, дағды мен сағатын көрсетіп рөлдер аш және университетіңдегі әзірлеушілерді шақыр.',
      },
      {
        visual: 'launch',
        title: 'Демоң дайын ба?',
        body: 'Оны QairuHub Demo Day-ге апар, кейін хакатондарға және QairuHub Accelerator-ға. Жоба 100% сенікі болып қалады.',
      },
    ],
    bentoLabels: ['Команда', 'Репо', 'Демо', 'Сахна'],
  },
} satisfies Dict<LaunchpadText>
