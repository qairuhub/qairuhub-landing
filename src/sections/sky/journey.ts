/**
 * The scroll-driven journey (docs/JOURNEY-SPEC.md): space → descent → day sky → dusk → AFTERGLOW + field.
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
 *   end−2.5 – end−1.2 DUSK      dusk bell — the approach into the sunset, stars return briefly
 *   end−1.2 – end     AFTERGLOW night = 1 AND sunset = 1, ground rises, wordmarkFooter descends
 *
 * The journey used to end at night; it now ends in the golden hour just after sundown
 * (docs/GOLDEN-HOUR-BRIEF.md). `night` kept its name and its numbers because it still means "the
 * last, ground-level phase" for the clouds, the stars and the sub-pages' frozen sky; the new
 * `sunset` weight is what turns that phase golden, and it is 0 on a sub-page.
 *
 * Sub-pages have no journey: SkyScene calls `setStaticJourney('night' | 'space')` once and never
 * `updateJourney`, so a short page is a steady sky (no cloud flash, no wordmark, no field). Their
 * `night` preset stays a MOONLIT NIGHT — /members and /handbook are read top to bottom with copy
 * on the raw sky and no silhouette to hide a hot horizon behind, so only the home journey (whose
 * last screens are a field, not text) turns golden. `setStaticJourney` therefore leaves `sunset`
 * at 0 and points the palette's last lerp back at the night stop (see `endStop`).
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
  /** 1 in the last, ground-level phase (from ~end − 1.0 vh); also 1 on a sub-page's static sky */
  night: number
  /**
   * How far the golden hour has come up (home journey); 0 on a sub-page, whose frozen sky stays a
   * moonlit night. It leads `night` by about half a viewport — the warmth is in the sky before the
   * ground arrives — and it is what gates every warm term in the dome, the field and the clouds.
   */
  sunset: number
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
  sunset: 0,
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
  /**
   * The approach into the sunset (was the approach into night): the zenith stays the day's deep
   * navy, the mid warms a step and the foot goes violet, with a coral `glow` washed over the
   * bottom third. `bottom` is a step deeper than the v3 night approach's #5d5f9c: the Join
   * section's 12px .75-alpha note is read against exactly this colour at 390, and it measured
   * 3.99 : 1 there before.
   */
  dusk: { top: '#0d2a66', mid: '#1b4390', bottom: '#4d3d74', glow: '#c4735c' },
  /**
   * AFTERGLOW — the sun has just dropped behind the ridge (docs/GOLDEN-HOUR-BRIEF.md). A gradient
   * of HUE, not a wash: cobalt zenith → magenta-violet at the mid stop (which the dome pins just
   * above the hot band, so the step always lands AT the band) → and then down into a dusty plum.
   * The coral and the gold live in the dome shader's band instead (skyShaders.ts), which spreads
   * upward from the skyline and stops almost dead below it; that is what keeps the glow ABOVE the
   * footer copy on a phone, where the tall footer reaches up to the horizon.
   *
   * `bottom` is deliberately LIGHTER and more saturated than the band under the sunset actually
   * reads: the shader multiplies it by LOW_TINT there rather than mixing toward a dark stop, so
   * the value below has to survive being taken down to ≈ #311931. Mixing to an already-dark stop
   * is what made that band a flat, dead violet; multiplying a live colour keeps its hue.
   * White copy: ≈ 16 : 1 on `top`, ≈ 8 : 1 on `mid`, ≈ 13 : 1 on `bottom` once tinted.
   */
  afterglow: { top: '#05183f', mid: '#8a3a64', bottom: '#74495f' },
  /** The moonlit night kept for the sub-pages' static sky (`setStaticJourney('night')`). */
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
  afterglow: { top: hexToRgb(PALETTE.afterglow.top), mid: hexToRgb(PALETTE.afterglow.mid), bottom: hexToRgb(PALETTE.afterglow.bottom) },
  night: { top: hexToRgb(PALETTE.night.top), mid: hexToRgb(PALETTE.night.mid), bottom: hexToRgb(PALETTE.night.bottom) },
}

/** sequential palette lerps: space →(t0) descent →(t1) day →(t2) dusk →(t3) `endStop` */
const pal = { t0: 0, t1: 0, t2: 0, t3: 0 }

/**
 * Where the last lerp lands: the afterglow for the home journey, the night sky for a sub-page's
 * frozen preset. One swappable reference instead of a fifth weight, so `blendPalette` keeps its
 * four lerps and the sub-pages keep exactly the sky they have today.
 */
let endStop: (typeof STOPS)['afterglow'] = STOPS.afterglow

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
  const n = endStop[key]
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
  // The LIGHT arrives before the last phase does. `night` is the ground-level phase (the field, the
  // clouds, the stars); `sunset` is the warmth in the sky, and it has to be up while the dusk is
  // still handing over — on the same curve the two crossfades dipped through a flat violet frame
  // about 1 vh before the end, which is exactly where the Join form is read.
  journey.sunset = smoothstep(duskEnd - 1.0, end - 0.55, y)
  journey.ground = smoothstep(end - 1.5, end - 0.05, y)
  journey.stars = Math.min(1, 1 - smoothstep(1.15, 1.7, y) + smoothstep(duskStart + 0.3, duskEnd + 0.2, y))
  journey.clouds = smoothstep(0.85, 1.5, y) * (1 - 0.6 * journey.night)
  journey.wordmarkHero = heroWordmarkWeight(y)
  journey.wordmarkFooter = footerWordmarkWeight(y, end)

  pal.t0 = smoothstep(0.85, 1.4, y)
  pal.t1 = smoothstep(1.4, 2.05, y)
  pal.t2 = smoothstep(duskStart, duskStart + 0.9, y)
  pal.t3 = smoothstep(duskEnd - 0.4, duskEnd + 0.5, y)
  endStop = STOPS.afterglow
  return journey
}

/** Constant scroll range of a static sky (vh). Any value ≥ the stars' 2.2 vh tilt cap gives the night framing of the home footer. */
const STATIC_END = 4

/**
 * Freezes the journey on one preset for a page without a scroll story (V3-BUILD-PLAN WP1 C):
 *   - `night` (/members, /handbook): night 1, sunset 0, stars 1, clouds 0.3 (only the far layer's faint edge
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
  // A sub-page's frozen sky stays a moonlit night; only the home journey ends in the golden hour.
  journey.sunset = 0
  journey.ground = 0
  journey.stars = 1
  journey.clouds = night ? 0.3 : 0
  journey.wordmarkHero = 0
  journey.wordmarkFooter = 0
  endStop = STOPS.night
  const t = night ? 1 : 0
  pal.t0 = t
  pal.t1 = t
  pal.t2 = t
  pal.t3 = t
}
