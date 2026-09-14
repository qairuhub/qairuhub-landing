/**
 * Quality tiers for the backdrop canvas (docs/JOURNEY-SPEC.md "Performance budget").
 * Detected ONCE at mount (`detectQuality`) and passed down as `LayerProps.tier`; every layer
 * scales its own budget from `QUALITY[tier]` instead of probing the device itself.
 */
export type QualityTier = 'high' | 'medium' | 'low'

export interface QualitySettings {
  /** star vertices in <Stars> */
  stars: number
  /** cloud sprites drawn per frame (all depth layers together) */
  clouds: number
  /** baked cloud texture size (px, square-ish) */
  cloudTexture: number
  /** grass blades in the night field */
  blades: number
  /** glass wordmark: MeshTransmissionMaterial on, or the cheap MeshPhysicalMaterial fallback */
  transmission: boolean
  /** transmission FBO size */
  glassResolution: number
  /** transmission samples */
  glassSamples: number
  /** devicePixelRatio cap (laptops / tablets, viewports < 1280 px) */
  dprCap: number
  /**
   * devicePixelRatio cap on desktop viewports (≥ 1280 px). The sky is soft gradients and
   * sprites, so extra pixels only cost fill rate: at 1440 × 900 the 1.5 cap meant a 2137 × 1350
   * backing store, 1.25 an 1800 × 1125 one. `medium` (integrated GPUs) pays for every fragment —
   * measured on the Intel UHD reference laptop, 1.0 instead of 1.25 is +5 fps at both the hero
   * and the footer (42 → 47, 40 → 45), ≈ 2.5 ms of the ~7–9 ms scene cost at the two ends.
   * A 1.0 cap ships together with MSAA (`getAntialias`): at exactly 1× the wordmark's
   * silhouette would otherwise show jaggies on a DPR-2 display.
   */
  desktopDprCap: number
}

/*
 * Glass samples: 6 / 3 / 2. medium was 4 — on the Intel UHD reference laptop the wordmark is the
 * single most expensive layer at both ends of the journey (hero 52 → 64 fps without it, footer
 * 49 → 57), and each sample is four hashes, a normalize, a pow, an EnvironmentBRDF and a bicubic
 * refraction tap per fragment; 3 keeps the roughness-0.42 blur smooth at the wordmark's size
 * (the FBO is already soft) and buys ~1 ms of the ~12.5 ms GPU frame.
 *
 * Blade counts: 14000 / 6000 / 3000. medium was 8000 — measured on the Intel UHD reference laptop
 * at 1440 × 900 the footer (grass + hills + glass + stars) was the only journey position under the
 * 55 fps target (53); 3000 blades already read as a full meadow in the 1440 shots, so 6000 is
 * still dense and buys the footer its margin.
 */
export const QUALITY: Record<QualityTier, QualitySettings> = {
  high: { stars: 1800, clouds: 26, cloudTexture: 512, blades: 14000, transmission: true, glassResolution: 512, glassSamples: 6, dprCap: 1.5, desktopDprCap: 1.25 },
  medium: { stars: 900, clouds: 20, cloudTexture: 512, blades: 6000, transmission: true, glassResolution: 384, glassSamples: 3, dprCap: 1.5, desktopDprCap: 1 },
  low: { stars: 500, clouds: 14, cloudTexture: 256, blades: 3000, transmission: false, glassResolution: 256, glassSamples: 2, dprCap: 1.25, desktopDprCap: 1.25 },
}

interface NavigatorHints extends Navigator {
  connection?: { saveData?: boolean }
  deviceMemory?: number
}

type GpuClass = 'discrete' | 'integrated' | 'weak' | 'unknown'

/**
 * One throwaway WebGL context to read the renderer string. Core count alone misleads: a
 * 20-core laptop with an Intel UHD iGPU (the user's machine) must not get the `high` budget —
 * measured there, the glass + space dome at DPR 1.5 ran at ~24 fps on `high`.
 */
function probeGpu(): GpuClass {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!gl) return 'weak'
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const raw = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
    const r = String(raw).toLowerCase()
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    if (/swiftshader|llvmpipe|software|mali|adreno|powervr|videocore/.test(r)) return 'weak'
    if (/nvidia|geforce|rtx|gtx|radeon rx|radeon pro|apple m|apple gpu|\barc\b/.test(r)) return 'discrete'
    if (/intel|iris|uhd|hd graphics|radeon\(tm\)|vega/.test(r)) return 'integrated'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * `low`: phones / ≤ 4 cores / Save-Data / ≤ 2 GB / software or mobile GPU;
 * `medium`: integrated desktop GPUs (Intel UHD / Iris, AMD APUs) whatever the core count;
 * `high`: a discrete (or unknown) GPU with ≥ 8 cores; everything else `medium`.
 */
export function detectQuality(): QualityTier {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'medium'
  // Debug / QA override: ?q=high|medium|low pins the tier (perf profiling, visual checks).
  const forced = new URLSearchParams(window.location.search).get('q')
  if (forced === 'high' || forced === 'medium' || forced === 'low') return forced
  const nav = navigator as NavigatorHints
  const cores = nav.hardwareConcurrency ?? 4
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const narrow = window.innerWidth < 768
  const saveData = nav.connection?.saveData === true
  const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2
  if (coarse || narrow || cores <= 4 || saveData || lowMemory) return 'low'
  const gpu = probeGpu()
  if (gpu === 'weak') return 'low'
  if (gpu === 'integrated') return 'medium'
  if (cores >= 8) return 'high'
  return 'medium'
}

/** Viewports at least this wide take `desktopDprCap` instead of `dprCap`. */
const DESKTOP_MIN_WIDTH = 1280

/**
 * Canvas DPR: min(devicePixelRatio, tier cap), never below 1. Desktop viewports
 * (≥ 1280 px) use the tier's `desktopDprCap` (1.25 for `high`, 1.0 for `medium` — see
 * `QualitySettings.desktopDprCap` for the measurements); narrower viewports use `dprCap`.
 */
export function getDpr(tier: QualityTier): number {
  if (typeof window === 'undefined') return 1
  const q = QUALITY[tier]
  const cap = window.innerWidth >= DESKTOP_MIN_WIDTH ? Math.min(q.desktopDprCap, q.dprCap) : q.dprCap
  return Math.max(1, Math.min(window.devicePixelRatio || 1, cap))
}

/**
 * Whether the canvas should be created with MSAA (`gl.antialias`). Above 1× the sky's soft
 * gradients, sprites and blurred glass hide geometry edges on their own, so the resolve pass is
 * wasted bandwidth. At exactly 1× (the `medium` desktop budget) the extruded wordmark's
 * silhouette is rasterised at native CSS pixels and, on a DPR-2 display, upscaled 2× — without
 * MSAA the glass edges show jaggies. MSAA only multiplies coverage samples, not fragment
 * shading, so at 1× it is far cheaper than the 1.25× backing store it replaces.
 *
 * Consumed by `SkyScene.tsx` as `<Canvas gl={{ antialias: getAntialias(tier) }}>` next to
 * `dpr={getDpr(tier)}`. Unlike `dpr`, `antialias` is a WebGL context-creation attribute and
 * cannot change on a live context, so the consumer keys the <Canvas> on this value and
 * re-reads it whenever `getDpr` could flip (tier change, the 1280 px desktop breakpoint).
 */
export function getAntialias(tier: QualityTier): boolean {
  return getDpr(tier) <= 1
}
