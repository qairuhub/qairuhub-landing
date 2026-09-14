/**
 * GLSL for the SkyDome: one clip-space triangle whose fragment blends the journey gradient
 * with the space nebula, the atmosphere limb, the descent whiteout, dusk warmth and the
 * night moon glow. Colours are mixed in sRGB (like the CSS fallback), linearised, dithered and
 * end with three's `colorspace_fragment` so the same shader is right on screen and inside the
 * glass wordmark's transmission FBO.
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
 *   uSpace uWhiteout uDusk uNight  float phase weights 0..1
 *   uDuskGlow              vec3  sRGB PALETTE.dusk.glow
 */

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
uniform vec3 uDuskGlow;
varying vec2 vUv;

const vec3 LIMB          = vec3(0.169, 0.388, 0.910); // #2b63e8
const vec3 PLANET        = vec3(0.012, 0.020, 0.070);
const vec3 WHITEOUT      = vec3(0.933, 0.957, 1.0);   // #eef4ff
const vec3 MOON          = vec3(0.812, 0.878, 1.0);   // #cfe0ff
const vec3 NIGHT_HORIZON = vec3(0.16, 0.31, 0.56);

// polynomial sRGB -> linear (max error < 0.5/255): three pow() per pixel cost ~1.5 ms on an iGPU
vec3 srgbToLinear(vec3 c) {
  return c * (c * (c * 0.305306011 + 0.682171111) + 0.012522878);
}
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
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

  // ---- DUSK: warm horizon in the bottom third
  if (uDusk > 0.002) {
    float low = smoothstep(0.58, 1.0, y);
    c = mix(c, uDuskGlow, low * 0.42 * uDusk);
  }

  // ---- NIGHT: moon glow upper-right + a slightly brighter horizon band
  if (uNight > 0.002) {
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
 * Uniforms: uTime, uDpr, uTwinkle (0|1), uAlpha (journey.stars), uNight.
 */
export const starsVertex = /* glsl */ `
attribute float aSize;
attribute float aSeed;
attribute float aBright;
attribute float aWarm;
uniform float uTime;
uniform float uDpr;
uniform float uTwinkle;
varying float vAlpha;
varying float vWarm;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = mix(1.0, 0.75 + 0.25 * sin(uTime * (1.3 + aSeed) + aSeed * 7.0), uTwinkle);
  vAlpha = aBright * tw;
  vWarm = aWarm;
  gl_PointSize = aSize * uDpr * (1.0 + aWarm * 1.4);
}
`

export const starsFragment = /* glsl */ `
uniform float uAlpha;
uniform float uNight;
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
  vec3 col = mix(cool, warm, clamp(vWarm * 0.85 + uNight * 0.18, 0.0, 1.0));
  // additive: colour is premultiplied by the strength, alpha stays 1
  gl_FragColor = vec4(col * (a * vAlpha * uAlpha), 1.0);
  #include <colorspace_fragment>
}
`
