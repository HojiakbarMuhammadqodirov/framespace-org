// Per-account projects: the dashboard list, each finished generation (design
// brief + renders), the 3D builder scene behind it, and the furniture shortlist.
//
// Until this module existed all of that lived only in the browser's
// localStorage, so signing in on a second device showed an empty dashboard.
// The browser is still the working copy (guests never touch these routes);
// signed-in clients mirror every change here and pull on sign-in.
//
// Storage, under DATA_DIR/projects/<userId>/:
//   index.json        the list: one small metadata row per project + the shortlist
//   p_<projectId>.json the heavy part of one project: { record, scene }
// Splitting them keeps the list cheap to read (it is fetched on every visit)
// while a project's renders — a few hundred kB to a few MB of data URLs — are
// only read when that project is opened. Every write is atomic.
//
//   GET    /api/projects            → { projects: Meta[], deleted: string[] }
//   GET    /api/projects/:id        → { project: Meta & { record, scene } }
//   PUT    /api/projects/:id        → { project: Meta }   (upsert; omitted fields are kept)
//   DELETE /api/projects/:id        → 204
//   GET    /api/saved               → { items, updatedAt }
//   PUT    /api/saved  { items }    → { items, updatedAt }
//
// All routes answer 401 `unauthenticated` without a session.

import fs from 'node:fs/promises'
import path from 'node:path'
import express from 'express'
import { z } from 'zod'

import { JsonStore, atomicWriteJson } from './lib/jsonStore.js'
import { HttpError, asyncRoute, badRequest, timeout } from './lib/http.js'

const MAX_PROJECTS = Number(process.env.MAX_PROJECTS_PER_USER || 200)
const MAX_SAVED = 500
const MAX_TOMBSTONES = 1000
/** One project's heavy file, serialised. Renders are compacted client-side. */
const MAX_PROJECT_BYTES = 24 * 1024 * 1024
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
/** Only images may be stored as data URLs — they are rendered in <img>. */
const IMAGE_URL_RE = /^data:image\/(png|jpe?g|webp|gif|svg\+xml)[;,]/i

const STATUSES = ['draft', 'rendering', 'ready', 'failed']

// ------------------------------------------------------------------ schemas
// Deliberately loose below the top level: the builder's scene and the render
// response both gain optional fields over time (wall colour, floor material,
// per-item scale …) and an older server must store them untouched rather than
// reject or strip them. What is checked is what protects the store: types of
// the fields the server itself reads, counts, and sizes.

const imageUrl = z
  .string()
  .max(12 * 1024 * 1024)
  .regex(IMAGE_URL_RE, 'must be an image data URL')

const budgetSchema = z
  .looseObject({
    currency: z.string().max(8).optional(),
    limit: z.number().finite().nonnegative().optional(),
    estimatedTotal: z.number().finite().nonnegative().optional(),
  })
  .nullable()

const renderSchema = z.looseObject({
  angleId: z.string().min(1).max(40),
  image: imageUrl,
})

const recordSchema = z.looseObject({
  roomName: z.string().max(160).optional(),
  roomType: z.string().max(24).optional(),
  style: z.string().max(64).optional(),
  notes: z.string().max(4000).optional(),
  createdAt: z.string().max(40).optional(),
  before: z.record(z.string().max(40), imageUrl).optional(),
  result: z.looseObject({
    renders: z.array(renderSchema).max(12).optional(),
    brief: z.looseObject({}).nullable().optional(),
  }),
})

const sceneSchema = z.looseObject({
  room: z.looseObject({
    width: z.number().finite().positive().max(100),
    depth: z.number().finite().positive().max(100),
  }),
  items: z.array(z.looseObject({ id: z.string().max(64), catalogId: z.string().max(64) })).max(400),
  fixtures: z.array(z.looseObject({ id: z.string().max(64) })).max(200),
})

