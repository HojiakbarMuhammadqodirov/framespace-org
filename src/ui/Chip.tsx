import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Chip({
  selected,
  swatch,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; swatch?: string[] }) {
  return (
    <button
      type="button"
      className={cn('fs-chip', className)}
      aria-pressed={selected}
      {...rest}
    >
      {swatch?.map((hex) => (
        <span key={hex} className="fs-chip__swatch" style={{ background: hex }} aria-hidden="true" />
      ))}
      {children}
    </button>
  )
}
