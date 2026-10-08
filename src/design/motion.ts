/**
 * The motion spec from brief §3, declared once.
 *
 * Rules that hold everywhere: easing cubic-bezier(.22,1,.36,1), durations
 * 180-420ms, transform and opacity only — never layout. Every variant here is
 * safe under `prefers-reduced-motion` because the durations collapse to 0 via
 * `useMotionSafe()` below rather than by disabling the animation (which would
 * leave elements stuck at opacity 0).
 */
import type { Transition, Variants } from 'framer-motion'
import { useReducedMotion } from 'framer-motion'

export const EASE = [0.22, 1, 0.36, 1] as const

/** The slower, weightier curve for large surfaces (matches --ease-fluid). */
export const EASE_FLUID = [0.32, 0.72, 0, 1] as const

export const DURATION = {
  fast: 0.18,
  base: 0.26,
  slow: 0.42,
  /** Matches --d-lux; for large surfaces moving on EASE_FLUID. */
  lux: 0.65,
} as const

export const transition = (d: keyof typeof DURATION = 'base'): Transition => ({
  duration: DURATION[d],
  ease: EASE,
})

/** Section reveal: opacity 0->1, y 24->0. */
export const reveal: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: transition('slow') },
}

/** Parent of a revealed group. 60ms stagger, per §3. */
export const staggerParent: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

/** Card hover: image scales inside a fixed frame, caption rises 6px. */
export const cardMedia: Variants = {
  rest: { scale: 1, transition: transition('base') },
  hover: { scale: 1.04, transition: transition('base') },
}

export const cardCaption: Variants = {
  rest: { y: 0, transition: transition('base') },
  hover: { y: -6, transition: transition('base') },
}

/** Page transition: a paper panel wipes across, the next route fades in. */
export const pageWipe: Variants = {
  initial: { scaleX: 0, originX: 0 },
  animate: { scaleX: [0, 1, 1], originX: [0, 0, 1], transition: { duration: 0.5, ease: EASE } },
  exit: { scaleX: 0, originX: 1, transition: transition('base') },
}

export const pageFade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25, ease: EASE } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: EASE } },
}

/** Press feedback — 0.98, per §3. */
export const press = { scale: 0.98 }

/**
 * Motion-safe wrapper. Returns the variants unchanged normally, and a
 * zero-duration version when the user asked for reduced motion — so the end
 * state is always reached and nothing is left invisible.
 */
export function useMotionSafe<T extends Variants>(variants: T): T {
  const reduced = useReducedMotion()
  if (!reduced) return variants
  const out: Variants = {}
  for (const [key, value] of Object.entries(variants)) {
    out[key] =
      typeof value === 'object' && value !== null
        ? { ...(value as object), transition: { duration: 0 } }
        : value
  }
  return out as T
}

/**
 * Shared `whileInView` config so every section reveals identically. Only the
 * bottom edge is inset: a -12% top margin made tall sections that start
 * above the fold (deep links, back navigation) wait for a scroll to appear.
 */
export const inViewOnce = {
  initial: 'hidden' as const,
  whileInView: 'visible' as const,
  viewport: { once: true, margin: '0px 0px -8% 0px', amount: 0.15 },
}
