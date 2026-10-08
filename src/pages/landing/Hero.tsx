import { Suspense, lazy, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { SCENE_CAPABLE, useMediaQuery } from '@/lib/useMediaQuery'
import { HeroDesktop } from './hero/HeroDesktop'
import { HeroMobile } from './hero/HeroMobile'

// qrcode is only ever needed behind a click, so it stays out of the entry chunk.
const QrHandoff = lazy(() => import('./QrHandoff').then((m) => ({ default: m.QrHandoff })))

type StyleChip = { key: string; label: string }

/**
 * The landing hero.
 *
 * A pointer-capable screen ≥820px gets the scroll-choreographed 3D stage
 * (`hero/HeroDesktop`). Phones and tablets never mount Three.js — that's a
 * hard performance rule, not a CSS trick: `display: none` still downloads and
 * mounts the WebGL bundle (704 KB), so the split happens here in JS via
 * `useMediaQuery(SCENE_CAPABLE)`, and `hero/HeroDesktop` (with its lazy
 * `HeroScene` import) is simply never rendered on a coarse pointer.
 *
 * The test used to be width alone at 1024px, which meant a laptop with a
 * narrow window silently lost the one moment on the page that sells the
 * product. `pointer: fine` keeps phones out; width no longer stands in for
 * capability.
 */
export function Hero() {
  const { t } = useTranslation()
  const [styleKey, setStyleKey] = useState('japandi')
  const [qrOpen, setQrOpen] = useState(false)
  const isDesktop = useMediaQuery(SCENE_CAPABLE)
  const reduced = useReducedMotion()

  const chips = (t('landing.hero.styleChips', { returnObjects: true }) as StyleChip[]) || []

  return (
    // The slot reserves the first viewport before either variant has laid
    // out, so the proof strip below never flashes up and gets shoved down.
    <div className="fs-hero-slot">
      <style href="fs-hero-slot" precedence="medium">{`
        .fs-hero-slot { min-height: calc(100svh - var(--hdr-offset, 0px)); }
      `}</style>
      {isDesktop ? (
        <HeroDesktop
          styleKey={styleKey}
          setStyleKey={setStyleKey}
          chips={chips}
          onPhoneHandoff={() => setQrOpen(true)}
          reduced={Boolean(reduced)}
        />
      ) : (
        <HeroMobile />
      )}

      {qrOpen && (
        <Suspense fallback={null}>
          <QrHandoff open onClose={() => setQrOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}
