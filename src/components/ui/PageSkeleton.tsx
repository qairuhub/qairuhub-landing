import './PageSkeleton.css'

/**
 * Placeholder for a sub-page chunk (/members, /handbook, 404) while it downloads: the heading
 * block's shape (eyebrow, title, two lede lines) in the page's own metrics, so the header and
 * footer stay put and the heading lands where the bars were.
 *
 * Bars only, never text: it can never become the LCP element, and screen readers skip it. It
 * appears only after 300 ms, so a chunk that is already cached (or fast) never flashes it.
 */
export default function PageSkeleton() {
  return (
    <div className="page-skel" aria-hidden="true">
      <div className="page-skel__intro grid-air">
        <span className="page-skel__bar page-skel__eyebrow" />
        <span className="page-skel__bar page-skel__title" />
        <span className="page-skel__lede">
          <span className="page-skel__bar" />
          <span className="page-skel__bar page-skel__bar--short" />
        </span>
      </div>
    </div>
  )
}
