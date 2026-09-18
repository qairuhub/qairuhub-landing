/**
 * GLSL for the SkyDome: one clip-space triangle whose fragment blends the journey gradient
 * with the space nebula, the atmosphere limb, the descent whiteout, dusk warmth, the golden-hour
 * afterglow and (sub-pages only) the night moon glow. Colours are mixed in sRGB (like the CSS
 * fallback), linearised, dithered and
 * end with three's `colorspace_fragment` so the same shader is right on screen and inside the
 * glass wordmark's transmission FBO.
 *
 * ## The afterglow branch
 *
 * The sun dropped behind the ridge a minute ago (docs/GOLDEN-HOUR-BRIEF.md). Everything in the
 * branch is anchored on ONE line — `uHorizon`, the hot line — and is deliberately ASYMMETRIC about
 * it: the light spreads up into the air and stops fast below, because below that line is the far
 * valley floor seen through a lot of atmosphere, and land at this hour is shadow. That asymmetry
 * is what lets a footer sit UNDER the glow instead of in it.
 *
 * `uHorizon` is not a constant and is not tuned per viewport: SkyDome derives it from the field's
 * own geometry (`skylineScreenY`) and from the height of the copy that has to stay out of it
 * (`copyBox`). See SkyDome.tsx.
 *
 * What the branch draws, from the top down:
 *
 *   - the halo and the core. ONE exp() gives both: the narrow gold core is the wide coral halo
 *     cubed (three multiplies; a second exp is not). `BAND.up` / `BAND.down` are the two falloffs,
 *     and they are exported, because Field.tsx has to fade the far terrain onto exactly the colour
 *     this produces at the skyline — the one number both sides must agree on.
 *   - the far cloud deck: two flattened bars of haze lying just above the line, each with a LIT
 *     bottom edge and a dark belly, because at this hour clouds are lit from underneath. Analytic
 *     (three sin for the wobble, one exp per bar) and confined to `hy < 0.01`, so it is only ever
 *     evaluated in the sliver of frame it can appear in. It is what fills the band between the
 *     bright sky and the land, which is otherwise the dullest part of the picture.
 *   - the sun: a small disc with a soft bloom, low, sitting in the notch of the ridge. It only
 *     exists once the field is up to give it somewhere to sit (`uGround`), otherwise a bright blob
 *     floats in mid-air on the way down. The bloom's falloff is tight enough (260) that it is
 *     ~2e-5 by the early-out below and cannot seam.
 *   - under the line: the sky is MULTIPLIED by LOW_TINT rather than mixed toward a dark stop. A mix
 *     greys out — it lands the whole band on one flat violet, which is exactly the dead zone this
 *     replaced. A multiply keeps the hue the sky has at that height, so the band still carries the
 *     gradient and reads as land in shadow. `hy > 0.19` takes the early-out, which is the SAME
 *     expression (`c * LOW_TINT`) that the full path computes there, so the two meet seamlessly —
 *     and that is ~30 % of the frame the reference iGPU never runs the rest of the branch over.
 *
 * The dome draws AFTER the opaque field (SkyDome.tsx) so early-Z kills the pixels the land covers;
 * together with the early-out that is what keeps the ending inside the brief's frame budget.
 *
 * The nebula haze + milky band (two 3-octave fbms per pixel) are NOT evaluated per frame:
 * SkyDome bakes `nebulaFragment` once into a quarter-resolution render target (re-baked only
 * on resize) and the dome samples it with one texture tap (`uNebula`). Measured on an Intel
 * UHD at 2137 x 1350 the per-pixel version cost ~ 10 ms/frame in the space phase.
 *
 * Uniforms (all updated by SkyDome.tsx every frame from `journey`):
 *   uNebula                sampler2D  baked nebula (rgb = sRGB tint, a = opacity <= 0.32)
 *   uTop / uMid / uBottom  vec3  sRGB gradient stops (blendPalette)
 *   uMidStop               float position of the mid stop (0 top … 1 bottom)
 *   uAspect                float viewport width / height
 *   uTime                  float seconds (0 under reduced motion)
 *   uSpace uWhiteout uDusk uNight uSunset  float phase weights 0..1
 *   uGround                float 0..1 — how far the field has risen (gates the sun and its bloom)
 *   uHorizon               float screen y of the hot line, derived per viewport (SkyDome.tsx)
 *   uAzScale               float 1 / (half-span of the warmth)^2 - the azimuth falloff needs no divide
 *   uDuskGlow              vec3  sRGB PALETTE.dusk.glow
 *   uWarmGlow              vec3  sRGB coral — the wide halo above the skyline
 *   uSunGlow               vec3  sRGB gold — the narrow core, the disc and the lit cloud edges
 *
 * `uNight` (moon) and `uSunset` (afterglow) are mutually exclusive — home always sets the second
 * whenever `night` is non-zero, a sub-page only ever sets the first — so each page runs exactly
 * one of the two branches, and the moon branch is uniform-controlled dead code on home.
 */

