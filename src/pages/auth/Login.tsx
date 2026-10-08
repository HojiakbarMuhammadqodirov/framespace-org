import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion'
import { z } from 'zod'

import { EASE, staggerParent, transition, useMotionSafe } from '@/design/motion'
import { MaskRise, TextReveal } from '@/ui/TextReveal'
import { Seo } from '@/lib/seo'
import { cn } from '@/lib/cn'
import { AuthFailure, GUEST_FREE_GENERATIONS, useSession } from '@/store/session'
import { DESKTOP, useMediaQuery } from '@/lib/useMediaQuery'
import { Plinth, PIECE_PALETTES } from '@/pages/public/Plinth'

/**
 * The log-in page, and the editorial split both auth pages are built from.
 *
 * Talks to the real auth API (src/store/session.ts → /api/auth/*): zod
 * validation, inline field errors, server errors mapped to translated copy,
 * and a loading state that never drops focus.
 */

/* ------------------------------------------------------------------ motion */

/**
 * One field's entrance inside a staggered form — lighter than the section
 * `reveal` in motion.ts since it's cascading inside a card that is itself
 * already arriving with weight via `RevealBlur`.
 */
export const fieldReveal: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: transition('base') },
}

/** Inline validation message: animates in/out rather than snapping into the DOM. */
export const errorMotion = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
}

/** Scroll entry: fade up WITH a blur, ~700ms, never on a scroll listener. */
export function RevealBlur({
  children,
  className,
  delay = 0,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  delay?: number
  as?: 'div' | 'li'
}) {
  const reduced = useReducedMotion()
  const Tag = (as === 'li' ? motion.li : motion.div) as typeof motion.div
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: reduced ? 0 : 0.7, ease: EASE, delay: reduced ? 0 : delay }}
    >
      {children}
    </Tag>
  )
}

/* --------------------------------------------------------------- primitives */

/**
 * The double bezel from the design law: an outer shell with a hairline ring
 * and 8px of padding, and an inner core whose radius is the outer radius minus
 * that padding, so the two curves are concentric.
 */
