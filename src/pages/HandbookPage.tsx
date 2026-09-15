/**
 * The QairuHub Handbook page (CONTENT-V3 §18, V3-DECISIONS §1 / §10). Owned by WP10.
 *
 * Page contract: App.tsx renders <Header>, <main>, <Footer>, the static night sky and the assistant
 * launcher; this component renders its content only. Default export, lazy-loaded.
 *
 * - Body: `handbook.html` from `src/data/handbook.generated.ts`, rendered at build time from
 *   docs/HANDBOOK.md by scripts/build-handbook.mjs (WP4), which HTML-escapes every source character
 *   and allowlists link hosts, so it is injected as-is. English on both locales (`lang="en"`).
 * - TOC: sticky on desktop (H2s, with the H3s of the section you are reading); a collapsible
 *   "Contents" box on tablet/phone (every H2 + H3) that closes when a link is chosen.
 * - No reveal animation anywhere on this page: it is a reading page and its text is the LCP.
 */
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Accent } from '../i18n/Accent'
import { useRoute, useT } from '../i18n/LocaleProvider'
import { href } from '../i18n/locale'
import { links } from '../i18n/shared'
import { handbook, type HandbookTocEntry } from '../data/handbook.generated'
import { Button } from '../components/ui/Button'
import { ArrowUpRight, ChevronDown, Globe } from '../components/ui/icons'
import { onScroll, scrollState } from '../lib/scroll'
import { formatHandbookDate, text, type HandbookText } from './handbook.i18n'
import { openAssistant, useDeepLinkLanding } from './pageScroll'
import './subpage.css'
import './HandbookPage.css'

/** A heading counts as "being read" once its top passes this far below the viewport top. */
const SPY_LINE = 160

interface TocGroup {
  h2: HandbookTocEntry
  children: HandbookTocEntry[]
}

function groupToc(toc: readonly HandbookTocEntry[]): TocGroup[] {
  const groups: TocGroup[] = []
  for (const entry of toc) {
    if (entry.level === 2) groups.push({ h2: entry, children: [] })
    else groups[groups.length - 1]?.children.push(entry)
  }
  return groups
}

/**
 * Scroll spy without per-frame layout reads: heading offsets are measured once (and again whenever
 * the article resizes or fonts land), then every Lenis scroll tick is a binary search over numbers.
 */
function useActiveHeading(ids: readonly string[], articleRef: React.RefObject<HTMLElement | null>) {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const article = articleRef.current
    if (!article || ids.length === 0) return
    let tops: number[] = []
    let current: string | null = null
    let disposed = false

    const measure = () => {
      const y = window.scrollY
      tops = ids.map((id) => {
        const el = document.getElementById(id)
        return el ? el.getBoundingClientRect().top + y : Number.POSITIVE_INFINITY
      })
    }
    const update = (y: number) => {
      const line = y + SPY_LINE
      let lo = 0
      let hi = tops.length - 1
      let found = -1
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        if (tops[mid]! <= line) {
          found = mid
          lo = mid + 1
        } else hi = mid - 1
      }
      const next = found >= 0 ? ids[found]! : null
      if (next !== current) {
        current = next
        setActive(next)
      }
    }

    measure()
    update(window.scrollY)
    const off = onScroll((s) => update(s.y))
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => (measure(), update(scrollState.y))) : null
    ro?.observe(article)
    document.fonts?.ready.then(() => {
      if (disposed) return
      measure()
      update(window.scrollY)
    })
    return () => {
      disposed = true
      off()
      ro?.disconnect()
    }
  }, [ids, articleRef])

  return active
}