import { copyTopFraction } from './copyBox'
import { skylineScreenY } from './field/terrain'

/** Position of the mid gradient stop (0 top … 1 bottom) — matches the old CSS fallback (55 %). */
export const MID_STOP = 0.55

/**
 * The two colours of the light from the sun that has just gone down. The wide halo above the
 * skyline is coral; the narrow core, the disc and the lit cloud edges are gold. Two hues rather
 * than one: a single orange made the whole horizon a flat tangerine wash, and it is the
 * coral → gold step that reads as a real sunset.
 */
export const WARM_GLOW = '#e8734a'
export const SUN_GLOW = '#ffc172'

/** How far above the visible skyline the hot line sits (frame fractions) — the craft note's
 *  "strongest saturation just above the skyline". */
const GLOW_ABOVE_RIDGE = 0.03
/** How far above the top of the footer copy the hot line must stay, at the very least. */
const COPY_CLEARANCE = 0.1
/** Hard bounds: never into the zenith, never below the middle of the frame. */
const HORIZON_MIN = 0.3
const HORIZON_MAX = 0.62

/**
 * Where the afterglow's hot line goes, in screen y (0 top, 1 bottom). Two measured terms, no
 * per-viewport constant:
 *
 *   1. the field's own visible skyline (`skylineScreenY`, derived from FIELD.riseTo, the 40° fov
 *      and `hillProfile`), minus a small lift so the strongest saturation sits just ABOVE the
 *      ridge rather than on it;
 *   2. the top of the footer's content block (`copyBox`, published by Footer.tsx through a
 *      ResizeObserver), minus a clearance.
 *
 * The first wins on a laptop, where the ridges are in frame and the footer is one row tall. The
 * second wins on a phone, where the ridges have left the sides — the visible skyline falls to
 * 0.71 — and the footer is four rows tall and reaches to 0.60. Neither is guessed, so a tablet, an
 * ultrawide, a fourth footer row or a longer Kazakh string all land somewhere measured.
 *
 * ~2k `hillHeight` evaluations: callers cache it per (aspect, viewport, copy height).
 */
export function horizonFor(aspect: number, viewportHeight: number): number {
  const byLand = skylineScreenY(aspect) - GLOW_ABOVE_RIDGE
  const byCopy = copyTopFraction(viewportHeight) - COPY_CLEARANCE
  return Math.min(HORIZON_MAX, Math.max(HORIZON_MIN, Math.min(byLand, byCopy)))
}

/**
 * At the sunset the gradient's mid stop is pinned just above the hot band, so the magenta-violet →
 * coral step always happens AT the band instead of at a fixed 55 % of a frame whose band has moved.
 */
export function midStopFor(horizon: number, sunset: number): number {
  return MID_STOP + (Math.min(MID_STOP, horizon - 0.01) - MID_STOP) * sunset
}

