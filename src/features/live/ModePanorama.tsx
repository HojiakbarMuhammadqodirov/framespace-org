import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { invalidate } from '@react-three/fiber'

import { SceneCanvas, usePrefersReducedMotion } from '@/three/Canvas'
import { AlignmentDeck } from './AlignmentDeck'
import { Cluster, GlyphGhost, IconButton } from './Chrome'
import { GhostAnchor } from './GhostAnchor'
import { LiveNotice } from './LiveNotice'
import {
  DEFAULT_FOV,
  MAX_FOV,
  MIN_FOV,
  PanoramaSphere,
  type ManualLook,
} from './PanoramaSphere'
import { clamp } from './orientation'
import { anchorGhost, type PanoramaPlan } from './renders'
import type { EquirectResult } from './useEquirect'
import { useAlignment } from './useAlignment'
import type { LiveOrientation, LiveReadout } from './useLiveOrientation'
import type { LiveProject } from './types'

/**
 * MODE C — the gyroscope panorama. The one that works everywhere and offline.
 *
 * Built first and built completely, because it is the only one of the three
 * that needs nothing but the renders already on the device: no session token,
 * no WebXR, no network. Everything else on this screen degrades down to here.
 *
 * The pipeline, end to end:
 *
 *   renders → planPanorama (sort by yaw, reject an uneven set)
 *           → buildEquirect (frozen; 4096 × 2048, cross-faded by sector)
 *           → CanvasTexture on the inside of a sphere
 *           → camera = yaw(−kappa) · deviceQuaternion, slerped
 *
 * With no gyroscope the sphere stays and the finger takes over. That is a
 * genuinely useful fallback — you still get to look around the room — so it is
 * offered rather than refused, with the alignment chrome switched off because
 * there is nothing to align to. It is also what a desktop gets: drag to look,
 * wheel or pinch to zoom, arrow keys in 10° steps, and a light glide after a
 * fling. A small chip says "drag" until the first drag, then gets out of the way.
 *
 * Manual mode renders on demand; only the gyroscope needs every frame.
 */

/** Degrees of look per pixel of drag at the default zoom. */
const DRAG_GAIN = 0.16
/** Arrow-key step, degrees. */
const KEY_STEP = 10

const CSS = `
.fsl-pano {
  position: fixed;
  inset: 0;
  height: 100dvh;
  background: var(--bg-inverse);
  overflow: hidden;
  touch-action: none;
}
.fsl-pano__canvas { position: absolute; inset: 0; }
.fsl-pano__canvas canvas { display: block; }
.fsl-pano__building {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  gap: var(--s4);
  padding: var(--gutter);
  text-align: center;
}
.fsl-pano__buildingBar {
  width: min(280px, 70vw);
  height: 2px;
  margin-inline: auto;
  background: var(--hairline);
  overflow: hidden;
}
.fsl-pano__buildingBar span {
  display: block;
  height: 100%;
  width: 40%;
  background: var(--accent);
  animation: fsl-sweep 1400ms var(--ease) infinite;
}
@keyframes fsl-sweep {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
@media (prefers-reduced-motion: reduce) {
  .fsl-pano__buildingBar span { animation: none; width: 100%; opacity: 0.4; }
}
.fsl-pano__scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: color-mix(in srgb, var(--clay-900) 46%, transparent);
  opacity: 1;
  transition: opacity var(--d-slow) var(--ease);
}
.fsl-pano[data-running='true'] .fsl-pano__scrim { opacity: 0; }
.fsl-pano__note {
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  padding: var(--s2) var(--s4);
}
.fsl-pano__hint {
  position: absolute;
  left: 50%;
  bottom: calc(var(--s8) + env(safe-area-inset-bottom, 0px));
  z-index: 2;
  transform: translateX(-50%);
  pointer-events: none;
  transition: opacity var(--d-slow) var(--ease);
}
.fsl-pano__hint[data-hidden='true'] { opacity: 0; }
.fsl-pano__hintText {
  margin: 0;
  padding: var(--s2) var(--s4);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--text-muted);
}
`

export interface ModePanoramaProps {
  project: LiveProject | null
  projectId: string
  plan: PanoramaPlan
  orientation: LiveOrientation
  readout: LiveReadout
  /** False when there is no gyroscope, or permission was refused. */
  gyro: boolean
  webgl: boolean
  /** The stitched panorama, built by the parent so it survives mode switches. */
  equirect: EquirectResult
  onExit: () => void
  /** Rendered over the view — the top bar comes from the parent. */
  children?: React.ReactNode
}

