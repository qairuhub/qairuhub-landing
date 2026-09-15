import type { Dict } from '../i18n/locale'

/**
 * Platform showcase, "This is the Hub" (CONTENT-V3 §8 / CONTENT-V3.kk §8, DECISIONS §2).
 *
 * The concept comes from the platform's own "This is the Hub" demo, rebuilt in the landing's
 * design. Every row is fictional sample data (the window shows a "Sample data" badge); field
 * shapes follow the platform's real data models: project status, open role skill / hours /
 * deadline, event type / capacity, profile program / year / skills / availability.
 *
 * KK strings marked `review` are landing-only wording with no platform string yet.
 */

export type PlatformScreen = 'finder' | 'projects' | 'events' | 'people'
export type ProjectStatus = 'idea' | 'recruiting' | 'inProgress' | 'demoShown'
export type Availability = 'projects' | 'collaboration'

export interface PlatformTab {
  screen: PlatformScreen
  label: string
  /** caption under the window while this tab is active */
  caption: string
}

export interface FinderRow {
  role: string
  project: string
  skill: string
  hours: string
  deadline: string
}

export interface ProjectRow {
  name: string
  promise: string
  status: ProjectStatus
  team: number
}

export interface EventRow {
  /** "Oct 2" / "2 қаз.": the date tile takes the digits as the day and the rest as the month */
  date: string
  title: string
  type: string
  time: string
  place: string
  going: number
  capacity: number
}

export interface PersonCard {
  name: string
  program: string
  year: string
  skills: readonly string[]
  availability: Availability
}

export interface PlatformText {
  pill: string
  /** one `*accent*` word */
  title: string
  body: string
  /** [a11y] */
  tablistLabel: string
  sampleBadge: string
  app: {
    name: string
    /** Home · Team Finder · Projects · Events · People · Clubs · Resources (fixed order) */
    sidebar: readonly [string, string, string, string, string, string, string]
    search: string
    secondary: string
    primary: string
  }
  tabs: readonly [PlatformTab, PlatformTab, PlatformTab, PlatformTab]
  finder: {
    title: string
    subtitle: string
    modes: readonly [string, string]
    filters: readonly string[]
    /** `{n}` */
    count: string
    columns: { role: string; project: string; skill: string; hours: string; deadline: string }
    rows: readonly FinderRow[]
    action: string
  }
  projects: {
    title: string
    subtitle: string
    filters: readonly string[]
    /** `{n}` */
    count: string
    status: Record<ProjectStatus, string>
    /** `{n}` */
    team: string
    rows: readonly ProjectRow[]
  }
  events: {
    title: string
    subtitle: string
    filters: readonly string[]
    /** `{n}` */
    count: string
    /** `{x}` going of `{cap}` */
    going: string
    rows: readonly EventRow[]
    action: string
  }
  people: {
    title: string
    subtitle: string
    filters: readonly string[]
    /** `{n}` */
    count: string
    availability: Record<Availability, string>
    cards: readonly PersonCard[]
    action: string
  }
  ctaPrimary: string
  ctaSecondary: string
  accessNote: string
  /** [a11y] suffix for links that open in a new tab */
  newTab: string
}

