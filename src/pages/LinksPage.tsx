/**
 * `/links` — the link-in-bio page. One tall, tappable row per entry in `src/data/links.ts`, in that
 * file's order, with the featured row first and larger.
 *
 * Page contract (same as the other sub-pages): App.tsx renders <Header>, <main>, <Footer>, the
 * static night sky and the assistant launcher; this component renders its content only. Default
 * export, lazy-loaded.
 *
 * Why its own page rather than a section of the home page: this is the URL that goes in the
 * Instagram bio and into posters, so it has to stay short, load on a phone on campus wi-fi, and be
 * editable by whoever runs the account — `src/data/links.ts` plus `links.i18n.ts` and nothing else.
 */
import { useT } from '../i18n/LocaleProvider'
import { siteLinks, type LinkIcon } from '../data/links'
import { Reveal, RevealGroup } from '../components/ui/Reveal'
import { ArrowUpRight, Book, Globe, SocialInstagram, SocialTelegram, Sparkle } from '../components/ui/icons'
import { text } from './links.i18n'
import './subpage.css'
import './LinksPage.css'

const ICONS: Record<LinkIcon, typeof Globe> = {
  sparkle: Sparkle,
  telegram: SocialTelegram,
  instagram: SocialInstagram,
  globe: Globe,
  book: Book,
}

export default function LinksPage() {
  const t = useT(text)

  return (
    <div className="subpage links-page">
      <div className="subpage__head grid-air">
        <RevealGroup className="subpage__intro on-sky">
          <p className="subpage__eyebrow u-body-2">{t.eyebrow}</p>
          <h1 className="u-h2 subpage__title">{t.title}</h1>
          <p className="u-body-1 subpage__lede">{t.intro}</p>
        </RevealGroup>
      </div>

      <section className="subpage__block grid-air">
        <RevealGroup as="ul" className="links-list" aria-label={t.a11y.list} stagger={80} threshold={0.02}>
          {siteLinks.map((link) => {
            const Icon = ICONS[link.icon]
            const copy = t.items[link.id]
            return (
              <li key={link.id}>
                <a
                  className={`link-row${link.featured ? ' link-row--featured' : ''}`}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="link-row__icon" aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <span className="link-row__text">
                    <span className="u-h5 link-row__label">
                      {copy.label}
                      {link.featured && <span className="link-row__badge u-body-2">{t.featuredBadge}</span>}
                    </span>
                    <span className="u-body-1 link-row__note">{copy.note}</span>
                  </span>
                  <ArrowUpRight size={18} className="link-row__arrow" />
                  <span className="sr-only"> {t.a11y.newTab}</span>
                </a>
              </li>
            )
          })}
        </RevealGroup>

        <Reveal className="links-page__footnote on-sky">
          <p className="u-body-2">{t.footerNote}</p>
        </Reveal>
      </section>
    </div>
  )
}
