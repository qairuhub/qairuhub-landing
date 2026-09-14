/** The one easing curve used everywhere in the reference (easeOutQuint-like). */
export const EASE = [0.22, 1, 0.36, 1] as const
export const EASE_CSS = 'cubic-bezier(0.22, 1, 0.36, 1)'

/** Durations from the reference (ms). */
export const DUR = {
  reveal: 1000,
  stagger: 150,
  button: 1000,
  buttonFill: 2000,
  dropdown: 350,
  header: 850,
  tab: 500,
  typewriter: 800,
  tabAutoAdvance: 9000,
} as const

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** Map v from [inMin,inMax] to [0,1], clamped. */
export const progress = (v: number, inMin: number, inMax: number) => clamp((v - inMin) / (inMax - inMin))
