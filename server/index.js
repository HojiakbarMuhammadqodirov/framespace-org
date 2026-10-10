import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'

import { ANGLES, REQUIRED_ANGLE_IDS, angleById, RENDERABLE_ANGLE_IDS } from './angles.js'
import { buildDesignBrief, buildSceneBrief, claudeConfigured, CLAUDE_MODEL } from './claude.js'
import { renderAll, renderSceneAll, geminiConfigured, GEMINI_MODEL, MAX_IMAGES_PER_REQUEST } from './gemini.js'
import { demoBrief, demoRenders } from './demo.js'
import { demoSceneBrief, demoSceneRender, sceneExistingFeatures, sceneFurniture } from './sceneDemo.js'
import { SCENE_VIEWS, describeScene, sceneLines, validateScene, viewPrompt } from './scene.js'
import { createAuth } from './auth.js'
import { createRenderGuard } from './quota.js'
import { angleLabel, resolveLocale, t as tr } from './i18n.js'
import { createStorage } from './lib/storage.js'
import {
  HttpError,
  apiNotFound,
  asyncRoute,
  badRequest,
  errorHandler,
  isProd,
  logEvent,
  rateLimit,
  requestLogger,
  securityHeaders,
  timeout,
} from './lib/http.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(here, 'data'))

// Postgres when DATABASE_URL is set, JSON files under DATA_DIR otherwise. A
// database that cannot be reached is fatal at boot: better a failed deploy
// than a server that loses every sign-up.
let storage
try {
  storage = await createStorage({ dataDir: DATA_DIR })
} catch (err) {
  logEvent('error', 'storage_init_failed', { error: err })
  process.exit(1)
}

const app = express()
app.disable('x-powered-by')
// Behind a reverse proxy set TRUST_PROXY so req.ip and req.secure reflect the
// real client — rate limits need it. Render alone: 1. Vercel rewrite → Render
// (two proxies, see render.yaml): 2.
if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY)

app.use(securityHeaders)
app.use(requestLogger)

// CORS is off by default: the Vite dev server proxies /api and production
// serves the SPA from this same origin. Set CORS_ORIGINS (comma-separated) only
// if a different origin genuinely needs to call the API.
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
if (corsOrigins.length) app.use('/api', cors({ origin: corsOrigins, credentials: true }))

// Body limits: six photos at ~1280px come to a few MB of base64; everything
// else is small JSON. The big render body is parsed inside the route, *after*
// the sign-in and quota checks, so an anonymous client cannot make the server
// read 30 MB just to be told 401. Client error reports get a tiny limit.
const RENDER_BODY_LIMIT = process.env.RENDER_BODY_LIMIT || '30mb'
const renderBody = express.json({ limit: RENDER_BODY_LIMIT })
const smallBody = express.json({ limit: '1mb' })
const tinyBody = express.json({ limit: '16kb' })
app.use('/api', (req, res, next) => {
  if (req.path === '/render') return next()
  if (req.path === '/client-errors') return tinyBody(req, res, next)
  return smallBody(req, res, next)
})

const demoMode = !claudeConfigured() || !geminiConfigured()
// Any configured key can spend money — Claude alone runs on /api/render even
// while Gemini is missing (demoMode is still true then). Cost controls key off
// this, not off demoMode.
const billable = () => claudeConfigured() || geminiConfigured()

// ------------------------------------------------------------------- health
// Cheap on purpose (no database round trip): Render's health checker and the
// frontend's wake-up probe both hit it.
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    demoMode,
    providers: { claude: claudeConfigured(), gemini: geminiConfigured() },
    models: { claude: CLAUDE_MODEL, gemini: GEMINI_MODEL },
    storage: storage.kind,
    renders: { requireAuth: renderGuard.enforced(), dailyQuota: renderGuard.settings.dailyQuota },
    uptimeS: Math.round(process.uptime()),
  })
})

app.get('/api/angles', (req, res) => {
  res.json({ angles: ANGLES, requiredAngleIds: REQUIRED_ANGLE_IDS })
})

// --------------------------------------------------------------------- auth
// /me reports the render quota too. Auth and the guard need each other, so the
// callback resolves `renderGuard` per request, after both exist.
let renderGuard
const auth = createAuth({ storage, describeUser: (user) => renderGuard.describe(user) })
renderGuard = createRenderGuard({ storage, auth, billable })
app.use('/api/auth', timeout(30_000), auth.router)

