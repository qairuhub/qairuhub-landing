import clsx from 'clsx'
import { Section, SectionText } from '../components/ui/Section'
import { Button } from '../components/ui/Button'
import { Carousel } from '../components/ui/Carousel'
import { ArrowRight, ArrowUpRight } from '../components/ui/icons'
import { Reveal } from '../components/ui/Reveal'
import { Accent } from '../i18n/Accent'
import { useRoute, useT } from '../i18n/LocaleProvider'
import { fmt, href, stripAccent, type Locale, type Route } from '../i18n/locale'
import { sectionIds } from '../i18n/shared'
import { featuredHowTo, linkProps, projects, type ProjectItem } from '../data/projects'
import { text, type ProjectsText } from './projects.i18n'
import './Projects.css'

/** 16px plus glyph for the "Your project here" slot (decorative). */
function PlusGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function ProjectCard({ item, t, locale, route }: { item: ProjectItem; t: ProjectsText; locale: Locale; route: Route }) {
  const name = item.localName?.[locale] ?? item.name
  const [primary, secondary] = item.links

  return (
    <article className={clsx('pcard', item.slot && 'pcard--slot')}>
      <div className="pcard__meta">
        {item.slot ? (
          <span className="pcard__plus" aria-hidden="true">
            <PlusGlyph />
          </span>
        ) : (
          <>
            {item.status && <span className="pchip pchip--status">{t.status[item.status]}</span>}
            {item.badges.map((b) => (
              <span key={b} className={clsx('pchip', b === 'live' && 'pchip--live')}>
                {b === 'live' && <span className="pchip__dot" aria-hidden="true" />}
                {t.badge[b]}
              </span>
            ))}
          </>
        )}
      </div>

      <div className="pcard__text">
        <h3 className="pcard__name u-h5">{name}</h3>
        {item.credit && <p className="pcard__credit u-body-3">{item.credit[locale]}</p>}
        <p className="pcard__tagline u-body-2">{item.tagline[locale]}</p>
      </div>

      <div className="pcard__foot">
        {item.tags.length > 0 && (
          <p className="pcard__tags u-body-3">
            <span className="sr-only">{t.tagsLabel}: </span>
            {item.tags.join(' · ')}
          </p>
        )}
        {(primary || item.slot) && (
          <div className="pcard__links">
            {primary && (
              <Button
                variant="secondary"
                {...linkProps(route, primary, t.newTab)}
                iconRight={primary.external ? <ArrowUpRight size={14} /> : undefined}
              >
                {primary.label[locale]}
              </Button>
            )}
            {secondary && (
              <Button
                variant="tertiary"
                className="pcard__secondary"
                {...linkProps(route, secondary, t.newTab)}
                iconRight={secondary.external ? <ArrowUpRight size={14} /> : <ArrowRight size={14} />}
              >
                {secondary.label[locale]}
              </Button>
            )}
          </div>
        )}
        {item.slot && (
          <a className="pcard__howto u-body-3" href={href(route, featuredHowTo.href)}>
            {featuredHowTo.label[locale]}
          </a>
        )}
      </div>
    </article>
  )
}

/** Highlighted projects (CONTENT-V3 §10, DECISIONS §1): build-time data in a scroll-snap carousel. */
export default function Projects() {
  const t = useT(text)
  const route = useRoute()
  const { locale } = route

  return (
    <Section id={sectionIds.projects} className="projects" aria-label={stripAccent(t.title)}>
      <SectionText titleAs="h2" titleClass="u-h2" title={<Accent text={t.title} />} body={t.body} />

      <Reveal className="projects__rail">
        <Carousel
          items={projects}
          getKey={(p) => p.id}
          slideClassName={(p) => (p.slot ? 'qcar__slide--slot' : undefined)}
          labels={{
            region: t.carouselLabel,
            prev: t.prev,
            next: t.next,
            pause: t.pause,
            play: t.play,
            slideOf: (n, total) => fmt(t.slideOf, { n, total }),
            current: (n, total, i) =>
              fmt(t.current, { n, total, name: projects[i].localName?.[locale] ?? projects[i].name }),
          }}
          renderItem={(item) => <ProjectCard item={item} t={t} locale={locale} route={route} />}
        />
      </Reveal>
    </Section>
  )
}
