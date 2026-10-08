import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { EASE } from '@/design/motion'

/**
 * PLACEHOLDER MARK — the repository carries no logo asset, so this is a
 * stand-in wordmark: a square frame holding a lit "space", then "Frame" in
 * the display serif and "Space" in its italic.
 *
 * Built to be crisp at 24px: the frame strokes land on whole pixels at the
 * header size, and the wordmark is live text (no SVG outlines), so it hints
 * like the rest of the type.
 *
 * It is never blank. The old version started the strokes and the word at
 * opacity 0 and relied on a framer animation to bring them in, which left an
 * empty slot in the header whenever that animation did not run (hydration,
 * a backgrounded tab on mobile). The draw-in is now a CSS stroke animation
 * on the outer frame only, and the resting state is the visible one.
 *
 * To swap in the real mark: replace the two <rect>s and keep the class names.
 */
export function Logo({
  size = 28,
  showWordmark = true,
  animate = true,
}: {
  size?: number
  showWordmark?: boolean
  animate?: boolean
}) {
  const reduced = useReducedMotion()
  const markRef = useRef<SVGSVGElement | null>(null)
  // The inner square micro-reacts to cursor proximity (§3).
  const [proximity, setProximity] = useState(0)

  useEffect(() => {
    if (reduced) return
    if (!window.matchMedia('(pointer: fine)').matches) return

    const RADIUS = 160
    const onMove = (event: PointerEvent) => {
      const box = markRef.current?.getBoundingClientRect()
      if (!box) return
      const dx = event.clientX - (box.left + box.width / 2)
      const dy = event.clientY - (box.top + box.height / 2)
      const distance = Math.hypot(dx, dy)
      const next = distance > RADIUS ? 0 : 1 - distance / RADIUS
      setProximity((prev) => (Math.abs(prev - next) < 0.02 ? prev : next))
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [reduced])

  const draw = animate && !reduced

  return (
    <span
      className="fs-logo"
      style={{ ['--logo-size' as string]: `${size}px` }}
      aria-label="FrameSpace"
      role="img"
    >
      <style href="fs-logo" precedence="medium">{`
        .fs-logo {
          display: inline-flex;
          align-items: center;
          gap: calc(var(--logo-size) * 0.36);
          color: var(--text-strong);
          line-height: 1;
          white-space: nowrap;
        }
        .fs-logo__mark { flex: 0 0 auto; overflow: visible; shape-rendering: geometricPrecision; }
        .fs-logo__frame[data-draw='true'] {
          stroke-dasharray: 1;
          animation: fs-logo-draw 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both;
        }
        @keyframes fs-logo-draw {
          from { stroke-dashoffset: 1; }
          to { stroke-dashoffset: 0; }
        }
        .fs-logo__word {
          font-family: var(--font-display);
          font-size: calc(var(--logo-size) * 0.8);
          font-weight: 500;
          letter-spacing: -0.012em;
          /* Optical alignment: the serif's cap height sits high in its box. */
          transform: translateY(-0.04em);
        }
        .fs-logo__word i {
          font-style: italic;
          font-weight: 500;
          letter-spacing: -0.02em;
          margin-left: 0.02em;
        }
        @media (prefers-reduced-motion: reduce) {
          .fs-logo__frame[data-draw='true'] { animation: none; }
        }
      `}</style>
      <svg
        ref={markRef}
        className="fs-logo__mark"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        {/* Outer frame: a 1.5 stroke on a 24 grid lands crisp at 24px. */}
        <rect
          className="fs-logo__frame"
          data-draw={draw}
          x="1.75"
          y="1.75"
          width="20.5"
          height="20.5"
          rx="2.25"
          stroke="currentColor"
          strokeWidth="1.5"
          pathLength={1}
        />
        {/* The space inside the frame, lit in the brand orange. */}
        <motion.rect
          x="8"
          y="8"
          width="8"
          height="8"
          rx="1"
          fill="var(--accent)"
          style={{ transformOrigin: '12px 12px', transformBox: 'view-box' }}
          animate={{ scale: 1 + proximity * 0.35 }}
          transition={{ duration: 0.32, ease: EASE }}
        />
      </svg>

      {showWordmark && (
        <span className="fs-logo__word" aria-hidden="true">
          Frame<i>Space</i>
        </span>
      )}
    </span>
  )
}
