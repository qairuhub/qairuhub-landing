import type { Dict } from '../i18n/locale'
import type { InterestValue } from '../i18n/shared'

/**
 * Compact join form copy (CONTENT-V3 §15 / CONTENT-V3.kk §15).
 * Option VALUES live in `interestValues` (src/i18n/shared.ts); only their labels are here.
 * A trailing `*` on a label marks a required field; the component renders it aria-hidden.
 */
export interface FormFieldText {
  label: string
  placeholder?: string
}

export interface FormText {
  titleLine1: string
  /** Second headline line, spaces included: before + `*cursive*` + after. */
  titleLine2Before: string
  titleLine2Cursive: string
  titleLine2After: string
  body: string
  /** Primary registration: the platform sign-up (same tab). */
  signUpCta: string
  signUpNote: string
  fields: {
    name: FormFieldText
    email: FormFieldText
    telegram: FormFieldText
    interest: FormFieldText
    message: FormFieldText
    /** [a11y, hidden] honeypot label */
    honeypot: FormFieldText
  }
  interestOptions: Record<InterestValue, string>
  submit: string
  sending: string
  turnstileNote: string
  legalBefore: string
  /** → /handbook#platform-rules */
  legalLink1: string
  legalMiddle: string
  /** → /handbook#privacy-on-this-site */
  legalLink2: string
  legalAfter: string
  successTitle: string
  successBody: string
  successCta: string
  sendAnother: string
  errors: {
    required: string
    choose: string
    email: string
    telegram: string
    /** `{max}` is replaced with the limit */
    tooLong: string
    verify: string
    rateLimited: string
    failed: string
  }
}

export const text = {
  en: {
    titleLine1: 'Give your ideas',
    titleLine2Before: 'a place to ',
    titleLine2Cursive: '*ship*',
    titleLine2After: '.',
    body: "Create your profile on the platform to join teams and projects. Or tell us here who you are and what you want to build, and we'll get back to you on Telegram.",
    signUpCta: 'Create your account',
    signUpNote: 'On community.qairuhub.com, with your @qairu.edu.kz email.',
    fields: {
      name: { label: 'Full name*' },
      email: { label: 'Email*' },
      telegram: { label: 'Telegram username*', placeholder: '@username' },
      interest: { label: "I'm interested in*", placeholder: 'Choose one' },
      message: { label: 'Message', placeholder: 'What do you want to build?' },
      honeypot: { label: 'Leave this field empty' },
    },
    interestOptions: {
      build: 'Building projects (AI, software, hardware)',
      project: 'I have a project to feature',
      events: 'Events and community',
      media: 'Media and content',
      business: 'Business and entrepreneurship',
      mentor: 'Mentor or speaker',
      partner: 'Partner or sponsor',
      other: 'Something else',
    },
    submit: 'Send',
    sending: 'Sending…',
    turnstileNote: 'Protected by Cloudflare Turnstile.',
    legalBefore: 'By sending, you agree to our ',
    legalLink1: 'Code of Conduct',
    legalMiddle: ' and ',
    legalLink2: 'Privacy note',
    legalAfter: '.',
    successTitle: 'Got it. Welcome aboard.',
    successBody: "We'll reach out on Telegram. Meanwhile, follow t.me/qairuhub for events.",
    successCta: 'Create your platform profile',
    sendAnother: 'Send another',
    errors: {
      required: 'This field is required',
      choose: 'Please choose an option',
      email: 'Enter a valid email address',
      telegram: 'Use your Telegram username, like @qairuhub',
      tooLong: 'Keep it under {max} characters',
      verify: "Please confirm you're human and try again.",
      rateLimited: 'Too many attempts. Try again in a few minutes.',
      failed: 'Something went wrong. Please try again.',
    },
  },
  kk: {
    titleLine1: 'Идеяң',
    titleLine2Before: 'іске асатын ',
    titleLine2Cursive: '*орын*',
    titleLine2After: ' осында.',
    body: 'Командалар мен жобаларға қосылу үшін платформада профиль аш. Немесе осында өзің туралы және не құрғың келетінін айт, Telegram арқылы хабарласамыз.',
    signUpCta: 'Аккаунт ашу',
    signUpNote: 'community.qairuhub.com сайтында, @qairu.edu.kz поштасымен.',
    fields: {
      name: { label: 'Толық аты*' },
      email: { label: 'Электрондық пошта*' },
      telegram: { label: 'Telegram пайдаланушы аты*', placeholder: '@username' },
      interest: { label: 'Мені қызықтырады*', placeholder: 'Біреуін таңда' },
      message: { label: 'Хабарлама', placeholder: 'Не құрғың келеді?' },
      honeypot: { label: 'Бұл өрісті бос қалдыр' },
    },
    interestOptions: {
      build: 'Жоба құру (AI, бағдарламалық жасақтама, құрылғылар)',
      project: 'Көрсеткім келетін жобам бар',
      events: 'Іс-шаралар және қауымдастық',
      media: 'Медиа және контент',
      business: 'Бизнес және кәсіпкерлік',
      mentor: 'Ментор немесе спикер',
      partner: 'Серіктес немесе демеуші',
      other: 'Басқа',
    },
    submit: 'Жіберу',
    sending: 'Жіберіліп жатыр…',
    turnstileNote: 'Cloudflare Turnstile арқылы қорғалған.',
    legalBefore: 'Жіберу арқылы сен ',
    legalLink1: 'Әдеп кодексіне',
    legalMiddle: ' және ',
    legalLink2: 'құпиялылық туралы ескертпеге',
    legalAfter: ' келісесің.',
    successTitle: 'Қабылдадық. Қош келдің!',
    successBody: 'Telegram арқылы хабарласамыз. Әзірге іс-шаралардан хабардар болу үшін t.me/qairuhub арнасына жазыл.',
    successCta: 'Платформада профиль ашу',
    sendAnother: 'Тағы жіберу',
    errors: {
      required: 'Бұл өрісті толтыру міндетті',
      choose: 'Біреуін таңда',
      email: 'Дұрыс электрондық пошта енгіз',
      telegram: 'Telegram пайдаланушы атыңды жаз, мысалы @qairuhub',
      tooLong: '{max} таңбадан аспасын',
      verify: 'Адам екеніңді растап, қайталап көр.',
      rateLimited: 'Әрекет тым көп болды. Бірнеше минуттан кейін қайталап көр.',
      failed: 'Бірдеңе дұрыс болмады. Қайталап көр.',
    },
  },
} satisfies Dict<FormText>
