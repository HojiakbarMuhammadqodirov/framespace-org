import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router'

import { cn } from '@/lib/cn'

/**
 * Shared chrome for the public catalog: the double-bezel container, the
 * eyebrow pill, the mono micro-label and the button-in-button CTA.
 *
 * One hoisted `<style href="fs-cat-chrome">` block for the lot — React 19
 * dedupes by href, so mounting forty cards still ships the rules once.
 * Everything below is tokens only.
 */

const CSS = `
/* ---- double bezel ------------------------------------------------------
   Outer shell: the machined tray. Inner core: the plate seated in it. The
   inner radius is the outer radius minus the tray padding, so the two curves
   stay concentric instead of drifting apart at the corners. */
.cat-bezel {
  --cat-tray: var(--s2);
  --cat-radius: 2rem;
  position: relative;
  display: block;
  padding: var(--cat-tray);
  border-radius: var(--cat-radius);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
  transition: box-shadow var(--d-base) var(--ease), transform var(--d-base) var(--ease);
}
.cat-bezel--tight { --cat-tray: var(--s1); --cat-radius: 1.25rem; }
.cat-bezel--raised { background: var(--bg-raised); }
.cat-bezel__core {
  position: relative;
  overflow: hidden;
  border-radius: calc(var(--cat-radius) - var(--cat-tray));
  background: var(--bg-raised);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--white) 55%, transparent),
    inset 0 0 0 1px var(--hairline);
}
.cat-bezel__core--sunken { background: var(--bg-sunken); }
.cat-bezel__core--inverse { background: var(--bg-inverse); }
/* Four machined screw-heads at the tray corners. Purely hardware feel. */
.cat-bezel--hardware::before,
.cat-bezel--hardware::after {
  content: '';
  position: absolute;
  top: calc(var(--cat-tray) / 2 - 1px);
  width: 3px;
  height: 3px;
  border-radius: var(--radius-full);
  background: var(--border-strong);
  opacity: 0.55;
  pointer-events: none;
}
.cat-bezel--hardware::before { left: calc(var(--cat-tray) / 2 - 1px); }
.cat-bezel--hardware::after { right: calc(var(--cat-tray) / 2 - 1px); }

/* ---- eyebrow pill ------------------------------------------------------ */
.cat-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  padding: var(--s1) var(--s3);
  border-radius: var(--radius-full);
  background: var(--bg-raised);
  box-shadow: inset 0 0 0 1px var(--hairline);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.cat-eyebrow__dot {
  width: 5px;
  height: 5px;
  border-radius: var(--radius-full);
  background: var(--accent);
}

/* ---- mono micro-label -------------------------------------------------- */
.cat-mono {
  display: inline-flex;
  align-items: baseline;
  gap: var(--s2);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.1em;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.cat-mono__key { text-transform: uppercase; letter-spacing: var(--tracking-mono); opacity: 0.72; }
.cat-mono__value { color: var(--text-strong); }

/* ---- button-in-button CTA ---------------------------------------------- */
.cat-cta {
  display: inline-flex;
  align-items: center;
  gap: var(--s4);
  min-height: var(--tap);
  padding: var(--s2) var(--s2) var(--s2) var(--s6);
  border: 0;
  border-radius: var(--radius-full);
  background: var(--accent-ink);
  color: var(--paper);
  font-family: var(--font-ui);
  font-size: var(--step--1);
  font-weight: 500;
  letter-spacing: 0.01em;
  text-decoration: none;
  cursor: pointer;
  transition: transform var(--d-fast) var(--ease), background-color var(--d-base) var(--ease);
}
.cat-cta:hover { background: var(--clay-500); }
.cat-cta:active { transform: scale(0.98); }
.cat-cta__knob {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--white) 18%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--white) 26%, transparent);
  font-size: var(--step--1);
  line-height: 1;
  transition: transform var(--d-base) var(--ease);
}
.cat-cta:hover .cat-cta__knob { transform: translateX(3px); }
.cat-cta--quiet {
  background: var(--bg-raised);
  color: var(--text-strong);
  box-shadow: inset 0 0 0 1px var(--border-strong);
}
.cat-cta--quiet:hover { background: var(--bg-sunken); }
.cat-cta--quiet .cat-cta__knob {
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
}
.cat-cta[disabled],
.cat-cta[aria-disabled='true'] {
  opacity: 0.45;
  pointer-events: none;
}

/* ---- status dot -------------------------------------------------------- */
.cat-status {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
}
.cat-status__dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--text-muted);
}
.cat-status--ready .cat-status__dot { background: var(--ok); }
.cat-status--processing .cat-status__dot { background: var(--warn); }
.cat-status--missing .cat-status__dot { background: var(--err); }

/* ---- honest notice ----------------------------------------------------- */
.cat-notice {
  display: flex;
  gap: var(--s4);
  align-items: flex-start;
  padding: var(--s4) var(--s5);
  border-radius: var(--radius-lg);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 1px var(--hairline);
  font-size: var(--step--1);
  color: var(--text-muted);
  max-width: 78ch;
}
.cat-notice__mark {
  flex: 0 0 auto;
  margin-top: 0.35em;
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: var(--warn);
}

@media (prefers-reduced-motion: reduce) {
  .cat-bezel, .cat-cta, .cat-cta__knob { transition: none; }
}
`

