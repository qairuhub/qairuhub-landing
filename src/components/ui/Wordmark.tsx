import clsx from 'clsx'
import type { CSSProperties } from 'react'
import { brand } from '../../content'

export interface WordmarkProps {
  className?: string
  style?: CSSProperties
  /** font-size in px (reference nav logo ≈ 24px tall) */
  size?: number
  title?: string
}

/** Cursive brand wordmark used in the header, footer and menus. Renders the lowercase logo spelling (`brand.wordmark`). */
export function Wordmark({ className, style, size = 28, title }: WordmarkProps) {
  return (
    <span
      className={clsx('wordmark inline-block select-none', className)}
      style={{ fontSize: size, ...style }}
      aria-label={title ?? brand.name}
      role="img"
    >
      {brand.wordmark}
    </span>
  )
}
