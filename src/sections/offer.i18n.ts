import type { Dict } from '../i18n/locale'

/**
 * "What we offer" copy (CONTENT-V3 §9 / CONTENT-V3.kk §9, owned by WP7).
 *
 * The tuple types pin the counts: exactly 7 cards in CONTENT order, 4 schedule rows, 4 chart
 * steps, 3 platform links and 4 milestones, in both locales. Layout (`cols`) and the `visual` key
 * are locale-invariant and live in Features.tsx next to the grid.
 *
 * The mock rows (§9.2) are real or explicitly planned items, never samples: the schedule starts
 * with the 15 Sep Hackathon Mentorship and invents no events.
 */

type Tuple3<T> = readonly [T, T, T]
type Tuple4<T> = readonly [T, T, T, T]
type Tuple7<T> = readonly [T, T, T, T, T, T, T]

export interface OfferCard {
  title: string
  body: string
}

export interface ScheduleRow {
  /** short date or status label, e.g. "Sep 15", "Soon" */
  date: string
  title: string
  /** venue / time or status note */
  detail: string
}

export interface OfferText {
  /** headline with one *accent* word (rendered by <Accent>) */
  title: string
  body: string
  items: Tuple7<OfferCard>
  mock: {
    /** card 1: date · title · detail */
    schedule: Tuple4<ScheduleRow>
    /** card 2: a heading label and the four preparation steps */
    chart: { label: string; bars: Tuple4<string> }
    /** card 3: platform destinations */
    links: Tuple3<string>
    /** card 4: milestones along the Demo Day track */
    milestones: Tuple4<string>
  }
}

export const text = {
  en: {
    title: 'What we *offer*.',
    body: 'Everything here is free, open to every skill level and built around one goal: getting you from an idea to something real.',
    items: [
      {
        title: 'Events & masterclasses',
        body: 'Workshops, meetups and hands-on masterclasses where people who know a domain show what actually works. Next up: the Vibe-coding Masterclass, announcement soon.',
      },
      {
        title: 'Hackathons & preparation',
        body: 'We help you register, find teammates and get ready for hackathons like HackAlem AI. A QairuHub Hack Day on a real Kazakhstan problem is planned.',
      },
      {
        title: 'Teams on the platform',
        body: 'Publish an idea on community.qairuhub.com, open roles with skills, hours and a deadline, and build with developers from your own university.',
      },
      {
        title: 'QairuHub Demo Day',
        body: "The stage QairuHub runs for projects built with the community's teams, mentors and resources: students, faculty, professors, university partners and investors. Date to be announced.",
      },
      {
        title: 'Mentorship',
        body: 'Peer-to-peer: learn from people one step ahead, then teach the next semester. Mentors by track are on the way.',
      },
      {
        title: 'QairuHub Accelerator',
        body: 'QairuHub Accelerator takes teams that already have a demo. Draft plan: 8–10 weeks, mentors from week one, zero equity. Dates to be announced.',
      },
      {
        title: 'Partnerships',
        body: 'Companies and organisations can host an event, mentor a team, bring a real problem or meet teams at Demo Day. Write to us.',
      },
    ],
    mock: {
      schedule: [
        { date: 'Sep 15', title: 'Hackathon Mentorship', detail: 'Shai Cafeteria · 14:00' },
        { date: 'Soon', title: 'Vibe-coding Masterclass', detail: 'Announcement soon' },
        { date: 'Oct', title: 'First big QairuHub event', detail: 'Date TBA' },
        { date: 'Nov', title: 'QairuHub Demo Day', detail: 'Planned' },
      ],
      chart: {
        label: 'HackAlem AI · Sep 23',
        bars: ['Register', 'Find a team', 'Build', 'Demo'],
      },
      links: ['Team Finder', 'Open roles', 'Projects showcase'],
      milestones: ['Idea', 'Team', 'Demo', 'Demo Day'],
    },
  },
  kk: {
    title: 'Біз не *ұсынамыз*?',
    body: 'Мұндағының бәрі тегін, кез келген деңгейге ашық және бір мақсатқа құрылған: сені идеядан нақты нәтижеге жеткізу.',
    items: [
      {
        title: 'Іс-шаралар мен мастер-кластар',
        body: 'Воркшоптар, митаптар және практикалық мастер-кластар: саланы жақсы білетіндер шынымен жұмыс істейтін тәсілдерді көрсетеді. Келесісі — Vibe-coding Masterclass, жақында хабарлаймыз.',
      },
      {
        title: 'Хакатондар және дайындық',
        body: 'HackAlem AI сияқты хакатондарға тіркелуге, командалас табуға және дайындалуға көмектесеміз. Қазақстанның нақты мәселесіне арналған QairuHub Hack Day жоспарда.',
      },
      {
        title: 'Платформадағы командалар',
        body: 'Идеяңды community.qairuhub.com-да жарияла, дағды, сағат және дедлайн көрсетілген рөлдер аш, өз университетіңдегі әзірлеушілермен бірге құр.',
      },
      {
        title: 'QairuHub Demo Day',
        body: 'Қауымдастықтың командалары, менторлары мен ресурстарының көмегімен жасалған жобаларға QairuHub өткізетін сахна: студенттер, оқытушылар, профессорлар, университет серіктестері мен инвесторлар алдында. Күні кейін хабарланады.',
      },
      {
        title: 'Менторлық',
        body: 'Құрдастар бір-біріне үйретеді: сенен бір қадам алда жүргендерден үйрен, келесі семестрде өзің үйрет. Бағыттар бойынша менторлар да жақында.',
      },
      {
        title: 'QairuHub Accelerator',
        body: 'QairuHub Accelerator демосы бар командаларды қабылдайды. Жоспардағы форматы: 8–10 апта, бірінші аптадан менторлар, үлес алынбайды. Күні кейін хабарланады.',
      },
      {
        title: 'Серіктестік',
        body: 'Компаниялар мен ұйымдар іс-шара өткізе алады, командаға менторлық ете алады, нақты мәселе ұсына алады немесе Demo Day-де командалармен таныса алады. Бізге жазыңыз.',
      },
    ],
    mock: {
      schedule: [
        { date: '15 қыр.', title: 'Hackathon Mentorship', detail: 'Shai кафетерийі · 14:00' },
        { date: 'Жақында', title: 'Vibe-coding Masterclass', detail: 'Жақында хабарланады' },
        { date: 'Қаз.', title: 'QairuHub-тың алғашқы үлкен іс-шарасы', detail: 'Күні кейін хабарланады' },
        { date: 'Қар.', title: 'QairuHub Demo Day', detail: 'Жоспарда' },
      ],
      chart: {
        label: 'HackAlem AI · 23 қыр.',
        bars: ['Тіркелу', 'Команда табу', 'Құру', 'Демо'],
      },
      links: ['Команда табу', 'Ашық рөлдер', 'Жобалар витринасы'],
      milestones: ['Идея', 'Команда', 'Демо', 'Demo Day'],
    },
  },
} satisfies Dict<OfferText>