export function ModePanorama({
  project,
  projectId,
  plan,
  orientation,
  readout,
  gyro,
  webgl,
  equirect,
  onExit,
  children,
}: ModePanoramaProps) {
  const { t } = useTranslation()
  const alignment = useAlignment(projectId, orientation, readout, plan)
  const reduced = usePrefersReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)

  const [running, setRunning] = useState(false)
  const [ghost, setGhost] = useState(true)
  const [dragged, setDragged] = useState(false)
  const manual = useRef<ManualLook>({ yaw: 0, pitch: 0, fov: DEFAULT_FOV, vyaw: 0, vpitch: 0 })
  const drag = useRef<{
    id: number
    x: number
    y: number
    yaw: number
    pitch: number
    lastX: number
    lastY: number
    lastT: number
  } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; fov: number } | null>(null)

  const anchor = anchorGhost(project, plan.anchorAngleId)

  /* The ghost is a guide, not decoration: once you are inside tolerance it has
     done its job and would only sit between you and the render. It fades out
     on its own, and the toggle brings it back. */
  const [ghostPinned, setGhostPinned] = useState(false)
  useEffect(() => {
    if (ghostPinned) return
    if (alignment.aligned && running) setGhost(false)
    if (!running) setGhost(true)
  }, [alignment.aligned, running, ghostPinned])

  const gyroRef = useRef(gyro)
  gyroRef.current = gyro

  /** Zoomed in, a pixel of drag should turn the view less. */
  const gain = () => DRAG_GAIN * ((manual.current.fov ?? DEFAULT_FOV) / DEFAULT_FOV)

  const startDrag = (id: number, x: number, y: number) => {
    const look = manual.current
    look.vyaw = 0
    look.vpitch = 0
    look.dragging = true
    drag.current = {
      id,
      x,
      y,
      yaw: look.yaw,
      pitch: look.pitch,
      lastX: x,
      lastY: y,
      lastT: performance.now(),
    }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (gyroRef.current) return
    // A drag that starts on a control is that control's, not the camera's.
    if ((event.target as HTMLElement | null)?.closest('.fsl-cluster, button, a')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.current.size === 2) {
      // Second finger: the gesture becomes a pinch, and the look holds still.
      const [a, b] = Array.from(pointers.current.values())
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        fov: manual.current.fov ?? DEFAULT_FOV,
      }
      drag.current = null
      manual.current.dragging = true
      return
    }
    startDrag(event.pointerId, event.clientX, event.clientY)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = Array.from(pointers.current.values())
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      manual.current.fov = clamp((pinch.current.fov * pinch.current.dist) / dist, MIN_FOV, MAX_FOV)
      invalidate()
      return
    }

    const state = drag.current
    if (!state || state.id !== event.pointerId) return
    const k = gain()
    const look = manual.current
    look.yaw = state.yaw - (event.clientX - state.x) * k
    look.pitch = clamp(state.pitch - (event.clientY - state.y) * k, -80, 80)

    // Track the fling velocity (deg/s), lightly smoothed against jitter.
    const now = performance.now()
    const dt = Math.max(1, now - state.lastT) / 1000
    const vyaw = (-(event.clientX - state.lastX) * k) / dt
    const vpitch = (-(event.clientY - state.lastY) * k) / dt
    look.vyaw = (look.vyaw ?? 0) * 0.6 + vyaw * 0.4
    look.vpitch = (look.vpitch ?? 0) * 0.6 + vpitch * 0.4
    state.lastX = event.clientX
    state.lastY = event.clientY
    state.lastT = now

    if (!dragged && Math.hypot(event.clientX - state.x, event.clientY - state.y) > 4) {
      setDragged(true)
    }
    invalidate()
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null
      // The finger left on the glass carries on as a fresh drag.
      const rest = Array.from(pointers.current.entries())[0]
      if (rest) startDrag(rest[0], rest[1].x, rest[1].y)
      else manual.current.dragging = false
      return
    }
    const state = drag.current
    if (state?.id !== event.pointerId) return
    drag.current = null
    const look = manual.current
    look.dragging = false
    // A finger that stopped before lifting means "stay here", not "fling".
    if (reduced || performance.now() - state.lastT > 80) {
      look.vyaw = 0
      look.vpitch = 0
    }
    invalidate()
  }

  // Wheel zoom. Native and non-passive, so the page itself never scrolls.
  useEffect(() => {
    const root = rootRef.current
    if (!root || gyro) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const look = manual.current
      look.fov = clamp((look.fov ?? DEFAULT_FOV) + event.deltaY * 0.04, MIN_FOV, MAX_FOV)
      invalidate()
    }
    root.addEventListener('wheel', onWheel, { passive: false })
    return () => root.removeEventListener('wheel', onWheel)
  }, [gyro])

  // Arrow keys look around in 10° steps, unless a control has the arrows.
  useEffect(() => {
    if (gyro) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement | null
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="radiogroup"], [role="tablist"], [role="slider"], [role="menu"], [role="listbox"]'
        )
      ) {
        return
      }
      const look = manual.current
      let handled = true
      if (event.key === 'ArrowLeft') look.yaw -= KEY_STEP
      else if (event.key === 'ArrowRight') look.yaw += KEY_STEP
      else if (event.key === 'ArrowUp') look.pitch = clamp(look.pitch + KEY_STEP, -80, 80)
      else if (event.key === 'ArrowDown') look.pitch = clamp(look.pitch - KEY_STEP, -80, 80)
      else handled = false
      if (!handled) return
      event.preventDefault()
      look.vyaw = 0
      look.vpitch = 0
      setDragged(true)
      invalidate()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gyro])

  if (!webgl) {
    return (
      <LiveNotice
        code="WEBGL"
        title={t('live.error.webgl.title')}
        body={t('live.error.webgl.body')}
        secondary={{ label: t('live.action.back'), onClick: onExit }}
      />
    )
  }

  if (equirect.status === 'error') {
    return (
      <LiveNotice
        code="PANORAMA"
        title={t('live.error.panorama.title')}
        body={t('live.error.panorama.body')}
        action={{ label: t('live.action.retry'), onClick: () => window.location.reload() }}
        secondary={{ label: t('live.action.back'), onClick: onExit }}
      />
    )
  }

  return (
    <div
      ref={rootRef}
      className="fsl-pano"
      data-running={running}
      data-lenis-prevent=""
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <style href="fs-live-pano" precedence="medium">
        {CSS}
      </style>

      {equirect.canvas ? (
        <SceneCanvas
          className="fsl-pano__canvas"
          shadows={false}
          rootMargin="0px"
          // The gyroscope moves every frame; a finger, a wheel or a key does not.
          frameloop={gyro ? 'always' : 'demand'}
          label={t('live.mode.c.name')}
        >
          <PanoramaSphere
            canvas={equirect.canvas}
            orientation={orientation}
            kappa={alignment.kappa}
            manual={manual}
            gyro={gyro}
          />
        </SceneCanvas>
      ) : (
        <div className="fsl-pano__building">
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: 'var(--tracking-mono)',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            {t('live.status.preparing')}
          </span>
          <div className="fsl-pano__buildingBar">
            <span />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--step--1)', maxWidth: '34ch' }}>
            {t('live.status.preparingBody')}
          </p>
        </div>
      )}

      {/* The scrim is what makes Start mean something: until you press it the
          room is held back behind a wash, with the ghost on top. Pressing lifts
          the wash and fades the ghost, and the whole view is just the room. */}
      {gyro ? <div className="fsl-pano__scrim" /> : null}

      <GhostAnchor src={anchor?.src ?? null} on={ghost && gyro} frame={!alignment.aligned} />

      {children}

      {!plan.even && (
        <div className="fsl-pano__note">
          <Cluster small quiet>
            <p
              style={{
                margin: 0,
                padding: 'var(--s2) var(--s4)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: 'var(--tracking-mono)',
                textTransform: 'uppercase',
                color: 'var(--warn-ink)',
              }}
            >
              {t('live.status.approx')}
            </p>
          </Cluster>
        </div>
      )}

      {gyro ? (
        <AlignmentDeck
          orientation={orientation}
          readout={readout}
          alignment={alignment}
          running={running}
          onStart={() => setRunning(true)}
          onStop={() => setRunning(false)}
          extras={
            anchor ? (
              <IconButton
                label={ghost ? t('live.align.ghostOff') : t('live.align.ghostOn')}
                pressed={ghost}
                onClick={() => {
                  setGhostPinned(true)
                  setGhost((on) => !on)
                }}
              >
                <GlyphGhost />
              </IconButton>
            ) : null
          }
        />
      ) : (
        <div className="fsl-pano__hint" data-hidden={dragged} aria-hidden={dragged}>
          <Cluster small quiet>
            <p className="fsl-pano__hintText">
              {t('live.panorama.dragHint', { defaultValue: 'Atrofga qarash uchun suring' })}
            </p>
          </Cluster>
        </div>
      )}
    </div>
  )
}