// Remaining renders today for the signed-in user (`quota: null` for guests).
app.get(
  '/api/quota',
  asyncRoute(async (req, res) => {
    const user = await auth.currentUser(req)
    res.json(await renderGuard.describe(user))
  })
)

// ------------------------------------------------------------------- render
const renderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.RENDER_RATE_LIMIT || 20),
  name: 'render requests',
})
const RENDER_TIMEOUT_MS = Number(process.env.RENDER_TIMEOUT_MS || 6 * 60 * 1000)

const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/
const MAX_PHOTO_BASE64 = 10 * 1024 * 1024

function validateRender(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Send the photos and style as a JSON object.', { body: 'must be an object' })
  }
  const { photos, style, notes } = body
  if (!Array.isArray(photos) || photos.length === 0) throw badRequest('Send at least one photo.', { photos: 'required' })
  if (photos.length > ANGLES.length) {
    throw badRequest(`Send at most ${ANGLES.length} photos.`, { photos: `at most ${ANGLES.length}` })
  }
  if (!style || typeof style !== 'string' || style.length > 64) {
    throw badRequest('Pick a design style first.', { style: 'required' })
  }
  if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 2000)) {
    throw badRequest('Keep your note under 2000 characters.', { notes: 'at most 2000 characters' })
  }

  const cleaned = []
  const seen = new Set()
  for (const [i, p] of photos.entries()) {
    if (!p || typeof p !== 'object') throw badRequest(`Photo ${i + 1} is not valid.`, { [`photos[${i}]`]: 'must be an object' })
    if (!angleById(p.angleId)) throw badRequest(`Unknown angle "${String(p.angleId).slice(0, 40)}".`, { [`photos[${i}].angleId`]: 'unknown' })
    if (seen.has(p.angleId)) throw badRequest(`Two photos were sent for "${p.angleId}".`, { [`photos[${i}].angleId`]: 'duplicate' })
    seen.add(p.angleId)
    if (!p.data || typeof p.data !== 'string') {
      throw badRequest(`Photo for "${p.angleId}" has no image data.`, { [`photos[${i}].data`]: 'required' })
    }
    // Accept a full data URL as well as bare base64.
    let data = p.data
    let mediaType = p.mediaType
    const m = /^data:([^;,]+);base64,/.exec(data)
    if (m) {
      mediaType = mediaType || m[1]
      data = data.slice(m[0].length)
    }
    mediaType = String(mediaType || 'image/jpeg').toLowerCase()
    if (mediaType === 'image/jpg') mediaType = 'image/jpeg'
    if (!MEDIA_TYPES.includes(mediaType)) {
      throw badRequest(`Photo for "${p.angleId}" must be JPEG, PNG, WebP or GIF.`, { [`photos[${i}].mediaType`]: 'unsupported' })
    }
    if (data.length > MAX_PHOTO_BASE64) {
      throw badRequest(`Photo for "${p.angleId}" is too large.`, { [`photos[${i}].data`]: 'too large' })
    }
    if (data.length < 16 || !BASE64_RE.test(data)) {
      throw badRequest(`Photo for "${p.angleId}" is not valid base64 image data.`, { [`photos[${i}].data`]: 'invalid base64' })
    }
    cleaned.push({ angleId: p.angleId, data, mediaType })
  }

  const missing = REQUIRED_ANGLE_IDS.filter((id) => !seen.has(id))
  if (missing.length) {
    const labels = missing.map((id) => angleById(id)?.label || id).join(', ')
    throw badRequest(`Still need a photo of: ${labels}.`, { photos: `missing ${missing.join(', ')}` })
  }

  const rawBudget = body.budget
  let budget = null
  if (rawBudget && typeof rawBudget === 'object' && Number(rawBudget.limit) > 0) {
    const limit = Number(rawBudget.limit)
    if (!Number.isFinite(limit) || limit > 1e13) throw badRequest('That budget is not a sensible number.', { 'budget.limit': 'invalid' })
    const currency = typeof rawBudget.currency === 'string' && /^[A-Za-z]{3}$/.test(rawBudget.currency) ? rawBudget.currency.toUpperCase() : 'USD'
    budget = { limit, currency }
  }

  return { photos: cleaned, style: style.trim(), notes: typeof notes === 'string' ? notes.trim() : '', budget }
}

