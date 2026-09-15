import clsx from 'clsx'
import { Section } from '../components/ui/Section'
import { Grid, Col } from '../components/ui/Grid'
import { Reveal, useInView } from '../components/ui/Reveal'
import { AnimatedBorder } from '../components/ui/AnimatedBorder'
import { Button } from '../components/ui/Button'
import { Accent } from '../i18n/Accent'
import { href } from '../i18n/locale'
import { useRoute, useT } from '../i18n/LocaleProvider'
import { sectionIds } from '../i18n/shared'
import { text } from './cta.i18n'
import { useReducedMotion } from '../lib/media'
import './ModelsCTA.css'

/**
 * CTA card (`#cta`, CONTENT-V3 §12). Reference CTACard: full-width AnimatedBorder card with three
 * soft colour orbs slowly rotating and pulsing behind the copy — the one colourful moment on the
 * page. The headline carries exactly one cursive <Accent> word; the ghost button opens the
 * QairuHub Handbook in the same tab, in the page locale.
 */
export default function ModelsCTA() {
  const t = useT(text)
  const route = useRoute()
  const reduced = useReducedMotion()
  // Pause the (expensive, blurred) orb animations + border stroke while the card is offscreen.
  const { ref, inView } = useInView<HTMLDivElement>({ once: false, threshold: 0 })
  const paused = reduced || !inView

  return (
    <Section id={sectionIds.cta} aria-labelledby="cta-title">
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
                  <h2 id="cta-title" className="u-h3 ctacard__title">
                    <Accent text={t.title} />
                  </h2>
                  <p className="u-h5">{t.subtitle}</p>
                  <p className="u-body-1">{t.body}</p>
                </div>

                <div className="ctacard__action">
                  <Button variant="secondary" href={href(route, 'handbook')}>
                    {t.button}
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
