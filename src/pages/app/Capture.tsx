/**
 * /app/capture — the guided mobile capture flow (brief §6).
 *
 * Six screens, one state machine, one request. The shoot screen takes over the
 * whole viewport; everything else runs inside an editorial column with the
 * progress rail at the top, so the person always knows how far in they are.
 *
 * Entry points describe themselves in the query string: `?style=<STYLES name>`
 * preselects a look, `?mode=upload` starts on the gallery path, and
 * `?product=<slug>` shortlists the catalogue piece the person came from. The
 * current screen is mirrored into `?step=` so the browser's (and Android's)
 * back button walks back one screen instead of leaving the flow.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { EASE } from '@/design/motion'
import { Seo } from '@/lib/seo'
import { STYLES } from '@/lib/styles.js'
import { getProduct } from '@/features/catalog/data'
import { useSaved } from '@/store/projects'
import { ArrowButton, CaptureStyles, Eyebrow, Notice, StepRail } from '@/features/capture/Chrome'
import { useCaptureFlow } from '@/features/capture/useCaptureFlow'
import type { CaptureOutcome } from '@/features/capture/useCaptureFlow'
import { PermissionStep } from '@/features/capture/steps/PermissionStep'
import { RoomStep } from '@/features/capture/steps/RoomStep'
import { ShootStep } from '@/features/capture/steps/ShootStep'
import { UploadStep } from '@/features/capture/steps/UploadStep'
import { ReviewStep } from '@/features/capture/steps/ReviewStep'
import { PlanStep } from '@/features/capture/steps/PlanStep'
import { FailedStep, GeneratingStep } from '@/features/capture/steps/GeneratingStep'
import { isCaptureStep } from '@/features/capture/types'
import type { CaptureRecord, CaptureStep } from '@/features/capture/types'

const CSS = `
.cap-page {
  min-height: 100dvh;
  background: var(--bg);
  padding-block: var(--s16) var(--s24);
}
.cap-page__inner {
  width: 100%;
  max-width: 1180px;
  margin-inline: auto;
  padding-inline: var(--gutter);
  display: grid;
  gap: var(--s12);
}
.cap-page__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s5);
  flex-wrap: wrap;
}
.cap-page__rail { flex: 1 1 200px; max-width: 360px; }
.cap-page__draft { display: grid; gap: var(--s3); }
.cap-page__draftActions { display: grid; gap: var(--s2); margin-top: var(--s2); }
.cap-page__step h1:focus { outline: none; }
@media (min-width: 720px) {
  .cap-page__draftActions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1080px) {
  .cap-page { padding-block: var(--s24); }
}
@media (max-width: 599px) {
  .cap-page { padding-block: var(--s8) var(--s16); }
  .cap-page__inner { gap: var(--s8); }
  .cap-page__rail { max-width: none; }
}
`

/** Only the screens that sit inside the page shell count toward the rail. */
const RAIL_ORDER: CaptureStep[] = ['permission', 'room', 'shoot', 'review', 'plan', 'generating']

/** Position in the flow, for deciding whether a step change is "forward". */
const FLOW_ORDER: CaptureStep[] = ['permission', 'room', 'shoot', 'review', 'plan', 'generating', 'failed']

/** "02 — Xona" → "Xona": the rail already prints the number. */
function stripNumber(eyebrow: string) {
  return eyebrow.replace(/^\s*\d+\s*[—–-]\s*/, '')
}

