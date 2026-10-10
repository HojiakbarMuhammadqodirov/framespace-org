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
 * the UI does not flash "signed out" on reload) plus the local credit and
 * guest counters. `/api/auth/me` is called once on start-up and is the source
 * of truth: a 401 clears the cached user.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { apiGet, ensureAwake, isGatewayFailure } from '@/lib/wake'

export type Plan = 'free' | 'studio'

export type SessionUser = {
  id: string
  name: string
  email: string
  plan: Plan
  createdAt: string
}

/** Credits for one billing period. Local counters until billing is real. */
export type Credits = { used: number; total: number }

/**
 * The server's daily render allowance for the signed-in user — the real
 * limit whenever renders can cost money (`renderAccess.requireAuth`). It wins
 * over the local `credits` counters above.
 */
export type RenderQuota = { limit: number; used: number; remaining: number; resetsAt: string }

/** Whether the server wants a signed-in user before it renders. */
export type RenderAccess = { requireAuth: boolean; dailyQuota: number }

/** A quota whose day has rolled over is full again, without asking. */
export function liveQuota(quota: RenderQuota | null, now = Date.now()): RenderQuota | null {
  if (!quota) return null
  if (Date.parse(quota.resetsAt) <= now) return { ...quota, used: 0, remaining: quota.limit }
  return quota
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

type AuthPayload = {
  user?: ApiUser
  quota?: RenderQuota | null
  renderAccess?: RenderAccess
}

async function authRequest(path: string, method: 'GET' | 'POST', body?: unknown): Promise<AuthPayload | null> {
  let res: Response
  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }
  try {
    // GETs may be retried through a server wake-up; POSTs wait for the
    // server to be up and then go out exactly once.
    if (method === 'GET') res = await apiGet(`/api/auth/${path}`, init)
    else {
      await ensureAwake()
      res = await fetch(`/api/auth/${path}`, init)
    }
  } catch {
    throw new AuthFailure('network')
  }
  if (isGatewayFailure(res)) throw new AuthFailure('network')
  if (res.status === 204) return null
  const payload = (await res.json().catch(() => ({}))) as AuthPayload & {
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
  /** Today's server-side render allowance (null for guests / demo mode). */
  quota: RenderQuota | null
  /** Learned from `/api/auth/me`; null until the server has answered. */
  renderAccess: RenderAccess | null
  /** Store the allowance a render response or a 429 reported. */
  setQuota: (quota: RenderQuota | null) => void

  /** Asks the server who is signed in. Safe to call repeatedly. */
  refresh: () => Promise<SessionUser | null>
  signUp: (input: Registration) => Promise<SessionUser>
  logIn: (input: Credentials) => Promise<SessionUser>
  logOut: () => Promise<void>
  /** Records that a render was spent. Returns false when nothing was left. */
  consumeGeneration: () => boolean
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
      quota: null,
      renderAccess: null,

      setQuota: (quota) => set({ quota }),

      refresh: () => {
        if (inflightRefresh) return inflightRefresh
        set({ status: 'checking' })
        inflightRefresh = (async () => {
          try {
            const payload = await authRequest('me', 'GET')
            const api = payload?.user
            const user = api ? toUser(api, get().user?.plan) : null
            set({
              user,
              status: 'ready',
              quota: payload?.quota ?? null,
              renderAccess: payload?.renderAccess ?? get().renderAccess,
            })
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
          set({ user, status: 'ready', credits: { used: 0, total: PLAN_CREDITS[user.plan] } })
          // Pick up the server's daily allowance for the new account.
          void get().refresh()
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
          set((state) => ({
            user,
            status: 'ready',
            credits: {
              used: Math.min(state.credits.used, PLAN_CREDITS[user.plan]),
              total: PLAN_CREDITS[user.plan],
            },
          }))
          void get().refresh()
          return user
        } finally {
          set({ pending: false })
        }
      },

      logOut: async () => {
        // Clear locally first so the UI responds instantly; the cookie is
        // dropped by the server in the background.
        set({ user: null, quota: null })
        try {
          await authRequest('logout', 'POST')
        } catch {
          // Already signed out locally; nothing useful to tell the visitor.
        }
      },

      consumeGeneration: () => {
        const { user, credits, guestGenerationsUsed } = get()
        if (user) {
          if (credits.used >= credits.total) return false
          set({ credits: { ...credits, used: credits.used + 1 } })
          return true
        }
        if (guestGenerationsUsed >= GUEST_FREE_GENERATIONS) return false
        set({ guestGenerationsUsed: guestGenerationsUsed + 1 })
        return true
      },

      generationsLeft: () => {
        const { user, credits, guestGenerationsUsed, renderAccess } = get()
        // When renders cost money the server decides: a signed-in user has
        // today's allowance, a guest has nothing until they sign in.
        const quota = liveQuota(get().quota)
        if (user && quota) return quota.remaining
        if (!user && renderAccess?.requireAuth) return 0
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
