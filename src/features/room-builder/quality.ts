/**
 * Device tiering for the editor scene.
 *
 * The target is 60fps on a mid Android. Where that is not plausible we drop to
 * a low-poly path: no shadow maps, coarser lathe segments, no soft contact
 * shadow, no rug motif. Detection itself lives in the shared 3D tiering
 * (`src/three/effects/quality.ts`) so the whole app shares one probe context
 * and agrees on what "mid Android" means.
 */
import { detectSceneTier, type SceneTier } from '@/three/effects/quality'

export { detectSceneTier }

export type QualityTier = SceneTier

/** Kept for existing callers; identical to `detectSceneTier`. */
export function detectQuality(): QualityTier {
  return detectSceneTier()
}

export interface QualitySettings {
  shadows: boolean
  shadowMap: number
  /** Radial segments for cylinders and spheres. */
  segments: number
  /** Draw the rug motif and the secondary fill light. */
  detail: boolean
}

export const QUALITY: Record<QualityTier, QualitySettings> = {
  high: { shadows: true, shadowMap: 1024, segments: 20, detail: true },
  low: { shadows: false, shadowMap: 512, segments: 8, detail: false },
}
