// Email + password accounts with server-side sessions.
//
// - Passwords: scrypt (N=2^15, r=8, p=1, 64-byte key) with a per-user 16-byte
//   salt, compared with timingSafeEqual. Parameters are stored with the hash so
//   they can be raised later without breaking existing accounts.
// - Sessions: 32 random bytes sent to the browser in an httpOnly cookie; only
//   the SHA-256 of the token is stored, so a leaked data file cannot be replayed.
// - Storage: data/auth.json via the atomic JsonStore.

import crypto from 'node:crypto'
import path from 'node:path'
import { promisify } from 'node:util'
import express from 'express'

import { JsonStore } from './lib/jsonStore.js'
import { HttpError, asyncRoute, badRequest, isProd, rateLimit } from './lib/http.js'

const scrypt = promisify(crypto.scrypt)

export const SESSION_COOKIE = 'fs_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 }
const MIN_PASSWORD = 8
const MAX_PASSWORD = 512

export function createAuth({ dataDir }) {
  const store = new JsonStore(path.join(dataDir, 'auth.json'), () => ({ version: 1, users: [], sessions: [] }))

  // ------------------------------------------------------------------ crypto
  async function hashPassword(password) {
    const salt = crypto.randomBytes(16)
    const key = await scrypt(password.normalize('NFKC'), salt, SCRYPT.keylen, SCRYPT)
    return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`
  }

  async function verifyPassword(password, stored) {
    const [scheme, N, r, p, saltB64, keyB64] = String(stored).split('$')
    if (scheme !== 'scrypt') return false
    const expected = Buffer.from(keyB64, 'base64')
    const actual = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT.maxmem,
    })
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
  }

  // Burned on unknown emails so login timing does not reveal who has an account.
  const dummyHash = hashPassword(crypto.randomBytes(16).toString('hex'))

  const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')

  // ------------------------------------------------------------- validation
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

  function normaliseEmail(email) {
    return String(email ?? '').trim().toLowerCase()
  }

  function readCredentials(body, { withName }) {
    const fields = {}
    const b = body && typeof body === 'object' ? body : {}
    const email = normaliseEmail(b.email)
    const password = typeof b.password === 'string' ? b.password : ''
    const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ') : ''

    if (!email) fields.email = 'Enter your email address.'
    else if (email.length > 254 || !EMAIL_RE.test(email)) fields.email = 'That does not look like an email address.'

    if (!password) fields.password = 'Enter a password.'
    else if (withName && password.length < MIN_PASSWORD)
      fields.password = `Use at least ${MIN_PASSWORD} characters.`
    else if (password.length > MAX_PASSWORD) fields.password = `Use at most ${MAX_PASSWORD} characters.`

    if (withName) {
      if (!name) fields.name = 'Enter your name.'
      else if (name.length > 80) fields.name = 'Keep your name under 80 characters.'
    }

    if (Object.keys(fields).length) throw badRequest('Check the highlighted fields.', fields)
    return { email, password, name }
  }

  const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt })

  // ---------------------------------------------------------------- cookies
  function readToken(req) {
    const header = req.headers.cookie
    if (!header) return null
    for (const part of header.split(';')) {
      const i = part.indexOf('=')
      if (i < 0) continue
      if (part.slice(0, i).trim() === SESSION_COOKIE) {
        const value = decodeURIComponent(part.slice(i + 1).trim())
        return /^[A-Za-z0-9_-]{20,100}$/.test(value) ? value : null
      }
    }
    return null
  }

  const cookieOptions = () => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd || process.env.COOKIE_SECURE === 'true',
    path: '/',
  })

  async function startSession(res, user, req, data) {
    const token = crypto.randomBytes(32).toString('base64url')
    const now = Date.now()
    data.sessions = data.sessions.filter((s) => s.expiresAt > now)
    data.sessions.push({
      tokenHash: sha256(token),
      userId: user.id,
      createdAt: new Date(now).toISOString(),
      expiresAt: now + SESSION_TTL_MS,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
    })
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_TTL_MS })
  }

  /** Resolve the signed-in user, or null. Never throws for a bad cookie. */
  async function currentUser(req) {
    const token = readToken(req)
    if (!token) return null
    const hash = sha256(token)
    return store.read((data) => {
      const session = data.sessions.find((s) => s.tokenHash === hash)
      if (!session || session.expiresAt <= Date.now()) return null
      const user = data.users.find((u) => u.id === session.userId)
      return user ? publicUser(user) : null
    })
  }

  // ------------------------------------------------------------------ router
  const router = express.Router()

  const signupLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, name: 'sign-up attempts' })
  const loginIpLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, name: 'sign-in attempts' })
  const loginEmailLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    name: 'sign-in attempts',
    keyFn: (req) => normaliseEmail(req.body?.email),
  })

  router.post(
    '/signup',
    signupLimit,
    asyncRoute(async (req, res) => {
      const { email, password, name } = readCredentials(req.body, { withName: true })
      const passwordHash = await hashPassword(password)
      const user = await store.update(async (data) => {
        if (data.users.some((u) => u.email === email)) {
          throw new HttpError(409, 'An account with this email already exists.', {
            code: 'email_taken',
            fields: { email: 'An account with this email already exists.' },
          })
        }
        const created = {
          id: crypto.randomUUID(),
          name,
          email,
          passwordHash,
          createdAt: new Date().toISOString(),
        }
        data.users.push(created)
        await startSession(res, created, req, data)
        return created
      })
      res.status(201).json({ user: publicUser(user) })
    })
  )

  router.post(
    '/login',
    loginIpLimit,
    loginEmailLimit,
    asyncRoute(async (req, res) => {
      const { email, password } = readCredentials(req.body, { withName: false })
      const found = await store.read((data) => data.users.find((u) => u.email === email) || null)
      const ok = found ? await verifyPassword(password, found.passwordHash) : (await verifyPassword(password, await dummyHash), false)
      if (!found || !ok) {
        throw new HttpError(401, 'Email or password is incorrect.', { code: 'invalid_credentials' })
      }
      await store.update(async (data) => {
        const user = data.users.find((u) => u.id === found.id)
        if (user) await startSession(res, user, req, data)
      })
      res.json({ user: publicUser(found) })
    })
  )

  router.post(
    '/logout',
    asyncRoute(async (req, res) => {
      const token = readToken(req)
      if (token) {
        const hash = sha256(token)
        await store.update((data) => {
          data.sessions = data.sessions.filter((s) => s.tokenHash !== hash && s.expiresAt > Date.now())
        })
      }
      res.clearCookie(SESSION_COOKIE, cookieOptions())
      res.status(204).end()
    })
  )

  router.get(
    '/me',
    asyncRoute(async (req, res) => {
      const user = await currentUser(req)
      if (!user) {
        if (readToken(req)) res.clearCookie(SESSION_COOKIE, cookieOptions())
        // Guests are a normal state, not an error: answering 200 keeps every
        // anonymous page load from logging a failed request in the console.
        res.set('Cache-Control', 'no-store')
        return res.json({ user: null })
      }
      res.set('Cache-Control', 'no-store')
      res.json({ user })
    })
  )

  return { router, currentUser }
}
