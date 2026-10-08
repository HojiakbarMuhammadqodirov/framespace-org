import { useTranslation } from 'react-i18next'

import { MATERIAL_HEX, MATERIAL_KEYS, entryFor } from '../catalog'
import { metres, useMoneyFormat } from '../format'
import { FIXTURE_SIZE, buildWalls, findWall } from '../geometry'
import { findCollisions, useBuilder } from '../store'
import type { MaterialKey, WallId } from '../types'
import { Cta, IconButton, MOD_KEY, Panel, Pill, Readout, Stepper } from './chrome'

/**
 * Inspector for whatever is selected: a piece, a fixture, or a wall.
 * Empty is a designed state, not a blank rail.
 *
 * Below it, every placed piece is listed as a plain button. That list is the
 * keyboard (and screen reader) way into the scene: pick a piece by name, then
 * edit it with the steppers above — no pointer on a canvas required.
 */

const CSS = `
.rb-insp { display: grid; gap: var(--s4); }
.rb-insp__grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2) var(--s5);
  padding-block: var(--s3);
  border-block: 1px solid var(--hairline);
}
.rb-insp__actions { display: flex; gap: var(--s2); align-items: center; }
.rb-insp__warn {
  display: flex;
  align-items: center;
  gap: var(--s3);
  padding: var(--s3) var(--s4);
  border: 1px solid var(--warn);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--warn) 10%, transparent);
  color: var(--warn-ink);
  font-size: var(--step--1);
}
.rb-insp__empty {
  display: grid;
  gap: var(--s3);
  justify-items: center;
  text-align: center;
  padding: var(--s5) var(--s3);
  border: 1px dashed var(--bezel-ring);
  border-radius: var(--radius-xl);
}
.rb-insp__empty-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  color: var(--text-muted);
}
.rb-placed__row { display: flex; align-items: center; gap: var(--s1); }
.rb-placed__row .rb-placed__btn { flex: 1; min-width: 0; }
.rb-placed__name { display: inline-flex; align-items: center; gap: var(--s3); min-width: 0; }
.rb-placed__dot { width: 10px; height: 10px; flex: 0 0 auto; border-radius: 50%; box-shadow: inset 0 0 0 1px var(--bezel-ring); }
.rb-placed__del { width: 36px; height: 36px; flex: 0 0 auto; }
.rb-placed__total {
  display: flex;
  justify-content: space-between;
  gap: var(--s3);
  padding: var(--s3) var(--s4) 0;
  border-top: 1px solid var(--hairline);
  font-family: var(--font-mono);
  font-size: var(--step--1);
  font-variant-numeric: tabular-nums;
  color: var(--text-strong);
}
.rb-placed { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }
.rb-placed__btn {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  min-height: var(--tap);
  padding-inline: var(--s4);
  border: 1px solid transparent;
  border-radius: var(--radius-xl);
  background: transparent;
  color: var(--text);
  font-family: var(--font-ui);
  font-size: var(--step--1);
  text-align: start;
  cursor: pointer;
  transition: background-color var(--d-fast) var(--ease), border-color var(--d-fast) var(--ease);
}
@media (hover: hover) and (pointer: fine) {
  .rb-placed__btn:hover { background: var(--bezel-shell); }
}
.rb-placed__btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
.rb-placed__btn[aria-pressed='true'] {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--bezel-ring));
  background: color-mix(in srgb, var(--accent) 7%, var(--bg-raised));
  color: var(--text-strong);
  font-weight: 600;
}
@media (min-width: 1024px) and (pointer: fine) {
  .rb-placed__btn { min-height: 36px; padding-inline: var(--s3); }
  .rb-placed__del { width: 32px; height: 32px; }
  .rb-insp { gap: var(--s3); }
}
.rb-placed__price {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}
.rb-insp__price {
  font-family: var(--font-mono);
  font-size: var(--step-1);
  font-variant-numeric: tabular-nums;
  color: var(--text-strong);
}
`

export function InspectorStyles() {
  return (
    <style href="fs-builder-inspector" precedence="medium">
      {CSS}
    </style>
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

function Swatches({
  value,
  onPick,
}: {
  value: MaterialKey
  onPick: (key: MaterialKey) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="rb-swatches">
      {MATERIAL_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className="rb-swatch"
          aria-pressed={key === value}
          aria-label={t(`builder.materials.${key}`)}
          title={t(`builder.materials.${key}`)}
          onClick={() => onPick(key)}
        >
          <span className="rb-swatch__dot" style={{ background: MATERIAL_HEX[key] }} />
        </button>
      ))}
    </div>
  )
}

