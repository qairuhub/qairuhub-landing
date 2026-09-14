import clsx from 'clsx'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  /** use the 1600px page width instead of the 1150px content width */
  hero?: boolean
  /** justify-content: center */
  center?: boolean
  children?: ReactNode
}

/** Reference Grid_root: flex-wrap row, 24px gutter, max 1150px (hero: 1600px), 24px side padding. */
export function Grid({ hero, center, className, style, children, ...rest }: GridProps) {
  return (
    <div
      className={clsx('grid-air', hero && 'grid-air--hero', className)}
      style={{ justifyContent: center ? 'center' : undefined, ...style }}
      {...rest}
    >
      {children}
    </div>
  )
}

export interface ColProps extends HTMLAttributes<HTMLDivElement> {
  /** columns of 12 at ≥1024px */
  large?: number
  /** columns at ≤1024px (defaults to `large`) */
  medium?: number
  /** columns at ≤768px (defaults to 12) */
  small?: number
  offsetLarge?: number
  offsetMedium?: number
  offsetSmall?: number
  /** display:flex on the column */
  flex?: boolean
  children?: ReactNode
}

/** Reference Grid_root_column: width = (100% + gutter) / 12 * cols − gutter. */
export function Col({
  large = 12,
  medium,
  small = 12,
  offsetLarge = 0,
  offsetMedium,
  offsetSmall = 0,
  flex,
  className,
  style,
  children,
  ...rest
}: ColProps) {
  return (
    <div
      className={clsx('col-air', flex && 'flex', className)}
      style={
        {
          '--cols-large': large,
          '--cols-medium': medium ?? large,
          '--cols-small': small,
          '--cols-large-offset': offsetLarge,
          '--cols-medium-offset': offsetMedium ?? offsetLarge,
          '--cols-small-offset': offsetSmall,
          ...style,
        } as CSSProperties
      }
      {...rest}
    >
      {children}
    </div>
  )
}
