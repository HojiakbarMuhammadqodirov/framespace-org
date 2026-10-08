import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { EASE_FLUID, inViewOnce, reveal, staggerParent, useMotionSafe } from '@/design/motion'

/**
 * Scroll entry. Elements never appear statically: they rise from below, and
 * can optionally carry a slight defocus that resolves as they settle.
 *
 * The defocus is opt-in and never runs on touch devices: animating `filter`
 * re-rasterises the whole element every frame, which is what made long pages
 * stutter on low-end phones.
 *
 * Under prefers-reduced-motion the end state is rendered immediately — never
 * left at opacity 0.
 */

/* Read once: pointer type does not change during a session in practice. */
const COARSE =
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

const revealBlur = {
  hidden: { opacity: 0, y: 18, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.75, ease: EASE_FLUID },
  },
}

export function Reveal({
  children,
  className,
  as = 'div',
  blur = false,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'li'
  /** Adds a defocus to the rise. Ignored on touch devices. */
  blur?: boolean
  delay?: number
}) {
  const reduced = useReducedMotion()
  const plain = useMotionSafe(reveal)
  const Tag = motion[as] as typeof motion.div

  if (reduced) {
    const Plain = as as 'div'
    return <Plain className={className}>{children}</Plain>
  }

  return (
    <Tag
      className={className}
      variants={blur && !COARSE ? revealBlur : plain}
      transition={delay ? { delay } : undefined}
      {...inViewOnce}
    >
      {children}
    </Tag>
  )
}

/** Wrap a group so children reveal with a 60ms stagger. */
export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  const variants = useMotionSafe(staggerParent)
  return (
    <motion.div className={className} variants={variants} {...inViewOnce}>
      {children}
    </motion.div>
  )
}

/** A child inside RevealGroup — inherits the parent's stagger timing. */
export function RevealItem({
  children,
  className,
  blur = false,
}: {
  children: ReactNode
  className?: string
  blur?: boolean
}) {
  const reduced = useReducedMotion()
  const plain = useMotionSafe(reveal)
  if (reduced) return <div className={className}>{children}</div>
  return (
    <motion.div className={className} variants={blur && !COARSE ? revealBlur : plain}>
      {children}
    </motion.div>
  )
}