/** Map a provider (Claude / Gemini) failure to a status the client can act on. */
function providerFailure(err, what, locale = 'en') {
  const E = tr(locale).errors
  const status = Number(err?.status || 0)
  logEvent('error', 'provider_error', { stage: what, status: status || undefined, message: String(err?.message || err).slice(0, 500) })
  if (err?.expose && (status === 422 || status === 502)) return new HttpError(status, err.message, { code: 'provider_error' })
  if (status === 429 || status === 529) {
    return new HttpError(503, E.busy, { code: 'provider_busy', headers: { 'Retry-After': '30' } })
  }
  if (status === 504 || /timed? ?out/i.test(err?.message || '')) {
    return new HttpError(504, E.timeout, { code: 'provider_timeout' })
  }
  return new HttpError(502, E.failed, { code: 'provider_error' })
}

function reconcileBudget(brief, budget) {
  // Trust but verify the budget arithmetic — the total that reaches the user
  // is computed here from the line items, not taken on faith.
  const computedTotal = (brief.furniture || []).reduce(
    (sum, item) => sum + Number(item.averagePrice || 0) * Number(item.quantity || 1),
    0
  )
  brief.budget = {
    ...brief.budget,
    currency: budget?.currency || brief.budget?.currency || 'USD',
    limit: budget?.limit || 0,
    estimatedTotal: Math.round(computedTotal),
    withinBudget: !budget?.limit || Math.round(computedTotal) <= budget.limit,
  }
}

// The whole pipeline: Claude reads the room and designs it, Gemini renders it.
app.post(
  '/api/render',
  renderLimiter,
  renderGuard.guard,
  renderBody,
  timeout(RENDER_TIMEOUT_MS),
  asyncRoute(async (req, res) => {
    const { photos, style, notes, budget } = validateRender(req.body)
    // Prose comes back in the user's language: body.locale, else Accept-Language, else Uzbek.
    const locale = resolveLocale(req.body.locale, req.headers['accept-language'])
    const startedAt = Date.now()

    // --- Step 1: the design brief -------------------------------------------
    let brief
    try {
      brief = claudeConfigured()
        ? await buildDesignBrief({ photos, style, budget, notes, locale })
        : demoBrief({ photos, style, budget, notes, locale })
    } catch (err) {
      throw providerFailure(err, 'render:brief', locale)
    }
    reconcileBudget(brief, budget)
    if (req.timedOut) return

    // --- Step 2: the renders -------------------------------------------------
    const photoByAngle = new Map(photos.map((p) => [p.angleId, p]))
    const jobs = (Array.isArray(brief.renderPrompts) ? brief.renderPrompts : [])
      .filter((rp) => rp && photoByAngle.has(rp.angleId) && RENDERABLE_ANGLE_IDS.includes(rp.angleId))
      .filter((rp, i, all) => all.findIndex((x) => x.angleId === rp.angleId) === i)
      .slice(0, Math.min(4, MAX_IMAGES_PER_REQUEST))
      .map((rp) => ({
        angleId: rp.angleId,
        angleLabel: rp.angleLabel || angleLabel(rp.angleId, locale, angleById(rp.angleId)?.label),
        prompt: String(rp.prompt || ''),
        photo: photoByAngle.get(rp.angleId),
      }))

    const { renders, failures } = geminiConfigured() ? await renderAll({ jobs }) : demoRenders({ brief, style })
    if (req.timedOut) return

    if (!renders.length) {
      throw new HttpError(502, tr(locale).errors.noImages, {
        code: 'render_failed',
        details: failures,
      })
    }

    res.json({
      demoMode,
      style,
      locale,
      brief,
      renders,
      failures,
      elapsedMs: Date.now() - startedAt,
      ...(req.renderQuota ? { quota: req.renderQuota } : {}),
    })
  })
)

