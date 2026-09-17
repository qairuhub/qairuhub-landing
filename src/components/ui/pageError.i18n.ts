/**
 * Copy for the sub-page chunk-failure notice (App.tsx <ChunkBoundary fallback>). Kept in the entry
 * chunk with the component, because the chunk that failed is exactly the one that would have
 * carried its own copy. CONTENT-V3 tone: plain, no apology theatre, no blame on the reader.
 */
import type { Dict } from '../../i18n/locale'

export interface PageErrorText {
  /** what happened + what to do, one sentence each */
  body: string
  /** label of the retry button */
  retry: string
}

export const text = {
  en: {
    body: 'This page did not finish loading. Check your connection and try again.',
    retry: 'Reload the page',
  },
  kk: {
    body: 'Бұл бет толық жүктелмеді. Байланысыңызды тексеріп, қайта көріңіз.',
    retry: 'Бетті қайта жүктеу',
  },
} satisfies Dict<PageErrorText>
