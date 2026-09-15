/**
 * Members page copy (CONTENT-V3 §17 + CONTENT-V3.kk §17). Owned by WP10.
 * Names and ids come from `src/data/members.ts`; `satisfies Dict<MembersText>` enforces KK completeness.
 */
import type { Dict } from '../i18n/locale'
import type { AskRowId, BoardId, BuilderId } from '../data/members'

export interface MembersText {
  eyebrow: string
  title: string
  intro: string

  boardTitle: string
  boardNote: string
  board: Record<BoardId, { role: string; focus: string }>

  buildersTitle: string
  buildersNote: string
  builderRoles: Record<BuilderId, string>

  askTitle: string
  askColWant: string
  askColWho: string
  ask: Record<AskRowId, { want: string; who: string }>
  askMore: string

  contactTitle: string
  contactBody: string
  contactTelegram: string
  contactInstagram: string
  contactForm: string
  contactPlatform: string

  joinTitle: string
  joinBody: string
  joinCta: string

  a11y: { newTab: string; boardList: string; buildersList: string }
}

export const text = {
  en: {
    eyebrow: 'Members',
    title: 'The people who *run* QairuHub',
    intro:
      'QairuHub is run by students. Nobody owns it, seats rotate by vote, and anyone can be replaced, including the President. These are the people doing the work right now.',

    boardTitle: 'Executive board',
    boardNote: 'Elected at the Founding Session on 7 September 2026; role names as confirmed on 10 September 2026.',
    board: {
      president: { role: 'President', focus: 'The organisation, the university and the big picture.' },
      cto: { role: 'CTO', focus: "The platform, QairuHub's products and operations." },
      finance: { role: 'Finance & Partnerships Leader', focus: 'Partners, sponsors and anything involving money.' },
      media: { role: 'Media & Socials Leader', focus: 'Instagram, Telegram and how QairuHub shows up.' },
      community: { role: 'Community & Events Leader', focus: 'Events, onboarding and where new members start.' },
    },

    buildersTitle: 'Builders',
    buildersNote: "Active members leading QairuHub's projects, media and events.",
    builderRoles: {
      nurik: 'Lead developer, community.qairuhub.com',
      aidos: 'Developer, community.qairuhub.com',
      miras: 'Team bots · mentor to new contributors',
      nurkhan: 'Team',
      ibragim: 'Team',
    },

    askTitle: 'Who to ask',
    askColWant: 'If you want to…',
    askColWho: 'Talk to',
    ask: {
      start: { want: 'figure out where to start or which project to join', who: 'Community & Events' },
      event: { want: 'run an event or take a demo slot', who: 'Community & Events' },
      platform: { want: 'report a platform bug, get access or ask a technical question', who: 'Platform & operations (the CTO)' },
      money: { want: 'discuss sponsorship, partnerships or money', who: 'Finance & Partnerships' },
      media: { want: 'suggest a post or share project news for Instagram or Telegram', who: 'Media & Socials' },
      serious: { want: 'discuss the organisation, the university or something serious', who: 'the President' },
    },
    askMore: 'More in the QairuHub Handbook',

    contactTitle: 'Contact the team',
    contactBody: "We don't publish personal emails or phone numbers. The fastest ways to reach QairuHub:",
    contactTelegram: 'Telegram channel · t.me/qairuhub',
    contactInstagram: 'Instagram · @qairuhub',
    contactForm: 'The join form',
    contactPlatform: 'Open platform',

    joinTitle: 'Want your name here?',
    joinBody:
      'Active members join through intake waves. Start by showing up and building; the next wave will be announced on the channel.',
    joinCta: 'Join QairuHub',

    a11y: { newTab: '(opens in a new tab)', boardList: 'Executive board members', buildersList: 'Builders' },
  },
  kk: {
    eyebrow: 'Мүшелер',
    title: 'QairuHub-ты *жүргізетін* адамдар',
    intro:
      'QairuHub-ты студенттер жүргізеді. Оның иесі жоқ, орындар дауыс беру арқылы ауысады, ал кез келген адамды, тіпті президентті де ауыстыруға болады. Қазір бұл жұмысты атқарып жүргендер — осылар.',

    boardTitle: 'Атқарушы кеңес', // review
    boardNote: '2026 жылғы 7 қыркүйектегі құрылтай сессиясында сайланды; рөл атаулары 10 қыркүйекте бекітілді.',
    board: {
      president: { role: 'Президент', focus: 'Ұйым, университетпен байланыс және жалпы бағыт.' },
      cto: { role: 'CTO', focus: 'Платформа, QairuHub өнімдері және операциялық жұмыс.' },
      finance: { role: 'Қаржы және серіктестік жетекшісі', focus: 'Серіктестер, демеушілер және қаржыға қатысты бәрі.' },
      media: {
        role: 'Медиа және әлеуметтік желілер жетекшісі',
        focus: 'Instagram, Telegram және QairuHub-тың жұртшылық алдындағы бейнесі.', // review
      },
      community: {
        role: 'Қауымдастық және іс-шаралар жетекшісі',
        focus: 'Іс-шаралар, жаңа мүшелерді қабылдау және олардың алғашқы қадамдары.',
      },
    },

    buildersTitle: 'Жобаларды құрушылар',
    buildersNote: 'QairuHub жобаларын, медиасын және іс-шараларын жүргізіп жүрген белсенді мүшелер.',
    builderRoles: {
      nurik: 'community.qairuhub.com жетекші әзірлеушісі',
      aidos: 'community.qairuhub.com әзірлеушісі',
      miras: 'Команда боттары · жаңа контрибьюторлардың менторы',
      nurkhan: 'Команда',
      ibragim: 'Команда',
    },

    askTitle: 'Кімге жүгіну керек',
    askColWant: 'Не істегің келеді',
    askColWho: 'Кімге жүгіну',
    ask: {
      start: { want: 'неден бастау керегін немесе қай жобаға қосылатыныңды анықтау', who: 'Қауымдастық және іс-шаралар' },
      event: { want: 'іс-шара өткізу немесе демо слотын алу', who: 'Қауымдастық және іс-шаралар' },
      platform: {
        want: 'платформадағы қате туралы хабарлау, қолжетімділік алу немесе техникалық сұрақ қою',
        who: 'Платформа және операциялық жұмыс (CTO)',
      },
      money: { want: 'демеушілікті, серіктестікті немесе қаржы мәселесін талқылау', who: 'Қаржы және серіктестік' },
      media: {
        want: 'Instagram не Telegram үшін жазба ұсыну немесе жоба жаңалығымен бөлісу',
        who: 'Медиа және әлеуметтік желілер',
      },
      serious: { want: 'ұйымға, университетке қатысты немесе маңызды мәселені талқылау', who: 'Президент' },
    },
    askMore: 'The QairuHub Handbook-тан толығырақ', // review

    contactTitle: 'Командамен байланыс',
    contactBody: 'Жеке пошта мен телефон нөмірлерін жарияламаймыз. QairuHub-пен байланысудың ең жылдам жолдары:',
    contactTelegram: 'Telegram арнасы · t.me/qairuhub',
    contactInstagram: 'Instagram · @qairuhub',
    contactForm: 'Қосылу формасы',
    contactPlatform: 'Платформаны ашу',

    joinTitle: 'Атың осында болғанын қалайсың ба?',
    joinBody:
      'Белсенді мүшелер қабылдау толқындары арқылы қосылады. Іс-шараларға келіп, жоба құрудан баста. Келесі толқын арнада жарияланады.',
    joinCta: 'QairuHub-қа қосылу',

    a11y: { newTab: '(жаңа бетте ашылады)', boardList: 'Атқарушы кеңес мүшелері', buildersList: 'Жобаларды құрушылар' },
  },
} satisfies Dict<MembersText>