const putSchema = z.object({
  title: z.string().trim().max(160).optional(),
  roomType: z.string().max(24).optional(),
  style: z.string().max(64).optional(),
  status: z.enum(STATUSES).optional(),
  createdAt: z.string().max(40).optional(),
  notes: z.string().max(4000).optional(),
  budget: budgetSchema.optional(),
  /** A small JPEG for the dashboard card. null clears it. */
  cover: z.string().max(600_000).regex(IMAGE_URL_RE, 'must be an image data URL').nullable().optional(),
  /** The finished generation. null removes it; omitted keeps what is stored. */
  record: recordSchema.nullable().optional(),
  /** The 3D builder scene. null removes it; omitted keeps what is stored. */
  scene: sceneSchema.nullable().optional(),
})

const savedSchema = z.object({
  items: z
    .array(
      z.looseObject({
        id: z.string().min(1).max(80),
        name: z.string().max(200),
        category: z.string().max(40),
        style: z.string().max(64).optional(),
        price: z.number().finite().nonnegative().optional(),
        currency: z.string().max(8).optional(),
        savedAt: z.string().max(40).optional(),
      })
    )
    .max(MAX_SAVED),
})

/** zod issues → the `{ fields }` map every other route answers with. */
function parse(schema, body, message) {
  const result = schema.safeParse(body)
  if (result.success) return result.data
  const fields = {}
  for (const issue of result.error.issues.slice(0, 20)) {
    const key = issue.path.join('.') || 'body'
    if (!fields[key]) fields[key] = issue.message
  }
  throw badRequest(message, fields)
}

