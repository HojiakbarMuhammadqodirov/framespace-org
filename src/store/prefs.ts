import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import i18n, { applyHtmlLang, type LanguageCode, detectLanguage, persistLanguage } from '@/i18n/config'

export type Theme = 'light' | 'dark'
export type Currency = 'UZS' | 'USD'

type PrefsState = {
  lang: LanguageCode
  currency: Currency
  theme: Theme
  setLang: (lang: LanguageCode) => void
  setCurrency: (currency: Currency) => void
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#2A1D16' : '#F6F1E9')
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set, get) => ({
      lang: detectLanguage(),
      // UZS by default, USD as the toggle — brief §1.
      currency: 'UZS',
      // Beige is the product surface (light by default, matching index.html's
      // inline script); dark only when the user picks it.
      theme: 'light',

      setLang: (lang) => {
        i18n.changeLanguage(lang)
        // Also writes framespace.lang, which index.html's inline script reads.
        persistLanguage(lang)
        set({ lang })
      },
      setCurrency: (currency) => set({ currency }),
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
      toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
    }),
    {
      // v2: the default theme flipped to dark, so the old stored value must not
      // pin returning visitors to light.
      name: 'framespace.prefs.v3',
      // Re-apply to the DOM on rehydrate; zustand/persist runs this after the
      // stored value lands, which is the only point the theme is known.
      onRehydrateStorage: () => (state) => {
        if (!state) return
        applyTheme(state.theme)
        if (state.lang !== i18n.language) {
          i18n.changeLanguage(state.lang)
          applyHtmlLang(state.lang)
        }
      },
    }
  )
)

/** Called once from main.tsx before first paint. */
export function initPrefs() {
  const { theme } = usePrefs.getState()
  applyTheme(theme)
}
