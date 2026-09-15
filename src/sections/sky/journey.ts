/**
 * The scroll-driven journey (docs/JOURNEY-SPEC.md): space → descent → day sky → dusk → night + field.
 *
 * ONE object, written once per frame by `updateJourney` (SkyScene's JourneyDriver, useFrame
 * priority -100) and READ by every backdrop layer inside its own useFrame. Never React state.
 * Every phase weight is 0..1 and eased with smoothstep, so nothing snaps.
 *
 * Scroll positions are in viewport heights (vh). `end` = document height − viewport, in vh.
 * v3 keyframes (V3-BUILD-PLAN WP1 B): the top-anchored phases start earlier and soften, so the
 * Launchpad and its Ask bar (≈ 1.1–2.4 vh) are never read through a whiteout.
 *
 *   vh 0 – 0.85       SPACE     space = 1, stars = 1, wordmarkHero = 1 (gone by HERO_EXIT_VH)
 *   vh 0.85 – 2.1     DESCENT   palette space → descent → day, stars fade by 1.7, clouds rise,
 *                               whiteout bell peaks at 1.3 (max 0.6)
 *   vh 2.1 – end−2.5  DAY       day = 1
 *   end−2.5 – end−1.2 DUSK      dusk bell, stars return
 *   end−1.2 – end     NIGHT     night = 1, ground rises, wordmarkFooter descends into place
 *
 * Sub-pages have no journey: SkyScene calls `setStaticJourney('night' | 'space')` once and never
 * `updateJourney`, so a short page is a steady sky (no cloud flash, no wordmark, no field).
 */
import { scrollState } from '../../lib/scroll'

export interface Journey {
  /** scroll position in viewport heights */
  vh: number
  /** document scroll range in viewport heights (≥ 4) */
  end: number
  /** 0..1 over the whole document */
  progress: number
  /** clock seconds (0 under reduced motion — layers read `time` for drift/twinkle) */
  time: number
  /** 1 in space (top of page), fades out 0.85 → 1.6 vh */
  space: number
  /** bell over the descent (0.85 → 2.3 vh) */
  descent: number
  /** the punch-through flash: bell peaking at 1.3 vh (0..0.6; layers scale it, sky uses × 0.35) */
  whiteout: number
  /** 1 in the day sky (2.1 vh → dusk) */
  day: number
  /** bell over the dusk window */
  dusk: number
  /** 1 at night (from ~end − 1.0 vh) */
  night: number
  /** 0 → 1 as the hills rise into the last 1.5 vh */
  ground: number
  /** star visibility: 1 in space, 0 in the day, 1 again from dusk */
  stars: number
  /** cloud visibility: 0 in space, 1 in the day, thinner at night */
  clouds: number
  /** hero wordmark presence: 1 at the top, 0 once it has drifted out (`HERO_EXIT_VH`) */
  wordmarkHero: number
  /** footer wordmark presence: 0 → 1 over the last 1.4 vh */
  wordmarkFooter: number
}

export const journey: Journey = {
  vh: 0,
  end: 4,
  progress: 0,
  time: 0,
  space: 1,
  descent: 0,
  whiteout: 0,
  day: 0,
  dusk: 0,
  night: 0,
  ground: 0,
  stars: 1,
  clouds: 0,
  wordmarkHero: 1,
  wordmarkFooter: 0,
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Palette stops (sRGB hex). `blendPalette` mixes them by the journey phase. */
export const PALETTE = {
  space: { top: '#03040c', mid: '#050818', bottom: '#070c24' },
  /** v3: bottom #1a7be0 → #1670c8 (≈ 5 : 1 for white copy, like the day foot); the Launchpad is read through the descent now */
  descent: { top: '#071a4a', mid: '#0b3f9a', bottom: '#1670c8' },
  /**
   * Day sky. Deliberately deeper than the --color-sky-* CSS tokens (DESIGN-SPEC §1): sampled
   * against the reference the dome stays a deep navy-blue the whole way down (#05285d → #003879
   * → #005090 → #045387), while the raw token bottom (#2ea3ff) turned the lower third cartoon
   * cyan and broke the ≥ 4.5:1 white-text rule there (JOURNEY-SPEC Readability). `bottom` is the
   * reference foot plus only a ~5 % lift toward the token so the horizon still breathes.
   */
  day: { top: '#082a64', mid: '#0a48a6', bottom: '#1875d0' },
  dusk: { top: '#0d2a66', mid: '#164a9c', bottom: '#5d5f9c', glow: '#b7707a' },
  night: { top: '#061a3d', mid: '#08234d', bottom: '#0b2c5c' },
} as const

export type PaletteKey = 'top' | 'mid' | 'bottom'

interface RGB {
  r: number
  g: number
  b: number
}

const hexToRgb = (hex: string): RGB => {
  const v = parseInt(hex.slice(1), 16)
  return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 }
}

