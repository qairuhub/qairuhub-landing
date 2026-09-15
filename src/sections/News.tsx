import clsx from 'clsx'
import { Section, SectionText } from '../components/ui/Section'
import { Button } from '../components/ui/Button'
import { ArrowRight, ArrowUpRight } from '../components/ui/icons'
import { Reveal } from '../components/ui/Reveal'
import { Accent } from '../i18n/Accent'
import { useRoute, useT } from '../i18n/LocaleProvider'
import { stripAccent } from '../i18n/locale'
import { links, sectionIds } from '../i18n/shared'
import { isNewsPast, news } from '../data/news'
import { linkProps } from '../data/projects'
import { text } from './news.i18n'
import './News.css'

/**
 * "Now" for the Past label, read once per page load. `?now=<ISO>` overrides it so QA can check
 * the label without changing the system clock (only this label reads it).
 */
function readNow(): number {
  if (typeof window !== 'undefined') {
    try {
      const override = new URLSearchParams(window.location.search).get('now')
      if (override) {
        const t = Date.parse(override)
        if (Number.isFinite(t)) return t
      }
    } catch {
      /* ignore malformed search strings */
    }
  }
  return Date.now()
}

/**
 * Latest news (CONTENT-V3 §11, DECISIONS §3). Six build-time cards in CONTENT order: a 3-up grid
 * on desktop, 2-up on tablet, a snap-scroll row on phones. The Past label is decided on the first
 * render (no effect, no second pass), and it sits in a fixed-height meta row, so it never moves
 * the layout.
 */
export default function News() {
  const t = useT(text)
  const route = useRoute()
  const { locale } = route
  const now = readNow()

  return (
    <Section id={sectionIds.news} className="news" aria-label={stripAccent(t.title)}>
      <SectionText
        titleAs="h2"
        titleClass="u-h2"
        title={<Accent text={t.title} />}
        body={t.body}
        ctas={
          <Button
            variant="tertiary"
            href={links.telegram}
            external
            newTabLabel={t.newTab}
            iconRight={<ArrowUpRight size={14} />}
          >
            {t.allLink}
          </Button>
        }
      />

      <div className="news__wrap">
        <ul className="news__list no-scrollbar" aria-label={t.listLabel}>
          {news.map((item, i) => {
            const past = isNewsPast(item, now)
            return (
              <Reveal as="li" key={item.id} index={i} stagger={120} className="news__item">
                <article className={clsx('ncard', past && 'is-past')}>
                  <div className="ncard__meta u-body-3">
                    <span className="ncard__tag">{item.tag[locale]}</span>
                    {item.date ? (
                      <time className="ncard__date" dateTime={item.date}>
                        {item.dateLabel[locale]}
                      </time>
                    ) : (
                      <span className="ncard__date">{item.dateLabel[locale]}</span>
                    )}
                    {past && <span className="ncard__past">{t.pastLabel}</span>}
                  </div>
                  <h3 className="ncard__title">{item.title[locale]}</h3>
                  <p className="ncard__body u-body-2">{item.body[locale]}</p>
                  <div className="ncard__foot">
                    <Button
                      variant="tertiary"
                      {...linkProps(route, item.link, t.newTab)}
                      iconRight={item.link.external ? <ArrowUpRight size={14} /> : <ArrowRight size={14} />}
                    >
                      {item.link.label[locale]}
                    </Button>
                  </div>
                </article>
              </Reveal>
            )
          })}
        </ul>
      </div>
    </Section>
  )
}
