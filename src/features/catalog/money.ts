import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * UZS formatting. Prices arrive as integer soʻm and are never floats, so the
 * only decisions here are grouping and where the unit sits.
 *
 * The unit itself is a translated string (`soʻm` / `сум` / `UZS`), which is
 * why this is a hook and not a bare function.
 */

const LOCALE: Record<string, string> = {
  uz: 'uz-UZ',
  ru: 'ru-RU',
  en: 'en-US',
}

function groupingLocale(lang: string): string {
  return LOCALE[lang.slice(0, 2)] ?? 'uz-UZ'
}

export function formatUzsNumber(amount: number, lang: string, fractionDigits = 0): string {
  try {
    return new Intl.NumberFormat(groupingLocale(lang), {
      maximumFractionDigits: fractionDigits,
    }).format(amount)
  } catch {
    return fractionDigits ? amount.toFixed(fractionDigits) : String(Math.round(amount))
  }
}

export interface MoneyFormatters {
  /** "12 400 000 soʻm" */
  price: (amount: number) => string
  /** "12,4 mln soʻm" — dashboards and dense tables. */
  compact: (amount: number) => string
  /** The grouped number with no unit, for mono micro-labels beside a label. */
  plain: (amount: number) => string
  unit: string
}

export function useMoney(): MoneyFormatters {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const unit = t('catalog.currency.uzs')
  const million = t('catalog.currency.million')
  const thousand = t('catalog.currency.thousand')

  const plain = useCallback((amount: number) => formatUzsNumber(amount, lang), [lang])

  const price = useCallback(
    (amount: number) => `${formatUzsNumber(amount, lang)} ${unit}`,
    [lang, unit],
  )

  const compact = useCallback(
    (amount: number) => {
      if (amount >= 1_000_000) {
        const value = amount / 1_000_000
        return `${formatUzsNumber(value, lang, value >= 100 ? 0 : 1)} ${million} ${unit}`
      }
      if (amount >= 1_000) {
        return `${formatUzsNumber(Math.round(amount / 1_000), lang)} ${thousand} ${unit}`
      }
      return `${formatUzsNumber(amount, lang)} ${unit}`
    },
    [lang, million, thousand, unit],
  )

  return { price, compact, plain, unit }
}

/** Plain integer counts (views, placements) with the active locale's grouping. */
export function useCount(): (value: number) => string {
  const { i18n } = useTranslation()
  const lang = i18n.language
  return useCallback((value: number) => formatUzsNumber(value, lang), [lang])
}
