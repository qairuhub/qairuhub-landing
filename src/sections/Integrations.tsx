import { Section, SectionText } from '../components/ui/Section'
import { Grid, Col } from '../components/ui/Grid'
import { Reveal } from '../components/ui/Reveal'
import { AutoCarousel } from '../components/ui/AutoCarousel'
import { LogoMark } from '../components/ui/LogoMark'
import { Accent } from '../i18n/Accent'
import { useT } from '../i18n/LocaleProvider'
import { sectionIds, toolItems } from '../i18n/shared'
import { text } from './tools.i18n'
import './Integrations.css'

/**
 * Tools row (`#tools`, CONTENT-V3 §13 + V3-DECISIONS §4): u-h4 title with one cursive word, a
 * single seamless marquee of flat wordmark chips (developer tools only, never repeating the
 * ecosystem marquee's AI row), and a small "not partnerships" caption. AutoCarousel pauses
 * offscreen and under reduced motion.
 */
export default function Integrations() {
  const t = useT(text)

  const tiles = toolItems.map((item) => <LogoMark key={item.name} variant="tile" name={item.name} style={item.style} />)

  return (
    <Section id={sectionIds.tools} spacing="small" headerPadding className="integrations" aria-labelledby="tools-title">
      <SectionText
        titleAs="h2"
        titleClass="u-h4"
        title={
          <span id="tools-title">
            <Accent text={t.title} />
          </span>
        }
      />

      <Grid hero>
        <Col large={12} className="min-w-0">
          <Reveal className="w-full min-w-0">
            <AutoCarousel items={tiles} speed={50} gap={24} itemHeight={80} repeat={2} ariaLabel={t.a11yLabel} />
          </Reveal>
        </Col>
      </Grid>

      <Reveal index={1} className="w-full">
        <p className="u-caption on-sky integrations__note">{t.note}</p>
      </Reveal>
    </Section>
  )
}
