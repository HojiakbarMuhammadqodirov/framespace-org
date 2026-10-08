import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Quaternion } from 'three'

import {
  azimuthOf,
  deviceQuaternion,
  headingFromAzimuth,
  normalizeDeg,
  pitchOf,
  rollOf,
  smoothing,
} from './orientation'
import type { HeadingSource, LiveFrame, MotionPermission } from './types'

/**
 * The sensor. One listener, one rAF loop, one mutable frame.
 *
 * Two deliberate decisions:
 *
 * • Nothing here goes into React state at event rate. `frame` is a ref that is
 *   mutated in place; consumers that need 60fps (the sphere, the heading tape,
 *   the bubble) subscribe and write straight to `style.transform`. Only the
 *   mono read-outs and the lock gate re-render, at 8Hz, from `useLiveReadout`.
 *
 * • The raw reading is slerped, not used directly. Phone magnetometers are
 *   noisy enough that an unsmoothed panorama visibly shivers; a ~70ms time
 *   constant removes that without adding lag you can feel.
 */

/** Seconds. Small enough to feel direct, large enough to kill sensor jitter. */
const TAU = 0.07
/** After this long with no event, we stop claiming the reading is live. */
const STALE_MS = 1200

type OrientationEventLike = DeviceOrientationEvent & {
  webkitCompassHeading?: number
  webkitCompassAccuracy?: number
}

type PermissionCapableCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>
}

export interface LiveOrientation {
  /** Mutated in place. Never render from this directly. */
  frame: { current: LiveFrame }
  permission: MotionPermission
  /** True when `requestPermission` exists — iOS, and only inside a tap. */
  needsPermission: boolean
  supported: boolean
  /** MUST be called synchronously from a user gesture handler on iOS. */
  request: () => Promise<MotionPermission>
  stop: () => void
  /** Called once per animation frame with the smoothed frame. */
  subscribe: (fn: (frame: LiveFrame) => void) => () => void
}

function emptyFrame(): LiveFrame {
  return {
    quaternion: new Quaternion(),
    live: false,
    at: 0,
    azimuth: 0,
    heading: 0,
    headingSource: 'none',
    pitch: 0,
    roll: 0,
    screenAngle: 0,
  }
}

function screenAngle(): number {
  if (typeof window === 'undefined') return 0
  const fromApi = window.screen?.orientation?.angle
  if (typeof fromApi === 'number') return fromApi
  // Deprecated, but it is the only reading old Android WebViews have.
  const legacy = (window as unknown as { orientation?: number }).orientation
  return typeof legacy === 'number' ? legacy : 0
}