export function createProjects({ dataDir, auth }) {
  const root = path.join(dataDir, 'projects')

  // One JsonStore per signed-in user, so two tabs of the same account are
  // serialised through one queue. Bounded: the least recently used are dropped
  // (their data is on disk; the next request simply reloads it).
  const stores = new Map()
  function storeFor(userId) {
    let store = stores.get(userId)
    if (store) {
      stores.delete(userId)
    } else {
      store = new JsonStore(path.join(root, userId, 'index.json'), () => ({
        version: 1,
        projects: [],
        // Tombstones: ids deleted on purpose. A client holding a copy of a
        // project the list no longer has needs to tell "deleted on my other
        // device" (drop it) from "the server never had it / lost it" (upload it).
        deleted: [],
        saved: [],
        savedUpdatedAt: null,
      }))
      if (stores.size >= 200) stores.delete(stores.keys().next().value)
    }
    stores.set(userId, store)
    return store
  }

  const heavyFile = (userId, id) => path.join(root, userId, `p_${id}.json`)

  async function readHeavy(userId, id) {
    try {
      return JSON.parse(await fs.readFile(heavyFile(userId, id), 'utf8'))
    } catch (err) {
      if (err.code !== 'ENOENT') console.error(`[projects] ${userId}/${id} unreadable: ${err.message}`)
      return { record: null, scene: null }
    }
  }

  // ----------------------------------------------------------------- guards
  const requireUser = asyncRoute(async (req, res, next) => {
    const user = await auth.currentUser(req)
    if (!user) throw new HttpError(401, 'Sign in to sync your projects.', { code: 'unauthenticated' })
    // The user id is a UUID minted by auth.js; still refuse anything that
    // could not be a directory name before it is ever joined into a path.
    if (!/^[A-Za-z0-9-]{8,64}$/.test(user.id)) throw new HttpError(500, 'Account id is not valid.', { code: 'internal' })
    req.user = user
    next()
  })

  function projectId(req) {
    const id = String(req.params.id || '')
    if (!ID_RE.test(id)) throw badRequest('That project id is not valid.', { id: 'letters, digits, _ and - only (max 64)' })
    return id
  }

  // ----------------------------------------------------------------- router
  // The router is mounted at /api next to unrelated routes, so the guard is
  // attached per route — a router-level `use` would also run for (and reject)
  // every other /api request that falls through this router.
  const router = express.Router()
  const guard = [
    timeout(60_000),
    requireUser,
    // Per-user data must never be served from a shared or back/forward cache.
    (req, res, next) => {
      res.set('Cache-Control', 'no-store')
      next()
    },
  ]

  router.get(
    '/projects',
    guard,
    asyncRoute(async (req, res) => {
      const out = await storeFor(req.user.id).read((data) => ({
        projects: [...data.projects].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
        deleted: Array.isArray(data.deleted) ? data.deleted : [],
      }))
      res.json(out)
    })
  )

  router.get(
    '/projects/:id',
    guard,
    asyncRoute(async (req, res) => {
      const id = projectId(req)
      const meta = await storeFor(req.user.id).read((data) => data.projects.find((p) => p.id === id) || null)
      if (!meta) throw new HttpError(404, 'No such project on this account.', { code: 'not_found' })
      const heavy = await readHeavy(req.user.id, id)
      res.json({ project: { ...meta, record: heavy.record ?? null, scene: heavy.scene ?? null } })
    })
  )

  router.put(
    '/projects/:id',
    guard,
    asyncRoute(async (req, res) => {
      const id = projectId(req)
      const patch = parse(putSchema, req.body, 'The project is not valid.')
      const userId = req.user.id

      const meta = await storeFor(userId).update(async (data) => {
        const existing = data.projects.find((p) => p.id === id)
        if (!existing && data.projects.length >= MAX_PROJECTS) {
          throw new HttpError(409, `An account can hold at most ${MAX_PROJECTS} projects. Delete one first.`, {
            code: 'project_limit',
          })
        }

        // The heavy file is only rewritten when the request carries heavy data.
        let heavy = null
        if (patch.record !== undefined || patch.scene !== undefined) {
          heavy = existing ? await readHeavy(userId, id) : { record: null, scene: null }
          if (patch.record !== undefined) heavy.record = patch.record ? { ...patch.record, id } : null
          if (patch.scene !== undefined) heavy.scene = patch.scene
          const size = Buffer.byteLength(JSON.stringify(heavy))
          if (size > MAX_PROJECT_BYTES) {
            throw new HttpError(413, 'This project is too large to store.', { code: 'payload_too_large' })
          }
          await atomicWriteJson(heavyFile(userId, id), heavy)
        }

        const now = new Date().toISOString()
        const next = existing || {
          id,
          title: '',
          roomType: 'living',
          style: '',
          status: 'draft',
          createdAt: now,
          notes: '',
          budget: null,
          cover: null,
          renderCount: 0,
          hasScene: false,
          hasResult: false,
        }
        for (const key of ['title', 'roomType', 'style', 'status', 'createdAt', 'notes', 'budget', 'cover']) {
          if (patch[key] !== undefined) next[key] = patch[key]
        }
        if (heavy) {
          const renders = heavy.record?.result?.renders
          next.renderCount = Array.isArray(renders) ? renders.length : 0
          next.hasResult = next.renderCount > 0
          next.hasScene = Boolean(heavy.scene)
        }
        next.updatedAt = now
        if (!existing) {
          data.projects.push(next)
          // Writing it again brings a deleted id back to life.
          if (Array.isArray(data.deleted)) data.deleted = data.deleted.filter((other) => other !== id)
        }
        return { ...next }
      })

      res.json({ project: meta })
    })
  )

  router.delete(
    '/projects/:id',
    guard,
    asyncRoute(async (req, res) => {
      const id = projectId(req)
      await storeFor(req.user.id).update((data) => {
        data.projects = data.projects.filter((p) => p.id !== id)
        data.deleted = [id, ...(Array.isArray(data.deleted) ? data.deleted : []).filter((other) => other !== id)].slice(0, MAX_TOMBSTONES)
      })
      await fs.rm(heavyFile(req.user.id, id), { force: true })
      // Deleting something already gone is a success: the client's goal state holds.
      res.status(204).end()
    })
  )

  router.get(
    '/saved',
    guard,
    asyncRoute(async (req, res) => {
      const out = await storeFor(req.user.id).read((data) => ({
        items: data.saved || [],
        updatedAt: data.savedUpdatedAt || null,
      }))
      res.json(out)
    })
  )

  router.put(
    '/saved',
    guard,
    asyncRoute(async (req, res) => {
      const { items } = parse(savedSchema, req.body, 'The shortlist is not valid.')
      const out = await storeFor(req.user.id).update((data) => {
        data.saved = items
        data.savedUpdatedAt = new Date().toISOString()
        return { items: data.saved, updatedAt: data.savedUpdatedAt }
      })
      res.json(out)
    })
  )

  return { router }
}
