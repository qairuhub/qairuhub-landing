import type { QualityTier } from './quality'

/**
 * Every backdrop layer (SkyDome, Stars, CloudSprites, GlassWordmark, Field, SceneLights)
 * is a default-exported React component with exactly these props. Layers read the shared
 * `journey` object (./journey) inside their own useFrame — never React state per frame.
 */
export interface LayerProps {
  tier: QualityTier
  /** prefers-reduced-motion: no drift/float/twinkle; the scene renders a static frame */
  reduced: boolean
}
