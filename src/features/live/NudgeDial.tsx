import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatSigned } from './orientation'
import { GlyphChevron, IconButton, Readout } from './Chrome'

/**
 * Manual heading offset — a knurled strip you drag.
 *
 * This control exists because the physics do not cooperate. An indoor
 * magnetometer reads 10–15° off routinely, and beside a radiator, a steel door
 * frame or a wall of wiring it is worse and it is not even consistently worse.
 * No filtering fixes a biased field. So: one offset, dragged by hand, until
 * the room on the screen matches the room in front of you.
 *
 * Pointer Events (not touch) so a stylus and a desktop drag both work, with
 * `setPointerCapture` so the drag survives leaving the strip, and
 * `touch-action: none` so the page never scrolls underneath it.
 */

/** Degrees per CSS pixel of drag. One full strip ≈ 40°. */
const SENSITIVITY = 0.18

const CSS = `
.fsl-nudge {
  display: grid;
  grid-template-columns: var(--tap) 1fr var(--tap);
  align-items: center;
  gap: var(--s2);
}
.fsl-nudge__strip {
  position: relative;
  height: var(--tap);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--clay-900) 30%, transparent);
  box-shadow: inset 0 0 0 1px var(--bezel-ring), var(--inset-hi);
  overflow: hidden;
  touch-action: none;
  cursor: ew-resize;
  -webkit-mask-image: linear-gradient(90deg, transparent, black 16%, black 84%, transparent);
  mask-image: linear-gradient(90deg, transparent, black 16%, black 84%, transparent);
  transition: box-shadow var(--d-fast) var(--ease);
}
.fsl-nudge__strip[data-dragging='true'] {
  box-shadow: inset 0 0 0 1px var(--accent), var(--inset-hi);
}
.fsl-nudge__knurl {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    90deg,
    var(--hairline) 0 1px,
    transparent 1px 8px
  );
  will-change: transform;
}
.fsl-nudge__zero {
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 50%;
  width: 1px;
  margin-left: -0.5px;
  background: var(--accent);
}
`

export interface NudgeDialProps {
  value: number
  onChange: (deg: number) => void
  onStep: (deg: number) => void
  label: string
}

export function NudgeDial({ value, onChange, onStep, label }: NudgeDialProps) {
  const { t } = useTranslation()
  const stripRef = useRef<HTMLDivElement>(null)
  const knurlRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x: number; from: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const knurl = knurlRef.current
    if (!knurl) return
    // 8px per knurl line; wrap so the strip reads as endless.
    knurl.style.transform = `translate3d(${(((-value / SENSITIVITY) % 8) + 8) % 8}px, 0, 0)`
  }, [value])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const strip = stripRef.current
      if (!strip) return
      strip.setPointerCapture(event.pointerId)
      drag.current = { id: event.pointerId, x: event.clientX, from: value }
      setDragging(true)
    },
    [value]
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const state = drag.current
      if (!state || state.id !== event.pointerId) return
      event.preventDefault()
      onChange(state.from + (event.clientX - state.x) * SENSITIVITY)
    },
    [onChange]
  )

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return
    drag.current = null
    setDragging(false)
    stripRef.current?.releasePointerCapture?.(event.pointerId)
  }, [])

  return (
    <>
      <style href="fs-live-nudge" precedence="medium">
        {CSS}
      </style>
      <div className="fsl-nudge">
        <IconButton label={t('live.align.nudgeLeft')} onClick={() => onStep(-1)}>
          <GlyphChevron direction="left" />
        </IconButton>

        <div
          ref={stripRef}
          className="fsl-nudge__strip"
          data-dragging={dragging}
          role="slider"
          aria-label={label}
          aria-valuenow={Math.round(value)}
          aria-valuemin={-180}
          aria-valuemax={180}
          aria-valuetext={formatSigned(value)}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault()
              onStep(-1)
            }
            if (event.key === 'ArrowRight') {
              event.preventDefault()
              onStep(1)
            }
          }}
        >
          <div className="fsl-nudge__knurl" ref={knurlRef} />
          <span className="fsl-nudge__zero" />
        </div>

        <IconButton label={t('live.align.nudgeRight')} onClick={() => onStep(1)}>
          <GlyphChevron direction="right" />
        </IconButton>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--s2)' }}>
        <Readout
          label={t('live.align.nudge')}
          value={formatSigned(value)}
          tone={Math.abs(value) > 0.5 ? 'accent' : 'default'}
          align="center"
        />
      </div>
    </>
  )
}
