/**
 * Q, the QairuHub snail (V3-DECISIONS §7), drawn from the President's artwork. viewBox 424×332:
 *   - shell: a ring centred at (166, 166), outer r 166, inner r 106 — the bowl of the Q
 *   - body/foot: leaves the ring's lower right, runs along the flat bottom (y 332) from x 166 to
 *     x 360 and rises into a rounded head (rightmost ≈ 424,273, top ≈ 394,229)
 *   - neck: the upper edge from (296, 270) on the ring to (372, 234)
 *   - antennae: two ~10-wide stalks, bases (363, 238) / (393, 239), balls r 13 at (354, 183) and
 *     r 12 at (402, 203)
 * One path (non-zero fill: the outer silhouette and both stalks wind the same way, the inner
 * circle the other way) plus two circles. Monochrome: `currentColor`, navy `#0B1729` by default;
 * white on dark UI, or the navy glyph on a white disc (the launcher).
 */
const SHAPE =
  'M296 270A166 166 0 1 0 166 332H360C400 332 424 306 424 273C424 246 410 229 394 229C384 229 377 231 372 234C350 244 322 258 296 270ZM166 60A106 106 0 1 1 166 272A106 106 0 1 1 166 60ZM369 245L359 182L349 184L359 247ZM396 248L407 204L397 202L386 246Z'

export const SNAIL_NAVY = '#0B1729'

export function SnailQ({ size = 40, className, color }: { size?: number; className?: string; color?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={Math.round((size * 332) / 424)}
      viewBox="0 0 424 332"
      fill={color ?? 'currentColor'}
      aria-hidden="true"
      focusable="false"
    >
      <path d={SHAPE} />
      <circle cx="354" cy="183" r="13" />
      <circle cx="402" cy="203" r="12" />
    </svg>
  )
}
