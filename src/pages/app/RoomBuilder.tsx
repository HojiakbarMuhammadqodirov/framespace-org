import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useReducedMotion } from 'framer-motion'

import { SceneCanvas } from '@/three/Canvas'
import { BuilderScene } from '@/three/builder/BuilderScene'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { Seo } from '@/lib/seo'

import { useBuilder, useBuilderSaved } from '@/features/room-builder/store'
import { CATALOG } from '@/features/room-builder/catalog'
import { useBuilderShortcuts } from '@/features/room-builder/useShortcuts'
import type { FixtureKind, ViewMode } from '@/features/room-builder/types'
import { BudgetCounter, BudgetStyles } from '@/features/room-builder/ui/BudgetCounter'
import { CatalogPanel, CatalogStyles } from '@/features/room-builder/ui/CatalogPanel'
import { GenerateSheet, GenerateStyles } from '@/features/room-builder/ui/GenerateSheet'
import { InspectorPanel, InspectorStyles } from '@/features/room-builder/ui/InspectorPanel'
import { PlanFallback } from '@/features/room-builder/ui/PlanFallback'
import {
  FixturePanel,
  KeysPanel,
  LightPanel,
  PanelStyles,
  RoomPanel,
} from '@/features/room-builder/ui/panels'
import {
  ChromeStyles,
  Cta,
  IconButton,
  MOD_KEY,
  Pill,
  Segmented,
} from '@/features/room-builder/ui/chrome'

/**
 * Brief §7 — the 3D room builder.
 *
 * The viewport is a glass plate seated in an aluminium tray: outer shell,
 * hairline ring, inner core with its own surface and an inset highlight. Tool
 * palettes are built the same way, so the whole editor reads as one machined
 * object rather than a page of boxes.
 *
 * Wide screens get two rails either side of the viewport; between 1024 and
 * 1279px the right rail becomes a drawer over the viewport (it opens itself
 * when something is selected) so the room keeps a usable width. Below 1024px the
 * rails collapse into a bottom sheet with a tab strip, the viewport keeps the
 * full width, and nothing floats over it except the budget counter — which is
 * the one readout that has to be visible while you work.
 *
 * The 3D lives in the shared <SceneCanvas>: it already owns WebGL detection,
 * the designed no-WebGL fallback, the reduced-motion flag and frameloop pausing
 * when the canvas scrolls out of view. It renders on demand, so an idle editor
 * draws nothing, and it stops entirely while the generate sheet covers it.
 *
 * Phones get what a mouse user gets from hover and the rails: a floating
 * toolbar for the selected piece, a one-time gesture coach, and a scroll back
 * up to the room after adding a piece from the sheet.
 *
 * The scene is saved per room (`framespace.room.<id>`), so a reload, a call
 * or a dead battery never costs the layout.
 */

