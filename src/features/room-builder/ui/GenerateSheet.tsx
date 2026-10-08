import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { loadProjects } from '@/lib/storage.js'
import { STYLES } from '@/lib/styles.js'
import { cacheRecord, newProjectId, persistRecord } from '@/features/capture/store'
import { ROOM_TYPES, type CaptureRecord, type RoomTypeId } from '@/features/capture/types'
import { useSession } from '@/store/session'

import { RenderSceneError, renderScene } from '../api'
import { localeOf, squareMetres, useMoneyFormat } from '../format'
import { buildScenePayload, logScenePayload } from '../payload'
import { useBuilder } from '../store'
import { Cta, IconButton, Pill } from './chrome'

/**
 * "Generate design" — sends the drawn room to `POST /api/render-scene`, saves
 * the answer as a project exactly like the capture flow does, and opens it on
 * the result page.
 *
 * Three faces: a short setup (style, room name and type, a note), a progress
 * stage that tells the truth about a request that can take a minute or two,
 * and a failure face with a retry. It is a real modal: focus moves in, Tab
 * stays inside, Escape closes it (or cancels a running request first).
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

const STAGES = ['plan', 'brief', 'render', 'save'] as const
type Stage = (typeof STAGES)[number]

type Phase =
  | { kind: 'setup' }
  | { kind: 'running'; stage: Stage; startedAt: number }
  | { kind: 'error'; error: RenderSceneError | Error }

const CSS = `
.rb-gen {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: end center;
  padding: var(--s3);
  background: color-mix(in srgb, var(--clay-900) 40%, transparent);
  backdrop-filter: blur(8px) saturate(1.05);
  animation: rb-gen-in var(--d-base) var(--ease) both;
}
@media (min-width: 768px) {
  .rb-gen { place-items: center; padding: var(--s8); }
}
@keyframes rb-gen-in { from { opacity: 0; } to { opacity: 1; } }
.rb-gen__shell {
  width: min(620px, 100%);
  max-height: min(92dvh, 820px);
  overflow: auto;
  overscroll-behavior: contain;
  background: var(--bezel-shell);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-3xl);
  padding: var(--bezel-pad);
  box-shadow: var(--shadow-float);
  animation: rb-gen-rise var(--d-slow) var(--ease) both;
}
@keyframes rb-gen-rise {
  from { opacity: 0; transform: translateY(18px) scale(0.985); }
  to { opacity: 1; transform: none; }
}
.rb-gen__core {
  display: grid;
  gap: var(--s5);
  padding: var(--s6) var(--s5) var(--s5);
  border-radius: var(--radius-inner-3xl);
  background: var(--bg-raised);
  box-shadow: var(--inset-hi), var(--inset-lo);
}
@media (min-width: 768px) { .rb-gen__core { padding: var(--s8) var(--s7, 28px) var(--s6); } }
.rb-gen__head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s4); }
.rb-gen__title {
  margin: 0;
  max-width: 22ch;
  font-family: var(--font-display);
  font-size: var(--step-2);
  line-height: var(--lh-display);
  letter-spacing: var(--tracking-display);
  color: var(--text-strong);
}
.rb-gen__figures {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: var(--hairline);
  border: 1px solid var(--hairline);
}
.rb-gen__figure { display: grid; gap: 4px; margin: 0; padding: var(--s3) var(--s4); background: var(--bg-sunken); }
.rb-gen__figure dt {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.rb-gen__figure dd {
  margin: 0;
  font-size: var(--step-0);
  font-variant-numeric: tabular-nums;
  color: var(--text-strong);
  overflow-wrap: anywhere;
}
.rb-gen__figure--warn dd { color: var(--warn-ink); }
.rb-gen__field { display: grid; gap: var(--s2); }
.rb-gen__label {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.rb-gen__styles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--s2);
}
@media (min-width: 560px) { .rb-gen__styles { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.rb-gen__style {
  display: grid;
  gap: var(--s2);
  padding: var(--s2);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-xl);
  background: var(--bg-sunken);
  color: var(--text);
  font-family: var(--font-ui);
  font-size: var(--step--1);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--d-fast) var(--ease), transform var(--d-fast) var(--ease),
    box-shadow var(--d-fast) var(--ease);
}
.rb-gen__style:active { transform: scale(0.98); }
.rb-gen__style[aria-pressed='true'] {
  border-color: var(--accent);
  color: var(--text-strong);
  box-shadow: 0 0 0 1px var(--accent);
}
.rb-gen__swatch { display: flex; height: 28px; border-radius: var(--radius-lg, 10px); overflow: hidden; }
.rb-gen__swatch span { flex: 1; }
.rb-gen__input, .rb-gen__textarea {
  width: 100%;
  min-height: var(--tap);
  padding: 0 var(--s4);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-xl);
  background: var(--bg-sunken);
  color: var(--text-strong);
  font: inherit;
  font-size: 16px;
}
.rb-gen__textarea { min-height: 76px; padding: var(--s3) var(--s4); resize: vertical; }
.rb-gen__input:focus-visible, .rb-gen__textarea:focus-visible, .rb-gen__style:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
.rb-gen__chips { display: flex; flex-wrap: wrap; gap: var(--s2); }
.rb-gen__chip {
  min-height: 38px;
  padding-inline: var(--s4);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  color: var(--text);
  font-family: var(--font-ui);
  font-size: var(--step--1);
  cursor: pointer;
}
.rb-gen__chip[aria-pressed='true'] { background: var(--text-strong); color: var(--bg-raised); border-color: var(--text-strong); }
.rb-gen__note {
  display: flex;
  gap: var(--s3);
  padding: var(--s3) var(--s4);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--warn) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--warn) 50%, transparent);
  color: var(--text);
  font-size: var(--step--1);
  line-height: 1.45;
}
.rb-gen__foot { display: flex; flex-wrap: wrap; gap: var(--s3); align-items: center; justify-content: space-between; }
.rb-gen__credits { font-family: var(--font-mono); font-size: var(--step--2); color: var(--text-muted); letter-spacing: 0.04em; }

/* ---- progress ---------------------------------------------------------- */
.rb-gen__orb {
  position: relative;
  width: 88px;
  height: 88px;
  margin: var(--s2) auto 0;
  border-radius: 50%;
  background: conic-gradient(from 0deg, var(--accent), color-mix(in srgb, var(--accent) 10%, transparent) 70%, var(--accent));
  animation: rb-gen-spin 1.6s linear infinite;
  -webkit-mask: radial-gradient(circle, transparent 36px, #000 37px);
          mask: radial-gradient(circle, transparent 36px, #000 37px);
}
@keyframes rb-gen-spin { to { transform: rotate(360deg); } }
.rb-gen__elapsed {
  text-align: center;
  font-family: var(--font-mono);
  font-size: var(--step--1);
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}
.rb-gen__bar { height: 4px; border-radius: 999px; background: var(--bezel-shell); overflow: hidden; }
.rb-gen__bar span {
  display: block;
  height: 100%;
  width: 100%;
  background: var(--accent);
  transform-origin: left center;
  transition: transform 900ms var(--ease);
}
.rb-gen__steps { display: grid; gap: var(--s2); margin: 0; padding: 0; list-style: none; }
.rb-gen__step {
  display: flex;
  align-items: center;
  gap: var(--s3);
  font-size: var(--step--1);
  color: var(--text-muted);
  transition: color var(--d-base) var(--ease);
}
.rb-gen__step[data-state='active'] { color: var(--text-strong); }
.rb-gen__step[data-state='done'] { color: var(--text); }
.rb-gen__dot {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  border-radius: 50%;
  border: 1px solid var(--bezel-ring);
  background: var(--bg-sunken);
}
.rb-gen__step[data-state='active'] .rb-gen__dot { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }
.rb-gen__step[data-state='active'] .rb-gen__dot::after {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: rb-gen-pulse 1.2s var(--ease) infinite;
}
.rb-gen__step[data-state='done'] .rb-gen__dot { background: var(--ok, var(--accent)); border-color: transparent; color: var(--paper); }
@keyframes rb-gen-pulse { 50% { opacity: 0.3; transform: scale(0.7); } }
.rb-gen__error {
  padding: var(--s4);
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--err) 50%, transparent);
  background: color-mix(in srgb, var(--err) 7%, transparent);
  color: var(--text);
  font-size: var(--step--1);
  line-height: 1.5;
}
.rb-gen__error code { font-family: var(--font-mono); font-size: var(--step--2); color: var(--text-muted); word-break: break-word; }
@media (prefers-reduced-motion: reduce) {
  .rb-gen, .rb-gen__shell, .rb-gen__orb, .rb-gen__step .rb-gen__dot::after { animation: none; }
}
`

export function GenerateStyles() {
  return (
    <style href="fs-builder-generate" precedence="medium">
      {CSS}
    </style>
  )
}

/** The scene is copied to the new project's builder key, so "Open in builder"
 *  on the result page brings this exact layout back. */
function copySceneTo(projectId: string) {
  try {
    const { scene } = useBuilder.getState()
    window.localStorage.setItem(
      `framespace.room.${projectId}`,
      JSON.stringify({ state: { scene }, version: 1 })
    )
  } catch {
    /* quota: the project still opens; only the editable layout is lost */
  }
}

function errorKey(error: unknown): string {
  if (error instanceof RenderSceneError) return error.kind
  return 'server'
}

export function GenerateSheet() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const open = useBuilder((s) => s.generateOpen)
  const close = useBuilder((s) => s.openGenerate)
  const scene = useBuilder((s) => s.scene)
  const roomId = useBuilder((s) => s.roomId)
  const fmt = useMoneyFormat()
  const left = useSession((s) => s.generationsLeft())
  const signedIn = useSession((s) => Boolean(s.user))

  const [phase, setPhase] = useState<Phase>({ kind: 'setup' })
  const [style, setStyle] = useState<string>('')
  const [roomName, setRoomName] = useState('')
  const [roomType, setRoomType] = useState<RoomTypeId>('living')
  const [notes, setNotes] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const shellRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // A room opened from a saved project starts in that project's style.
  useEffect(() => {
    if (!open) return
    setPhase({ kind: 'setup' })
    if (style) return
    const projects = loadProjects() as Array<{ id?: string; style?: string }>
    const fromProject = roomId ? projects.find((p) => p.id === roomId)?.style : undefined
    setStyle(STYLES.some((s) => s.name === fromProject) ? (fromProject as string) : 'Japandi')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Abandon a running request if the sheet unmounts (route change).
  useEffect(() => () => abortRef.current?.abort(), [])

  // Elapsed timer while the request runs.
  useEffect(() => {
    if (phase.kind !== 'running') return
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [phase.kind])

  const running = phase.kind === 'running'

  function dismiss() {
    if (running) {
      abortRef.current?.abort()
      return
    }
    close(false)
  }

  const dismissRef = useRef(dismiss)
  dismissRef.current = dismiss

  // Focus in on open, a Tab trap while open, focus back out on close.
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const shell = shellRef.current
    shell?.querySelector<HTMLElement>('[data-autofocus]')?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        dismissRef.current()
        return
      }
      if (event.key !== 'Tab' || !shell) return
      const nodes = Array.from(shell.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null || node === document.activeElement
      )
      if (!nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !shell.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !shell.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    // Lock the page behind the sheet.
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [open])

  const total = useMemo(() => {
    if (!open) return 0
    return buildScenePayload(scene, 'en', style || 'Japandi').budget.estimatedTotal
  }, [open, scene, style])

  if (!open) return null

  const payloadPreview = buildScenePayload(scene, localeOf(fmt.lang), style || 'Japandi')
  const overBudget = !payloadPreview.budget.withinBudget
  const noCredits = left <= 0

  async function generate() {
    if (running) return
    if (useSession.getState().generationsLeft() <= 0) {
      setPhase({ kind: 'error', error: new RenderSceneError('quota', 'No generations left.') })
      return
    }

    const describedNotes = [
      roomName.trim() ? `Room: ${roomName.trim()}` : '',
      `Room type: ${roomType}`,
      notes.trim(),
      payloadPreview.notes,
    ]
      .filter(Boolean)
      .join('\n')
    const payload = logScenePayload({ ...payloadPreview, notes: describedNotes })

    const controller = new AbortController()
    abortRef.current = controller
    const startedAt = Date.now()
    setNow(startedAt)
    setPhase({ kind: 'running', stage: 'plan', startedAt })
    // The request is one round trip; the stages narrate it honestly by time.
    const stageTimers = [
      window.setTimeout(() => setPhase((p) => (p.kind === 'running' ? { ...p, stage: 'brief' } : p)), 1400),
      window.setTimeout(() => setPhase((p) => (p.kind === 'running' ? { ...p, stage: 'render' } : p)), 6000),
    ]

    try {
      const result = await renderScene(payload, { signal: controller.signal })
      stageTimers.forEach((id) => window.clearTimeout(id))
      setPhase({ kind: 'running', stage: 'save', startedAt })

      if (!result.demoMode) useSession.getState().consumeGeneration()

      const record: CaptureRecord = {
        id: newProjectId(),
        createdAt: new Date().toISOString(),
        roomName: roomName.trim() || t(`capture.room.types.${roomType}`),
        roomType,
        style: style || 'Japandi',
        notes: notes.trim(),
        budget: { limit: scene.budget, currency: 'UZS' },
        capture: { anchorHeading: null, source: 'none', shots: [] },
        before: {},
        result,
      }
      cacheRecord(record)
      copySceneTo(record.id)
      let storageFull = false
      let evicted = 0
      try {
        evicted = (await persistRecord(record)).evicted
      } catch {
        storageFull = true
      }
      abortRef.current = null
      close(false)
      setPhase({ kind: 'setup' })
      navigate(`/app/result/${record.id}`, {
        state: { recordId: record.id, storageFull, evicted, from: 'builder' },
      })
    } catch (error) {
      stageTimers.forEach((id) => window.clearTimeout(id))
      abortRef.current = null
      if (error instanceof RenderSceneError && error.kind === 'aborted') {
        setPhase({ kind: 'setup' })
        return
      }
      setPhase({ kind: 'error', error: error instanceof Error ? error : new Error(String(error)) })
    }
  }

  const elapsed = running ? Math.max(0, Math.round((now - phase.startedAt) / 1000)) : 0
  // Asymptotic: it keeps moving but never claims to be done before it is.
  const progress = running
    ? phase.stage === 'save'
      ? 1
      : Math.min(0.94, 1 - Math.exp(-elapsed / 28))
    : 0

  return (
    <div
      className="rb-gen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rb-gen-title"
      data-lenis-prevent=""
      onClick={(event) => {
        if (event.target === event.currentTarget && !running) close(false)
      }}
    >
      <div className="rb-gen__shell" ref={shellRef}>
        <div className="rb-gen__core">
          <header className="rb-gen__head">
            <div style={{ display: 'grid', gap: 'var(--s3)' }}>
              <Pill tone={phase.kind === 'error' ? 'warn' : 'accent'}>
                {t('builder.generate.eyebrow')}
              </Pill>
              <h2 className="rb-gen__title" id="rb-gen-title">
                {phase.kind === 'running'
                  ? t('builder.generate.runningTitle')
                  : phase.kind === 'error'
                    ? t('builder.generate.errorTitle')
                    : t('builder.generate.title')}
              </h2>
            </div>
            <IconButton
              label={running ? t('builder.generate.cancel') : t('builder.generate.close')}
              onClick={dismiss}
              data-autofocus=""
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </IconButton>
          </header>

          <dl className="rb-gen__figures">
            <div className="rb-gen__figure">
              <dt>{t('builder.placed.title')}</dt>
              <dd>{payloadPreview.items.length}</dd>
            </div>
            <div className="rb-gen__figure">
              <dt>{t('builder.generate.area')}</dt>
              <dd>{squareMetres(payloadPreview.room.floorAreaM2)} m²</dd>
            </div>
            <div className={overBudget ? 'rb-gen__figure rb-gen__figure--warn' : 'rb-gen__figure'}>
              <dt>{t('builder.budget.title')}</dt>
              <dd>
                {fmt.short(total)} / {fmt.short(scene.budget)}
              </dd>
            </div>
          </dl>

          {phase.kind === 'setup' && (
            <>
              <div className="rb-gen__field" role="group" aria-labelledby="rb-gen-style">
                <span className="rb-gen__label" id="rb-gen-style">
                  {t('builder.generate.style')}
                </span>
                <div className="rb-gen__styles">
                  {STYLES.map((option) => (
                    <button
                      key={option.name}
                      type="button"
                      className="rb-gen__style"
                      aria-pressed={style === option.name}
                      onClick={() => setStyle(option.name)}
                    >
                      <span className="rb-gen__swatch" aria-hidden="true">
                        {option.swatch.map((hex: string) => (
                          <span key={hex} style={{ background: hex }} />
                        ))}
                      </span>
                      <span>{t(`styles.${option.name}`, { defaultValue: option.name })}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rb-gen__field" role="group" aria-labelledby="rb-gen-type">
                <span className="rb-gen__label" id="rb-gen-type">
                  {t('builder.generate.roomType')}
                </span>
                <div className="rb-gen__chips">
                  {ROOM_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className="rb-gen__chip"
                      aria-pressed={roomType === type}
                      onClick={() => setRoomType(type)}
                    >
                      {t(`capture.room.types.${type}`)}
                    </button>
                  ))}
                </div>
              </div>

              <label className="rb-gen__field">
                <span className="rb-gen__label">{t('builder.generate.name')}</span>
                <input
                  className="rb-gen__input"
                  value={roomName}
                  maxLength={60}
                  placeholder={t(`capture.room.types.${roomType}`)}
                  onChange={(event) => setRoomName(event.target.value)}
                />
              </label>

              <label className="rb-gen__field">
                <span className="rb-gen__label">{t('builder.generate.notes')}</span>
                <textarea
                  className="rb-gen__textarea"
                  value={notes}
                  maxLength={600}
                  placeholder={t('builder.generate.notesPlaceholder')}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>

              {payloadPreview.items.length === 0 && (
                <p className="rb-gen__note">{t('builder.generate.emptyRoom')}</p>
              )}
              {overBudget && <p className="rb-gen__note">{t('builder.generate.overBudget')}</p>}

              <div className="rb-gen__foot">
                <span className="rb-gen__credits">
                  {t('builder.generate.credits', { count: left })}
                </span>
                {noCredits ? (
                  <Cta onClick={() => navigate(signedIn ? '/pricing' : '/signup')}>
                    {signedIn ? t('builder.generate.upgrade') : t('builder.generate.signup')}
                  </Cta>
                ) : (
                  <Cta onClick={generate}>{t('builder.generate.submit')}</Cta>
                )}
              </div>
            </>
          )}

          {phase.kind === 'running' && (
            <div style={{ display: 'grid', gap: 'var(--s5)' }} aria-live="polite">
              <div className="rb-gen__orb" aria-hidden="true" />
              <p className="rb-gen__elapsed">
                {t('builder.generate.elapsed', { seconds: elapsed })}
              </p>
              <div
                className="rb-gen__bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                aria-label={t('builder.generate.runningTitle')}
              >
                <span style={{ transform: `scaleX(${progress})` }} />
              </div>
              <ol className="rb-gen__steps">
                {STAGES.map((stage, index) => {
                  const at = STAGES.indexOf(phase.stage)
                  const state = index < at ? 'done' : index === at ? 'active' : 'todo'
                  return (
                    <li key={stage} className="rb-gen__step" data-state={state}>
                      <span className="rb-gen__dot" aria-hidden="true">
                        {state === 'done' && (
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6.2 5 8.5l4.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      {t(`builder.generate.stages.${stage}`)}
                    </li>
                  )
                })}
              </ol>
              <p className="rb-hint">{t('builder.generate.wait')}</p>
              <div className="rb-gen__foot">
                <Cta quiet onClick={dismiss}>
                  {t('builder.generate.cancel')}
                </Cta>
              </div>
            </div>
          )}

          {phase.kind === 'error' && (
            <>
              <div className="rb-gen__error" role="alert">
                <p style={{ margin: 0 }}>{t(`builder.generate.errors.${errorKey(phase.error)}`)}</p>
                {phase.error.message && errorKey(phase.error) === 'server' && (
                  <code>{phase.error.message}</code>
                )}
              </div>
              <div className="rb-gen__foot">
                <Cta quiet onClick={() => setPhase({ kind: 'setup' })}>
                  {t('builder.generate.back')}
                </Cta>
                {errorKey(phase.error) === 'quota' ? (
                  <Cta onClick={() => navigate(signedIn ? '/pricing' : '/signup')}>
                    {signedIn ? t('builder.generate.upgrade') : t('builder.generate.signup')}
                  </Cta>
                ) : (
                  <Cta onClick={generate}>{t('builder.generate.retry')}</Cta>
                )}
              </div>
            </>
          )}

          <p className="rb-hint">{t('builder.generate.savedNote')}</p>
        </div>
      </div>
    </div>
  )
}
