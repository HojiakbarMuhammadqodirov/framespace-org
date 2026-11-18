import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { FIXTURE_SIZE, footprint, polygonArea, polygonPerimeter } from '../geometry'
import { metres, squareMetres } from '../format'
import { CEILING_PAINTS, FLOORS, WALL_PAINTS } from '../catalog'
import { useBuilder } from '../store'
import type { FixtureKind, LightingPreset, RoomShape } from '../types'
import { MOD_KEY, Panel, Pill, Readout, Segmented, Stepper } from './chrome'

/**
 * The left rail: room dimensions, openings, light, and the keyboard card.
 * Each one is a double-bezel panel; none of them is a card in a row of three.
 */

const CSS = `
.rb-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2) var(--s5);
  padding-top: var(--s3);
  border-top: 1px solid var(--hairline);
}
.rb-fixgrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--s2);
}
.rb-fix {
  display: grid;
  gap: var(--s2);
  min-height: 84px;
  padding: var(--s3);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-xl);
  background: var(--bg-sunken);
  color: var(--text);
  text-align: left;
  cursor: grab;
  transition: transform var(--d-fast) var(--ease), border-color var(--d-fast) var(--ease),
    background-color var(--d-fast) var(--ease);
}
.rb-fix:hover { border-color: var(--border-strong); background: var(--bg-raised); }
.rb-fix:active { transform: scale(0.98); cursor: grabbing; }
.rb-fix__name { font-size: var(--step--1); color: var(--text-strong); }
.rb-fix__size {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.rb-keys { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.rb-keys li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  min-height: 32px;
  font-size: 12px;
  color: var(--text-muted);
}
.rb-keys li + li { border-top: 1px solid var(--hairline); }
.rb-keys__combo { display: inline-flex; gap: 3px; flex: 0 0 auto; }
.rb-kbd {
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 5px;
  border-radius: var(--radius-sm);
  background: var(--bg-raised);
  box-shadow: inset 0 0 0 1px var(--bezel-ring), 0 1px 0 var(--bezel-ring);
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1;
  color: var(--text-strong);
}
.rb-fix:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
/* Free colour: a rainbow chip with the native picker laid invisibly over it. */
.rb-swatch--well { position: relative; display: inline-block; overflow: hidden; }
.rb-swatch--well input {
  position: absolute; inset: 0; width: 100%; height: 100%;
  opacity: 0; cursor: pointer; border: 0; padding: 0;
}
.rb-swatch--well:focus-within { outline: 2px solid var(--focus); outline-offset: 2px; }
.rb-swatch__dot--well {
  background: conic-gradient(#e2574c, #e9b44c, #7fb069, #4aa3a2, #5b7fd1, #a56cc1, #e2574c);
}
/* Floor chips hint at the lay, not just the colour. */
.rb-floor { background-blend-mode: multiply; }
.rb-floor--oak, .rb-floor--ash, .rb-floor--walnut {
  background-image: repeating-linear-gradient(0deg, rgba(0,0,0,0) 0 5px, rgba(0,0,0,.18) 5px 6px) !important;
}
.rb-floor--herringbone {
  background-image:
    repeating-linear-gradient(45deg, rgba(0,0,0,0) 0 4px, rgba(0,0,0,.2) 4px 5px),
    repeating-linear-gradient(-45deg, rgba(0,0,0,0) 0 4px, rgba(0,0,0,.12) 4px 5px) !important;
}
.rb-floor--tile {
  background-image:
    repeating-linear-gradient(0deg, rgba(0,0,0,0) 0 9px, rgba(0,0,0,.22) 9px 10px),
    repeating-linear-gradient(90deg, rgba(0,0,0,0) 0 9px, rgba(0,0,0,.22) 9px 10px) !important;
}
.rb-floor--carpet {
  background-image: radial-gradient(rgba(0,0,0,.16) 0.6px, rgba(0,0,0,0) 0.8px) !important;
  background-size: 3px 3px !important;
}
`

export function PanelStyles() {
  return (
    <style href="fs-builder-panels" precedence="medium">
      {CSS}
    </style>
  )
}

/* ------------------------------------------------------------------- room */

