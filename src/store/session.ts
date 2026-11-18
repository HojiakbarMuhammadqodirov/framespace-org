/**
 * Session state — backed by the real auth API in server/.
 *
 *   POST /api/auth/signup  {name, email, password} → 201 {user}
 *   POST /api/auth/login   {email, password}       → 200 {user}
 *   POST /api/auth/logout                          → 204
 *   GET  /api/auth/me                              → 200 {user} (user is null for guests)
 *
 * The session itself lives in an httpOnly cookie that JavaScript never sees.
 * What is persisted here is only a cached copy of the public user record (so
 * the UI does not flash "signed out" on reload), the last known allowance and
 * the guest counter. `/api/auth/me` is called once on start-up and is the
 * source of truth: `user: null` clears the cached user.
 *
 * The monthly allowance (`credits`) is the server's number for a signed-in
 * account — it arrives as `usage` beside `user` in every auth answer and in
 * every live render answer (server/usage.js), so it follows the account across
 * devices and resets on the 1st. Only the guest's single free render is still
 * a counter in this browser.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { runBeforeLogout } from './syncBus'

export type Plan = 'free' | 'studio'

export type SessionUser = {
  id: string
  name: string
  email: string
  plan: Plan
  createdAt: string
}

/** Generations for the current calendar month. */
export type Credits = { used: number; total: number }

/** `usage` as the server reports it (server/usage.js). */
export type ServerUsage = { used: number; total: number; period?: string; resetsAt?: string }

function creditsFrom(usage: unknown, fallback: Credits): Credits {
  const u = usage as Partial<ServerUsage> | null | undefined
  if (!u || typeof u.used !== 'number' || typeof u.total !== 'number') return fallback
  return { used: Math.max(0, u.used), total: Math.max(0, u.total) }
}

export const PLAN_CREDITS: Record<Plan, number> = {
  free: 3,
  studio: 40,
}

/** §4 of the brief: one generation without an account. */
export const GUEST_FREE_GENERATIONS = 1

/**
 * i18n keys under `app.auth.errors`. `noAccount` / `wrongPassword` are kept for
 * compatibility — the server answers both with `invalid_credentials`.
 */
export type AuthErrorCode =
  | 'emailTaken'
  | 'noAccount'
  | 'wrongPassword'
  | 'invalidCredentials'
  | 'validation'
  | 'rateLimited'
  | 'network'
  | 'unknown'

/** Thrown by signUp/logIn. `code` is an i18n key under `app.auth.errors`. */
export class AuthFailure extends Error {
  code: AuthErrorCode
  /** The server's own message, when it sent one (shown for `validation`). */
  detail?: string
  constructor(code: AuthErrorCode, detail?: string) {
    super(detail || code)
    this.name = 'AuthFailure'
    this.code = code
    this.detail = detail
  }
}

type ApiUser = { id: string; name: string; email: string; createdAt?: string; plan?: Plan }

function mapCode(status: number, code?: string): AuthErrorCode {
  switch (code) {
    case 'email_taken':
      return 'emailTaken'
    case 'invalid_credentials':
      return 'invalidCredentials'
    case 'validation':
      return 'validation'
    case 'rate_limited':
      return 'rateLimited'
  }
  if (status === 409) return 'emailTaken'
  if (status === 401) return 'invalidCredentials'
  if (status === 429) return 'rateLimited'
  if (status === 400) return 'validation'
  return 'unknown'
}

