/**
 * 404 page (CONTENT-V3 §20). Owned by WP10.
 *
 * Page contract: App.tsx renders <Header>, <main>, <Footer> and the assistant launcher; SkyScene
 * shows the frozen `space` preset for `page === 'notFound'` (WP1). This component renders its
 * content only. Default export, lazy-loaded. `dist/404.html` is served with a real 404 status.
 */
import { Accent } from '../i18n/Accent'
import { useRoute, useT } from '../i18n/LocaleProvider'
import { href } from '../i18n/locale'
import { Button } from '../components/ui/Button'
import { Book } from '../components/ui/icons'
import { text } from './notFound.i18n'
import './subpage.css'
import './NotFoundPage.css'

export default function NotFoundPage() {
  const route = useRoute()
  const t = useT(text)
  return (
    <div className="subpage not-found">
      <div className="grid-air not-found__inner">
        <div className="subpage__intro on-sky">
          <p className="subpage__eyebrow u-body-2">{t.eyebrow}</p>
          <h1 className="u-h1-small subpage__title">
            <Accent text={t.title} />
          </h1>
          <p className="u-body-1 subpage__lede">{t.body}</p>
          <div className="not-found__ctas">
            <Button variant="primary" href={href(route, '/')}>
              {t.cta}
            </Button>
            <Button variant="secondary" href={href(route, 'handbook')} icon={<Book size={16} />}>
              {t.handbook}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
