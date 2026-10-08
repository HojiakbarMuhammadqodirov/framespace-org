import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import type { Angle } from './contract'

/**
 * Angle ids come from the frozen shared contract and must never be translated
 * — they are what the server matches on. The label and hint a person reads are
 * looked up here, falling back to the English strings in `server/angles.js` if
 * a locale is missing one.
 */
export function useAngleCopy() {
  const { t } = useTranslation()
  return useCallback(
    (angle: Angle) => ({
      label: t(`capture.angles.${angle.id}.label`, { defaultValue: angle.label }),
      hint: t(`capture.angles.${angle.id}.hint`, { defaultValue: angle.hint }),
    }),
    [t]
  )
}
