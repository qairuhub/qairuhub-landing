import type { Dict } from '../i18n/locale'

/**
 * Q copy that ships in the entry bundle: the Launchpad Ask bar (CONTENT-V3 §4.2–§4.3) and the
 * floating launcher (§19.1), EN + KK (CONTENT-V3.kk.md, same keys). Everything the panel and the
 * answers need lives in `panel.i18n.ts`, which loads with the panel chunk.
 *
 * `launcher.label` is the visible launcher label from DECISIONS §7 ("Ask Q", worded like
 * `book.askCta`); `newTab` is the shared `a11y.newTab` suffix (CONTENT-V3 §2.6).
 */
export interface AskText {
  /** [a11y] input label */
  label: string
  placeholder: string
  /** [a11y] */
  submit: string
  /** [a11y] */
  suggestionsLabel: string
  note: string
  thinking: string
  sources: string
  continue: string
  again: string
  /** [a11y] */
  stop: string
  /** the six chips; the typewriter cycles through them */
  suggestions: readonly [string, string, string, string, string, string]
  /** [a11y] suffix for links that open a new tab */
  newTab: string
}

export interface LauncherText {
  /** [a11y] launcher button name (contains the visible `label`) */
  launcher: string
  /** visible launcher label (hover / focus) */
  label: string
  /** one-time nudge */
  hint: string
}

export const askText = {
  en: {
    label: 'Ask Q about QairuHub',
    placeholder: 'Ask anything about QairuHub…',
    submit: 'Send question',
    suggestionsLabel: 'Suggested questions',
    note: 'Q answers from the QairuHub Handbook and can be wrong. Dates live on t.me/qairuhub.',
    thinking: 'Q is thinking…',
    sources: 'From the QairuHub Handbook',
    continue: 'Continue in chat',
    again: 'Ask something else',
    stop: 'Stop answering',
    suggestions: [
      'How do I join QairuHub?',
      'What happens at the Hackathon Mentorship?',
      'I have an idea but no team. Where do I start?',
      'When does QairuHub Accelerator open?',
      'How can my project get featured?',
      "Can I join if I've never coded?",
    ],
    newTab: '(opens in a new tab)',
  },
  kk: {
    label: 'QairuHub туралы Q‑дан сұра',
    placeholder: 'QairuHub туралы кез келген сұрақ қой…',
    submit: 'Сұрақты жіберу',
    suggestionsLabel: 'Ұсынылған сұрақтар',
    note: 'Q The QairuHub Handbook бойынша жауап береді және қателесуі мүмкін. Нақты күндер t.me/qairuhub арнасында.',
    thinking: 'Q ойланып жатыр…',
    sources: 'The QairuHub Handbook-тан',
    continue: 'Чатта жалғастыру',
    again: 'Басқа сұрақ қою',
    stop: 'Жауапты тоқтату',
    suggestions: [
      'QairuHub-қа қалай қосылуға болады?',
      'Hackathon Mentorship-те не болады?',
      'Идеям бар, бірақ командам жоқ. Неден бастаймын?',
      'QairuHub Accelerator қашан ашылады?',
      'Жобамды сайтта қалай көрсетуге болады?',
      'Бұрын код жазбасам да қосыла аламын ба?',
    ],
    newTab: '(жаңа бетте ашылады)',
  },
} satisfies Dict<AskText>

export const launcherText = {
  en: {
    launcher: 'Ask Q, the QairuHub assistant',
    label: 'Ask Q',
    hint: 'Questions? Ask Q.',
  },
  kk: {
    launcher: 'QairuHub көмекшісі Q‑дан сұра',
    label: 'Q‑дан сұра',
    hint: 'Сұрағың бар ма? Q‑дан сұра.',
  },
} satisfies Dict<LauncherText>
