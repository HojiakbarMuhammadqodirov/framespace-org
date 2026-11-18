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
/**
 * A live generation is one Claude brief plus four image calls, each with its
 * own retries; the server allows itself six minutes (RENDER_TIMEOUT_MS in
 * server/index.js). Giving up at two — as this used to — abandoned requests
 * the server was about to answer. Four minutes covers a retried provider call
 * without leaving anyone staring at a dead connection for long.
 */
export const RENDER_TIMEOUT_MS = 240_000

export type RenderSceneErrorKind =
  | 'offline'
  | 'timeout'
  | 'aborted'
  | 'server'
  /** The account's monthly allowance (or the guest's free render) is spent. */
  | 'quota'
  /** Too many requests from this network in a short time — wait, don't upgrade. */
  | 'rate-limited'
  /** The AI provider is overloaded or timed out; trying again shortly works. */
  | 'busy'
  /** The server refused the scene itself (400). Retrying the same room will not help. */
  | 'invalid'
  | 'bad-response'

export class RenderSceneError extends Error {
  kind: RenderSceneErrorKind
  status?: number
  /** The server's machine-readable `code`, when it sent one. */
  code?: string
  constructor(kind: RenderSceneErrorKind, message: string, status?: number, code?: string) {
    super(message)
    this.kind = kind
    this.status = status
    this.code = code
  }
}

/** Server status + `code` → what the sheet should say and offer. */
function kindOf(status: number, code: string): RenderSceneErrorKind {
  if (code === 'quota_exceeded' || status === 402) return 'quota'
  if (code === 'rate_limited' || status === 429) return 'rate-limited'
  if (code === 'provider_busy' || code === 'provider_timeout' || code === 'timeout' || status === 503 || status === 504) {
    return 'busy'
  }
  if (code === 'validation' || code === 'invalid_json' || code === 'payload_too_large' || status === 400 || status === 413) {
    return 'invalid'
  }
  return 'server'
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
        // The session cookie rides along: a signed-in generation is counted
        // against the account's allowance on the server.
        credentials: 'include',
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
      const body = (data && typeof data === 'object' ? data : {}) as { error?: unknown; code?: unknown }
      const message = (typeof body.error === 'string' ? body.error : '') || `HTTP ${res.status}`
      const code = typeof body.code === 'string' ? body.code : ''
      throw new RenderSceneError(kindOf(res.status, code), message, res.status, code)
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
