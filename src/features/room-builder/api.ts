/**
 * Client for `POST /api/render-scene`.
 *
 * The body is exactly the scene payload from `./payload`. A 200 answers with
 * the same shape as `POST /api/render` (design brief, renders, failures), so
 * the result page can show a builder generation exactly like a captured one.
 */
import type { RenderResponse } from '@/features/capture/types'
import { ensureAwake, isGatewayFailure, markAwake } from '@/lib/wake'
import type { RenderQuota } from '@/store/session'

import type { ScenePayload } from './payload'

export const RENDER_SCENE_URL = '/api/render-scene'
/** Generations take up to a couple of minutes on a real model. */
export const RENDER_TIMEOUT_MS = 120_000

export type RenderSceneErrorKind =
  | 'offline'
  | 'timeout'
  | 'aborted'
  | 'server'
  | 'quota'
  | 'bad-response'
  /** 401 `unauthenticated` — renders cost money, so they need an account. */
  | 'signin'
  /** 429 `quota_exceeded` — today's allowance is used up. */
  | 'dailyQuota'
  /** 503 `capacity` — the service-wide daily cap is reached. */
  | 'capacity'

export class RenderSceneError extends Error {
  kind: RenderSceneErrorKind
  status?: number
  /** The server's `details` (for `dailyQuota`: `{ quota, resetsAt }`). */
  details?: { quota?: RenderQuota; resetsAt?: string }
  constructor(kind: RenderSceneErrorKind, message: string, status?: number, details?: RenderSceneError['details']) {
    super(message)
    this.kind = kind
    this.status = status
    this.details = details
  }
}

const KIND_BY_CODE: Record<string, RenderSceneErrorKind> = {
  unauthenticated: 'signin',
  quota_exceeded: 'dailyQuota',
  capacity: 'capacity',
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
      // Wake a sleeping free-tier server before sending (POSTs never retry).
      await ensureAwake()
      if (controller.signal.aborted) throw new Error('aborted')
      res = await fetch(RENDER_SCENE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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

    if (isGatewayFailure(res)) throw new RenderSceneError('offline', `HTTP ${res.status}`, res.status)
    markAwake()

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
      const body = (data && typeof data === 'object' ? data : {}) as { code?: string; details?: RenderSceneError['details'] }
      const kind =
        (body.code && KIND_BY_CODE[body.code]) || (res.status === 429 || res.status === 402 ? 'quota' : 'server')
      throw new RenderSceneError(kind, message, res.status, body.details)
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
