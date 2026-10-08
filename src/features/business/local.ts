import { useCallback, useEffect, useState } from 'react'

import { BRANDING, type Branding } from './data'

/**
 * Browser-local persistence for the demo dashboard.
 *
 * There is no `PATCH /api/business/*`, so the few edits that should *feel*
 * saved — the branding draft (which `/store/:slug` then renders), a lead's
 * private note — are written to `localStorage` under one namespace. Every read
 * and write is wrapped: private mode, blocked storage or a quota error simply
 * means "not remembered", never a crash.
 */

const NS = 'framespace.business.'

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(NS + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeLocal(key: string, value: unknown): boolean {
  try {
    if (value === undefined || value === null) window.localStorage.removeItem(NS + key)
    else window.localStorage.setItem(NS + key, JSON.stringify(value))
    window.dispatchEvent(new CustomEvent('fs-biz-local', { detail: key }))
    return true
  } catch {
    return false
  }
}

/** `useState` mirrored into localStorage, synced across components and tabs. */
export function useLocal<T>(key: string, fallback: T): [T, (next: T) => boolean] {
  const [value, setValue] = useState<T>(() => readLocal(key, fallback))

  useEffect(() => {
    const sync = (event: Event) => {
      const changed =
        event instanceof StorageEvent ? event.key === NS + key : (event as CustomEvent).detail === key
      if (changed) setValue(readLocal(key, fallback))
    }
    window.addEventListener('storage', sync)
    window.addEventListener('fs-biz-local', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('fs-biz-local', sync)
    }
    // `fallback` is a constant at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const set = useCallback(
    (next: T) => {
      setValue(next)
      return writeLocal(key, next)
    },
    [key],
  )

  return [value, set]
}

/* ---------------------------------------------------------------- branding */

const HEX = /^#[0-9a-f]{6}$/i

/** Accepts only a structurally valid record; anything else falls back. */
function sanitizeBranding(value: unknown): Branding {
  if (!value || typeof value !== 'object') return BRANDING
  const v = value as Partial<Branding>
  const colors = v.colors ?? BRANDING.colors
  const color = (key: keyof Branding['colors']) =>
    typeof colors[key] === 'string' && HEX.test(colors[key]) ? colors[key] : BRANDING.colors[key]
  return {
    ...BRANDING,
    displayName:
      typeof v.displayName === 'string' && v.displayName.trim() ? v.displayName.slice(0, 40) : BRANDING.displayName,
    tagline: typeof v.tagline === 'string' ? v.tagline.slice(0, 80) : BRANDING.tagline,
    monogram:
      typeof v.monogram === 'string' && v.monogram.trim() ? v.monogram.slice(0, 3) : BRANDING.monogram,
    colors: {
      paper: color('paper'),
      ink: color('ink'),
      accent: color('accent'),
      accentInk: color('accentInk'),
    },
    typeface: v.typeface === 'sans' ? 'sans' : 'serif',
    corner: v.corner === 'sharp' ? 'sharp' : 'soft',
    updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : BRANDING.updatedAt,
  }
}

/**
 * The saved branding: the typed record from `data.ts`, overridden by whatever
 * the vendor saved on `/business/branding` in this browser.
 */
export function useSavedBranding(): [Branding, (next: Branding | null) => boolean] {
  const [raw, setRaw] = useLocal<unknown>('branding', null)
  const branding = raw ? sanitizeBranding(raw) : BRANDING
  const save = useCallback(
    (next: Branding | null) => setRaw(next ? { ...next, updatedAt: new Date().toISOString() } : null),
    [setRaw],
  )
  return [branding, save]
}
