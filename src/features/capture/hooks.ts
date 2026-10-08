/**
 * Device plumbing for the capture flow: the camera stream, the compass, the
 * network, and an elapsed-time counter for the honest waiting screen. Also two
 * small helpers the /app pages share: date formatting and the keyboard model
 * of a radio group.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { normalise } from './quality'
import type { Orientation, SensorSource } from './types'

/* ------------------------------------------------------------- sensors */

export type PermissionOutcome = 'granted' | 'denied' | 'unsupported'

type LegacyOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}
type LegacyMotionEvent = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

/**
 * iOS 13+ gates the compass behind a permission prompt that **only** works
 * when `requestPermission()` is called from inside the user's tap handler.
 *
 * That is why this function is not async at the top: the call itself happens
 * synchronously, before the first `await`, so it still sits inside the gesture.
 * Call it directly from `onClick` — never after an `await`, never in an effect.
 */
export function requestMotionPermission(): Promise<PermissionOutcome> {
  if (typeof window === 'undefined') return Promise.resolve('unsupported')

  const orientation = window.DeviceOrientationEvent as LegacyOrientationEvent | undefined
  const motion = window.DeviceMotionEvent as LegacyMotionEvent | undefined
  if (!orientation) return Promise.resolve('unsupported')

  // Android and desktop have no gate — listeners just work.
  if (typeof orientation.requestPermission !== 'function') return Promise.resolve('granted')

  // Both calls are made here, inside the gesture, before anything awaits.
  const orientationRequest = orientation.requestPermission()
  const motionRequest =
    motion && typeof motion.requestPermission === 'function'
      ? motion.requestPermission().catch(() => 'denied' as const)
      : Promise.resolve('granted' as const)

  return Promise.all([orientationRequest, motionRequest])
    .then(([o]) => (o === 'granted' ? 'granted' : 'denied'))
    .catch(() => 'denied' as PermissionOutcome)
}

const EMPTY: Orientation = { heading: null, pitch: null, roll: null, source: 'none' }

/**
 * Live heading / pitch / roll.
 *
 * iOS reports a true compass bearing on `webkitCompassHeading`; Android
 * reports `alpha` on `deviceorientationabsolute`, counter-clockwise from north,
 * hence `360 - alpha`. A relative-only `deviceorientation` is kept as a last
 * resort and labelled as such, so the UI can say the ring is approximate.
 *
 * Events arrive at 60 Hz. React does not need to re-render 60 times a second,
 * so the latest sample lives in a ref and is published roughly every 90 ms.
 */
export function useDeviceHeading(enabled: boolean) {
  const latest = useRef<Orientation>(EMPTY)
  const sawAbsolute = useRef(false)
  const [orientation, setOrientation] = useState<Orientation>(EMPTY)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined

    const handle = (event: Event) => {
      const e = event as DeviceOrientationEvent & { webkitCompassHeading?: number }
      let heading: number | null = null
      let source: SensorSource = 'relative'

      if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
        heading = normalise(e.webkitCompassHeading)
        source = 'ios'
      } else if (typeof e.alpha === 'number' && !Number.isNaN(e.alpha)) {
        heading = normalise(360 - e.alpha)
        source = e.absolute || event.type === 'deviceorientationabsolute' ? 'absolute' : 'relative'
      }

      // Once a true bearing has been seen, ignore the relative stream.
      if (source === 'relative' && sawAbsolute.current) return
      if (source === 'ios' || source === 'absolute') sawAbsolute.current = true

      latest.current = {
        heading,
        pitch: typeof e.beta === 'number' ? e.beta : null,
        roll: typeof e.gamma === 'number' ? e.gamma : null,
        source: heading == null ? 'none' : source,
      }
    }

    window.addEventListener('deviceorientationabsolute', handle)
    window.addEventListener('deviceorientation', handle)

    let raf = 0
    let published = 0
    const tick = (now: number) => {
      if (now - published > 90) {
        published = now
        setOrientation(latest.current)
      }
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('deviceorientationabsolute', handle)
      window.removeEventListener('deviceorientation', handle)
      window.cancelAnimationFrame(raf)
    }
  }, [enabled])

  /** The freshest sample, without waiting for a render. Used at shutter time. */
  const read = useCallback(() => latest.current, [])

  return { orientation, read }
}

