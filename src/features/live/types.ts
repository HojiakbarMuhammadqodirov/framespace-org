/**
 * Shared shapes for "See by yourself" (brief §9).
 *
 * The project/render shapes mirror what `src/lib/storage.js` persists and what
 * `POST /api/render` returns — both frozen, so these are read-only mirrors and
 * every field is optional on purpose: an archived project written by an older
 * build must still open.
 */

/** A — live AI restyle, B — WebXR AR, C — gyroscope panorama. */
export type LiveModeId = 'a' | 'b' | 'c'

export interface LiveRender {
  angleId: string
  angleLabel?: string
  prompt?: string
  /** A data URL or an http(s) URL. `buildEquirect` loads it with crossOrigin. */
  image: string
}

/** One entry of `framespace.projects.v1`. */
export interface LiveProject {
  id: string
  savedAt?: string
  style?: string
  notes?: string
  budget?: unknown
  brief?: unknown
  renders?: LiveRender[]
  /**
   * The original photographs, keyed by angle id. Capture does not persist
   * these today (they are dropped after the render request), so the anchor
   * ghost falls back to the render. When step 5 starts storing them this
   * lights up with no further change.
   */
  captures?: Record<string, { dataUrl?: string; base64?: string; mediaType?: string }>
}

import type { Quaternion } from 'three'

/** How trustworthy the heading number is. Drives what the tape is labelled. */
export type HeadingSource = 'absolute' | 'compass' | 'relative' | 'none'

/**
 * One sensor frame, mutated in place at event rate. Never put this in React
 * state — it changes 60×/second.
 */
export interface LiveFrame {
  /**
   * The smoothed camera orientation. Mutated in place every animation frame —
   * copy it before holding on to it.
   */
  quaternion: Quaternion
  /** Has any usable reading arrived at all. */
  live: boolean
  /** performance.now() of the last event. */
  at: number
  /** Camera azimuth derived from the device quaternion, degrees, clockwise. */
  azimuth: number
  /** Compass heading 0–360 where we can get one, else the relative azimuth. */
  heading: number
  headingSource: HeadingSource
  /** Degrees above the horizon; positive is looking up. */
  pitch: number
  /** Device roll, degrees; 0 is upright. */
  roll: number
  /** `screen.orientation.angle` at the time of the reading. */
  screenAngle: number
}

export type MotionPermission =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unsupported'
  | 'insecure'

/** Everything the screen needs to decide which mode it may offer. */
export interface LiveCapabilities {
  secureContext: boolean
  webgl: boolean
  /** `DeviceOrientationEvent` exists at all. */
  motion: boolean
  /** iOS: `DeviceOrientationEvent.requestPermission` exists. */
  motionNeedsPermission: boolean
  /** `navigator.xr.isSessionSupported('immersive-ar')`; null while probing. */
  xrAr: boolean | null
  /** `<a rel="ar">` — AR Quick Look, the iOS Safari route. */
  quickLook: boolean
  camera: boolean
  wakeLock: boolean
  orientationLock: boolean
  online: boolean
}