/**
 * The afterglow band, in ONE place. These numbers are interpolated into the GLSL below AND read by
 * Field.tsx, which has to land the far terrain's distance fade on the colour this band produces at
 * the skyline. lastlight's review called out the duplicated constant that used to live in Field.tsx
 * as a silent-desync hazard; this is the fix.
 */
export const BAND = {
  /**
 * Darkening multiplied into the sky deep below the hot line — mirrors LOW_COOL in the GLSL. The
 * first pass took it to 0.17/0.15/0.30, which read as a black blob under the sun rather than as
 * land in shadow; the copy's contrast is carried by the band geometry and the footer scrim, not by
 * crushing this strip.
 */
  lowTint: [0.54, 0.48, 0.6],
  /** the band under the line reaches that tint over this many frame fractions */
  shadeSpan: 0.2,
  /** the sun's azimuth as a fraction of the frame width — just right of the valley notch */
  sunX: 0.57,
  /**
   * Falloff of the halo above the hot line and (much steeper) below it, as the 1/r2 of a COMPACT
   * cubic rather than the rate of an exponential - see `falloff` in the GLSL. Zero at exactly
   * `reach` above the line and 0.105 below it.
   *
   * The halo is deliberately SHORT. It used to reach 0.43 of a frame up, which meant the branch ran
   * over most of the sky to add a few percent of coral to each pixel — the single most expensive
   * thing in the ending. The hue ladder above the band is carried by the gradient instead: the mid
   * stop is pinned just above the hot line (`midStopFor`) and PALETTE.afterglow.mid is a warm rose,
   * so cobalt -> violet -> rose is the dome's own two-stop mix, which every phase pays for anyway.
   * The shader only paints the last stretch into coral and gold, where a gradient cannot go.
   */
  upR2: 12.8,
  downR2: 90,
  /** how far above the hot line anything is drawn at all: the halo's own support */
  reach: 0.28,
  /** how far across the frame the warmth reaches, in frame widths */
  azSpan: 1.15,
  /** halo strength: base + this much more on the sun's own azimuth */
  warmMix: 0.4,
  warmAz: 0.32,
  /** gold core strength (the halo cubed) */
  hotMix: 0.2,
  hotAz: 0.46,
  /** the disc's radius in viewport-height units — small and low, per the brief */
  sunR: 0.016,
  /** how much of the band is already up before the field arrives */
  riseBase: 0.42,
} as const

/**
 * The halo / core strength at a height, evaluated on the CPU from the same constants the GLSL uses.
 * `hy` is the signed distance below the hot line (negative = above it) and `rise` the band's own
 * ramp. Field.tsx feeds the result through the same two mixes, and the same LOW_TINT, that the
 * shader does — so the far terrain lands on the sky it actually meets.
 */
export function bandMix(hy: number, rise: number): { warm: number; hot: number } {
  const up = Math.min(hy, 0)
  const dn = Math.max(hy, 0)
  const warm = falloff(up * up, BAND.upR2) * falloff(dn * dn, BAND.downR2) * rise
  return { warm, hot: warm * warm * warm }
}

/** The GLSL `falloff`, on the CPU. */
function falloff(x2: number, invR2: number): number {
  const q = Math.max(0, 1 - x2 * invR2)
  return q * q * q
}

/** Clip-space fullscreen triangle; z just inside the far plane (depth test is off anyway). */
export const domeVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}
`

/** Shared GLSL: hash + value noise + 3-octave fbm (the nebula bake). */
const NOISE_GLSL = /* glsl */ `
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);
float fbm3(vec2 p) {
  float v = 0.5 * vnoise(p);
  p = ROT * p * 2.02 + vec2(3.1, 1.7);
  v += 0.25 * vnoise(p);
  p = ROT * p * 2.02 + vec2(3.1, 1.7);
  v += 0.125 * vnoise(p);
  return v / 0.875;
}
`

/**
 * Baked once (quarter resolution) by SkyDome: rgb = normalised sRGB nebula tint,
 * a = opacity (<= 0.22 haze + <= 0.10 milky band). Static: the old 0.008 u/s drift was
 * imperceptible and not worth a per-frame fbm.
 */
export const nebulaFragment = /* glsl */ `
uniform float uAspect;
varying vec2 vUv;

