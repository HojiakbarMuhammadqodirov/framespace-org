/**
 * Money in the visitor's chosen currency (Settings: UZS / USD).
 *
 * A brief or a project is priced in whatever currency its request carried;
 * when that differs from the preference the figure is converted at the same
 * reference rate the room builder uses, so every price in /app reads the same
 * way — result page, dashboard cards and the builder alike.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { formatMoney } from '@/lib/styles.js'
import { usePrefs } from '@/store/prefs'
import { UZS_PER_USD } from '@/features/room-builder/format'

export { UZS_PER_USD }

export function localeTagOf(lang: string | undefined): string {
  const code = (lang || 'uz').slice(0, 2)
  return code === 'ru' ? 'ru-RU' : code === 'en' ? 'en-US' : 'uz-Latn-UZ'
}

export function useMoneyIn(source: string | undefined) {
  const { i18n } = useTranslation()
  const preferred = usePrefs((s) => s.currency)
  const from = String(source || 'UZS').toUpperCase()
  const tag = localeTagOf(i18n.language)
  // Only the two currencies the product knows are swapped; anything else the
  // model returned is printed as it came.
  const to = from === 'UZS' || from === 'USD' ? preferred : from
  const convert = useCallback(
    (amount: number) => {
      const value = Number(amount) || 0
      if (from === to) return value
      if (from === 'UZS' && to === 'USD') return value / UZS_PER_USD
      if (from === 'USD' && to === 'UZS') return value * UZS_PER_USD
      return value
    },
    [from, to]
  )
  const format = useCallback(
    (amount: number) => formatMoney(convert(amount), to, tag),
    [convert, to, tag]
  )
  return { format, converted: from !== to, currency: to, tag }
}
