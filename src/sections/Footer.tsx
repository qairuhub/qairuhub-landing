import { footer } from '../content'
import { Button } from '../components/ui/Button'
import { Grid } from '../components/ui/Grid'
import { RevealGroup } from '../components/ui/Reveal'
import {
  ArrowUpRight,
  SocialGitHub,
  SocialInstagram,
  SocialLinkedIn,
  SocialTelegram,
  SocialX,
} from '../components/ui/icons'
import './Footer.css'

const SOCIAL_ICONS = {
  telegram: SocialTelegram,
  instagram: SocialInstagram,
  x: SocialX,
  linkedin: SocialLinkedIn,
  github: SocialGitHub,
} as const

const isExternal = (href: string) => /^https?:\/\//i.test(href)

/**
 * Footer: a 150vh DOM spacer over the last stretch of the journey. The moonlit grass field,
 * the stars and the returning glass wordmark are all drawn by the single fixed SkyScene
 * canvas (journey.ground / journey.night), so nothing is rendered here except the link row
 * pinned at the very bottom. `z-[2]` keeps it above the fixed z-0 backdrop like <main>.
 */
export default function Footer() {
  return (
    <footer id="footer" data-theme="dark" className="footer z-[2]">
      <div className="footer__content">
        <Grid hero>
          <RevealGroup className="footer__row">
            <div className="footer__col">
              <nav aria-label="Footer">
                <ul className="footer__nav">
                  {footer.links.map((link) => {
                    const external = 'external' in link && link.external === true
                    return (
                      <li key={link.label}>
                        <a
                          className="footer__link"
                          href={link.href}
                          target={external ? '_blank' : undefined}
                          rel={external ? 'noreferrer' : undefined}
                        >
                          {link.label}
                          {external && <ArrowUpRight size={14} />}
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </nav>
            </div>

            <div className="footer__col footer__col--right">
              <div className="footer__socials">
                {footer.socials.map((social) => {
                  const Icon = SOCIAL_ICONS[social.icon]
                  const external = isExternal(social.href)
                  return (
                    <Button
                      key={social.label}
                      variant="icon"
                      href={social.href}
                      target={external ? '_blank' : undefined}
                      ariaLabel={social.label}
                      className="footer__social"
                      icon={<Icon size={18} />}
                    />
                  )
                })}
              </div>
              <p className="u-body-3 footer__copy">{footer.copyright}</p>
            </div>
          </RevealGroup>
        </Grid>
      </div>
    </footer>
  )
}
