import { Section, SectionText } from '../components/ui/Section'
import { Grid, Col } from '../components/ui/Grid'
import { Reveal } from '../components/ui/Reveal'
import { AutoCarousel } from '../components/ui/AutoCarousel'
import { LogoMark, type LogoItem } from '../components/ui/LogoMark'
import { integrations } from '../content'
import { useReducedMotion } from '../lib/media'
import './Integrations.css'

/**
 * Integrations (reference #10): small spacing + header padding, u-h4 title with one cursive word,
 * and a single seamless marquee row of 80×80 wordmark tiles (80px gap, edge mask).
 *
 * Tiles are the shared <LogoMark variant="tile"> (src/components/ui/LogoMark.tsx) — the same
 * placeholder the logo bar uses. To swap in real logos, add `src` to `integrations.items` in
 * content.ts (see the LogoMark docblock); it is forwarded below.
 */
export default function Integrations() {
  const reducedMotion = useReducedMotion()

  // Read the content through LogoItem so an optional `src` flows to <LogoMark> untouched.
  const items: readonly LogoItem[] = integrations.items
  const tiles = items.map((item) => (
    <LogoMark key={item.name} variant="tile" name={item.name} style={item.style} src={item.src} />
  ))

  return (
    <Section id="integrations" spacing="small" headerPadding className="integrations">
      <SectionText
        titleAs="h2"
        titleClass="u-h4"
        title={
          <>
            {integrations.titleBefore}
            <i>{integrations.titleCursive}</i>
            {integrations.titleAfter}
          </>
        }
      />

      <Grid hero>
        <Col large={12} className="min-w-0">
          <Reveal className="w-full min-w-0">
            <AutoCarousel
              items={tiles}
              speed={50}
              gap={80}
              itemHeight={80}
              paused={reducedMotion}
              ariaLabel="Integrations and partners"
            />
          </Reveal>
        </Col>
      </Grid>
    </Section>
  )
}