// The 3D room builder: a scene instead of photographs. Same response shape as
// /api/render so the result page displays either.
app.post(
  '/api/render-scene',
  renderLimiter,
  renderGuard.guard,
  timeout(RENDER_TIMEOUT_MS),
  asyncRoute(async (req, res) => {
    const scene = validateScene(req.body)
    scene.locale = resolveLocale(req.body.locale, req.headers['accept-language'])
    const startedAt = Date.now()
    const warnings = []
    const lines = sceneLines(scene)

    // --- Step 1: brief. Furniture and prices come from the scene itself; Claude
    // (when configured) writes the design, descriptions and image prompts.
    const brief = demoSceneBrief(scene)
    if (claudeConfigured()) {
      try {
        const ai = await buildSceneBrief({ scene, lines, views: SCENE_VIEWS, description: describeScene(scene) })
        brief.demo = false
        if (ai.design) brief.design = ai.design
        if (ai.lightingNotes) brief.room.lightingNotes = ai.lightingNotes
        if (ai.budgetNotes) brief.budget.notes = ai.budgetNotes
        const furniture = sceneFurniture(scene)
        for (const note of ai.furnitureNotes || []) {
          const f = furniture[Number(note.line) - 1]
          if (!f) continue
          if (note.name) f.name = note.name
          if (note.description) f.description = note.description
          if (note.placement) f.placement = note.placement
        }
        brief.furniture = furniture
        brief.room.existingFeatures = sceneExistingFeatures(scene)
        const byAngle = new Map((ai.renderPrompts || []).map((rp) => [rp.angleId, rp]))
        brief.renderPrompts = SCENE_VIEWS.map((v) => ({
          angleId: v.angleId,
          angleLabel: v.angleLabel,
          prompt: byAngle.get(v.angleId)?.prompt || viewPrompt(scene, v, brief.design),
        }))
        brief.usage = ai.usage
      } catch (err) {
        const mapped = providerFailure(err, 'render-scene:brief', scene.locale)
        warnings.push({ stage: 'brief', error: mapped.message })
        // Keep going with the deterministic brief built from the scene.
      }
    }
    if (req.timedOut) return

    // --- Step 2: one image per view. Any view that fails falls back to the
    // demo perspective drawing so the result is always complete.
    let renders = []
    let failures = []
    if (geminiConfigured()) {
      const jobs = brief.renderPrompts.map((rp) => ({ ...rp }))
      ;({ renders, failures } = await renderSceneAll({ jobs }))
      if (req.timedOut) return
      const got = new Set(renders.map((r) => r.angleId))
      for (const rp of brief.renderPrompts) {
        if (got.has(rp.angleId)) continue
        renders.push({ ...rp, image: demoSceneRender(scene, rp.angleId, brief.design), fallback: true })
      }
      for (const f of failures) f.fallback = true
      const order = SCENE_VIEWS.map((v) => v.angleId)
      renders.sort((a, b) => order.indexOf(a.angleId) - order.indexOf(b.angleId))
    } else {
      renders = brief.renderPrompts.map((rp) => ({ ...rp, image: demoSceneRender(scene, rp.angleId, brief.design) }))
    }

    // Every provider failed and the person got only the drawings: that is not
    // worth one of their daily generations.
    if (billable() && brief.demo !== false && renders.every((r) => r.fallback)) req.releaseRenderQuota?.()

    res.json({
      demoMode,
      style: scene.style,
      locale: scene.locale,
      brief,
      renders,
      failures,
      warnings,
      elapsedMs: Date.now() - startedAt,
      ...(req.renderQuota ? { quota: req.renderQuota } : {}),
    })
  })
)

// ------------------------------------------------------------------ contact
const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, name: 'messages' })

app.post(
  '/api/contact',
  contactLimiter,
  asyncRoute(async (req, res) => {
    const b = req.body && typeof req.body === 'object' ? req.body : {}
    const str = (v) => (typeof v === 'string' ? v.trim() : '')
    const name = str(b.name)
    const email = str(b.email).toLowerCase()
    const message = str(b.message)
    if (!message) throw badRequest('Write a message first.', { message: 'required' })
    if (message.length > 5000) throw badRequest('Keep your message under 5000 characters.', { message: 'too long' })
    if (!email) throw badRequest('We need an email address to reply to.', { email: 'required' })
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw badRequest('That does not look like an email address.', { email: 'invalid' })
    }
    if (name.length > 120) throw badRequest('Keep your name under 120 characters.', { name: 'too long' })

    const user = await auth.currentUser(req)
    const entry = { name, email, message, userId: user?.id || null, receivedAt: new Date().toISOString() }
    try {
      await storage.messages.add(entry)
    } catch (err) {
      logEvent('error', 'storage_error', { op: 'contact', reqId: req.id, error: err })
      throw new HttpError(500, 'Could not save your message. Try again.', { code: 'storage' })
    }
    res.json({ ok: true })
  })
)

// ------------------------------------------------------------ client errors
// The browser's error reporter (src/lib/errorReporter.ts) posts here. Free,
// no third party: each report becomes one structured log line and the newest
// CLIENT_ERRORS_KEEP are kept in storage. Everything is re-sanitised here —
// never trust the client to have stripped what it promised to.
const CLIENT_ERRORS_KEEP = Math.max(10, Number(process.env.CLIENT_ERRORS_KEEP || 200))
const clientErrorLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30, name: 'error reports' })