const STOPS = {
  space: { top: hexToRgb(PALETTE.space.top), mid: hexToRgb(PALETTE.space.mid), bottom: hexToRgb(PALETTE.space.bottom) },
  descent: { top: hexToRgb(PALETTE.descent.top), mid: hexToRgb(PALETTE.descent.mid), bottom: hexToRgb(PALETTE.descent.bottom) },
  day: { top: hexToRgb(PALETTE.day.top), mid: hexToRgb(PALETTE.day.mid), bottom: hexToRgb(PALETTE.day.bottom) },
  dusk: { top: hexToRgb(PALETTE.dusk.top), mid: hexToRgb(PALETTE.dusk.mid), bottom: hexToRgb(PALETTE.dusk.bottom) },
  night: { top: hexToRgb(PALETTE.night.top), mid: hexToRgb(PALETTE.night.mid), bottom: hexToRgb(PALETTE.night.bottom) },
}

/** sequential palette lerps: space →(t0) descent →(t1) day →(t2) dusk →(t3) night */
const pal = { t0: 0, t1: 0, t2: 0, t3: 0 }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Writes the blended sky colour for `key` into `out` (a THREE.Color or any {r,g,b}) as raw
 * sRGB 0..1 floats — no colour management is applied, so pass the result to a shader that
 * linearises itself (see skyShaders.ts). No allocation.
 */
export function blendPalette<T extends RGB>(key: PaletteKey, out: T): T {
  const s = STOPS.space[key]
  const d = STOPS.descent[key]
  const y = STOPS.day[key]
  const k = STOPS.dusk[key]
  const n = STOPS.night[key]
  let r = lerp(s.r, d.r, pal.t0)
  let g = lerp(s.g, d.g, pal.t0)
  let b = lerp(s.b, d.b, pal.t0)
  r = lerp(r, y.r, pal.t1)
  g = lerp(g, y.g, pal.t1)
  b = lerp(b, y.b, pal.t1)
  r = lerp(r, k.r, pal.t2)
  g = lerp(g, k.g, pal.t2)
  b = lerp(b, k.b, pal.t2)
  out.r = lerp(r, n.r, pal.t3)
  out.g = lerp(g, n.g, pal.t3)
  out.b = lerp(b, n.b, pal.t3)
  return out
}

/** Scroll position (vh) at which the hero wordmark weight reaches 0: it has turned 360°, receded and left the frame. */
export const HERO_EXIT_VH = 1.4

/**
 * Peak of the descent whiteout bell. v3: the Launchpad (title, Ask bar, chips) is in the column for
 * the whole descent, so the flash is short (1.0 → 1.3 → 1.55 vh) and soft: the plan start value 0.8
 * with a 1.75 tail left white copy at ≈ 3.4 : 1 in the lower third at 1.5 vh; 0.6 keeps 1.2 / 1.5 /
 * 1.8 vh at ≥ 4.7 : 1 across the reading column.
 */
const WHITEOUT_PEAK = 0.6

/**
 * Hero wordmark presence at scroll `yVh`: 1 at the top of the page, 0 from `HERO_EXIT_VH` on.
 * Pure — the Header evaluates the same curve when the canvas loop is not running.
 */
export function heroWordmarkWeight(yVh: number): number {
  return 1 - smoothstep(0, HERO_EXIT_VH, yVh)
}