const vec3 NEBULA_VIOLET = vec3(0.165, 0.114, 0.369); // #2a1d5e
const vec3 NEBULA_BLUE   = vec3(0.106, 0.227, 0.541); // #1b3a8a
const vec3 MILK          = vec3(0.62, 0.66, 0.86);
${NOISE_GLSL}
void main() {
  float y = 1.0 - vUv.y;
  vec2 p = vec2(vUv.x * uAspect, y);
  vec2 q = p * 1.35;
  float n1 = fbm3(q);
  float n2 = fbm3(q * 1.7 + vec2(7.3, 2.9));
  float violet = smoothstep(0.42, 0.78, n1);
  float blue = smoothstep(0.45, 0.8, n2);
  // normalised tint (violet where n1 peaks, blue where n2 peaks); opacity capped at 0.22
  vec3 neb = (NEBULA_VIOLET * violet + NEBULA_BLUE * blue * 0.85) / max(0.001, violet + blue * 0.85);
  float nebA = min(0.22, max(violet, blue) * 0.22);
  // diagonal milky band (the galaxy's soft belt), fading with y so the limb stays clean
  float band = (p.x * 0.42 - p.y * 0.55 + 0.30);
  float milk = exp(-band * band * 14.0) * (0.55 + 0.45 * n1) * (1.0 - smoothstep(0.55, 0.9, y));
  neb = mix(neb, MILK, milk * 0.5);
  nebA += milk * 0.10;
  // straight (non-premultiplied) tint + alpha; the dome does mix(c, rgb, a)
  gl_FragColor = vec4(neb, nebA);
}
`

export const domeFragment = /* glsl */ `
uniform sampler2D uNebula;
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uBottom;
uniform float uMidStop;
uniform float uAspect;
uniform float uTime;
uniform float uSpace;
uniform float uWhiteout;
uniform float uDusk;
uniform float uNight;
uniform float uSunset;
uniform float uGround;
uniform float uHorizon;
uniform float uAzScale;
uniform vec3 uDuskGlow;
uniform vec3 uWarmGlow;
uniform vec3 uSunGlow;
varying vec2 vUv;

const vec3 LIMB          = vec3(0.169, 0.388, 0.910); // #2b63e8
const vec3 PLANET        = vec3(0.012, 0.020, 0.070);
const vec3 WHITEOUT      = vec3(0.933, 0.957, 1.0);   // #eef4ff
const vec3 MOON          = vec3(0.812, 0.878, 1.0);   // #cfe0ff
const vec3 NIGHT_HORIZON = vec3(0.16, 0.31, 0.56);
// Multiplied (never mixed) into the sky below the hot line and into the clouds' bellies: they
// darken without greying, so the band under the sunset keeps the hue it had. The tint TRAVELS with
// depth — dusty warm right under the band, cool blue-violet further down — which is what turns the
// widest flat area of the frame into a gradient of hue instead of one plum. See the module doc.
const vec3 LOW_WARM      = vec3(0.80, 0.62, 0.53);
const vec3 LOW_COOL      = vec3(0.54, 0.48, 0.60);

