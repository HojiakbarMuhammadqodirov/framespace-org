import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { CubeIcon, RetryIcon, CheckIcon } from '../components/Icons.jsx'
import { formatMoney } from '../lib/styles.js'

function Renders({ renders }) {
  const [index, setIndex] = useState(0)
  const active = renders[index]

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border border-line bg-ink-2">
        <img
          key={active.angleId}
          src={active.image}
          alt={`${active.angleLabel} restyled`}
          className="rise block aspect-[4/3] w-full object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/90 to-transparent px-4 pb-3 pt-10">
          <p className="text-[13px] font-semibold">{active.angleLabel}</p>
          <p className="text-[11px] text-muted">
            {index + 1} of {renders.length}
          </p>
        </div>
      </div>

      {renders.length > 1 && (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {renders.map((render, i) => (
            <button
              key={render.angleId}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={render.angleLabel}
              className={`h-16 w-20 shrink-0 overflow-hidden rounded-xl border transition-colors ${
                i === index ? 'border-clay' : 'border-line opacity-60'
              }`}
            >
              <img src={render.image} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FurnitureList({ furniture, currency }) {
  return (
    <ul className="divide-y divide-line">
      {furniture.map((item, i) => (
        <li key={`${item.name}-${i}`} className="flex gap-3 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium leading-snug">
              {item.name}
              {item.quantity > 1 && <span className="text-muted"> ×{item.quantity}</span>}
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{item.description}</p>
            <p className="mt-1 text-[11.5px] text-muted/80">{item.placement}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[14px] font-semibold tabular-nums">
              {formatMoney(item.averagePrice * item.quantity, currency)}
            </p>
            <p className="mt-0.5 text-[11px] tabular-nums text-muted">
              {formatMoney(item.typicalPriceLow, currency)}–{formatMoney(item.typicalPriceHigh, currency)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function Result({ result, onBack, onOpen3D, onStartOver }) {
  if (!result) return null
  const { brief, renders = [], failures = [], archived } = result
  const { design, room, furniture = [], budget } = brief
  const currency = budget?.currency || 'USD'

  return (
    <div className="screen">
      <PageHeader
        eyebrow={archived ? 'From your archive' : 'Your redesign'}
        title={design?.styleName || result.style}
        subtitle={design?.summary}
        onBack={onBack}
      />

      <div className="mx-auto max-w-lg px-5 pt-5">
        <Renders renders={renders} />

        {failures.length > 0 && (
          <p className="mt-3 rounded-xl border border-line bg-ink-2 px-4 py-3 text-[12.5px] leading-relaxed text-muted">
            {failures.length} angle{failures.length > 1 ? 's' : ''} could not be rendered and{' '}
            {failures.length > 1 ? 'were' : 'was'} left out.
          </p>
        )}

        <button type="button" onClick={onOpen3D} className="btn btn-primary mt-4 w-full">
          <CubeIcon width={19} height={19} />
          View in 3D
        </button>

        {/* Budget */}
        <section className="card mt-6 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="eyebrow">Furniture total</h2>
            {budget?.limit > 0 && (
              <span
                className={`flex items-center gap-1 text-[11.5px] font-semibold ${
                  budget.withinBudget ? 'text-sage' : 'text-clay-soft'
                }`}
              >
                {budget.withinBudget && <CheckIcon width={13} height={13} strokeWidth={2.4} />}
                {budget.withinBudget ? 'Within budget' : 'Over budget'}
              </span>
            )}
          </div>
          <p className="display mt-2 text-[34px] tabular-nums">
            {formatMoney(budget?.estimatedTotal ?? 0, currency)}
          </p>
          {budget?.limit > 0 && (
            <>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-3">
                <div
                  className={`h-full rounded-full ${budget.withinBudget ? 'bg-sage' : 'bg-clay'}`}
                  style={{
                    width: `${Math.min(100, ((budget.estimatedTotal || 0) / budget.limit) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-[12px] text-muted">
                of {formatMoney(budget.limit, currency)} ceiling
              </p>
            </>
          )}
          {budget?.notes && (
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{budget.notes}</p>
          )}
        </section>

        {/* Palette */}
        {design?.palette?.length > 0 && (
          <section className="mt-6">
            <h2 className="eyebrow mb-3">Palette</h2>
            <div className="card overflow-hidden">
              <div className="flex h-14">
                {design.palette.map((c) => (
                  <div key={`${c.hex}-${c.name}`} className="flex-1" style={{ background: c.hex }} />
                ))}
              </div>
              <ul className="divide-y divide-line px-4">
                {design.palette.map((c) => (
                  <li
                    key={`${c.name}-${c.usage}`}
                    className="flex items-center gap-3 py-2.5 text-[12.5px]"
                  >
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border border-line"
                      style={{ background: c.hex }}
                    />
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-auto text-right text-muted">{c.usage}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Shopping list */}
        <section className="mt-6">
          <h2 className="eyebrow mb-3">What to buy</h2>
          <div className="card px-4">
            <FurnitureList furniture={furniture} currency={currency} />
          </div>
          <p className="mt-2 px-1 text-[11.5px] leading-relaxed text-muted">
            Prices are the midpoint of each category's typical retail range, not live listings —
            treat them as a planning figure.
          </p>
        </section>

        {/* The room as it is */}
        {room && (
          <section className="mt-6">
            <h2 className="eyebrow mb-3">What the AI saw</h2>
            <div className="card space-y-3 p-5 text-[13px] leading-relaxed">
              <p>
                <span className="text-muted">Roughly </span>
                <span className="font-semibold tabular-nums">
                  {room.estimatedWidthM}m × {room.estimatedDepthM}m
                </span>
                <span className="text-muted">, ceiling </span>
                <span className="font-semibold tabular-nums">{room.estimatedHeightM}m</span>
                <span className="text-muted"> — {room.confidence} confidence.</span>
              </p>
              {room.existingFeatures?.length > 0 && (
                <div>
                  <p className="text-muted">Kept exactly as they are:</p>
                  <ul className="mt-1.5 space-y-1">
                    {room.existingFeatures.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-clay" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {room.lightingNotes && <p className="text-muted">{room.lightingNotes}</p>}
            </div>
          </section>
        )}

        {design?.materials?.length > 0 && (
          <section className="mt-6">
            <h2 className="eyebrow mb-3">Materials &amp; light</h2>
            <div className="card p-5">
              <div className="flex flex-wrap gap-2">
                {design.materials.map((m) => (
                  <span
                    key={m}
                    className="rounded-full border border-line px-3 py-1.5 text-[12px] text-muted"
                  >
                    {m}
                  </span>
                ))}
              </div>
              {design.lighting && (
                <p className="mt-3 text-[13px] leading-relaxed text-muted">{design.lighting}</p>
              )}
            </div>
          </section>
        )}

        <button type="button" onClick={onStartOver} className="btn btn-ghost mt-8 w-full">
          <RetryIcon width={18} height={18} />
          Scan another room
        </button>
      </div>
    </div>
  )
}
