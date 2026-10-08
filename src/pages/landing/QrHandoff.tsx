import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import QRCode from 'qrcode'

import { EASE } from '@/design/motion'
import { palette } from '@/design/theme'

/**
 * Desktop "Continue on phone" (§5): a dialog with a QR code that opens the
 * capture flow on the phone. Rendered to a canvas in the brand colours rather
 * than fetched from an image service, so it works offline and leaks nothing.
 */
export function QrHandoff({
  open,
  onClose,
  url: urlProp,
}: {
  open: boolean
  onClose: () => void
  /** What the code opens. Defaults to the capture flow on this origin. */
  url?: string
}) {
  const { t } = useTranslation()
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const url =
    urlProp ?? (typeof window !== 'undefined' ? `${window.location.origin}/app/capture` : '')

  /* onClose is read through a ref: callers pass inline arrows, and re-running
     the focus effect on every render would bounce focus to the opener and
     back. */
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open || !url) return
    QRCode.toDataURL(url, {
      margin: 1,
      width: 512,
      color: { dark: palette.clay900, light: palette.paper },
      errorCorrectionLevel: 'M',
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(null))
  }, [open, url])

  useEffect(() => {
    if (!open) return
    // Hand focus back to whatever opened the dialog once it closes.
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            display: 'grid',
            placeItems: 'center',
            padding: 'var(--s5)',
            background: 'color-mix(in srgb, var(--clay-900) 55%, transparent)',
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('landing.hero.qrTitle')}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.26, ease: EASE }}
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(420px, 100%)',
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--s8)',
              display: 'grid',
              gap: 'var(--s5)',
              justifyItems: 'center',
              textAlign: 'center',
              boxShadow: 'var(--shadow-lifted)',
            }}
          >
            <span className="fs-label">{t('landing.hero.ctaPhone')}</span>
            <h2 style={{ fontSize: 'var(--step-2)' }}>{t('landing.hero.qrTitle')}</h2>

            <div
              style={{
                width: 208,
                height: 208,
                display: 'grid',
                placeItems: 'center',
                border: '1px solid var(--hairline)',
                borderRadius: 'var(--radius)',
                background: 'var(--paper)',
              }}
            >
              {dataUrl ? (
                <img src={dataUrl} alt={url} width={192} height={192} />
              ) : (
                <div className="fs-skeleton" style={{ width: 192, height: 192 }} />
              )}
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--step--1)' }}>
              {t('landing.hero.qrBody')}
            </p>

            <code
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--step--2)',
                color: 'var(--text-muted)',
                wordBreak: 'break-all',
              }}
            >
              {url}
            </code>

            <button ref={closeRef} type="button" onClick={onClose} className="fs-btn fs-btn--secondary">
              <span className="fs-btn__label">{t('nav.close')}</span>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
