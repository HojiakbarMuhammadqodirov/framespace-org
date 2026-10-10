import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

import { EASE } from '@/design/motion'
import { TextReveal } from '@/ui/TextReveal'
import { Tilt } from '@/ui/Interactive'
import { Seo } from '@/lib/seo'
import { cn } from '@/lib/cn'
import { GUEST_FREE_GENERATIONS, useSession } from '@/store/session'
import { useRenderAllowance } from '@/lib/useRenderAllowance'
import { useDateFormat } from '@/features/capture/hooks'
import { listRecords } from '@/features/capture/store'
import { useMoneyIn } from '@/features/capture/money'
import {
  ROOM_TYPES,
  PROJECT_STATUSES,
  seedOf,
  useProjects,
  type Project,
  type ProjectStatus,
  type RoomType,
} from '@/store/projects'

/**
 * /app — the dashboard.
 *
 * Greeting, one large "new project" action, a credits meter, filters, and an
 * asymmetric bento of project cards. Nothing in here is three equal cards in a
 * row: the bento cycles wide / narrow / narrow / wide / half / half, and the
 * cover's aspect ratio changes with the cell so the rhythm is visible.
 *
 * Covers are drawn, not photographed. There are no image assets in this repo
 * and none are wanted — `FloorPlan` below is a seeded blueprint, so a project
 * always gets the same plan back.
 *
 * This file also owns the app-shell primitives (bezel, eyebrow pill, the
 * button-in-button CTA, the blurred scroll entry) that Saved and Settings
 * import, so the three /app screens speak one language.
 */

/* ------------------------------------------------------------------ motion */

/** Fade up WITH a blur, ~700ms, via whileInView — never a scroll listener. */
export function RevealBlur({
  children,
  className,
  delay = 0,
  as = 'div',
  layout,
  layoutId,
}: {
  children: ReactNode
  className?: string
  delay?: number
  as?: 'div' | 'li'
  /** Opt in to framer's `layout` reflow — for grids that re-sort/re-filter. */
  layout?: boolean
  layoutId?: string
}) {
  const reduced = useReducedMotion()
  const Tag = (as === 'li' ? motion.li : motion.div) as typeof motion.div
  return (
    <Tag
      className={className}
      layout={reduced ? false : layout}
      layoutId={reduced ? undefined : layoutId}
      initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{
        opacity: 0,
        y: -10,
        filter: 'blur(4px)',
        transition: { duration: reduced ? 0 : 0.3, ease: EASE },
      }}
      viewport={{ once: true, margin: '-8% 0px' }}
      transition={{ duration: reduced ? 0 : 0.7, ease: EASE, delay: reduced ? 0 : delay }}
    >
      {children}
    </Tag>
  )
}

/* --------------------------------------------------------------- primitives */