const CSS = `
.rb-page {
  min-height: 100dvh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--s6);
  padding-block: var(--s8) var(--s4);
}
.rb-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--s4) var(--s6);
}
.rb-head__text { display: grid; gap: var(--s3); max-width: 62ch; }
.rb-head__lead { margin: 0; }
@media (max-width: 767px) {
  .rb-head__lead { display: none; }
  .rb-page { gap: var(--s4); padding-block: var(--s6) 0; }
}
.rb-head__tools { display: flex; align-items: center; gap: var(--s2); flex-wrap: wrap; }
.rb-head__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--step-3);
  font-weight: 500;
  line-height: 1.05;
  letter-spacing: -0.015em;
  color: var(--text-strong);
}
.rb-stage { display: grid; gap: var(--s4); align-items: start; }
.rb-rail { display: grid; gap: var(--s4); }
.rb-head__tags { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2); }

/* ---- desktop: a full-bleed editor, viewport dominant -------------------- */
@media (min-width: 1024px) {
  .rb-page.fs-container {
    max-width: none;
    padding-inline: var(--s4);
  }
  .rb-page {
    height: 100dvh;
    min-height: 640px;
    gap: var(--s3);
    padding-block: var(--hdr-offset, 84px) var(--s4);
  }
  .rb-head { align-items: center; flex-wrap: nowrap; }
  .rb-head__text { display: flex; align-items: center; gap: var(--s3); max-width: none; min-width: 0; }
  .rb-head__title { font-size: var(--step-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rb-head__lead { display: none; }
  .rb-stage {
    position: relative;
    height: 100%;
    min-height: 0;
    grid-template-columns: 288px minmax(0, 1fr) 288px;
    gap: var(--s2);
    align-items: stretch;
  }
  .rb-stage--drawer { grid-template-columns: 272px minmax(0, 1fr); }
  .rb-rail {
    display: flex;
    flex-direction: column;
    gap: var(--s3);
    height: 100%;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    padding-right: 2px;
  }
  .rb-rail > * { flex: 0 0 auto; }
  .rb-rail--drawer {
    position: absolute;
    z-index: 8;
    top: 0;
    right: 0;
    bottom: 0;
    width: 296px;
    padding: var(--s2);
    border: 1px solid var(--bezel-ring);
    border-radius: var(--radius-3xl);
    background: color-mix(in srgb, var(--bezel-shell) 88%, transparent);
    backdrop-filter: blur(16px) saturate(1.1);
    box-shadow: var(--shadow-float);
    transform: translateX(calc(100% + var(--s4)));
    opacity: 0;
    visibility: hidden;
    transition: transform var(--d-base) var(--ease), opacity var(--d-base) var(--ease),
      visibility 0s linear var(--d-base);
  }
  .rb-rail--drawer[data-open='true'] {
    transform: none;
    opacity: 1;
    visibility: visible;
    transition: transform var(--d-base) var(--ease), opacity var(--d-base) var(--ease);
  }
  .rb-drawer__head { display: flex; justify-content: flex-end; }
  .rb-rail__tabs { position: sticky; top: 0; z-index: 2; }
  .rb-view { height: 100%; min-height: 0; display: flex; }
  .rb-view .rb-view__core { flex: 1; height: auto; min-height: 0; }
}
@media (min-width: 1600px) {
  .rb-stage { grid-template-columns: 320px minmax(0, 1fr) 312px; gap: var(--s3); }
}
@media (prefers-reduced-motion: reduce) {
  .rb-rail--drawer, .rb-rail--drawer[data-open='true'] { transition: none; }
}
.rb-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  min-height: 40px;
  padding: 0 var(--s2) 0 var(--s4);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-full);
  background: var(--bg-raised);
  color: var(--text-strong);
  font-family: var(--font-ui);
  font-size: var(--step--1);
  font-weight: 500;
  box-shadow: var(--inset-hi);
  cursor: pointer;
}
.rb-toggle[aria-expanded='true'] { background: var(--text-strong); color: var(--bg); border-color: var(--text-strong); }
.rb-toggle:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.rb-toggle__n {
  display: inline-grid;
  place-items: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border-radius: var(--radius-full);
  background: var(--bezel-shell);
  color: var(--text-strong);
  font-family: var(--font-mono);
  font-size: 10px;
}

/* ---- the viewport: glass plate in a tray ------------------------------- */
.rb-view {
  position: relative;
  scroll-margin-top: var(--hdr-offset, var(--s4));
  background: var(--bezel-shell);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-3xl);
  padding: var(--bezel-pad);
  box-shadow: var(--shadow-raised);
}
.rb-view__core {
  position: relative;
  overflow: hidden;
  height: clamp(300px, 55dvh, 620px);
  border-radius: var(--radius-inner-3xl);
  background: var(--bg-sunken);
  box-shadow: var(--inset-hi), var(--inset-lo);
}

.rb-view__canvas { position: absolute; inset: 0; }
.rb-view--drop .rb-view__core { box-shadow: var(--inset-hi), inset 0 0 0 2px var(--accent); }

/* ---- floating hardware strips ----------------------------------------- */
.rb-hud {
  position: absolute;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: var(--s2);
  padding: 4px;
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-sunken) 74%, transparent);
  backdrop-filter: blur(12px) saturate(1.1);
  box-shadow: var(--shadow-ambient);
}
.rb-hud--tl { top: var(--s3); left: var(--s3); }
.rb-hud--tr { top: var(--s3); right: var(--s3); }
.rb-hud--plain {
  border: 0;
  background: none;
  backdrop-filter: none;
  box-shadow: none;
  padding: 0;
}
@media (max-width: 767px) {
  .rb-hud--tl { flex-direction: column; align-items: flex-start; border-radius: var(--radius-2xl); }
}

/* The quality pill is a real toggle: 44px of hit area around a 24px pill. */
.rb-pill-btn {
  position: relative;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  cursor: pointer;
}
.rb-pill-btn::after { content: ''; position: absolute; inset: -10px -4px; }
.rb-pill-btn:focus-visible { outline: none; }
.rb-pill-btn:focus-visible .rb-pill { outline: 2px solid var(--focus); outline-offset: 2px; }
.rb-pill-btn[aria-pressed='false'] .rb-pill::before { background: var(--text-muted); }
.rb-pill-btn[aria-pressed='true'] .rb-pill { color: var(--text-strong); }

/* ---- phone selection toolbar ------------------------------------------- */
.rb-hud--sel {
  left: var(--s3);
  right: var(--s3);
  bottom: var(--s3);
  justify-content: center;
  flex-wrap: wrap;
  border-radius: var(--radius-2xl);
}
.rb-hud__details {
  min-height: var(--tap);
  padding-inline: var(--s4);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-full);
  background: var(--bg-raised);
  color: var(--text-strong);
  font-family: var(--font-ui);
  font-size: var(--step--1);
  cursor: pointer;
}
.rb-hud__details:active { transform: scale(0.98); }
/* While the toolbar is up the budget counter steps above it. */
.rb-view__core--sel .rb-budget { bottom: calc(var(--s3) + var(--tap) + var(--s5)); }

/* ---- gesture hint chip (corner, dismissible) --------------------------- */
.rb-tip {
  position: absolute;
  z-index: 3;
  right: var(--s3);
  bottom: var(--s3);
  display: flex;
  align-items: center;
  gap: var(--s2);
  max-width: min(360px, 42%);
  padding: 4px 4px 4px var(--s3);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-2xl);
  background: color-mix(in srgb, var(--bg-raised) 84%, transparent);
  backdrop-filter: blur(12px) saturate(1.1);
  box-shadow: var(--shadow-ambient);
  font-size: 11px;
  line-height: 1.3;
  color: var(--text-muted);
}
.rb-tip button {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: var(--bezel-shell);
  color: var(--text);
  cursor: pointer;
}
.rb-tip button:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
.rb-view__core--sel .rb-tip { display: none; }

/* ---- empty room -------------------------------------------------------- */
.rb-empty {
  position: absolute;
  z-index: 2;
  left: 50%;
  top: calc(var(--s3) + 60px);
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--s3);
  max-width: calc(100% - var(--s8));
  padding: 6px 6px 6px var(--s4);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-raised) 88%, transparent);
  backdrop-filter: blur(12px) saturate(1.1);
  box-shadow: var(--shadow-float);
  font-size: var(--step--1);
  color: var(--text);
  animation: rb-empty-in var(--d-slow) var(--ease) both;
}
.rb-empty strong { color: var(--text-strong); font-weight: 500; white-space: nowrap; }
.rb-empty span { color: var(--text-muted); }
.rb-empty button {
  flex: 0 0 auto;
  min-height: 34px;
  padding-inline: var(--s4);
  border: 0;
  border-radius: var(--radius-full);
  background: var(--accent-ink);
  color: var(--paper);
  font: inherit;
  font-size: var(--step--1);
  cursor: pointer;
}
@keyframes rb-empty-in { from { opacity: 0; transform: translate(-50%, -6px); } to { opacity: 1; transform: translateX(-50%); } }
@media (max-width: 767px) {
  .rb-empty { top: auto; bottom: calc(var(--s3) + 84px); animation: none; }
  .rb-empty span { display: none; }
}
@media (min-width: 768px) {
  .rb-hud--tl { top: var(--s4); }
}
@media (prefers-reduced-motion: reduce) { .rb-empty { animation: none; } }

/* ---- bottom sheet ------------------------------------------------------ */
.rb-sheet {
  position: relative;
  z-index: 6;
  display: grid;
  gap: var(--s3);
  padding: var(--bezel-pad);
  /* Clears the floating mobile dock and the home indicator. */
  margin-bottom: calc(96px + env(safe-area-inset-bottom));
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-3xl);
  background: var(--bezel-shell);
  box-shadow: var(--shadow-raised);
}
.rb-sheet__tabs {
  position: sticky;
  top: var(--hdr-offset, 0px);
  z-index: 2;
  display: flex;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 3px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bezel-shell) 92%, var(--bg-raised));
  backdrop-filter: blur(14px) saturate(1.1);
  box-shadow: var(--shadow-ambient);
}
.rb-sheet__tabs::-webkit-scrollbar { display: none; }
.rb-sheet__tab {
  flex: 0 0 auto;
  min-height: 40px;
  padding-inline: var(--s5);
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-ui);
  font-size: var(--step--1);
  cursor: pointer;
  transition: color var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease),
    transform var(--d-fast) var(--ease);
}
.rb-sheet__tab:active { transform: scale(0.98); }
.rb-sheet__tab[aria-selected='true'] {
  background: var(--bg-raised);
  color: var(--text-strong);
  box-shadow: var(--inset-hi), var(--shadow-ambient);
}
.rb-sheet__body {
  display: grid;
  gap: var(--s4);
  padding: var(--s1);
}
.rb-sheet__cta { padding: 0; }
`

