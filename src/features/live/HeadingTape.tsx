import { useEffect, useRef } from 'react'

import { normalizeDeg, signedDelta } from './orientation'
import type { LiveOrientation } from './useLiveOrientation'

/**
 * The heading tape: a strip of compass ticks that slides under a fixed caret.
 *
 * Driven straight from the sensor subscription at 60fps, writing nothing but
 * `transform` on two elements. Putting the heading in React state instead
 * would re-render the whole screen sixty times a second to move a ruler two
 * pixels, and it would still judder.
 *
 * The target marker is the anchor heading. It slides on the same scale, so
 * "bring the marker to the caret" is the whole alignment instruction and needs
 * no words.
 */

/** Degrees of bearing shown across the full width of the tape. */
const SPAN = 120
const MAJOR = 15
const MINOR = 5

const CSS = `
.fsl-tape {
  position: relative;
  height: 58px;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent, black 12%, black 88%, transparent);
  mask-image: linear-gradient(90deg, transparent, black 12%, black 88%, transparent);
}
.fsl-tape__track {
  position: absolute;
  inset: 0;
  will-change: transform;
}
.fsl-tape__tick {
  position: absolute;
  top: 16px;
  width: 1px;
  background: var(--border-strong);
}
.fsl-tape__tick[data-major='true'] {
  top: 10px;
  background: var(--text-muted);
}
.fsl-tape__cardinal {
  position: absolute;
  top: 30px;
  transform: translateX(-50%);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-mono);
  color: var(--text-muted);
}
.fsl-tape__target {
  position: absolute;
  top: 6px;
  bottom: 6px;
  width: 2px;
  margin-left: -1px;
  border-radius: 1px;
  background: var(--accent);
  will-change: transform;
  opacity: 0.9;
}
.fsl-tape__target::after {
  content: '';
  position: absolute;
  top: -1px;
  left: 50%;
  width: 9px;
  height: 9px;
  transform: translateX(-50%) rotate(45deg);
  background: var(--accent);
  border-radius: 1px;
}
.fsl-tape__caret {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  margin-left: -0.5px;
  background: var(--text-strong);
}
.fsl-tape__caret::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 0;
  height: 0;
  transform: translateX(-50%);
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 7px solid var(--text-strong);
}
.fsl-tape__dead {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  background: color-mix(in srgb, var(--ok) 26%, transparent);
  border-inline: 1px solid color-mix(in srgb, var(--ok) 50%, transparent);
  opacity: 0;
  transition: opacity var(--d-base) var(--ease);
}
.fsl-tape[data-aligned='true'] .fsl-tape__dead { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .fsl-tape__dead { transition: none; }
}
`

interface Tick {
  deg: number
  major: boolean
  cardinal?: string
}

const CARDINALS: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }

function buildTicks(): Tick[] {
  const ticks: Tick[] = []
  for (let deg = 0; deg < 360; deg += MINOR) {
    const major = deg % MAJOR === 0
    ticks.push({ deg, major, cardinal: CARDINALS[deg] })
  }
  return ticks
}

const TICKS = buildTicks()

export interface HeadingTapeProps {
  orientation: LiveOrientation
  /** Target heading in degrees, read every frame. */
  target: { current: number }
  /** Whether the anchor has been set at all — hides the marker if not. */
  calibrated: boolean
  /** ± tolerance shown as the green gate around the caret. */
  tolerance: number
  aligned: boolean
}

export function HeadingTape({
  orientation,
  target,
  calibrated,
  tolerance,
  aligned,
}: HeadingTapeProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    const track = trackRef.current
    const marker = markerRef.current
    if (!host || !track) return

    const pxPerDeg = () => (host.clientWidth || 1) / SPAN

    return orientation.subscribe((frame) => {
      const k = pxPerDeg()
      // The track holds three copies of the 360° ruler laid end to end, so it
      // can be slid past the caret without a seam at north.
      const heading = normalizeDeg(frame.heading)
      track.style.transform = `translate3d(${-heading * k}px, 0, 0)`
      if (marker) {
        const delta = calibrated ? signedDelta(target.current, heading) : 0
        marker.style.transform = `translate3d(${delta * k}px, 0, 0)`
      }
    })
  }, [orientation, target, calibrated])

  const deadWidth = `${((tolerance * 2) / SPAN) * 100}%`
  const deadOffset = `${(-tolerance / SPAN) * 100}%`

  return (
    <>
      <style href="fs-live-tape" precedence="medium">
        {CSS}
      </style>
      <div className="fsl-tape" ref={hostRef} data-aligned={aligned} aria-hidden="true">
        <div className="fsl-tape__dead" style={{ width: deadWidth, marginLeft: deadOffset }} />
        <div className="fsl-tape__track" ref={trackRef}>
          {[-1, 0, 1].map((copy) =>
            TICKS.map((tick) => {
              // calc() needs an explicit sign, not "+ -50%".
              const pct = ((tick.deg + copy * 360) / SPAN) * 100
              const left = `calc(50% ${pct < 0 ? '-' : '+'} ${Math.abs(pct)}%)`
              return (
                <div key={`${copy}:${tick.deg}`}>
                  <span
                    className="fsl-tape__tick"
                    data-major={tick.major}
                    style={{ left, height: tick.major ? 14 : 8 }}
                  />
                  {tick.cardinal ? (
                    <span className="fsl-tape__cardinal" style={{ left }}>
                      {tick.cardinal}
                    </span>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
        {calibrated ? (
          <div className="fsl-tape__target" ref={markerRef} style={{ left: '50%' }} />
        ) : null}
        <div className="fsl-tape__caret" />
      </div>
    </>
  )
}