const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : undefined)
/** Remove things that look like secrets or personal data from free text. */
function scrub(text) {
  if (!text) return text
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}/g, '[key]')
    .replace(/\b(?:eyJ[\w-]+\.){2}[\w-]+/g, '[jwt]')
    .replace(/data:[\w/+.-]+;base64,[A-Za-z0-9+/=]{16,}/g, '[data-url]')
    .replace(/(https?:\/\/[^\s?#'")]+)[?#][^\s'")]*/g, '$1') // query strings and fragments of URLs
}

app.post('/api/client-errors', clientErrorLimiter, (req, res) => {
  const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : null
  if (!b || typeof b.message !== 'string' || !b.message.trim()) {
    return res.status(400).json({ error: 'Send an error report as a JSON object with a message.', code: 'validation', fields: { message: 'required' } })
  }
  const entry = {
    receivedAt: new Date().toISOString(),
    kind: ['error', 'unhandledrejection', 'react', 'manual'].includes(b.kind) ? b.kind : 'error',
    message: scrub(clip(b.message, 500)),
    stack: scrub(clip(b.stack, 4000)),
    source: scrub(clip(b.source, 300)),
    line: Number.isFinite(b.line) ? b.line : undefined,
    column: Number.isFinite(b.column) ? b.column : undefined,
    path: scrub(clip(b.path, 300)),
    release: clip(b.release, 64),
    userAgent: clip(String(req.headers['user-agent'] || ''), 200),
    reqId: req.id,
  }
  logEvent('error', 'client_error', entry)
  // Storage is best effort: the log line above is the record that matters.
  storage.clientErrors.add(entry, CLIENT_ERRORS_KEEP).catch((err) => logEvent('warn', 'storage_error', { op: 'client-errors', error: err }))
  res.status(204).end()
})

// Unknown API routes get JSON, never the SPA shell.
app.use('/api', apiNotFound)

// ------------------------------------------------- production static + SPA
const dist = path.join(here, '..', 'dist')
const indexHtml = path.join(dist, 'index.html')
app.use(
  express.static(dist, {
    index: false,
    setHeaders(res, file) {
      // Vite fingerprints everything under assets/ — cache it forever.
      if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    },
  })
)
app.get(/.*/, (req, res, next) => {
  // Client routes only: a missing file with an extension is a real 404.
  if (path.extname(req.path) || !req.accepts('html')) return next()
  if (!fs.existsSync(indexHtml)) return next()
  res.setHeader('Cache-Control', 'no-cache')
  // `root` keeps send's dotfile guard to the file name: an absolute path with a
  // dot-directory anywhere in it (e.g. ~/.cache/app/dist) would otherwise 404.
  res.sendFile('index.html', { root: dist })
})
app.use((req, res) => {
  res.status(404).type('text/plain').send('Not found')
})

app.use(errorHandler)

// ---------------------------------------------------------------- lifecycle
// Hosts like Render route traffic to PORT on 0.0.0.0; binding only localhost
// would make the service unreachable there.
const port = Number(process.env.PORT) || 8787
const host = process.env.HOST || '0.0.0.0'
const server = app.listen(port, host, () => {
  console.log(`FrameSpace API on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}${isProd ? ' (production)' : ''}`)
  console.log(`  storage: ${storage.describe()}`)
  const g = renderGuard.settings
  console.log(
    `  renders: ${renderGuard.enforced() ? `sign-in required, ${g.dailyQuota}/user/day, ${g.globalCap}/day overall` : 'open (demo, nothing billable)'}; max ${MAX_IMAGES_PER_REQUEST} images/request`
  )
  if (demoMode) {
    console.log(
      `  DEMO MODE — claude:${claudeConfigured() ? 'ok' : 'missing key'} gemini:${
        geminiConfigured() ? 'ok' : 'missing key'
      }. Copy .env.example to .env to go live.`
    )
  }
})
// Renders hold a connection open for minutes; don't let Node cut them off.
server.requestTimeout = RENDER_TIMEOUT_MS + 30_000
server.headersTimeout = 65_000
server.keepAliveTimeout = 61_000

let shuttingDown = false
function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`${signal} received — closing server`)
  server.close(() => {
    storage
      .close()
      .catch(() => {})
      .finally(() => process.exit(0))
  })
  server.closeIdleConnections?.()
  // In-flight renders get a grace period, then we go regardless.
  setTimeout(() => {
    server.closeAllConnections?.()
    process.exit(0)
  }, Number(process.env.SHUTDOWN_GRACE_MS || 10_000)).unref()
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('unhandledRejection', (err) =>
  logEvent('error', 'unhandled_rejection', { error: err instanceof Error ? err : new Error(String(err)) })
)