export function useLiveOrientation(enabled = true): LiveOrientation {
  const frame = useRef<LiveFrame>(emptyFrame())
  const raw = useRef(new Quaternion())
  /** The frame owns the smoothed quaternion; this is just a named alias. */
  const smooth = useRef(frame.current.quaternion)
  const started = useRef(false)
  const subscribers = useRef(new Set<(f: LiveFrame) => void>())
  const detach = useRef<(() => void) | null>(null)
  const compassRef = useRef<number | null>(null)

  const supported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
  const needsPermission =
    supported &&
    typeof (window.DeviceOrientationEvent as PermissionCapableCtor).requestPermission === 'function'

  const [permission, setPermission] = useState<MotionPermission>(() => {
    if (typeof window === 'undefined') return 'idle'
    if (!window.isSecureContext) return 'insecure'
    if (!('DeviceOrientationEvent' in window)) return 'unsupported'
    return needsPermissionSync() ? 'idle' : 'granted'
  })

  function needsPermissionSync() {
    return (
      typeof (window.DeviceOrientationEvent as PermissionCapableCtor)?.requestPermission ===
      'function'
    )
  }

  /* ------------------------------------------------------------- listeners */

  const attach = useCallback(() => {
    if (started.current || typeof window === 'undefined') return
    started.current = true

    const onEvent = (event: Event) => {
      const e = event as OrientationEventLike
      if (e.alpha == null && e.beta == null && e.gamma == null) return

      const angle = screenAngle()
      deviceQuaternion(raw.current, e.alpha ?? 0, e.beta ?? 0, e.gamma ?? 0, angle)

      const f = frame.current
      f.at = performance.now()
      f.screenAngle = angle

      // Heading source, best first. iOS never reports `absolute` but does give
      // a true compass heading; Android reports `absolute` on the dedicated
      // event and, on some builds, on the plain one too.
      const compass = e.webkitCompassHeading
      const hasCompass = typeof compass === 'number' && Number.isFinite(compass)
      if (event.type === 'deviceorientationabsolute' || e.absolute === true) {
        f.headingSource = 'absolute'
        compassRef.current = null
      } else if (hasCompass) {
        f.headingSource = 'compass'
        compassRef.current = compass as number
      } else if (f.headingSource !== 'absolute') {
        // A compass that stops reporting is worse than no compass: downgrade
        // rather than keep showing the last good bearing forever.
        f.headingSource = 'relative'
        compassRef.current = null
      }

      if (!f.live) {
        // First reading: snap rather than slerp in from an arbitrary identity,
        // which would swing the whole room through 180° on entry.
        smooth.current.copy(raw.current)
        f.live = true
      }
    }

    // The absolute event is north-referenced where it exists, which is what we
    // want; the plain one is the universal fallback. Both may fire — the
    // handler prefers whichever reports the better frame.
    window.addEventListener('deviceorientationabsolute', onEvent, true)
    window.addEventListener('deviceorientation', onEvent, true)
    detach.current = () => {
      window.removeEventListener('deviceorientationabsolute', onEvent, true)
      window.removeEventListener('deviceorientation', onEvent, true)
      started.current = false
    }
  }, [])

  const request = useCallback(async (): Promise<MotionPermission> => {
    if (typeof window === 'undefined') return 'unsupported'
    if (!window.isSecureContext) {
      setPermission('insecure')
      return 'insecure'
    }
    if (!('DeviceOrientationEvent' in window)) {
      setPermission('unsupported')
      return 'unsupported'
    }

    const ctor = window.DeviceOrientationEvent as PermissionCapableCtor
    if (typeof ctor.requestPermission !== 'function') {
      attach()
      setPermission('granted')
      return 'granted'
    }

    setPermission('requesting')
    try {
      // iOS: this promise is only honoured when the call originates inside the
      // user's tap handler. Anything awaited before it silently denies.
      const result = await ctor.requestPermission()
      if (result === 'granted') {
        attach()
        setPermission('granted')
        return 'granted'
      }
      setPermission('denied')
      return 'denied'
    } catch {
      setPermission('denied')
      return 'denied'
    }
  }, [attach])

  const stop = useCallback(() => {
    detach.current?.()
    detach.current = null
    frame.current.live = false
  }, [])

  /* Non-iOS: no gesture is needed, so attach as soon as the screen mounts. */
  useEffect(() => {
    if (!enabled) return
    if (permission === 'granted') attach()
    return () => {
      detach.current?.()
      detach.current = null
    }
  }, [enabled, permission, attach])

  /* ------------------------------------------------------------- the loop */

  useEffect(() => {
    if (!enabled) return
    let id = 0
    let last = performance.now()

    const tick = (now: number) => {
      id = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now

      const f = frame.current
      if (f.live && now - f.at > STALE_MS) f.live = false

      if (f.live) {
        smooth.current.slerp(raw.current, smoothing(dt, TAU))
        f.azimuth = azimuthOf(smooth.current)
        f.pitch = pitchOf(smooth.current)
        f.roll = rollOf(smooth.current)
        f.heading =
          f.headingSource === 'compass' && compassRef.current != null
            ? normalizeDeg(compassRef.current)
            : headingFromAzimuth(f.azimuth)
      }

      for (const fn of subscribers.current) fn(f)
    }

    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [enabled])

  const subscribe = useCallback((fn: (f: LiveFrame) => void) => {
    subscribers.current.add(fn)
    return () => {
      subscribers.current.delete(fn)
    }
  }, [])

  return useMemo(
    () => ({ frame, permission, needsPermission, supported, request, stop, subscribe }),
    [permission, needsPermission, supported, request, stop, subscribe]
  )
}

export interface LiveReadout {
  live: boolean
  heading: number
  headingSource: HeadingSource
  pitch: number
  roll: number
}

/**
 * A low-rate mirror of the frame, for the parts of the chrome that are text.
 *
 * 8Hz is the honest rate for a number a human reads: fast enough to feel
 * responsive, slow enough that `114°` does not flicker between two values.
 */
export function useLiveReadout(orientation: LiveOrientation, hz = 8): LiveReadout {
  const [readout, setReadout] = useState<LiveReadout>({
    live: false,
    heading: 0,
    headingSource: 'none',
    pitch: 0,
    roll: 0,
  })

  useEffect(() => {
    const period = 1000 / hz
    let last = 0
    return orientation.subscribe((f) => {
      const now = performance.now()
      if (now - last < period) return
      last = now
      setReadout((prev) => {
        const heading = Math.round(f.heading)
        const pitch = Math.round(f.pitch)
        const roll = Math.round(f.roll)
        if (
          prev.live === f.live &&
          prev.heading === heading &&
          prev.pitch === pitch &&
          prev.roll === roll &&
          prev.headingSource === f.headingSource
        ) {
          return prev
        }
        return { live: f.live, heading, headingSource: f.headingSource, pitch, roll }
      })
    })
  }, [orientation, hz])

  return readout
}
