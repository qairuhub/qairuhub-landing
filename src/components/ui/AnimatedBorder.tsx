import clsx from 'clsx'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

export interface AnimatedBorderProps extends HTMLAttributes<HTMLDivElement> {
  radius?: number
  /** seconds per revolution */
  duration?: number
  direction?: 'normal' | 'reverse'
  /** pause the stroke animation (e.g. when offscreen) */
  paused?: boolean
  children?: ReactNode
}

/**
 * Reference AnimatedBorder: a 1px card stroke with a bright segment slowly travelling
 * around the perimeter. Put content inside; the stroke overlays via mask-composite.
 */
export function AnimatedBorder({
  radius = 12,
  duration = 7,
  direction = 'normal',
  paused,
  className,
  style,
  children,
  ...rest
}: AnimatedBorderProps) {
  return (
    <div
      className={clsx('ab', paused && 'u-animation-paused', className)}
      style={
        {
          '--ab-radius': `${radius}px`,
          '--ab-duration': `${duration}s`,
          '--ab-direction': direction,
          ...style,
        } as CSSProperties
      }
      {...rest}
    >
      {children}
      <span className="ab__stroke" aria-hidden="true" />
    </div>
  )
}