/** Every placed piece, by name and price. Selecting one opens it above. */
function PlacedItems() {
  const { t } = useTranslation()
  const fmt = useMoneyFormat()
  const items = useBuilder((s) => s.scene.items)
  const selection = useBuilder((s) => s.selection)
  const select = useBuilder((s) => s.select)
  const removeItem = useBuilder((s) => s.removeItem)

  if (!items.length) return null
  const total = items.reduce((sum, item) => sum + entryFor(item.catalogId).price, 0)

  return (
    <Panel
      title={t('builder.placed.title')}
      action={<Pill tone="quiet">{t('builder.editor.pieces', { count: items.length })}</Pill>}
    >
      <ul className="rb-placed">
        {items.map((item) => {
          const entry = entryFor(item.catalogId)
          const active = selection?.kind === 'item' && selection.id === item.id
          const name = t(`builder.catalog.items.${entry.id}`)
          return (
            <li key={item.id} className="rb-placed__row">
              <button
                type="button"
                className="rb-placed__btn"
                aria-pressed={active}
                onClick={() => select(active ? null : { kind: 'item', id: item.id })}
              >
                <span className="rb-placed__name">
                  <span
                    className="rb-placed__dot"
                    style={{ background: MATERIAL_HEX[item.material] }}
                    aria-hidden="true"
                  />
                  {name}
                </span>
                <span className="rb-placed__price">{fmt.full(entry.price)}</span>
              </button>
              <IconButton
                danger
                className="rb-icon rb-icon--danger rb-placed__del"
                tipEnd
                label={`${t('builder.inspector.remove')}: ${name}`}
                onClick={() => removeItem(item.id)}
              >
                <TrashIcon />
              </IconButton>
            </li>
          )
        })}
      </ul>
      <div className="rb-placed__total">
        <span>{t('builder.editor.total')}</span>
        <span>{fmt.full(total)}</span>
      </div>
    </Panel>
  )
}

export function InspectorPanel() {
  return (
    <>
      <SelectionPanel />
      <PlacedItems />
    </>
  )
}

