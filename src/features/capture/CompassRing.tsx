/**
 * The compass ring, brief §6.3.
 *
 * The first shot sets the anchor; every other target sits at a fixed bearing
 * from it (`yaw` on the shared angle plan). The ring counter-rotates with the
 * phone so the target you are currently hunting climbs to the top of the dial,
 * and each mark fills in as its photo is taken.
 *
 * With no usable compass — an old Android, a denied prompt, a desktop browser —
 * the same dial renders static and simply shows the plan and what is done. It
 * never pretends to a bearing it does not have.
 */
import { bearingDelta } from './quality'
import type { Angle } from './contract'
import type { SensorSource } from './types'

const CSS = `
.cap-compass { position: relative; display: grid; place-items: center; }
.cap-compass__svg { width: 100%; height: auto; overflow: visible; }
.cap-compass__dial { transition: none; }
.cap-compass__mark { transition: opacity var(--d-base) var(--ease); }
.cap-compass__hud {
  position: absolute;
  display: grid;
  justify-items: center;
  gap: 2px;
  pointer-events: none;
}
.cap-compass__delta {
  font-family: var(--font-mono);
  font-size: var(--step-1);
  letter-spacing: 0.04em;
  color: var(--text-strong);
  line-height: 1;
}
.cap-compass__hint {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.cap-compass[data-aligned='true'] .cap-compass__delta { color: var(--ok); }
.cap-compass__pulse { animation: cap-pulse 2200ms var(--ease) infinite; transform-origin: center; }
@keyframes cap-pulse {
  0%, 100% { transform: scale(1); opacity: 0.55; }
  50% { transform: scale(1.06); opacity: 0.9; }
}
@media (prefers-reduced-motion: reduce) {
  .cap-compass__pulse { animation: none; }
}
`

const R = 78
const CENTRE = 100

function point(bearingDeg: number, radius: number) {
  const rad = ((bearingDeg - 90) * Math.PI) / 180
  return { x: CENTRE + radius * Math.cos(rad), y: CENTRE + radius * Math.sin(rad) }
}

export type CompassProps = {
  plan: Angle[]
  captured: string[]
  activeId: string
  /** Current heading minus the anchor heading, or `null` with no compass. */
  relativeHeading: number | null
  /** Camera pitch relative to the horizon: negative looks down. */
  cameraPitch: number | null
  source: SensorSource
  /** Degrees of slack before a target counts as lined up. */
  tolerance?: number
  labels: { align: string; left: string; right: string; noCompass: string }
  size?: number
}

export function CompassRing({
  plan,
  captured,
  activeId,
  relativeHeading,
  cameraPitch,
  source,
  tolerance = 12,
  labels,
  size = 200,
}: CompassProps) {
  const live = relativeHeading != null && source !== 'none'
  const active = plan.find((a) => a.id === activeId)
  const delta = live && active ? bearingDelta(active.yaw, relativeHeading as number) : null
  const aligned = delta != null && Math.abs(delta) <= tolerance
  const spin = live ? -(relativeHeading as number) : active ? -active.yaw : 0

  const ticks = Array.from({ length: 24 }, (_, i) => i * 15)

  return (
    <div className="cap-compass" data-aligned={aligned} style={{ width: size, height: size }}>
      <style href="fs-cap-compass" precedence="medium">
        {CSS}
      </style>

      <svg
        className="cap-compass__svg"
        viewBox="0 0 200 200"
        role="img"
        aria-label={`${captured.length}/${plan.length}`}
      >
        {/* The dial turns with the room, not with the phone. */}
        <g
          className="cap-compass__dial"
          style={{ transform: `rotate(${spin}deg)`, transformOrigin: '100px 100px' }}
        >
          <circle
            cx={CENTRE}
            cy={CENTRE}
            r={R}
            fill="none"
            stroke="var(--hairline)"
            strokeWidth="1"
            strokeDasharray="1 5"
          />
          {ticks.map((deg) => {
            const outer = point(deg, R)
            const inner = point(deg, deg % 90 === 0 ? R - 8 : R - 4)
            return (
              <line
                key={deg}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="var(--border-strong)"
                strokeWidth={deg % 90 === 0 ? 1.4 : 0.8}
                opacity={deg % 90 === 0 ? 0.9 : 0.45}
              />
            )
          })}

          {plan.map((angle) => {
            const done = captured.includes(angle.id)
            const isActive = angle.id === activeId
            const at = point(angle.yaw, R)
            return (
              <g key={angle.id} className="cap-compass__mark">
                {isActive && !done && (
                  <circle
                    className="cap-compass__pulse"
                    cx={at.x}
                    cy={at.y}
                    r={15}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="1"
                  />
                )}
                <circle
                  cx={at.x}
                  cy={at.y}
                  r={isActive ? 12 : 9}
                  fill={done ? 'var(--accent)' : 'var(--bg-raised)'}
                  stroke={done ? 'var(--accent)' : isActive ? 'var(--accent)' : 'var(--border-strong)'}
                  strokeWidth={isActive ? 1.6 : 1}
                />
                {done && (
                  <path
                    d={`M${at.x - 3.6} ${at.y} L${at.x - 1} ${at.y + 2.6} L${at.x + 3.8} ${at.y - 2.8}`}
                    fill="none"
                    stroke="var(--paper)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {!done && !angle.required && (
                  <circle cx={at.x} cy={at.y} r={2} fill="var(--text-muted)" opacity="0.6" />
                )}
              </g>
            )
          })}
        </g>

        {/* Fixed needle: where the phone is looking, always straight up. */}
        <path
          d={`M${CENTRE} ${CENTRE - R - 10} l6 11 h-12 z`}
          fill={aligned ? 'var(--ok)' : 'var(--accent)'}
          opacity={live ? 1 : 0.35}
        />
        <line
          x1={CENTRE}
          y1={CENTRE - R + 2}
          x2={CENTRE}
          y2={CENTRE - R + 16}
          stroke={aligned ? 'var(--ok)' : 'var(--accent)'}
          strokeWidth="1.2"
          opacity={live ? 0.8 : 0.25}
        />

        {/* Level bubble: a hairline that tips with the phone. */}
        {cameraPitch != null && (
          <g opacity="0.75">
            <line
              x1={CENTRE - 26}
              y1={CENTRE + 34}
              x2={CENTRE + 26}
              y2={CENTRE + 34}
              stroke="var(--hairline)"
              strokeWidth="1"
            />
            <line
              x1={CENTRE - 20}
              y1={CENTRE + 34 - Math.max(-14, Math.min(14, cameraPitch / 3))}
              x2={CENTRE + 20}
              y2={CENTRE + 34 + Math.max(-14, Math.min(14, cameraPitch / 3))}
              stroke={Math.abs(cameraPitch) < 12 ? 'var(--ok)' : 'var(--clay-300)'}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>

      <div className="cap-compass__hud">
        {live && delta != null ? (
          <>
            <span className="cap-compass__delta">{`${Math.round(Math.abs(delta))}°`}</span>
            <span className="cap-compass__hint">
              {aligned ? labels.align : delta > 0 ? labels.right : labels.left}
            </span>
          </>
        ) : (
          <span className="cap-compass__hint">{labels.noCompass}</span>
        )}
      </div>
    </div>
  )
}
