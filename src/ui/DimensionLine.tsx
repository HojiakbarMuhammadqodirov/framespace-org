/**
 * "3.40 m" as an architectural dimension line — the measurement-as-decoration
 * device from brief §2. Presentational only, so it is hidden from assistive
 * tech unless a label is supplied. With a label it becomes a single labelled
 * image: an `aria-label` on a role-less div is ignored by most readers.
 */
export function DimensionLine({
  value,
  unit = 'm',
  label,
  className,
}: {
  value: number | string
  unit?: string
  label?: string
  className?: string
}) {
  const text = `${typeof value === 'number' ? value.toFixed(2) : value} ${unit}`
  return (
    <div
      className={className ? `fs-dim ${className}` : 'fs-dim'}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <span className="fs-dim__line" />
      <span>{text}</span>
      <span className="fs-dim__line" />
    </div>
  )
}

/** Vertical variant for section edges. */
export function DimensionTick({ value, unit = 'm' }: { value: number | string; unit?: string }) {
  return (
    <span
      className="fs-label"
      aria-hidden="true"
      style={{ writingMode: 'vertical-rl', letterSpacing: '0.12em' }}
    >
      {typeof value === 'number' ? value.toFixed(2) : value} {unit}
    </span>
  )
}
