/**
 * The shared furniture of the capture and result screens.
 *
 * `Bezel` is the double-bezel container the design law asks for everywhere: an
 * outer shell carrying a hairline ring and a 2rem radius, wrapping an inner
 * core with its own surface, a concentric smaller radius and an inset top
 * highlight. Every card, every camera frame and every result panel is one.
 *
 * `ArrowButton` is the button-in-button: the arrow sits in its own 32px circle
 * flush against the right edge, travels diagonally on hover while the button
 * itself presses to 0.98.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { EASE } from '@/design/motion'
import { cn } from '@/lib/cn'

const CSS = `
.cap-shell {
  --cap-sheen: color-mix(in srgb, var(--white) 62%, transparent);
  position: relative;
  background: color-mix(in srgb, var(--bg-sunken) 74%, var(--bg));
  border: 1px solid var(--hairline);
  border-radius: 2rem;
  padding: var(--s2);
}
:root[data-theme='dark'] .cap-shell {
  --cap-sheen: color-mix(in srgb, var(--paper) 9%, transparent);
}
.cap-shell--tight { padding: var(--s1); border-radius: 1.5rem; }
.cap-core {
  position: relative;
  background: var(--bg-raised);
  border-radius: 1.625rem;
  padding: var(--s6);
  box-shadow: inset 0 1px 0 var(--cap-sheen), var(--shadow-card);
  overflow: hidden;
}
.cap-shell--tight > .cap-core { border-radius: 1.25rem; }
@media (max-width: 479px) {
  .cap-shell { padding: 6px; border-radius: 1.625rem; }
  .cap-core { padding: var(--s5); border-radius: 1.25rem; }
}
.cap-core--bare { padding: 0; }
.cap-core--snug { padding: var(--s4); }
.cap-core--sunken { background: var(--bg-sunken); }
.cap-core--ink { background: var(--bg-inverse); color: var(--text-inverse); }

.cap-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  padding: 6px var(--s3);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-raised) 72%, transparent);
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-muted);
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cap-eyebrow__dot {
  width: 5px;
  height: 5px;
  border-radius: var(--radius-full);
  background: var(--accent);
}

.cap-cta {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s5);
  width: 100%;
  min-height: 56px;
  padding: var(--s2) var(--s2) var(--s2) var(--s6);
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  background: var(--accent-ink);
  color: var(--paper);
  font-family: var(--font-ui);
  font-size: var(--step-0);
  font-weight: 600;
  letter-spacing: 0.01em;
  text-align: left;
  cursor: pointer;
  transition: transform var(--d-fast) var(--ease), background-color var(--d-base) var(--ease),
    border-color var(--d-base) var(--ease), opacity var(--d-fast) var(--ease);
}
.cap-cta:active { transform: scale(0.98); }
.cap-cta:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; }
.cap-cta[disabled] { opacity: 0.4; pointer-events: none; }
.cap-cta__arrow {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--paper) 24%, transparent);
  transition: transform var(--d-base) var(--ease), background-color var(--d-base) var(--ease);
}
.cap-cta:hover .cap-cta__arrow,
.cap-cta:focus-visible .cap-cta__arrow {
  transform: translate3d(3px, -3px, 0) scale(1.1);
  background: color-mix(in srgb, var(--paper) 38%, transparent);
}
.cap-cta--quiet {
  background: transparent;
  color: var(--text);
  border-color: var(--border-strong);
}
.cap-cta--quiet .cap-cta__arrow { background: color-mix(in srgb, var(--text-strong) 9%, transparent); }
.cap-cta--quiet:hover .cap-cta__arrow { background: color-mix(in srgb, var(--text-strong) 16%, transparent); }
.cap-cta--auto { width: auto; }

.cap-note {
  display: grid;
  gap: var(--s2);
  padding: var(--s4) var(--s5);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-sunken) 55%, transparent);
}
.cap-note--warn { border-color: color-mix(in srgb, var(--warn) 52%, transparent); }
.cap-note--err { border-color: color-mix(in srgb, var(--err) 45%, transparent); }
.cap-note__title {
  font-size: var(--step--1);
  font-weight: 600;
  color: var(--text-strong);
  letter-spacing: 0.01em;
}
.cap-note__body { font-size: var(--step--1); color: var(--text-muted); }
.cap-note--dismissible { position: relative; padding-right: calc(var(--tap) + var(--s2)); }
.cap-note__close {
  position: absolute;
  top: 0;
  right: 0;
  width: var(--tap);
  height: var(--tap);
  display: grid;
  place-items: center;
  border: 0;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
}
.cap-note__close:focus-visible { color: var(--text-strong); }
@media (hover: hover) and (pointer: fine) {
  .cap-note__close:hover { color: var(--text-strong); }
}

.cap-rail { display: flex; align-items: center; gap: var(--s2); }
.cap-rail__seg {
  flex: 1;
  height: 2px;
  border-radius: var(--radius-full);
  background: var(--hairline);
  transform-origin: left center;
  transition: background-color var(--d-base) var(--ease);
}
.cap-rail__seg[data-on='true'] { background: var(--accent); }
.cap-rail__count {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.16em;
  color: var(--text-muted);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .cap-cta,
  .cap-cta__arrow { transition: none; }
  .cap-cta:hover .cap-cta__arrow { transform: none; }
  .cap-cta:active { transform: none; }
}
`

export function CaptureStyles() {
  return (
    <style href="fs-cap-chrome" precedence="medium">
      {CSS}
    </style>
  )
}

/* ------------------------------------------------------------------ bezel */

