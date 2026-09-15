import clsx from 'clsx'
import type { WordmarkItem, WordmarkStyle } from '../../i18n/shared'
import './LogoMark.css'

/** A marquee item: the locale-invariant wordmark (src/i18n/shared.ts) plus an optional real logo. */
export interface LogoItem extends WordmarkItem {
  /** White monochrome SVG under /public/logos/. Only with written permission (V3-DECISIONS §4). */
  src?: string
}

export type LogoStyle = WordmarkStyle

export interface LogoMarkProps extends Omit<LogoItem, 'style'> {
  style?: LogoStyle
  /**
   * `bar`  — bare wordmark for the ecosystem marquee (Logos): text at 16–28px, vertically centred
   *          in the carousel item; a real logo is clamped to the 32–40px height band.
   * `tile` — flat translucent chip for the Tools row (Integrations): 80px tall, at least 80px
   *          wide, radius 12, one line of 14px text; a real logo fills the padded box.
   */
  variant?: 'bar' | 'tile'
  className?: string
}

/**
 * The one text-wordmark placeholder used by the ecosystem marquee and the Tools row.
 *
 * Styles (`WordmarkStyle`): `caps` (tracked uppercase sans), `sans` (Inter 600), `mono`
 * (system monospace), `serif` (system serif), `script` (Caveat). They only hint at each name's
 * own typographic voice; no third-party logo files ship without written permission.
 *
 * The name is exposed once, as `role="img"` + `aria-label`, so screen readers never read a
 * visually styled string letter by letter.
 */
export function LogoMark({ name, style = 'sans', src, variant = 'bar', className }: LogoMarkProps) {
  const base = clsx('logo-mark', `logo-mark--${variant}`, className)

  if (src) {
    return (
      <span className={base} data-logo-placeholder="false">
        <img className="logo-mark__img" src={src} alt={name} loading="lazy" decoding="async" draggable={false} />
      </span>
    )
  }

  return (
    <span className={clsx(base, `logo-mark--${style}`)} data-logo-placeholder="true" role="img" aria-label={name}>
      <span className="logo-mark__text" aria-hidden="true">
        {name}
      </span>
    </span>
  )
}

export default LogoMark
