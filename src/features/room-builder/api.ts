/**
 * Client for `POST /api/render-scene`.
 *
 * The body is exactly the scene payload from `./payload`. A 200 answers with
 * the same shape as `POST /api/render` (design brief, renders, failures), so
 * the result page can show a builder generation exactly like a captured one.
 */
import type { RenderResponse } from '@/features/capture/types'

import type { ScenePayload } from './payload'

export const RENDER_SCENE_URL = '/api/render-scene'
/** Generations take up to a couple of minutes on a real model. */
export const RENDER_TIMEOUT_MS = 120_000

export type RenderSceneErrorKind = 'offline' | 'timeout' | 'aborted' | 'server' | 'quota' | 'bad-response'

export class RenderSceneError extends Error {
  kind: RenderSceneErrorKind
  status?: number
  constructor(kind: RenderSceneErrorKind, message: string, status?: number) {
    super(message)
    this.kind = kind
    this.status = status
  }
}

export async function renderScene(
  payload: ScenePayload,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<RenderResponse> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new RenderSceneError('offline', 'You are offline.')
  }

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, options.timeoutMs ?? RENDER_TIMEOUT_MS)
  const onOuterAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onOuterAbort)

  try {
    let res: Response
    try {
      res = await fetch(RENDER_SCENE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } catch (err) {
      if (timedOut) throw new RenderSceneError('timeout', 'The generation took too long.')
      if (options.signal?.aborted) throw new RenderSceneError('aborted', 'Cancelled.')
      throw new RenderSceneError(
        'offline',
        err instanceof Error ? err.message : 'Network request failed.'
      )
    }

    let data: unknown = null
    try {
      data = await res.json()
    } catch {
      data = null
    }

    if (!res.ok) {
      const message =
        (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
          ? (data as { error: string }).error
          : '') || `HTTP ${res.status}`
      throw new RenderSceneError(res.status === 429 || res.status === 402 ? 'quota' : 'server', message, res.status)
    }

    if (!data || typeof data !== 'object') {
      throw new RenderSceneError('bad-response', 'The server sent an empty answer.')
    }
    const body = data as RenderResponse
    if (!Array.isArray(body.renders) || body.renders.length === 0) {
      const failure = body.failures?.[0]?.error
      throw new RenderSceneError('server', failure || 'No images came back.')
    }
    return body
  } catch (err) {
    if (err instanceof RenderSceneError) throw err
    if (timedOut) throw new RenderSceneError('timeout', 'The generation took too long.')
    throw new RenderSceneError('server', err instanceof Error ? err.message : String(err))
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onOuterAbort)
  }
}