function HandbookToc({
  t,
  groups,
  ids,
  articleRef,
}: {
  t: HandbookText
  groups: TocGroup[]
  ids: readonly string[]
  articleRef: React.RefObject<HTMLElement | null>
}) {
  const active = useActiveHeading(ids, articleRef)
  const activeH2 = useMemo(() => {
    if (!active) return null
    const entry = handbook.toc.find((e) => e.id === active)
    return entry?.level === 3 ? (entry.parent ?? null) : (entry?.id ?? null)
  }, [active])

  const [open, setOpen] = useState(false)
  const deskRef = useRef<HTMLElement>(null)

  /* keep the active entry visible inside the (independently scrolling) desktop TOC */
  useEffect(() => {
    const nav = deskRef.current
    if (!nav || !active) return
    const link = nav.querySelector<HTMLElement>(`a[data-id="${CSS.escape(active)}"]`)
    if (!link) return
    const top = link.offsetTop
    const bottom = top + link.offsetHeight
    if (top < nav.scrollTop + 24) nav.scrollTop = Math.max(0, top - 24)
    else if (bottom > nav.scrollTop + nav.clientHeight - 24) nav.scrollTop = bottom - nav.clientHeight + 24
  }, [active])

  const current = (id: string) => (id === active ? ('location' as const) : undefined)

  return (
    <>
      {/* Desktop: sticky, H2s + the H3s of the section being read */}
      <nav ref={deskRef} className="hb-toc hb-toc--desk" aria-label={t.a11y.toc} data-lenis-prevent="">
        <p className="hb-toc__label u-body-3">{t.tocLabel}</p>
        <ol className="hb-toc__list" lang="en">
          {groups.map(({ h2, children }) => {
            const isOpen = h2.id === activeH2
            return (
              <li key={h2.id} className={isOpen ? 'is-open' : undefined}>
                <a
                  href={`#${h2.id}`}
                  data-id={h2.id}
                  className="hb-toc__link hb-toc__link--h2"
                  aria-current={current(h2.id)}
                >
                  {h2.title}
                </a>
                {children.length > 0 && (
                  <ol className="hb-toc__sub" hidden={!isOpen}>
                    {children.map((c) => (
                      <li key={c.id}>
                        <a
                          href={`#${c.id}`}
                          data-id={c.id}
                          className="hb-toc__link hb-toc__link--h3"
                          aria-current={current(c.id)}
                        >
                          {c.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Tablet / phone: collapsible, every H2 + H3 */}
      <details
        className="hb-toc-m"
        open={open}
        onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="hb-toc-m__summary">
          <span className="u-body-1">{t.tocLabel}</span>
          <ChevronDown size={18} className="hb-toc-m__chev" />
        </summary>
        <nav
          className="hb-toc hb-toc--mobile"
          aria-label={t.a11y.toc}
          data-lenis-prevent=""
          onClick={(e: MouseEvent<HTMLElement>) => {
            if ((e.target as HTMLElement).closest('a')) setOpen(false)
          }}
        >
          <ol className="hb-toc__list" lang="en">
            {groups.map(({ h2, children }) => (
              <li key={h2.id}>
                <a href={`#${h2.id}`} className="hb-toc__link hb-toc__link--h2" aria-current={current(h2.id)}>
                  {h2.title}
                </a>
                {children.length > 0 && (
                  <ol className="hb-toc__sub">
                    {children.map((c) => (
                      <li key={c.id}>
                        <a href={`#${c.id}`} className="hb-toc__link hb-toc__link--h3" aria-current={current(c.id)}>
                          {c.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
        </nav>
      </details>
    </>
  )
}

/** Plain text with the public channel turned into a link ("… on t.me/qairuhub."). */
function FeedbackLine({ text: line, newTab }: { text: string; newTab: string }) {
  const token = 't.me/qairuhub'
  const at = line.indexOf(token)
  if (at < 0) return <>{line}</>
  return (
    <>
      {line.slice(0, at)}
      <a href={links.telegram} target="_blank" rel="noopener noreferrer">
        {token}
        <span className="sr-only"> {newTab}</span>
      </a>
      {line.slice(at + token.length)}
    </>
  )
}

export default function HandbookPage() {
  const route = useRoute()
  const t = useT(text)
  const articleRef = useRef<HTMLElement>(null)
  useDeepLinkLanding()

  const groups = useMemo(() => groupToc(handbook.toc), [])
  const ids = useMemo(() => handbook.toc.map((e) => e.id), [])
  const updated = t.updated.replace('{date}', formatHandbookDate(handbook.updated, route.locale, t.months))
  const body = useMemo(() => ({ __html: handbook.html }), [])

  const onAsk = (e: MouseEvent<HTMLElement>) => {
    if (openAssistant()) e.preventDefault()
  }

  return (
    <div className="subpage handbook">
      {/* ---------- Heading */}
      <div className="subpage__head grid-air">
        <div className="subpage__intro on-sky">
          <p className="subpage__eyebrow u-body-2">{t.eyebrow}</p>
          <h1 className="u-h1-small subpage__title handbook__title">
            <Accent text={t.title} />
          </h1>
          <p className="u-body-1 subpage__lede">{t.intro}</p>
          <p className="u-body-2 handbook__meta">
            <span>{updated}</span>
            <span aria-hidden="true" className="handbook__dot">
              ·
            </span>
            <span>{t.legend}</span>
          </p>
          <div className="handbook__ctas">
            <Button variant="primary" href={href(route, '#launchpad')} onClick={onAsk}>
              {t.askCta}
            </Button>
            <Button
              variant="secondary"
              href={links.platform}
              external
              newTabLabel={t.a11y.newTab}
              iconRight={<ArrowUpRight size={16} />}
            >
              {t.platformCta}
            </Button>
          </div>
        </div>
      </div>

      {/* ---------- TOC + body */}
      <div className="grid-air handbook__layout">
        <aside className="handbook__aside">
          <HandbookToc t={t} groups={groups} ids={ids} articleRef={articleRef} />
        </aside>

        <div className="handbook__main">
          {t.kkNote && (
            <p className="hb-kk-note u-body-1">
              <Globe size={20} className="hb-kk-note__icon" />
              <span>{t.kkNote}</span>
            </p>
          )}

          <article
            ref={articleRef}
            className="hb-body"
            lang="en"
            aria-label={t.a11y.article}
            dangerouslySetInnerHTML={body}
          />

          <div className="hb-end">
            <p className="u-body-1 hb-end__feedback">
              <FeedbackLine text={t.feedback} newTab={t.a11y.newTab} />
            </p>
            <Button variant="tertiary" href="#">
              {t.backToTop}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
