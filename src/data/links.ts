/**
 * The link-in-bio list behind `/links` (and `/kk/links`).
 *
 * This is the one file to edit when a link is added, removed or expires: the page renders whatever
 * is in `siteLinks`, in order, and the copy for each entry lives in `src/pages/links.i18n.ts` under
 * the same `id`. Adding an entry without its copy is a TypeScript error, so a link can never ship
 * without its Kazakh and English text.
 *
 * Keep the list short: this page is what a bio link points at, and every extra row costs the one
 * below it. Anything with a date gets `until`, so a stale row is obvious in review.
 */
export type LinkId = 'masterclass' | 'telegram' | 'instagram' | 'site' | 'handbook'

export type LinkIcon = 'sparkle' | 'telegram' | 'instagram' | 'globe' | 'book'

export interface SiteLink {
  id: LinkId
  href: string
  icon: LinkIcon
  /** the first row is the one we want people to press */
  featured?: boolean
  /**
   * ISO date (Asia/Almaty) after which the row is no longer relevant. Nothing removes it
   * automatically — it is a note for whoever edits this file next.
   */
  until?: string
}

export const siteLinks: SiteLink[] = [
  {
    id: 'masterclass',
    href: 'https://docs.google.com/forms/d/e/1FAIpQLSclHVKcpbiNVYx_-Sk9CW4OZoYu25EpSxlCl8_JslLAM-EWrw/viewform',
    icon: 'sparkle',
    featured: true,
  },
  { id: 'telegram', href: 'https://t.me/qairuhub', icon: 'telegram' },
  { id: 'instagram', href: 'https://instagram.com/qairuhub', icon: 'instagram' },
  { id: 'site', href: 'https://qairuhub.com', icon: 'globe' },
]
