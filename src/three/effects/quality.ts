/**
 * Cheap, cached device tiering shared by every 3D surface: the hero room, the
 * product viewers, the live panorama and the room builder (which re-exports
 * it from `src/features/room-builder/quality.ts`).
 *
 * One probe context is created per page load, ever. It answers both "is there
 * WebGL at all" and "which GPU is it", and is released immediately. Detection
 * is cached forever and never touches a frame.
 */
export type SceneTier = 'high' | 'low'

export interface WebGLProbe {
  /** A webgl2 or webgl context could be created. */
  supported: boolean
  /** Unmasked renderer string, or '' when the browser hides it. */
  renderer: string
}

let probed: WebGLProbe | null = null
let cached: SceneTier | null = null

/** GPUs that will not hold 60fps with extra shadow/atmosphere passes. */
const WEAK_GPU = /swiftshader|software|llvmpipe|mali-(4|t6|t7|t8)|adreno \(tm\) [1-5]\d\d|powervr/i

/** The single, cached WebGL probe. The context is released immediately. */
export function probeWebGL(): WebGLProbe {
  if (probed) return probed
  if (typeof document === 'undefined') return { supported: false, renderer: '' }
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl2') ||
      canvas.getContext('webgl')) as WebGLRenderingContext | null
    if (!gl) {
      probed = { supported: false, renderer: '' }
      return probed
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '') : ''
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    probed = { supported: true, renderer }
  } catch {
    probed = { supported: false, renderer: '' }
  }
  return probed
}

export function detectSceneTier(): SceneTier {
  if (cached) return cached
  if (typeof navigator === 'undefined') {
    cached = 'high'
    return cached
  }

  const cores = navigator.hardwareConcurrency ?? 8
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const gpu = probeWebGL().renderer

  cached = cores <= 4 || memory <= 2 || (gpu !== '' && WEAK_GPU.test(gpu)) ? 'low' : 'high'
  return cached
}
