import { ANGLES, RENDERABLE_ANGLE_IDS } from '@contract/angles.js'

import type { LiveProject, LiveRender } from './types'

/**
 * Choosing and ordering the renders that go into the panorama.
 *
 * `buildEquirect()` (frozen) lays its inputs out as N EQUAL sectors across the
 * 4096px width — it never reads `yaw`. So the ordering is our job: hand it the
 * renders sorted by heading, and only when those headings are actually evenly
 * spaced, or the sphere lies about where the walls are.
 *
 * The capture plan makes this easy. The four required angles sit at 0/90/180/
 * 270, and all eight at 45° steps — both perfectly even. A partial set (say
 * front + right + back) is not, and we say so rather than drawing a room that
 * is 30° wrong in one direction.
 */

type Angle = { id: string; label: string; yaw: number; required: boolean }

const ANGLE_LIST = ANGLES as unknown as Angle[]

export const YAW_BY_ANGLE: Record<string, number> = Object.fromEntries(
  ANGLE_LIST.map((a) => [a.id, a.yaw])
)

/** The angle the room's zero points at. Front wall, yaw 0 — see server/angles.js. */
export const ANCHOR_ANGLE_ID = 'front'

const CARDINALS = ['front', 'right', 'back', 'left']

export interface PanoramaPlan {
  /** In sector order, ready for `buildEquirect()`. */
  renders: LiveRender[]
  /** The room yaw each sector was shot from, same order. */
  yaws: number[]
  /** Half a sector, in degrees: the offset between sector edge and its centre. */
  halfSector: number
  /** The angle id whose sector the room's zero sits in. */
  anchorAngleId: string
  /** Room yaw of the anchor sector's centre. */
  anchorYaw: number
  /** False when the headings are not evenly spaced — the sphere is a guess. */
  even: boolean
}

function evenlySpaced(yaws: number[]): boolean {
  if (yaws.length < 2) return false
  const step = 360 / yaws.length
  return yaws.every((yaw, i) => Math.abs(yaw - i * step) < 1)
}

/**
 * Pick the widest set of renders whose headings are evenly spaced.
 *
 * Preference order: everything we have → the four cardinals → whatever is
 * left, flagged as approximate.
 */
export function planPanorama(renders: LiveRender[] | undefined | null): PanoramaPlan | null {
  const usable = (renders ?? []).filter(
    (r) => r && typeof r.image === 'string' && r.image && YAW_BY_ANGLE[r.angleId] != null
  )
  if (!usable.length) return null

  const byYaw = [...usable].sort((a, b) => YAW_BY_ANGLE[a.angleId] - YAW_BY_ANGLE[b.angleId])
  const candidates: LiveRender[][] = [byYaw]

  const cardinals = CARDINALS.map((id) => byYaw.find((r) => r.angleId === id)).filter(
    Boolean
  ) as LiveRender[]
  if (cardinals.length === 4) candidates.push(cardinals)

  for (const list of candidates) {
    const yaws = list.map((r) => YAW_BY_ANGLE[r.angleId])
    if (evenlySpaced(yaws)) return describe(list, yaws, true)
  }

  const yaws = byYaw.map((r) => YAW_BY_ANGLE[r.angleId])
  return describe(byYaw, yaws, false)
}

function describe(renders: LiveRender[], yaws: number[], even: boolean): PanoramaPlan {
  const halfSector = 180 / renders.length
  // Prefer the front wall as the room's zero; fall back to the first sector so
  // a set without a front render still calibrates against something real.
  const anchorIndex = Math.max(
    0,
    renders.findIndex((r) => r.angleId === ANCHOR_ANGLE_ID)
  )
  return {
    renders,
    yaws,
    halfSector,
    anchorAngleId: renders[anchorIndex].angleId,
    // Even layout: sector i is centred on i * (360/n). That is the yaw the
    // camera must read for this sector to sit dead ahead.
    anchorYaw: anchorIndex * (360 / renders.length),
    even,
  }
}

/**
 * The ghost image the user lines up against: the ORIGINAL photograph if the
 * device still has it, otherwise the render of the same wall. The render is a
 * weaker guide — it is the restyled room, not the room you are standing in —
 * but a ghost of the right wall beats no ghost at all.
 */
export function anchorGhost(
  project: LiveProject | null,
  angleId: string
): { src: string; original: boolean } | null {
  const capture = project?.captures?.[angleId]
  if (capture?.dataUrl) return { src: capture.dataUrl, original: true }
  if (capture?.base64) {
    return { src: `data:${capture.mediaType || 'image/jpeg'};base64,${capture.base64}`, original: true }
  }
  const render = project?.renders?.find((r) => r.angleId === angleId)
  if (render?.image) return { src: render.image, original: false }
  return null
}

/** Renders that make sense as a finished room view, per the frozen contract. */
export function renderableAngleIds(): string[] {
  return RENDERABLE_ANGLE_IDS as unknown as string[]
}

export function angleLabel(angleId: string): string {
  return ANGLE_LIST.find((a) => a.id === angleId)?.label ?? angleId
}
