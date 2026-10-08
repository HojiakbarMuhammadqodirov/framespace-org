/**
 * Client-side shot quality, brief §6.5.
 *
 * Three checks, all advisory: a blurry frame, a frame too dark to read, and a
 * frame pointing where another one already pointed. The flow *warns* and offers
 * a retake — it never silently drops a photo, because the user is standing in
 * the room and knows things the heuristic does not (a dim room at dusk is still
 * the room).
 */
import type { Quality, QualityFlag, ShotMeta } from './types'

/** Laplacian variance below this reads as soft/out of focus. */
export const BLUR_FLOOR = 55
/** Mean luma below this is too dark for the model to read materials. */
export const DARK_FLOOR = 42
/** Two shots within this many degrees are the same direction. */
export const DUPLICATE_DEGREES = 14

/** Work at this width — full resolution adds nothing but milliseconds. */
const SAMPLE_WIDTH = 320

let scratch: HTMLCanvasElement | null = null

function scratchCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  if (!scratch) scratch = document.createElement('canvas')
  scratch.width = width
  scratch.height = height
  return scratch
}

/**
 * Variance of the Laplacian plus mean luma, measured on a downscaled copy.
 * Returns neutral-good numbers if the canvas is unavailable (some privacy
 * modes refuse `getImageData`), so the check can never block a capture.
 */
export function measure(source: CanvasImageSource, width: number, height: number): Quality {
  const fallback: Quality = { blurScore: BLUR_FLOOR, luma: 128, flags: [] }
  if (!width || !height) return fallback

  const w = Math.max(32, Math.min(SAMPLE_WIDTH, width))
  const h = Math.max(32, Math.round((height / width) * w))
  const canvas = scratchCanvas(w, h)
  const ctx = canvas?.getContext('2d', { willReadFrequently: true })
  if (!canvas || !ctx) return fallback

  try {
    ctx.drawImage(source, 0, 0, w, h)
    const { data } = ctx.getImageData(0, 0, w, h)

    // Rec. 601 luma, one pass.
    const grey = new Float32Array(w * h)
    let sum = 0
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      grey[p] = y
      sum += y
    }
    const luma = sum / grey.length

    // 4-neighbour Laplacian, interior pixels only.
    let lSum = 0
    let lSqSum = 0
    let count = 0
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const i = y * w + x
        const v = 4 * grey[i] - grey[i - 1] - grey[i + 1] - grey[i - w] - grey[i + w]
        lSum += v
        lSqSum += v * v
        count += 1
      }
    }
    if (!count) return fallback
    const mean = lSum / count
    const variance = lSqSum / count - mean * mean

    return { blurScore: Math.round(variance), luma: Math.round(luma), flags: [] }
  } catch {
    return fallback
  }
}

/** Shortest signed distance between two bearings, -180..180. */
export function bearingDelta(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180
}

/** Normalise any angle into 0..360. */
export function normalise(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/**
 * Turn raw numbers into flags. `previous` is every shot already kept — a new
 * shot pointing the same way as a *different* angle is the duplicate case;
 * retaking the same angle is not.
 */
export function flagsFor(
  quality: Quality,
  candidate: { angleId: string; relativeHeading: number | null },
  previous: ShotMeta[]
): QualityFlag[] {
  const flags: QualityFlag[] = []
  if (quality.blurScore < BLUR_FLOOR) flags.push('blur')
  if (quality.luma < DARK_FLOOR) flags.push('dark')

  if (candidate.relativeHeading != null) {
    const clash = previous.some(
      (shot) =>
        shot.angleId !== candidate.angleId &&
        shot.relativeHeading != null &&
        Math.abs(bearingDelta(shot.relativeHeading, candidate.relativeHeading as number)) <
          DUPLICATE_DEGREES
    )
    if (clash) flags.push('duplicate')
  }
  return flags
}
