import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import uz from './locales/uz.json'
import ru from './locales/ru.json'
import en from './locales/en.json'
import { loadSectionBundles } from './sections'

export const LANGUAGES = [
  { code: 'uz', label: "Oʻzbekcha", htmlLang: 'uz-Latn-UZ' },
  { code: 'ru', label: 'Русский', htmlLang: 'ru' },
  { code: 'en', label: 'English', htmlLang: 'en' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

export const DEFAULT_LANGUAGE: LanguageCode = 'uz'

const STORAGE_KEY = 'framespace.lang'
/** Must match the `persist` name in `src/store/prefs.ts`, which rehydrates `lang`. */
const PREFS_KEY = 'framespace.prefs.v3'

function isLanguage(value: unknown): value is LanguageCode {
  return LANGUAGES.some((l) => l.code === value)
}

/** `?lang=ru` — what hreflang links and shared URLs carry. */
function languageFromUrl(): LanguageCode | null {
  if (typeof location === 'undefined') return null
  try {
    const code = new URLSearchParams(location.search).get('lang')?.toLowerCase()
    return isLanguage(code) ? code : null
  } catch {
    return null
  }
}

/**
 * Remember a language that arrived through the URL. The prefs store keeps its
 * own persisted copy and re-applies it on rehydrate, so it is patched too —
 * otherwise a returning visitor's old choice would win over the link.
 */
function rememberUrlLanguage(code: LanguageCode) {
  try {
    localStorage.setItem(STORAGE_KEY, code)
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as { state?: { lang?: string } }
    if (saved?.state && saved.state.lang !== code) {
      saved.state.lang = code
      localStorage.setItem(PREFS_KEY, JSON.stringify(saved))
    }
  } catch {
    // Private mode / blocked storage — the URL still wins for this visit.
  }
}

/** `?lang=` first, then the stored choice, then the browser, then Uzbek. */
export function detectLanguage(): LanguageCode {
  const fromUrl = languageFromUrl()
  if (fromUrl) {
    rememberUrlLanguage(fromUrl)
    return fromUrl
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLanguage(stored)) return stored
  } catch {
    // Private mode / blocked storage — fall through to detection.
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : ''
  if (nav.startsWith('ru')) return 'ru'
  if (nav.startsWith('en')) return 'en'
  return DEFAULT_LANGUAGE
}

export function persistLanguage(code: LanguageCode) {
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    // Not fatal — the choice just will not survive a reload.
  }
  applyHtmlLang(code)
}

export function applyHtmlLang(code: LanguageCode) {
  const entry = LANGUAGES.find((l) => l.code === code)
  if (entry && typeof document !== 'undefined') {
    document.documentElement.lang = entry.htmlLang
  }
}

const warnedMissing = new Set<string>()

// Only the base copy is bundled with the entry. Feature sections arrive via
// `ensureSections()`, which every feature route awaits before it renders.
i18n.use(initReactI18next).init({
  resources: {
    uz: { translation: uz },
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: detectLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
  // Dev only: shout once per key that is missing from the bundles, so a
  // `defaultValue` fallback never quietly ships as the only copy.
  ...(import.meta.env.DEV
    ? {
        saveMissing: true,
        missingKeyHandler: (_lngs: readonly string[], ns: string, key: string) => {
          const id = `${i18n.language}:${ns}:${key}`
          if (warnedMissing.has(id)) return
          warnedMissing.add(id)
          console.warn(`[i18n] missing "${key}" (${i18n.language})`)
        },
      }
    : {}),
})

applyHtmlLang(i18n.language as LanguageCode)

export default i18n

let sectionsReady: Promise<void> | null = null

/**
 * Load every feature translation bundle and fold it into the active
 * namespaces. Idempotent, and safe to await from several routes at once.
 *
 * Route loaders await this alongside their own chunk, so a feature screen
 * never paints before its copy exists.
 */
export function ensureSections(): Promise<void> {
  if (!sectionsReady) {
    sectionsReady = loadSectionBundles().then((byLanguage) => {
      for (const [lang, tree] of Object.entries(byLanguage)) {
        // deep + overwrite: features extend the base tree, they do not replace it.
        i18n.addResourceBundle(lang, 'translation', tree, true, true)
      }
    })
  }
  return sectionsReady
}
