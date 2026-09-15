import { Section, SectionText } from '../components/ui/Section'
import { Grid } from '../components/ui/Grid'
import { Reveal } from '../components/ui/Reveal'
import { AutoCarousel } from '../components/ui/AutoCarousel'
import { LogoMark } from '../components/ui/LogoMark'
import { Accent } from '../i18n/Accent'
import { useT } from '../i18n/LocaleProvider'
import { fmt, stripAccent } from '../i18n/locale'
import { ecosystemRows, sectionIds } from '../i18n/shared'
import { text } from './ecosystem.i18n'
import './Logos.css'

/** Per-row motion: row 2 runs the other way and a little slower, so the rows never line up. */
const ROW_MOTION = [
  { speed: 45, direction: 'normal' as const },
  { speed: 55, direction: 'reverse' as const },
]

/**
 * Ecosystem marquee (`#ecosystem`, V3-DECISIONS §4): a u-h4 centred title, two full-width
 * marquee rows of text wordmarks (row 1: the local ecosystem and our own products, row 2: the AI
 * tools and platforms our builders use), then a small caption. Text wordmarks only; no
 * third-party logo files, and no "partner" / "sponsor" wording next to these names.
 *
 * The rows are short (5–6 names), so each loop set lays the list out twice (`repeat`) to stay
 * wider than the 1600px row. AutoCarousel pauses offscreen and under reduced motion.
 */
export default function Logos() {
  const t = useT(text)
  const plainTitle = stripAccent(t.title)

  return (
    <Section id={sectionIds.ecosystem} spacing="small" className="logos" aria-labelledby="ecosystem-title">
      <SectionText
        titleAs="h2"
        titleClass="u-h4"
        title={
          <span id="ecosystem-title">
            <Accent text={t.title} />
          </span>
        }
      />

      <Grid hero className="logos__grid">
        <div className="logos__rows">
          {ecosystemRows.map((row, i) => (
            <Reveal key={i} index={i} className="logos__row">
              <AutoCarousel
                items={row.map((item) => (
                  <LogoMark key={item.name} variant="bar" name={item.name} style={item.style} />
                ))}
                speed={ROW_MOTION[i].speed}
                direction={ROW_MOTION[i].direction}
                gap={80}
                itemHeight={72}
                repeat={2}
                ariaLabel={fmt(t.marqueeRow, { title: plainTitle, n: i + 1 })}
              />
            </Reveal>
          ))}
        </div>
      </Grid>

      <Reveal index={2} className="w-full">
        <p className="u-caption on-sky logos__caption">{t.caption}</p>
      </Reveal>
    </Section>
  )
}
