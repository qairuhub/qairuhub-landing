import clsx from 'clsx'
import { Button } from '../components/ui/Button'
import { Grid } from '../components/ui/Grid'
import { RevealGroup } from '../components/ui/Reveal'
import { Wordmark } from '../components/ui/Wordmark'
import { ArrowUpRight, icons } from '../components/ui/icons'
import { useRoute, useT } from '../i18n/LocaleProvider'
import { href } from '../i18n/locale'
import { LocaleSwitch } from './Header'
import { FOOTER_LINKS, FOOTER_SOCIALS, FOOTER_SOURCE_LINKS, text as footerText } from './footer.i18n'
import { text as headerText } from './header.i18n'
import './Footer.css'

/** Internal (route/anchor) links form the primary row; external ones move to the quiet row. */
const PRIMARY_LINKS = FOOTER_LINKS.flatMap(([key, link]) => (link.kind === 'ext' ? [] : [[key, link.to] as const]))
const QUIET_LINKS = FOOTER_LINKS.flatMap(([key, link]) => (link.kind === 'ext' ? [[key, link.href] as const] : []))

/**
 * Footer.
 *
 * - **Home:** a 150lvh DOM spacer over the last stretch of the journey. The moonlit field, the
 *   stars and the returning glass wordmark are drawn by the single fixed SkyScene canvas
 *   (journey.ground / journey.night / journey.wordmarkFooter), so only the link rows are rendered
 *   here, pinned at the very bottom.
 * - **Sub-pages** (`/members`, `/handbook`, 404): a compact footer in normal flow — no spacer
 *   (the static night sky has no footer run), with the DOM wordmark + tagline on top.
 *
 * `z-[2]` keeps it above the fixed z-0 backdrop like <main>.
 */
export default function Footer() {
  const route = useRoute()
  const t = useT(footerText)
  const { a11y } = useT(headerText)
  const compact = route.page !== 'home'
  const quietLinks = [
    ...QUIET_LINKS.map(([key, url]) => [key, url, t.links[key]] as const),
    ...FOOTER_SOURCE_LINKS.map(([key, url]) => [key, url, t.source[key]] as const),
  ]

  return (
    <footer id="footer" data-theme="dark" className={clsx('footer z-[2]', compact && 'footer--compact')}>
      <div className="footer__content">
        <Grid hero>
          {compact && (
            <div className="footer__brand">
              <a className="footer__brand-link" href={route.base} aria-label={a11y.home}>
                <Wordmark decorative size={32} />
              </a>
              <p className="footer__tagline">{t.tagline}</p>
            </div>
          )}
          <RevealGroup className="footer__row">
            <div className="footer__col footer__col--links">
              <nav aria-label={t.a11y.footerNav}>
                <ul className="footer__nav">
                  {PRIMARY_LINKS.map(([key, to]) => (
                    <li key={key}>
                      <a
                        className="footer__link"
                        href={href(route, to)}
                        aria-current={
                          (key === 'members' && route.page === 'members') ||
                          (key === 'handbook' && route.page === 'handbook')
                            ? 'page'
                            : undefined
                        }
                      >
                        {t.links[key]}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              {/* Quiet row: the platform domain first, then the open-source links. Keeping the
                  external domain out of the primary row lets that row stay on one line at desktop
                  widths next to the copyright. */}
              <nav aria-label={`${t.links.community}, ${t.a11y.sourceNav}`}>
                <ul className="footer__nav footer__nav--quiet">
                  {quietLinks.map(([key, url, label]) => (
                    <li key={key}>
                      <a className="footer__link footer__link--quiet" href={url} target="_blank" rel="noopener noreferrer">
                        {label}
                        <ArrowUpRight size={12} />
                        <span className="sr-only"> {a11y.newTab}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            <div className="footer__col footer__col--right">
              <div className="footer__tools">
                <LocaleSwitch className="footer__lsw" />
                <ul className="footer__socials" aria-label={t.a11y.socials}>
                  {FOOTER_SOCIALS.map((social) => {
                    const Icon = icons[social.icon]
                    return (
                      <li key={social.label}>
                        <Button
                          variant="icon"
                          href={social.href}
                          external
                          ariaLabel={`${social.label} ${a11y.newTab}`}
                          className="footer__social"
                          icon={<Icon size={18} />}
                        />
                      </li>
                    )
                  })}
                </ul>
              </div>
              {!compact && <p className="u-body-3 footer__tagline footer__tagline--inline">{t.tagline}</p>}
              <p className="u-body-3 footer__copy">{t.copyright}</p>
            </div>
          </RevealGroup>
        </Grid>
      </div>
    </footer>
  )
}
