// Persistence for everything the API remembers: accounts, sessions, the
// per-user daily render counter, global daily counters, contact messages and
// the last few client-side error reports.
//
// Two interchangeable backends behind one small interface:
//
//   - JSON files (default): the atomic JsonStore under DATA_DIR. Zero setup,
//     perfect for local dev — but most free hosts wipe the disk on every
//     deploy or restart, so accounts would vanish.
//   - Postgres (when DATABASE_URL is set): works with the Neon and Supabase
//     free tiers. Tables are created at boot with idempotent SQL, every
//     counter is updated in one atomic statement, and SSL is on by default.
//
// Every method is async and returns plain objects shaped the way the JSON
// file stores them (camelCase, ISO dates), so callers never know which
// backend they are talking to.

import path from 'node:path'

import { JsonStore } from './jsonStore.js'

/**
 * @typedef {{id:string, name:string, email:string, passwordHash:string, createdAt:string}} UserRecord
 * @typedef {{tokenHash:string, userId:string, createdAt:string, expiresAt:number, userAgent:string}} SessionRecord
 */

/** Pick the backend from the environment and get it ready (tables, files). */
export async function createStorage({ dataDir, databaseUrl = process.env.DATABASE_URL } = {}) {
  const storage = databaseUrl ? await createPgStorage(databaseUrl) : createJsonStorage(dataDir)
  await storage.init()
  return storage
}

// ===================================================================== JSON

export function createJsonStorage(dataDir) {
  // auth.json keeps its original shape ({version, users, sessions}); the daily
  // render counter rides on each user record as `renders: {day, count}`.
  const auth = new JsonStore(path.join(dataDir, 'auth.json'), () => ({ version: 1, users: [], sessions: [] }))
  const messages = new JsonStore(path.join(dataDir, 'messages.json'), () => [])
  const usage = new JsonStore(path.join(dataDir, 'usage.json'), () => ({ counters: {} }))
  const clientErrors = new JsonStore(path.join(dataDir, 'client-errors.json'), () => [])

  const pruneSessions = (data, now = Date.now()) => {
    data.sessions = data.sessions.filter((s) => s.expiresAt > now)
  }

  return {
    kind: 'json',
    describe: () => `JSON files in ${dataDir}`,
    async init() {},
    async close() {},

    users: {
      async findByEmail(email) {
        return auth.read((data) => data.users.find((u) => u.email === email) || null)
      },
      async findById(id) {
        return auth.read((data) => data.users.find((u) => u.id === id) || null)
      },
      /** @returns {Promise<UserRecord|null>} null when the email is taken */
      async create(user) {
        return auth.update((data) => {
          if (data.users.some((u) => u.email === user.email)) return null
          data.users.push({ ...user })
          return user
        })
      },
    },

    sessions: {
      async create(session) {
        await auth.update((data) => {
          pruneSessions(data)
          data.sessions.push({ ...session })
        })
      },
      /** The signed-in user for a token hash, or null if missing/expired. */
      async findUser(tokenHash) {
        return auth.read((data) => {
          const session = data.sessions.find((s) => s.tokenHash === tokenHash)
          if (!session || session.expiresAt <= Date.now()) return null
          return data.users.find((u) => u.id === session.userId) || null
        })
      },
      async delete(tokenHash) {
        await auth.update((data) => {
          pruneSessions(data)
          data.sessions = data.sessions.filter((s) => s.tokenHash !== tokenHash)
        })
      },
    },

    // One counter per user per UTC day, stored on the user record.
    quota: {
      async used(userId, day) {
        return auth.read((data) => {
          const r = data.users.find((u) => u.id === userId)?.renders
          return r && r.day === day ? r.count : 0
        })
      },
      /** Take one unit if fewer than `limit` are used today. */
      async reserve(userId, day, limit) {
        return auth.update((data) => {
          const user = data.users.find((u) => u.id === userId)
          if (!user) return { ok: false, used: 0 }
          const used = user.renders?.day === day ? user.renders.count : 0
          if (used >= limit) return { ok: false, used }
          user.renders = { day, count: used + 1 }
          return { ok: true, used: used + 1 }
        })
      },
      async release(userId, day) {
        await auth.update((data) => {
          const user = data.users.find((u) => u.id === userId)
          if (user?.renders?.day === day && user.renders.count > 0) user.renders.count -= 1
        })
      },
    },

    // Named counters per UTC day (the global render cap).
    counters: {
      async get(name, day) {
        return usage.read((data) => data.counters[`${name}:${day}`] || 0)
      },
      async reserve(name, day, cap) {
        return usage.update((data) => {
          // Keep the file small: only today's counters are ever needed.
          for (const key of Object.keys(data.counters)) if (!key.endsWith(`:${day}`)) delete data.counters[key]
          const key = `${name}:${day}`
          const count = data.counters[key] || 0
          if (count >= cap) return { ok: false, count }
          data.counters[key] = count + 1
          return { ok: true, count: count + 1 }
        })
      },
      async release(name, day) {
        await usage.update((data) => {
          const key = `${name}:${day}`
          if (data.counters[key] > 0) data.counters[key] -= 1
        })
      },
    },

    messages: {
      async add(entry) {
        await messages.update((list) => {
          list.push(entry)
        })
      },
    },

    clientErrors: {
      /** Append, keeping only the newest `keep` reports. */
      async add(entry, keep) {
        await clientErrors.update((list) => {
          list.push(entry)
          if (list.length > keep) list.splice(0, list.length - keep)
        })
      },
    },
  }
}

