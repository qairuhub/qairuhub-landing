/**
 * Members page (CONTENT-V3 §17, V3-DECISIONS §6). Owned by WP10.
 *
 * Page contract: App.tsx renders <Header>, <main>, <Footer>, the static night sky and the assistant
 * launcher; this component renders its content only. Default export, lazy-loaded.
 *
 * No contact data of any person on this page: the contact block lists the public channels only.
 */
import type { ReactNode } from 'react'
import { Accent } from '../i18n/Accent'
import { useRoute, useT } from '../i18n/LocaleProvider'
import { href } from '../i18n/locale'
import { links } from '../i18n/shared'
import { SHOW_BUILDERS, askRows, board, builders, initials, type BoardId } from '../data/members'
import { Button } from '../components/ui/Button'
import { Reveal, RevealGroup } from '../components/ui/Reveal'
import { ArrowRight, ArrowUpRight, Book, Globe, SocialInstagram, SocialTelegram, Users } from '../components/ui/icons'
import { text } from './members.i18n'
import { useDeepLinkLanding } from './pageScroll'
import './subpage.css'
import './MembersPage.css'

const boardName = Object.fromEntries(board.map((m) => [m.id, m.name])) as Record<BoardId, string>

function ContactLink({
  to,
  icon,
  label,
  newTab,
}: {
  to: string
  icon: ReactNode
  label: string
  /** localized sr-only suffix; its presence makes the link external */
  newTab?: string
}) {
  const external = newTab != null
  return (
    <li>
      <a
        className="members-contact__link"
        href={to}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
      >
        <span className="members-contact__icon">{icon}</span>
        <span className="u-body-1 members-contact__label">{label}</span>
        {external ? (
          <ArrowUpRight size={16} className="members-contact__arrow" />
        ) : (
          <ArrowRight size={16} className="members-contact__arrow" />
        )}
        {external && <span className="sr-only"> {newTab}</span>}
      </a>
    </li>
  )
}

export default function MembersPage() {
  const route = useRoute()
  const t = useT(text)
  useDeepLinkLanding()

  return (
    <div className="subpage members">
      {/* ---------- Heading */}
      <div className="subpage__head grid-air">
        <RevealGroup className="subpage__intro on-sky">
          <p className="subpage__eyebrow u-body-2">{t.eyebrow}</p>
          <h1 className="u-h1-small subpage__title">
            <Accent text={t.title} />
          </h1>
          <p className="u-body-1 subpage__lede">{t.intro}</p>
        </RevealGroup>
      </div>

      {/* ---------- Executive board */}
      <section id="board" className="subpage__block grid-air" aria-labelledby="board-title">
        <Reveal className="subpage__block-head on-sky">
          <h2 id="board-title" className="u-h3">
            {t.boardTitle}
          </h2>
          <p className="u-body-1 subpage__note">{t.boardNote}</p>
        </Reveal>
        <RevealGroup as="ul" className="members__board" aria-label={t.a11y.boardList} stagger={100} threshold={0.02}>
          {board.map((m) => (
            <li key={m.id} className={`member-card member-card--${m.id}`}>
              <span className="member-card__mono" aria-hidden="true">
                {initials(m.name)}
              </span>
              <div className="member-card__text">
                <h3 className="u-h5 member-card__name">{m.name}</h3>
                <p className="u-body-2 member-card__role">{t.board[m.id].role}</p>
                <p className="u-body-1 member-card__focus">{t.board[m.id].focus}</p>
              </div>
            </li>
          ))}
        </RevealGroup>
      </section>

      {/* ---------- Builders (public list, DECISIONS §6) */}
      {SHOW_BUILDERS && builders.length > 0 && (
        <section id="builders" className="subpage__block grid-air" aria-labelledby="builders-title">
          <Reveal className="subpage__block-head on-sky">
            <h2 id="builders-title" className="u-h3">
              {t.buildersTitle}
            </h2>
            <p className="u-body-1 subpage__note">{t.buildersNote}</p>
          </Reveal>
          <Reveal as="ul" className="members__builders" aria-label={t.a11y.buildersList} threshold={0.05}>
            {builders.map((b) => (
              <li key={b.id} className="builder-row">
                <span className="u-h5 builder-row__name">{b.name}</span>
                <span className="u-body-1 builder-row__role">{t.builderRoles[b.id]}</span>
              </li>
            ))}
          </Reveal>
        </section>
      )}

      {/* ---------- Who to ask */}
      <section id="who-to-ask" className="subpage__block grid-air" aria-labelledby="ask-title">
        <Reveal className="subpage__block-head on-sky">
          <h2 id="ask-title" className="u-h3">
            {t.askTitle}
          </h2>
        </Reveal>
        <Reveal className="members__ask">
          <div className="table-scroll" role="region" aria-labelledby="ask-title" tabIndex={0}>
            <table className="members-table">
              <thead>
                <tr>
                  <th scope="col" className="u-body-2">
                    {t.askColWant}
                  </th>
                  <th scope="col" className="u-body-2">
                    {t.askColWho}
                  </th>
                </tr>
              </thead>
              <tbody>
                {askRows.map((row) => (
                  <tr key={row.id}>
                    <td className="u-body-1">{t.ask[row.id].want}</td>
                    <td className="u-body-1">
                      <span className="members-table__who">{t.ask[row.id].who}</span>
                      <span className="members-table__name">{boardName[row.seat]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="members__ask-more on-sky">
            <Button variant="tertiary" href={href(route, 'handbook#who-to-ask-about-what')} icon={<Book size={16} />}>
              {t.askMore}
            </Button>
          </div>
        </Reveal>
      </section>

      {/* ---------- Contact + join */}
      <section id="contact" className="subpage__block grid-air" aria-labelledby="contact-title">
        <RevealGroup className="members__end" stagger={120} threshold={0.05}>
          <div className="members-panel">
            <h2 id="contact-title" className="u-h3">
              {t.contactTitle}
            </h2>
            <p className="u-body-1 members-panel__body">{t.contactBody}</p>
            <ul className="members-contact">
              <ContactLink
                to={links.telegram}
                icon={<SocialTelegram size={20} />}
                label={t.contactTelegram}
                newTab={t.a11y.newTab}
              />
              <ContactLink
                to={links.instagram}
                icon={<SocialInstagram size={20} />}
                label={t.contactInstagram}
                newTab={t.a11y.newTab}
              />
              <ContactLink to={href(route, '#join')} icon={<Users size={20} />} label={t.contactForm} />
              <ContactLink
                to={links.platform}
                icon={<Globe size={20} />}
                label={t.contactPlatform}
                newTab={t.a11y.newTab}
              />
            </ul>
          </div>

          <div className="members-panel members-panel--join">
            <h2 className="u-h3">{t.joinTitle}</h2>
            <p className="u-body-1 members-panel__body">{t.joinBody}</p>
            <div className="members-panel__cta">
              <Button variant="primary" href={href(route, '#join')}>
                {t.joinCta}
              </Button>
            </div>
          </div>
        </RevealGroup>
      </section>
    </div>
  )
}
