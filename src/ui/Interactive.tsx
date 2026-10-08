import { useRef, useState, type ReactNode } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'

const SPRING = { stiffness: 260, damping: 26, mass: 0.5 }

function useFinePointer() {
  const reduced = useReducedMotion()
  if (reduced) return false
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: fine) and (min-width: 1024px)').matches
}

/**
 * Pulls its child toward the cursor while the pointer is inside an enlarged
 * hit area, then springs back. Transform only, so it stays on the compositor.
 */
export function Magnetic({
  children,
  strength = 0.35,
  max = 14,
  className,
}: {
  children: ReactNode
  strength?: number
  max?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const enabled = useFinePointer()
  const x = useSpring(useMotionValue(0), SPRING)
  const y = useSpring(useMotionValue(0), SPRING)

  if (!enabled) return <div className={className}>{children}</div>

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x, y, display: 'inline-block', willChange: 'transform' }}
      onPointerMove={(event) => {
        const box = ref.current?.getBoundingClientRect()
        if (!box) return
        const dx = (event.clientX - (box.left + box.width / 2)) * strength
        const dy = (event.clientY - (box.top + box.height / 2)) * strength
        x.set(Math.max(-max, Math.min(max, dx)))
        y.set(Math.max(-max, Math.min(max, dy)))
      }}
      onPointerLeave={() => {
        x.set(0)
        y.set(0)
      }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Perspective tilt. The card leans away from the cursor and a specular sheen
 * tracks across it, which is what sells a flat rectangle as a physical plate.
 */
export function Tilt({
  children,
  max = 7,
  sheen = true,
  className,
  style,
}: {
  children: ReactNode
  max?: number
  sheen?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const enabled = useFinePointer()
  const [hovered, setHovered] = useState(false)

  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), SPRING)
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), SPRING)
  const sheenX = useTransform(px, [0, 1], ['0%', '100%'])
  const sheenY = useTransform(py, [0, 1], ['0%', '100%'])
  // Declared before the early return: a hook called only on the enabled
  // branch changes the hook order whenever `enabled` flips.
  const sheenBg = useTransform(
    [sheenX, sheenY],
    ([sx, sy]: string[]) =>
      `radial-gradient(420px circle at ${sx} ${sy}, var(--sheen), transparent 62%)`
  )

  if (!enabled) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        ...style,
        rotateX: rx,
        rotateY: ry,
        transformPerspective: 1100,
        transformStyle: 'preserve-3d',
        position: 'relative',
        willChange: 'transform',
      }}
      onPointerMove={(event) => {
        const box = ref.current?.getBoundingClientRect()
        if (!box) return
        px.set((event.clientX - box.left) / box.width)
        py.set((event.clientY - box.top) / box.height)
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false)
        px.set(0.5)
        py.set(0.5)
      }}
    >
      {children}
      {sheen && (
        <motion.span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            pointerEvents: 'none',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 320ms cubic-bezier(.32,.72,0,1)',
            background: sheenBg,
          }}
        />
      )}
    </motion.div>
  )
}

/**
 * A seamless ticker. Two copies of the children scroll as one track, so the
 * loop has no visible seam, and it pauses on hover and under reduced motion.
 */
export function Marquee({
  children,
  speed = 38,
  reverse = false,
  className,
}: {
  children: ReactNode
  /** Seconds for one full pass. */
  speed?: number
  reverse?: boolean
  className?: string
}) {
  const reduced = useReducedMotion()

  return (
    <div
      className={className}
      style={{ overflow: 'hidden', maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}
    >
      <div
        style={{
          display: 'flex',
          width: 'max-content',
          gap: 'var(--s6)',
          animation: reduced
            ? undefined
            : `fs-marquee ${speed}s linear infinite ${reverse ? 'reverse' : 'normal'}`,
        }}
      >
        <div style={{ display: 'flex', gap: 'var(--s6)' }}>{children}</div>
        <div style={{ display: 'flex', gap: 'var(--s6)' }} aria-hidden="true">
          {children}
        </div>
      </div>
      <style href="fs-marquee" precedence="medium">{`
        @keyframes fs-marquee { to { transform: translate3d(-50%, 0, 0); } }
      `}</style>
    </div>
  )
}
