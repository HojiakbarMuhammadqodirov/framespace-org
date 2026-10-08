import { useEffect, useRef } from 'react'

import { clamp } from './orientation'
import type { LiveOrientation } from './useLiveOrientation'

/**
 * Bubble level for pitch, tilted by roll.
 *
 * A spirit level, not a dial: the bubble rises toward the end you are lifting,
 * exactly like the real object, so nobody has to read the number to know which
 * way to move. The vial itself rotates with the device roll, which turns two
 * separate read-outs into one picture.
 *
 * Same discipline as the tape — one rAF subscription, `transform` only.
 */

/** Degrees of pitch across the full travel of the bubble. */
const SPAN = 40

const CSS = `
.fsl-level {
  position: relative;
  height: 46px;
  display: grid;
  place-items: center;
}
.fsl-level__vial {
  position: relative;
  width: min(220px, 62%);
  height: 30px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--clay-900) 34%, transparent);
  box-shadow: inset 0 0 0 1px var(--bezel-ring), var(--inset-hi);
  overflow: hidden;
  will-change: transform;
}
.fsl-level__gate {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  background: color-mix(in srgb, var(--ok) 24%, transparent);
  border-inline: 1px solid color-mix(in srgb, var(--ok) 52%, transparent);
  opacity: 0;
  transition: opacity var(--d-base) var(--ease);
}
.fsl-level[data-aligned='true'] .fsl-level__gate { opacity: 1; }
.fsl-level__hair {
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 50%;
  width: 1px;
  margin-left: -0.5px;
  background: var(--text-muted);
}
.fsl-level__bubble {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 22px;
  height: 22px;
  margin: -11px 0 0 -11px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent) 90%, transparent);
  box-shadow: var(--inset-hi);
  will-change: transform;
}
.fsl-level[data-aligned='true'] .fsl-level__bubble {
  background: color-mix(in srgb, var(--ok) 92%, transparent);
}
.fsl-level__tick {
  position: absolute;
  top: 9px;
  height: 12px;
  width: 1px;
  background: var(--hairline);
}
@media (prefers-reduced-motion: reduce) {
  .fsl-level__gate { transition: none; }
}
`

export interface BubbleLevelProps {
  orientation: LiveOrientation
  tolerance: number
  aligned: boolean
}

export function BubbleLevel({ orientation, tolerance, aligned }: BubbleLevelProps) {
  const vialRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const vial = vialRef.current
    const bubble = bubbleRef.current
    if (!vial || !bubble) return

    return orientation.subscribe((frame) => {
      const travel = (vial.clientWidth || 1) / 2 - 14
      // Positive pitch means looking up, so the bubble goes right — the same
      // way it would in a vial you had just tipped up on its right end.
      const x = clamp(frame.pitch / (SPAN / 2), -1, 1) * travel
      bubble.style.transform = `translate3d(${x}px, 0, 0)`
      vial.style.transform = `rotate(${clamp(frame.roll, -35, 35)}deg)`
    })
  }, [orientation])

  const gateWidth = `${((tolerance * 2) / SPAN) * 100}%`
  const gateOffset = `${(-tolerance / SPAN) * 100}%`

  return (
    <>
      <style href="fs-live-level" precedence="medium">
        {CSS}
      </style>
      <div className="fsl-level" data-aligned={aligned} aria-hidden="true">
        <div className="fsl-level__vial" ref={vialRef}>
          <span className="fsl-level__gate" style={{ width: gateWidth, marginLeft: gateOffset }} />
          {[-15, -5, 5, 15].map((deg) => {
            const pct = (deg / SPAN) * 100
            return (
              <span
                key={deg}
                className="fsl-level__tick"
                style={{ left: `calc(50% ${pct < 0 ? '-' : '+'} ${Math.abs(pct)}%)` }}
              />
            )
          })}
          <span className="fsl-level__hair" />
          <span className="fsl-level__bubble" ref={bubbleRef} />
        </div>
      </div>
    </>
  )
}
