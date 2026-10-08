/**
 * The typed seam between this feature and the frozen API layer.
 *
 * Nothing here reimplements anything: the angle plan is *imported* from
 * `server/angles.js` (docs/API-INVENTORY.md §2.2 — copying it would let client
 * and server drift), the compression is `prepareCapture()` from
 * `src/lib/image.js`, and the request is `requestRender()` from
 * `src/lib/api.js`. This module only puts TypeScript types on them.
 */
import { ANGLES as RAW_ANGLES, REQUIRED_ANGLE_IDS as RAW_REQUIRED, RENDERABLE_ANGLE_IDS as RAW_RENDERABLE } from '@contract/angles.js'
import { requestRender as rawRequestRender, getHealth as rawGetHealth } from '@/lib/api.js'
import { prepareCapture as rawPrepareCapture } from '@/lib/image.js'

import type { AngleId, RenderResponse } from './types'

export type Angle = {
  id: AngleId
  label: string
  hint: string
  required: boolean
  /** Target bearing relative to the first ("front") shot, in degrees. */
  yaw: number
}

export const ANGLES = RAW_ANGLES as Angle[]

/** All four of these must be present or `/api/render` answers 400. */
export const REQUIRED_ANGLE_IDS = RAW_REQUIRED as AngleId[]

/**
 * Angles the server is willing to turn into a finished image. Four required
 * walls plus the corner and the window shot — which is exactly the "shoot 6-7,
 * not 4" recommendation in brief §6. Floor and ceiling still help the brief.
 */
export const RENDERABLE_ANGLE_IDS = RAW_RENDERABLE as AngleId[]

export const RECOMMENDED_ANGLE_IDS = RENDERABLE_ANGLE_IDS

export function angleById(id: AngleId): Angle | undefined {
  return ANGLES.find((a) => a.id === id)
}

/** The plan in shooting order: required walls first, then the extras. */
export const ANGLE_ORDER: Angle[] = [
  ...ANGLES.filter((a) => a.required),
  ...ANGLES.filter((a) => !a.required),
]

export type PreparedImage = {
  dataUrl: string
  base64: string
  mediaType: string
  width: number
  height: number
}

/** 1280px, JPEG q0.85 — tuned to the 30 MB body limit. Do not reimplement. */
export const prepareCapture = rawPrepareCapture as (file: Blob) => Promise<PreparedImage>

export type RenderRequest = {
  captures: Record<AngleId, { base64: string; mediaType: string }>
  style: string
  budget: { limit: number; currency: string } | null
  notes: string
  /** Language of the written brief. Defaults to the current UI language. */
  locale?: 'uz' | 'ru' | 'en'
}

/**
 * One request, no job id, ~30 s of wall time. There is no polling endpoint and
 * no resume — see the waiting screen for how that is communicated.
 */
export function requestRender(request: RenderRequest, signal?: AbortSignal): Promise<RenderResponse> {
  const call = rawRequestRender as unknown as (
    r: RenderRequest,
    signal?: AbortSignal
  ) => Promise<RenderResponse>
  return call(request, signal)
}

export type Health = {
  ok: boolean
  demoMode: boolean
  providers?: { claude: boolean; gemini: boolean }
}

export const getHealth = rawGetHealth as () => Promise<Health>
