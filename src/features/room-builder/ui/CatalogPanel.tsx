import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CATALOG, CATALOG_GROUPS, MATERIAL_HEX, type CatalogEntry, type CatalogGroup } from '../catalog'
import { metres, useMoneyFormat } from '../format'
import { useBuilder } from '../store'
import { Panel } from './chrome'
import { PieceThumb } from './thumbs'

/**
 * The catalogue. Drag a piece into the room, or tap it — touch has no HTML5
 * drag, and a catalogue you cannot use on a phone is not a catalogue.
 *
 * Each card carries a small drawing of the piece in its default finish, its
 * real footprint and its price, plus a count of how many are already placed.
 */

const CSS = `
.rb-cat { display: grid; gap: var(--s4); }
.rb-cat__search {
  position: relative;
  display: flex;
  align-items: center;
}
.rb-cat__search svg { position: absolute; left: 14px; color: var(--text-muted); pointer-events: none; }
.rb-cat__input {
  width: 100%;
  min-height: var(--tap);
  padding: 0 var(--s4) 0 40px;
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  color: var(--text-strong);
  font: inherit;
  font-size: 16px;
}
.rb-cat__input::placeholder { color: var(--text-muted); }
.rb-cat__input:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
.rb-cat__filters {
  display: flex;
  gap: var(--s2);
  overflow-x: auto;
  scrollbar-width: none;
  margin-inline: calc(var(--s1) * -1);
  padding: 2px var(--s1);
}
.rb-cat__filters::-webkit-scrollbar { display: none; }
.rb-cat__filter {
  flex: 0 0 auto;
  min-height: 34px;
  padding-inline: var(--s4);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-ui);
  font-size: var(--step--1);
  cursor: pointer;
  transition: color var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease);
}
.rb-cat__filter[aria-pressed='true'] {
  background: var(--text-strong);
  border-color: var(--text-strong);
  color: var(--bg-raised);
}
.rb-cat__list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--s2);
}
.rb-cat__card {
  position: relative;
  display: grid;
  gap: var(--s2);
  padding: var(--s2) var(--s2) var(--s3);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-xl);
  background: var(--bg-sunken);
  text-align: left;
  color: var(--text);
  cursor: grab;
  transition: transform var(--d-fast) var(--ease), border-color var(--d-fast) var(--ease),
    box-shadow var(--d-base) var(--ease), background-color var(--d-fast) var(--ease);
}
.rb-cat__card:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.rb-cat__card:active { transform: scale(0.97); cursor: grabbing; }
@media (hover: hover) and (pointer: fine) {
  .rb-cat__card:hover {
    border-color: var(--border-strong);
    background: var(--bg-raised);
    box-shadow: var(--shadow-ambient);
    transform: translateY(-1px);
  }
  .rb-cat__card:hover .rb-cat__add { opacity: 1; transform: none; }
}
.rb-cat__thumb {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 16 / 10;
  border-radius: calc(var(--radius-xl) - 4px);
  background:
    radial-gradient(120% 90% at 50% 100%, color-mix(in srgb, var(--text-strong) 7%, transparent), transparent 60%),
    linear-gradient(180deg, var(--bg-raised), color-mix(in srgb, var(--bg-sunken) 60%, var(--bg-raised)));
  box-shadow: inset 0 0 0 1px var(--hairline);
  overflow: hidden;
}
.rb-cat__thumb svg { width: 82%; height: 82%; }
.rb-cat__add {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-full);
  background: var(--accent-ink);
  color: var(--paper);
  opacity: 0;
  transform: scale(0.8);
  transition: opacity var(--d-fast) var(--ease), transform var(--d-fast) var(--ease);
}
@media (hover: none) { .rb-cat__add { opacity: 1; transform: none; } }
.rb-cat__count {
  position: absolute;
  top: 6px;
  left: 6px;
  min-width: 22px;
  height: 22px;
  padding-inline: 6px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-full);
  background: var(--text-strong);
  color: var(--bg-raised);
  font-family: var(--font-mono);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.rb-cat__name {
  padding-inline: var(--s1);
  font-size: var(--step--1);
  line-height: 1.25;
  color: var(--text-strong);
}
.rb-cat__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 2px var(--s2);
  padding-inline: var(--s1);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.rb-cat__price { color: var(--text); }
.rb-cat__empty { margin: 0; padding: var(--s5) 0; text-align: center; color: var(--text-muted); font-size: var(--step--1); }
.rb-cat__name { font-weight: 500; }
.rb-cat__filter:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
/* Desktop with a mouse: same 8px-grid density as the rest of the editor. */
@media (min-width: 1024px) and (pointer: fine) {
  .rb-cat { gap: var(--s3); }
  .rb-cat__input { min-height: 36px; font-size: var(--step--1); padding-left: 36px; }
  .rb-cat__search svg { left: 12px; }
  .rb-cat__filter { min-height: 28px; padding-inline: var(--s3); font-size: 12px; }
  .rb-cat__name { font-size: 12px; }
}
@media (min-width: 640px) and (max-width: 1023px) {
  .rb-cat__list { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
`

