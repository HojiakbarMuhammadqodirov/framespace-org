/** Numeric readouts. Metres with two decimals, money in the visitor's currency. */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import type { LanguageCode } from '@/i18n/config'
import { usePrefs, type Currency } from '@/store/prefs'

const LOCALE: Record<LanguageCode, string> = {
  uz: 'uz-Latn-UZ',
  ru: 'ru-RU',
  en: 'en-US',
}

/**
 * Reference rate for showing UZS prices in dollars. Prices, budgets and the
 * payload stay in soʻm; USD is a display conversion only.
 */
export const UZS_PER_USD = 12_700

export function localeOf(lang: string): string {
  return LOCALE[lang.slice(0, 2) as LanguageCode] ?? LOCALE.en
}

/** "3.40" — the architectural dimension always keeps both decimals. */
export function metres(value: number): string {
  return (Math.round(value * 100) / 100 + 0).toFixed(2)
}

export function squareMetres(value: number): string {
  return value.toFixed(1)
}

const UNIT: Record<string, string> = { uz: 'soʻm', ru: 'сум', en: 'UZS' }
const MILLION: Record<string, string> = { uz: 'mln', ru: 'млн', en: 'M' }
const THOUSAND: Record<string, string> = { uz: 'ming', ru: 'тыс.', en: 'K' }

function group(value: number, lang: string, digits = 0): string {
  try {
    return new Intl.NumberFormat(localeOf(lang), {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(value)
  } catch {
    return digits ? value.toFixed(digits) : String(Math.round(value))
  }
}

/** Full sum: "5 900 000 soʻm" or "$465". Input is always UZS. */
export function money(uzs: number, lang: string, currency: Currency = 'UZS'): string {
  const code = lang.slice(0, 2)
  if (currency === 'USD') {
    const usd = uzs / UZS_PER_USD
    try {
      return new Intl.NumberFormat(localeOf(lang), {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: usd >= 100 ? 0 : 2,
      }).format(usd)
    } catch {
      return `$${Math.round(usd)}`
    }
  }
  return `${group(Math.round(uzs), lang)} ${UNIT[code] ?? 'UZS'}`
}

/** Counter form: "5,9 mln" / "$465" — seven-digit sums do not fit a corner readout. */
export function moneyShort(uzs: number, lang: string, currency: Currency = 'UZS'): string {
  const code = lang.slice(0, 2)
  if (currency === 'USD') {
    const usd = uzs / UZS_PER_USD
    if (Math.abs(usd) >= 10_000) return `$${group(usd / 1000, lang, 1)}${code === 'en' ? 'K' : ` ${THOUSAND[code]}`}`
    return `$${group(usd, lang, 0)}`
  }
  const abs = Math.abs(uzs)
  if (abs >= 1_000_000) return `${group(uzs / 1_000_000, lang, abs >= 100_000_000 ? 0 : 1)} ${MILLION[code] ?? 'M'}`
  if (abs >= 1_000) return `${group(uzs / 1_000, lang, 0)} ${THOUSAND[code] ?? 'K'}`
  return group(uzs, lang)
}

/** Formatters bound to the current language and the currency preference. */
export function useMoneyFormat() {
  const { i18n } = useTranslation()
  const currency = usePrefs((s) => s.currency)
  const lang = i18n.language
  const full = useCallback((uzs: number) => money(uzs, lang, currency), [lang, currency])
  const short = useCallback((uzs: number) => moneyShort(uzs, lang, currency), [lang, currency])
  return { full, short, currency, lang }
}
