import type { Dict } from '../i18n/locale'

/** Storytelling triptych copy (CONTENT-V3 §14 / CONTENT-V3.kk §14). Titles render uppercase via CSS. */
export interface StoryItem {
  title: string
  body: string
}

export interface StoryText {
  /** [a11y] section label */
  a11yLabel: string
  items: readonly StoryItem[]
}

export const text = {
  en: {
    a11yLabel: 'How QairuHub works',
    items: [
      {
        title: 'Learn',
        body: "Workshops, masterclasses and peer mentorship. People with domain knowledge teach the people who want in, and next semester that's you.",
      },
      {
        title: 'Build',
        body: 'Publish an idea on community.qairuhub.com, open roles and build with developers from your own university. Idea, in progress, demo: the status stays honest.',
      },
      {
        title: 'Launch',
        body: 'Show your project at QairuHub Demo Day (planned) to students, faculty, partners and investors. Strong teams move on to QairuHub Accelerator.',
      },
      {
        title: 'Meet',
        body: 'Events, hackathons and Demo Days are where teams are born. Show up, meet people, get back to building.',
      },
    ],
  },
  kk: {
    a11yLabel: 'QairuHub қалай жұмыс істейді',
    items: [
      {
        title: 'Үйрен',
        body: 'Воркшоптар, мастер-кластар және тең дәрежелі менторлық. Саланы білетіндер оған кіргісі келетіндерге үйретеді, ал келесі семестрде үйрететін сен боласың.',
      },
      {
        title: 'Құр',
        body: 'Идеяңды community.qairuhub.com-да жарияла, рөлдер аш және өз университетіңдегі әзірлеушілермен бірге құр. Идея, жұмыста, демо: статус әрқашан шынайы.',
      },
      {
        title: 'Іске қос',
        body: 'Жобаңды QairuHub Demo Day-де (жоспарда) студенттерге, оқытушыларға, серіктестерге және инвесторларға көрсет. Мықты командалар QairuHub Accelerator-ға өтеді.',
      },
      {
        title: 'Кездес',
        body: 'Командалар іс-шараларда, хакатондарда және Demo Day-де пайда болады. Келдің, таныстың, жобаға оралдың.',
      },
    ],
  },
} satisfies Dict<StoryText>
