/**
 * GLSL for the field at the golden-hour ending.
 *
 * - `grassVertex` / `grassFragment`: the blade ShaderMaterial (wind in the vertex shader, a warm
 *   rim on the tips the low sun rakes, the valley haze, manual distance fade — the shared scene
 *   has no fog).
 * - `patchDistanceFade` / `patchSway`: `onBeforeCompile` hooks for the MeshStandardMaterials of the
 *   terrain and the flora so they stay lit by SceneLights but share the field's fade / wind.
 *
 * The wind field is the same expression everywhere (blades, flowers, mushrooms) so neighbours
 * move together: wave = sin(t·1.4 + x·0.35 + z·0.6)·0.35 plus a slow gust envelope.
 */
import type * as THREE from 'three'
import type { FieldUniforms } from './terrain'

const WIND_GLSL = /* glsl */ `
float fieldWind(float t, vec3 root) {
  float wave = sin(t * 1.4 + root.x * 0.35 + root.z * 0.6) * 0.35;
  float gust = sin(t * 0.6 + root.x * 0.11 - root.z * 0.17)
             * sin(t * 0.23 + root.z * 0.05 + root.x * 0.03) * 0.25;
  return wave + gust;
}
`

/* ---------------------------------------------------------------- grass blades */

export const grassVertex = /* glsl */ `
uniform float uTime;
uniform float uWind;
uniform vec3 uSunDir;

varying float vT;
varying vec3 vTint;
varying float vRim;
varying float vShimmer;
varying float vDepth;

${WIND_GLSL}

void main() {
  float t = uv.y;                       // 0 at the base, 1 at the tip
  vT = t;

  mat4 im = modelMatrix * instanceMatrix;
  vec4 root = im * vec4(0.0, 0.0, 0.0, 1.0);
  vec4 world = im * vec4(position, 1.0);

  // instanceMatrix[1] is the scaled y basis → its length is the instance height scale.
  float bladeH = length(instanceMatrix[1].xyz) * 0.9;
  float wind = fieldWind(uTime, root.xyz) * uWind;

  // Bend grows with the square of the height along the blade (tips move, bases stay put).
  float bend = wind * t * t * bladeH;
  world.x += bend;
  world.z += bend * 0.35;
  world.y -= abs(bend) * 0.25;

  vec4 mvPosition = viewMatrix * world;
  vDepth = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;

  // Face normal of the (double-sided) blade → how squarely it faces the low sun. abs(), so the
  // blades turned away from it are rimmed too: at this hour the light comes THROUGH the grass.
  vec3 n = normalize(mat3(im) * vec3(0.0, 0.0, 1.0));
  float sun = abs(dot(n, uSunDir));
  vShimmer = wind;

  #ifdef USE_INSTANCING_COLOR
    vTint = instanceColor;
  #else
    vTint = vec3(1.0);
  #endif

  // The warm rim's whole per-blade strength, solved HERE rather than in the fragment: it is
  // constant over a blade (the instance tint and the face normal both are), and a blade is the
  // most overdrawn thing in the frame. Five vertices instead of every covered pixel.
  //   - how squarely this blade faces the low sun, squared;
  //   - its own baked tint, which carries the grazing-light ramp and the per-instance jitter
  //     (Grass.tsx) — so a blade on a flank turned away from the sun keeps its rim dark while its
  //     neighbour on the crest flares, and the lit ridges sparkle instead of banding.
  vRim = (0.10 + 0.90 * sun * sun) * (0.10 + 1.05 * smoothstep(0.62, 1.12, vTint.r)) * 0.6;
}
`


export const grassFragment = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uMid;
uniform vec3 uTip;
uniform vec3 uFade;
uniform float uFadeNear;
uniform float uFadeFar;

varying float vT;
varying vec3 vTint;
varying float vRim;
varying float vShimmer;
varying float vDepth;

