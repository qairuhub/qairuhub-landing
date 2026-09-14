import clsx from 'clsx'
import { Section } from '../components/ui/Section'
import { Grid, Col } from '../components/ui/Grid'
import { Reveal, useInView } from '../components/ui/Reveal'
import { AnimatedBorder } from '../components/ui/AnimatedBorder'
import { Button } from '../components/ui/Button'
import { ctaCard } from '../content'
import { useReducedMotion } from '../lib/media'
import './ModelsCTA.css'

/**
 * Reference CTACard: full-width AnimatedBorder card with three huge blurred colour orbs
 * slowly rotating and pulsing behind a cursive headline — the one colourful moment on the page.
 */
export default function ModelsCTA() {
  const reduced = useReducedMotion()
  // Pause the (expensive, blurred) orb animations + border stroke while the card is offscreen.
  const { ref, inView } = useInView<HTMLDivElement>({ once: false, threshold: 0 })
  const paused = reduced || !inView

  return (
    <Section id="cta">
      <Grid>
        <Col large={12}>
          <Reveal>
            <AnimatedBorder radius={12} paused={paused}>
              <div ref={ref} className={clsx('ctacard', reduced && 'ctacard--static')}>
                <div className="ctacard__orbs" aria-hidden="true">
                  <div className={clsx('ctacard__orbs-inner', paused && 'u-animation-paused')}>
                    <span className="orb orb--blue" />
                    <span className="orb orb--lime" />
                    <span className="orb orb--pink" />
                  </div>
                  <div className="ctacard__overlay" />
                </div>

                <div className="ctacard__content">
                  <h2 className="u-h3 cursive">{ctaCard.title}</h2>
                  <h3 className="u-h5">{ctaCard.subtitle}</h3>
                  <p className="u-body-1">{ctaCard.body}</p>
                </div>

                <div className="ctacard__action">
                  <Button
                    variant="secondary"
                    href={ctaCard.cta.href}
                    target={ctaCard.cta.href.startsWith('http') ? '_blank' : undefined}
                  >
                    {ctaCard.cta.label}
                  </Button>
                </div>
              </div>
            </AnimatedBorder>
          </Reveal>
        </Col>
      </Grid>
    </Section>
  )
}
