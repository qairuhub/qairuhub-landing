import { Button } from './Button'
import { useT } from '../../i18n/LocaleProvider'
import { text } from './pageError.i18n'
import './PageSkeleton.css'

/**
 * Shown by the sub-page <ChunkBoundary> in App.tsx when the page's chunk could not be loaded at
 * all (a dropped TLS connection — the KZ ISP does this intermittently — or a deploy that renamed
 * every chunk while the tab stayed open).
 *
 * It exists because the boundary's fallback used to be <PageSkeleton>, the same bars the Suspense
 * shows while the chunk is still on its way: a failure was indistinguishable from a slow load and
 * nothing ever resolved it (`reloadOnceForChunkError` is a deliberate no-op for the first 30 s,
 * which is precisely when a first-visit failure happens). The reader now gets a sentence and a
 * button. The header, the footer, the sky and the assistant launcher are outside this boundary and
 * stay usable either way.
 *
 * Entry-chunk only: its copy, its styles and the <Button> must not live in the chunk that failed.
 */
export default function PageLoadFailed() {
  const t = useT(text)
  return (
    <div className="page-fail">
      <div className="page-fail__inner grid-air on-sky" role="alert">
        <p className="u-body-1 page-fail__body">{t.body}</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          {t.retry}
        </Button>
      </div>
    </div>
  )
}