async function authRequest(
  path: string,
  method: 'GET' | 'POST',
  body?: unknown
): Promise<{ user?: ApiUser | null; usage?: ServerUsage } | null> {
  let res: Response
  try {
    res = await fetch(`/api/auth/${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new AuthFailure('network')
  }
  if (res.status === 204) return null
  const payload = (await res.json().catch(() => ({}))) as {
    user?: ApiUser | null
    usage?: ServerUsage
    error?: string
    code?: string
  }
  if (!res.ok) throw new AuthFailure(mapCode(res.status, payload.code), payload.error)
  return payload
}

function toUser(api: ApiUser, plan: Plan = 'free'): SessionUser {
  return {
    id: api.id,
    name: api.name,
    email: api.email,
    plan: api.plan ?? plan,
    createdAt: api.createdAt ?? new Date().toISOString(),
  }
}

export type Credentials = { email: string; password: string }
export type Registration = Credentials & { name: string }

export type SessionStatus = 'unknown' | 'checking' | 'ready'

type SessionState = {
  user: SessionUser | null
  credits: Credits
  /** Generations a signed-out visitor has already spent on this device. */
  guestGenerationsUsed: number
  /** True while an auth request is in flight. */
  pending: boolean
  /** Whether `/api/auth/me` has answered since the page loaded. */
  status: SessionStatus

  /** Asks the server who is signed in. Safe to call repeatedly. */
  refresh: () => Promise<SessionUser | null>
  signUp: (input: Registration) => Promise<SessionUser>
  logIn: (input: Credentials) => Promise<SessionUser>
  logOut: () => Promise<void>
  /**
   * Records that a render was spent. Pass the `usage` a live render answer
   * carried and the account's figures are taken from the server as they are;
   * without it (guests, or an older server) the local counter moves by one.
   * Returns false when nothing was left.
   */
  consumeGeneration: (usage?: ServerUsage | null) => boolean
  /** Renders left: plan credits when signed in, the guest allowance when not. */
  generationsLeft: () => number
  setPlan: (plan: Plan) => void
  /** Signs out and wipes every local counter. Settings → danger row. */
  forgetEverything: () => Promise<void>
}

let inflightRefresh: Promise<SessionUser | null> | null = null

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      user: null,
      credits: { used: 0, total: PLAN_CREDITS.free },
      guestGenerationsUsed: 0,
      pending: false,
      status: 'unknown',

      refresh: () => {
        if (inflightRefresh) return inflightRefresh
        set({ status: 'checking' })
        inflightRefresh = (async () => {
          try {
            const payload = await authRequest('me', 'GET')
            const api = payload?.user
            const user = api ? toUser(api, get().user?.plan) : null
            set((state) => ({
              user,
              status: 'ready',
              credits: user ? creditsFrom(payload?.usage, state.credits) : state.credits,
            }))
            return user
          } catch (err) {
            // 401 → definitely signed out. A network failure keeps the cached
            // user so an offline reload does not log anybody out.
            if (err instanceof AuthFailure && err.code !== 'network') set({ user: null })
            set({ status: 'ready' })
            return get().user
          } finally {
            inflightRefresh = null
          }
        })()
        return inflightRefresh
      },

      signUp: async ({ name, email, password }) => {
        set({ pending: true })
        try {
          const payload = await authRequest('signup', 'POST', {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
          })
          if (!payload?.user) throw new AuthFailure('unknown')
          const user = toUser(payload.user)
          // A new account starts with its plan's allowance. Anything the
          // visitor spent as a guest is forgiven on sign-up.
          set({
            user,
            status: 'ready',
            credits: creditsFrom(payload.usage, { used: 0, total: PLAN_CREDITS[user.plan] }),
          })
          return user
        } finally {
          set({ pending: false })
        }
      },

      logIn: async ({ email, password }) => {
        set({ pending: true })
        try {
          const payload = await authRequest('login', 'POST', {
            email: email.trim().toLowerCase(),
            password,
          })
          if (!payload?.user) throw new AuthFailure('unknown')
          const user = toUser(payload.user, get().user?.plan)
          // The server's figures for THIS account. The fallback (an older
          // server that sends none) starts clean rather than inheriting
          // whatever the previous account on this browser had spent.
          set({
            user,
            status: 'ready',
            credits: creditsFrom(payload.usage, { used: 0, total: PLAN_CREDITS[user.plan] }),
          })
          return user
        } finally {
          set({ pending: false })
        }
      },

      logOut: async () => {
        // Anything not yet mirrored to the account goes up while the cookie
        // is still valid — after this the device copy is wiped (sync.ts), so
        // this is the last chance for an edit made seconds ago.
        if (get().user) await runBeforeLogout()
        set({ user: null, credits: { used: 0, total: PLAN_CREDITS.free } })
        try {
          await authRequest('logout', 'POST')
        } catch {
          // Already signed out locally; nothing useful to tell the visitor.
        }
      },

      consumeGeneration: (usage) => {
        const { user, credits, guestGenerationsUsed } = get()
        if (user) {
          if (usage && typeof usage.used === 'number' && typeof usage.total === 'number') {
            set({ credits: creditsFrom(usage, credits) })
            return true
          }
          if (credits.used >= credits.total) return false
          set({ credits: { ...credits, used: credits.used + 1 } })
          return true
        }
        if (guestGenerationsUsed >= GUEST_FREE_GENERATIONS) return false
        set({ guestGenerationsUsed: guestGenerationsUsed + 1 })
        return true
      },

      generationsLeft: () => {
        const { user, credits, guestGenerationsUsed } = get()
        if (user) return Math.max(0, credits.total - credits.used)
        return Math.max(0, GUEST_FREE_GENERATIONS - guestGenerationsUsed)
      },

      setPlan: (plan) =>
        set((state) => ({
          user: state.user ? { ...state.user, plan } : state.user,
          credits: { used: Math.min(state.credits.used, PLAN_CREDITS[plan]), total: PLAN_CREDITS[plan] },
        })),

      forgetEverything: async () => {
        await get().logOut()
        set({
          user: null,
          credits: { used: 0, total: PLAN_CREDITS.free },
          guestGenerationsUsed: 0,
        })
      },
    }),
    {
      name: 'framespace.session.v2',
      // `pending` and `status` are request state — never persist them.
      partialize: (state) => ({
        user: state.user,
        credits: state.credits,
        guestGenerationsUsed: state.guestGenerationsUsed,
      }),
    }
  )
)

// Ask the server who is signed in as soon as anything imports the session.
// Also drop the old localStorage "account registry" from the scaffolding era.
if (typeof window !== 'undefined') {
  try {
    const legacy = window.localStorage.getItem('framespace.session.v1')
    if (legacy) {
      // Carry the guest allowance and credit counters across; drop the rest.
      const old = JSON.parse(legacy)?.state ?? {}
      useSession.setState((s) => ({
        guestGenerationsUsed: Math.max(s.guestGenerationsUsed, Number(old.guestGenerationsUsed) || 0),
        credits: old.credits && typeof old.credits.used === 'number' ? old.credits : s.credits,
      }))
      window.localStorage.removeItem('framespace.session.v1')
    }
  } catch {
    /* storage blocked — nothing to clean */
  }
  queueMicrotask(() => {
    void useSession.getState().refresh()
  })
}

/** Call once at start-up (idempotent). Exported for main.tsx / layouts. */
export function initSession() {
  return useSession.getState().refresh()
}

/** True when the visitor still has their one free render (brief §4). */
export function useGuestAllowance() {
  const user = useSession((s) => s.user)
  const used = useSession((s) => s.guestGenerationsUsed)
  return { isGuest: !user, left: Math.max(0, GUEST_FREE_GENERATIONS - used) }
}