// polynomial sRGB -> linear (max error < 0.5/255): three pow() per pixel cost ~1.5 ms on an iGPU
vec3 srgbToLinear(vec3 c) {
  return c * (c * (c * 0.305306011 + 0.682171111) + 0.012522878);
}
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// Compact-support stand-in for exp(-x2 * k), with invR2 = 0.3 * k: a cubic that tracks the
// Gaussian to within a few percent and reaches exactly zero at x2 = 1 / invR2. Three multiplies
// and a max against a transcendental - and, because it really is zero outside its support, the
// afterglow can bound its branches instead of trailing off across the whole frame. Every glow in
// that branch is built from this, and it is what took the ending inside the frame budget.
float falloff(float x2, float invR2) {
  float q = max(0.0, 1.0 - x2 * invR2);
  return q * q * q;
}

void main() {
  // y: 0 at the top of the screen, 1 at the bottom (matches the CSS gradient stops).
  float y = 1.0 - vUv.y;
  // aspect-corrected screen coords in viewport-height units, y down.
  vec2 p = vec2(vUv.x * uAspect, y);

  vec3 c = y < uMidStop
    ? mix(uTop, uMid, y / uMidStop)
    : mix(uMid, uBottom, (y - uMidStop) / (1.0 - uMidStop));

  // ---- SPACE: baked nebula haze (one tap) + analytic atmosphere limb (skipped once descended)
  if (uSpace > 0.002) {
    vec4 neb = texture2D(uNebula, vUv);
    c = mix(c, neb.rgb, neb.a * uSpace);

    // planet horizon: arc peaking at y = 0.90 mid-screen, curving down at the edges.
    // The limb belongs to the hero, not the viewport: as the descent begins it slides below the
    // frame (0.5 vh over uSpace 1 -> 0.9, i.e. the first ~0.16 vh of scroll past 0.9 vh, eased at
    // both ends) so by 1 vh the agentic card row sits on clean space rather than on the band.
    // (uSpace itself is still ~0.96 at 1 vh, so a plain 1 - uSpace would not move it in time.)
    const float R = 2.6;
    float sinkT = smoothstep(1.0, 0.9, uSpace);
    vec2 centre = vec2(uAspect * 0.5, 0.90 + sinkT * 0.5 + R);
    float d = length(p - centre) - R; // < 0 inside the planet
    float inside = smoothstep(0.012, -0.03, d);
    // soft haze rising into space (~12 % of the viewport), thinning further as the arc sinks
    float glowOut = exp(-max(d, 0.0) * 12.0);
    // razor-thin rim hugging the edge (|d| - an unmasked inside term is 1.0 over the whole sky)
    float glowIn = exp(-abs(d) * 26.0);
    float limb = glowOut * (0.5 - 0.2 * sinkT) + glowIn * 0.9;
    vec3 space = mix(c, PLANET, inside);
    space += LIMB * limb * (1.0 - inside * 0.55);
    c = mix(c, space, uSpace);
  }

  // ---- DUSK: the approach into the golden hour. The warmth reaches higher than the old dusk's
  // bottom third (it starts at 0.38 now) but the cube keeps the very foot where it was, because
  // the Join section's 12px fine print is read against exactly that colour on a phone.
  if (uDusk > 0.002) {
    float low = smoothstep(0.38, 0.98, y);
    c = mix(c, uDuskGlow, low * low * low * 0.40 * uDusk);
  }

  // ---- AFTERGLOW: the golden hour just after sundown. Reasoning lives in the module doc above —
  // GLSL comments ship to every visitor verbatim, JSDoc is stripped by the minifier.
  if (uSunset > 0.002) {
    float hy = y - uHorizon;
    if (hy > 0.19) {
      c = mix(c, c * LOW_COOL, uSunset);
    } else if (hy > ${(-BAND.reach).toFixed(2)}) {
      float dn = max(hy, 0.0);
      vec2 d = p - vec2(uAspect * ${BAND.sunX}, uHorizon);
      float az = falloff(d.x * d.x, uAzScale);
      float rise = ${BAND.riseBase} + ${(1 - BAND.riseBase).toFixed(2)} * uGround;
      // Two falloffs rather than a select on the radius: they are independent, so the compiler
      // pipelines them, and the select measured slower on the reference iGPU.
      float up = min(hy, 0.0);
      float warm = falloff(up * up, ${BAND.upR2.toFixed(1)}) * falloff(dn * dn, ${BAND.downR2.toFixed(1)}) * rise;
      float hot = warm * warm * warm;
      vec3 g = mix(c, uWarmGlow, warm * (${BAND.warmMix} + ${BAND.warmAz} * az));
      g = mix(g, uSunGlow, hot * (${BAND.hotMix} + ${BAND.hotAz} * az));

      // Everything below is confined to the strip of frame it can actually appear in.
      if (hy > -0.2) {
        // far cloud deck - three bars lying across the skyline, lit along their bottom edge.
        // One clamp per bar, not two smoothsteps: lit + belly is exactly the bar, so splitting it
        // with a single signed ramp gives both sides for the price of one.
        if (hy < 0.13) {
          float bx = p.x * 2.6;
          float t1 = (hy + 0.078 + sin(bx + 0.9) * 0.010 + sin(bx * 2.27) * 0.004) * 40.0;
          float t2 = (hy + 0.034 + sin(bx * 1.37 + 2.4) * 0.007) * 72.0;
          float t3 = (hy - 0.043 + sin(bx * 0.83 - 1.1) * 0.011) * 40.0;
          float e1 = falloff(t1 * t1, 0.3);
          float e2 = falloff(t2 * t2, 0.3);
          float e3 = falloff(t3 * t3, 0.3);
          float s1 = clamp(t1 * 0.8 + 0.2, 0.0, 1.0);
          float s2 = clamp(t2 * 0.8 + 0.2, 0.0, 1.0);
          float s3 = clamp(t3 * 0.8 + 0.2, 0.0, 1.0);
          float lit = e1 * s1 * 0.8 + e2 * s2 + e3 * s3 * 0.95;
          float belly = e1 * (1.0 - s1) + e2 * (1.0 - s2) * 0.7 + e3 * (1.0 - s3);
          g = mix(g, uSunGlow, lit * (0.10 + 0.40 * az) * rise);
          g *= mix(vec3(1.0), LOW_COOL, belly * 0.36 * rise);
        }

        // the sun: small, low, soft - sitting in the notch between the ridges. Squared distance
        // throughout, so the disc and its bloom cost no square root.
        float sd2 = dot(d, d);
        float bloom = falloff(sd2, 51.0) * uGround;
        float disc = smoothstep(${(BAND.sunR * BAND.sunR).toFixed(6)}, ${(BAND.sunR * BAND.sunR * 0.2).toFixed(7)}, sd2) * uGround;
        g += uSunGlow * (bloom * 0.34 + disc * 0.50);

        // Under the line the frame is the far valley through a lot of air, not sky.
        if (hy > -0.02) {
          // Multiply, do not mix, and let the tint travel from dusty-warm to cool blue-violet
          // with depth: a mix lands the whole band on one flat dark violet, which is the dead
          // zone this replaced; a multiply keeps the hue the sky has at that height.
          float shade = smoothstep(0.0, ${BAND.shadeSpan}, dn);
          g *= mix(vec3(1.0), mix(LOW_WARM, LOW_COOL, smoothstep(0.015, 0.12, dn)), shade);
          // Two warm terms, and they are what the middle of the frame is made of: a wide soft
          // plume hanging under the sun's own column and a hard skim right along the line (the
          // last light grazing the far floor). Without them the notch between the ridges - the one
          // place the eye is drawn to, because the sun is in it - is 15 % of the picture with
          // nothing in it at all. The skim is the plume to the fourth power, two multiplies.
          float k = rise * smoothstep(-0.012, 0.028, hy);
          float pe = falloff(dn * dn, 39.0);
          float pe2 = pe * pe;
          g += uWarmGlow * (pe2 * pe2 * (0.05 + 0.15 * az) * k);
          g += uWarmGlow * (pe * az * az * 0.17 * k);
        }
      }

      c = mix(c, g, uSunset);
    }
  }

  // ---- NIGHT (sub-pages only): moon glow upper-right + a slightly brighter horizon band
  if (uNight > 0.002 && uSunset < 0.002) {
    vec2 moon = vec2(uAspect * 0.74, 0.20);
    float md = length(p - moon);
    float core = smoothstep(0.18, 0.0, md);
    float halo = exp(-md * md * 5.5);
    float glow = core * core * 0.9 + halo * 0.35;
    float horizon = smoothstep(0.55, 1.0, y) * 0.16;
    vec3 night = c + MOON * glow * 0.42 + NIGHT_HORIZON * horizon;
    c = mix(c, night, uNight);
  }

  // ---- WHITEOUT: punching through the cloud deck
  c = mix(c, WHITEOUT, uWhiteout * 0.35);

  vec3 lin = srgbToLinear(clamp(c, 0.0, 1.0));
  // Dither kills 8-bit banding on the long gradient.
  lin += (hash21(gl_FragCoord.xy + fract(uTime) * 7.0) - 0.5) * (1.5 / 255.0);
  gl_FragColor = vec4(max(lin, 0.0), 1.0);
  #include <colorspace_fragment>
}
`

/**
 * Stars: one <points>, screen-pixel sizes (no attenuation), twinkle in the vertex stage.
 * Attributes: position, aSize (px), aSeed (0..1), aBright (0..1), aWarm (0 | 1).
 * Uniforms: uTime, uDpr, uTwinkle (0|1), uAlpha (journey.stars), uNight, uSunset.
 *
 * At the golden-hour ending only the FIRST stars are out, high in the zenith: `uSunset` gates each
 * star by its own elevation on the dome, so the ones near the horizon wash out into the glow while
 * the top of the frame keeps a handful. No extra draw, no extra attribute — `position` already is
 * the dome direction.
 */
export const starsVertex = /* glsl */ `
attribute float aSize;
attribute float aSeed;
attribute float aBright;
attribute float aWarm;
uniform float uTime;
uniform float uDpr;
uniform float uTwinkle;
uniform float uSunset;
varying float vAlpha;
varying float vWarm;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = mix(1.0, 0.75 + 0.25 * sin(uTime * (1.3 + aSeed) + aSeed * 7.0), uTwinkle);
  vAlpha = aBright * tw;
  // Golden hour: keep only the FIRST stars, high up, and dim even those against the brighter sky.
  // The dome is tilted up ~19° by the end of the descent, so the top of the frame is local
  // elevation ≈ 0 and the middle is ≈ −0.34 — hence the window below, not one around the zenith.
  float elev = normalize(position).y;
  vAlpha *= mix(1.0, 0.85 * smoothstep(-0.38, -0.08, elev), uSunset);
  vWarm = aWarm;
  gl_PointSize = aSize * uDpr * (1.0 + aWarm * 1.4);
}
`

export const starsFragment = /* glsl */ `
uniform float uAlpha;
uniform float uNight;
uniform float uSunset;
varying float vAlpha;
varying float vWarm;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q) * 2.0;
  if (d > 1.0) discard;
  float disc = 1.0 - smoothstep(0.25, 0.95, d);
  float glow = pow(max(0.0, 1.0 - d), 2.4);
  float a = mix(disc, disc * 0.55 + glow * 0.9, vWarm);
  vec3 cool = vec3(0.86, 0.92, 1.0);
  vec3 warm = vec3(1.0, 0.90, 0.76);
  vec3 col = mix(cool, warm, clamp(vWarm * 0.85 + uNight * 0.18 + uSunset * 0.30, 0.0, 1.0));
  // additive: colour is premultiplied by the strength, alpha stays 1
  gl_FragColor = vec4(col * (a * vAlpha * uAlpha), 1.0);
  #include <colorspace_fragment>
}
`
