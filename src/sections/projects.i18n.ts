import type { Dict } from '../i18n/locale'
import type { ProjectBadge, ProjectStatus } from '../data/projects'

/** Highlighted projects copy (CONTENT-V3 §10 / CONTENT-V3.kk §10). Item data: src/data/projects.ts. */
export interface ProjectsText {
  /** Headline with one *accent* word. */
  title: string
  body: string
  /** [a11y] carousel region label */
  carouselLabel: string
  /** [a11y] "{n} of {total}" per slide */
  slideOf: string
  prev: string
  next: string
  pause: string
  play: string
  /** [a11y] announced after a manual move: "Project {n} of {total}: {name}" */
  current: string
  /** [a11y] "(opens in a new tab)" */
  newTab: string
  /** [a11y] prefix for the tag list */
  tagsLabel: string
  status: Record<ProjectStatus, string>
  badge: Record<ProjectBadge, string>
}

export const text = {
  en: {
    title: "What we're *building*",
    body: 'Real projects from the QairuHub community, with honest statuses. Yours can be next.',
    carouselLabel: 'Highlighted projects',
    slideOf: '{n} of {total}',
    prev: 'Previous project',
    next: 'Next project',
    pause: 'Pause carousel',
    play: 'Play carousel',
    current: 'Project {n} of {total}: {name}',
    newTab: '(opens in a new tab)',
    tagsLabel: 'Built with',
    status: {
      idea: 'Idea',
      recruiting: 'Recruiting',
      inProgress: 'In progress',
      demoShown: 'Demo shown',
      completed: 'Completed',
      stopped: 'Stopped',
    },
    badge: {
      live: 'Live',
      internal: 'Internal',
      openSource: 'Open source',
    },
  },
  kk: {
    title: 'Біз не *құрып* жатырмыз',
    body: 'QairuHub қауымдастығының нақты жобалары, шынайы статустарымен. Келесісі сенікі болуы мүмкін.',
    carouselLabel: 'Таңдаулы жобалар',
    slideOf: '{total} ішінен {n}',
    prev: 'Алдыңғы жоба',
    next: 'Келесі жоба',
    pause: 'Карусельді тоқтату',
    play: 'Карусельді қосу',
    current: '{total} жобаның ішінен {n}-жоба: {name}',
    newTab: '(жаңа бетте ашылады)',
    tagsLabel: 'Технологиялар',
    status: {
      idea: 'Идея',
      recruiting: 'Қабылдау',
      inProgress: 'Жұмыста',
      demoShown: 'Демо көрсетілді',
      completed: 'Аяқталды',
      stopped: 'Тоқтатылды',
    },
    badge: {
      live: 'Іске қосылған',
      internal: 'Ішкі құрал',
      openSource: 'Ашық код',
    },
  },
} satisfies Dict<ProjectsText>
