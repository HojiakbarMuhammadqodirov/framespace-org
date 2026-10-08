import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

/**
 * The editor's hardware.
 *
 * Every panel is a double bezel: an outer shell with a hairline ring and a
 * couple of millimetres of padding, wrapping an inner core with its own
 * surface and an inset top highlight. It is the same construction as a machined
 * tray holding a glass plate, and it is what stops a tool palette reading like
 * a bootstrap card.
 *
 * Tokens only — there is not a hex in this file.
 */

const CSS = `
.rb-panel {
  background: var(--bezel-shell);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-2xl);
  padding: var(--bezel-pad);
  box-shadow: var(--shadow-ambient);
}
.rb-panel__core {
  background: var(--bg-raised);
  border-radius: var(--radius-inner-2xl);
  box-shadow: var(--inset-hi), var(--inset-lo);
  padding: var(--s5);
  display: grid;
  gap: var(--s4);
}
.rb-panel { min-width: 0; }
.rb-panel__core { min-width: 0; }
.rb-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  min-height: 26px;
  min-width: 0;
}
.rb-panel__headText { display: grid; gap: var(--s2); min-width: 0; justify-items: start; }
.rb-panel__head > :last-child:not(.rb-panel__headText) { flex: 0 0 auto; }
.rb-panel__title {
  font-family: var(--font-display);
  font-size: var(--step-1);
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--text-strong);
  margin: 0;
  overflow-wrap: anywhere;
}

/* ---- eyebrow pill ------------------------------------------------------ */
.rb-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  height: 24px;
  padding-inline: var(--s3);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-raised) 72%, transparent);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
  white-space: nowrap;
}
.rb-pill::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: var(--radius-full);
  background: var(--accent);
}
.rb-pill--quiet::before { background: var(--text-muted); }
.rb-pill--warn::before { background: var(--warn); }

/* ---- mono readouts ----------------------------------------------------- */
.rb-readout {
  display: inline-flex;
  align-items: baseline;
  gap: var(--s2);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.08em;
}
.rb-readout__k { color: var(--text-muted); text-transform: uppercase; }
.rb-readout__v { color: var(--text-strong); font-variant-numeric: tabular-nums; }
.rb-readout--warn .rb-readout__v { color: var(--warn-ink); }

/* ---- segmented --------------------------------------------------------- */
.rb-seg {
  display: inline-flex;
  gap: 2px;
  max-width: 100%;
  min-width: 0;
  padding: 3px;
  background: var(--bezel-shell);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-full);
}
/* Block segments share the panel's width equally and never push past it:
   each cell may shrink to zero and its label wraps instead of overflowing.
   Four or more options fold into a 2 x n grid so labels stay on one line. */
.rb-seg--block {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  width: 100%;
  border-radius: var(--radius-lg);
}
.rb-seg--grid {
  grid-auto-flow: row;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.rb-seg--block .rb-seg__btn {
  min-width: 0;
  padding-inline: var(--s2);
  border-radius: calc(var(--radius-lg) - 4px);
  white-space: normal;
  line-height: 1.15;
  overflow-wrap: anywhere;
  text-wrap: balance;
}
.rb-seg__btn {
  min-height: 40px;
  padding-inline: var(--s4);
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-ui);
  font-size: var(--step--1);
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease),
    transform var(--d-fast) var(--ease);
}
.rb-seg__btn:active { transform: scale(0.98); }
.rb-seg__btn[aria-pressed='true'] {
  background: var(--bg-raised);
  color: var(--text-strong);
  font-weight: 600;
  box-shadow: var(--inset-hi), 0 0 0 1px var(--bezel-ring), var(--shadow-ambient);
}
.rb-seg__btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }

/* ---- icon button ------------------------------------------------------- */
.rb-icon {
  display: grid;
  place-items: center;
  width: var(--tap);
  height: var(--tap);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-full);
  background: var(--bg-raised);
  color: var(--text);
  box-shadow: var(--inset-hi);
  cursor: pointer;
  transition: transform var(--d-fast) var(--ease), color var(--d-fast) var(--ease),
    border-color var(--d-fast) var(--ease);
}
.rb-icon:active { transform: scale(0.98); }
.rb-icon[disabled] { opacity: 0.38; cursor: default; }
.rb-icon:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.rb-icon[aria-pressed='true'] {
  background: var(--text-strong);
  border-color: var(--text-strong);
  color: var(--bg);
}

/* ---- tooltip with shortcut (mouse only) -------------------------------- */
.rb-icon[data-tip] { position: relative; }
@media (hover: hover) and (pointer: fine) {
  .rb-icon[data-tip]::after {
    content: attr(data-tip);
    position: absolute;
    z-index: 30;
    top: calc(100% + 8px);
    left: 50%;
    transform: translate(-50%, -3px);
    padding: 5px 8px;
    border-radius: var(--radius);
    background: var(--bg-inverse);
    color: var(--text-inverse);
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 500;
    line-height: 1.2;
    letter-spacing: 0;
    white-space: nowrap;
    box-shadow: var(--shadow-ambient);
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--d-fast) var(--ease), transform var(--d-fast) var(--ease);
  }
  .rb-icon[data-kbd]::after { content: attr(data-tip) '   ' attr(data-kbd); white-space: pre; }
  .rb-icon[data-tip-end]::after { left: auto; right: 0; transform: translateY(-3px); }
  .rb-icon[data-tip]:hover::after,
  .rb-icon[data-tip]:focus-visible::after {
    opacity: 1;
    transform: translate(-50%, 0);
    transition-delay: 300ms;
  }
  .rb-icon[data-tip-end]:hover::after,
  .rb-icon[data-tip-end]:focus-visible::after { transform: none; }
  .rb-icon[disabled]::after { display: none; }
}

/* ---- primary CTA, button-in-button ------------------------------------- */
.rb-cta {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s5);
  min-height: var(--tap);
  padding: 4px 4px 4px var(--s6);
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  background: var(--accent-ink);
  color: var(--paper);
  font-family: var(--font-ui);
  font-size: var(--step--1);
  font-weight: 500;
  cursor: pointer;
  box-shadow: var(--shadow-ambient);
  transition: transform var(--d-fast) var(--ease), box-shadow var(--d-base) var(--ease);
}
.rb-cta:active { transform: scale(0.98); }
.rb-cta--block { display: flex; width: 100%; }
.rb-cta--quiet {
  background: var(--bg-raised);
  color: var(--text-strong);
  border-color: var(--bezel-ring);
  box-shadow: var(--inset-hi);
}
.rb-cta__well {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--paper) 18%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--paper) 26%, transparent);
  transition: transform var(--d-base) var(--ease);
}
.rb-cta--quiet .rb-cta__well {
  background: var(--bezel-shell);
  box-shadow: inset 0 0 0 1px var(--bezel-ring);
}

/* ---- stepper field ----------------------------------------------------- */
.rb-step {
  display: grid;
  grid-template-columns: var(--tap) minmax(0, 1fr) var(--tap);
  align-items: stretch;
  gap: 2px;
  padding: 3px;
  background: var(--bezel-shell);
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-full);
}
.rb-step__btn {
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--step-0);
  line-height: 1;
  cursor: pointer;
  transition: color var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease),
    transform var(--d-fast) var(--ease);
}
.rb-step__btn:active { transform: scale(0.98); }
.rb-step__btn[disabled] { opacity: 0.32; cursor: default; }
.rb-step__input {
  min-width: 0;
  min-height: 38px;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--bg-raised);
  box-shadow: var(--inset-hi);
  color: var(--text-strong);
  font-family: var(--font-mono);
  font-size: 16px; /* 16px stops iOS zooming the whole editor on focus */
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.rb-step__input:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }

.rb-row { display: grid; gap: var(--s2); }
.rb-row__label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s3);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.rb-hint {
  font-size: var(--step--1);
  line-height: 1.45;
  color: var(--text-muted);
  margin: 0;
}
.rb-swatches { display: flex; flex-wrap: wrap; gap: var(--s2); }
.rb-swatch {
  width: var(--tap);
  height: var(--tap);
  padding: 4px;
  border: 1px solid var(--bezel-ring);
  border-radius: var(--radius-full);
  background: var(--bezel-shell);
  cursor: pointer;
  transition: transform var(--d-fast) var(--ease), border-color var(--d-fast) var(--ease);
}
.rb-swatch:active { transform: scale(0.98); }
.rb-swatch[aria-pressed='true'] { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.rb-swatch:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
/* Hover is a mouse affordance; on touch it sticks after a tap and lies. */
@media (hover: hover) and (pointer: fine) {
  .rb-seg__btn:hover { color: var(--text); }
  .rb-icon:hover { color: var(--text-strong); border-color: var(--border-strong); }
  .rb-icon--danger:hover { color: var(--err); border-color: var(--err); }
  .rb-cta:hover { box-shadow: var(--shadow-raised); }
  .rb-cta:hover .rb-cta__well { transform: translate(2px, -2px) scale(1.06); }
  .rb-step__btn:hover { color: var(--text-strong); background: var(--bg-raised); }
}
/* Desktop with a mouse: pro-tool density on an 8px grid. Touch keeps 44px. */
@media (min-width: 1024px) and (pointer: fine) {
  .rb-panel__core { padding: var(--s4); gap: var(--s3); }
  .rb-panel__title { font-size: var(--step-0); }
  .rb-icon { width: 32px; height: 32px; }
  .rb-seg { padding: 2px; }
  .rb-seg__btn { min-height: 32px; padding-inline: var(--s3); font-size: 12px; }
  .rb-seg--block .rb-seg__btn { padding-inline: var(--s2); }
  .rb-step { grid-template-columns: 32px minmax(0, 1fr) 32px; padding: 2px; }
  .rb-step__input { min-height: 30px; font-size: var(--step--1); }
  .rb-swatch { width: 32px; height: 32px; padding: 3px; }
  .rb-cta { min-height: 40px; padding-left: var(--s5); gap: var(--s4); }
  .rb-cta__well { width: 32px; height: 32px; }
  .rb-row { gap: var(--s1); }
  .rb-hint { font-size: 12px; }
}
.rb-swatch__dot {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: var(--radius-full);
  box-shadow: inset 0 0 0 1px var(--bezel-ring);
}
`

