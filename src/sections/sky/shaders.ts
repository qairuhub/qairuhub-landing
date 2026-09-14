/**
 * GLSL for the cloud deck (the sky gradient lives in ./skyShaders.ts).
 *
 * - `cloudBakeVertex` / `cloudBakeFragment`: the cumulus *bake*. Runs ONCE per cloud texture into
 *   a render-target atlas (see ./cloudBake.ts), never per frame. The output is not a colour: it is a
 *   lighting/shape map — R = sunlight (1 = lit top, 0 = deep belly), G = fbm detail, B = silver-lining
 *   rim, A = coverage — that the sprite shader in ./CloudSprites.tsx turns into a colour with the
 *   journey's palette (day / dusk / night / whiteout) at draw time.
 * - `cloudSpriteVertex` / `cloudSpriteFragment`: the instanced billboard sprite shader (one draw
 *   call per depth layer).
 */

/* ------------------------------------------------------------------ Cumulus bake (once per texture) */

/** Clip-space triangle covering the current atlas cell (viewport/scissor pick the cell). */
export const cloudBakeVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

/**
 * One isolated cumulus per cell, fully transparent at the cell borders.
 *
 * Shape = a cluster of gaussian lobes (squashed below their centres → round tops, flat base),
 * evaluated in a domain-warped space, plus fbm detail on the silhouette (cauliflower edges),
 * multiplied by a flat fuzzy base and an elliptical envelope that takes the *density* to zero well
 * inside the cell — so the silhouette is always the cloud's own curve, never the cell border. A
 * wide, gentle border mask on the alpha remains only as a safety net.
 * Light = a short march towards the sun (up, slightly to one side): the more cloud sits above a
 * point, the deeper it sinks into shadow — white tops, blue-grey bellies once coloured.
 *
 * Output (linear values, no colour-space conversion — this is data, not colour):
 *   R light 0..1 · G detail 0..1 · B rim (thin lit edge) 0..1 · A coverage 0..1 (straight alpha)
 */
export const cloudBakeFragment = /* glsl */ `
uniform float uSeed;
uniform float uThreshold; // density threshold (higher = leaner cloud)
uniform float uSoftness;  // width of the edge ramp
uniform float uWarp;      // domain-warp strength (irregular silhouettes)
uniform float uDetail;    // fbm amplitude on the silhouette
uniform vec2 uSun;        // light-march step in cloud space (points towards the sun)
uniform float uShadow;    // light-march extinction
varying vec2 vUv;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 hash31(float p) {
  vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
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
float fbm2(vec2 p) {
  return 0.5 * vnoise(p) + 0.25 * vnoise(ROT * p * 2.02 + vec2(3.1, 1.7));
}
float fbm4(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = ROT * p * 2.02 + vec2(3.1, 1.7);
    a *= 0.5;
  }
  return v;
}

// Cluster of squashed gaussian lobes over a flat base: the cumulus mass. \`s\` is isotropic
// cloud space: x -2..2 across the (2:1) cell, y -1..1, sun up.
float body(vec2 s) {
  float acc = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec3 h = hash31(fi * 3.17 + uSeed);
    float cx = (fi / 3.0 - 1.0) * 1.0 + (h.x - 0.5) * 0.45;   // spread across the cell, jittered
    float env = 1.0 - pow(min(1.0, abs(cx) / 1.4), 2.0);       // tallest towers in the middle
    float cy = -0.22 + env * (0.18 + 0.42 * h.z);
    float r = 0.36 + 0.3 * h.y;
    vec2 d = s - vec2(cx, cy);
    d.y *= d.y < 0.0 ? 1.7 : 1.0;                               // flat bases, round tops
    acc += exp(-dot(d, d) / (r * r) * 1.8);
  }
  // a low, wide slab under the towers: the lower-middle of the mass is never hollow, so a seed
  // whose lobes happen to straddle the centre bakes as one cumulus, not an arch / crescent
  acc += 0.85 * exp(-pow((s.y + 0.25) / 0.34, 2.0)) * (1.0 - smoothstep(0.7, 1.35, abs(s.x)));
  // fuzzy flat base
  return acc * smoothstep(-0.9, -0.42, s.y);
}
// Small lobes on a jittered grid (3x3 neighbourhood): the cauliflower puffs riding on the mass.
float puffs(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float s = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 h = hash22(i + g + uSeed);
      vec2 c = g + 0.15 + 0.7 * h;
      float r = 0.4 + 0.3 * h.x;
      vec2 dd = f - c;
      dd.y *= dd.y < 0.0 ? 1.5 : 1.0;
      s += exp(-dot(dd, dd) / (r * r) * 2.5);
    }
  }
  return min(1.0, s * 0.6);
}
// Elliptical envelope on the *density* (not the alpha): the mass itself thins to nothing well
// inside the cell, so the silhouette is always the cloud's own curve — lobes plus cauliflower
// detail — and never the cell border. \`s\` is unwarped cloud space (x -2..2, y -1..1), so the
// ellipse touches the cell edges at radius 1 and the ramp ends at 0.92 + the warp nudge (±0.06),
// i.e. still inside the cell. The nudge keeps the envelope's own contour irregular where it
// dominates instead of reading as a clean oval.
float envelope(vec2 s, vec2 warp) {
  float rr = length(s * vec2(0.5, 1.0)) + (warp.x + warp.y) * 0.06;
  return 1.0 - smoothstep(0.45, 0.92, rr);
}
// density with the puff and fine-detail terms (used for the silhouette and the light march)
float density(vec2 q, vec2 so, float detail, float puff) {
  float b = body(q);
  return b * (0.72 + 0.55 * puff) + (detail - 0.5) * uDetail;
}

void main() {
  vec2 s = (vUv - 0.5) * vec2(4.0, 2.0);
  vec2 so = vec2(uSeed * 1.7, uSeed * 0.31);
  vec2 warp = vec2(fbm2(s * 1.6 + so), fbm2(s * 1.6 + so + vec2(5.2, 1.3))) - 0.5;
  vec2 q = s + warp * uWarp;

  float puff = puffs(q * 2.3 + so);
  float detC = fbm4(q * 3.2 + so);
  float detF = fbm4(q * 7.5 + so + vec2(11.0, 7.0));
  float det = 0.6 * detC + 0.4 * detF;
  float d = density(q, so, det, puff) * envelope(s, warp);

  // Border mask: a wide, gentle safety net only — the envelope above already takes the density to
  // zero inside the cell, so this ramp never shapes a visible edge; it just guarantees transparent
  // cell borders whatever the seed does.
  float mask = smoothstep(2.0, 1.2, abs(s.x)) * smoothstep(1.0, 0.55, abs(s.y));
  float alpha = smoothstep(uThreshold, uThreshold + uSoftness, d) * mask;
  alpha = pow(alpha, 1.1);

  // Light march towards the sun: cloud above a point shades it. The same envelope applies to the
  // marched samples so shading comes from the mass that is actually drawn, not phantom mass
  // beyond the silhouette (which would darken the tops of tall clouds).
  float sh = 0.0;
  for (int k = 1; k <= 6; k++) {
    vec2 o = uSun * float(k);
    vec2 qk = q + o;
    float dk = density(qk, so, fbm2(qk * 3.2 + so), puffs(qk * 2.3 + so)) * envelope(s + o, warp);
    sh += max(0.0, dk - uThreshold);
  }
  float light = exp(-sh * uShadow);
  // ambient: bellies sit a little deeper in shadow than the march alone gives
  light *= mix(0.78, 1.0, smoothstep(-0.7, 0.55, q.y));
  // surface texture: puff tops catch the light, fine wisps break it up
  light *= (0.86 + 0.14 * puff) * (0.92 + 0.08 * detF);
  // silver lining: thin, lit edges
  float rim = smoothstep(0.0, 0.45, alpha) * (1.0 - smoothstep(0.45, 1.0, alpha)) * light;

  gl_FragColor = vec4(min(light, 1.0), det, rim, alpha);
}
`