export function RoomPanel() {
  const { t } = useTranslation()
  const room = useBuilder((s) => s.scene.room)
  const setRoom = useBuilder((s) => s.setRoom)
  const applyPreset = useBuilder((s) => s.applyPreset)
  const snapshot = useBuilder((s) => s.snapshot)

  const metrics = useMemo(() => {
    const poly = footprint(room)
    return { area: polygonArea(poly), perimeter: polygonPerimeter(poly) }
  }, [room])

  const shapes: Array<{ value: RoomShape; label: string }> = [
    { value: 'rect', label: t('builder.room.shapes.rect') },
    { value: 'l', label: t('builder.room.shapes.l') },
    { value: 'studio', label: t('builder.room.shapes.studio') },
  ]

  return (
    <>
    <Panel eyebrow={t('builder.room.shape')} title={t('builder.room.title')}>
      <Segmented
        block
        label={t('builder.room.shape')}
        options={shapes}
        value={room.shape}
        onChange={applyPreset}
      />

      <Stepper
        label={t('builder.room.width')}
        unit="m"
        value={room.width}
        min={2}
        max={12}
        decimals={2}
        onBegin={snapshot}
        onChange={(value) => setRoom({ width: value }, false)}
      />
      <Stepper
        label={t('builder.room.depth')}
        unit="m"
        value={room.depth}
        min={2}
        max={12}
        decimals={2}
        onBegin={snapshot}
        onChange={(value) => setRoom({ depth: value }, false)}
      />
      <Stepper
        label={t('builder.room.height')}
        unit="m"
        step={0.05}
        value={room.height}
        min={2.2}
        max={4.2}
        onBegin={snapshot}
        onChange={(value) => setRoom({ height: value }, false)}
      />

      {room.shape === 'l' && (
        <>
          <Stepper
            label={t('builder.room.notchW')}
            unit="m"
            value={room.notchW}
            decimals={2}
            min={0.6}
            max={Math.max(0.6, room.width - 1.2)}
            onBegin={snapshot}
            onChange={(value) => setRoom({ notchW: value }, false)}
          />
          <Stepper
            label={t('builder.room.notchD')}
            unit="m"
            value={room.notchD}
            decimals={2}
            min={0.6}
            max={Math.max(0.6, room.depth - 1.2)}
            onBegin={snapshot}
            onChange={(value) => setRoom({ notchD: value }, false)}
          />
        </>
      )}

      <div className="rb-metrics">
        <Readout label={t('builder.room.area')} value={`${squareMetres(metrics.area)} m²`} />
        <Readout
          label={t('builder.room.perimeter')}
          value={`${metres(metrics.perimeter)} m`}
        />
        <Readout label="H" value={`${metres(room.height)} m`} />
      </div>

      <p className="rb-hint">{t('builder.room.hint')}</p>
    </Panel>
    <SurfacePanel />
    </>
  )
}

/* --------------------------------------------------------------- surfaces */

/**
 * A row of colour chips plus a free colour well. The well is a native colour
 * input: every platform already has a good picker, and it hands back a hex.
 */
export function PaintRow({
  label,
  value,
  paints,
  onPick,
  onBegin,
  custom = true,
}: {
  label: string
  value: string
  paints: Array<{ id: string; hex: string }>
  onPick: (hex: string) => void
  /** Called once as a colour-well drag starts, so it is one undo step. */
  onBegin?: () => void
  custom?: boolean
}) {
  const { t } = useTranslation()
  const current = value.toLowerCase()
  return (
    <div className="rb-row">
      <span className="rb-row__label">
        <span>{label}</span>
        <span>{current.toUpperCase()}</span>
      </span>
      <div className="rb-swatches">
        {paints.map((paint) => (
          <button
            key={paint.id}
            type="button"
            className="rb-swatch"
            aria-pressed={paint.hex === current}
            aria-label={`${label} ${paint.hex}`}
            title={paint.hex}
            onClick={() => onPick(paint.hex)}
          >
            <span className="rb-swatch__dot" style={{ background: paint.hex }} />
          </button>
        ))}
        {custom && (
          <label className="rb-swatch rb-swatch--well" title={t('builder.room.customColor')}>
            <span className="rb-swatch__dot rb-swatch__dot--well" />
            <input
              type="color"
              value={current}
              aria-label={`${label} — ${t('builder.room.customColor')}`}
              onPointerDown={onBegin}
              onChange={(event) => onPick(event.target.value.toLowerCase())}
            />
          </label>
        )}
      </div>
    </div>
  )
}

