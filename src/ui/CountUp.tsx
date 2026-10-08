import { useEffect, useMemo, useRef } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

/* The app's language codes onto Intl locales. Bare 'uz' resolves to Cyrillic
   in some engines, so the Latin script is named explicitly. */
const INTL_LOCALE: Record<string, string> = {
  uz: 'uz-Latn-UZ',
  ru: 'ru-RU',
  en: 'en-US',
}

/**
 * A number that counts up the first time it enters the viewport (brief §3).
 * Tabular figures so the width does not jitter while it runs, and the final
 * value is rendered immediately under prefers-reduced-motion.
 *
 * The running digits are hidden from assistive tech — a reader would otherwise
 * hear the starting value, or a half-counted one. A visually hidden copy of
 * the final value (or `final`, when the caller has better wording) is what
 * gets announced.
 */
export function CountUp({
  to,
  from = 0,
  duration = 1400,
  locale,
  suffix = '',
  prefix = '',
  decimals = 0,
  final,
}: {
  to: number
  from?: number
  duration?: number
  /** An Intl locale or an app language code. Defaults to the current language. */
  locale?: string
  suffix?: string
  prefix?: string
  decimals?: number
  /** What assistive tech reads instead of the formatted final value. */
  final?: string
}) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const numberRef = useRef<HTMLSpanElement | null>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const reduced = useReducedMotion()
  const { i18n } = useTranslation()
  const lang = locale ?? i18n.language
  const resolved = INTL_LOCALE[lang] ?? lang

  /* Built once, not per frame: constructing an Intl.NumberFormat is far more
     expensive than the formatting call it performs. */
  const format = useMemo(
    () =>
      new Intl.NumberFormat(resolved, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
    [resolved, decimals]
  )

  useEffect(() => {
    const node = numberRef.current
    if (!node) return

    /* The running number is written straight to the text node. Counting via
       React state re-rendered the whole span ~65 times per run, and Pricing
       mounts three of these at once. */
    if (!inView || reduced) {
      node.textContent = format.format(reduced ? to : from)
      return
    }

    let frame = 0
    const started = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration)
      // Ease-out cubic: fast start, long settle — matches the house curve.
      const eased = 1 - Math.pow(1 - t, 3)
      node.textContent = format.format(from + (to - from) * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [inView, reduced, from, to, duration, format])

  return (
    <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums' }}>
      <span aria-hidden="true">
        {prefix}
        <span ref={numberRef}>{format.format(reduced ? to : from)}</span>
        {suffix}
      </span>
      <span className="sr-only">{final ?? `${prefix}${format.format(to)}${suffix}`}</span>
    </span>
  )
}
