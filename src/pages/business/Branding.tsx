import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Seo } from '@/lib/seo'
import { useMoney } from '@/features/catalog/money'
import { PRODUCTS } from '@/features/catalog/data'
import {
  BusinessShell,
  Icon,
  Panel,
  Pill,
  SaveState,
  Thumb3D,
} from '@/features/business/chrome'
import { useSavedBranding } from '@/features/business/local'
import {
  BRANDING,
  BRAND_PRESETS,
  BUSINESS,
  VENDOR_PRODUCTS,
  type Branding as BrandingRecord,
} from '@/features/business/data'
import { Reveal } from '@/ui/Reveal'

/**
 * §10 — branding.
 *
 * The vendor's name, mark, line and colours, previewed live as a miniature of
 * `/store/:slug`. Hex values are *data*, not design tokens: they come from the
 * vendor and are applied to the store page as CSS custom properties.
 *
 * Saving writes the record to this browser (there is no PATCH endpoint) and
 * the public store page reads it back, so "Save → open store" really shows the
 * change. The contrast readout computes the WCAG ratio for the three pairs the
 * store page uses, because a pale accent would ship unreadable text.
 */

const CSS = `
.br-split { display: grid; gap: var(--s5); grid-template-columns: minmax(0, 1fr); align-items: start; }
@media (min-width: 1040px) {
  .br-split { grid-template-columns: minmax(0, 1fr) minmax(0, 1.08fr); }
  .br-sticky { position: sticky; top: calc(var(--hdr-offset) + var(--s4)); }
}
.br-form { display: grid; gap: var(--s6); }
.br-group { display: grid; gap: var(--s4); padding-top: var(--s5); border-top: 1px solid var(--hairline); }
.br-group:first-child { padding-top: 0; border-top: 0; }
.br-group__title { font-family: var(--font-mono); font-size: 10px; letter-spacing: var(--tracking-mono); text-transform: uppercase; color: var(--text-muted); }
.br-two { display: grid; gap: var(--s4); grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
@media (max-width: 480px) { .br-two { grid-template-columns: minmax(0, 1fr); } }

.br-presets { display: grid; gap: var(--s2); grid-template-columns: repeat(4, minmax(0, 1fr)); }
@media (max-width: 520px) { .br-presets { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.br-preset {
  display: grid; gap: var(--s2); justify-items: start;
  padding: var(--s2) var(--s2) var(--s3);
  border: 0; border-radius: var(--radius-lg);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
  color: var(--text); font: inherit; font-size: 12.5px; font-weight: 500;
  cursor: pointer;
  transition: box-shadow var(--d-fast) var(--ease), transform var(--d-fast) var(--ease);
}
.br-preset[aria-pressed='true'] { box-shadow: inset 0 0 0 1.5px var(--accent); color: var(--text-strong); }
.br-preset:active { transform: scale(0.98); }
.br-preset__chips { display: flex; width: 100%; height: 28px; border-radius: 8px; overflow: hidden; box-shadow: inset 0 0 0 1px var(--hairline); }
.br-preset__chips span { flex: 1; }
.br-preset__chips span:first-child { flex: 2; }

.br-swatches { display: grid; gap: var(--s3); grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (max-width: 420px) { .br-swatches { grid-template-columns: minmax(0, 1fr); } }
.br-swatch { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--s3); align-items: center; }
.br-swatch__pick { position: relative; width: 44px; height: 44px; border-radius: 12px; box-shadow: inset 0 0 0 1px var(--hairline); overflow: hidden; }
.br-swatch__pick input { position: absolute; inset: -8px; width: calc(100% + 16px); height: calc(100% + 16px); border: 0; padding: 0; cursor: pointer; opacity: 0; }
.br-swatch__pick:focus-within { outline: 2px solid var(--focus); outline-offset: 2px; }
.br-swatch .biz-input { font-family: var(--font-mono); font-size: 14px; text-transform: uppercase; width: 100%; }

.br-ratio { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: var(--s3); align-items: center; padding-block: var(--s2); }
.br-ratio__sample { display: grid; place-items: center; width: 40px; height: 30px; border-radius: 8px; font-weight: 700; font-size: 13px; box-shadow: inset 0 0 0 1px var(--hairline); }
.br-ratio b { font-family: var(--font-mono); font-weight: 500; font-variant-numeric: tabular-nums; }

.br-actions { display: flex; gap: var(--s3); align-items: center; flex-wrap: wrap; padding-top: var(--s5); border-top: 1px solid var(--hairline); }

/* ---- preview: the store page in miniature ------------------------------ */
.br-browser { border-radius: var(--radius-2xl); overflow: hidden; box-shadow: inset 0 0 0 1px var(--hairline); background: var(--bg-sunken); }
.br-browser__bar { display: flex; align-items: center; gap: var(--s3); padding: var(--s2) var(--s3); border-bottom: 1px solid var(--hairline); }
.br-browser__dots { display: flex; gap: 5px; }
.br-browser__dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--ink-500); opacity: 0.6; }
.br-browser__url { flex: 1; min-width: 0; padding: 4px 10px; border-radius: var(--radius-full); background: var(--bg-raised); font-family: var(--font-mono); font-size: 10.5px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.br-stage { padding: var(--s6) var(--s5) var(--s5); transition: background-color var(--d-base) var(--ease-fluid), color var(--d-base) var(--ease-fluid); }
.br-head { display: flex; align-items: center; gap: var(--s4); }
.br-mono { display: grid; place-items: center; flex: 0 0 auto; width: 52px; height: 52px; font-family: var(--font-mono); font-weight: 600; font-size: 14px; letter-spacing: 0.08em; transition: all var(--d-base) var(--ease-fluid); }
.br-title { font-size: clamp(1.4rem, 1.1rem + 1.2vw, 2rem); line-height: 1.05; letter-spacing: -0.02em; overflow-wrap: anywhere; }
.br-tagline { font-size: 13.5px; opacity: 0.72; margin: 4px 0 0; }
.br-chips { display: flex; gap: 6px; margin: var(--s5) 0 var(--s4); flex-wrap: wrap; }
.br-chip { padding: 5px 12px; border-radius: 999px; font-size: 11.5px; font-weight: 500; }
.br-cards { display: grid; gap: var(--s3); grid-template-columns: repeat(2, minmax(0, 1fr)); }
.br-card { padding: 5px 5px var(--s3); transition: all var(--d-base) var(--ease-fluid); }
.br-plate { width: 100%; aspect-ratio: 1 / 1; }
.br-card__name { font-size: 13px; font-weight: 600; margin: var(--s2) 6px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: var(--font-ui); }
.br-card__price { font-family: var(--font-mono); font-size: 11.5px; margin: 2px 6px 0; font-variant-numeric: tabular-nums; }
.br-cta { display: inline-flex; align-items: center; gap: 8px; margin-top: var(--s5); padding: 10px 18px; font-family: var(--font-ui); font-weight: 600; font-size: 13px; }

@media (hover: hover) and (pointer: fine) {
  .br-preset:hover { box-shadow: inset 0 0 0 1px var(--border-strong); }
}
@media (prefers-reduced-motion: reduce) {
  .br-stage, .br-mono, .br-card, .br-preset { transition: none; }
}
`

