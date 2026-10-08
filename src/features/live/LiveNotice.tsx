import type { ReactNode } from 'react'

import { Button } from '@/ui/Button'

/**
 * Every failure this screen can hit, drawn the same way.
 *
 * Permission denied, no sensors, no renders, offline, no WebGL, no WebXR, a
 * panorama that would not stitch — each one is a designed state with a code, a
 * sentence that says what actually happened and, where one exists, the way
 * out. None of them is a toast and none of them is a spinner.
 *
 * Laid out as an editorial block: mono code, hairline rule, serif line, one
 * paragraph, actions. Left-aligned and set in a measure — not a centred card,
 * which is what every one of these screens looks like everywhere else.
 */

const CSS = `
.fsl-notice {
  min-height: 100dvh;
  display: grid;
  align-content: center;
  gap: var(--s6);
  padding: var(--s16) var(--gutter) var(--s24);
  max-width: 44rem;
  margin-inline: auto;
}
.fsl-notice__code {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: var(--s3);
}
.fsl-notice__code::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--hairline);
}
.fsl-notice__title {
  font-family: var(--font-display);
  font-size: var(--step-3);
  line-height: var(--lh-tight);
  letter-spacing: var(--tracking-display);
  color: var(--text-strong);
  max-width: 18ch;
  margin: 0;
}
.fsl-notice__body {
  color: var(--text-muted);
  max-width: 48ch;
  line-height: var(--lh-body);
  margin: 0;
}
.fsl-notice__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s3);
  margin-top: var(--s2);
}
.fsl-notice__aside {
  border-top: 1px solid var(--hairline);
  padding-top: var(--s5);
  color: var(--text-muted);
  font-size: var(--step--1);
  max-width: 48ch;
}
@media (min-width: 768px) {
  .fsl-notice { padding-block: var(--s24); }
  .fsl-notice__title { font-size: var(--step-4); }
}
`

export interface LiveNoticeProps {
  code: string
  title: string
  body: string
  /** Primary action. Rendered with the button-in-button well. */
  action?: { label: string; onClick: () => void }
  secondary?: { label: string; onClick: () => void }
  children?: ReactNode
  figure?: ReactNode
}

export function LiveNotice({
  code,
  title,
  body,
  action,
  secondary,
  children,
  figure,
}: LiveNoticeProps) {
  return (
    <div className="fsl-notice">
      <style href="fs-live-notice" precedence="medium">
        {CSS}
      </style>

      <span className="fsl-notice__code">{code}</span>
      {figure}
      <h1 className="fsl-notice__title">{title}</h1>
      <p className="fsl-notice__body">{body}</p>

      {(action || secondary) && (
        <div className="fsl-notice__actions">
          {action && (
            <Button variant="primary" arrow onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondary && (
            <Button variant="secondary" onClick={secondary.onClick}>
              {secondary.label}
            </Button>
          )}
        </div>
      )}

      {children ? <div className="fsl-notice__aside">{children}</div> : null}
    </div>
  )
}

/**
 * The stroke-only drawing that sits above the notice title. Deliberately the
 * same drafting language as the landing page: hairline rules, one accent mark,
 * no fills.
 */
export function NoticeFigure({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 200 84"
      width="100%"
      fill="none"
      aria-hidden="true"
      style={{ maxWidth: 260, height: 'auto', display: 'block' }}
    >
      {children}
    </svg>
  )
}
