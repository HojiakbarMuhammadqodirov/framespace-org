import { useId, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

type Common = { label?: string; error?: string; hint?: string }

/** The ids a control should be described by: its hint and its error, when present. */
function describedBy(id: string, { hint, error }: Common, own?: string) {
  const ids = [own, hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean)
  return ids.length ? ids.join(' ') : undefined
}

function Wrap({
  id,
  label,
  error,
  hint,
  required,
  children,
}: Common & { id: string; required?: boolean; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="fs-field">
      {label && (
        <label className="fs-field__label" htmlFor={id}>
          {label}
          {required && (
            <>
              <span aria-hidden="true"> *</span>
              <span className="sr-only"> {t('form.required', { defaultValue: 'majburiy' })}</span>
            </>
          )}
        </label>
      )}
      {children}
      {/* The hint stays visible next to an error: it usually explains the
          format the error is complaining about. */}
      {hint && (
        <p className="fs-field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {/* Always mounted (and never display:none) so the live region exists
          before the message arrives; a region inserted together with its text
          is often not announced. Empty, it collapses in CSS. */}
      <p className="fs-field__error" id={`${id}-error`} aria-live="polite">
        {error}
      </p>
    </div>
  )
}

export function Input({
  label,
  error,
  hint,
  className,
  id,
  'aria-describedby': own,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & Common) {
  const auto = useId()
  const inputId = id || auto
  return (
    <Wrap id={inputId} label={label} error={error} hint={hint} required={rest.required}>
      <input
        id={inputId}
        className={cn('fs-input', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, { hint, error }, own)}
        {...rest}
      />
    </Wrap>
  )
}

export function Textarea({
  label,
  error,
  hint,
  className,
  id,
  'aria-describedby': own,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & Common) {
  const auto = useId()
  const inputId = id || auto
  return (
    <Wrap id={inputId} label={label} error={error} hint={hint} required={rest.required}>
      <textarea
        id={inputId}
        className={cn('fs-textarea', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, { hint, error }, own)}
        {...rest}
      />
    </Wrap>
  )
}

export function Select({
  label,
  error,
  hint,
  className,
  id,
  children,
  'aria-describedby': own,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & Common) {
  const auto = useId()
  const inputId = id || auto
  return (
    <Wrap id={inputId} label={label} error={error} hint={hint} required={rest.required}>
      <select
        id={inputId}
        className={cn('fs-select', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, { hint, error }, own)}
        {...rest}
      >
        {children}
      </select>
    </Wrap>
  )
}

export function Slider({
  label,
  valueLabel,
  className,
  id,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; valueLabel?: string }) {
  const auto = useId()
  const inputId = id || auto
  return (
    <div className="fs-field">
      {(label || valueLabel) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          {label && (
            <label className="fs-field__label" htmlFor={inputId}>
              {label}
            </label>
          )}
          {valueLabel && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--step--1)' }}>
              {valueLabel}
            </span>
          )}
        </div>
      )}
      <input id={inputId} type="range" className={cn('fs-slider', className)} {...rest} />
    </div>
  )
}
