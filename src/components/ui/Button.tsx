import clsx from 'clsx'
import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'white' | 'tertiary' | 'icon'

export interface ButtonProps {
  /**
   * primary   — filled with --button-color (white on dark sections), dark label; hover melts to ghost
   * secondary — ghost 1px border; hover radial fill rotates in
   * white     — haze gradient fill, black label (header "Start" button)
   * tertiary  — plain label with animated underline (nav links, "Login")
   * icon      — 38×38 icon-only
   */
  variant?: ButtonVariant
  href?: string
  target?: string
  icon?: ReactNode
  iconRight?: ReactNode
  className?: string
  style?: CSSProperties
  children?: ReactNode
  ariaLabel?: string
  disabled?: boolean
  active?: boolean
  type?: 'button' | 'submit'
  onClick?: MouseEventHandler<HTMLElement>
  /** override the label type class (default u-body-2 = 14px) */
  labelClass?: string
}

/** Reference Button_root. 38px tall, radius 8, 0 16 padding, 14px/500 label. */
export function Button({
  variant = 'primary',
  href,
  target,
  icon,
  iconRight,
  className,
  style,
  children,
  ariaLabel,
  disabled,
  active,
  type = 'button',
  onClick,
  labelClass = 'u-body-2',
}: ButtonProps) {
  const cls = clsx('btn', `btn--${variant}`, active && 'is-active', className)
  const inner = (
    <>
      {icon}
      {children != null && <span className={labelClass}>{children}</span>}
      {iconRight}
    </>
  )
  if (href && !disabled) {
    return (
      <a
        className={cls}
        style={style}
        href={href}
        target={target}
        rel={target === '_blank' ? 'noreferrer' : undefined}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {inner}
      </a>
    )
  }
  return (
    <button className={cls} style={style} type={type} disabled={disabled} aria-label={ariaLabel} onClick={onClick}>
      {inner}
    </button>
  )
}
