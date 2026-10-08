/**
 * Types for the guided capture flow (brief §6) and for the response of
 * `POST /api/render` (docs/API-INVENTORY.md §3).
 *
 * The response types mirror the frozen endpoint exactly. They are written by
 * hand because the endpoint is JavaScript and ships no schema — if the server
 * contract ever changes, this file is the single place the client has to move.
 */

export type AngleId = string

/** Where the heading number came from. `none` = the device told us nothing. */
export type SensorSource = 'ios' | 'absolute' | 'relative' | 'none'

export type Orientation = {
  /** Compass bearing, 0-360, 0 = north. `null` when unavailable. */
  heading: number | null
  /** Tilt front/back in degrees (DeviceOrientationEvent.beta). */
  pitch: number | null
  /** Tilt left/right in degrees (DeviceOrientationEvent.gamma). */
  roll: number | null
  source: SensorSource
}

export type QualityFlag = 'blur' | 'dark' | 'duplicate'

export type Quality = {
  /** Variance of the Laplacian on a downscaled frame. Higher = sharper. */
  blurScore: number
  /** Mean luma, 0-255. */
  luma: number
  flags: QualityFlag[]
}

/**
 * Everything we know about one shot except the pixels. This is the part that
 * survives into storage — `/api/render` ignores it, so it stays client-side
 * for the "See by yourself" step.
 */
export type ShotMeta = {
  angleId: AngleId
  heading: number | null
  /** Heading minus the anchor heading, normalised to 0-360. */
  relativeHeading: number | null
  pitch: number | null
  roll: number | null
  takenAt: number
  anchor: boolean
  blurScore: number
  luma: number
  flags: QualityFlag[]
}

export type Shot = ShotMeta & {
  /** Full-size JPEG data URL from `prepareCapture()`. */
  dataUrl: string
  /** The same image, base64 without the `data:` prefix — what the API wants. */
  base64: string
  mediaType: string
  width: number
  height: number
}

export type RoomTypeId =
  | 'living'
  | 'bedroom'
  | 'kitchen'
  | 'bathroom'
  | 'office'
  | 'kids'
  | 'terrace'

export const ROOM_TYPES: RoomTypeId[] = [
  'living',
  'bedroom',
  'kitchen',
  'bathroom',
  'office',
  'kids',
  'terrace',
]

export type BudgetTier = 'economy' | 'optimal' | 'premium' | 'custom'

export type BudgetChoice = { tier: BudgetTier; limit: number; currency: string }

/* ------------------------------------------------------- render response */

export type FurnitureCategory =
  | 'seating'
  | 'table'
  | 'storage'
  | 'bed'
  | 'lighting'
  | 'rug'
  | 'textiles'
  | 'wall-decor'
  | 'plants'
  | 'paint-and-finishes'
  | 'other'

export type PaletteEntry = { name: string; hex: string; usage?: string }

export type FurnitureItem = {
  name: string
  category: FurnitureCategory
  description?: string
  typicalPriceLow?: number
  typicalPriceHigh?: number
  averagePrice?: number
  quantity?: number
  placement?: string
}

export type DesignBrief = {
  room?: {
    estimatedWidthM?: number
    estimatedDepthM?: number
    estimatedHeightM?: number
    existingFeatures?: string[]
    lightingNotes?: string
    confidence?: 'low' | 'medium' | 'high'
  }
  design?: {
    styleName?: string
    summary?: string
    palette?: PaletteEntry[]
    materials?: string[]
    lighting?: string
  }
  furniture?: FurnitureItem[]
  /** `estimatedTotal` is computed on the server. Display it, never recompute. */
  budget?: {
    currency?: string
    limit?: number
    estimatedTotal?: number
    withinBudget?: boolean
    notes?: string
  }
  renderPrompts?: Array<{ angleId: AngleId; angleLabel?: string; prompt?: string }>
  usage?: { inputTokens?: number; outputTokens?: number }
}

export type RenderImage = {
  angleId: AngleId
  angleLabel?: string
  prompt?: string
  /** A `data:image/png;base64,...` URL — the images ride inside the JSON. */
  image: string
  /** Set by /api/render-scene when this angle is an illustrated stand-in. */
  fallback?: boolean
}

export type RenderFailure = { angleId: AngleId; error?: string }

export type RenderResponse = {
  demoMode?: boolean
  style?: string
  brief?: DesignBrief
  renders?: RenderImage[]
  failures?: RenderFailure[]
  elapsedMs?: number
  /** Non-fatal problems the server worked around (render-scene). */
  warnings?: Array<{ stage?: string; error?: string }>
}

/* -------------------------------------------------------------- storage */

/** One finished generation, as this feature persists it. */
export type CaptureRecord = {
  id: string
  createdAt: string
  roomName: string
  roomType: RoomTypeId
  style: string
  notes: string
  budget: { limit: number; currency: string } | null
  /** The sensor trail. Unknown to the API; kept for the 3D / panorama step. */
  capture: {
    anchorHeading: number | null
    source: SensorSource
    shots: ShotMeta[]
  }
  /** angleId -> a downscaled "before" photo, for the before/after wipe. */
  before: Record<AngleId, string>
  result: RenderResponse
}

/** Which screen of the flow is on stage. */
export type CaptureStep =
  | 'permission'
  | 'room'
  | 'shoot'
  | 'review'
  | 'plan'
  | 'generating'
  | 'failed'

export type FlowErrorKind =
  | 'camera-missing'
  | 'camera-denied'
  | 'offline'
  | 'render-failed'
  | 'quota'
  | 'storage-full'
  /** A single frame or picked file could not be read. Dismissible, in-shoot. */
  | 'shot-failed'
  /** `/api/render` did not answer inside the client's 120 s window. */
  | 'timeout'

export type FlowError = { kind: FlowErrorKind; detail?: string }

/** How the photos arrive: the live preview, or the system gallery picker. */
export type CaptureMode = 'camera' | 'upload'

/** Steps that make no sense without photos in hand. */
export const STEPS_NEEDING_SHOTS: CaptureStep[] = ['review', 'plan', 'generating', 'failed']

export const CAPTURE_STEPS: CaptureStep[] = [
  'permission',
  'room',
  'shoot',
  'review',
  'plan',
  'generating',
  'failed',
]

export function isCaptureStep(value: unknown): value is CaptureStep {
  return typeof value === 'string' && (CAPTURE_STEPS as string[]).includes(value)
}
