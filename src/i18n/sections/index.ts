import type { LanguageCode } from '../config'

/**
 * Feature translation bundles.
 *
 * Each feature area owns one file here and exports `{ uz, ru, en }`, so two
 * features can never collide in one giant locale file.
 *
 * They are loaded **lazily**. The landing page uses only `locales/*.json`, and
 * every feature route is a lazy chunk already — so keeping the feature copy out
 * of the entry bundle costs nothing and saves the first paint from carrying
 * translations for screens the visitor may never open.
 */

export type Bundle = Record<LanguageCode, Record<string, unknown>>

const modules = import.meta.glob<{ default: Bundle }>('./*.ts')

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Deep merge, with `source` winning on leaves. Arrays replace, never concat. */
export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target }
  for (const [key, value] of Object.entries(source)) {
    out[key] =
      isObject(value) && isObject(out[key])
        ? deepMerge(out[key] as Record<string, unknown>, value)
        : value
  }
  return out
}

let pending: Promise<Record<string, Record<string, unknown>>> | null = null

/**
 * Import every feature bundle once and return the merged copy per language.
 * Concurrent callers share the same promise.
 */
export function loadSectionBundles(): Promise<Record<string, Record<string, unknown>>> {
  if (pending) return pending

  pending = Promise.all(
    Object.entries(modules)
      .filter(([path]) => !path.endsWith('/index.ts'))
      .map(([, load]) => load())
  ).then((mods) => {
    const merged: Record<string, Record<string, unknown>> = {}
    for (const mod of mods) {
      const bundle = mod?.default
      if (!bundle) continue
      for (const [lang, tree] of Object.entries(bundle)) {
        merged[lang] = deepMerge(merged[lang] ?? {}, tree as Record<string, unknown>)
      }
    }
    return merged
  })

  return pending
}