/* -------------------------------------------------------------- camera */

export type CameraStatus = 'idle' | 'starting' | 'live' | 'error'
export type CameraFault = 'unsupported' | 'denied' | 'missing' | 'other'

export function useCameraStream() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [fault, setFault] = useState<CameraFault | null>(null)

  const attach = useCallback(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return
    if (video.srcObject !== stream) video.srcObject = stream
    if (!video.paused) return
    const play = video.play()
    if (play && typeof play.catch === 'function') play.catch(() => undefined)
  }, [])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
  }, [])

  /** Start from a tap. Resolves `true` when a stream is live. */
  const start = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setFault('unsupported')
      setStatus('error')
      return false
    }
    // Already live: re-use the stream instead of opening a second one and
    // leaking the first (the camera light would stay on after leaving).
    const existing = streamRef.current
    if (existing && existing.getVideoTracks().some((track) => track.readyState === 'live')) {
      setStatus('live')
      attach()
      return true
    }
    setStatus('starting')
    setFault(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
        audio: false,
      })
      if (!mounted.current) {
        stream.getTracks().forEach((track) => track.stop())
        return false
      }
      streamRef.current = stream
      // The track can end on its own (another app takes the camera, the OS
      // revokes it). Say so instead of showing a frozen frame.
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          if (streamRef.current !== stream) return
          streamRef.current = null
          setStatus('idle')
        })
      })
      setStatus('live')
      attach()
      return true
    } catch (err) {
      const name = (err as DOMException)?.name || ''
      setFault(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'denied'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'missing'
            : 'other'
      )
      setStatus('error')
      return false
    }
  }, [attach])

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      stop()
    }
  }, [stop])

  return { videoRef, status, fault, start, stop, attach }
}

/* ------------------------------------------------------------- network */

export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  )
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

/* ------------------------------------------------------------- elapsed */

/** Seconds since `active` became true. The waiting screen counts honestly. */
export function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!active) {
      setSeconds(0)
      return undefined
    }
    const started = Date.now()
    const id = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [active])
  return seconds
}

/* ---------------------------------------------------------------- dates */

/** Locale-aware short date. Uzbek asks for the Latin script explicitly. */
export function useDateFormat() {
  const { i18n } = useTranslation()
  return useMemo(() => {
    const tag = i18n.language === 'uz' ? 'uz-Latn-UZ' : i18n.language
    return (iso: string) => {
      try {
        return new Intl.DateTimeFormat(tag, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(new Date(iso))
      } catch {
        return iso.slice(0, 10)
      }
    }
  }, [i18n.language])
}

/* ---------------------------------------------------------- radio group */

/**
 * The WAI-ARIA radio group keyboard model: one tab stop (the checked option),
 * arrows move *and* select, Home/End jump to the ends. Spread the returned
 * props onto each `role="radio"` button.
 */
export function radioProps<T>(
  options: readonly T[],
  value: T,
  index: number,
  onChange: (next: T) => void
) {
  const checked = options[index] === value
  const hasChecked = options.includes(value)
  return {
    role: 'radio' as const,
    'aria-checked': checked,
    tabIndex: checked || (!hasChecked && index === 0) ? 0 : -1,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const last = options.length - 1
      let next = -1
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index === last ? 0 : index + 1
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index === 0 ? last : index - 1
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = last
      if (next < 0) return
      event.preventDefault()
      onChange(options[next])
      const group = event.currentTarget.parentElement
      const target = group?.querySelectorAll<HTMLElement>('[role="radio"]')[next]
      target?.focus()
    },
  }
}
