import clsx from 'clsx'
import type { CSSProperties } from 'react'
import { brand } from '../../i18n/shared'

export interface WordmarkProps {
  className?: string
  style?: CSSProperties
  /** font-size in px (reference nav logo ≈ 24px tall) */
  size?: number
  /**
   * Accessible name. Defaults to `brand.name`. Pass `decorative` instead when the wordmark sits
   * inside a link that already carries its own label (the header logo's "QairuHub home").
   */
  title?: string
  decorative?: boolean
}

/**
 * Cursive brand wordmark used in the header, footer and menus. Renders the lowercase logo
 * spelling (`brand.wordmark`, Latin in both locales: Courgette has no Cyrillic).
 */
export function Wordmark({ className, style, size = 28, title, decorative }: WordmarkProps) {
  return (
    <span
      className={clsx('wordmark inline-block select-none', className)}
      style={{ fontSize: size, ...style }}
      lang="en"
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': title ?? brand.name })}
    >
      {brand.wordmark}
    </span>
  )
}
