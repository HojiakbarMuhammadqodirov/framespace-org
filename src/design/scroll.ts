import { useRef } from 'react'
import { useScroll, useSpring, useTransform, type MotionValue } from 'framer-motion'
import { EASE_FLUID } from './motion'

/**
 * Scroll choreography helpers.
 *
 * Everything here returns MotionValues driven by `useScroll`, which reads from
 * a single rAF loop — never a scroll listener, which would reflow every frame.
 */

/* Re-exported so existing `@/design/scroll` imports keep working; the single
   definition lives in motion.ts. */
export { EASE_FLUID }

/* Lenis already smooths the scroll position, so a soft spring on top of it
   smooths the same signal twice and the result visibly trails the wheel. These
   are stiff enough to be near pass-through while still absorbing jitter on
   touch devices, where Lenis is deliberately not used. */
const SOFT = { stiffness: 420, damping: 42, mass: 0.2 }

/**
 * Progress 0 → 1 across a section, for a sticky/pinned stage.
 *
 * `offset` defaults to the section entering the top of the viewport until it
 * has fully left — the range a pinned element is actually on screen for.
 */
export function useSectionProgress(
  offset: [string, string] = ['start start', 'end end']
) {
  const ref = useRef<HTMLElement | null>(null)
  const { scrollYProgress } = useScroll({
    target: ref as React.RefObject<HTMLElement>,
    offset: offset as never,
  })
  const smooth = useSpring(scrollYProgress, SOFT)
  return { ref, progress: scrollYProgress, smooth }
}

/**
 * Parallax drift in px as a section passes the viewport.
 *
 * Deliberately *not* spring-damped. The progress handed in has already been
 * smoothed once by Lenis, and a spring here would be a second pass on the same
 * signal — the drift then visibly sledges behind the scroll instead of
 * tracking it, which reads as lag rather than luxury.
 */
export function useParallax(progress: MotionValue<number>, distance = 80) {
  return useTransform(progress, [0, 1], [0, -distance])
}

/**
 * Map a progress value onto a sub-range, clamped.
 * `stage(p, 0.2, 0.5)` is 0 before 20%, 1 after 50%, linear between.
 */
export function stage(progress: MotionValue<number>, from: number, to: number) {
  return useTransform(progress, [from, to], [0, 1], { clamp: true })
}

/** Cubic ease-out, for hand-driven interpolation outside framer. */
export function easeOut(t: number) {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)
}

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/**
 * Frame-rate independent smoothing factor. Using a fixed 0.1 per frame makes
 * motion twice as fast on a 120Hz display; this does not.
 */
export function damp(dt: number, tau = 0.12) {
  return 1 - Math.exp(-dt / tau)
}