type Tab = 'room' | 'catalog' | 'fixtures' | 'light' | 'inspector'
const TABS: Tab[] = ['room', 'catalog', 'fixtures', 'light', 'inspector']

function UndoIcon({ flip }: { flip?: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path
        d="M6 4 2.8 7.2 6 10.4M3 7.2h6.2a3.6 3.6 0 0 1 0 7.2H6"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const ROTATE_STEP = Math.PI / 12
const COACH_KEY = 'framespace.builder.coach'

function readCoachDismissed(): boolean {
  try {
    return window.localStorage.getItem(COACH_KEY) === '1'
  } catch {
    return false
  }
}

function writeCoachDismissed() {
  try {
    window.localStorage.setItem(COACH_KEY, '1')
  } catch {
    /* private mode: the coach simply shows again next visit */
  }
}

function RotateIcon({ flip }: { flip?: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path
        d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5M3 2.6v2.8h2.8"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SwatchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6" cy="6.4" r="3.4" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="10" cy="9.6" r="3.4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.6" y="2.6" width="8" height="8" rx="1.4" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M5.4 13.4h7a1 1 0 0 0 1-1v-7"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 4.5h10M6.5 4V2.8h3V4M4.4 4.5 5 13.2h6l.6-8.7M6.6 7v4M9.4 7v4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 1.5 8.3 5.2 12 6.5 8.3 7.8 7 11.5 5.7 7.8 2 6.5 5.7 5.2z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function RoomBuilder() {
  const { t } = useTranslation()
  const { id } = useParams<{ id?: string }>()
  const wide = useMediaQuery('(min-width: 1024px)')
  // 1024-1279px: three columns would leave the room ~360px wide, so the right
  // rail becomes a drawer over the viewport instead.
  const roomy = useMediaQuery('(min-width: 1280px)')
  const drawerMode = wide && !roomy
  const [drawerOpen, setDrawerOpen] = useState(false)
  const autoOpened = useRef(false)
  const [params, setParams] = useSearchParams()
  const addParam = params.get('add')
  const consumedAdd = useRef<string | null>(null)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const coarse = useMediaQuery('(pointer: coarse)')
  const reducedMotion = useReducedMotion()
  const [tab, setTab] = useState<Tab>('catalog')
  const [leftTab, setLeftTab] = useState<'catalog' | 'room' | 'fixtures'>('catalog')
  const [dropping, setDropping] = useState(false)
  const [coachDismissed, setCoachDismissed] = useState(readCoachDismissed)
  const viewRef = useRef<HTMLElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const view = useBuilder((s) => s.view)
  const setView = useBuilder((s) => s.setView)
  const tier = useBuilder((s) => s.quality)
  const canUndo = useBuilder((s) => s.past.length > 0)
  const canRedo = useBuilder((s) => s.future.length > 0)
  const undo = useBuilder((s) => s.undo)
  const redo = useBuilder((s) => s.redo)
  const reset = useBuilder((s) => s.reset)
  const addItem = useBuilder((s) => s.addItem)
  const addFixture = useBuilder((s) => s.addFixture)
  const openGenerate = useBuilder((s) => s.openGenerate)
  const generateOpen = useBuilder((s) => s.generateOpen)
  const setQuality = useBuilder((s) => s.setQuality)
  const load = useBuilder((s) => s.load)
  const selectedItemId = useBuilder((s) => (s.selection?.kind === 'item' ? s.selection.id : null))
  const selectedItem = useBuilder((s) =>
    selectedItemId ? (s.scene.items.find((i) => i.id === selectedItemId) ?? null) : null
  )
  const rotateSelected = useBuilder((s) => s.rotateSelected)
  const itemCount = useBuilder((s) => s.scene.items.length)
  const cycleItemMaterial = useBuilder((s) => s.cycleItemMaterial)
  const duplicateSelected = useBuilder((s) => s.duplicateSelected)
  const removeSelected = useBuilder((s) => s.removeSelected)
  const selectionKey = useBuilder((s) => (s.selection ? `${s.selection.kind}:${s.selection.id}` : null))
  const savedAt = useBuilderSaved((s) => s.savedAt)
  const [showSaved, setShowSaved] = useState(false)

  useBuilderShortcuts()

  // One saved scene per room; `/app/room/new` is a room like any other.
  useEffect(() => {
    load(id ?? 'draft')
  }, [id, load])

  // `?add=<piece>` (from a catalog product page): once the room has loaded,
  // the piece is placed on free floor and selected, as one undoable step. The
  // param is then dropped so a reload does not add a second one.
  useEffect(() => {
    if (!addParam) return
    const key = `${id ?? 'draft'}:${addParam}`
    if (consumedAdd.current === key) return
    consumedAdd.current = key
    const run = () => {
      if (!CATALOG.some((entry) => entry.id === addParam)) return
      useBuilder.getState().addItem(addParam)
      setJustAdded(addParam)
    }
    if (useBuilder.persist.hasHydrated()) run()
    else {
      const off = useBuilder.persist.onFinishHydration(() => {
        off()
        run()
      })
    }
    const next = new URLSearchParams(params)
    next.delete('add')
    next.delete('from')
    setParams(next, { replace: true })
    // `params` is only read to strip the two keys; it must not re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addParam, id])

  useEffect(() => {
    if (!justAdded) return
    const timer = window.setTimeout(() => setJustAdded(null), 3600)
    return () => window.clearTimeout(timer)
  }, [justAdded])

  // Drawer mode: selecting something opens the inspector; clearing a selection
  // closes it again only if it was the selection that opened it.
  useEffect(() => {
    if (!drawerMode) return
    if (selectionKey) {
      setDrawerOpen((open) => {
        if (!open) autoOpened.current = true
        return true
      })
    } else if (autoOpened.current) {
      autoOpened.current = false
      setDrawerOpen(false)
    }
  }, [selectionKey, drawerMode])

  // The generate sheet and any half-finished drag never outlive the page.
  useEffect(
    () => () => {
      const state = useBuilder.getState()
      state.openGenerate(false)
      state.endDrag()
      state.select(null)
    },
    []
  )

  // A quiet confirmation after each debounced write, then it gets out of the way.
  useEffect(() => {
    if (!savedAt) return
    setShowSaved(true)
    const timer = window.setTimeout(() => setShowSaved(false), 2200)
    return () => window.clearTimeout(timer)
  }, [savedAt])

  // On phones the catalogue lives in the sheet below the room. Adding a piece
  // there brings the room back into view so the person sees where it landed.
  useEffect(() => {
    if (wide) return
    return useBuilder.subscribe((next, prev) => {
      const added =
        next.scene.items.length > prev.scene.items.length &&
        next.past[next.past.length - 1] === prev.scene
      if (!added) return
      viewRef.current?.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'start',
      })
    })
  }, [wide, reducedMotion])

  function dismissCoach() {
    writeCoachDismissed()
    setCoachDismissed(true)
  }

  function rotateBy(step: number) {
    // Each tap is its own undo step, exactly like a keyboard nudge.
    rotateSelected(step)
  }

  function openCatalog() {
    if (wide) {
      setLeftTab('catalog')
      const input = document.querySelector<HTMLInputElement>('.rb-cat__input')
      input?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
      input?.focus({ preventScroll: true })
      return
    }
    setTab('catalog')
    sheetRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'end' })
  }

  function openDetails() {
    setTab('inspector')
    sheetRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'end' })
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDropping(false)
    const itemId = event.dataTransfer.getData('application/x-framespace-item')
    const fixtureKind = event.dataTransfer.getData('application/x-framespace-fixture')
    // The scene registers a picker that turns a screen point into a floor point.
    const picker = useBuilder.getState().picker
    const at = picker?.(event.clientX, event.clientY) ?? undefined
    if (itemId) addItem(itemId, at)
    else if (fixtureKind) addFixture(fixtureKind as FixtureKind, at)
  }

  const gestureHint = coarse
    ? t('builder.view.hintTouch', {
        defaultValue: 'Bir barmoq: aylantirish · Ikki barmoq: yaqinlashtirish va surish',
      })
    : t('builder.view.hintMouse', {
        defaultValue: 'Sichqoncha: aylantirish · Gʻildirak: yaqinlashtirish · Oʻng tugma: surish',
      })

  const viewOptions: Array<{ value: ViewMode; label: string }> = [
    { value: 'plan', label: t('builder.view.plan') },
    { value: 'perspective', label: t('builder.view.perspective') },
  ]

  const generateCta = (
    <Cta icon={<SparkIcon />} onClick={() => openGenerate(true)}>
      {t('builder.generate.cta')}
    </Cta>
  )

  return (
    <div className="fs-container rb-page">
      <style href="fs-builder-shell" precedence="medium">
        {CSS}
      </style>
      <ChromeStyles />
      <PanelStyles />
      <CatalogStyles />
      <InspectorStyles />
      <BudgetStyles />
      <GenerateStyles />

      <Seo
        title={t('builder.seoTitle')}
        description={t('builder.lead')}
        path={id ? `/app/room/${id}` : '/app/room/new'}
        noindex
      />
      <header className="rb-head">
        <div className="rb-head__text">
          <div className="rb-head__tags">
            <Pill>{t('builder.eyebrow')}</Pill>
          </div>
          <h1 className="rb-head__title">{t('builder.title')}</h1>
          <span aria-live="polite">
            {justAdded ? (
              <Pill>{t('builder.added', { name: t(`builder.catalog.items.${justAdded}`) })}</Pill>
            ) : (
              showSaved && <Pill tone="quiet">{t('builder.saved')}</Pill>
            )}
          </span>
          <p className="rb-hint rb-head__lead">{t('builder.lead')}</p>
        </div>
        {wide && (
          <div className="rb-head__tools">
            {drawerMode && (
              <button
                type="button"
                className="rb-toggle"
                aria-expanded={drawerOpen}
                aria-controls="rb-inspector-drawer"
                onClick={() => {
                  autoOpened.current = false
                  setDrawerOpen((open) => !open)
                }}
              >
                {t('builder.tabs.inspector')}
                <span className="rb-toggle__n">{itemCount}</span>
              </button>
            )}
            {generateCta}
          </div>
        )}
      </header>

      <div className={drawerMode ? 'rb-stage rb-stage--drawer' : 'rb-stage'}>
        {wide && (
          <aside className="rb-rail" data-lenis-prevent="" aria-label={t('builder.catalog.title')}>
            <div className="rb-rail__tabs">
              <Segmented<'catalog' | 'room' | 'fixtures'>
                block
                label={t('builder.catalog.title')}
                value={leftTab}
                onChange={setLeftTab}
                options={[
                  { value: 'catalog', label: t('builder.tabs.catalog') },
                  { value: 'room', label: t('builder.tabs.room') },
                  { value: 'fixtures', label: t('builder.tabs.fixtures') },
                ]}
              />
            </div>
            {leftTab === 'catalog' && <CatalogPanel />}
            {leftTab === 'room' && <RoomPanel />}
            {leftTab === 'fixtures' && <FixturePanel />}
          </aside>
        )}

        <section
          ref={viewRef}
          className={dropping ? 'rb-view rb-view--drop' : 'rb-view'}
          aria-label={t('builder.a11y.viewport')}
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
            setDropping(true)
          }}
          onDragLeave={(event) => {
            // Moving over a HUD child fires dragleave on the parent; ignore it.
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false)
          }}
          onDrop={onDrop}
        >
          <div
            className={
              !wide && selectedItem ? 'rb-view__core rb-view__core--sel' : 'rb-view__core'
            }
          >
            <SceneCanvas
              className="rb-view__canvas"
              rootMargin="0px"
              frameloop="demand"
              // The sheet covers the room; nothing under it needs a frame.
              paused={generateOpen}
              tier={tier}
              label={t('builder.a11y.viewport')}
              // Weak devices lose the shadow map entirely rather than limping.
              shadows={tier === 'high' ? 'soft' : false}
              fallback={<PlanFallback />}
            >
              <BuilderScene />
            </SceneCanvas>

            <div className="rb-hud rb-hud--tl">
              <Segmented
                options={viewOptions}
                value={view}
                onChange={setView}
                label={t('builder.view.label')}
              />
              <button
                type="button"
                className="rb-pill-btn"
                aria-pressed={tier === 'low'}
                title={t('builder.quality.toggle', { defaultValue: '3D sifatini almashtirish' })}
                onClick={() => setQuality(tier === 'low' ? 'high' : 'low')}
              >
                <Pill tone={tier === 'low' ? 'warn' : 'quiet'}>
                  {t('builder.quality.low', { defaultValue: 'Soddalashtirilgan 3D' })}
                </Pill>
              </button>
            </div>

            <div className="rb-hud rb-hud--tr">
              <IconButton
                label={t('builder.history.undo')}
                shortcut={`${MOD_KEY} + Z`}
                disabled={!canUndo}
                onClick={undo}
              >
                <UndoIcon />
              </IconButton>
              <IconButton
                label={t('builder.history.redo')}
                shortcut={`${MOD_KEY} + ⇧ + Z`}
                disabled={!canRedo}
                onClick={redo}
              >
                <UndoIcon flip />
              </IconButton>
              <IconButton label={t('builder.history.reset')} tipEnd onClick={reset}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M2.6 8a5.4 5.4 0 1 0 1.7-3.9M2.4 3v3.1h3.1"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </IconButton>
            </div>

            {itemCount === 0 && !generateOpen && (
              <div className="rb-empty" role="status">
                <strong>{t('builder.editor.emptyTitle')}</strong>
                <span>{t('builder.editor.emptyBody')}</span>
                <button type="button" onClick={openCatalog}>
                  {t('builder.editor.openCatalog')}
                </button>
              </div>
            )}

            {!coachDismissed && (
              <div className="rb-tip" role="note">
                <span>{gestureHint}</span>
                <button
                  type="button"
                  aria-label={t('builder.coach.dismiss')}
                  title={t('builder.coach.dismiss')}
                  onClick={dismissCoach}
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M3 3l6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}

            {!wide && selectedItem && (
              <div
                className="rb-hud rb-hud--sel"
                role="toolbar"
                aria-label={t(`builder.catalog.items.${selectedItem.catalogId}`)}
              >
                <IconButton
                  label={t('builder.toolbar.rotateLeft', { defaultValue: 'Chapga burish' })}
                  onClick={() => rotateBy(ROTATE_STEP)}
                >
                  <RotateIcon />
                </IconButton>
                <IconButton
                  label={t('builder.toolbar.rotateRight', { defaultValue: 'Oʻngga burish' })}
                  onClick={() => rotateBy(-ROTATE_STEP)}
                >
                  <RotateIcon flip />
                </IconButton>
                <IconButton
                  label={t('builder.toolbar.finish', { defaultValue: 'Material' })}
                  onClick={() => cycleItemMaterial(selectedItem.id)}
                >
                  <SwatchIcon />
                </IconButton>
                <IconButton
                  label={t('builder.toolbar.duplicate', { defaultValue: 'Nusxalash' })}
                  onClick={duplicateSelected}
                >
                  <CopyIcon />
                </IconButton>
                <IconButton
                  danger
                  label={t('builder.toolbar.delete', { defaultValue: 'Oʻchirish' })}
                  onClick={removeSelected}
                >
                  <TrashIcon />
                </IconButton>
                <button type="button" className="rb-hud__details" onClick={openDetails}>
                  {t('builder.toolbar.details', { defaultValue: 'Batafsil' })}
                </button>
              </div>
            )}

            <BudgetCounter />
          </div>
        </section>

        {wide && (
          <aside
            id="rb-inspector-drawer"
            className={drawerMode ? 'rb-rail rb-rail--drawer' : 'rb-rail'}
            data-open={drawerMode ? drawerOpen : undefined}
            inert={drawerMode && !drawerOpen ? true : undefined}
            data-lenis-prevent=""
            aria-label={t('builder.inspector.title')}
          >
            {drawerMode && (
              <div className="rb-drawer__head">
                <IconButton
                  label={t('builder.drawer.close')}
                  tipEnd
                  onClick={() => {
                    autoOpened.current = false
                    setDrawerOpen(false)
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M3 3l6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </IconButton>
              </div>
            )}
            <InspectorPanel />
            <LightPanel />
            <KeysPanel />
          </aside>
        )}
      </div>

      {!wide && (
        <div className="rb-sheet" ref={sheetRef}>
          <div className="rb-sheet__cta">
            <Cta block icon={<SparkIcon />} onClick={() => openGenerate(true)}>
              {t('builder.generate.cta')}
            </Cta>
          </div>
          <div className="rb-sheet__tabs" role="tablist" aria-label={t('builder.a11y.viewport')}>
            {TABS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                className="rb-sheet__tab"
                aria-selected={key === tab}
                onClick={() => setTab(key)}
              >
                {t(`builder.tabs.${key}`)}
              </button>
            ))}
          </div>
          <div className="rb-sheet__body">
            {tab === 'room' && <RoomPanel />}
            {tab === 'catalog' && <CatalogPanel />}
            {tab === 'fixtures' && <FixturePanel />}
            {tab === 'light' && (
              <>
                <LightPanel />
                <KeysPanel />
              </>
            )}
            {tab === 'inspector' && <InspectorPanel />}
          </div>
        </div>
      )}

      <GenerateSheet />
    </div>
  )
}

export default RoomBuilder