/* ------------------------------------------------------------- contrast */

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return 0
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio, computed rather than guessed. */
function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

const HEX = /^#[0-9a-f]{6}$/i
const COLOR_KEYS = ['paper', 'ink', 'accent', 'accentInk'] as const
type ColorKey = (typeof COLOR_KEYS)[number]

const same = (a: BrandingRecord, b: BrandingRecord) =>
  a.displayName === b.displayName &&
  a.tagline === b.tagline &&
  a.monogram === b.monogram &&
  a.typeface === b.typeface &&
  a.corner === b.corner &&
  COLOR_KEYS.every((key) => a.colors[key].toLowerCase() === b.colors[key].toLowerCase())

/* ------------------------------------------------------------------ page */

export function Branding() {
  const { t } = useTranslation()
  const money = useMoney()
  const uid = useId()
  const [saved, save] = useSavedBranding()
  const [draft, setDraft] = useState<BrandingRecord>(saved)
  const [hex, setHex] = useState<Record<ColorKey, string>>(saved.colors)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [attempted, setAttempted] = useState(false)
  const [spin, setSpin] = useState(false)
  const timer = useRef(0)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const previews = useMemo(() => {
    const published = new Set(VENDOR_PRODUCTS.filter((r) => r.state === 'published').map((r) => r.productId))
    return PRODUCTS.filter((p) => published.has(p.id))
      .sort((a, b) => b.placements - a.placements)
      .slice(0, 2)
  }, [])

  const dirty = !same(draft, saved)
  const isDefault = same(saved, BRANDING)

  const errors = {
    displayName: !draft.displayName.trim() ? t('business.branding.errors.name') : null,
    monogram: !/^[\p{L}\p{N}]{1,3}$/u.test(draft.monogram) ? t('business.branding.errors.monogram') : null,
    colors: COLOR_KEYS.some((key) => !HEX.test(hex[key])) ? t('business.branding.errors.hex') : null,
  }
  const invalid = Object.values(errors).some(Boolean)

  const update = (patch: Partial<BrandingRecord>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
    if (status === 'saved' || status === 'error') setStatus('idle')
  }

  const setColor = (key: ColorKey, value: string) => {
    setHex((prev) => ({ ...prev, [key]: value }))
    if (HEX.test(value)) {
      setDraft((prev) => ({ ...prev, colors: { ...prev.colors, [key]: value.toLowerCase() } }))
      if (status === 'saved') setStatus('idle')
    }
  }

  const applyColors = (colors: BrandingRecord['colors']) => {
    setHex(colors)
    update({ colors })
  }

  const ratios = [
    { id: 'inkOnPaper', fg: draft.colors.ink, bg: draft.colors.paper, min: 4.5 },
    { id: 'accentInkOnPaper', fg: draft.colors.accentInk, bg: draft.colors.paper, min: 4.5 },
    { id: 'paperOnAccent', fg: draft.colors.paper, bg: draft.colors.accent, min: 3 },
  ].map((r) => ({ ...r, value: contrastRatio(r.fg, r.bg) }))
  const failing = ratios.filter((r) => r.value < r.min).length

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    setAttempted(true)
    if (invalid || !dirty) return
    setStatus('saving')
    timer.current = window.setTimeout(() => {
      const next = { ...draft, displayName: draft.displayName.trim(), tagline: draft.tagline.trim() }
      setStatus(save(next) ? 'saved' : 'error')
      setDraft(next)
      setAttempted(false)
    }, 600)
  }

  // ⌘/Ctrl+S saves, as in every editor.
  const submitRef = useRef(submit)
  submitRef.current = submit
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        submitRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const c = draft.colors
  const soft = draft.corner === 'soft'
  const face = draft.typeface === 'serif' ? 'var(--font-display)' : 'var(--font-ui)'

  const saveLabel =
    status === 'saving'
      ? t('business.branding.saving')
      : status === 'saved'
        ? t('business.branding.savedNow')
        : status === 'error'
          ? t('business.branding.saveError')
          : dirty
            ? t('business.branding.unsaved')
            : t('business.branding.saved')

  return (
    <>
      <style href="fs-biz-branding" precedence="medium">
        {CSS}
      </style>
      <Seo
        title={`${t('business.branding.title')} — ${t('business.meta.title')}`}
        description={t('business.branding.lead')}
        path="/business/branding"
      />

      <BusinessShell
        title={t('business.branding.title')}
        lead={t('business.branding.lead')}
        badges={
          <Pill tone={failing ? 'err' : 'ok'}>
            {failing ? t('business.branding.contrastFails', { n: failing }) : t('business.branding.contrastOk')}
          </Pill>
        }
        actions={
          <Link className="biz-btn" to={`/store/${BUSINESS.slug}`}>
            <Icon name="external" size={16} />
            {t('business.branding.openStore')}
          </Link>
        }
      >
        <Reveal className="br-split" blur={false}>
          <Panel title={t('business.branding.editor')} sub={t('business.branding.editorSub')}>
            <form className="br-form" noValidate onSubmit={submit}>
              <div className="br-group">
                <span className="br-group__title">{t('business.branding.identity')}</span>
                <div className="br-two">
                  <label className="biz-field" htmlFor={`${uid}-name`}>
                    <span className="biz-label">{t('business.branding.displayName')}</span>
                    <input
                      id={`${uid}-name`}
                      className="biz-input"
                      value={draft.displayName}
                      maxLength={40}
                      aria-invalid={attempted && errors.displayName ? true : undefined}
                      aria-describedby={attempted && errors.displayName ? `${uid}-name-err` : undefined}
                      onChange={(event) => update({ displayName: event.target.value })}
                    />
                    {attempted && errors.displayName && (
                      <span className="biz-error" id={`${uid}-name-err`}>
                        {errors.displayName}
                      </span>
                    )}
                  </label>
                  <label className="biz-field" htmlFor={`${uid}-mono`}>
                    <span className="biz-label">{t('business.branding.monogram')}</span>
                    <input
                      id={`${uid}-mono`}
                      className="biz-input"
                      value={draft.monogram}
                      maxLength={3}
                      autoCapitalize="characters"
                      style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}
                      aria-invalid={errors.monogram && (attempted || draft.monogram.length > 0) ? true : undefined}
                      aria-describedby={errors.monogram ? `${uid}-mono-err` : undefined}
                      onChange={(event) => update({ monogram: event.target.value.toUpperCase().replace(/\s/g, '') })}
                    />
                    {errors.monogram && (attempted || draft.monogram.length > 0) && (
                      <span className="biz-error" id={`${uid}-mono-err`}>
                        {errors.monogram}
                      </span>
                    )}
                  </label>
                </div>
                <label className="biz-field" htmlFor={`${uid}-tag`}>
                  <span className="biz-label">{t('business.branding.tagline')}</span>
                  <input
                    id={`${uid}-tag`}
                    className="biz-input"
                    value={draft.tagline}
                    maxLength={64}
                    aria-describedby={`${uid}-tag-hint`}
                    onChange={(event) => update({ tagline: event.target.value })}
                  />
                  <span className="biz-hint" id={`${uid}-tag-hint`}>
                    {draft.tagline.length}/64
                  </span>
                </label>
              </div>

              <div className="br-group">
                <span className="br-group__title">{t('business.branding.presets')}</span>
                <div className="br-presets">
                  {BRAND_PRESETS.map((preset) => {
                    const active = COLOR_KEYS.every(
                      (key) => preset.colors[key].toLowerCase() === draft.colors[key].toLowerCase(),
                    )
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className="br-preset"
                        aria-pressed={active}
                        onClick={() => applyColors(preset.colors)}
                      >
                        <span className="br-preset__chips" aria-hidden="true">
                          <span style={{ background: preset.colors.paper }} />
                          <span style={{ background: preset.colors.accent }} />
                          <span style={{ background: preset.colors.ink }} />
                        </span>
                        {t(`business.branding.preset.${preset.id}`)}
                      </button>
                    )
                  })}
                </div>

                <div className="br-swatches">
                  {COLOR_KEYS.map((key) => {
                    const bad = !HEX.test(hex[key])
                    return (
                      <div className="biz-field" key={key}>
                        <label className="biz-hint" htmlFor={`${uid}-${key}`}>
                          {t(`business.branding.color.${key}`)}
                        </label>
                        <div className="br-swatch">
                          <span className="br-swatch__pick" style={{ background: draft.colors[key] }}>
                            <input
                              type="color"
                              value={draft.colors[key]}
                              aria-label={`${t(`business.branding.color.${key}`)} — ${t('business.branding.picker')}`}
                              onChange={(event) => setColor(key, event.target.value)}
                            />
                          </span>
                          <input
                            id={`${uid}-${key}`}
                            className="biz-input"
                            value={hex[key]}
                            maxLength={7}
                            spellCheck={false}
                            aria-invalid={bad ? true : undefined}
                            onChange={(event) => {
                              const raw = event.target.value.trim()
                              setColor(key, raw.startsWith('#') ? raw : `#${raw}`)
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
                {errors.colors && (
                  <span className="biz-error" role="alert">
                    <Icon name="alert" size={13} />
                    {errors.colors}
                  </span>
                )}
              </div>

              <div className="br-group">
                <span className="br-group__title">{t('business.branding.style')}</span>
                <div style={{ display: 'flex', gap: 'var(--s5)', flexWrap: 'wrap' }}>
                  <div className="biz-field">
                    <span className="biz-hint">{t('business.branding.typeface')}</span>
                    <div className="biz-seg" role="group" aria-label={t('business.branding.typeface')}>
                      {(['serif', 'sans'] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={draft.typeface === option}
                          onClick={() => update({ typeface: option })}
                          style={{ fontFamily: option === 'serif' ? 'var(--font-display)' : 'var(--font-ui)' }}
                        >
                          {t(`business.branding.face.${option}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="biz-field">
                    <span className="biz-hint">{t('business.branding.corner')}</span>
                    <div className="biz-seg" role="group" aria-label={t('business.branding.corner')}>
                      {(['soft', 'sharp'] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={draft.corner === option}
                          onClick={() => update({ corner: option })}
                        >
                          {t(`business.branding.cornerOption.${option}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="br-group">
                <span className="br-group__title">{t('business.branding.contrast')}</span>
                <div>
                  {ratios.map((ratio) => (
                    <div className="br-ratio" key={ratio.id}>
                      <span className="br-ratio__sample" style={{ background: ratio.bg, color: ratio.fg }} aria-hidden="true">
                        Aa
                      </span>
                      <span style={{ fontSize: 'var(--step--1)', color: 'var(--text-muted)' }}>
                        {t(`business.branding.ratio.${ratio.id}`)}
                      </span>
                      <span style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
                        <b>{ratio.value.toFixed(2)}:1</b>
                        <Pill tone={ratio.value >= ratio.min ? 'ok' : 'err'}>
                          {ratio.value >= ratio.min
                            ? t('business.branding.pass')
                            : t('business.branding.fail', { min: ratio.min })}
                        </Pill>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="br-actions">
                <button
                  type="submit"
                  className="biz-btn biz-btn--primary"
                  disabled={!dirty || status === 'saving'}
                  aria-keyshortcuts="Control+S Meta+S"
                >
                  <Icon name="check" size={15} />
                  {t('business.branding.save')}
                </button>
                <button
                  type="button"
                  className="biz-btn biz-btn--ghost"
                  disabled={!dirty}
                  onClick={() => {
                    setDraft(saved)
                    setHex(saved.colors)
                    setAttempted(false)
                    setStatus('idle')
                  }}
                >
                  {t('business.branding.revert')}
                </button>
                {!isDefault && !dirty && (
                  <button
                    type="button"
                    className="biz-btn biz-btn--ghost"
                    onClick={() => {
                      save(null)
                      setDraft(BRANDING)
                      setHex(BRANDING.colors)
                      setStatus('idle')
                    }}
                  >
                    {t('business.branding.resetDefault')}
                  </button>
                )}
                <SaveState state={status === 'idle' ? (dirty ? 'dirty' : 'idle') : status}>{saveLabel}</SaveState>
              </div>
            </form>
          </Panel>

          <div className="br-sticky">
            <Panel title={t('business.branding.preview')} sub={t('business.branding.previewSub')}>
              <div className="br-browser">
                <div className="br-browser__bar" aria-hidden="true">
                  <span className="br-browser__dots">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="br-browser__url">framespace.uz/store/{BUSINESS.slug}</span>
                </div>
                <div className="br-stage" style={{ background: c.paper, color: c.ink, fontFamily: face }}>
                  <div className="br-head">
                    <span
                      className="br-mono"
                      style={{ background: c.accent, color: c.paper, borderRadius: soft ? 16 : 3 }}
                      aria-hidden="true"
                    >
                      {draft.monogram || '—'}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span className="br-title" style={{ display: 'block' }}>
                        {draft.displayName || '—'}
                      </span>
                      <p className="br-tagline">{draft.tagline}</p>
                    </span>
                  </div>

                  <div className="br-chips" aria-hidden="true">
                    <span className="br-chip" style={{ background: c.accent, color: c.paper, borderRadius: soft ? 999 : 3 }}>
                      {t('catalog.filters.all')}
                    </span>
                    {(['seating', 'table', 'lighting'] as const).map((cat) => (
                      <span
                        key={cat}
                        className="br-chip"
                        style={{ boxShadow: `inset 0 0 0 1px ${c.ink}26`, color: `${c.ink}b3`, borderRadius: soft ? 999 : 3 }}
                      >
                        {t(`catalog.categories.${cat}`)}
                      </span>
                    ))}
                  </div>

                  <div className="br-cards" onMouseEnter={() => setSpin(true)} onMouseLeave={() => setSpin(false)}>
                    {previews.map((product, index) => (
                      <div
                        key={product.id}
                        className="br-card"
                        style={{
                          background: `${c.ink}0d`,
                          borderRadius: soft ? 18 : 4,
                          boxShadow: `inset 0 0 0 1px ${c.ink}14`,
                        }}
                      >
                        <Thumb3D
                          product={product}
                          accent={c.accent}
                          spin={spin}
                          offset={index * 0.8}
                          className="br-plate"
                          style={{ borderRadius: soft ? 14 : 2, background: c.paper, boxShadow: `inset 0 0 0 1px ${c.ink}12` }}
                          label={t(`catalog.products.${product.nameKey}.name`)}
                        />
                        <p className="br-card__name">{t(`catalog.products.${product.nameKey}.name`)}</p>
                        <p className="br-card__price" style={{ color: c.accentInk }}>
                          {money.compact(product.priceUzs)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <span
                    className="br-cta"
                    aria-hidden="true"
                    style={{ background: c.accent, color: c.paper, borderRadius: soft ? 999 : 3 }}
                  >
                    {t('business.store.contact')} →
                  </span>
                </div>
              </div>
            </Panel>
          </div>
        </Reveal>
      </BusinessShell>
    </>
  )
}

export default Branding