export function Bezel({
  children,
  tight,
  bare,
  snug,
  surface,
  className,
  coreClassName,
  style,
  coreStyle,
}: {
  children: ReactNode
  tight?: boolean
  bare?: boolean
  snug?: boolean
  surface?: 'raised' | 'sunken' | 'ink'
  className?: string
  coreClassName?: string
  style?: React.CSSProperties
  coreStyle?: React.CSSProperties
}) {
  return (
    <div className={cn('cap-shell', tight && 'cap-shell--tight', className)} style={style}>
      <div
        className={cn(
          'cap-core',
          bare && 'cap-core--bare',
          snug && 'cap-core--snug',
          surface === 'sunken' && 'cap-core--sunken',
          surface === 'ink' && 'cap-core--ink',
          coreClassName
        )}
        style={coreStyle}
      >
        {children}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- eyebrow */

export function Eyebrow({ children, dot = true }: { children: ReactNode; dot?: boolean }) {
  return (
    <span className="cap-eyebrow">
      {dot && <span className="cap-eyebrow__dot" aria-hidden="true" />}
      {children}
    </span>
  )
}

/* ------------------------------------------------------------ arrow button */

export function ArrowButton({
  children,
  quiet,
  auto,
  glyph = 'arrow',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  quiet?: boolean
  auto?: boolean
  glyph?: 'arrow' | 'back' | 'check' | 'plus'
}) {
  return (
    <button
      type="button"
      className={cn('cap-cta', quiet && 'cap-cta--quiet', auto && 'cap-cta--auto', className)}
      {...rest}
    >
      <span>{children}</span>
      <span className="cap-cta__arrow" aria-hidden="true">
        <Glyph name={glyph} />
      </span>
    </button>
  )
}

function Glyph({ name }: { name: 'arrow' | 'back' | 'check' | 'plus' }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (name === 'back') {
    return (
      <svg {...common}>
        <path d="M10 3 L5 8 L10 13" />
      </svg>
    )
  }
  if (name === 'check') {
    return (
      <svg {...common}>
        <path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" />
      </svg>
    )
  }
  if (name === 'plus') {
    return (
      <svg {...common}>
        <path d="M8 3.5 V12.5 M3.5 8 H12.5" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M3.5 8 H12" />
      <path d="M8.5 4.5 L12 8 L8.5 11.5" />
    </svg>
  )
}

/* ----------------------------------------------------------------- notice */

export function Notice({
  tone = 'plain',
  title,
  children,
  action,
  onDismiss,
  dismissLabel,
}: {
  tone?: 'plain' | 'warn' | 'err'
  title: ReactNode
  children?: ReactNode
  action?: ReactNode
  /** Renders a close button in the corner. */
  onDismiss?: () => void
  dismissLabel?: string
}) {
  return (
    <div
      className={cn(
        'cap-note',
        tone === 'warn' && 'cap-note--warn',
        tone === 'err' && 'cap-note--err',
        onDismiss && 'cap-note--dismissible'
      )}
      role={tone === 'err' ? 'alert' : undefined}
    >
      <span className="cap-note__title">{title}</span>
      {children && <span className="cap-note__body">{children}</span>}
      {action}
      {onDismiss && (
        <button type="button" className="cap-note__close" onClick={onDismiss} aria-label={dismissLabel}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M4 4 L12 12 M12 4 L4 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------- rail */

export function StepRail({
  total,
  current,
  label,
  valueText,
}: {
  total: number
  current: number
  label?: string
  /** What a screen reader announces; defaults to the visible label. */
  valueText?: string
}) {
  return (
    <div
      className="cap-rail"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={Math.min(total, Math.max(0, current))}
      aria-valuetext={valueText || label}
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="cap-rail__seg" data-on={i < current} />
      ))}
      {label && <span className="cap-rail__count">{label}</span>}
    </div>
  )
}

/* ------------------------------------------------------------------- rise */

/**
 * Scroll entry, brief §3: opacity 0 and y 16 resolving over ~700ms. No blur:
 * an animated `filter` repaints every frame, which low-end phones feel.
 * `whileInView` rather than a scroll listener, and flat under reduced motion.
 */
export function Rise({
  children,
  delay = 0,
  className,
  style,
}: {
  children: ReactNode
  delay?: number
  className?: string
  style?: React.CSSProperties
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      style={style}
      // Plays on mount, not on scroll-into-view: a viewport trigger left whole
      // steps at low opacity when the observer fired late (or not at all).
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.36, ease: EASE, delay: reduced ? 0 : Math.min(delay, 0.08) }}
    >
      {children}
    </motion.div>
  )
}
