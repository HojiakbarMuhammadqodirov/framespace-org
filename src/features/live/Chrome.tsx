import type { CSSProperties, ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * The chrome that floats over the live view.
 *
 * Two rules the whole screen hangs off:
 *
 * • Every floating cluster is a DOUBLE BEZEL — an outer shell (hairline ring,
 *   `--s2` of padding, ~2rem radius) holding an inner core with its own
 *   background, its own inset top highlight and a concentric radius. It is the
 *   machined-hardware look, and it is also what makes a control legible over a
 *   photograph of somebody's living room.
 *
 * • `backdrop-filter` lives ONLY on these fixed bars. Never on the canvas,
 *   never on the video, never on anything that scrolls.
 *
 * The clusters carry `data-surface="inverse"`, which re-points the semantic
 * tokens at the dark set — so the ink, rings and highlights stay token-only
 * while reading correctly on top of a bright render.
 */

const CSS = `
.fsl-cluster {
  --fsl-scrim: color-mix(in srgb, var(--clay-900) 58%, transparent);
  position: relative;
  padding: var(--s2);
  border-radius: var(--radius-2xl);
  background: var(--bezel-shell);
  box-shadow: inset 0 0 0 1px var(--bezel-ring);
  -webkit-backdrop-filter: blur(18px) saturate(1.1);
  backdrop-filter: blur(18px) saturate(1.1);
  background-color: var(--fsl-scrim);
  color: var(--text);
  transition: transform var(--d-base) var(--ease), opacity var(--d-base) var(--ease);
}
.fsl-cluster__core {
  position: relative;
  border-radius: var(--radius-inner-2xl);
  background: color-mix(in srgb, var(--clay-900) 46%, transparent);
  box-shadow: var(--inset-hi), var(--inset-lo);
  overflow: hidden;
}
.fsl-cluster--sm { border-radius: var(--radius-xl); }
.fsl-cluster--sm > .fsl-cluster__core { border-radius: var(--radius-inner-xl); }
.fsl-cluster--quiet { background-color: color-mix(in srgb, var(--clay-900) 42%, transparent); }
.fsl-cluster--quiet > .fsl-cluster__core { background: transparent; box-shadow: var(--inset-hi); }

.fsl-readout {
  display: inline-grid;
  gap: 2px;
  min-width: 0;
}
.fsl-readout__key {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
  white-space: nowrap;
}
.fsl-readout__value {
  font-family: var(--font-mono);
  font-size: var(--step--1);
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
  color: var(--text-strong);
  white-space: nowrap;
  transition: color var(--d-fast) var(--ease);
}
.fsl-readout[data-tone='ok'] .fsl-readout__value { color: var(--ok); }
.fsl-readout[data-tone='warn'] .fsl-readout__value { color: var(--warn-ink); }
.fsl-readout[data-tone='err'] .fsl-readout__value { color: var(--err); }
.fsl-readout[data-tone='accent'] .fsl-readout__value { color: var(--accent); }

.fsl-icon-btn {
  display: inline-grid;
  place-items: center;
  width: var(--tap);
  height: var(--tap);
  border: 0;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--paper) 10%, transparent);
  box-shadow: inset 0 0 0 1px var(--bezel-ring), var(--inset-hi);
  color: var(--text);
  cursor: pointer;
  transition: transform var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease),
    color var(--d-fast) var(--ease);
}
.fsl-icon-btn:active { transform: scale(0.98); }
.fsl-icon-btn[aria-pressed='true'] {
  background: color-mix(in srgb, var(--accent) 88%, transparent);
  color: var(--paper);
}
.fsl-icon-btn[disabled] { opacity: 0.4; cursor: default; }

.fsl-rule {
  height: 1px;
  background: var(--hairline);
  border: 0;
  margin: 0;
}

@media (prefers-reduced-motion: reduce) {
  .fsl-cluster, .fsl-icon-btn, .fsl-readout__value { transition: none; }
}
`

export function LiveChromeStyles() {
  return (
    <style href="fs-live-chrome" precedence="medium">
      {CSS}
    </style>
  )
}

/* -------------------------------------------------------------- the bezel */

export interface ClusterProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** Smaller radius pair, for single-control pods. */
  small?: boolean
  /** Drops the core's own fill, for clusters that sit over a busy image. */
  quiet?: boolean
  coreStyle?: CSSProperties
  role?: string
  'aria-label'?: string
}

export function Cluster({
  children,
  className,
  style,
  small,
  quiet,
  coreStyle,
  ...rest
}: ClusterProps) {
  return (
    <div
      data-surface="inverse"
      className={cn('fsl-cluster', small && 'fsl-cluster--sm', quiet && 'fsl-cluster--quiet', className)}
      style={style}
      {...rest}
    >
      <div className="fsl-cluster__core" style={coreStyle}>
        {children}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- read-outs */

export type ReadoutTone = 'default' | 'ok' | 'warn' | 'err' | 'accent'

export function Readout({
  label,
  value,
  tone = 'default',
  align = 'start',
}: {
  label: string
  value: string
  tone?: ReadoutTone
  align?: 'start' | 'end' | 'center'
}) {
  return (
    <span className="fsl-readout" data-tone={tone} style={{ justifyItems: align, textAlign: align }}>
      <span className="fsl-readout__key">{label}</span>
      <span className="fsl-readout__value">{value}</span>
    </span>
  )
}

/* --------------------------------------------------------------- buttons */

export function IconButton({
  label,
  onClick,
  pressed,
  disabled,
  children,
}: {
  label: string
  onClick?: () => void
  pressed?: boolean
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="fsl-icon-btn"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/* ----------------------------------------------------------------- glyphs */

export function GlyphBack() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10 3 5 8l5 5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function GlyphGhost() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.7" y="3.2" width="12.6" height="9.6" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.7 10.2 5.4 7l3 2.6 2.4-2 3.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

export function GlyphTarget() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 .9v2.4M8 12.7v2.4M.9 8h2.4M12.7 8h2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" />
    </svg>
  )
}

export function GlyphChevron({ direction = 'left' }: { direction?: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M9.5 4 6 8l3.5 4' : 'M6.5 4 10 8l-3.5 4'}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function GlyphPlay() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M4 2.6 11 7l-7 4.4Z" fill="currentColor" />
    </svg>
  )
}

export function GlyphStop() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="3.4" y="3.4" width="7.2" height="7.2" rx="1.4" fill="currentColor" />
    </svg>
  )
}
