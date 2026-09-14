import clsx from 'clsx'
import type { ReactNode } from 'react'

export interface PillProps {
  children?: ReactNode
  icon?: ReactNode
  size?: 'md' | 'sm'
  outline?: boolean
  className?: string
  as?: 'span' | 'button' | 'div'
  onClick?: () => void
}

/** Reference pill: fully rounded, 40px, 0 20 padding, translucent fill. Used for tags ("Coming soon") and toggles. */
export function Pill({ children, icon, size = 'md', outline, className, as = 'span', onClick }: PillProps) {
  const Tag = as
  return (
    <Tag
      className={clsx('pill', size === 'sm' && 'pill--sm', outline && 'pill--outline', className)}
      onClick={onClick}
      {...(as === 'button' ? { type: 'button' as const } : {})}
    >
      {icon}
      {children}
    </Tag>
  )
}
