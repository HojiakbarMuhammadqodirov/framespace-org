import { Euler, MathUtils, Quaternion, Vector3 } from 'three'

/**
 * Device orientation → camera quaternion, done properly.
 *
 * `DeviceOrientationEvent` gives three intrinsic Tait-Bryan angles in the
 * Z-X'-Y'' convention, in a world frame where Z points up. Three.js wants a
 * quaternion in a Y-up world, looking down -Z. Three corrections, in order:
 *
 *   1. `Euler(beta, alpha, -gamma, 'YXZ')` remaps the axes into Y-up.
 *   2. Post-multiply by a -90° rotation about X, because the "camera" is the
 *      back lens: when the phone is held upright the device frame's +Z points
 *      at your face, and the view has to look out of the other side.
 *   3. Post-multiply by `-screen.orientation.angle` about the local Z, so that
 *      rotating the *screen* (auto-rotate, or a landscape lock we failed to
 *      prevent) does not roll the horizon.
 *
 * Skipping (3) is the classic bug: the panorama looks perfect in portrait and
 * lies on its side the moment the phone is turned.
 *
 * Everything below is pure and allocation-free on the hot path — the scratch
 * objects are module-level because this runs 60×/second.
 */

const ZEE = new Vector3(0, 0, 1)
const FORWARD = new Vector3(0, 0, -1)
const RIGHT = new Vector3(1, 0, 0)
const UP = new Vector3(0, 1, 0)

const scratchEuler = new Euler()
const scratchScreen = new Quaternion()
/** -90° about X: turn the view around to look out of the back camera. */
const LENS = new Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2)

const vA = new Vector3()
const vB = new Vector3()
const vC = new Vector3()

export const DEG = MathUtils.RAD2DEG
export const RAD = MathUtils.DEG2RAD

/**
 * Write the camera orientation for one sensor reading into `out`.
 *
 * @param alphaDeg  event.alpha — rotation about the world up axis
 * @param betaDeg   event.beta  — front/back tilt
 * @param gammaDeg  event.gamma — left/right tilt
 * @param screenAngleDeg `screen.orientation.angle`, 0 in portrait
 */
export function deviceQuaternion(
  out: Quaternion,
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
  screenAngleDeg: number
): Quaternion {
  scratchEuler.set(betaDeg * RAD, alphaDeg * RAD, -gammaDeg * RAD, 'YXZ')
  out.setFromEuler(scratchEuler)
  out.multiply(LENS)
  out.multiply(scratchScreen.setFromAxisAngle(ZEE, -screenAngleDeg * RAD))
  return out
}

/**
 * Camera azimuth in degrees, measured as `atan2(z, x)` of the forward vector.
 *
 * This is the number everything else is built on, and its one important
 * property is direction: turning the phone clockwise INCREASES it. Worth the
 * derivation, because getting the sign wrong makes the panorama counter-rotate
 * and there is no way to tell from a desk.
 *
 *   Held upright, gamma = 0, screen angle 0:
 *     R = Ry(alpha)·Rx(beta)·Rz(0), beta = 90°  →  R = Ry(alpha)·Rx(90°)
 *     q = R·LENS = Ry(alpha)·Rx(90°)·Rx(-90°) = Ry(alpha)
 *     forward = Ry(alpha)·(0,0,-1) = (-sin α, 0, -cos α)
 *     azimuth = atan2(-cos α, -sin α) = -(90° + α)
 *
 * `alpha` decreases as the phone turns clockwise (spec: it is a
 * counter-clockwise rotation about the up axis), so azimuth increases. Good.
 */
export function azimuthOf(q: Quaternion): number {
  vA.copy(FORWARD).applyQuaternion(q)
  return Math.atan2(vA.z, vA.x) * DEG
}

/**
 * Compass heading implied by an azimuth, for devices that report an absolute
 * frame. From the same derivation: `alpha = -(azimuth + 90)` and the standard
 * absolute-orientation formula is `heading = 360 - alpha`, so
 * `heading = azimuth + 450 ≡ azimuth + 90 (mod 360)`.
 *
 * Deriving it from the quaternion rather than from raw `alpha` means the
 * heading inherits the screen-orientation compensation for free.
 */
export function headingFromAzimuth(azimuth: number): number {
  return normalizeDeg(azimuth + 90)
}

/** Degrees above the horizon. Positive is looking up. */
export function pitchOf(q: Quaternion): number {
  vA.copy(FORWARD).applyQuaternion(q)
  return Math.asin(clamp(vA.y, -1, 1)) * DEG
}

/** Device roll in degrees; 0 is upright. Degenerate looking straight up/down. */
export function rollOf(q: Quaternion): number {
  vB.copy(RIGHT).applyQuaternion(q)
  vC.copy(UP).applyQuaternion(q)
  return -Math.atan2(vB.y, vC.y) * DEG
}

export function normalizeDeg(deg: number): number {
  const d = deg % 360
  return d < 0 ? d + 360 : d
}

/** Shortest signed difference `a - b`, in (-180, 180]. */
export function signedDelta(a: number, b: number): number {
  let d = (a - b) % 360
  if (d > 180) d -= 360
  if (d <= -180) d += 360
  return d
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/**
 * Frame-rate-independent smoothing factor for `Quaternion.slerp`.
 *
 * A fixed factor per frame gives a different time constant at 60Hz and at
 * 120Hz, which is why gyro panoramas feel syrupy on some phones and jittery on
 * others. `1 - e^(-dt/tau)` is the same curve everywhere.
 */
export function smoothing(dt: number, tau: number): number {
  return 1 - Math.exp(-Math.max(dt, 0) / Math.max(tau, 1e-4))
}

/** Rotation about world up by `deg`, used for the yaw calibration offset. */
export function yawQuaternion(out: Quaternion, deg: number): Quaternion {
  return out.setFromAxisAngle(UP, deg * RAD)
}

/** `114°` — the mono readout format. Always three digits, always signed-free. */
export function formatHeading(deg: number): string {
  return `${String(Math.round(normalizeDeg(deg)) % 360).padStart(3, '0')}°`
}

/** `+2°` / `-11°` — signed, for pitch, roll and drift. */
export function formatSigned(deg: number): string {
  const n = Math.round(deg)
  return `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}°`
}
