import i18n from '@/i18n/config'
import { apiGet, ensureAwake, isGatewayFailure, markAwake } from '@/lib/wake'

/**
 * Errors carry `status`, the server's `code` (`unauthenticated`,
 * `quota_exceeded`, `capacity`, `rate_limited`, …) and its `details`, so a
 * screen can pick its own translated copy instead of showing raw text.
 */
async function post(url, body, signal) {
  // A sleeping free-tier server is woken (and waited for) before the body is
  // sent: a POST is never retried, so it must not go out into a boot.
  await ensureAwake()
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
    signal,
  })
  if (!isGatewayFailure(res)) markAwake()
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(
      payload.error ||
        (res.status === 413 ? 'Photos are too large to send (413).' : `Request failed (${res.status})`)
    )
    err.status = res.status
    err.code = payload.code || (isGatewayFailure(res) ? 'gateway' : undefined)
    err.details = payload.details
    throw err
  }
  return payload
}

let healthCache = null
let healthAt = 0

export async function getHealth() {
  // A few screens ask at once; one answer per 15 s is plenty.
  if (healthCache && Date.now() - healthAt < 15_000) return healthCache
  try {
    const res = await apiGet('/api/health')
    if (!res.ok) throw new Error()
    healthCache = await res.json()
    healthAt = Date.now()
    return healthCache
  } catch {
    return { ok: false, demoMode: true, providers: { claude: false, gemini: false } }
  }
}

/** The render normally answers in ~30 s. Past this the request is abandoned. */
export const RENDER_TIMEOUT_MS = 120_000

/**
 * @param {object} project
 * @param {Record<string,{base64:string,mediaType:string}>} project.captures keyed by angleId
 * @param {AbortSignal} [signal] cancels the request (rejects with an AbortError)
 *
 * Rejects with an Error named `TimeoutError` (message `timeout`) when the
 * server has not answered within RENDER_TIMEOUT_MS, so a dead connection on a
 * phone ends in a retry screen instead of an endless wait. A caller-initiated
 * cancel rejects with an Error named `AbortError`.
 */
/** The UI language the brief should be written in ('uz' | 'ru' | 'en'). */
function currentLocale() {
  const lang = String(i18n.language || 'uz').slice(0, 2).toLowerCase()
  return lang === 'ru' || lang === 'en' ? lang : 'uz'
}

export async function requestRender({ captures, style, budget, notes, locale }, signal) {
  const photos = Object.entries(captures).map(([angleId, capture]) => ({
    angleId,
    data: capture.base64,
    mediaType: capture.mediaType,
  }))
  if (signal?.aborted) {
    const aborted = new Error('cancelled')
    aborted.name = 'AbortError'
    throw aborted
  }
  const controller = typeof AbortController === 'undefined' ? null : new AbortController()
  let timedOut = false
  const timer = controller
    ? setTimeout(() => {
        timedOut = true
        controller.abort()
      }, RENDER_TIMEOUT_MS)
    : null
  const forward = () => controller?.abort()
  signal?.addEventListener?.('abort', forward, { once: true })
  try {
    return await post(
      '/api/render',
      { photos, style, budget, notes, locale: locale || currentLocale() },
      controller?.signal
    )
  } catch (err) {
    if (err && err.name === 'AbortError') {
      if (timedOut) {
        const timeout = new Error('timeout')
        timeout.name = 'TimeoutError'
        throw timeout
      }
      const aborted = new Error('cancelled')
      aborted.name = 'AbortError'
      throw aborted
    }
    throw err
  } finally {
    if (timer) clearTimeout(timer)
    signal?.removeEventListener?.('abort', forward)
  }
}

export function sendContact(payload) {
  return post('/api/contact', payload)
}
