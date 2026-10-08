import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { EASE } from '@/design/motion'

/**
 * Loading states, §3: never a bare spinner. A skeleton is shaped like the
 * content it stands in for, and a thin accent bar runs along the top of the
 * viewport while a route or request is in flight.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = 'var(--radius-sm)',
}: {
  width?: number | string
  height?: number | string
  radius?: string
}) {
  return (
    <div
      className="fs-skeleton"
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}

/** The shape of a furniture/project card while it loads. */
export function CardSkeleton() {
  const { t } = useTranslation()
  return (
    <div className="fs-card" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{t('a11y.loading', { defaultValue: 'Yuklanmoqda…' })}</span>
      <div className="fs-card__frame" aria-hidden="true">
        <div className="fs-skeleton" style={{ width: '100%', height: '100%' }} />
      </div>
      <div className="fs-card__body" aria-hidden="true">
        <Skeleton width={72} height={10} />
        <Skeleton width="70%" height={22} />
        <Skeleton width="45%" height={13} />
      </div>
    </div>
  )
}

export function ProgressBar({ active }: { active: boolean }) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  if (!active) return null
  return (
    <motion.div
      className="fs-progress"
      initial={{ scaleX: 0 }}
      animate={{ scaleX: reduced ? 1 : [0, 0.6, 0.85] }}
      transition={{ duration: reduced ? 0 : 2.4, ease: EASE }}
      role="progressbar"
      aria-label={t('a11y.loading', { defaultValue: 'Yuklanmoqda…' })}
    />
  )
}