// ================================================================= Postgres

const SCHEMA = `
CREATE TABLE IF NOT EXISTS fs_users (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  render_day    text,
  render_count  integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS fs_sessions (
  token_hash text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES fs_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  user_agent text
);
CREATE INDEX IF NOT EXISTS fs_sessions_user_idx ON fs_sessions (user_id);
CREATE INDEX IF NOT EXISTS fs_sessions_expires_idx ON fs_sessions (expires_at);
CREATE TABLE IF NOT EXISTS fs_daily_counters (
  name  text NOT NULL,
  day   text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (name, day)
);
CREATE TABLE IF NOT EXISTS fs_contact_messages (
  id          bigserial PRIMARY KEY,
  name        text,
  email       text NOT NULL,
  message     text NOT NULL,
  user_id     text,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fs_client_errors (
  id          bigserial PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now(),
  entry       jsonb NOT NULL
);
`

/**
 * SSL for hosted Postgres. `DATABASE_SSL`:
 *   verify    (default) encrypted, certificate checked — Neon works as is
 *   no-verify encrypted, certificate not checked — Supabase's own CA needs this
 *             unless you pass its CA file via DATABASE_SSL_CA
 *   disable   plain TCP — only for a database on localhost
 *
 * The sslmode=... query in a pasted URL is removed first: node-postgres lets
 * the URL override the `ssl` option, and its reading of sslmode=require has
 * changed between versions. One explicit setting is easier to reason about.
 */