/* ------------------------------------------------------------------ Cloud sprites (instanced billboards) */

/**
 * Camera-facing quads: the instance centre is transformed to view space and the unit plane is
 * expanded there, so sprites always face the camera whatever it does. Per-instance data lives in
 * instanced attributes (see CloudSprites.tsx); per-layer motion (scroll/mouse/descent) in uniforms.
 */
export const cloudSpriteVertex = /* glsl */ `
attribute vec3 aPos;   // world position (before the layer offset)
attribute vec2 aSize;  // width / height in world units
attribute vec4 aCell;  // atlas uv rect: u0 v0 du dv (du < 0 = mirrored)
attribute vec4 aTint;  // linear rgb tint + alpha
uniform vec3 uOffset;  // layer translation: descent rise + mouse parallax
uniform float uScale;  // whiteout scale-up
varying vec2 vUv;
varying vec4 vTint;
void main() {
  vUv = aCell.xy + uv * aCell.zw;
  vTint = aTint;
  vec4 c = modelViewMatrix * vec4(aPos + uOffset, 1.0);
  c.xy += position.xy * aSize * uScale;
  gl_Position = projectionMatrix * c;
}
`

/**
 * Colour = palette (lit / shade) driven by the baked light map, times the instance tint.
 * Output is premultiplied (blend ONE, ONE_MINUS_SRC_ALPHA) after the colour-space encode so soft
 * edges keep their tone on screen and inside the glass wordmark's transmission FBO.
 */
export const cloudSpriteFragment = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uLit;     // sunlit colour (linear)
uniform vec3 uShade;   // belly colour (linear)
uniform float uRim;    // silver-lining strength
uniform float uOpacity;
varying vec2 vUv;
varying vec4 vTint;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec4 t = texture2D(uMap, vUv);
  float a = t.a * vTint.a * uOpacity;
  if (a < 0.003) discard;
  vec3 col = mix(uShade, uLit, t.r) * (0.9 + 0.1 * t.g) * vTint.rgb;
  col += uRim * t.b;
  // dither the soft gradients (8-bit light map upscaled a lot)
  col += (hash21(gl_FragCoord.xy) - 0.5) * (1.5 / 255.0);
  gl_FragColor = vec4(max(col, 0.0), a);
  #include <colorspace_fragment>
  gl_FragColor.rgb *= gl_FragColor.a;
}
`
