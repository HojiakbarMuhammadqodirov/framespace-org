/**
 * Scene → render request.
 *
 * The body `POST /api/render-scene` receives (see `./api.ts`). It describes the
 * drawn room in metres and the placed catalogue pieces, so the server can write
 * a design brief and renders without any photographs.
 */
import { CATALOG, entryFor } from './catalog'
import {
  buildWalls,
  footprint,
  FIXTURE_SIZE,
  polygonArea,
  polygonPerimeter,
  tidy,
  wallAzimuth,
} from './geometry'
import type { Scene } from './types'

/** The route this payload is sent to. */
export const SCENE_ENDPOINT = 'POST /api/render-scene'

export interface ScenePayload {
  version: '1.0'
  units: 'm'
  currency: 'UZS'
  locale: string
  style: string
  room: {
    shape: Scene['room']['shape']
    widthM: number
    depthM: number
    heightM: number
    floorAreaM2: number
    perimeterM: number
    footprint: Array<[number, number]>
  }
  walls: Array<{
    id: string
    lengthM: number
    azimuthDeg: number
    interior: boolean
    openings: Array<{
      kind: string
      offsetM: number
      widthM: number
      heightM: number
      sillM: number
    }>
  }>
  items: Array<{
    id: string
    catalogId: string
    category: string
    widthM: number
    depthM: number
    heightM: number
    x: number
    z: number
    rotationDeg: number
    material: string
    unitPriceUzs: number
  }>
  lighting: { preset: Scene['lighting'] }
  budget: { currency: 'UZS'; limit: number; estimatedTotal: number; withinBudget: boolean }
  notes: string
}

export function estimatedTotal(scene: Scene): number {
  return scene.items.reduce((sum, item) => sum + entryFor(item.catalogId).price, 0)
}

/**
 * The body. Angles are degrees clockwise from north so a server-side prompt
 * writer can say "the window faces east" without re-deriving trigonometry.
 */
export function buildScenePayload(scene: Scene, locale: string, style: string): ScenePayload {
  const walls = buildWalls(scene.room)
  const poly = footprint(scene.room)
  const total = estimatedTotal(scene)

  return {
    version: '1.0',
    units: 'm',
    currency: 'UZS',
    locale,
    style,
    room: {
      shape: scene.room.shape,
      widthM: tidy(scene.room.width),
      depthM: tidy(scene.room.depth),
      heightM: tidy(scene.room.height),
      floorAreaM2: tidy(polygonArea(poly)),
      perimeterM: tidy(polygonPerimeter(poly)),
      footprint: poly.map((p) => [tidy(p.x), tidy(p.z)] as [number, number]),
    },
    walls: walls.map((wall) => ({
      id: wall.id,
      lengthM: tidy(wall.length),
      azimuthDeg: wallAzimuth(wall),
      interior: wall.interior,
      openings: scene.fixtures
        .filter((fixture) => fixture.wall === wall.id)
        .sort((a, b) => a.t - b.t)
        .map((fixture) => ({
          kind: fixture.kind,
          offsetM: tidy(fixture.t),
          widthM: FIXTURE_SIZE[fixture.kind].w,
          heightM: FIXTURE_SIZE[fixture.kind].h,
          sillM: FIXTURE_SIZE[fixture.kind].sill,
        })),
    })),
    items: scene.items.map((item) => {
      const entry = entryFor(item.catalogId)
      return {
        id: item.id,
        catalogId: entry.id,
        category: entry.apiCategory,
        widthM: entry.w,
        depthM: entry.d,
        heightM: entry.h,
        x: tidy(item.x),
        z: tidy(item.z),
        rotationDeg: Math.round(((item.rotation * 180) / Math.PI + 360) % 360),
        material: item.material,
        unitPriceUzs: entry.price,
      }
    }),
    lighting: { preset: scene.lighting },
    budget: {
      currency: 'UZS',
      limit: scene.budget,
      estimatedTotal: total,
      withinBudget: total <= scene.budget,
    },
    notes: `Built in the FrameSpace 3D room builder. ${scene.items.length} of ${CATALOG.length} catalogue pieces placed.`,
  }
}

/** Dev-only: prints the body that is about to be sent. */
export function logScenePayload(payload: ScenePayload): ScenePayload {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug(`[FrameSpace] ${SCENE_ENDPOINT}`, payload)
  }
  return payload
}