/** Outer shell + inner core, radii concentric: 2rem outer, 8px pad, 24px core. */
export function Bezel({
  children,
  className,
  tone = 'raised',
  flush,
}: {
  children: ReactNode
  className?: string
  tone?: 'raised' | 'sunken' | 'inverse'
  /** No padding on the core — for cards whose cover bleeds to the edge. */
  flush?: boolean
}) {
  return (
    <div className={cn('fsd-bezel', className)}>
      <div
        className={cn(
          'fsd-core',
          tone !== 'raised' && `fsd-core--${tone}`,
          flush && 'fsd-core--flush'
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="fsd-pill">{children}</span>
}

/** Button-in-button: the arrow sits in its own 32px circle, flush right. */
export function ArrowCta({
  children,
  to,
  onClick,
  variant = 'primary',
  className,
  block,
}: {
  children: ReactNode
  to?: string
  onClick?: () => void
  variant?: 'primary' | 'quiet'
  className?: string
  block?: boolean
}) {
  const body = (
    <>
      <span>{children}</span>
      <span className="fsd-cta__orb" aria-hidden="true">
        <svg
          viewBox="0 0 16 16"
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        >
          <path d="M3 13 L13 3" />
          <path d="M6 3 L13 3 L13 10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </>
  )
  const classes = cn(
    'fsd-cta',
    variant === 'quiet' && 'fsd-cta--quiet',
    block && 'fsd-cta--block',
    className
  )
  if (to) {
    return (
      <Link className={classes} to={to}>
        {body}
      </Link>
    )
  }
  return (
    <button type="button" className={classes} onClick={onClick}>
      {body}
    </button>
  )
}

const STATUS_TONE: Record<ProjectStatus, string> = {
  draft: 'var(--text-muted)',
  rendering: 'var(--warn)',
  ready: 'var(--ok)',
  failed: 'var(--err)',
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const { t } = useTranslation()
  return (
    <span className="fsd-badge">
      <span
        className="fsd-badge__dot"
        style={{ background: STATUS_TONE[status] }}
        aria-hidden="true"
      />
      {t(`app.status.${status}`)}
    </span>
  )
}

/** A 36px circular action. Label is the accessible name and the tooltip. */
export function IconButton({
  label,
  onClick,
  to,
  danger,
  children,
}: {
  label: string
  onClick?: () => void
  to?: string
  danger?: boolean
  children: ReactNode
}) {
  const classes = cn('fsd-icon', danger && 'fsd-icon--danger')
  if (to) {
    return (
      <Link className={classes} to={to} title={label} aria-label={label}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" className={classes} onClick={onClick} title={label} aria-label={label}>
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------- icons */

const ICON = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 } as const

const IconOpen = () => (
  <svg viewBox="0 0 18 18" width="15" height="15" {...ICON}>
    <path d="M7 3 H3 V15 H15 V11" strokeLinejoin="round" />
    <path d="M10 8 L15 3 M11 3 H15 V7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconRoom = () => (
  <svg viewBox="0 0 18 18" width="15" height="15" {...ICON}>
    <path d="M9 2 L16 6 L9 10 L2 6 Z" strokeLinejoin="round" />
    <path d="M2 6 V12 L9 16 L16 12 V6" strokeLinejoin="round" />
    <path d="M9 10 V16" />
  </svg>
)

const IconShare = () => (
  <svg viewBox="0 0 18 18" width="15" height="15" {...ICON}>
    <circle cx="13.5" cy="4" r="2.2" />
    <circle cx="4.5" cy="9" r="2.2" />
    <circle cx="13.5" cy="14" r="2.2" />
    <path d="M6.5 7.9 L11.6 5.1 M6.5 10.1 L11.6 12.9" />
  </svg>
)

const IconCopy = () => (
  <svg viewBox="0 0 18 18" width="15" height="15" {...ICON}>
    <rect x="6" y="6" width="9" height="9" rx="1.5" />
    <path d="M12 6 V4.5 A1.5 1.5 0 0 0 10.5 3 H4.5 A1.5 1.5 0 0 0 3 4.5 V10.5 A1.5 1.5 0 0 0 4.5 12 H6" />
  </svg>
)

const IconTrash = () => (
  <svg viewBox="0 0 18 18" width="15" height="15" {...ICON}>
    <path d="M3.5 5 H14.5" strokeLinecap="round" />
    <path d="M7 5 V3.6 A0.6 0.6 0 0 1 7.6 3 H10.4 A0.6 0.6 0 0 1 11 3.6 V5" />
    <path d="M5 5 L5.7 14.4 A0.6 0.6 0 0 0 6.3 15 H11.7 A0.6 0.6 0 0 0 12.3 14.4 L13 5" />
    <path d="M7.6 7.6 V12.4 M10.4 7.6 V12.4" strokeLinecap="round" />
  </svg>
)

const IconSearch = () => (
  <svg viewBox="0 0 18 18" width="15" height="15" {...ICON}>
    <circle cx="8" cy="8" r="5" />
    <path d="M11.8 11.8 L15.5 15.5" strokeLinecap="round" />
  </svg>
)

/* -------------------------------------------------------------- blueprint */

/**
 * A seeded floor plan. Three furniture arrangements, three window positions —
 * enough that a wall of cards does not look stamped, deterministic enough that
 * a project keeps its own plan between visits.
 */
export function FloorPlan({ seed, label }: { seed: number; label?: string }) {
  const layout = seed % 3
  const windowSide = Math.floor(seed / 3) % 2
  const stroke = 'var(--clay-300)'
  const hair = 'var(--hairline)'

  return (
    <svg
      viewBox="0 0 400 260"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect width="400" height="260" fill="var(--bg-sunken)" />

      {/* survey grid */}
      <g stroke={hair} strokeWidth="1">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <path key={`v${i}`} d={`M${40 + i * 45} 26 V234`} opacity="0.5" />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={`h${i}`} d={`M28 ${38 + i * 45} H372`} opacity="0.5" />
        ))}
      </g>

      {/* shell */}
      <g stroke={stroke} strokeWidth="1.5" fill="none" strokeLinejoin="round">
        <path d="M46 214 V46 H354 V214 Z" />
        {/* door, with its swing arc */}
        <path d="M46 150 V104" stroke="var(--bg-sunken)" strokeWidth="4" />
        <path d="M46 104 A46 46 0 0 1 92 150" strokeDasharray="3 4" />
        <path d="M46 104 L46 150" />
        {/* window on one wall */}
        {windowSide === 0 ? (
          <>
            <path d="M212 46 H318" strokeWidth="4" stroke="var(--bg-sunken)" />
            <path d="M212 42 H318 M212 50 H318" />
          </>
        ) : (
          <>
            <path d="M354 92 V176" strokeWidth="4" stroke="var(--bg-sunken)" />
            <path d="M350 92 V176 M358 92 V176" />
          </>
        )}
      </g>

      {/* daylight wedge */}
      <path
        d={windowSide === 0 ? 'M212 50 H318 L288 150 H180 Z' : 'M350 92 V176 L250 200 V80 Z'}
        fill="var(--accent)"
        opacity="0.07"
      />

      {/* furniture */}
      <g stroke={stroke} strokeWidth="1.4" fill="none" strokeLinejoin="round">
        {layout === 0 && (
          <>
            <rect x="80" y="160" width="130" height="44" rx="3" />
            <path d="M80 176 H210" />
            <path d="M113 160 V204 M177 160 V204" />
            <rect x="240" y="150" width="76" height="52" rx="3" />
            <ellipse cx="180" cy="180" rx="118" ry="38" opacity="0.4" strokeDasharray="4 5" />
            <rect x="92" y="62" width="176" height="18" rx="2" />
          </>
        )}
        {layout === 1 && (
          <>
            <rect x="96" y="80" width="112" height="120" rx="3" />
            <path d="M96 100 H208" />
            <rect x="238" y="96" width="52" height="52" rx="3" />
            <path d="M264 96 V148 M238 122 H290" opacity="0.5" />
            <circle cx="308" cy="192" r="18" />
            <path d="M308 174 V210 M290 192 H326" opacity="0.5" />
          </>
        )}
        {layout === 2 && (
          <>
            <rect x="74" y="70" width="54" height="130" rx="3" />
            <rect x="160" y="112" width="120" height="70" rx="3" />
            <path d="M160 132 H280 M190 112 V182 M250 112 V182" opacity="0.6" />
            <rect x="300" y="70" width="40" height="40" rx="3" />
            <path d="M320 110 V150" />
            <path d="M306 150 H334" />
          </>
        )}
      </g>

      {/* dimension line along the bottom */}
      <g stroke={hair} strokeWidth="1">
        <path d="M46 236 H354" />
        <path d="M46 230 V242 M354 230 V242" />
      </g>
      <text
        x="200"
        y="252"
        textAnchor="middle"
        fill="var(--text-muted)"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em' }}
      >
        {(3.2 + (seed % 7) * 0.2).toFixed(2)} m
      </text>

      {/* north arrow */}
      <g stroke={stroke} strokeWidth="1.2" fill="none">
        <path d="M372 34 L372 14 M366 20 L372 12 L378 20" strokeLinecap="round" />
      </g>
      <circle cx="372" cy="12" r="2" fill="var(--accent)" stroke="none" />
    </svg>
  )
}

/* -------------------------------------------------------------------- CSS */

export const APP_CSS = `
.fsd-page { min-height: 100dvh; padding-block: var(--s12) var(--s24); }
@media (min-width: 768px) { .fsd-page { padding-block: var(--s24); } }

/* ---- bezel --------------------------------------------------------- */
.fsd-bezel {
  background: var(--bg-sunken);
  border: 1px solid var(--hairline);
  border-radius: 2rem;
  padding: var(--s2);
}
.fsd-core {
  position: relative;
  background: var(--bg-raised);
  border-radius: calc(2rem - var(--s2));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
  padding: var(--s6);
  overflow: hidden;
}
.fsd-core--sunken { background: var(--bg-sunken); }
.fsd-core--inverse { background: var(--bg-inverse); color: var(--text-inverse); }
.fsd-core--flush { padding: 0; }
:root[data-theme='dark'] .fsd-core { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08); }
@media (min-width: 768px) { .fsd-core { padding: var(--s8); } .fsd-core--flush { padding: 0; } }
@media (max-width: 479px) {
  .fsd-bezel { padding: 6px; border-radius: 1.625rem; }
  .fsd-core { padding: var(--s5); border-radius: 1.25rem; }
  .fsd-core--flush { padding: 0; }
}

/* ---- eyebrow pill -------------------------------------------------- */
.fsd-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  border-radius: 999px;
  padding: 6px var(--s4);
  border: 1px solid var(--hairline);
  background: var(--bg-sunken);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-muted);
}

/* ---- button-in-button ---------------------------------------------- */
.fsd-cta {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s5);
  min-height: 56px;
  padding-left: var(--s6);
  padding-right: var(--s2);
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  background: var(--accent-ink);
  color: var(--paper);
  font-family: var(--font-ui);
  font-size: var(--step-0);
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: transform var(--d-base) var(--ease), background-color var(--d-base) var(--ease),
    border-color var(--d-base) var(--ease);
}
.fsd-cta--block { display: flex; width: 100%; }
@media (hover: hover) and (pointer: fine) {
  .fsd-cta:hover { background: var(--clay-500); }
  .fsd-cta:hover .fsd-cta__orb { transform: translate3d(3px, -3px, 0) scale(1.08); }
  .fsd-cta--quiet:hover { background: var(--bg-sunken); border-color: var(--border-strong); }
}
.fsd-cta:active { transform: scale(0.98); }
.fsd-cta:focus-visible, .fsd-icon:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; }
.fsd-cta__orb {
  flex: none;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--paper) 22%, transparent);
  transition: transform var(--d-base) var(--ease);
}
.fsd-cta--quiet {
  background: var(--bg-sunken);
  border-color: var(--hairline);
  color: var(--text-strong);
}
.fsd-cta--quiet .fsd-cta__orb { background: color-mix(in srgb, var(--text-strong) 10%, transparent); }

/* ---- badges & icon buttons ----------------------------------------- */
.fsd-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  border-radius: 999px;
  padding: 4px var(--s3);
  background: var(--bg-sunken);
  border: 1px solid var(--hairline);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.fsd-badge__dot { width: 6px; height: 6px; border-radius: 999px; }

.fsd-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: none;
  border: 1px solid var(--hairline);
  border-radius: var(--radius-full);
  background: var(--bg-raised);
  color: var(--text);
  cursor: pointer;
  text-decoration: none;
  transition: transform var(--d-fast) var(--ease), color var(--d-fast) var(--ease),
    border-color var(--d-fast) var(--ease);
}
@media (hover: hover) and (pointer: fine) {
  .fsd-icon:hover { color: var(--text-strong); border-color: var(--border-strong); transform: translateY(-2px); }
  .fsd-icon--danger:hover { color: var(--err); border-color: var(--err); }
}
.fsd-icon:active { transform: scale(0.94); }
@media (hover: none) { .fsd-icon { width: 40px; height: 40px; } }

/* ---- header -------------------------------------------------------- */
.fsd-head { row-gap: var(--s10); align-items: end; }
.fsd-head__text { grid-column: 1 / -1; }
.fsd-head__meter { grid-column: 1 / -1; }
@media (min-width: 900px) {
  .fsd-head__text { grid-column: 1 / span 7; }
  .fsd-head__meter { grid-column: 9 / span 4; }
}

.fsd-meter { display: flex; gap: 3px; }
.fsd-meter__seg {
  flex: 1;
  height: 28px;
  border-radius: 3px;
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.fsd-meter__seg--on { background: var(--accent); box-shadow: none; }
.fsd-credits__fig {
  margin-top: var(--s5);
  font-family: var(--font-display);
  font-size: var(--step-3);
  line-height: var(--lh-display);
  color: var(--text-strong);
  font-variant-numeric: lining-nums tabular-nums;
}

/* ---- stats strip under the greeting -------------------------------- */
.fsd-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: var(--s8);
  border-top: 1px solid var(--hairline);
  max-width: 34rem;
}
.fsd-stat { display: grid; gap: var(--s1); padding: var(--s4) var(--s4) 0 0; min-width: 0; }
.fsd-stat dd, .fsd-stat dt { margin: 0; }
.fsd-stat .fsd-stat__n { order: -1; }
.fsd-stat + .fsd-stat { padding-left: var(--s4); border-left: 1px solid var(--hairline); }
.fsd-stat__n {
  font-family: var(--font-display);
  font-size: var(--step-2);
  line-height: 1;
  color: var(--text-strong);
  font-variant-numeric: lining-nums tabular-nums;
}
.fsd-stat__k {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}

/* ---- new project panel --------------------------------------------- */
.fsd-new { display: grid; gap: var(--s8); align-items: center; }
@media (min-width: 900px) { .fsd-new { grid-template-columns: minmax(0, 1fr) 15rem; } }
.fsd-new__fig {
  border: 1px solid var(--hairline);
  border-radius: var(--radius-lg);
  overflow: hidden;
  aspect-ratio: 5 / 4;
}
.fsd-new__actions { margin-top: var(--s8); display: flex; align-items: center; gap: var(--s3) var(--s4); flex-wrap: wrap; }
.fsd-new__hint { margin-top: var(--s4); display: flex; flex-wrap: wrap; gap: var(--s2) var(--s5); }
.fsd-display-em { font-style: italic; color: var(--accent-ink); }

/* ---- toolbar ------------------------------------------------------- */
.fsd-tools { display: grid; gap: var(--s5); }
@media (min-width: 900px) {
  .fsd-tools { grid-template-columns: minmax(0, 22rem) minmax(0, 1fr) auto; align-items: end; }
}
.fsd-search { position: relative; }
.fsd-search .fs-input { padding-left: calc(var(--s10) + var(--s1)); }
.fsd-search__icon {
  position: absolute;
  top: 50%;
  left: var(--s4);
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}
.fsd-chips { display: flex; gap: var(--s2); flex-wrap: wrap; }

/* ---- bento --------------------------------------------------------- */
.fsd-bento { display: grid; gap: var(--s5); grid-template-columns: minmax(0, 1fr); }
/* Each cell is the Reveal wrapper; the card inside has to fill it. */
.fsd-bento > * { display: flex; min-width: 0; }
.fsd-bento > * > .fsd-card { width: 100%; }
@media (min-width: 768px) { .fsd-bento { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1024px) {
  .fsd-bento { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: var(--s6); }
  .fsd-cell--wide { grid-column: span 4; }
  .fsd-cell--half { grid-column: span 3; }
  .fsd-cell--narrow { grid-column: span 2; }
}

.fsd-card { position: relative; height: 100%; }
.fsd-card .fsd-bezel { height: 100%; transition: transform var(--d-base) var(--ease), box-shadow var(--d-base) var(--ease); }
@media (hover: hover) and (pointer: fine) {
  .fsd-card:hover .fsd-bezel { transform: translateY(-3px); box-shadow: var(--shadow-card, 0 18px 40px -24px rgba(42, 29, 22, 0.35)); }
}
.fsd-card .fsd-core { display: flex; flex-direction: column; height: 100%; }
.fsd-card__frame {
  position: relative;
  overflow: hidden;
  background: var(--bg-sunken);
  border-bottom: 1px solid var(--hairline);
  aspect-ratio: 4 / 3;
}
.fsd-cell--wide .fsd-card__frame { aspect-ratio: 16 / 9; }
.fsd-cell--half .fsd-card__frame { aspect-ratio: 3 / 2; }
.fsd-card__cover {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--d-slow) var(--ease-fluid);
}
@media (hover: hover) and (pointer: fine) {
  .fsd-card:hover .fsd-card__cover { transform: scale(1.05); }
}
.fsd-card__shade {
  position: absolute; inset: auto 0 0 0; height: 45%; pointer-events: none;
  background: linear-gradient(to top, color-mix(in srgb, var(--clay-900) 38%, transparent), transparent);
}
.fsd-card__title { font-family: var(--font-display); line-height: var(--lh-tight); overflow-wrap: anywhere; }
.fsd-card__title a { color: inherit; text-decoration: none; }
.fsd-card__title a:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: 2px; }
.fsd-card__hit { position: absolute; inset: 0; }
.fsd-card__meta { color: var(--text-muted); font-size: var(--step--1); display: flex; flex-wrap: wrap; gap: var(--s1) var(--s3); }
.fsd-card__price { color: var(--text-strong); font-weight: 600; font-variant-numeric: tabular-nums lining-nums; white-space: nowrap; }
.fsd-card__body { display: flex; flex-direction: column; gap: var(--s3); padding: var(--s5); flex: 1; }
.fsd-card__foot {
  margin-top: auto;
  padding-top: var(--s4);
  border-top: 1px solid var(--hairline);
  display: flex;
  justify-content: space-between;
  gap: var(--s3);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  flex-wrap: wrap;
  font-variant-numeric: tabular-nums;
}

/* Quick actions. Always in the DOM for keyboard users; revealed on hover or
   when anything inside the card takes focus. */
.fsd-card__tools {
  position: absolute;
  top: var(--s3);
  right: var(--s3);
  display: flex;
  gap: var(--s2);
  opacity: 0;
  transform: translateY(-6px);
  transition: opacity var(--d-base) var(--ease), transform var(--d-base) var(--ease);
}
.fsd-card:hover .fsd-card__tools,
.fsd-card:focus-within .fsd-card__tools { opacity: 1; transform: translateY(0); }
@media (hover: none) {
  .fsd-card__tools { opacity: 1; transform: none; }
}

.fsd-confirm {
  position: absolute;
  inset: auto var(--s3) var(--s3) var(--s3);
  display: flex;
  align-items: center;
  gap: var(--s3);
  padding: var(--s3) var(--s4);
  border-radius: var(--radius-lg);
  background: var(--bg-inverse);
  color: var(--text-inverse);
  font-size: var(--step--1);
}
.fsd-confirm button {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
  font-size: var(--step--1);
}
.fsd-confirm button:first-of-type { color: var(--err); }

/* ---- empty state --------------------------------------------------- */
.fsd-empty { display: grid; gap: var(--s10); align-items: center; }
@media (min-width: 900px) { .fsd-empty { grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); } }
.fsd-empty__fig {
  border: 1px solid var(--hairline);
  border-radius: var(--radius-lg);
  overflow: hidden;
  aspect-ratio: 20 / 13;
}

.fsd-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s4);
  padding: var(--s4) var(--s5);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--warn) 14%, transparent);
  color: var(--warn-ink);
  font-size: var(--step--1);
}
.fsd-banner button {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* Below 768 everything is one column, full width, nothing rotated. */
@media (max-width: 767px) {
  .fsd-new, .fsd-empty, .fsd-tools { grid-template-columns: minmax(0, 1fr); }
  .fsd-cta { width: 100%; }
  .fsd-banner { flex-wrap: wrap; }
}
@media (prefers-reduced-motion: reduce) {
  .fsd-card .fsd-bezel, .fsd-card__cover, .fsd-cta, .fsd-cta__orb, .fsd-icon { transition: none; }
}
`

export function AppStyles() {
  return (
    <style href="fs-app-shell" precedence="medium">
      {APP_CSS}
    </style>
  )
}

/* ------------------------------------------------------------- utilities */

/* The date formatter moved next to the capture hooks so Result can share it;
   re-exported here for anything that still imports it from the dashboard. */
export { useDateFormat }

/* ------------------------------------------------------------------ card */

const CELLS = ['wide', 'narrow', 'narrow', 'wide', 'half', 'half'] as const

function ProjectCard({
  project,
  cell,
  hasRecord,
  onDelete,
  onDuplicate,
}: {
  project: Project
  cell: (typeof CELLS)[number]
  /** Whether a capture record exists for this project (computed once by the list). */
  hasRecord: boolean
  onDelete: () => void
  onDuplicate: () => void
}) {
  const { t } = useTranslation()
  const format = useDateFormat()
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)

  // A project that came out of capture reopens on its result; one made by
  // hand (or whose capture slice was evicted) opens in the room editor.
  const href = hasRecord ? `/app/result/${project.id}` : `/app/room/${project.id}`

  async function share() {
    // There is no share backend. The project lives in this browser's
    // localStorage, so the link only resolves on this device — it is a
    // placeholder for the real short link once projects are server-side.
    const url = `${window.location.origin}${href}`
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
    if (nav.share) {
      try {
        await nav.share({ title: project.title, url })
        return
      } catch {
        // Cancelled by the user, or not permitted — fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      // Clipboard blocked. Nothing worth interrupting the user for.
    }
  }

  const total = project.budget?.estimatedTotal
  const money = useMoneyIn(project.budget?.currency || 'UZS')
  const reduced = useReducedMotion()

  return (
    <article className={cn('fsd-card', `fsd-cell--${cell}`)}>
      <Bezel flush>
        <Tilt className="fsd-card__frame" max={5}>
          {project.cover ? (
            <>
              <img
                className="fsd-card__cover"
                src={project.cover}
                alt=""
                loading="lazy"
                decoding="async"
              />
              <span className="fsd-card__shade" aria-hidden="true" />
            </>
          ) : (
            <div className="fsd-card__cover">
              <FloorPlan seed={seedOf(project.id)} />
            </div>
          )}

          {/* The whole cover opens the project; the title link is the named one. */}
          <Link className="fsd-card__hit" to={href} tabIndex={-1} aria-hidden="true" />

          <div className="fsd-card__tools">
            <IconButton label={t('app.dash.actions.open')} to={href}>
              <IconOpen />
            </IconButton>
            <IconButton
              label={t('app.dash.actions.see')}
              to={`/app/projects/${project.id}/live`}
            >
              <IconRoom />
            </IconButton>
            <IconButton
              label={copied ? t('app.dash.actions.copied') : t('app.dash.actions.share')}
              onClick={share}
            >
              <IconShare />
            </IconButton>
            <IconButton label={t('app.dash.actions.duplicate')} onClick={onDuplicate}>
              <IconCopy />
            </IconButton>
            <IconButton
              label={t('app.dash.actions.delete')}
              danger
              onClick={() => setConfirming(true)}
            >
              <IconTrash />
            </IconButton>
          </div>

          {copied && (
            <span
              className="fsd-badge"
              role="status"
              style={{ position: 'absolute', left: 'var(--s3)', right: 'var(--s3)', bottom: 'var(--s3)', whiteSpace: 'normal' }}
            >
              {t('result.shareLocalOnly', {
                defaultValue: 'Havola nusxalandi — u faqat shu qurilmada ochiladi',
              })}
            </span>
          )}

          {confirming && (
            <div className="fsd-confirm" role="alertdialog" aria-label={t('app.dash.actions.delete')}>
              <span style={{ flex: 1 }}>{t('app.dash.actions.confirmDelete')}</span>
              <button type="button" onClick={onDelete}>
                {t('app.dash.actions.delete')}
              </button>
              <button type="button" onClick={() => setConfirming(false)}>
                {t('common.cancel')}
              </button>
            </div>
          )}
        </Tilt>

        <div className="fsd-card__body">
          <motion.div
            style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap' }}
            initial={reduced ? undefined : { opacity: 0, scale: 0.85 }}
            whileInView={reduced ? undefined : { opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-8% 0px' }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.1 }}
          >
            <StatusBadge status={project.status} />
            <span className="fsd-badge">{t(`app.rooms.${project.roomType}`)}</span>
          </motion.div>

          <h3
            className="fsd-card__title"
            style={{ fontSize: cell === 'wide' ? 'var(--step-2)' : 'var(--step-1)' }}
          >
            <Link to={href}>{project.title}</Link>
          </h3>

          {(project.style || total) && (
            <p className="fsd-card__meta">
              {project.style && (
                <span>{t(`styles.${project.style}`, { defaultValue: project.style })}</span>
              )}
              {total ? <span className="fsd-card__price">{money.format(total)}</span> : null}
            </p>
          )}

          <div className="fsd-card__foot">
            <span>{format(project.savedAt)}</span>
            <span>
              {project.renderCount
                ? t('app.dash.card.renders', { count: project.renderCount })
                : t('app.dash.card.noRenders')}
            </span>
          </div>
        </div>
      </Bezel>
    </article>
  )
}

/* ---------------------------------------------------------------- meter */

function CreditsMeter() {
  const { t } = useTranslation()
  const user = useSession((s) => s.user)
  const credits = useSession((s) => s.credits)
  const guestUsed = useSession((s) => s.guestGenerationsUsed)
  // When the server enforces a daily allowance it is the real number.
  const { quota, resetTime } = useRenderAllowance()

  const total = quota ? quota.limit : user ? credits.total : GUEST_FREE_GENERATIONS
  const used = quota ? quota.used : user ? credits.used : guestUsed
  const left = Math.max(0, total - used)
  // Twelve segments is the most that still reads as countable at this size.
  const segments = Math.max(1, Math.min(total, 12))
  const lit = total > 0 ? Math.round((left / total) * segments) : 0

  return (
    <Bezel tone="sunken">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--s4)' }}>
        <Eyebrow>{t('app.dash.credits.eyebrow')}</Eyebrow>
        <span className="fs-label">
          {user
            ? t(user.plan === 'studio' ? 'app.dash.credits.planStudio' : 'app.dash.credits.planFree')
            : t('app.dash.credits.guest')}
        </span>
      </div>

      <p className="fsd-credits__fig">{t('app.dash.credits.left', { count: left })}</p>
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--step--1)' }}>
        {t('app.dash.credits.of', { total })}
      </p>

      <div
        className="fsd-meter"
        style={{ marginTop: 'var(--s5)' }}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={left}
        aria-label={t('app.dash.credits.title')}
      >
        {Array.from({ length: segments }, (_, i) => (
          <span key={i} className={cn('fsd-meter__seg', i < lit && 'fsd-meter__seg--on')} />
        ))}
      </div>

      <p style={{ marginTop: 'var(--s4)', fontSize: 'var(--step--1)', color: 'var(--text-muted)' }}>
        {quota
          ? t('limits.resets', { time: resetTime })
          : user
            ? t('app.dash.credits.renew')
            : t('app.dash.credits.guestBody')}
      </p>

      <div style={{ marginTop: 'var(--s5)' }}>
        {user ? (
          <ArrowCta variant="quiet" to="/pricing">
            {t('app.dash.credits.upgrade')}
          </ArrowCta>
        ) : (
          <ArrowCta variant="quiet" to="/signup">
            {t('nav.signup')}
          </ArrowCta>
        )}
      </div>
    </Bezel>
  )
}

/* ------------------------------------------------------------- the page */

export function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const user = useSession((s) => s.user)
  const projects = useProjects((s) => s.projects)
  const ready = useProjects((s) => s.ready)
  const error = useProjects((s) => s.error)
  const hydrate = useProjects((s) => s.hydrate)
  const create = useProjects((s) => s.create)
  const duplicate = useProjects((s) => s.duplicate)
  const remove = useProjects((s) => s.remove)
  const clearError = useProjects((s) => s.clearError)

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ProjectStatus | 'all'>('all')
  const [room, setRoom] = useState<RoomType | 'all'>('all')

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (!user) return t('app.dash.greeting.guest')
    const slot = hour < 12 ? 'morning' : hour < 18 ? 'day' : 'evening'
    return t(`app.dash.greeting.${slot}`, { name: user.name.split(' ')[0] })
  }, [user, t])

  // Which projects came out of capture, read once per project list rather
  // than per card render (each lookup parses the whole capture store).
  const recordIds = useMemo(
    () => new Set(listRecords().map((r) => r.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects]
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return projects.filter((p) => {
      if (status !== 'all' && p.status !== status) return false
      if (room !== 'all' && p.roomType !== room) return false
      if (!needle) return true
      return `${p.title} ${p.style}`.toLowerCase().includes(needle)
    })
  }, [projects, query, status, room])

  const filtering = query.trim() !== '' || status !== 'all' || room !== 'all'

  const stats = useMemo(
    () => ({
      renders: projects.reduce((sum, p) => sum + (p.renderCount || 0), 0),
      ready: projects.filter((p) => p.status === 'ready').length,
    }),
    [projects]
  )

  function openSample() {
    // The empty state's sample is a real project, created on the spot, so
    // "open it" means the same thing it will mean for every other card.
    const made = create({
      title: t('app.dash.empty.sampleTitle'),
      roomType: 'living',
      style: t('app.dash.empty.sampleStyle'),
      status: 'ready',
      notes: t('app.dash.empty.sampleMeta'),
    })
    if (made) navigate(`/app/room/${made.id}`)
  }

  function resetFilters() {
    setQuery('')
    setStatus('all')
    setRoom('all')
  }

  return (
    <>
      <AppStyles />
      <Seo
        title={`${t('app.dash.eyebrow')} — ${t('brand.name')}`}
        description={t('app.dash.lead')}
        path="/app"
      />

      <section className="fsd-page">
        <div className="fs-container">
          {/* ---- greeting + meter ---------------------------------- */}
          <div className="fs-grid fsd-head">
            <RevealBlur className="fsd-head__text">
              <Eyebrow>{t('app.dash.eyebrow')}</Eyebrow>
              <TextReveal
                as="h1"
                text={greeting}
                delay={0.06}
                duration={0.6}
                stagger={0.035}
                className="fs-display"
                style={{ marginTop: 'var(--s6)', maxWidth: '16ch', fontSize: 'var(--step-4)' }}
              />
              <p className="fs-lead" style={{ marginTop: 'var(--s6)', maxWidth: '44ch' }}>
                {t('app.dash.lead')}
              </p>
              {ready && projects.length > 0 && (
                <dl className="fsd-stats">
                  <div className="fsd-stat">
                    <dt className="fsd-stat__k">{t('app.dash.stats.projects')}</dt>
                    <dd className="fsd-stat__n">{projects.length}</dd>
                  </div>
                  <div className="fsd-stat">
                    <dt className="fsd-stat__k">{t('app.dash.stats.renders')}</dt>
                    <dd className="fsd-stat__n">{stats.renders}</dd>
                  </div>
                  <div className="fsd-stat">
                    <dt className="fsd-stat__k">{t('app.dash.stats.ready')}</dt>
                    <dd className="fsd-stat__n">{stats.ready}</dd>
                  </div>
                </dl>
              )}
            </RevealBlur>

            <RevealBlur className="fsd-head__meter" delay={0.08}>
              <CreditsMeter />
            </RevealBlur>
          </div>

          {error && (
            <div className="fsd-banner" style={{ marginTop: 'var(--s10)' }} role="status">
              <span>{t('app.dash.storageError')}</span>
              <button type="button" onClick={clearError}>
                {t('nav.close')}
              </button>
            </div>
          )}

          {/* ---- new project --------------------------------------- */}
          <RevealBlur delay={0.04}>
            <hr className="fs-rule-strong" style={{ marginBlock: 'var(--s16) var(--s10)' }} />
            <Bezel>
              <div className="fsd-new">
                <div>
                  <Eyebrow>{t('app.dash.newProject.eyebrow')}</Eyebrow>
                  <h2 style={{ marginTop: 'var(--s5)', fontSize: 'var(--step-3)', maxWidth: '16ch' }}>
                    {t('app.dash.newProject.title')}
                  </h2>
                  <p
                    style={{
                      marginTop: 'var(--s5)',
                      color: 'var(--text-muted)',
                      maxWidth: '46ch',
                    }}
                  >
                    {t('app.dash.newProject.body')}
                  </p>
                  <div className="fsd-new__actions">
                    <ArrowCta to="/app/capture">{t('app.dash.newProject.cta')}</ArrowCta>
                    <ArrowCta variant="quiet" to="/app/room/new">
                      {t('app.dash.newProject.builderCta')}
                    </ArrowCta>
                  </div>
                  <p className="fsd-new__hint">
                    <span className="fs-label">{t('app.dash.newProject.hint')}</span>
                    <span className="fs-label">{t('app.dash.newProject.builderHint')}</span>
                  </p>
                </div>

                <div className="fsd-new__fig">
                  <FloorPlan seed={7} />
                </div>
              </div>
            </Bezel>
          </RevealBlur>

          {/* ---- toolbar ------------------------------------------- */}
          {(projects.length > 0 || filtering) && (
            <RevealBlur delay={0.04}>
              <hr className="fs-rule" style={{ marginBlock: 'var(--s16) var(--s8)' }} />
              <div className="fsd-tools">
                <div className="fs-field">
                  <label className="fs-field__label" htmlFor="fsd-search">
                    {t('app.dash.filters.search')}
                  </label>
                  <div className="fsd-search">
                    <span className="fsd-search__icon" aria-hidden="true">
                      <IconSearch />
                    </span>
                    <input
                      id="fsd-search"
                      className="fs-input"
                      type="search"
                      value={query}
                      placeholder={t('app.dash.filters.searchPlaceholder')}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="fs-field">
                  <span className="fs-field__label">{t('app.dash.filters.status')}</span>
                  <div className="fsd-chips">
                    <button
                      type="button"
                      className="fs-chip"
                      aria-pressed={status === 'all'}
                      onClick={() => setStatus('all')}
                    >
                      {t('app.dash.filters.all')}
                    </button>
                    {PROJECT_STATUSES.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className="fs-chip"
                        aria-pressed={status === value}
                        onClick={() => setStatus(value)}
                      >
                        <span
                          className="fsd-badge__dot"
                          style={{ background: STATUS_TONE[value] }}
                          aria-hidden="true"
                        />
                        {t(`app.status.${value}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="fs-field">
                  <label className="fs-field__label" htmlFor="fsd-room">
                    {t('app.dash.filters.room')}
                  </label>
                  <select
                    id="fsd-room"
                    className="fs-select"
                    value={room}
                    onChange={(e) => setRoom(e.target.value as RoomType | 'all')}
                  >
                    <option value="all">{t('app.dash.filters.allRooms')}</option>
                    {ROOM_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {t(`app.rooms.${value}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="fs-label" style={{ marginTop: 'var(--s6)' }}>
                {t('app.dash.filters.results', { count: filtered.length })}
              </p>
            </RevealBlur>
          )}

          {/* ---- the bento, or the empty state --------------------- */}
          <div style={{ marginTop: 'var(--s8)' }}>
            {!ready ? (
              <div className="fsd-bento" aria-busy="true" aria-label={t('app.auth.loading')}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={cn('fs-skeleton', 'fsd-cell--' + CELLS[i])}
                    style={{ minHeight: 280, borderRadius: '2rem' }}
                  />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <RevealBlur>
                <Bezel>
                  <div className="fsd-empty">
                    <div>
                      <Eyebrow>{t('app.dash.empty.eyebrow')}</Eyebrow>
                      <h2
                        style={{
                          marginTop: 'var(--s5)',
                          fontSize: 'var(--step-3)',
                          maxWidth: '15ch',
                        }}
                      >
                        {t('app.dash.empty.title')}
                      </h2>
                      <p
                        style={{
                          marginTop: 'var(--s5)',
                          color: 'var(--text-muted)',
                          maxWidth: '44ch',
                        }}
                      >
                        {t('app.dash.empty.body')}
                      </p>
                      <div
                        style={{
                          marginTop: 'var(--s8)',
                          display: 'flex',
                          gap: 'var(--s4)',
                          flexWrap: 'wrap',
                        }}
                      >
                        <ArrowCta to="/app/capture">{t('app.dash.empty.cta')}</ArrowCta>
                        <ArrowCta variant="quiet" to="/app/room/new">
                          {t('app.dash.empty.builderCta')}
                        </ArrowCta>
                      </div>
                    </div>

                    <div>
                      <Tilt className="fsd-empty__fig" max={4}>
                        <FloorPlan seed={2} label={t('app.dash.empty.sampleTitle')} />
                      </Tilt>
                      <div
                        style={{
                          marginTop: 'var(--s5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 'var(--s4)',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>
                          <span
                            style={{
                              display: 'block',
                              fontFamily: 'var(--font-display)',
                              fontSize: 'var(--step-1)',
                              color: 'var(--text-strong)',
                            }}
                          >
                            {t('app.dash.empty.sampleTitle')}
                          </span>
                          <span className="fs-label">{t('app.dash.empty.sampleMeta')}</span>
                        </span>
                        <ArrowCta variant="quiet" onClick={openSample}>
                          {t('app.dash.empty.sampleCta')}
                        </ArrowCta>
                      </div>
                    </div>
                  </div>
                </Bezel>
              </RevealBlur>
            ) : filtered.length === 0 ? (
              <RevealBlur>
                <Bezel tone="sunken">
                  <h2 style={{ fontSize: 'var(--step-2)' }}>{t('app.dash.none.title')}</h2>
                  <p
                    style={{
                      marginTop: 'var(--s4)',
                      color: 'var(--text-muted)',
                      maxWidth: '40ch',
                    }}
                  >
                    {t('app.dash.none.body')}
                  </p>
                  <div style={{ marginTop: 'var(--s6)' }}>
                    <ArrowCta variant="quiet" onClick={resetFilters}>
                      {t('app.dash.none.reset')}
                    </ArrowCta>
                  </div>
                </Bezel>
              </RevealBlur>
            ) : (
              <div className="fsd-bento">
                <AnimatePresence mode="popLayout" initial={false}>
                  {filtered.map((project, i) => (
                    <RevealBlur
                      key={project.id}
                      layout
                      className={cn('fsd-cell--' + CELLS[i % CELLS.length])}
                      delay={Math.min(i, 5) * 0.05}
                    >
                      <ProjectCard
                        project={project}
                        cell={CELLS[i % CELLS.length]}
                        hasRecord={recordIds.has(project.id)}
                        onDuplicate={() => duplicate(project.id)}
                        onDelete={() => remove(project.id)}
                      />
                    </RevealBlur>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  )
}

export default Dashboard
