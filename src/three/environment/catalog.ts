/**
 * The real-world assets behind the 3D rooms: outdoor skies and PBR surfaces.
 *
 * Everything here is CC0 (Poly Haven) and lives in `public/` — nothing is
 * bundled, nothing loads until a scene asks for it. Sources, authors and the
 * conversion pipeline are in `public/env/CREDITS.md` and
 * `public/textures/CREDITS.md`.
 *
 * Numbers marked "measured" were written by the asset build script, not
 * tuned by eye: the sun direction is the brightest texel of the original HDR
 * in three.js' equirect convention, and `gain` is the scale that fitted each
 * tint-ready colour map into 8 bits (the shader divides it back out, so a
 * surface averages to exactly its palette colour).
 */

const BASE = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/')
const url = (path: string) => `${BASE}${path}`

/* -------------------------------------------------------------------- skies */

export type SkyId = 'day' | 'golden' | 'dusk'

export interface SkyDef {
  id: SkyId
  /** Poly Haven asset the files were made from. */
  source: string
  /** Tonemapped equirect backdrop (sun kept), per device tier. */
  background: { high: string; low: string }
  /**
   * Linear HDR for image-based light, sun clamped out: the scene's own
   * directional light is the sun, and it casts shadows — the HDR one cannot.
   */
  environment: { high: string; low: string }
  /** Where the sun sits in the unrotated image. Measured. Radians. */
  sun: { azimuth: number; elevation: number }
}

export const SKIES: Record<SkyId, SkyDef> = {
  day: {
    id: 'day',
    source: 'suburban_garden',
    background: { high: url('env/day/bg-4k.webp'), low: url('env/day/bg-2k.webp') },
    environment: { high: url('env/day/env-1k.hdr'), low: url('env/day/env-512.hdr') },
    sun: { azimuth: 0.6289, elevation: 1.1198 },
  },
  golden: {
    id: 'golden',
    source: 'sunny_vondelpark',
    background: { high: url('env/golden/bg-4k.webp'), low: url('env/golden/bg-2k.webp') },
    environment: { high: url('env/golden/env-1k.hdr'), low: url('env/golden/env-512.hdr') },
    sun: { azimuth: 0.5921, elevation: 0.2117 },
  },
  dusk: {
    id: 'dusk',
    source: 'twilight_sunset',
    background: { high: url('env/dusk/bg-4k.webp'), low: url('env/dusk/bg-2k.webp') },
    environment: { high: url('env/dusk/env-1k.hdr'), low: url('env/dusk/env-512.hdr') },
    sun: { azimuth: 2.0525, elevation: 0.0215 },
  },
}

/**
 * Y rotation (for `backgroundRotation`, `environmentRotation` or a mesh) that
 * swings a sky so its sun stands at `azimuth` — the angle `atan2(z, x)` of the
 * direction the sunlight comes FROM. three rotates the lookup by the inverse
 * Euler, so a texel at angle a lands at a − θ.
 */
export function skyRotationFor(sky: SkyId, azimuth: number): number {
  return SKIES[sky].sun.azimuth - azimuth
}

/* ----------------------------------------------------------------- surfaces */

export type SurfaceId =
  | 'floor-light-oak'
  | 'floor-oak'
  | 'floor-walnut'
  | 'floor-herringbone'
  | 'plaster'
  | 'veneer-oak'

export interface SurfaceDef {
  id: SurfaceId
  source: string
  /** Real-world edge length of one tile of the texture. Measured. */
  meters: number
  /** Colour-map gain from the build script. Measured. */
  gain: number
  /** Mean of the roughness channel. Measured. */
  roughness: number
  /** Largest colour/normal size shipped; ARM is always 1024. */
  maxSize: 1024 | 2048
  /** Rotate the figure 90° so boards run along +X like the others. */
  rotate?: boolean
}

export const SURFACES: Record<SurfaceId, SurfaceDef> = {
  'floor-light-oak': { id: 'floor-light-oak', source: 'laminate_floor_02', meters: 1.7, gain: 0.7061, roughness: 0.379, maxSize: 2048 },
  'floor-oak': { id: 'floor-oak', source: 'oak_wood_planks', meters: 1.2, gain: 0.5822, roughness: 0.444, maxSize: 2048 },
  'floor-walnut': { id: 'floor-walnut', source: 'wood_floor', meters: 1.7, gain: 0.6897, roughness: 0.473, maxSize: 2048, rotate: true },
  'floor-herringbone': { id: 'floor-herringbone', source: 'herringbone_parquet', meters: 3.4, gain: 0.5942, roughness: 0.099, maxSize: 2048 },
  plaster: { id: 'plaster', source: 'white_stucco', meters: 2.0, gain: 0.9347, roughness: 0.884, maxSize: 1024 },
  'veneer-oak': { id: 'veneer-oak', source: 'oak_veneer_01', meters: 1.83, gain: 0.5676, roughness: 0.533, maxSize: 1024 },
}

export function surfaceUrls(id: SurfaceId, size: 1024 | 2048) {
  const s = Math.min(size, SURFACES[id].maxSize)
  return {
    color: url(`textures/${id}/color-${s}.webp`),
    normal: url(`textures/${id}/normal-${s}.webp`),
    arm: url(`textures/${id}/arm-1024.webp`),
  }
}

/* ------------------------------------------------------------ style finishes */

export type FinishStyle = 'minimal' | 'japandi' | 'modernUzbek' | 'classic'

export interface Finish {
  floor: SurfaceId
  /** Multiplies the floor's measured roughness: <1 waxed, >1 matt oiled. */
  floorSheen: number
}

/**
 * Which real floor each palette sits on. The palette still decides the
 * colour — these only decide the figure: wide pale boards for Minimal, oiled
 * oak for Japandi, long walnut boards for Modern Uzbek, herringbone for
 * Classic.
 */
export const STYLE_FINISH: Record<FinishStyle, Finish> = {
  minimal: { floor: 'floor-light-oak', floorSheen: 1.35 },
  japandi: { floor: 'floor-oak', floorSheen: 1.4 },
  modernUzbek: { floor: 'floor-walnut', floorSheen: 1.1 },
  classic: { floor: 'floor-herringbone', floorSheen: 2.4 },
}

/** Loose project style text ("Japandi", "modern uzbek") → a finish key. */
export function toFinishStyle(value: string | null | undefined): FinishStyle {
  const v = (value ?? '').toLowerCase()
  if (v.includes('uzbek') || v.includes('oʻzbek') || v.includes('o‘zbek') || v.includes('ozbek')) return 'modernUzbek'
  if (v.includes('classic') || v.includes('klassik')) return 'classic'
  if (v.includes('minimal')) return 'minimal'
  return 'japandi'
}
