/**
 * What the screens that start a render (capture plan, 3D builder generate)
 * need to know about the server's cost controls, in one place:
 *
 *   needsSignIn     renders cost money and nobody is signed in → 401 ahead
 *   quota           today's allowance for the signed-in user (or null)
 *   dailyExhausted  the allowance is used up → 429 ahead
 *   resetTime       when it comes back, in the visitor's local time
 */
import { useTranslation } from 'react-i18next'

import { liveQuota, useSession } from '@/store/session'

export function formatResetTime(iso: string | undefined, lang: string): string {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat(lang === 'uz' ? 'uz-Latn-UZ' : lang, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return new Date(iso).toLocaleTimeString()
  }
}

export function useRenderAllowance() {
  const { i18n } = useTranslation()
  const user = useSession((s) => s.user)
  const rawQuota = useSession((s) => s.quota)
  const access = useSession((s) => s.renderAccess)
  const left = useSession((s) => s.generationsLeft())
  const quota = user ? liveQuota(rawQuota) : null

  return {
    left,
    quota,
    needsSignIn: !user && Boolean(access?.requireAuth),
    dailyExhausted: Boolean(quota && quota.remaining <= 0),
    resetTime: formatResetTime(quota?.resetsAt, i18n.language),
  }
}