export function CatalogChromeStyles() {
  return (
    <style href="fs-cat-chrome" precedence="medium">
      {CSS}
    </style>
  )
}

/* ------------------------------------------------------------------ bezel */

export function Bezel({
  children,
  className,
  style,
  tight,
  raised,
  hardware,
  coreClassName,
  coreStyle,
  coreTone = 'raised',
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
  tight?: boolean
  raised?: boolean
  hardware?: boolean
  coreClassName?: string
  coreStyle?: CSSProperties
  coreTone?: 'raised' | 'sunken' | 'inverse'
}) {
  return (
    <div
      className={cn(
        'cat-bezel',
        tight && 'cat-bezel--tight',
        raised && 'cat-bezel--raised',
        hardware && 'cat-bezel--hardware',
        className,
      )}
      style={style}
    >
      <div
        className={cn(
          'cat-bezel__core',
          coreTone === 'sunken' && 'cat-bezel__core--sunken',
          coreTone === 'inverse' && 'cat-bezel__core--inverse',
          coreClassName,
        )}
        style={coreStyle}
      >
        {children}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- fragments */

export function Eyebrow({ children, dot = true }: { children: ReactNode; dot?: boolean }) {
  return (
    <span className="cat-eyebrow">
      {dot && <span className="cat-eyebrow__dot" aria-hidden="true" />}
      {children}
    </span>
  )
}

/** A mono micro-label: every number and dimension on the page wears one. */
export function Mono({
  label,
  value,
  className,
}: {
  label?: ReactNode
  value: ReactNode
  className?: string
}) {
  return (
    <span className={cn('cat-mono', className)}>
      {label && <span className="cat-mono__key">{label}</span>}
      <span className="cat-mono__value">{value}</span>
    </span>
  )
}

export function StatusPip({
  status,
  children,
}: {
  status: 'ready' | 'processing' | 'missing'
  children: ReactNode
}) {
  return (
    <span className={`cat-status cat-status--${status}`}>
      <span className="cat-status__dot" aria-hidden="true" />
      {children}
    </span>
  )
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="cat-notice" role="note">
      <span className="cat-notice__mark" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

/* -------------------------------------------------------------------- CTA */

type CtaProps = {
  children: ReactNode
  quiet?: boolean
  glyph?: string
  className?: string
}

export function CtaLink({
  to,
  children,
  quiet,
  glyph = '→',
  className,
  ...rest
}: CtaProps & { to: string } & Record<string, unknown>) {
  return (
    <Link className={cn('cat-cta', quiet && 'cat-cta--quiet', className)} to={to} {...rest}>
      <span>{children}</span>
      <span className="cat-cta__knob" aria-hidden="true">
        {glyph}
      </span>
    </Link>
  )
}

export function CtaButton({
  children,
  quiet,
  glyph = '→',
  className,
  onClick,
  type = 'button',
  disabled,
  ...rest
}: CtaProps & {
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
} & Record<string, unknown>) {
  return (
    <button
      type={type}
      className={cn('cat-cta', quiet && 'cat-cta--quiet', className)}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      <span>{children}</span>
      <span className="cat-cta__knob" aria-hidden="true">
        {glyph}
      </span>
    </button>
  )
}

/* ------------------------------------------------------- viewport gating */

/**
 * Mounts its children only while they are near the viewport, and unmounts them
 * again once they are a long way off.
 *
 * `SceneCanvas` already stops the frameloop offscreen, but a mounted canvas
 * still holds a live WebGL context and browsers hard-cap those at roughly 16
 * per page. A catalog of thirty cards would blow through that and start losing
 * contexts, so the gate keeps the number of live canvases to about a screen
 * and a half. The two margins are deliberately asymmetric: enter early, leave
 * late, so scrolling back up a few hundred pixels never re-creates a context.
 */
export function ViewportGate({
  children,
  placeholder = null,
  enterMargin = '320px',
  exitMargin = '1600px',
  className,
  style,
}: {
  children: ReactNode
  placeholder?: ReactNode
  enterMargin?: string
  exitMargin?: string
  className?: string
  style?: CSSProperties
}) {
  const host = useRef<HTMLDivElement>(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setLive(true)
      return
    }
    const enter = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setLive(true)
      },
      { rootMargin: enterMargin, threshold: 0 },
    )
    const leave = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) setLive(false)
      },
      { rootMargin: exitMargin, threshold: 0 },
    )
    enter.observe(el)
    leave.observe(el)
    return () => {
      enter.disconnect()
      leave.disconnect()
    }
  }, [enterMargin, exitMargin])

  return (
    <div ref={host} className={className} style={style}>
      {live ? children : placeholder}
    </div>
  )
}
