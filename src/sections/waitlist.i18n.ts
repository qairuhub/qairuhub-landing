import type { Dict } from '../i18n/locale'

/**
 * QairuHub Accelerator waitlist copy (CONTENT-V3 §6 / .kk §6). Accelerator dates are TBA:
 * the pill always says so. `errorRateLimited` / `errorVerify` reuse the Join form wording
 * (CONTENT-V3 §15.4) so both forms speak the same way.
 */
export interface WaitlistText {
  pill: string
  titleLine1: string
  /** Second headline line: one `*accent*` word. */
  titleLine2: string
  body: string
  /** Placeholder, also the visually hidden label. */
  placeholder: string
  cta: string
  sending: string
  consent: string
  success: string
  errorEmail: string
  errorRateLimited: string
  errorVerify: string
  errorFailed: string
  demoCaption: string
  demoSteps: readonly [string, string, string, string]
}

export const text = {
  en: {
    pill: 'Applications · dates TBA',
    titleLine1: 'An accelerator for',
    titleLine2: 'projects that *ship*',
    body: 'QairuHub Accelerator is for teams whose project already reached a demo. The draft plan: 8–10 weeks, 6–10 teams, mentors from week one, zero equity. Leave your email to hear first when applications open.',
    placeholder: 'Email address',
    cta: 'Notify me',
    sending: 'Saving…',
    consent: 'One email when applications open. No spam.',
    success: "You're on the list. We'll email you when applications open.",
    errorEmail: 'Enter a valid email address.',
    errorRateLimited: 'Too many attempts. Try again in a few minutes.',
    errorVerify: "Please confirm you're human and try again.",
    errorFailed: 'Something went wrong. Please try again.',
    demoCaption: 'From idea to Demo Day to QairuHub Accelerator.',
    demoSteps: ['Idea', 'Team', 'Demo Day', 'Accelerator'],
  },
  kk: {
    pill: 'Өтінім · күні кейін хабарланады',
    titleLine1: 'Демоға жеткен жобаларға арналған',
    titleLine2: '*акселератор*',
    body: 'QairuHub Accelerator — демоға жеткен командаларға арналған бағдарлама. Жоспардағы форматы: 8–10 апта, 6–10 команда, бірінші аптадан менторлар, үлес алынбайды. Өтінім қабылдау басталғанда бірінші болып білу үшін поштаңды қалдыр.',
    placeholder: 'Электрондық пошта',
    cta: 'Маған хабарла',
    sending: 'Сақталып жатыр…',
    consent: 'Өтінім ашылғанда бір ғана хат жібереміз. Спам жоқ.',
    success: 'Сен тізімдесің. Өтінім қабылдау басталғанда хат жібереміз.',
    errorEmail: 'Дұрыс электрондық пошта енгіз.',
    errorRateLimited: 'Әрекет тым көп болды. Бірнеше минуттан кейін қайталап көр.',
    errorVerify: 'Адам екеніңді растап, қайталап көр.',
    errorFailed: 'Бірдеңе дұрыс болмады. Қайталап көр.',
    demoCaption: 'Идеядан Demo Day-ге, одан QairuHub Accelerator-ға.',
    demoSteps: ['Идея', 'Команда', 'Demo Day', 'Accelerator'],
  },
} satisfies Dict<WaitlistText>
