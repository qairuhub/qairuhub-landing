import { Fragment, type ReactNode } from 'react'

/**
 * Renders a headline string with its single cursive accent: "Start where you *are*." →
 * `Start where you <i>are</i>.` The `<i>` picks up the Caveat accent style from global.css.
 * Text without asterisks renders unchanged. Plain-text form: `stripAccent` in locale.ts. `as="span"` wraps the result in a span.
 */
export function Accent({ text, as }: { text: string; as?: 'span' }) {
  const parts = text.split(/\*([^*]+)\*/)
  const nodes: ReactNode[] = parts.map((part, i) =>
    i % 2 === 1 ? <i key={i}>{part}</i> : part ? <Fragment key={i}>{part}</Fragment> : null,
  )
  return as === 'span' ? <span>{nodes}</span> : <>{nodes}</>
}

