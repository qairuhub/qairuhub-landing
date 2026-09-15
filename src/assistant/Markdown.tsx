import { Fragment, type MouseEvent, type ReactNode } from 'react'
import { localeBase, type Locale } from '../i18n/locale'

/**
 * Markdown subset for Q's answers (AGENT-SPEC §6 "Links" + "Rendering"): paragraphs, line breaks,
 * `-` / `1.` lists, **bold**, *italics* and links, built as React elements. Model output never
 * reaches `innerHTML`.
 *
 * Link policy
 * - `https://` URLs (Markdown links, bare URLs and bare allowlisted domains such as
 *   `t.me/qairuhub`) become anchors only when the host is on the allowlist; they open in a new
 *   tab with `rel="noopener noreferrer"`.
 * - Relative `/handbook`, `/handbook#…`, `/members` and `/#…` get the page's locale base:
 *   `/handbook#x` → `/kk/handbook#x` on KK pages.
 * - Everything else (other hosts, `http:`, `javascript:`, credentials, ports) renders as plain
 *   text; for a Markdown link only its label is shown.
 * Streaming-safe: an unclosed `**` at the end of the text renders bold instead of as asterisks.
 */

/** Hosts Q may link to: AGENT-SPEC §6 plus theqairubook's live app (DECISIONS §1). */
export const LINK_HOSTS: readonly string[] = [
  'qairuhub.com',
  'community.qairuhub.com',
  't.me',
  'instagram.com',
  'github.com',
  'hackalem.ai',
  'forms.gle',
  'theqairubook-app-production.up.railway.app',
]

export interface ResolvedLink {
  href: string
  external: boolean
}

