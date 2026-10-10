// Cost controls for the two routes that spend money on AI providers.
//
// In front of /api/render and /api/render-scene, in this order:
//   1. the per-IP rate limit (lib/http.js, unchanged)
//   2. sign-in required                       → 401 unauthenticated
//   3. the user's daily allowance              → 429 quota_exceeded
//   4. a global daily cap across all users      → 503 capacity
//
// Counters are per UTC day and live in storage (JSON file or Postgres), so a
// restart does not hand everyone a fresh allowance. A unit is taken before the
// work starts — two parallel requests cannot both squeeze past the limit — and
// the user's unit is given back if the request ends in an error (4xx/5xx).
// The global unit is not given back: a failed call may still have been billed,
// and the global cap exists to protect the bill.
//
// None of this applies while the server cannot spend money (no API keys), so
// the demo stays clickable without an account. RENDER_LIMITS_IN_DEMO=true
// switches it on anyway — handy for testing the 401/429/503 paths for free.

import { HttpError } from './lib/http.js'
import { resolveLocale, t as tr } from './i18n.js'

const DAY_MS = 24 * 60 * 60 * 1000

/** 'YYYY-MM-DD' of the current UTC day. */
export function utcDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10)
}

/** ISO timestamp of the next UTC midnight — when today's counters reset. */
export function nextUtcMidnight(now = Date.now()) {
  return new Date(Math.floor(now / DAY_MS) * DAY_MS + DAY_MS).toISOString()
}

const intEnv = (name, fallback) => {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
}

/**
 * @param {object} opts
 * @param {object} opts.storage   from lib/storage.js
 * @param {object} opts.auth      from auth.js (for currentUser)
 * @param {() => boolean} opts.billable  true when a render can cost money
 */
export function createRenderGuard({ storage, auth, billable }) {
  const dailyQuota = intEnv('RENDER_DAILY_QUOTA', 5)
  const globalCap = intEnv('GLOBAL_DAILY_RENDER_CAP', 100)
  const inDemo = process.env.RENDER_LIMITS_IN_DEMO === 'true'

  /** Whether login + quota + cap are enforced right now. */
  const enforced = () => billable() || inDemo

  /** The quota object the client shows: `{ limit, used, remaining, resetsAt }`. */
  function quotaView(used) {
    return {
      limit: dailyQuota,
      used: Math.min(used, dailyQuota),
      remaining: Math.max(0, dailyQuota - used),
      resetsAt: nextUtcMidnight(),
    }
  }

  /** For `/api/auth/me` and `/api/quota`. `quota` is null for guests. */
  async function describe(user) {
    const requireAuth = enforced()
    if (!user || !requireAuth) return { quota: null, renderAccess: { requireAuth, dailyQuota } }
    const used = await storage.quota.used(user.id, utcDay())
    return { quota: quotaView(used), renderAccess: { requireAuth, dailyQuota } }
  }

  /** Express middleware. Sets `req.renderQuota` for the route to echo back. */
  async function guard(req, res, next) {
    try {
      if (!enforced()) return next()
      const E = tr(resolveLocale(req.query?.locale, req.headers['accept-language'])).errors

      const user = await auth.currentUser(req)
      if (!user) throw new HttpError(401, E.unauthenticated, { code: 'unauthenticated' })

      const day = utcDay()
      const resetsAt = nextUtcMidnight()
      const mine = await storage.quota.reserve(user.id, day, dailyQuota)
      if (!mine.ok) {
        const retryAfter = Math.max(1, Math.ceil((Date.parse(resetsAt) - Date.now()) / 1000))
        throw new HttpError(429, E.quotaExceeded(dailyQuota), {
          code: 'quota_exceeded',
          headers: { 'Retry-After': String(retryAfter) },
          details: { quota: quotaView(mine.used), resetsAt },
        })
      }

      const global = await storage.counters.reserve('renders', day, globalCap)
      if (!global.ok) {
        await storage.quota.release(user.id, day).catch(() => {})
        console.warn(JSON.stringify({ level: 'warn', type: 'global_render_cap', day, cap: globalCap }))
        throw new HttpError(503, E.capacity, {
          code: 'capacity',
          headers: { 'Retry-After': String(Math.max(60, Math.ceil((Date.parse(resetsAt) - Date.now()) / 1000))) },
          details: { resetsAt },
        })
      }

      req.renderQuota = quotaView(mine.used)
      // Give the user's unit back if the render does not succeed — on any
      // error response, or when the route decides the result was not worth
      // one (req.releaseRenderQuota). Only ever once.
      let released = false
      req.releaseRenderQuota = () => {
        if (released) return
        released = true
        req.renderQuota = quotaView(mine.used - 1)
        storage.quota.release(user.id, day).catch((err) => console.error('[quota] release failed:', err.message))
      }
      res.on('finish', () => {
        if (res.statusCode >= 400) req.releaseRenderQuota()
      })
      next()
    } catch (err) {
      next(err)
    }
  }

  return { guard, describe, enforced, settings: { dailyQuota, globalCap, inDemo } }
}
