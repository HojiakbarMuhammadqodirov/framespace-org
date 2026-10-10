import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { ensureAwake, useServerWake } from '@/lib/wake'

const CSS = `
.fs-wake {
  position: fixed; z-index: 120; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 96px);
  transform: translateX(-50%);
  display: flex; align-items: center; gap: var(--s3);
  max-width: min(92vw, 30rem); padding: var(--s3) var(--s5);
  border-radius: 999px; background: var(--bg-raised); color: var(--text-strong);
  box-shadow: 0 12px 32px -12px rgba(42, 29, 22, 0.35), inset 0 0 0 1px var(--hairline);
  font-size: var(--step--1); line-height: 1.35;
}
.fs-wake__dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: fs-wake-pulse 1.4s ease-in-out infinite; }
.fs-wake[data-state="down"] .fs-wake__dot { background: var(--err); animation: none; }
.fs-wake button {
  flex: none; border: 0; background: none; padding: 0; cursor: pointer;
  color: var(--accent-ink); font: inherit; font-weight: 600; text-decoration: underline;
}
@keyframes fs-wake-pulse { 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) { .fs-wake__dot { animation: none; } }
`

/**
 * "Waking up the server" — shown only while the free API host boots after
 * sleeping (see src/lib/wake.ts), or when it never answered.
 */
export function ServerWakeNotice() {
  const { t } = useTranslation()
  const state = useServerWake()

  // Start waking the server as soon as the app loads, so it is usually up by
  // the time someone signs in or presses Generate.
  useEffect(() => {
    void ensureAwake()
  }, [])

  if (state === 'awake') return null
  return (
    <div className="fs-wake" data-state={state} role="status" aria-live="polite">
      <style href="fs-wake" precedence="medium">
        {CSS}
      </style>
      <span className="fs-wake__dot" aria-hidden="true" />
      <span>{state === 'waking' ? t('wake.waking') : t('wake.down')}</span>
      {state === 'down' && (
        <button type="button" onClick={() => void ensureAwake()}>
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}
