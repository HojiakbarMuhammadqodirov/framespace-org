import { useEffect, useState } from 'react'

import { buildEquirect } from '@/lib/equirect.js'
import type { PanoramaPlan } from './renders'

/**
 * Builds the 4096 × 2048 panorama once, off the frozen `buildEquirect()`.
 *
 * The stitching itself is not ours to rewrite (docs/API-INVENTORY.md §4) — the
 * only thing added here is lifecycle: cancel on unmount so a slow decode does
 * not set state on a dead component, and hold the canvas so switching modes
 * and coming back does not re-stitch four data URLs.
 */

export type EquirectStatus = 'idle' | 'building' | 'ready' | 'error'

export interface EquirectResult {
  status: EquirectStatus
  canvas: HTMLCanvasElement | null
  error: Error | null
}

export function useEquirect(plan: PanoramaPlan | null, enabled = true): EquirectResult {
  const [result, setResult] = useState<EquirectResult>({
    status: 'idle',
    canvas: null,
    error: null,
  })

  useEffect(() => {
    if (!enabled || !plan) return
    let cancelled = false
    setResult({ status: 'building', canvas: null, error: null })

    buildEquirect(plan.renders)
      .then((canvas: HTMLCanvasElement) => {
        if (cancelled) return
        setResult({ status: 'ready', canvas, error: null })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setResult({
          status: 'error',
          canvas: null,
          error: error instanceof Error ? error : new Error(String(error)),
        })
      })

    return () => {
      cancelled = true
    }
  }, [plan, enabled])

  return result
}
