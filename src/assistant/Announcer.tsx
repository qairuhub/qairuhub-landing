import { useT } from '../i18n/LocaleProvider'
import { panelText } from './panel.i18n'
import { useAssistant } from './store'

/**
 * Polite live region for Q: announces only the finished answer, once (AGENT-SPEC §11). The
 * launcher mounts one (lazily, as soon as a question exists) while the panel is closed and the
 * panel renders its own while open (`aria-modal` hides live regions outside the dialog from some
 * screen readers), so exactly one exists at a time. Lazy chunk.
 */
export default function Announcer() {
  const t = useT(panelText)
  const { announcement } = useAssistant()
  let text = ''
  if (announcement) {
    const preface = announcement.reason === 'daily_cap' && announcement.text ? `${t.dailyCap} ` : ''
    text = announcement.text ? `${preface}${announcement.text}` : announcement.error ? t[announcement.error] : ''
    if (announcement.text && announcement.error) text = `${text} ${t[announcement.error]}`
  }
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {text && <span key={announcement?.id}>{text}</span>}
    </div>
  )
}
