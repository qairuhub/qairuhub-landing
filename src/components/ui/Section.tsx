import clsx from 'clsx'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { Grid, Col } from './Grid'
import { RevealGroup } from './Reveal'

type Spacing = 'default' | 'small' | 'large' | 'none'

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  id?: string
  /** gap between direct children: default 48px · small 24px · large 120px · none 0 */
  spacing?: Spacing
  /** remove vertical padding (reference `p-0!`) */
  flush?: boolean
  /** padding-top: header-height*2 */
  headerPadding?: boolean
  theme?: 'dark' | 'light'
  as?: 'section' | 'div' | 'footer' | 'header'
  children?: ReactNode
}

/** Reference Section_root: flex column, centered, 120px vertical padding, 48px gap, z-2. */
export function Section({
  spacing = 'default',
  flush,
  headerPadding,
  theme = 'dark',
  as = 'section',
  className,
  children,
  ...rest
}: SectionProps) {
  const Tag = as
  return (
    <Tag
      data-theme={theme}
      className={clsx(
        'section-air',
        spacing !== 'default' && `section-air--${spacing}`,
        flush && 'section-air--flush',
        headerPadding && 'section-air--header-padding',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export interface SectionTextProps {
  /** headline node — may include <i>cursive word</i> */
  title?: ReactNode
  titleAs?: 'h1' | 'h2' | 'h3' | 'h4'
  /** type utility for the title: u-h2-large (56) · u-h2 (40) · u-h3 (32) · u-h4 (20) */
  titleClass?: string
  body?: ReactNode
  bodyClass?: string
  ctas?: ReactNode
  /** column span at ≥1024 (reference: 8 of 12) */
  cols?: number
  align?: 'center' | 'left'
  /**
   * The block sits directly on the moving sky (default): title + body get the `.on-sky` contrast
   * glow from global.css. Pass `false` inside light cards / filled surfaces.
   */
  onSky?: boolean
  className?: string
  style?: CSSProperties
}

/** Reference Text_root: centered 8-col block — title, paragraph, CTA row — each revealed with a 150ms stagger. */
export function SectionText({
  title,
  titleAs = 'h2',
  titleClass = 'u-h2-large',
  body,
  bodyClass = 'u-body-1',
  ctas,
  cols = 8,
  align = 'center',
  onSky = true,
  className,
  style,
}: SectionTextProps) {
  const TitleTag = titleAs
  return (
    <Grid center={align === 'center'} className={className} style={style}>
      <Col large={cols} medium={10} small={12}>
        <RevealGroup className={clsx('text-air', align === 'left' && 'text-air--left', onSky && 'on-sky')}>
          {title != null && <TitleTag className={titleClass}>{title}</TitleTag>}
          {body != null && <p className={clsx(bodyClass, 'max-w-[62ch]')}>{body}</p>}
          {ctas != null && <div className="text-air__ctas">{ctas}</div>}
        </RevealGroup>
      </Col>
    </Grid>
  )
}