void main() {
  // Backlit grass: deep green in the shadow at the base, warm green up the blade, gold rim on the
  // tips the low sun rakes. The rim is what reads as backlight; the green is what reads as a meadow.
  vec3 col = mix(uBase, uMid, smoothstep(0.0, 0.8, vT));
  // Only the height ramp is left per-pixel; the per-blade half of the rim came in as vRim.
  col = mix(col, uTip, smoothstep(0.42, 1.0, vT) * vRim);
  // Exposure, with the sunset's warm cast (the violet fill of the first pass drained the green).
  col *= 0.74 * vec3(1.02, 1.0, 0.90) * vTint * (1.0 + 0.12 * vShimmer);

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>

  // Distance fade toward the skyline colour, after tone mapping so the far blades land exactly on
  // the sky gradient. The valley haze is deliberately NOT here: a blade fragment is the most
  // overdrawn thing in the frame, the terrain underneath already carries the haze, and the two
  // extra instructions measured ~0.3 ms of the footer frame on the Intel UHD reference.
  float fade = smoothstep(uFadeNear, uFadeFar, vDepth);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uFade, fade);
}
`

/* ---------------------------------------------------------------- MeshStandardMaterial patches */

type Shader = THREE.WebGLProgramParametersWithUniforms

/**
 * Terrain: a view-depth varying and a valley-haze varying (both computed in the vertex stage),
 * then the post-colour-space mix toward the skyline colour and the haze on top — this replaces
 * scene.fog. `position.y` IS the field's local height, because the Hills mesh sits at identity
 * inside the group, so there is no new attribute and no new GPU buffer.
 */
export function patchDistanceFade(shader: Shader, u: FieldUniforms) {
  shader.uniforms.uFade = u.uFade
  shader.uniforms.uFadeNear = u.uFadeNear
  shader.uniforms.uFadeFar = u.uFadeFar
  shader.uniforms.uMist = u.uMist
  shader.uniforms.uMistAmount = u.uMistAmount
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vFieldDepth;\nvarying float vFieldMist;')
    .replace(
      '#include <fog_vertex>',
      '#include <fog_vertex>\nvFieldDepth = -mvPosition.z;\nvFieldMist = (1.0 - smoothstep(0.15, 1.30, position.y)) * smoothstep(5.0, 13.0, vFieldDepth);',
    )
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      '#include <common>\nuniform vec3 uFade;\nuniform float uFadeNear;\nuniform float uFadeFar;\nuniform vec3 uMist;\nuniform float uMistAmount;\nvarying float vFieldDepth;\nvarying float vFieldMist;',
    )
    .replace(
      '#include <fog_fragment>',
      // The fade runs FIRST and the haze SECOND. The other way round the far valley is already
      // fully faded to the skyline colour by the time the haze is mixed in, so the haze did
      // nothing exactly where it was meant to do everything — that was the flat dark band the
      // owner saw under the sun.
      '#include <fog_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uFade, smoothstep(uFadeNear, uFadeFar, vFieldDepth));\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uMist, vFieldMist * uMistAmount);',
    )
}

/**
 * Flora: per-vertex sway. `aRoot` (vec3, the object's root in group space → wind phase) and
 * `aSway` (float, amplitude already scaled by height² and per-object strength) come from the
 * merged geometry; the whole merged mesh is one draw call.
 */
export function patchSway(shader: Shader, u: FieldUniforms) {
  shader.uniforms.uTime = u.uTime
  shader.uniforms.uWind = u.uWind
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>\nattribute vec3 aRoot;\nattribute float aSway;\nuniform float uTime;\nuniform float uWind;\n${WIND_GLSL}`,
    )
    .replace(
      '#include <begin_vertex>',
      `vec3 transformed = vec3(position);
{
  float w = fieldWind(uTime, aRoot) * uWind * aSway;
  transformed.x += w;
  transformed.z += w * 0.35;
  transformed.y -= abs(w) * 0.25;
}`,
    )
}
