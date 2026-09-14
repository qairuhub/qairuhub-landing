/**
 * GLSL for the night field.
 *
 * - `grassVertex` / `grassFragment`: the blade ShaderMaterial (wind in the vertex shader, moonlit
 *   tips, manual distance fade — the shared scene has no fog).
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
uniform vec3 uMoonDir;

varying float vT;
varying vec3 vTint;
varying float vMoon;
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

  // Face normal of the (double-sided) blade → how squarely it faces the moon.
  vec3 n = normalize(mat3(im) * vec3(0.0, 0.0, 1.0));
  vMoon = abs(dot(n, uMoonDir));
  vShimmer = wind;

  #ifdef USE_INSTANCING_COLOR
    vTint = instanceColor;
  #else
    vTint = vec3(1.0);
  #endif
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
varying float vMoon;
varying float vShimmer;
varying float vDepth;

void main() {
  // Deep green-black at the base, mid green up the blade, a cool moon highlight on the tips
  // that face the moon (kept low — the v1 field was neon).
  vec3 col = mix(uBase, uMid, smoothstep(0.0, 0.8, vT));
  float tip = smoothstep(0.5, 1.0, vT) * (0.2 + 0.8 * vMoon);
  col = mix(col, uTip, tip * 0.38);
  // Night exposure: well under daylight, with a faint cool cast from the moon.
  col *= 0.6 * vec3(0.9, 1.0, 1.05) * vTint * (1.0 + 0.12 * vShimmer);

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>

  // Distance fade toward the night sky (after tone mapping so far blades match the sky exactly).
  float fade = smoothstep(uFadeNear, uFadeFar, vDepth);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uFade, fade);
}
`

/* ---------------------------------------------------------------- MeshStandardMaterial patches */

type Shader = THREE.WebGLProgramParametersWithUniforms

/** Terrain: view-depth varying + post-colour-space mix toward the sky colour (replaces scene.fog). */
export function patchDistanceFade(shader: Shader, u: FieldUniforms) {
  shader.uniforms.uFade = u.uFade
  shader.uniforms.uFadeNear = u.uFadeNear
  shader.uniforms.uFadeFar = u.uFadeFar
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vFieldDepth;')
    .replace('#include <fog_vertex>', '#include <fog_vertex>\nvFieldDepth = -mvPosition.z;')
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      '#include <common>\nuniform vec3 uFade;\nuniform float uFadeNear;\nuniform float uFadeFar;\nvarying float vFieldDepth;',
    )
    .replace(
      '#include <fog_fragment>',
      '#include <fog_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uFade, smoothstep(uFadeNear, uFadeFar, vFieldDepth));',
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