export function SurfacePanel() {
  const { t } = useTranslation()
  const surfaces = useBuilder((s) => s.scene.surfaces)
  const setWallPaint = useBuilder((s) => s.setWallPaint)
  const setFloor = useBuilder((s) => s.setFloor)
  const setCeilingPaint = useBuilder((s) => s.setCeilingPaint)

  return (
    <Panel eyebrow={t('builder.room.surfaces')} title={t('builder.room.surfaces')}>
      <PaintRow
        label={t('builder.room.wallPaint')}
        value={surfaces.wall}
        paints={WALL_PAINTS}
        onPick={setWallPaint}
      />
      <div className="rb-row">
        <span className="rb-row__label">
          <span>{t('builder.room.floor')}</span>
          <span>{t(`builder.room.floors.${surfaces.floor}`)}</span>
        </span>
        <div className="rb-swatches">
          {FLOORS.map((floor) => (
            <button
              key={floor.id}
              type="button"
              className="rb-swatch"
              aria-pressed={floor.id === surfaces.floor}
              aria-label={t(`builder.room.floors.${floor.id}`)}
              title={t(`builder.room.floors.${floor.id}`)}
              onClick={() => setFloor(floor.id)}
            >
              <span className={`rb-swatch__dot rb-floor rb-floor--${floor.id}`} style={{ background: floor.hex }} />
            </button>
          ))}
        </div>
      </div>
      <PaintRow
        label={t('builder.room.ceiling')}
        value={surfaces.ceiling}
        paints={CEILING_PAINTS}
        onPick={setCeilingPaint}
        custom={false}
      />
    </Panel>
  )
}

/* --------------------------------------------------------------- fixtures */

const FIXTURES: FixtureKind[] = ['window', 'door', 'radiator', 'socket']

export function FixturePanel() {
  const { t } = useTranslation()
  const addFixture = useBuilder((s) => s.addFixture)

  return (
    <Panel eyebrow={t('builder.fixtures.title')} title={t('builder.fixtures.title')}>
      <div className="rb-fixgrid">
        {FIXTURES.map((kind) => {
          const size = FIXTURE_SIZE[kind]
          return (
            <button
              key={kind}
              type="button"
              className="rb-fix"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('application/x-framespace-fixture', kind)
                event.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => addFixture(kind)}
            >
              <span className="rb-fix__name">{t(`builder.fixtures.${kind}`)}</span>
              <span className="rb-fix__size">
                {metres(size.w)} × {metres(size.h)} m
              </span>
            </button>
          )
        })}
      </div>
      <p className="rb-hint">{t('builder.fixtures.hint')}</p>
    </Panel>
  )
}

/* ------------------------------------------------------------------ light */

const PRESETS: LightingPreset[] = ['morning', 'afternoon', 'evening', 'lamps']

export function LightPanel() {
  const { t } = useTranslation()
  const lighting = useBuilder((s) => s.scene.lighting)
  const setLighting = useBuilder((s) => s.setLighting)

  return (
    <Panel eyebrow={t('builder.light.title')} title={t('builder.light.title')}>
      <Segmented
        block
        label={t('builder.light.title')}
        value={lighting}
        onChange={setLighting}
        options={PRESETS.map((preset) => ({
          value: preset,
          label: t(`builder.light.${preset}`),
        }))}
      />
    </Panel>
  )
}

/* ------------------------------------------------------------------- keys */

export function KeysPanel() {
  const { t } = useTranslation()
  const tier = useBuilder((s) => s.quality)

  const rows: Array<{ key: string; combo: string[] }> = [
    { key: 'delete', combo: ['Del'] },
    { key: 'nudge', combo: ['←', '↑', '→', '↓'] },
    { key: 'nudgeFar', combo: ['⇧', '←↑→↓'] },
    { key: 'rotate', combo: ['R'] },
    { key: 'duplicate', combo: [MOD_KEY, 'D'] },
    { key: 'undo', combo: [MOD_KEY, 'Z'] },
    { key: 'redo', combo: [MOD_KEY, '⇧', 'Z'] },
    { key: 'deselect', combo: ['Esc'] },
  ]

  return (
    <Panel
      eyebrow={t('builder.keys.title')}
      action={tier === 'low' ? <Pill tone="warn">{t('builder.quality.low')}</Pill> : undefined}
    >
      <ul className="rb-keys">
        {rows.map((row) => (
          <li key={row.key}>
            <span>{t(`builder.shortcuts.${row.key}`)}</span>
            <span className="rb-keys__combo">
              {row.combo.map((k) => (
                <kbd className="rb-kbd" key={k}>
                  {k}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
      {tier === 'low' && <p className="rb-hint">{t('builder.quality.hint')}</p>}
    </Panel>
  )
}
