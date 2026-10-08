import { isValidElement, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useMotionValue, useMotionValueEvent, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

/** A layer is either any node, or an image given by its source. */
type Layer = ReactNode | { src: string; alt?: string }

function renderLayer(layer: Layer) {
  if (layer && typeof layer === 'object' && !isValidElement(layer) && 'src' in layer) {
    return <img src={layer.src} alt={layer.alt ?? ''} decoding="async" draggable={false} />
  }
  return layer as ReactNode
}

/**
 * Draggable before/after divider (§3).
 *
 * On desktop the divider follows the cursor inside the frame with no click at
 * all; on touch it is a drag. It auto-wipes once on first view so the control
 * explains itself, then hands over. Keyboard: arrow keys move it in 2% steps.
 *
 * `before` and `after` take any node, or `{ src, alt }` for a plain image
 * (e.g. the real hero poster) laid out with the frame's object-fit rules.
 */
export function BeforeAfter({
  before,
  after,
  labelBefore = 'Before',
  labelAfter = 'After',
  autoWipe = true,
  className,
}: {
  before: Layer
  after: Layer
  labelBefore?: string
  labelAfter?: string
  autoWipe?: boolean
  className?: string
}) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const afterRef = useRef<HTMLDivElement | null>(null)
  const handleRef = useRef<HTMLDivElement | null>(null)
  const rangeRef = useRef<HTMLInputElement | null>(null)
  const [wiped, setWiped] = useState(!autoWipe)
  const reduced = useReducedMotion()
  const { t } = useTranslation()
  // How much of the "after" layer is showing, spoken by screen readers. The
  // after layer is clipped from the left, so it is the remainder of the split.
  const valueText = (value: number) =>
    t('ui.beforeAfter.valuetext', {
      value: Math.round(100 - value),
      defaultValue: '{{value}}% keyin',
    })

  /* The divider position is a MotionValue, not React state. This is the first
     thing a visitor touches on mobile, and both the intro wipe and the drag
     used to call setState once per frame — re-rendering both sketch layers
     each time. Now the frame only writes two style properties. */
  const pos = useMotionValue(50)

  useMotionValueEvent(pos, 'change', (value) => {
    if (afterRef.current) afterRef.current.style.clipPath = `inset(0 0 0 ${value}%)`
    if (handleRef.current) handleRef.current.style.left = `${value}%`
    // Keep the range in sync for screen readers without re-rendering.
    if (rangeRef.current) {
      rangeRef.current.value = String(Math.round(value))
      rangeRef.current.setAttribute('aria-valuetext', valueText(value))
    }
  })

  // The one-time demonstration wipe.
  useEffect(() => {
    if (wiped || reduced) {
      setWiped(true)
      return
    }
    let raf = 0
    const started = performance.now()
    const DURATION = 1400
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / DURATION)
      // out -> back, easing at both ends
      const eased = t < 0.5 ? t * 2 : 2 - t * 2
      pos.set(50 + eased * 28)
      if (t < 1) raf = requestAnimationFrame(tick)
      else setWiped(true)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [wiped, reduced, pos])

  const track = useCallback(
    (clientX: number) => {
      const box = frameRef.current?.getBoundingClientRect()
      if (!box) return
      const next = ((clientX - box.left) / box.width) * 100
      pos.set(Math.max(0, Math.min(100, next)))
    },
    [pos]
  )

  return (
    <div
      ref={frameRef}
      className={className ? `fs-ba ${className}` : 'fs-ba'}
      data-cursor="Drag"
      onPointerMove={(event) => {
        if (!wiped) return
        // Fine pointers follow without a press; touch requires a drag.
        if (event.pointerType === 'mouse' || event.buttons > 0) track(event.clientX)
      }}
      onPointerDown={(event) => {
        setWiped(true)
        track(event.clientX)
      }}
    >
      <div className="fs-ba__layer">{renderLayer(before)}</div>
      <div ref={afterRef} className="fs-ba__layer" style={{ clipPath: 'inset(0 0 0 50%)' }}>
        {renderLayer(after)}
      </div>

      <div ref={handleRef} className="fs-ba__handle" style={{ left: '50%' }}>
        <span className="fs-ba__grip" aria-hidden="true">
          <svg width="18" height="10" viewBox="0 0 18 10" fill="none">
            <path
              d="M5 1 1 5l4 4M13 1l4 4-4 4M1 5h16"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      <input
        ref={rangeRef}
        type="range"
        min={0}
        max={100}
        step={2}
        defaultValue={50}
        onChange={(event) => {
          setWiped(true)
          pos.set(Number(event.target.value))
        }}
        aria-label={`${labelBefore} / ${labelAfter}`}
        aria-valuetext={valueText(50)}
        style={{
          position: 'absolute',
          inset: 'auto 0 0 0',
          width: '100%',
          opacity: 0,
          height: 44,
        }}
      />
    </div>
  )
}
