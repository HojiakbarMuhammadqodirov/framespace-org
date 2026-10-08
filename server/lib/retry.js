// Retry with exponential backoff + jitter for provider calls (Claude, Gemini).
// Only transient failures are retried: 408, 409, 429 and 5xx, plus network
// errors. Everything else (bad request, auth, refusal) fails fast.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function statusOf(err) {
  return Number(err?.status ?? err?.statusCode ?? err?.code ?? err?.error?.code ?? 0) || 0
}

export function isTransient(err) {
  const status = statusOf(err)
  if (status === 408 || status === 409 || status === 429 || (status >= 500 && status < 600)) return true
  const code = err?.cause?.code || err?.code
  if (['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT'].includes(code)) {
    return true
  }
  const msg = String(err?.message || '')
  return /overloaded|rate limit|timed? ?out|socket hang up|fetch failed|RESOURCE_EXHAUSTED|UNAVAILABLE/i.test(msg)
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{retries?: number, baseMs?: number, maxMs?: number, label?: string}} [opts]
 * @returns {Promise<T>}
 */
export async function withRetry(fn, { retries = 3, baseMs = 800, maxMs = 8000, label = 'call' } = {}) {
  let attempt = 0
  for (;;) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= retries || !isTransient(err)) throw err
      const retryAfter = Number(err?.headers?.['retry-after'] ?? err?.headers?.get?.('retry-after'))
      const backoff = Math.min(maxMs, baseMs * 2 ** attempt) * (0.7 + Math.random() * 0.6)
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 20_000) : backoff
      attempt += 1
      console.warn(`[retry] ${label} failed (${statusOf(err) || err?.message}); attempt ${attempt}/${retries} in ${Math.round(wait)}ms`)
      await sleep(wait)
    }
  }
}

/** Reject if `promise` takes longer than `ms`. */
export function withTimeout(promise, ms, label = 'operation') {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const err = new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)
        err.status = 504
        reject(err)
      }, ms)
    }),
  ]).finally(() => clearTimeout(timer))
}
