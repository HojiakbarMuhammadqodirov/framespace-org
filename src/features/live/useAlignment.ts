import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { normalizeDeg, signedDelta } from './orientation'
import type { LiveOrientation, LiveReadout } from './useLiveOrientation'
import type { PanoramaPlan } from './renders'

/**
 * Calibration: tying the room's zero to a direction in the real world.
 *
 * No heading was recorded when the photographs were taken (`/api/render` has
 * no metadata fields — see docs/API-INVENTORY.md §4), so the anchor cannot be
 * recovered from the project. It is set by the person instead: stand where you
 * shot from, face the front wall, press. That direction becomes room yaw 0.
 *
 * ## The one equation
 *
 * The sphere is textured so that a sector's centre sits at world azimuth
 * `roomYaw + halfSector`. The camera is `yaw(-kappa) · device`, which shifts
 * the device azimuth by `-kappa`. Putting those together:
 *
 *     roomYaw = azimuth − anchorAzimuth − nudge + anchorYaw
 *     kappa   = anchorAzimuth + nudge − anchorYaw − halfSector
 *
 * At the moment of calibration `azimuth = anchorAzimuth` and `nudge = 0`, so
 * `roomYaw = anchorYaw` — the front wall is dead ahead. Which is the whole
 * point.
 *
 * ## Why Nudge exists
 *
 * An indoor magnetometer is out by 10–15° routinely and much worse beside a
 * radiator, a steel door frame or a wall of wiring. No amount of maths fixes
 * that; the only honest answer is a manual offset the person can drag until
 * the room lines up with the room. `nudge` is that offset, and it is the one
 * calibration value worth persisting.
 */

const STORE_KEY = 'framespace.live.align.v1'

/** Brief §9: Start unlocks inside ~10° of heading and ~10° of pitch. */
export const HEADING_TOLERANCE = 10
export const PITCH_TOLERANCE = 10

interface StoredAlignment {
  nudge: number
  /** Only meaningful when the device reports a north-referenced frame. */
  anchorHeading?: number
}

function readStore(): Record<string, StoredAlignment> {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, StoredAlignment>) : {}
  } catch {
    return {}
  }
}

function writeStore(next: Record<string, StoredAlignment>) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next))
  } catch {
    // Private mode. The calibration just will not survive a reload.
  }
}

export interface Alignment {
  calibrated: boolean
  /** Manual offset in degrees, positive turns the room clockwise. */
  nudge: number
  /** Compass heading you must face to see the anchor wall. */
  targetHeading: number
  /** Signed heading error, degrees. Negative means turn left. */
  headingDelta: number
  /** Signed pitch error, degrees. Negative means raise the phone. */
  pitchDelta: number
  aligned: boolean
  /** The `kappa` above, read every frame by the sphere. Never re-renders. */
  kappa: { current: number }
  /** Target heading, mirrored into a ref for the 60fps tape. */
  target: { current: number }
  calibrate: () => void
  setNudge: (deg: number) => void
  nudgeBy: (deg: number) => void
  reset: () => void
}

export function useAlignment(
  projectId: string,
  orientation: LiveOrientation,
  readout: LiveReadout,
  plan: PanoramaPlan | null
): Alignment {
  const stored = useMemo(() => readStore()[projectId] ?? { nudge: 0 }, [projectId])

  const [nudge, setNudgeState] = useState(() => stored.nudge ?? 0)
  const [anchorAzimuth, setAnchorAzimuth] = useState<number | null>(null)
  const [anchorHeading, setAnchorHeading] = useState<number | null>(
    typeof stored.anchorHeading === 'number' ? stored.anchorHeading : null
  )

  const kappa = useRef(0)
  const target = useRef(0)
  const restored = useRef(false)
  const nudgeRef = useRef(nudge)
  nudgeRef.current = nudge

  const anchorYaw = plan?.anchorYaw ?? 0
  const halfSector = plan?.halfSector ?? 45

  /* Re-derive the stored anchor once a north-referenced reading arrives. The
     stored value is a compass heading, which survives a reload; the azimuth it
     corresponds to does not, because a relative alpha origin is re-randomised
     on every session. */
  useEffect(() => {
    if (restored.current || anchorAzimuth != null) return
    if (anchorHeading == null || !readout.live) return
    if (readout.headingSource !== 'absolute' && readout.headingSource !== 'compass') return
    restored.current = true
    const f = orientation.frame.current
    setAnchorAzimuth(f.azimuth + signedDelta(anchorHeading, f.heading))
  }, [anchorHeading, anchorAzimuth, readout.live, readout.headingSource, orientation])

  /* kappa and the target are refs, not state: they are read inside the render
     loop at 60fps and must never cause a React update. */
  useEffect(() => {
    kappa.current = (anchorAzimuth ?? 0) + nudge - anchorYaw - halfSector
    target.current = normalizeDeg((anchorHeading ?? 0) + nudge)
  }, [anchorAzimuth, anchorHeading, nudge, anchorYaw, halfSector])

  const persist = useCallback(
    (next: StoredAlignment) => {
      const store = readStore()
      store[projectId] = next
      writeStore(store)
    },
    [projectId]
  )

  const calibrate = useCallback(() => {
    const f = orientation.frame.current
    if (!f.live) return
    setAnchorAzimuth(f.azimuth)
    setAnchorHeading(f.heading)
    setNudgeState(0)
    restored.current = true
    persist({
      nudge: 0,
      anchorHeading: f.headingSource === 'relative' ? undefined : f.heading,
    })
  }, [orientation, persist])

  const setNudge = useCallback(
    (deg: number) => {
      const clamped = Math.max(-180, Math.min(180, deg))
      setNudgeState(clamped)
      persist({ nudge: clamped, anchorHeading: anchorHeading ?? undefined })
    },
    [persist, anchorHeading]
  )

  const nudgeBy = useCallback((deg: number) => setNudge(nudgeRef.current + deg), [setNudge])

  const reset = useCallback(() => {
    setAnchorAzimuth(null)
    setAnchorHeading(null)
    setNudgeState(0)
    restored.current = false
    persist({ nudge: 0 })
  }, [persist])

  const calibrated = anchorAzimuth != null
  const targetHeading = normalizeDeg((anchorHeading ?? 0) + nudge)
  const headingDelta = calibrated ? signedDelta(readout.heading, targetHeading) : 0
  const pitchDelta = readout.pitch
  const aligned =
    calibrated &&
    readout.live &&
    Math.abs(headingDelta) <= HEADING_TOLERANCE &&
    Math.abs(pitchDelta) <= PITCH_TOLERANCE

  return {
    calibrated,
    nudge,
    targetHeading,
    headingDelta,
    pitchDelta,
    aligned,
    kappa,
    target,
    calibrate,
    setNudge,
    nudgeBy,
    reset,
  }
}