export function Capture() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [params, setParams] = useSearchParams()

  // Read the entry parameters once; later URL changes are the step mirror.
  const entry = useRef<{
    mode: 'camera' | 'upload'
    step: CaptureStep | null
    style: string | null
    product: string | null
  } | null>(null)
  if (!entry.current) {
    const style = params.get('style')
    const step = params.get('step')
    entry.current = {
      mode: params.get('mode') === 'upload' ? 'upload' : 'camera',
      step: isCaptureStep(step) ? step : null,
      style: STYLES.some((s: { name: string }) => s.name === style) ? style : null,
      product: params.get('product'),
    }
  }

  const product = useMemo(() => getProduct(entry.current?.product || undefined), [])
  const productName = product
    ? t(`catalog.products.${product.nameKey}.name`, { defaultValue: product.slug })
    : null

  // `?product=` shortlists the piece, so it waits on the Saved page and in
  // the brief sent with the render.
  const save = useSaved((s) => s.save)
  useEffect(() => {
    if (!product) return
    save({
      id: product.id,
      name: productName || product.slug,
      category: product.category,
      style: product.style,
      price: product.priceUzs,
      currency: product.currency,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product])

  const onComplete = useCallback(
    (record: CaptureRecord, outcome: CaptureOutcome) => {
      navigate(`/app/result/${record.id}`, {
        state: { recordId: record.id, storageFull: outcome.storageFull, evicted: outcome.evicted },
      })
    },
    [navigate]
  )

  const flow = useCaptureFlow(onComplete, {
    mode: entry.current.mode,
    initialStep: entry.current.step,
    initialStyle: entry.current.style,
    featured: product
      ? `${productName} (${product.dimensions.widthCm}×${product.dimensions.depthCm}×${product.dimensions.heightCm} cm)`
      : null,
  })

  /* ------------------------------------------------- step ⇄ URL mirror */

  const urlStep = params.get('step')

  // Flow → URL. Forward moves push a history entry, so back returns to the
  // previous screen; sideways and backward moves replace.
  useEffect(() => {
    if (urlStep === flow.step) return
    const from = isCaptureStep(urlStep) ? FLOW_ORDER.indexOf(urlStep) : -1
    const to = FLOW_ORDER.indexOf(flow.step)
    const forward = from >= 0 && to > from && flow.step !== 'failed'
    const next = new URLSearchParams(params)
    next.set('step', flow.step)
    setParams(next, { replace: !forward })
    // Only the flow's own step drives this direction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.step])

  // URL → flow: the back and forward buttons. Skipped on mount: the flow may
  // deliberately start elsewhere than `?step=` (e.g. a pending draft keeps it
  // on the room step), and flow → URL above corrects the URL in that case.
  // Obeying the stale entry value here would make the two effects ping-pong.
  const urlMirrorMounted = useRef(false)
  useEffect(() => {
    if (!urlMirrorMounted.current) {
      urlMirrorMounted.current = true
      return
    }
    if (!isCaptureStep(urlStep) || urlStep === flow.step) return
    // The request cannot be paused or resumed. Back during it is held here;
    // the waiting screen says why.
    if (flow.step === 'generating') {
      const next = new URLSearchParams(params)
      next.set('step', 'generating')
      setParams(next, { replace: true })
      return
    }
    flow.goTo(urlStep)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlStep])

  /* --------------------------------------------- scroll and focus follow */

  const pendingFocus = useRef(false)
  const firstStep = useRef(true)
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
    pendingFocus.current = true
    // The shoot screen has no enter animation to wait for.
    if (flow.step === 'shoot' && flow.mode === 'camera') focusHeading()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.step])

  function focusHeading() {
    if (!pendingFocus.current) return
    pendingFocus.current = false
    window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>('[data-cap-step] h1')
      heading?.focus({ preventScroll: true })
    })
  }

  /* ---------------------------------------------------------------- rail */

  const railStep: CaptureStep = flow.step === 'failed' ? 'generating' : flow.step
  const railIndex = Math.max(0, RAIL_ORDER.indexOf(railStep)) + 1
  const stepName = stripNumber(t(`capture.${railStep}.eyebrow`, { defaultValue: '' }))
  const railLabel = [t('capture.stepOf', { step: railIndex, total: RAIL_ORDER.length }), stepName]
    .filter(Boolean)
    .join(' · ')

  const seo = (
    <Seo
      title={t('capture.ux.metaTitle')}
      description={t('capture.ux.metaDesc')}
      path="/app/capture"
      noindex
    />
  )

  if (flow.step === 'shoot' && flow.mode === 'camera') {
    return (
      <ShootStepShell>
        {seo}
        <div data-cap-step>
          <ShootStep flow={flow} />
        </div>
      </ShootStepShell>
    )
  }

  return (
    <main className="cap-page">
      {seo}
      <CaptureStyles />
      <style href="fs-cap-page" precedence="medium">
        {CSS}
      </style>

      <div className="cap-page__inner">
        <div className="cap-page__top">
          <Eyebrow>{t('capture.brandLine')}</Eyebrow>
          <div className="cap-page__rail">
            <StepRail
              total={RAIL_ORDER.length}
              current={railIndex}
              label={railLabel}
              valueText={`${railIndex}/${RAIL_ORDER.length} · ${stepName}`}
            />
          </div>
        </div>

        {flow.draft && (
          <div className="cap-page__draft">
            <Notice
              title={t('capture.draft.title', { defaultValue: 'Toʻxtagan joyingizdan davom etasizmi?' })}
              action={
                <div className="cap-page__draftActions">
                  <ArrowButton glyph="arrow" onClick={flow.resumeDraft}>
                    {t('capture.draft.resume', { defaultValue: 'Davom etish' })}
                  </ArrowButton>
                  <ArrowButton quiet glyph="back" onClick={flow.discardDraft}>
                    {t('capture.draft.restart', { defaultValue: 'Boshidan boshlash' })}
                  </ArrowButton>
                </div>
              }
            >
              {[
                flow.draft.roomName,
                flow.draft.shots
                  ? t('result.meta.shots', { count: flow.draft.shots, defaultValue: '{{count}} kadr' })
                  : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </Notice>
          </div>
        )}

        {flow.notice === 'cancelled' && (
          <Notice
            title={t('capture.ux.cancelled')}
            onDismiss={flow.dismissNotice}
            dismissLabel={t('nav.close', { defaultValue: 'Yopish' })}
          />
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={flow.step === 'shoot' ? `shoot-${flow.mode}` : flow.step}
            className="cap-page__step"
            data-cap-step
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={{ duration: reduced ? 0 : 0.22, ease: EASE }}
            onAnimationComplete={focusHeading}
          >
            {flow.step === 'permission' && <PermissionStep flow={flow} />}
            {flow.step === 'room' && <RoomStep flow={flow} />}
            {flow.step === 'shoot' && <UploadStep flow={flow} />}
            {flow.step === 'review' && <ReviewStep flow={flow} />}
            {flow.step === 'plan' && <PlanStep flow={flow} />}
            {flow.step === 'generating' && <GeneratingStep flow={flow} />}
            {flow.step === 'failed' && <FailedStep flow={flow} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  )
}

/** The camera screen owns the viewport; it still needs the shared chrome CSS. */
function ShootStepShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CaptureStyles />
      {children}
    </>
  )
}

export default Capture