/** One hoisted sheet for the whole hardware kit. */
export function ChromeStyles() {
  return (
    <style href="fs-builder-chrome" precedence="medium">
      {CSS}
    </style>
  )
}

export function Pill({
  children,
  tone = 'accent',
}: {
  children: ReactNode
  tone?: 'accent' | 'quiet' | 'warn'
}) {
  return <span className={`rb-pill${tone === 'accent' ? '' : ` rb-pill--${tone}`}`}>{children}</span>
}

export function Readout({
  label,
  value,
  warn,
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <span className={warn ? 'rb-readout rb-readout--warn' : 'rb-readout'}>
      <span className="rb-readout__k">{label}</span>
      <span className="rb-readout__v">{value}</span>
    </span>
  )
}

export function Panel({
  eyebrow,
  title,
  action,
  children,
  id,
}: {
  eyebrow?: string
  title?: string
  action?: ReactNode
  children: ReactNode
  id?: string
}) {
  return (
    <section className="rb-panel" id={id}>
      <div className="rb-panel__core">
        {(eyebrow || title || action) && (
          <header className="rb-panel__head">
            <div className="rb-panel__headText">
              {eyebrow && <Pill>{eyebrow}</Pill>}
              {title && <h2 className="rb-panel__title">{title}</h2>}
            </div>
            {action}
          </header>
        )}
        {children}
      </div>
    </section>
  )
}

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  block,
  label,
}: {
  options: Array<SegmentOption<T>>
  value: T
  onChange: (value: T) => void
  block?: boolean
  label?: string
}) {
  return (
    <div
      className={
        block
          ? options.length > 3
            ? 'rb-seg rb-seg--block rb-seg--grid'
            : 'rb-seg rb-seg--block'
          : 'rb-seg'
      }
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="rb-seg__btn"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** The platform's command key, for tooltips and the shortcuts card. */
export const MOD_KEY =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
    ? '⌘'
    : 'Ctrl'

/** `Ctrl + Shift + Z` -> `Control+Shift+Z`, for `aria-keyshortcuts`. */
function ariaKeys(shortcut: string): string {
  return shortcut
    .split('+')
    .map((part) => part.trim())
    .map((part) =>
      part === 'Ctrl' ? 'Control' : part === '⌘' ? 'Meta' : part === '⇧' ? 'Shift' : part
    )
    .join('+')
}

/**
 * Round tool button. The label doubles as a tooltip (mouse only, after a short
 * delay) with the keyboard shortcut beside it, the way pro editors teach keys.
 */
export function IconButton({
  label,
  danger,
  shortcut,
  tipEnd,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  danger?: boolean
  /** Shown in the tooltip and exposed as `aria-keyshortcuts`. */
  shortcut?: string
  /** Anchor the tooltip to the button's end edge (buttons at a right edge). */
  tipEnd?: boolean
}) {
  return (
    <button
      type="button"
      className={danger ? 'rb-icon rb-icon--danger' : 'rb-icon'}
      aria-label={label}
      data-tip={label}
      data-kbd={shortcut}
      data-tip-end={tipEnd ? '' : undefined}
      aria-keyshortcuts={shortcut ? ariaKeys(shortcut) : undefined}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Primary CTA with the trailing icon seated in its own well. */
export function Cta({
  children,
  icon,
  quiet,
  block,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode
  quiet?: boolean
  block?: boolean
}) {
  return (
    <button
      type="button"
      className={`rb-cta${quiet ? ' rb-cta--quiet' : ''}${block ? ' rb-cta--block' : ''}`}
      {...rest}
    >
      <span>{children}</span>
      <span className="rb-cta__well" aria-hidden="true">
        {icon ?? (
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path
              d="M3 11 11 3M5 3h6v6"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </button>
  )
}

/** Machined number field: two 44px targets and a tabular readout between them.
 *
 * The field keeps its own draft while focused, so typing "12" into a width
 * whose minimum is 2 does not get clamped to "2" after the first keystroke.
 * The value is committed on Enter, on blur, and live whenever the draft is
 * already a valid in-range number. Escape abandons the draft.
 */
export function Stepper({
  label,
  unit,
  value,
  step = 0.1,
  min,
  max,
  decimals,
  onChange,
  onBegin,
}: {
  label: string
  unit?: string
  value: number
  step?: number
  min?: number
  max?: number
  /** Digits shown after the point. Defaults from `step`. */
  decimals?: number
  onChange: (value: number) => void
  /** Called once as an edit starts, so the whole edit is a single undo step. */
  onBegin?: () => void
}) {
  const places = decimals ?? (step >= 1 ? 0 : step >= 0.1 ? 1 : 2)
  const shown = formatStep(value, places)
  const [draft, setDraft] = useState<string | null>(null)
  const id = useId()

  const limit = (next: number) => {
    let out = next
    if (min !== undefined) out = Math.max(min, out)
    if (max !== undefined) out = Math.min(max, out)
    return Math.round(out * 1000) / 1000
  }
  const parse = (text: string) => Number(text.replace(',', '.').trim())

  const bump = (delta: number) => {
    onBegin?.()
    setDraft(null)
    onChange(limit(value + delta))
  }

  const commit = () => {
    if (draft === null) return
    const next = parse(draft)
    setDraft(null)
    if (draft.trim() !== '' && Number.isFinite(next)) onChange(limit(next))
  }

  const atMin = min !== undefined && value <= min + 1e-9
  const atMax = max !== undefined && value >= max - 1e-9

  return (
    <div className="rb-row">
      <label className="rb-row__label" htmlFor={id}>
        <span>{label}</span>
        {unit && <span>{unit}</span>}
      </label>
      <div className="rb-step">
        <button
          type="button"
          className="rb-step__btn"
          onClick={() => bump(-step)}
          disabled={atMin}
          aria-label={`${label} −`}
        >
          −
        </button>
        <input
          id={id}
          className="rb-step__input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={draft ?? shown}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          onFocus={(event) => {
            onBegin?.()
            setDraft(shown)
            event.currentTarget.select()
          }}
          onBlur={commit}
          onChange={(event) => {
            const text = event.target.value
            setDraft(text)
            const next = parse(text)
            // Live update only when the draft is already a sane final value.
            const ok =
              text.trim() !== '' &&
              Number.isFinite(next) &&
              (min === undefined || next >= min) &&
              (max === undefined || next <= max)
            if (ok) onChange(Math.round(next * 1000) / 1000)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commit()
              event.currentTarget.blur()
            } else if (event.key === 'Escape') {
              setDraft(null)
              event.currentTarget.blur()
            } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault()
              bump(event.key === 'ArrowUp' ? step : -step)
            }
          }}
        />
        <button
          type="button"
          className="rb-step__btn"
          onClick={() => bump(step)}
          disabled={atMax}
          aria-label={`${label} +`}
        >
          +
        </button>
      </div>
    </div>
  )
}

function formatStep(value: number, places: number): string {
  if (!Number.isFinite(value)) return ''
  return (Math.round(value * 10 ** places) / 10 ** places).toFixed(places)
}