export function Bezel({
  children,
  className,
  tone = 'raised',
}: {
  children: ReactNode
  className?: string
  tone?: 'raised' | 'sunken' | 'inverse'
}) {
  return (
    <div className={cn('fsa-bezel', className)}>
      <div className={cn('fsa-core', tone !== 'raised' && `fsa-core--${tone}`)}>{children}</div>
    </div>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="fsa-pill">{children}</span>
}

/** Button-in-button: the arrow lives in its own 32px circle, flush right. */
export function ArrowCta({
  children,
  onClick,
  type = 'button',
  disabled,
  to,
  variant = 'primary',
  className,
  busy = false,
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  /** Renders a router Link instead of a button. */
  to?: string
  variant?: 'primary' | 'quiet'
  className?: string
  /**
   * Work in flight. The button stays mounted — swapping it for a skeleton
   * dropped keyboard focus to <body> mid-submit — and the shimmer plays as
   * an overlay inside it instead.
   */
  busy?: boolean
}) {
  const body = (
    <>
      {busy && <span className="fsa-cta__shimmer fs-skeleton" aria-hidden="true" />}
      <span className="fsa-cta__label">{children}</span>
      <span className="fsa-cta__orb" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M3 13 L13 3" />
          <path d="M6 3 L13 3 L13 10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </>
  )
  const classes = cn('fsa-cta', variant === 'quiet' && 'fsa-cta--quiet', className)
  if (to) {
    return (
      <Link className={classes} to={to} aria-label={typeof children === 'string' ? children : undefined}>
        {body}
      </Link>
    )
  }
  return (
    <button
      className={classes}
      type={type}
      onClick={onClick}
      disabled={disabled}
      // aria-disabled rather than `disabled` while busy: a focused button that
      // becomes truly disabled hands focus back to <body> under the focus
      // fixup rule. The forms ignore submits while pending, and CSS stops
      // the pointer.
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      aria-label={typeof children === 'string' ? children : undefined}
    >
      {body}
    </button>
  )
}

/** Password input with a reveal toggle. Built by hand so the toggle can sit
    inside the input rather than under the label. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  autoComplete,
  disabled,
  readOnly,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  hint?: string
  autoComplete?: string
  disabled?: boolean
  /** Locks the value without dropping focus, unlike `disabled`. */
  readOnly?: boolean
  placeholder?: string
}) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(false)
  return (
    <motion.div className="fs-field fsa-field" layout="position">
      <label className="fs-field__label" htmlFor={id}>
        {label}
      </label>
      <div className="fsa-pw">
        <input
          id={id}
          className="fs-input"
          type={shown ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          readOnly={readOnly}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
        <button
          type="button"
          className="fsa-pw__toggle"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? t('app.auth.fields.hide') : t('app.auth.fields.show')}
          aria-pressed={shown}
        >
          <svg viewBox="0 0 22 14" width="20" height="13" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M1 7 C5 1.5 9 1 11 1 C13 1 17 1.5 21 7 C17 12.5 13 13 11 13 C9 13 5 12.5 1 7 Z" />
            <circle cx="11" cy="7" r="2.6" />
            {!shown && <path d="M3 13 L19 1" strokeLinecap="round" />}
          </svg>
        </button>
      </div>
      {hint && !error && (
        <p className="fsa-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      <AnimatePresence initial={false} mode="popLayout">
        {error && (
          <motion.p
            className="fs-field__error"
            id={`${id}-error`}
            role="alert"
            key="error"
            initial={reduced ? false : errorMotion.initial}
            animate={errorMotion.animate}
            exit={reduced ? { opacity: 0 } : errorMotion.exit}
            transition={{ duration: reduced ? 0 : 0.18, ease: EASE }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* -------------------------------------------------------------------- CSS */

export const AUTH_CSS = `
.fsa { padding-block: var(--s12) var(--s24); }
@media (min-width: 768px) { .fsa { padding-block: var(--s16) var(--s24); } }
.fsa-grid { display: grid; gap: var(--s12); align-items: start; }
/* Mobile: DOM order — the h1 and lead, then the form, then the argument.
   The heading has to come first so a screen reader (and a visitor who lands
   here from a CTA) knows which page this is before the fields. */
@media (min-width: 1024px) {
  .fsa-grid { grid-template-columns: minmax(0, 6fr) minmax(0, 5fr); grid-template-areas: 'art main'; gap: var(--s16); }
  .fsa-main { grid-area: main; padding-top: var(--s8); }
  .fsa-art { grid-area: art; position: sticky; top: calc(var(--hdr-offset, 88px) + var(--s4)); }
}
.fsa-title { margin-top: var(--s6); max-width: 12ch; font-size: var(--step-4); font-weight: 400; }

/* The art panel: a dark gallery wall, the piece on a plinth, the argument
   underneath. On a phone only the argument remains — no WebGL. */
.fsa-art__panel {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-3xl);
  display: grid;
  gap: var(--s8);
}
.fsa-art__panel[data-surface='inverse'] { padding: var(--s8); box-shadow: var(--shadow-raised); }
.fsa-art__top { display: flex; justify-content: space-between; gap: var(--s4); align-items: center; }
.fsa-art__brand { font-family: var(--font-display); font-style: italic; font-size: var(--step-1); color: var(--text-strong); }
.fsa-art .pl__plate { box-shadow: none; border-radius: var(--radius-2xl); }
.fsa-quote {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 400;
  font-size: clamp(1.5rem, 1rem + 1.2vw, 2.1rem);
  line-height: 1.2;
  letter-spacing: -0.015em;
  color: var(--text-strong);
  max-width: 22ch;
}
.fsa-quote::before { content: '“'; color: var(--accent); }
.fsa-quote::after { content: '”'; color: var(--accent); }
@media (min-width: 1024px) {
  .fsa-reasons--art { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--s5); }
  .fsa-reasons--art .fsa-reason { grid-template-columns: 1fr; gap: var(--s2); padding-top: var(--s4); border-top: 1px solid var(--hairline); }
}
.fsa-reason__title { display: block; font-family: var(--font-display); font-weight: 400; font-size: var(--step-1); line-height: var(--lh-tight); color: var(--text-strong); }
.fsa-reason__body { display: block; margin-top: var(--s2); color: var(--text-muted); font-size: var(--step--1); max-width: 40ch; }

.fsa-bezel {
  background: var(--bg-sunken);
  border: 1px solid var(--hairline);
  border-radius: 2rem;
  padding: var(--s2);
}
.fsa-core {
  background: var(--bg-raised);
  border-radius: calc(2rem - var(--s2));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
  padding: var(--s6);
}
.fsa-core--sunken { background: var(--bg-sunken); }
.fsa-core--inverse { background: var(--bg-inverse); color: var(--text-inverse); }
:root[data-theme='dark'] .fsa-core { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08); }
@media (min-width: 768px) { .fsa-core { padding: var(--s8); } }

.fsa-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  border-radius: 999px;
  padding: 6px var(--s4);
  border: 1px solid var(--hairline);
  background: var(--bg-sunken);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.fsa-cta {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s5);
  width: 100%;
  min-height: 56px;
  padding-left: var(--s6);
  padding-right: var(--s2);
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  background: var(--accent-ink);
  color: var(--paper);
  font-family: var(--font-ui);
  font-size: var(--step-0);
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: transform var(--d-base) var(--ease), background-color var(--d-base) var(--ease),
    border-color var(--d-base) var(--ease), color var(--d-base) var(--ease);
}
@media (hover: hover) and (pointer: fine) {
  .fsa-cta:hover { background: var(--clay-500); }
  .fsa-cta:hover .fsa-cta__orb { transform: translate3d(3px, -3px, 0) scale(1.08); }
  .fsa-cta--quiet:hover { background: var(--bg-sunken); border-color: var(--border-strong); color: var(--text-strong); }
  .fsa-pw__toggle:hover { color: var(--text-strong); background: var(--bg-sunken); }
}
.fsa-cta:active { transform: scale(0.98); }
.fsa-cta[disabled] { opacity: 0.45; pointer-events: none; }
.fsa-cta[aria-busy='true'] { pointer-events: none; cursor: progress; }
/* The loading shimmer, laid over the button rather than replacing it. */
.fsa-cta__shimmer {
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  opacity: 0.35;
}
.fsa-cta__orb {
  flex: none;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--paper) 22%, transparent);
  transition: transform var(--d-base) var(--ease);
}
.fsa-cta--quiet {
  background: var(--bg-sunken);
  border-color: var(--hairline);
  color: var(--text-strong);
}
.fsa-cta--quiet .fsa-cta__orb { background: color-mix(in srgb, var(--text-strong) 10%, transparent); }

.fsa-field .fs-input {
  transition: transform var(--d-fast) var(--ease-fluid), border-color var(--d-fast) var(--ease-fluid),
    background-color var(--d-fast) var(--ease-fluid);
}
.fsa-field .fs-input:focus-visible { transform: translateY(-1px); }

.fsa-pw { position: relative; }
.fsa-pw .fs-input { padding-right: calc(var(--tap) + var(--s3) + var(--s1)); }
.fsa-pw__toggle {
  position: absolute;
  top: 50%;
  right: var(--s3);
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: var(--tap);
  height: var(--tap);
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: color var(--d-fast) var(--ease), background-color var(--d-fast) var(--ease);
}

.fsa-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.fsa-hint { font-size: var(--step--1); color: var(--text-muted); }
.fsa-stack { display: grid; gap: var(--s5); }

.fsa-reasons { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s6); }
.fsa-reason { display: grid; grid-template-columns: 2.5rem 1fr; gap: var(--s4); align-items: start; }
.fsa-reason__n {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: 0.12em;
  color: var(--accent);
  padding-top: 0.35em;
}

.fsa-check { display: flex; align-items: flex-start; gap: var(--s3); cursor: pointer; }
.fsa-check input {
  flex: none;
  width: 20px;
  height: 20px;
  margin-top: 2px;
  accent-color: var(--accent-ink);
}
.fsa-check span { font-size: var(--step--1); color: var(--text-muted); }
.fsa-terms {
  display: inline-flex;
  align-items: center;
  min-height: var(--tap);
  margin-left: calc(20px + var(--s3));
  font-size: var(--step--1);
  color: var(--text-strong);
  text-decoration: underline;
  text-decoration-color: var(--accent);
  text-underline-offset: 3px;
}

.fsa-alert {
  display: flex;
  align-items: flex-start;
  gap: var(--s3);
  padding: var(--s4);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--err) 10%, transparent);
  color: var(--err);
  font-size: var(--step--1);
}

.fsa-switch { font-size: var(--step--1); color: var(--text-muted); }
.fsa-switch a { color: var(--text-strong); text-decoration: none; border-bottom: 1px solid var(--accent); }

.fsa-note {
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1.7;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}
`

export function AuthStyles() {
  return (
    <style href="fs-auth" precedence="medium">
      {AUTH_CSS}
    </style>
  )
}

/* ------------------------------------------------------------ redirects */

/** A same-site path, or null. Keeps `?next=` from bouncing anyone off-site
 *  and from looping back onto the auth pages themselves. */
function safePath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return null
  if (/^\/(login|signup)(?:[/?#]|$)/.test(path)) return null
  return path
}

/**
 * Where to go once signed in: the page that sent the visitor here — a route
 * guard's `location.state.from` first, then `?next=` — falling back to the
 * dashboard.
 */
export function useAuthDestination(): string {
  const location = useLocation()
  const [params] = useSearchParams()
  const from = (location.state as { from?: unknown } | null)?.from
  let candidate: string | null = null
  if (typeof from === 'string') {
    candidate = from
  } else if (from && typeof from === 'object' && 'pathname' in from) {
    const loc = from as { pathname?: string; search?: string; hash?: string }
    candidate = `${loc.pathname ?? ''}${loc.search ?? ''}${loc.hash ?? ''}`
  }
  return safePath(candidate) ?? safePath(params.get('next')) ?? '/app'
}

/** Moves focus to the first field (in form order) that has an error. */
export function focusFirstInvalid(order: Array<[key: string, id: string]>, errors: Record<string, unknown>) {
  for (const [key, id] of order) {
    if (errors[key]) {
      document.getElementById(id)?.focus()
      return
    }
  }
}

/* ------------------------------------------------------------------- shell */

type Reason = { title: string; body: string }

/**
 * The editorial split both auth pages sit in: on desktop a 3D piece on a dark
 * gallery wall beside the form; on a phone the heading, the form, then the
 * argument — and no WebGL at all.
 */
export function AuthScene({
  mode,
  children,
}: {
  mode: 'login' | 'signup'
  children: ReactNode
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const desktop = useMediaQuery(DESKTOP)
  const guestUsed = useSession((s) => s.guestGenerationsUsed)
  const guestLeft = Math.max(0, GUEST_FREE_GENERATIONS - guestUsed)

  const raw = t('app.auth.argument.items', { returnObjects: true }) as unknown
  const reasons: Reason[] = Array.isArray(raw) ? (raw as Reason[]) : []

  const other = mode === 'login' ? 'signup' : 'login'
  const piece = mode === 'login' ? ('armchair' as const) : ('sofa' as const)

  return (
    <>
      <AuthStyles />
      <Seo
        title={`${t(`app.auth.${mode}.eyebrow`)} — ${t('brand.name')}`}
        description={t(`app.auth.${mode}.lead`)}
        path={mode === 'login' ? '/login' : '/signup'}
      />

      <section className="fsa">
        <div className="fs-container">
          <div className="fsa-grid">
            {/* ---- which page this is, and the form ------------------------ */}
            <div className="fsa-main">
              <MaskRise immediate>
                <Eyebrow>{t(`app.auth.${mode}.eyebrow`)}</Eyebrow>
              </MaskRise>
              <TextReveal
                as="h1"
                className="fs-display fsa-title"
                text={t(`app.auth.${mode}.title`)}
                delay={0.08}
                immediate
              />
              <MaskRise immediate delay={0.22}>
                <p className="fs-lead" style={{ marginTop: 'var(--s5)', maxWidth: '40ch' }}>
                  {t(`app.auth.${mode}.lead`)}
                </p>
              </MaskRise>

              <RevealBlur delay={0.04}>
                <div style={{ marginTop: 'var(--s10)' }}>
                  <Bezel>{children}</Bezel>
                </div>
              </RevealBlur>

              <RevealBlur delay={0.1}>
                <p className="fsa-switch" style={{ marginTop: 'var(--s6)' }}>
                  {t(`app.auth.${mode}.switchText`)}{' '}
                  {/* Carries ?next= and the guard's state across, so switching
                      forms never loses where the visitor was headed. */}
                  <Link
                    to={{ pathname: other === 'login' ? '/login' : '/signup', search: location.search }}
                    state={location.state}
                  >
                    {t(`app.auth.${mode}.switchLink`)}
                  </Link>
                </p>

                <div style={{ marginTop: 'var(--s8)' }}>
                  <Bezel tone="sunken">
                    <h2 className="fsa-reason__title" style={{ fontSize: 'var(--step-2)' }}>
                      {t('app.auth.guest.title')}
                    </h2>
                    <p className="fsa-reason__body" style={{ marginTop: 'var(--s3)', maxWidth: '44ch' }}>
                      {t('app.auth.guest.body')}
                    </p>
                    <p className="fs-label" style={{ marginTop: 'var(--s5)' }}>
                      {guestLeft > 0 ? t('app.auth.guest.left') : t('app.auth.guest.spent')}
                    </p>
                    <div style={{ marginTop: 'var(--s5)' }}>
                      <ArrowCta variant="quiet" onClick={() => navigate('/app')}>
                        {t('app.auth.guest.cta')}
                      </ArrowCta>
                    </div>
                  </Bezel>
                </div>
              </RevealBlur>
            </div>

            {/* ---- the piece and the quiet argument ------------------------ */}
            <aside className="fsa-art" aria-labelledby="fsa-why">
              <RevealBlur delay={0.08}>
                <div className="fsa-art__panel" data-surface={desktop ? 'inverse' : undefined}>
                  {desktop && (
                    <>
                      <div className="fsa-art__top">
                        <span className="fsa-art__brand">{t('brand.name')}</span>
                        <span className="fs-label">{t('public2.modelled')}</span>
                      </div>
                      <Plinth
                        model={piece}
                        palette={mode === 'login' ? PIECE_PALETTES.terracotta : PIECE_PALETTES.oat}
                        label={t(`public2.pieces.${piece}`)}
                        tone="inverse"
                        aspect="16 / 11"
                        caption={
                          <span>
                            {mode === 'login' ? t('public2.auth.caption') : t('public2.auth.captionSignup')}
                          </span>
                        }
                      />
                      <p className="fsa-quote">{t('public2.auth.quote')}</p>
                    </>
                  )}

                  <div>
                    {!desktop && <hr className="fs-rule" style={{ marginBottom: 'var(--s10)' }} />}
                    <h2 id="fsa-why" className="fs-label">
                      {t('app.auth.argument.eyebrow')}
                    </h2>
                    <ul className="fsa-reasons fsa-reasons--art" style={{ marginTop: 'var(--s5)' }}>
                      {reasons.map((reason, i) => (
                        <li className="fsa-reason" key={reason.title}>
                          <span className="fsa-reason__n">{String(i + 1).padStart(2, '0')}</span>
                          <span>
                            <span className="fsa-reason__title">{reason.title}</span>
                            <span className="fsa-reason__body">{reason.body}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </RevealBlur>
            </aside>
          </div>
        </div>
      </section>
    </>
  )
}

/* ------------------------------------------------------- the log-in form */

type Fields = { email: string; password: string }
type Errors = Partial<Record<keyof Fields | 'form', string>>

export function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const destination = useAuthDestination()
  const logIn = useSession((s) => s.logIn)
  const pending = useSession((s) => s.pending)
  const reduced = useReducedMotion()
  const stagger = useMotionSafe(staggerParent)
  const field = useMotionSafe(fieldReveal)

  const [values, setValues] = useState<Fields>({ email: '', password: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const schema = useMemo(
    () =>
      z.object({
        email: z.email({ message: t('app.auth.errors.emailInvalid') }),
        password: z.string().min(1, { message: t('app.auth.errors.passwordRequired') }),
      }),
    [t]
  )

  function collect(next: Fields): Errors {
    const result = schema.safeParse(next)
    if (result.success) return {}
    const out: Errors = {}
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof Fields
      if (key && !out[key]) out[key] = issue.message
    }
    return out
  }

  function set<K extends keyof Fields>(key: K, value: string) {
    const next = { ...values, [key]: value }
    setValues(next)
    // Only re-validate a field the user has already left once, so the first
    // keystroke never turns the form red.
    if (touched[key]) setErrors((prev) => ({ ...prev, [key]: collect(next)[key], form: undefined }))
  }

  function blur(key: keyof Fields) {
    setTouched((prev) => ({ ...prev, [key]: true }))
    setErrors((prev) => ({ ...prev, [key]: collect(values)[key] }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const found = collect(values)
    setTouched({ email: true, password: true })
    if (Object.keys(found).length) {
      setErrors(found)
      focusFirstInvalid(
        [
          ['email', 'login-email'],
          ['password', 'login-password'],
        ],
        found
      )
      return
    }
    setErrors({})
    try {
      await logIn(values)
      navigate(destination, { replace: true })
    } catch (err) {
      const code = err instanceof AuthFailure ? err.code : 'unknown'
      if (code === 'invalidCredentials') {
        setErrors({ form: t('app.auth.errors.invalidCredentials') })
        document.getElementById('login-password')?.focus()
        return
      }
      const detail = err instanceof AuthFailure && code === 'validation' ? err.detail : undefined
      setErrors({ form: detail || t(`app.auth.errors.${code}`) })
    }
  }

  return (
    <AuthScene mode="login">
      <motion.form
        className="fsa-stack"
        onSubmit={submit}
        noValidate
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        <motion.h2 variants={field} style={{ fontSize: 'var(--step-2)' }}>
          {t('app.auth.login.submit')}
        </motion.h2>

        <AnimatePresence initial={false}>
          {errors.form && (
            <motion.p
              className="fsa-alert"
              role="alert"
              key="form-error"
              initial={reduced ? false : errorMotion.initial}
              animate={errorMotion.animate}
              exit={reduced ? { opacity: 0 } : errorMotion.exit}
              transition={{ duration: reduced ? 0 : 0.18, ease: EASE }}
            >
              <span aria-hidden="true">—</span>
              {errors.form}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.div className="fs-field fsa-field" variants={field} layout="position">
          <label className="fs-field__label" htmlFor="login-email">
            {t('app.auth.fields.email')}
          </label>
          <input
            id="login-email"
            className="fs-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            readOnly={pending}
            placeholder={t('app.auth.fields.emailPlaceholder')}
            value={values.email}
            aria-label={t('app.auth.fields.email')}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            onChange={(e) => set('email', e.target.value)}
            onBlur={() => blur('email')}
          />
          <AnimatePresence initial={false} mode="popLayout">
            {errors.email && (
              <motion.p
                className="fs-field__error"
                id="login-email-error"
                role="alert"
                key="error"
                initial={reduced ? false : errorMotion.initial}
                animate={errorMotion.animate}
                exit={reduced ? { opacity: 0 } : errorMotion.exit}
                transition={{ duration: reduced ? 0 : 0.18, ease: EASE }}
              >
                {errors.email}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div variants={field}>
          <PasswordField
            id="login-password"
            label={t('app.auth.fields.password')}
            value={values.password}
            onChange={(v) => set('password', v)}
            onBlur={() => blur('password')}
            error={errors.password}
            autoComplete="current-password"
            readOnly={pending}
            placeholder={t('app.auth.fields.passwordPlaceholder')}
          />
        </motion.div>

        {/* The button stays mounted while pending; the skeleton shimmer plays
            inside it (see ArrowCta) so focus and layout never jump. */}
        <motion.div variants={field}>
          <ArrowCta type="submit" busy={pending}>
            {pending ? `${t('app.auth.loading')}…` : t('app.auth.login.submit')}
          </ArrowCta>
          <span className="fsa-sr" role="status">
            {pending ? t('app.auth.loading') : ''}
          </span>
        </motion.div>

        <motion.div variants={field}>
          <hr className="fs-rule" />
          <p className="fsa-note">{t('app.auth.notice')}</p>
        </motion.div>
      </motion.form>
    </AuthScene>
  )
}

export default Login
