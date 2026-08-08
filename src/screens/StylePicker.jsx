import PageHeader from '../components/PageHeader.jsx'
import { CheckIcon, ChevronIcon } from '../components/Icons.jsx'
import { STYLES, CURRENCIES, formatMoney } from '../lib/styles.js'

const QUICK_BUDGETS = [500, 1500, 3000, 6000]

export default function StylePicker({ project, error, onChange, onBack, onSubmit }) {
  const { style, budget, notes, captures } = project
  const photoCount = Object.keys(captures).length
  const limit = Number(budget.limit) || 0

  function setBudget(patch) {
    onChange({ budget: { ...budget, ...patch } })
  }

  return (
    <div className="screen screen-with-action">
      <PageHeader
        eyebrow={`Step 2 of 2 · ${photoCount} photos ready`}
        title="What should it become?"
        subtitle="Pick the look. The budget is optional — set one and nothing proposed will push you over it."
        onBack={onBack}
      />

      <div className="mx-auto max-w-lg px-5 pt-6">
        <h2 className="eyebrow mb-3">Style</h2>
        <div className="grid grid-cols-2 gap-3">
          {STYLES.map((option) => {
            const selected = style === option.name
            return (
              <button
                key={option.name}
                type="button"
                onClick={() => onChange({ style: option.name })}
                aria-pressed={selected}
                className={`card relative overflow-hidden text-left transition-transform active:scale-[0.98] ${
                  selected ? 'border-clay ring-1 ring-clay' : ''
                }`}
              >
                <div className="flex h-16">
                  {option.swatch.map((hex) => (
                    <div key={hex} className="flex-1" style={{ background: hex }} />
                  ))}
                </div>
                {selected && (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-clay text-white">
                    <CheckIcon width={14} height={14} strokeWidth={2.4} />
                  </span>
                )}
                <div className="p-3">
                  <p className="text-[13.5px] font-semibold leading-tight">{option.name}</p>
                  <p className="mt-1 text-[11.5px] leading-snug text-muted">{option.blurb}</p>
                </div>
              </button>
            )
          })}
        </div>

        <h2 className="eyebrow mb-3 mt-8">
          Furniture budget <span className="normal-case tracking-normal">— optional</span>
        </h2>
        <div className="card p-4">
          <div className="flex gap-2">
            <select
              value={budget.currency}
              onChange={(e) => setBudget({ currency: e.target.value })}
              aria-label="Currency"
              className="field w-[104px] shrink-0 appearance-none"
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="50"
              placeholder="No limit"
              value={budget.limit}
              onChange={(e) => setBudget({ limit: e.target.value })}
              aria-label="Maximum spend"
              className="field flex-1"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_BUDGETS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setBudget({ limit: String(amount) })}
                className={`rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors ${
                  limit === amount
                    ? 'border-clay bg-clay/15 text-cream'
                    : 'border-line text-muted'
                }`}
              >
                {formatMoney(amount, budget.currency)}
              </button>
            ))}
            {limit > 0 && (
              <button
                type="button"
                onClick={() => setBudget({ limit: '' })}
                className="rounded-full border border-line px-3.5 py-1.5 text-[12.5px] text-muted"
              >
                Clear
              </button>
            )}
          </div>

          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            {limit > 0
              ? `Every piece is priced at the average of its normal retail range, and the whole list is kept under ${formatMoney(limit, budget.currency)}.`
              : 'Leave it empty and you still get an honest total — just no ceiling.'}
          </p>
        </div>

        <h2 className="eyebrow mb-3 mt-8">
          Anything else <span className="normal-case tracking-normal">— optional</span>
        </h2>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="It's a home office. I need a desk by the window, and I have a cat."
          className="field resize-none"
        />

        {error && (
          <p className="mt-5 rounded-xl border border-clay/50 bg-clay/10 px-4 py-3 text-[13px] leading-relaxed text-clay-soft">
            {error}
          </p>
        )}

      </div>

      <div className="action-bar">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!style}
            className="btn btn-primary w-full"
          >
            {style ? `Redesign in ${style}` : 'Pick a style first'}
            {style && <ChevronIcon width={18} height={18} />}
          </button>
        </div>
      </div>
    </div>
  )
}