export function CatalogStyles() {
  return (
    <style href="fs-builder-catalog" precedence="medium">
      {CSS}
    </style>
  )
}

export function CatalogPanel() {
  const { t } = useTranslation()
  const fmt = useMoneyFormat()
  const addItem = useBuilder((s) => s.addItem)
  const items = useBuilder((s) => s.scene.items)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<CatalogGroup | 'all'>('all')

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    items.forEach((item) => map.set(item.catalogId, (map.get(item.catalogId) ?? 0) + 1))
    return map
  }, [items])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CATALOG.filter((entry) => {
      if (group !== 'all' && entry.group !== group) return false
      if (!q) return true
      const name = t(`builder.catalog.items.${entry.id}`).toLowerCase()
      return name.includes(q) || t(`builder.catalog.groups.${entry.group}`).toLowerCase().includes(q)
    })
  }, [group, query, t])

  return (
    <Panel title={t('builder.catalog.title')}>
      <div className="rb-cat">
        <label className="rb-cat__search">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.3" />
            <path d="m10.6 10.6 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            className="rb-cat__input"
            type="search"
            value={query}
            placeholder={t('builder.editor.search')}
            aria-label={t('builder.editor.search')}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="rb-cat__filters" role="group" aria-label={t('builder.catalog.title')}>
          {(['all', ...CATALOG_GROUPS] as const).map((key) => (
            <button
              key={key}
              type="button"
              className="rb-cat__filter"
              aria-pressed={group === key}
              onClick={() => setGroup(key)}
            >
              {key === 'all' ? t('builder.editor.all') : t(`builder.catalog.groups.${key}`)}
            </button>
          ))}
        </div>

        {visible.length ? (
          <div className="rb-cat__list">
            {visible.map((entry) => (
              <CatalogCard
                key={entry.id}
                entry={entry}
                count={counts.get(entry.id) ?? 0}
                name={t(`builder.catalog.items.${entry.id}`)}
                price={fmt.full(entry.price)}
                onAdd={() => addItem(entry.id)}
                aria={t('builder.editor.addAria', { name: t(`builder.catalog.items.${entry.id}`) })}
              />
            ))}
          </div>
        ) : (
          <p className="rb-cat__empty">{t('builder.editor.noResults')}</p>
        )}
      </div>
      <p className="rb-hint">{t('builder.catalog.hint')}</p>
    </Panel>
  )
}

function CatalogCard({
  entry,
  count,
  name,
  price,
  aria,
  onAdd,
}: {
  entry: CatalogEntry
  count: number
  name: string
  price: string
  aria: string
  onAdd: () => void
}) {
  return (
    <button
      type="button"
      className="rb-cat__card"
      draggable
      aria-label={aria}
      onDragStart={(event) => {
        event.dataTransfer.setData('application/x-framespace-item', entry.id)
        event.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={onAdd}
    >
      <span className="rb-cat__thumb" aria-hidden="true">
        <PieceThumb kind={entry.kind} color={MATERIAL_HEX[entry.material]} />
        {count > 0 && <span className="rb-cat__count">{count}</span>}
        <span className="rb-cat__add">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </span>
      <span className="rb-cat__name">{name}</span>
      <span className="rb-cat__meta">
        <span>
          {metres(entry.w)}×{metres(entry.d)} m
        </span>
        <span className="rb-cat__price">{price}</span>
      </span>
    </button>
  )
}