/**
 * Footer wordmark presence at scroll `yVh` for a page whose scroll range is `endVh` (document
 * height − viewport, in vh): 0 until end − 1.4, 1 from end − 0.3. Pure, like `heroWordmarkWeight`.
 */
export function footerWordmarkWeight(yVh: number, endVh: number): number {
  return smoothstep(endVh - 1.4, endVh - 0.3, yVh)
}

/**
 * Recomputes every phase weight from `scrollState` (px) for the given viewport height.
 * Call once per frame before any layer reads `journey`. Home only — sub-pages use `setStaticJourney`.
 */
export function updateJourney(viewportHeight: number, time: number): Journey {
  const vh = Math.max(1, viewportHeight)
  const y = scrollState.y / vh
  // Before Lenis reports a limit (first frames) assume a long page so the top reads as space.
  const end = Math.max(4, scrollState.limit / vh)
  const duskStart = end - 2.5
  const duskEnd = end - 1.2

  journey.vh = y
  journey.end = end
  journey.progress = Math.min(1, Math.max(0, y / end))
  journey.time = time

  journey.space = 1 - smoothstep(0.85, 1.6, y)
  journey.descent = smoothstep(0.85, 1.3, y) * (1 - smoothstep(1.8, 2.3, y))
  journey.whiteout = WHITEOUT_PEAK * smoothstep(1.0, 1.3, y) * (1 - smoothstep(1.3, 1.55, y))
  journey.day = smoothstep(1.55, 2.1, y) * (1 - smoothstep(duskStart, duskStart + 0.9, y))
  journey.dusk = smoothstep(duskStart, duskStart + 0.7, y) * (1 - smoothstep(duskEnd - 0.3, duskEnd + 0.5, y))
  journey.night = smoothstep(duskEnd - 0.5, end - 0.4, y)
  journey.ground = smoothstep(end - 1.5, end - 0.05, y)
  journey.stars = Math.min(1, 1 - smoothstep(1.15, 1.7, y) + smoothstep(duskStart + 0.3, duskEnd + 0.2, y))
  journey.clouds = smoothstep(0.85, 1.5, y) * (1 - 0.6 * journey.night)
  journey.wordmarkHero = heroWordmarkWeight(y)
  journey.wordmarkFooter = footerWordmarkWeight(y, end)

  pal.t0 = smoothstep(0.85, 1.4, y)
  pal.t1 = smoothstep(1.4, 2.05, y)
  pal.t2 = smoothstep(duskStart, duskStart + 0.9, y)
  pal.t3 = smoothstep(duskEnd - 0.4, duskEnd + 0.5, y)
  return journey
}

/** Constant scroll range of a static sky (vh). Any value ≥ the stars' 2.2 vh tilt cap gives the night framing of the home footer. */
const STATIC_END = 4

/**
 * Freezes the journey on one preset for a page without a scroll story (V3-BUILD-PLAN WP1 C):
 *   - `night` (/members, /handbook): night 1, stars 1, clouds 0.3 (only the far layer's faint edge
 *     shapes survive the night fade), ground 0, both wordmark weights 0, palette fully at night;
 *   - `space` (404): the top of the home journey — space 1, stars 1, no clouds.
 * `vh` / `end` are constants, so the cloud conveyor and the star tilt never move with the page's
 * own (short) scroll. `time` keeps being written by the caller for twinkle and drift.
 */
export function setStaticJourney(preset: 'night' | 'space'): void {
  const night = preset === 'night'
  journey.vh = night ? STATIC_END : 0
  journey.end = STATIC_END
  journey.progress = night ? 1 : 0
  journey.space = night ? 0 : 1
  journey.descent = 0
  journey.whiteout = 0
  journey.day = 0
  journey.dusk = 0
  journey.night = night ? 1 : 0
  journey.ground = 0
  journey.stars = 1
  journey.clouds = night ? 0.3 : 0
  journey.wordmarkHero = 0
  journey.wordmarkFooter = 0
  const t = night ? 1 : 0
  pal.t0 = t
  pal.t1 = t
  pal.t2 = t
  pal.t3 = t
}