const RELATIVE = /^\/(?:kk\/?)?(handbook(?:#[\p{L}\p{N}_-]+)?|members|#[\p{L}\p{N}_-]+)?$/u
const BARE_HOST = /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?#]|$)/i

/** Allowlisted `href` for a raw URL or path in the page locale, or `null` (render as text). */
export function resolveLink(raw: string, locale: Locale): ResolvedLink | null {
  const value = raw.trim()
  if (value.startsWith('/')) {
    const m = RELATIVE.exec(value)
    return m ? { href: `${localeBase(locale)}${m[1] ?? ''}`, external: false } : null
  }
  let candidate: string
  if (/^https:\/\//i.test(value)) candidate = value
  else if (BARE_HOST.test(value)) candidate = `https://${value}`
  else return null
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  return LINK_HOSTS.includes(host) ? { href: url.href, external: true } : null
}

export interface MarkdownContext {
  locale: Locale
  /** sr-only suffix for new-tab links, e.g. "(opens in a new tab)" */
  newTabLabel: string
  /** called for same-document (relative) link clicks, e.g. to close the panel */
  onInternalLink?: () => void
}

/* ------------------------------------------------------------------ inline */

// only `.` needs escaping (an escaped `-` outside a class is a syntax error under the `u` flag)
const BARE_DOMAINS = LINK_HOSTS.map((h) => h.replace(/\./g, '\\.'))
  .sort((a, b) => b.length - a.length)
  .join('|')

const INLINE = new RegExp(
  [
    /\[([^\]\n]+)\]\(\s*<?([^()\s>]+)>?\s*\)/u.source, // 1 label, 2 url
    /\*\*(?=\S)([^*]+?)(?<=\S)\*\*/u.source, // 3 bold
    /__(?=\S)([^_]+?)(?<=\S)__/u.source, // 4 bold
    /\*\*(?=\S)([^*]+)$/u.source, // 5 bold, unclosed while streaming
    /(?<![\p{L}\p{N}*])\*(?=[^\s*])([^*\n]+?)(?<=\S)\*(?![\p{L}\p{N}*])/u.source, // 6 italic
    /(?<![\p{L}\p{N}_])_(?=[^\s_])([^_\n]+?)(?<=\S)_(?![\p{L}\p{N}_])/u.source, // 7 italic
    /(https?:\/\/[^\s<>()[\]"']+)/u.source, // 8 url
    `(?<![\\p{L}\\p{N}@./-])((?:www\\.)?(?:${BARE_DOMAINS})(?:/[^\\s<>()[\\]"']*)?)`, // 9 bare domain
    /(?<![\p{L}\p{N}./:#-])(\/(?:kk\/)?(?:handbook(?:#[\p{L}\p{N}_-]+)?|members(?![\p{L}\p{N}])|#[\p{L}\p{N}_-]+))/u.source, // 10 relative
  ].join('|'),
  'gu',
)

const TRAILING = /[.,;:!?…'")\]]+$/

function linkNode(label: ReactNode, raw: string, ctx: MarkdownContext, key: string): ReactNode {
  const link = resolveLink(raw, ctx.locale)
  if (!link) return <Fragment key={key}>{label}</Fragment>
  if (link.external) {
    return (
      <a key={key} href={link.href} target="_blank" rel="noopener noreferrer">
        {label}
        <span className="sr-only"> {ctx.newTabLabel}</span>
      </a>
    )
  }
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) ctx.onInternalLink?.()
  }
  return (
    <a key={key} href={link.href} onClick={onClick}>
      {label}
    </a>
  )
}

export function renderInline(text: string, ctx: MarkdownContext, keyPrefix = 'i'): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let n = 0
  const key = () => `${keyPrefix}${n++}`
  // matchAll iterates a copy of the regex, so the recursive calls below never share lastIndex
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    last = m.index + m[0].length
    if (m[1] !== undefined) {
      // the label is plain text: no nested anchors, emphasis markers dropped
      out.push(linkNode(m[1].replace(/\*\*|__|[*_]/g, ''), m[2], ctx, key()))
    } else if (m[3] !== undefined || m[4] !== undefined || m[5] !== undefined) {
      const inner = (m[3] ?? m[4] ?? m[5]) as string
      const k = key()
      out.push(<strong key={k}>{renderInline(inner, ctx, `${k}b`)}</strong>)
    } else if (m[6] !== undefined || m[7] !== undefined) {
      const k = key()
      out.push(<em key={k}>{renderInline((m[6] ?? m[7]) as string, ctx, `${k}e`)}</em>)
    } else {
      const raw = (m[8] ?? m[9] ?? m[10]) as string
      const trail = TRAILING.exec(raw)?.[0] ?? ''
      const url = trail ? raw.slice(0, -trail.length) : raw
      out.push(linkNode(url, url, ctx, key()))
      if (trail) out.push(trail)
    }
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/* ------------------------------------------------------------------ blocks */

type Block = { kind: 'p'; lines: string[] } | { kind: 'ul' | 'ol'; items: string[] }

const LIST_ITEM = /^\s*(?:([-*•+])|(\d+)[.)])\s+(.*)$/

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let current: Block | null = null
  const close = () => {
    if (current) blocks.push(current)
    current = null
  }
  for (const rawLine of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.replace(/\s+$/, '')
    if (!line.trim() || /^\s*(?:```|~~~|-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      close()
      continue
    }
    const item = LIST_ITEM.exec(line)
    if (item) {
      const kind = item[2] ? 'ol' : 'ul'
      if (!current || current.kind !== kind) {
        close()
        current = { kind, items: [] }
      }
      ;(current as { items: string[] }).items.push(item[3])
      continue
    }
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line)
    const content = heading ? `**${heading[1]}**` : line.trim()
    if (current && current.kind !== 'p') {
      // an indented continuation of the previous list item
      if (/^\s{2,}/.test(rawLine) && current.items.length) {
        current.items[current.items.length - 1] += ` ${content}`
        continue
      }
      close()
    }
    if (!current) current = { kind: 'p', lines: [] }
    ;(current as { lines: string[] }).lines.push(content)
  }
  close()
  return blocks
}

export default function Markdown({ text, className, ...ctx }: MarkdownContext & { text: string; className?: string }) {
  const blocks = parseBlocks(text)
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.kind === 'p') {
          return (
            <p key={i}>
              {b.lines.map((line, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {renderInline(line, ctx, `${i}.${j}.`)}
                </Fragment>
              ))}
            </p>
          )
        }
        const List = b.kind
        return (
          <List key={i}>
            {b.items.map((item, j) => (
              <li key={j}>{renderInline(item, ctx, `${i}.${j}.`)}</li>
            ))}
          </List>
        )
      })}
    </div>
  )
}
