/**
 * /app/result/:id — the finished room (brief §8).
 *
 * Everything on this page is one `/api/render` response plus the photos that
 * produced it. The response arrives once, in full, and is held in memory and in
 * this feature's own localStorage slot; there is no endpoint to re-fetch it
 * from, which is why "save" writes and "share" sends the image itself where
 * the phone allows it, and otherwise copies a link that only resolves on this
 * device — and says so.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { DESKTOP, useMediaQuery } from '@/lib/useMediaQuery'
import { Seo } from '@/lib/seo'
import { QrHandoff } from '@/pages/landing/QrHandoff'
import { ArrowButton, Bezel, CaptureStyles, Eyebrow, Notice, Rise } from '@/features/capture/Chrome'
import { dataUrlToFile, downloadDataUrl, extensionOf } from '@/features/capture/frame'
import { useDateFormat } from '@/features/capture/hooks'
import {
  AngleStage,
  AngleThumbs,
  BudgetPanel,
  FailuresNotice,
  FurnitureList,
  PaletteGrid,
  Panel,
  RenderGallery,
  ResultStyles,
  RoomDims,
  TagRow,
} from '@/features/capture/ResultParts'
import { duplicateRecord, getRecord, isSaved, persistRecord, variantsOf } from '@/features/capture/store'

const CSS = `
.cap-result { min-height: 100dvh; background: var(--bg); padding-block: var(--s16) var(--s24); }
.cap-result__inner {
  width: 100%;
  max-width: 1180px;
  margin-inline: auto;
  padding-inline: var(--gutter);
  display: grid;
  gap: var(--s16);
}
.cap-result__head { display: grid; gap: var(--s5); justify-items: start; }
.cap-result__title { font-size: var(--step-4); max-width: 14ch; }
.cap-result__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s5);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.cap-result__stage { display: grid; gap: var(--s5); }
.cap-result__chips { display: flex; flex-wrap: wrap; gap: var(--s2); align-items: center; }
.cap-result__chip {
  min-height: var(--tap);
  padding: 0 var(--s4);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color var(--d-fast) var(--ease), border-color var(--d-fast) var(--ease),
    background-color var(--d-fast) var(--ease), transform var(--d-fast) var(--ease);
}
@media (hover: hover) and (pointer: fine) {
  .cap-result__chip:hover { color: var(--text-strong); border-color: var(--border-strong); }
}
.cap-result__chip:active { transform: scale(0.98); }
.cap-result__chip[aria-pressed='true'] {
  background: var(--text-strong);
  border-color: var(--text-strong);
  color: var(--bg);
}
.cap-result__grid { display: grid; gap: var(--s6); }
.cap-result__actions { display: grid; gap: var(--s3); }
.cap-result__secondary { display: grid; gap: var(--s2); }
.cap-result__link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s4);
  width: 100%;
  min-height: var(--tap);
  padding: var(--s3) var(--s4);
  border: 0;
  border-bottom: 1px solid var(--hairline);
  background: none;
  color: var(--text);
  font-size: var(--step--1);
  text-align: left;
  cursor: pointer;
  transition: color var(--d-fast) var(--ease), padding-left var(--d-base) var(--ease);
}
.cap-result__link[disabled] { opacity: 0.5; cursor: default; }
.cap-result__linkKey--action {
  min-height: var(--tap);
  display: inline-flex;
  align-items: center;
  padding: 0 var(--s2);
  border: 0;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.cap-result__row { display: flex; flex-wrap: wrap; align-items: stretch; border-bottom: 1px solid var(--hairline); }
.cap-result__row > .cap-result__link { border-bottom: 0; flex: 1 1 200px; }
.cap-result__row > .cap-result__linkKey--action { flex: none; margin-left: auto; }
@media (hover: hover) and (pointer: fine) {
  .cap-result__link:not([disabled]):hover { color: var(--text-strong); padding-left: var(--s5); }
}
.cap-result__linkKey {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.cap-result__empty { display: grid; gap: var(--s6); justify-items: start; max-width: 46ch; }
@media (min-width: 1080px) {
  .cap-result__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s6); align-items: start; }
  .cap-result__grid > .cap-result__wide { grid-column: 1 / -1; }
  .cap-result__lead { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.65fr); gap: var(--s10); align-items: start; }
}
@media (min-width: 1080px) {
  .cap-result__aside { position: sticky; top: calc(var(--header-h, 72px) + var(--s6)); }
}
@media (max-width: 599px) {
  .cap-result { padding-block: var(--s8) var(--s16); }
  .cap-result__inner { gap: var(--s10); }
  .cap-result__title { font-size: var(--step-3); max-width: none; }
  .cap-result__meta { gap: var(--s2) var(--s4); }
}
.cap-result__title em { font-style: italic; color: var(--accent-ink); }
@media (prefers-reduced-motion: reduce) {
  .cap-result__link:hover { padding-left: var(--s4); }
  .cap-result__chip:active { transform: none; }
}
`

export function Result() {
  const { t } = useTranslation()
  const params = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const desktop = useMediaQuery(DESKTOP)
  const formatDate = useDateFormat()

  const arrival = location.state as
    | { recordId?: string; storageFull?: boolean; evicted?: number }
    | null
  const stateId = arrival?.recordId
  const [recordId, setRecordId] = useState<string>(params.id || stateId || 'latest')
  const [saveTick, setSaveTick] = useState(0)
  const [shareState, setShareState] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle')
  // Capture tells us on arrival whether the save landed and what it cost.
  const [storageFull, setStorageFull] = useState(Boolean(arrival?.storageFull))
  const [evicted, setEvicted] = useState(arrival?.evicted || 0)
  const [downloading, setDownloading] = useState(false)
  const downloadTimers = useRef<number[]>([])
  useEffect(() => () => downloadTimers.current.forEach((id) => window.clearTimeout(id)), [])
  const [qrOpen, setQrOpen] = useState(false)

  // The route can change under us (a duplicate, a back button) without the
  // component remounting.
  useEffect(() => {
    if (params.id && params.id !== recordId) {
      setRecordId(params.id)
      setActiveAngle('')
      setShareState('idle')
    }
  }, [params.id, recordId])

  const record = useMemo(() => getRecord(recordId), [recordId, saveTick])
  const renders = record?.result.renders || []
  const [activeAngle, setActiveAngle] = useState<string>('')
  const active = renders.find((r) => r.angleId === activeAngle) || renders[0]
  const variants = useMemo(() => variantsOf(record), [record, saveTick])
  const saved = record ? isSaved(record.id) : false
  // Builder projects have renders but no photographs behind them.
  const hasShots = Boolean(
    record && (record.capture?.shots?.length || Object.keys(record.before || {}).length)
  )
  const hasScene = useMemo(() => {
    if (!record) return false
    try {
      return localStorage.getItem(`framespace.room.${record.id}`) != null
    } catch {
      return false
    }
  }, [record])
  const fallbackCount = renders.filter((r) => r.fallback).length
  const warnings = (record?.result.warnings || []).filter((w) => w && (w.error || w.stage))

  const brief = record?.result.brief || {}
  const design = brief.design || {}
  const currency = brief.budget?.currency || record?.budget?.currency || 'UZS'

  const onSave = useCallback(async () => {
    if (!record) return
    try {
      const outcome = await persistRecord(record)
      setStorageFull(false)
      setEvicted(outcome.evicted)
      setSaveTick((n) => n + 1)
    } catch {
      setStorageFull(true)
    }
  }, [record])

  const onDuplicate = useCallback(async () => {
    if (!record) return
    const copy = duplicateRecord(record)
    let full = false
    let dropped = 0
    try {
      dropped = (await persistRecord(copy)).evicted
    } catch {
      full = true
    }
    setRecordId(copy.id)
    navigate(`/app/result/${copy.id}`, {
      state: { recordId: copy.id, storageFull: full, evicted: dropped },
    })
    setStorageFull(full)
    setEvicted(dropped)
  }, [navigate, record])

  const stem = (record?.roomName || 'framespace').replace(/\s+/g, '-').toLowerCase()

  const onShare = useCallback(async () => {
    if (!record || !active) return
    // The picture itself, where the phone can send files (Telegram, gallery):
    // that is the only share that works for someone on another device.
    try {
      const file = await dataUrlToFile(
        active.image,
        `${stem}-${active.angleId}.${extensionOf(active.image)}`
      )
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: record.roomName || 'FrameSpace' })
        setShareState('shared')
        return
      }
    } catch (err) {
      // The person closed the share sheet — not a failure, nothing to say.
      if ((err as DOMException)?.name === 'AbortError') return
    }
    // Otherwise a link — which only opens here, and the label says so.
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/app/result/${record.id}`)
      setShareState('copied')
    } catch {
      setShareState('failed')
    }
  }, [active, record, stem])

  /** The angle on stage. */
  const onDownload = useCallback(() => {
    if (!active) return
    downloadDataUrl(active.image, `${stem}-${active.angleId}.${extensionOf(active.image)}`)
  }, [active, stem])

  /** Every angle, 400 ms apart — browsers block a burst of downloads. */
  const onDownloadAll = useCallback(() => {
    if (!renders.length) return
    downloadTimers.current.forEach((id) => window.clearTimeout(id))
    setDownloading(true)
    downloadTimers.current = renders.map((render, i) =>
      window.setTimeout(() => {
        downloadDataUrl(render.image, `${stem}-${render.angleId}.${extensionOf(render.image)}`)
        if (i === renders.length - 1) setDownloading(false)
      }, i * 400)
    )
  }, [renders, stem])

  /* ------------------------------------------------------------- empty */

  const seo = (
    <Seo
      title={t('capture.ux.resultTitle', {
        name:
          record?.roomName ||
          (record ? t(`capture.room.types.${record.roomType}`) : t('result.eyebrow')),
      })}
      description={t('capture.ux.resultDesc')}
      path={`/app/result/${params.id || ''}`}
      noindex
    />
  )

  if (!record || !active) {
    return (
      <main className="cap-result">
        {seo}
        <CaptureStyles />
        <ResultStyles />
        <style href="fs-cap-resultpage" precedence="medium">
          {CSS}
        </style>
        <div className="cap-result__inner">
          <Bezel>
            <div className="cap-result__empty">
              <Eyebrow>{t('result.eyebrow')}</Eyebrow>
              <h1 style={{ fontSize: 'var(--step-3)' }}>{t('result.empty.title')}</h1>
              <p style={{ color: 'var(--text-muted)' }}>{t('result.empty.body')}</p>
              <ArrowButton auto onClick={() => navigate('/app/capture')}>
                {t('result.empty.cta')}
              </ArrowButton>
            </div>
          </Bezel>
        </div>
      </main>
    )
  }

  return (
    <main className="cap-result">
      {seo}
      <CaptureStyles />
      <ResultStyles />
      <style href="fs-cap-resultpage" precedence="medium">
        {CSS}
      </style>

      <div className="cap-result__inner">
        {/* ------------------------------------------------------- header */}
        <Rise className="cap-result__head">
          <Eyebrow>{t('result.eyebrow')}</Eyebrow>
          <h1 className="cap-result__title">
            {record.roomName || t(`capture.room.types.${record.roomType}`)}
          </h1>
          <div className="cap-result__meta">
            <span>{t(`styles.${record.style}`, { defaultValue: record.style })}</span>
            <span>{t(`capture.room.types.${record.roomType}`)}</span>
            <span>{formatDate(record.createdAt)}</span>
            {(record.result.elapsedMs ?? 0) >= 1000 ? (
              <span>{t('result.meta.elapsed', { s: Math.round(record.result.elapsedMs / 1000) })}</span>
            ) : null}
            {record.result.demoMode ? <span>{t('result.meta.demo')}</span> : null}
            {hasShots ? (
              <span>{t('result.meta.shots', { count: record.capture?.shots?.length || 0 })}</span>
            ) : hasScene ? (
              <span>{t('capture.ux.fromBuilder')}</span>
            ) : null}
          </div>
        </Rise>

        {/* -------------------------------------------------------- stage */}
        <div className="cap-result__lead">
          <Rise className="cap-result__stage">
            {hasShots ? (
              <>
                <AngleStage
                  render={active}
                  before={record.before?.[active.angleId]}
                  labels={{ before: t('result.stage.before'), after: t('result.stage.after') }}
                />

                <AngleThumbs
                  renders={renders}
                  activeId={active.angleId}
                  onSelect={(id) => setActiveAngle(id)}
                />
              </>
            ) : (
              <RenderGallery
                renders={renders}
                activeId={active.angleId}
                onSelect={(id) => setActiveAngle(id)}
                fallbackLabel={t('result.meta.demo')}
              />
            )}

            {fallbackCount > 0 && <p className="cap-res__note">{t('capture.ux.fallbackNote')}</p>}
            {warnings.length > 0 && (
              <details className="cap-res__note">
                <summary style={{ cursor: 'pointer' }}>{t('capture.ux.warningsTitle')}</summary>
                <ul style={{ margin: 'var(--s2) 0 0', paddingLeft: 'var(--s5)' }}>
                  {warnings.map((w, i) => (
                    <li key={i}>
                      {w.stage ? `${w.stage}: ` : ''}
                      {w.error}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {variants.length > 1 && (
              <div className="cap-result__chips">
                <span className="cap-result__linkKey">{t('result.variants.label')}</span>
                {variants.map((variant, i) => (
                  <button
                    key={variant.id}
                    type="button"
                    className="cap-result__chip"
                    aria-pressed={variant.id === record.id}
                    onClick={() => {
                      if (variant.id === record.id) return
                      // The URL owns the id; setting state alone would be undone
                      // by the params effect above.
                      navigate(`/app/result/${variant.id}`, { replace: true })
                      setRecordId(variant.id)
                      setActiveAngle('')
                    }}
                  >
                    {t('result.variants.item', { n: String(i + 1).padStart(2, '0') })}
                  </button>
                ))}
                <button
                  type="button"
                  className="cap-result__chip"
                  onClick={() => navigate('/app/capture')}
                >
                  {t('result.variants.another')}
                </button>
              </div>
            )}

            <FailuresNotice record={record} />
          </Rise>

          {/* ----------------------------------------------------- actions */}
          <Rise delay={0.06} className="cap-result__aside">
            <Bezel>
              <div className="cap-result__actions">
                {hasScene && (
                  <ArrowButton onClick={() => navigate(`/app/room/${record.id}`)}>
                    {t('capture.ux.openBuilder')}
                  </ArrowButton>
                )}
                {desktop ? (
                  <>
                    <ArrowButton quiet={hasScene} onClick={() => navigate(`/app/projects/${record.id}/live`)}>
                      {t('capture.ux.open360')}
                    </ArrowButton>
                    <ArrowButton quiet onClick={() => setQrOpen(true)}>
                      {t('result.actions.seeByYourselfDesktop')}
                    </ArrowButton>
                  </>
                ) : (
                  <ArrowButton quiet={hasScene} onClick={() => navigate(`/app/projects/${record.id}/live`)}>
                    {t('result.actions.seeByYourself')}
                  </ArrowButton>
                )}

                <div className="cap-result__secondary">
                  <button type="button" className="cap-result__link" onClick={() => void onSave()} disabled={saved}>
                    <span>{saved ? t('result.actions.saved') : t('result.actions.save')}</span>
                    <span className="cap-result__linkKey">01</span>
                  </button>
                  <button type="button" className="cap-result__link" onClick={() => void onDuplicate()}>
                    <span>{t('result.actions.duplicate')}</span>
                    <span className="cap-result__linkKey">02</span>
                  </button>
                  <button type="button" className="cap-result__link" onClick={() => void onShare()}>
                    <span aria-live="polite">
                      {shareState === 'copied'
                        ? t('result.shareLocalOnly', {
                            defaultValue: 'Havola nusxalandi — u faqat shu qurilmada ochiladi',
                          })
                        : shareState === 'shared'
                          ? t('result.actions.shareDone')
                          : t('result.actions.share')}
                    </span>
                    <span className="cap-result__linkKey">03</span>
                  </button>
                  <div className="cap-result__row">
                    <button type="button" className="cap-result__link" onClick={onDownload}>
                      <span>{t('result.actions.download', { count: 1 })}</span>
                      <span className="cap-result__linkKey">04</span>
                    </button>
                    {renders.length > 1 && (
                      <button
                        type="button"
                        className="cap-result__linkKey cap-result__linkKey--action"
                        onClick={onDownloadAll}
                        disabled={downloading}
                        aria-busy={downloading}
                      >
                        {t('result.downloadAll', {
                          count: renders.length,
                          defaultValue: 'Hammasi ({{count}})',
                        })}
                      </button>
                    )}
                  </div>
                  {/* The primary button above already opens the builder. */}
                  {!hasScene && (
                    <button
                      type="button"
                      className="cap-result__link"
                      onClick={() => navigate(`/app/room/${record.id}`)}
                    >
                      <span>{t('result.actions.editor')}</span>
                      <span className="cap-result__linkKey">05</span>
                    </button>
                  )}
                </div>

                <p style={{ fontSize: 'var(--step--2)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', lineHeight: 1.7 }}>
                  {t('result.actions.localNote')}
                </p>

                {shareState === 'failed' && (
                  <Notice tone="warn" title={t('result.actions.shareFailed')} />
                )}
                {storageFull && (
                  <Notice tone="warn" title={t('capture.errors.storageFull.title')}>
                    {t('result.storageFull', {
                      defaultValue: t('capture.errors.storageFull.body'),
                    })}
                  </Notice>
                )}
                {!storageFull && evicted > 0 && (
                  <Notice tone="warn" title={t('result.actions.saved')}>
                    {t('result.evicted', {
                      count: evicted,
                      defaultValue:
                        'Joy boʻshatish uchun eng eski {{count}} ta loyiha qurilmadan oʻchirildi.',
                    })}
                  </Notice>
                )}
              </div>
            </Bezel>
          </Rise>
        </div>

        {/* ------------------------------------------------------- panels */}
        <div className="cap-result__grid">
          <div className="cap-result__wide">
            <Panel
              eyebrow={t('result.design.eyebrow')}
              title={design.styleName || record.style}
              lead={design.summary}
            >
              {design.materials?.length ? <TagRow items={design.materials} /> : null}
            </Panel>
          </div>

          <div className="cap-result__wide">
            <Panel
              eyebrow={t('result.furniture.eyebrow')}
              title={t('result.furniture.title')}
              lead={t('result.furniture.lead')}
              delay={0.04}
            >
              <FurnitureList items={brief.furniture || []} currency={currency} />
              <BudgetPanel brief={brief} />
            </Panel>
          </div>

          <Panel eyebrow={t('result.palette.eyebrow')} title={t('result.palette.title')} delay={0.04}>
            <PaletteGrid palette={design.palette || []} />
          </Panel>

          <Panel eyebrow={t('result.light.eyebrow')} title={t('result.light.title')} delay={0.06}>
            <p className="cap-res__muted">{design.lighting || t('result.light.empty')}</p>
            {brief.room?.lightingNotes && (
              <p className="cap-res__muted">{brief.room.lightingNotes}</p>
            )}
          </Panel>

          <Panel
            eyebrow={t('result.electrics.eyebrow')}
            title={t('result.electrics.title')}
            lead={t('result.electrics.lead')}
            delay={0.06}
          >
            <FurnitureList
              items={(brief.furniture || []).filter((item) => item.category === 'lighting')}
              currency={currency}
            />
          </Panel>

          <Panel eyebrow={t('result.room.eyebrow')} title={t('result.room.title')} delay={0.08}>
            <RoomDims brief={brief} />
            {brief.room?.existingFeatures?.length ? (
              <TagRow items={brief.room.existingFeatures} />
            ) : null}
          </Panel>
        </div>
      </div>

      <QrHandoff open={qrOpen} onClose={() => setQrOpen(false)} />
    </main>
  )
}

export default Result