export const text = {
  en: {
    pill: 'community.qairuhub.com',
    title: 'This is the *Hub*',
    body: 'Our community platform puts people, projects and events at QAIRU in one place. Switch the tabs to see what you can do there.',
    tablistLabel: 'Platform features',
    sampleBadge: 'Sample data',
    app: {
      name: 'QairuHub Community',
      sidebar: ['Home', 'Team Finder', 'Projects', 'Events', 'People', 'Clubs', 'Resources'],
      search: 'Search the campus…',
      secondary: 'Share',
      primary: 'New project',
    },
    tabs: [
      {
        screen: 'finder',
        label: 'Team Finder',
        caption: 'Every role names the skill, the hours and the deadline. No “are you still looking?” chats.',
      },
      {
        screen: 'projects',
        label: 'Projects',
        caption: 'Every project shows an honest status: idea, recruiting, in progress, demo shown.',
      },
      {
        screen: 'events',
        label: 'Events',
        caption: 'Seats are limited. Telegram reminds you a day and an hour before.',
      },
      {
        screen: 'people',
        label: 'People',
        caption: 'Find people by skill, program and free hours, then message them on Telegram.',
      },
    ],
    finder: {
      title: 'Team Finder · Open roles',
      subtitle: 'Pick a role that fits your skills and your hours.',
      modes: ['Find a project', 'Find people'],
      filters: ['All skills', 'Any hours'],
      count: '{n} open roles',
      columns: { role: 'Role', project: 'Project', skill: 'Skill', hours: 'Hours', deadline: 'Deadline' },
      rows: [
        { role: 'ML engineer', project: 'Kazakh NLP Datasets', skill: 'Python', hours: '8 h/week', deadline: 'Oct 3' },
        { role: 'Frontend developer', project: 'Open Campus Map', skill: 'JavaScript', hours: '6 h/week', deadline: 'Sep 30' },
        { role: 'Product designer', project: 'Campus Buddy', skill: 'UI/UX', hours: '4 h/week', deadline: 'Oct 10' },
        { role: 'Researcher', project: 'Kazakh NLP Datasets', skill: 'Research', hours: '5 h/week', deadline: 'Oct 17' },
      ],
      action: 'Apply',
    },
    projects: {
      title: 'Student projects',
      subtitle: 'Ideas and builds by QAIRU students, and who is on each team.',
      filters: ['All statuses', 'Recruiting', 'In progress', 'Idea'],
      count: '{n} results',
      status: { idea: 'Idea', recruiting: 'Recruiting', inProgress: 'In progress', demoShown: 'Demo shown' },
      team: '{n} on the team',
      rows: [
        { name: 'Open Campus Map', promise: 'A living map of rooms and campus services', status: 'recruiting', team: 4 },
        { name: 'Kazakh NLP Datasets', promise: 'A catalogue of open Kazakh-language datasets', status: 'inProgress', team: 6 },
        { name: 'QAIRU Radio', promise: 'A podcast about student projects', status: 'idea', team: 2 },
        { name: 'Campus Buddy', promise: 'Mentors for first-year students', status: 'recruiting', team: 3 },
      ],
    },
    events: {
      title: 'Campus calendar',
      subtitle: 'Workshops, meetups and Demo Fridays run by QAIRU students.',
      filters: ['All types', 'Demo Friday', 'Hack Day', 'Meetup', 'Workshop'],
      count: '{n} upcoming',
      going: '{x} / {cap} going',
      rows: [
        { date: 'Oct 2', title: 'AI Build Night', type: 'Hack Day', time: '18:30', place: 'Lab 3.12', going: 24, capacity: 40 },
        { date: 'Oct 9', title: 'Founder Stories', type: 'Meetup', time: '17:00', place: 'Atrium', going: 31, capacity: 60 },
        { date: 'Oct 16', title: 'Open Design Critique', type: 'Workshop', time: '16:00', place: 'Studio 2.04', going: 12, capacity: 20 },
        { date: 'Oct 23', title: 'Demo Friday', type: 'Demo Friday', time: '17:00', place: 'Atrium', going: 18, capacity: 50 },
      ],
      action: 'Going',
    },
    people: {
      title: 'People at QAIRU',
      subtitle: 'Find collaborators by program, skills and free hours.',
      filters: ['All programs', 'All skills', 'Open to projects'],
      count: '{n} people',
      availability: { projects: 'Open to projects', collaboration: 'Open to collaboration' },
      cards: [
        { name: 'Aruzhan S.', program: 'Computer Science', year: 'Year 1', skills: ['Python', 'ML'], availability: 'projects' },
        { name: 'Daniyar A.', program: 'Computer Science', year: 'Year 3', skills: ['Backend', 'ML'], availability: 'collaboration' },
        { name: 'Aigerim N.', program: 'Artificial Intelligence', year: 'Year 2', skills: ['UI/UX', 'Research'], availability: 'projects' },
      ],
      action: 'Follow',
    },
    ctaPrimary: 'Open platform',
    ctaSecondary: 'Try the live demo',
    accessNote:
      'For now the platform needs an @qairu.edu.kz email, and an admin approves each account. Events and our Telegram channel are open to everyone.',
    newTab: '(opens in a new tab)',
  },
  kk: {
    pill: 'community.qairuhub.com',
    title: 'Міне, *Hub*',
    body: 'Біздің қауымдастық платформамыз QAIRU адамдарын, жобалары мен іс-шараларын бір жерге жинайды. Онда не істеуге болатынын көру үшін қойындыларды ауыстыр.',
    tablistLabel: 'Платформа мүмкіндіктері',
    sampleBadge: 'Үлгі деректер',
    app: {
      name: 'QairuHub Community',
      sidebar: ['Басты бет', 'Команда табу', 'Жобалар', 'Іс-шаралар', 'Адамдар', 'Клубтар', 'Ресурстар'],
      search: 'Кампус бойынша іздеу…',
      secondary: 'Бөлісу',
      primary: 'Жаңа жоба',
    },
    tabs: [
      {
        screen: 'finder',
        label: 'Команда табу',
        caption: 'Әр рөлде дағды, сағат және дедлайн жазылған. «Сізге әлі адам керек пе?» деген хат алмасу жоқ.',
      },
      {
        screen: 'projects',
        label: 'Жобалар',
        caption: 'Әр жобаның шынайы статусы көрінеді: идея, қабылдау, жұмыста, демо көрсетілді.',
      },
      {
        screen: 'events',
        label: 'Іс-шаралар',
        caption: 'Орын саны шектеулі. Telegram бір күн және бір сағат бұрын еске салады.',
      },
      {
        screen: 'people',
        label: 'Адамдар',
        caption: 'Адамдарды дағды, бағдарлама және бос сағат бойынша тап, сосын Telegram-да жаз.',
      },
    ],
    finder: {
      title: 'Команда табу · Ашық рөлдер',
      subtitle: 'Дағдың мен уақытыңа сай рөлді таңда.',
      modes: ['Жоба табу', 'Адам табу'],
      /* review: "Кез келген жүктеме" has no platform KK string yet */
      filters: ['Барлық дағдылар', 'Кез келген жүктеме'],
      count: '{n} ашық рөл',
      columns: { role: 'Рөл', project: 'Жоба', skill: 'Дағды', hours: 'Сағат', deadline: 'Дедлайн' },
      rows: [
        { role: 'ML инженері', project: 'Kazakh NLP Datasets', skill: 'Python', hours: 'аптасына 8 сағ', deadline: '3 қаз.' },
        { role: 'Frontend әзірлеуші', project: 'Open Campus Map', skill: 'JavaScript', hours: 'аптасына 6 сағ', deadline: '30 қыр.' },
        { role: 'Өнім дизайнері', project: 'Campus Buddy', skill: 'UI/UX', hours: 'аптасына 4 сағ', deadline: '10 қаз.' },
        { role: 'Зерттеуші', project: 'Kazakh NLP Datasets', skill: 'Зерттеу', hours: 'аптасына 5 сағ', deadline: '17 қаз.' },
      ],
      action: 'Өтінім беру',
    },
    projects: {
      title: 'Студенттер жобалары',
      /* review */
      subtitle: 'QAIRU студенттерінің идеялары мен жобалары және әр командада кім бар.',
      filters: ['Барлық статустар', 'Қабылдау', 'Жұмыста', 'Идея'],
      count: '{n} нәтиже',
      /* review: "Демо көрсетілді" has no platform KK string yet */
      status: { idea: 'Идея', recruiting: 'Қабылдау', inProgress: 'Жұмыста', demoShown: 'Демо көрсетілді' },
      team: 'командада {n}',
      rows: [
        { name: 'Open Campus Map', promise: 'Аудиториялар мен кампус сервистерінің тірі картасы', status: 'recruiting', team: 4 },
        { name: 'Kazakh NLP Datasets', promise: 'Ашық қазақтілді деректер жиынтықтарының каталогы', status: 'inProgress', team: 6 },
        { name: 'QAIRU Radio', promise: 'Студенттік жобалар туралы подкаст', status: 'idea', team: 2 },
        { name: 'Campus Buddy', promise: 'Бірінші курс студенттеріне менторлар', status: 'recruiting', team: 3 },
      ],
    },
    events: {
      title: 'Кампус күнтізбесі',
      subtitle: 'QAIRU студенттері құратын воркшоптар, митаптар және Demo Friday.',
      filters: ['Барлық түрлері', 'Demo Friday', 'Hack Day', 'Митап', 'Воркшоп'],
      /* review */
      count: '{n} алдағы іс-шара',
      going: '{cap} ішінен {x} барады',
      rows: [
        { date: '2 қаз.', title: 'AI Build Night', type: 'Hack Day', time: '18:30', place: '3.12 зертхана', going: 24, capacity: 40 },
        { date: '9 қаз.', title: 'Founder Stories', type: 'Митап', time: '17:00', place: 'Атриум', going: 31, capacity: 60 },
        { date: '16 қаз.', title: 'Open Design Critique', type: 'Воркшоп', time: '16:00', place: '2.04 студия', going: 12, capacity: 20 },
        { date: '23 қаз.', title: 'Demo Friday', type: 'Demo Friday', time: '17:00', place: 'Атриум', going: 18, capacity: 50 },
      ],
      action: 'Барамын',
    },
    people: {
      title: 'QAIRU адамдары',
      /* review */
      subtitle: 'Серіктестерді бағдарлама, дағды және бос сағат бойынша тап.',
      filters: ['Барлық бағдарламалар', 'Барлық дағдылар', 'Жобаларға ашық'],
      count: '{n} адам',
      availability: { projects: 'Жобаларға ашық', collaboration: 'Ынтымақтастыққа ашық' },
      cards: [
        { name: 'Аружан С.', program: 'Компьютерлік ғылымдар', year: '1 курс', skills: ['Python', 'ML'], availability: 'projects' },
        { name: 'Данияр А.', program: 'Компьютерлік ғылымдар', year: '3 курс', skills: ['Backend', 'ML'], availability: 'collaboration' },
        { name: 'Айгерім Н.', program: 'Жасанды интеллект', year: '2 курс', skills: ['UI/UX', 'Зерттеу'], availability: 'projects' },
      ],
      action: 'Жазылу',
    },
    ctaPrimary: 'Платформаны ашу',
    /* review */
    ctaSecondary: 'Тірі демоны байқап көр',
    /* review */
    accessNote:
      'Әзірге платформаға тіркелу үшін @qairu.edu.kz поштасы керек, әр аккаунтты әкімші растайды. Іс-шаралар мен Telegram арнамыз бәріне ашық.',
    newTab: '(жаңа бетте ашылады)',
  },
} satisfies Dict<PlatformText>
