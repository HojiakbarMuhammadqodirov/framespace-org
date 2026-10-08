import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/ui/Skeleton'

/**
 * What a lazy route shows while its chunk and copy load. It sits inside the
 * layout, so the header, dock and backdrop stay painted around it instead of
 * the whole screen blanking out.
 */
export function PageFallback() {
  const { t } = useTranslation()
  return (
    <div
      className="fs-container"
      role="status"
      aria-busy="true"
      aria-label={t('a11y.loading', { defaultValue: 'Yuklanmoqda' })}
      style={{ paddingBlock: 'var(--s24)', display: 'grid', gap: 'var(--s4)' }}
    >
      <Skeleton width={120} height={12} />
      <Skeleton width="70%" height={56} />
      <Skeleton width="50%" height={20} />
    </div>
  )
}
