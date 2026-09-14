import clsx from 'clsx'
import type { LogoItem, LogoStyle } from '../../content'
import './LogoMark.css'

/**
 * `LogoItem` / `LogoStyle` are defined once, in src/content.ts (the arrays `logos.items` and
 * `integrations.items` are typed `LogoItem[]`). Re-exported here so the marquee sections can keep
 * importing them next to <LogoMark>.
 */
export type { LogoItem, LogoStyle }

export interface LogoMarkProps extends LogoItem {
  /**
   * `bar`  — bare wordmark for the logo bar (Logos): text at 18–30px, vertically centred in the
   *          80px carousel item; a real logo is clamped to the 32–40px height band.
   * `tile` — 80×80 box for Integrations: translucent fill, 1px translucent border, radius 12,
   *          padding 8; text is 12px/600 clamped to two lines; a real logo fills the padded box.
   */
  variant?: 'bar' | 'tile'
  className?: string
}

/**
 * Single logo placeholder used by BOTH the logo bar and the integrations row.
 *
 * HOW TO SWAP IN REAL LOGOS LATER
 * 1. Drop a white monochrome SVG into /public/logos/<slug>.svg (viewBox trimmed to the mark,
 *    fill="#fff" or currentColor; keep it ≈32–40px tall at its natural aspect ratio).
 * 2. Add `src: '/logos/<slug>.svg'` to the matching entry in `logos.items` / `integrations.items`
 *    (src/content.ts) — both arrays are typed `LogoItem[]`, so the field is already allowed.
 *    Nothing else is needed: both sections forward `item.src` and the `src` branch renders
 *    <img class="logo-mark__img"> instead of text, sized by the variant in LogoMark.css.
 * 3. Delete the `style` hint for that entry once every placeholder has been replaced.
 */
export function LogoMark({ name, style = 'sans', src, variant = 'bar', className }: LogoMarkProps) {
  const base = clsx('logo-mark', `logo-mark--${variant}`, className)

  if (src) {
    return (
      <span className={base} data-logo-placeholder="false" title={variant === 'tile' ? name : undefined}>
        <img
          className="logo-mark__img"
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      </span>
    )
  }

  return (
    <span
      className={clsx(base, `logo-mark--${style}`)}
      data-logo-placeholder="true"
      role="img"
      aria-label={name}
      title={variant === 'tile' ? name : undefined}
    >
      <span className="logo-mark__text" aria-hidden="true">
        {name}
      </span>
    </span>
  )
}

export default LogoMark
