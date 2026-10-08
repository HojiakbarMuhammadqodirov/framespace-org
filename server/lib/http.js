// Small HTTP toolkit shared by every route: typed errors, a JSON error handler
// that never leaks stack traces, security headers, request logging, an
// in-memory rate limiter and a request timeout guard. No dependencies.

import crypto from 'node:crypto'

export const isProd = process.env.NODE_ENV === 'production'

export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message  user-facing
   * @param {{code?: string, fields?: Record<string,string>, details?: unknown, headers?: Record<string,string>}} [extra]
   */
  constructor(status, message, extra = {}) {
    super(message)
    this.status = status
    this.code = extra.code
    this.fields = extra.fields
    this.details = extra.details
    this.headers = extra.headers
  }
}

export const badRequest = (message, fields) =>
  new HttpError(400, message, { code: 'validation', fields })

/** Wrap an async handler so rejections reach the error middleware. */
export const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()')
  if (isProd && req.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store')
  next()
}

export function requestLogger(req, res, next) {
  const started = process.hrtime.bigint()
  req.id = crypto.randomBytes(6).toString('hex')
  res.setHeader('X-Request-Id', req.id)
  res.on('finish', () => {
    if (!req.originalUrl.startsWith('/api/')) return
    const ms = Number(process.hrtime.bigint() - started) / 1e6
    const len = res.getHeader('content-length')
    console.log(
      `${new Date().toISOString()} ${req.id} ${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${ms.toFixed(0)}ms${
        len ? ` ${len}b` : ''
      }`
    )
  })
  next()
}

/**
 * Fixed-window in-memory rate limiter keyed by client IP (plus an optional
 * discriminator). Good enough for a single process; swap for Redis when the
 * app runs on more than one.
 */
export function rateLimit({ windowMs, max, name, keyFn }) {
  const hits = new Map()
  const sweep = setInterval(() => {
    const now = Date.now()
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k)
  }, Math.max(windowMs, 10_000))
  sweep.unref()

  const limiter = (req, res, next) => {
    const key = `${req.ip}|${keyFn ? keyFn(req) : ''}`
    const now = Date.now()
    let entry = hits.get(key)
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs }
      hits.set(key, entry)
    }
    entry.count += 1
    res.setHeader('RateLimit-Limit', String(max))
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)))
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.reset - now) / 1000)
      res.setHeader('Retry-After', String(retryAfter))
      return next(
        new HttpError(429, `Too many ${name || 'requests'}. Try again in ${retryAfter}s.`, { code: 'rate_limited' })
      )
    }
    next()
  }
  limiter.reset = () => hits.clear()
  return limiter
}

/**
 * Gives a request a hard deadline. If the handler has not answered by then the
 * client gets a 504 JSON instead of a hung socket.
 */
export function timeout(ms) {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({ error: 'The server took too long to answer. Try again.', code: 'timeout' })
      }
      req.timedOut = true
    }, ms)
    timer.unref()
    res.on('finish', () => clearTimeout(timer))
    res.on('close', () => clearTimeout(timer))
    next()
  }
}

export function apiNotFound(req, res) {
  res.status(404).json({ error: `No API route for ${req.method} ${req.originalUrl.split('?')[0]}.`, code: 'not_found' })
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return
  // body-parser errors carry `type` and `status`.
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'The request is too large. Send smaller or fewer images.', code: 'payload_too_large' })
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request body is not valid JSON.', code: 'invalid_json' })
  }
  if (err instanceof HttpError) {
    if (err.headers) for (const [k, v] of Object.entries(err.headers)) res.setHeader(k, v)
    const body = { error: err.message }
    if (err.code) body.code = err.code
    if (err.fields) body.fields = err.fields
    if (err.details !== undefined) body.details = err.details
    return res.status(err.status).json(body)
  }
  const status = Number(err?.status || err?.statusCode)
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: err.expose ? err.message : 'Bad request.' })
  }
  console.error(`[error] ${req.id || ''} ${req.method} ${req.originalUrl}`, err)
  res.status(500).json({ error: 'Something went wrong on our side. Try again.', code: 'internal' })
}
