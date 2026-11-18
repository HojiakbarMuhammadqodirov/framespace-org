// Per-account generation allowance.
//
// The dashboard promises "3 renders a month, resets on the 1st". That counter
// used to live only in the browser's localStorage: it never reset (a free
// account was locked out for good after its third real render) and it was
// shared by every account that ever signed in on that browser. This is the
// authoritative copy: one row per user, keyed by calendar month (UTC), so the
// allowance follows the account across devices and really does reset.
//
// Demo-mode renders are canned illustrations and are never counted. Guests are
// not tracked here — their single free render stays a browser-side counter and
// the per-IP limit on /api/render* is what bounds anonymous traffic.

import path from 'node:path'

import { JsonStore } from './lib/jsonStore.js'

/** Renders per calendar month on the free plan (the only plan billing knows). */
export const FREE_MONTHLY_RENDERS = Math.max(0, Number(process.env.FREE_MONTHLY_RENDERS ?? 3))

const periodOf = (date = new Date()) => date.toISOString().slice(0, 7)

function resetsAt(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString()
}

export function createUsage({ dataDir }) {
  const store = new JsonStore(path.join(dataDir, 'usage.json'), () => ({ version: 1, users: {} }))

  const view = (row) => {
    const period = periodOf()
    const used = row && row.period === period ? Number(row.used) || 0 : 0
    return { used, total: FREE_MONTHLY_RENDERS, period, resetsAt: resetsAt() }
  }

  return {
    /** `{ used, total, period, resetsAt }` for this month. */
    get(userId) {
      return store.read((data) => view(data.users[userId]))
    },
    /** Count one finished generation and return the new figures. */
    consume(userId) {
      return store.update((data) => {
        const period = periodOf()
        const row = data.users[userId]
        data.users[userId] = { period, used: (row && row.period === period ? Number(row.used) || 0 : 0) + 1 }
        return view(data.users[userId])
      })
    },
  }
}