function SelectionPanel() {
  const { t } = useTranslation()
  const fmt = useMoneyFormat()
  const selection = useBuilder((s) => s.selection)
  const scene = useBuilder((s) => s.scene)
  const snapshot = useBuilder((s) => s.snapshot)
  const moveItem = useBuilder((s) => s.moveItem)
  const rotateItem = useBuilder((s) => s.rotateItem)
  const setItemMaterial = useBuilder((s) => s.setItemMaterial)
  const removeSelected = useBuilder((s) => s.removeSelected)
  const duplicateSelected = useBuilder((s) => s.duplicateSelected)
  const setFixtureOffset = useBuilder((s) => s.setFixtureOffset)

  const title = t('builder.inspector.title')

  if (!selection) {
    return (
      <Panel eyebrow={title} title={title}>
        <div className="rb-insp__empty">
          <span className="rb-insp__empty-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M5 4l13 6.5-5.6 1.4L10.6 18z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="rb-hint">{t('builder.inspector.empty')}</p>
        </div>
      </Panel>
    )
  }

  if (selection.kind === 'wall') {
    const wall = findWall(buildWalls(scene.room), selection.id as WallId)
    if (!wall) return null
    return (
      <Panel
        eyebrow={t('builder.inspector.wall')}
        title={t(`builder.walls.${wall.id}`, { defaultValue: t('builder.inspector.wall') })}
      >
        <div className="rb-insp__grid">
          <Readout label={t('builder.inspector.wallLength')} value={`${metres(wall.length)} m`} />
          <Readout label="H" value={`${metres(scene.room.height)} m`} />
        </div>
        <p className="rb-hint">
          {wall.handle ? t('builder.inspector.wallHint') : t('builder.room.hint')}
        </p>
      </Panel>
    )
  }

  if (selection.kind === 'fixture') {
    const fixture = scene.fixtures.find((f) => f.id === selection.id)
    if (!fixture) return null
    const walls = buildWalls(scene.room)
    const wall = findWall(walls, fixture.wall)
    const size = FIXTURE_SIZE[fixture.kind]
    return (
      <Panel
        eyebrow={t('builder.inspector.fixture')}
        title={t(`builder.fixtures.${fixture.kind}`)}
        action={
          <IconButton danger tipEnd shortcut="Del" label={t('builder.inspector.remove')} onClick={removeSelected}>
            <TrashIcon />
          </IconButton>
        }
      >
        <div className="rb-insp__grid">
          <Readout label="W" value={`${metres(size.w)} m`} />
          <Readout label="H" value={`${metres(size.h)} m`} />
          <Readout
            label={t('builder.inspector.onWall')}
            value={t(`builder.walls.${fixture.wall}`, { defaultValue: fixture.wall })}
          />
        </div>
        {wall && (
          <Stepper
            label={t('builder.inspector.offset')}
            unit="m"
            value={Math.round(fixture.t * 100) / 100}
            decimals={2}
            min={0}
            max={Math.round(wall.length * 100) / 100}
            onBegin={snapshot}
            onChange={(value) => setFixtureOffset(fixture.id, value)}
          />
        )}
        <p className="rb-hint">{t('builder.fixtures.hint')}</p>
      </Panel>
    )
  }

  const item = scene.items.find((i) => i.id === selection.id)
  if (!item) return null
  const entry = entryFor(item.catalogId)
  const colliding = findCollisions(scene.items).has(item.id)
  const rotationDeg = Math.round(((item.rotation * 180) / Math.PI + 360) % 360)

  return (
    <Panel
      eyebrow={t('builder.inspector.title')}
      title={t(`builder.catalog.items.${entry.id}`)}
      action={
        <span className="rb-insp__actions">
          <IconButton
            label={t('builder.inspector.duplicate')}
            shortcut={`${MOD_KEY} + D`}
            onClick={duplicateSelected}
          >
            <CopyIcon />
          </IconButton>
          <IconButton
            danger
            tipEnd
            shortcut="Del"
            label={t('builder.inspector.remove')}
            onClick={removeSelected}
          >
            <TrashIcon />
          </IconButton>
        </span>
      }
    >
      <div className="rb-insp">
        {colliding && (
          <p className="rb-insp__warn">
            <Pill tone="warn">!</Pill>
            {t('builder.inspector.collision')}
          </p>
        )}

        <div className="rb-insp__grid">
          <Readout label="W" value={`${metres(entry.w)} m`} />
          <Readout label="D" value={`${metres(entry.d)} m`} />
          <Readout label="H" value={`${metres(entry.h)} m`} />
          <Readout label="X" value={`${metres(item.x)} m`} />
          <Readout label="Z" value={`${metres(item.z)} m`} />
          <Readout label="R" value={`${rotationDeg}°`} />
        </div>

        <Stepper
          label={t('builder.inspector.position')}
          unit="X · m"
          decimals={2}
          value={Math.round(item.x * 100) / 100}
          onBegin={snapshot}
          onChange={(value) => moveItem(item.id, value, item.z, false)}
        />
        <Stepper
          label={t('builder.inspector.position')}
          unit="Z · m"
          decimals={2}
          value={Math.round(item.z * 100) / 100}
          onBegin={snapshot}
          onChange={(value) => moveItem(item.id, item.x, value, false)}
        />
        <Stepper
          label={t('builder.inspector.rotation')}
          unit="°"
          step={15}
          value={rotationDeg}
          onBegin={snapshot}
          onChange={(value) => rotateItem(item.id, (value * Math.PI) / 180)}
        />

        <div className="rb-row">
          <span className="rb-row__label">
            <span>{t('builder.inspector.finish')}</span>
            <span>{t(`builder.materials.${item.material}`)}</span>
          </span>
          <Swatches
            value={item.material}
            onPick={(key) => setItemMaterial(item.id, key)}
          />
        </div>

        <div className="rb-row">
          <span className="rb-row__label">
            <span>{t('builder.inspector.price')}</span>
          </span>
          <span className="rb-insp__price">{fmt.full(entry.price)}</span>
        </div>

        <Cta quiet block onClick={duplicateSelected} icon={<CopyIcon />}>
          {t('builder.inspector.duplicate')}
        </Cta>
        <p className="rb-hint">{t('builder.inspector.rotateHint')}</p>
      </div>
    </Panel>
  )
}
