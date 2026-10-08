/**
 * Where the furniture models will come from.
 *
 * There are no .glb or .usdz files in this repository and none may be
 * downloaded, so this registry is empty and the AR modes say so plainly
 * instead of pretending. The shape is the point: when the catalog (step 9)
 * starts producing assets, filling `glb` and `usdz` in is the entire change —
 * `ModeAugmented` already branches on their presence, `<model-viewer>` and AR
 * Quick Look already read them, and the placeholder geometry already carries
 * the same footprint so nothing shifts when a real model lands.
 */

export interface LiveModel {
  id: string
  /** i18n key under `live.ar.items.*`. */
  labelKey: string
  /** Metres: width (x), height (y), depth (z). Drives the placeholder. */
  size: [number, number, number]
  /** Loaded by WebXR / <model-viewer>. Null until the catalog ships one. */
  glb: string | null
  /** iOS AR Quick Look. Null until the catalog ships one. */
  usdz: string | null
  /** Which placeholder to build when `glb` is null. */
  placeholder: 'seat' | 'table' | 'lamp'
}

export const LIVE_MODELS: LiveModel[] = [
  { id: 'sofa', labelKey: 'live.ar.items.sofa', size: [2.05, 0.78, 0.92], glb: null, usdz: null, placeholder: 'seat' },
  { id: 'table', labelKey: 'live.ar.items.table', size: [1.1, 0.45, 0.6], glb: null, usdz: null, placeholder: 'table' },
  { id: 'lamp', labelKey: 'live.ar.items.lamp', size: [0.34, 1.55, 0.34], glb: null, usdz: null, placeholder: 'lamp' },
]

export function modelById(id: string): LiveModel | undefined {
  return LIVE_MODELS.find((m) => m.id === id)
}

/** True once at least one item has a real asset for the platform in question. */
export function hasAssets(kind: 'glb' | 'usdz'): boolean {
  return LIVE_MODELS.some((m) => m[kind] != null)
}
