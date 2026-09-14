import { useMemo } from 'react'
import { Section, SectionText } from '../components/ui/Section'
import { Grid } from '../components/ui/Grid'
import { Reveal } from '../components/ui/Reveal'
import { AutoCarousel } from '../components/ui/AutoCarousel'
import { LogoMark, type LogoItem } from '../components/ui/LogoMark'
import { logos } from '../content'
import './Logos.css'

/** Rotate an array by `n` positions (row 2 starts halfway through the list so the rows never line up). */
function rotate<T>(list: readonly T[], n: number): T[] {
  if (list.length === 0) return []
  const k = ((n % list.length) + list.length) % list.length
  return [...list.slice(k), ...list.slice(0, k)]
}

/**
 * Logo bar — reference: u-h4 centred title, then two full-width (1600px) marquee rows of
 * monochrome wordmarks, 80px items / 80px gap, edge-masked, second row reversed and slower.
 *
 * Every wordmark is the shared <LogoMark variant="bar"> (src/components/ui/LogoMark.tsx) — the
 * same placeholder the integrations row uses. To swap in real logos add `src` to `logos.items`
 * in content.ts (see the LogoMark docblock); it is forwarded below untouched.
 */
export default function Logos() {
  const rows = useMemo(() => {
    // Read the content through LogoItem so an optional `src` flows to <LogoMark> untouched.
    const first: readonly LogoItem[] = logos.items
    const second = rotate(first, Math.floor(first.length / 2))
    return [
      { key: 'row-1', items: first, speed: 45, direction: 'normal' as const },
      { key: 'row-2', items: second, speed: 55, direction: 'reverse' as const },
    ]
  }, [])

  return (
    <Section id="logos" spacing="small" className="logos" aria-labelledby="logos-title">
      <SectionText titleAs="h2" titleClass="u-h4" title={<span id="logos-title">{logos.title}</span>} />

      <Grid hero className="logos__grid">
        <div className="logos__rows">
          {rows.map((row, i) => (
            <Reveal key={row.key} index={i} className="logos__row">
              <AutoCarousel
                items={row.items.map((item) => (
                  <LogoMark key={item.name} variant="bar" name={item.name} style={item.style} src={item.src} />
                ))}
                speed={row.speed}
                direction={row.direction}
                gap={80}
                itemHeight={80}
                ariaLabel={`${logos.title} — row ${i + 1}`}
              />
            </Reveal>
          ))}
        </div>
      </Grid>
    </Section>
  )
}
