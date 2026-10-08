import { EASE, EASE_FLUID } from './motion'

/**
 * The same tokens as tokens.css, typed, for the places CSS cannot reach:
 * Three.js materials and lights, canvas drawing, chart colours, meta
 * theme-color. Keep this file and tokens.css in step — the styleguide renders
 * both side by side, so a drift is visible.
 */

export const palette = {
  /* brand ramp */
  clay900: '#2A1D16',
  clay700: '#4A3529',
  clay500: '#6B4A35',
  clay300: '#A67B5B',
  sand200: '#E4D9CB',
  paper: '#F6F1E9',
  white: '#FFFFFF',

  /* surfaces — the dark-tech names, remapped onto the warm ramp */
  ink1000: '#F6F1E9',
  ink900: '#FFFFFF',
  ink800: '#EFE8DD',
  ink700: '#E7DFD2',
  ink600: '#E4D9CB',

  /* text */
  text: '#4A3529',
  textStrong: '#2A1D16',
  textMuted: '#6B5A4D',
  textFaint: '#97897B',

  /* accent + status */
  accent: '#C6552F',
  accentInk: '#B44D2B',
  accentSoft: '#A67B5B',
  onAccent: '#F6F1E9',
  ok: '#4E6B4A',
  warn: '#B4832A',
  warnInk: '#876220',
  err: '#9E3A2B',

} as const

/**
 * Contrast against the page background (#F6F1E9), computed.
 * The styleguide recomputes these live rather than printing them, so this map
 * is only a reference for code that cannot call `contrast()`.
 */
export const contrastOnPage: Record<string, number> = {
  text: 10.19,
  textStrong: 14.53,
  textMuted: 5.85,
  accent: 3.94, // fills and large text only
  accentInk: 4.63,
  clay500: 7.03,
  clay300: 3.33, // decoration only
  ok: 5.3,
  warn: 3.0, // non-text only
  warnInk: 4.92,
  err: 6.04,
}

/** Dark mode, for the same non-CSS consumers. */
export const darkPalette = {
  bg: '#2A1D16',
  raised: '#352418',
  text: '#F6F1E9',
  textStrong: '#FFFFFF',
  textMuted: 'rgba(246, 241, 233, 0.64)',
  accent: '#CF6F4E',
  onAccent: '#2A1D16',
  ok: '#7FA37A',
  warn: '#C79733',
  err: '#D97A66',
} as const

export const ease = EASE
export const easeFluid = EASE_FLUID

export const breakpoints = {
  sm: 360,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1440,
} as const

/** Contrast ratio between two hex colours, WCAG 2.1 formula. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const c = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  const x = lum(a)
  const y = lum(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** AA verdict for a ratio at a given text size. */
export function aa(ratio: number, large = false): 'pass' | 'large-only' | 'fail' {
  if (ratio >= 4.5) return 'pass'
  if (ratio >= 3) return large ? 'pass' : 'large-only'
  return 'fail'
}

/**
 * Read a CSS custom property as a colour, with a fallback for the places that
 * run before styles resolve (Three.js material setup, canvas drawing).
 */
export function cssColor(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}
