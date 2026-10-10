import { realModelUrl, type RealModelId } from '@/three/furniture/real'

/**
 * Where the AR furniture models come from.
 *
 * The sofa and the table are real, freely licensed glTF models shared with the
 * catalog and the room builder (`src/three/furniture/real.tsx`, credits in
 * `public/models/furniture/CREDITS.md`). `ArScene` renders them scaled into
 * `size`, with the placeholder geometry as the loading/error fallback, so
 * nothing shifts when a model lands. The lamp has no good free model yet and
 * keeps its placeholder. No `.usdz` exists, so AR Quick Look (iOS) still says
 * so plainly — `ModeAugmented` branches on `usdz` being present.
 */

export interface LiveModel {
  id: string
  /** i18n key under `live.ar.items.*`. */
  labelKey: string
  /** Metres: width (x), height (y), depth (z). Drives the model and the placeholder. */
  size: [number, number, number]
  /** Real model rendered in WebXR, or null for the placeholder. */
  real: RealModelId | null
  /** Its .glb URL (for <model-viewer> / Scene Viewer). Null when `real` is. */
  glb: string | null
  /** iOS AR Quick Look. Null until a .usdz is produced. */
  usdz: string | null
  /** Which placeholder to build while loading, or when `real` is null. */
  placeholder: 'seat' | 'table' | 'lamp'
}

function live(
  id: string,
  size: [number, number, number],
  real: RealModelId | null,
  placeholder: LiveModel['placeholder']
): LiveModel {
  return {
    id,
    labelKey: `live.ar.items.${id}`,
    size,
    real,
    glb: real ? realModelUrl(real) : null,
    usdz: null,
    placeholder,
  }
}

export const LIVE_MODELS: LiveModel[] = [
  live('sofa', [2.05, 0.78, 0.92], 'sofa-glam', 'seat'),
  live('table', [1.1, 0.45, 0.6], 'coffeetable-stone', 'table'),
  live('lamp', [0.34, 1.55, 0.34], null, 'lamp'),
]

export function modelById(id: string): LiveModel | undefined {
  return LIVE_MODELS.find((m) => m.id === id)
}

/** True once at least one item has a real asset for the platform in question. */
export function hasAssets(kind: 'glb' | 'usdz'): boolean {
  return LIVE_MODELS.some((m) => m[kind] != null)
}