export function pgConfigFromUrl(databaseUrl, env = process.env) {
  const url = new URL(databaseUrl)
  const channelBinding = url.searchParams.get('channel_binding')
  for (const key of ['sslmode', 'ssl', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat', 'channel_binding']) {
    url.searchParams.delete(key)
  }
  const mode = String(env.DATABASE_SSL || 'verify').toLowerCase()
  let ssl
  if (mode === 'disable' || mode === 'off' || mode === 'false') ssl = false
  else if (mode === 'no-verify') ssl = { rejectUnauthorized: false }
  else ssl = { rejectUnauthorized: true, ...(env.DATABASE_SSL_CA ? { ca: env.DATABASE_SSL_CA.replace(/\\n/g, '\n') } : {}) }

  return {
    connectionString: url.toString(),
    ssl,
    ...(channelBinding === 'require' ? { enableChannelBinding: true } : {}),
    // Free tiers allow few connections; one Node process needs very few.
    max: Number(env.DATABASE_POOL_MAX || 5),
    idleTimeoutMillis: 30_000,
    // Neon/Supabase free computes suspend when idle; waking takes a moment.
    connectionTimeoutMillis: Number(env.DATABASE_CONNECT_TIMEOUT_MS || 15_000),
    application_name: 'framespace-api',
  }
}

const iso = (v) => (v instanceof Date ? v.toISOString() : v ? new Date(v).toISOString() : null)

const userFromRow = (r) =>
  r && {
    id: r.id,
    name: r.name,
    email: r.email,
    passwordHash: r.password_hash,
    createdAt: iso(r.created_at),
  }

async function createPgStorage(databaseUrl) {
  // Imported lazily so the JSON-only setup never loads the driver.
  const { default: pg } = await import('pg')
  const config = pgConfigFromUrl(databaseUrl)
  const pool = new pg.Pool(config)
  // An idle client dropped by the server (free tiers suspend) must not crash
  // the process; the pool replaces it on the next query.
  pool.on('error', (err) => console.error('[db] idle client error:', err.message))

  const q = (text, params) => pool.query(text, params)
  let sweep = null

  const host = (() => {
    try {
      return new URL(databaseUrl).hostname
    } catch {
      return 'postgres'
    }
  })()

  return {
    kind: 'postgres',
    describe: () => `Postgres at ${host} (ssl: ${config.ssl ? (config.ssl.rejectUnauthorized ? 'verify' : 'no-verify') : 'off'})`,

    async init() {
      try {
        await q(SCHEMA)
      } catch (err) {
        if (/self[- ]signed|unable to verify|certificate/i.test(err.message)) {
          console.error('[db] TLS certificate check failed. For Supabase set DATABASE_SSL=no-verify (or DATABASE_SSL_CA).')
        }
        throw err
      }
      await q('DELETE FROM fs_sessions WHERE expires_at <= now()')
      sweep = setInterval(() => {
        q('DELETE FROM fs_sessions WHERE expires_at <= now()').catch((err) => console.error('[db] session sweep:', err.message))
      }, 60 * 60 * 1000)
      sweep.unref()
    },

    async close() {
      if (sweep) clearInterval(sweep)
      await pool.end()
    },

    users: {
      async findByEmail(email) {
        const { rows } = await q('SELECT * FROM fs_users WHERE email = $1', [email])
        return userFromRow(rows[0]) || null
      },
      async findById(id) {
        const { rows } = await q('SELECT * FROM fs_users WHERE id = $1', [id])
        return userFromRow(rows[0]) || null
      },
      async create(user) {
        const { rows } = await q(
          `INSERT INTO fs_users (id, name, email, password_hash, created_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (email) DO NOTHING
           RETURNING *`,
          [user.id, user.name, user.email, user.passwordHash, user.createdAt]
        )
        return userFromRow(rows[0]) || null
      },
    },

    sessions: {
      async create(session) {
        await q(
          `INSERT INTO fs_sessions (token_hash, user_id, created_at, expires_at, user_agent)
           VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), $5)`,
          [session.tokenHash, session.userId, session.createdAt, session.expiresAt, session.userAgent]
        )
      },
      async findUser(tokenHash) {
        const { rows } = await q(
          `SELECT u.* FROM fs_sessions s JOIN fs_users u ON u.id = s.user_id
           WHERE s.token_hash = $1 AND s.expires_at > now()`,
          [tokenHash]
        )
        return userFromRow(rows[0]) || null
      },
      async delete(tokenHash) {
        await q('DELETE FROM fs_sessions WHERE token_hash = $1 OR expires_at <= now()', [tokenHash])
      },
    },

    quota: {
      async used(userId, day) {
        const { rows } = await q('SELECT render_day, render_count FROM fs_users WHERE id = $1', [userId])
        return rows[0] && rows[0].render_day === day ? rows[0].render_count : 0
      },
      // A single conditional UPDATE: two renders racing for the last unit
      // cannot both win.
      async reserve(userId, day, limit) {
        const { rows } = await q(
          `UPDATE fs_users
              SET render_count = CASE WHEN render_day = $2 THEN render_count + 1 ELSE 1 END,
                  render_day = $2
            WHERE id = $1 AND (render_day IS DISTINCT FROM $2 OR render_count < $3)
            RETURNING render_count`,
          [userId, day, limit]
        )
        if (rows[0]) return { ok: true, used: rows[0].render_count }
        return { ok: false, used: await this.used(userId, day) }
      },
      async release(userId, day) {
        await q(
          `UPDATE fs_users SET render_count = render_count - 1
            WHERE id = $1 AND render_day = $2 AND render_count > 0`,
          [userId, day]
        )
      },
    },

    counters: {
      async get(name, day) {
        const { rows } = await q('SELECT count FROM fs_daily_counters WHERE name = $1 AND day = $2', [name, day])
        return rows[0]?.count || 0
      },
      async reserve(name, day, cap) {
        if (cap <= 0) return { ok: false, count: await this.get(name, day) }
        const { rows } = await q(
          `INSERT INTO fs_daily_counters (name, day, count) VALUES ($1, $2, 1)
           ON CONFLICT (name, day) DO UPDATE SET count = fs_daily_counters.count + 1
             WHERE fs_daily_counters.count < $3
           RETURNING count`,
          [name, day, cap]
        )
        if (rows[0]) {
          // Old days are never read again.
          if (rows[0].count === 1) q('DELETE FROM fs_daily_counters WHERE day < $1', [day]).catch(() => {})
          return { ok: true, count: rows[0].count }
        }
        return { ok: false, count: await this.get(name, day) }
      },
      async release(name, day) {
        await q('UPDATE fs_daily_counters SET count = count - 1 WHERE name = $1 AND day = $2 AND count > 0', [name, day])
      },
    },

    messages: {
      async add(entry) {
        await q(
          `INSERT INTO fs_contact_messages (name, email, message, user_id, received_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [entry.name || null, entry.email, entry.message, entry.userId || null, entry.receivedAt]
        )
      },
    },

    clientErrors: {
      async add(entry, keep) {
        await q('INSERT INTO fs_client_errors (received_at, entry) VALUES ($1, $2)', [entry.receivedAt, JSON.stringify(entry)])
        await q(
          `DELETE FROM fs_client_errors
            WHERE id <= (SELECT id FROM fs_client_errors ORDER BY id DESC OFFSET $1 LIMIT 1)`,
          [keep]
        )
      },
    },
  }
}
