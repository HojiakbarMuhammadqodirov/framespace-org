import {
  forwardRef,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ForwardedRef,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { Link, type LinkProps } from 'react-router'
import { useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

/** The visual props shared by Button and ButtonLink. */
type VisualProps = {
  variant?: Variant
  size?: Size
  block?: boolean
  /**
   * Renders the trailing arrow inside its own circular well, flush with the
   * button's right padding — never naked beside the label. On hover the well
   * translates diagonally and scales while the button itself presses down, so
   * the button has internal kinetic tension rather than just a colour change.
   */
  arrow?: boolean
  /** Custom glyph inside the well. Implies `arrow`. */
  icon?: ReactNode
  /** Magnetic pull toward the cursor, capped at 8px. Desktop pointers only. */
  magnetic?: boolean
  children?: ReactNode
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VisualProps

/** A router link that looks exactly like a Button. Use it for navigation, so
 *  there is never an `<a><button>` nesting. */
export type ButtonLinkProps = LinkProps & VisualProps

const MAX_PULL = 8

/* Matches `Magnetic` in Interactive.tsx so every magnetic surface on the site
   settles with the same weight. */
const SPRING = { stiffness: 260, damping: 26, mass: 0.5 }

/** The class list for a button-styled element. Exported for the rare surface
 *  (a <label> for a file input, say) that cannot be a Button or ButtonLink. */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  block,
  hasWell,
  className,
}: {
  variant?: Variant
  size?: Size
  block?: boolean
  hasWell?: boolean
  className?: string
}) {
  return cn(
    'fs-btn',
    `fs-btn--${variant}`,
    size !== 'md' && `fs-btn--${size}`,
    hasWell && 'fs-btn--icon',
    block && 'fs-btn--block',
    className
  )
}

/** Label plus the optional arrow well — identical markup for both elements. */
function ButtonInner({ hasWell, icon, children }: { hasWell: boolean; icon?: ReactNode; children?: ReactNode }) {
  return (
    <>
      <span className="fs-btn__label">{children}</span>
      {hasWell && (
        <span className="fs-btn__well" aria-hidden="true">
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
      )}
    </>
  )
}

/**
 * The magnetic pull, shared by both elements. Consumer mouse handlers are
 * composed with the magnet's rather than replacing them.
 */
function useMagnet<T extends HTMLElement>(
  magnetic: boolean,
  forwardedRef: ForwardedRef<T>,
  onMouseMove?: (event: MouseEvent<T>) => void,
  onMouseLeave?: (event: MouseEvent<T>) => void
) {
  const innerRef = useRef<T | null>(null)
  const reduced = useReducedMotion()

  // The pull is a MotionValue, never React state: `primary` is the default
  // variant, so a state update here would re-render most CTAs on the page at
  // mouse-event frequency. Writing the transform straight to the node keeps
  // the whole effect on the compositor and off the React render path.
  const pullX = useSpring(useMotionValue(0), SPRING)
  const pullY = useSpring(useMotionValue(0), SPRING)

  const enabled =
    magnetic &&
    !reduced &&
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px)').matches

  useEffect(() => {
    if (!enabled) return
    const write = () => {
      const node = innerRef.current
      if (!node) return
      const x = pullX.get()
      const y = pullY.get()
      node.style.transform =
        Math.abs(x) < 0.01 && Math.abs(y) < 0.01 ? '' : `translate3d(${x}px, ${y}px, 0)`
    }
    const stopX = pullX.on('change', write)
    const stopY = pullY.on('change', write)
    return () => {
      stopX()
      stopY()
    }
  }, [enabled, pullX, pullY])

  return {
    ref: (node: T | null) => {
      innerRef.current = node
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    },
    onMouseMove: (event: MouseEvent<T>) => {
      onMouseMove?.(event)
      if (!enabled || !innerRef.current) return
      const box = innerRef.current.getBoundingClientRect()
      const dx = event.clientX - (box.left + box.width / 2)
      const dy = event.clientY - (box.top + box.height / 2)
      pullX.set(Math.max(-MAX_PULL, Math.min(MAX_PULL, dx * 0.3)))
      pullY.set(Math.max(-MAX_PULL, Math.min(MAX_PULL, dy * 0.3)))
    },
    onMouseLeave: (event: MouseEvent<T>) => {
      onMouseLeave?.(event)
      pullX.set(0)
      pullY.set(0)
    },
  }
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    block,
    arrow,
    icon,
    magnetic = variant === 'primary',
    className,
    children,
    onMouseMove,
    onMouseLeave,
    ...rest
  },
  forwardedRef
) {
  const hasWell = Boolean(arrow || icon)
  const magnet = useMagnet(magnetic, forwardedRef, onMouseMove, onMouseLeave)

  return (
    <button
      // The custom cursor morphs onto anything marked this way, so the ring
      // wraps the button instead of floating over it.
      data-cursor-snap=""
      {...rest}
      ref={magnet.ref}
      className={buttonClasses({ variant, size, block, hasWell, className })}
      onMouseMove={magnet.onMouseMove}
      onMouseLeave={magnet.onMouseLeave}
    >
      <ButtonInner hasWell={hasWell} icon={icon}>
        {children}
      </ButtonInner>
    </button>
  )
})

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  {
    variant = 'primary',
    size = 'md',
    block,
    arrow,
    icon,
    magnetic = variant === 'primary',
    className,
    children,
    onMouseMove,
    onMouseLeave,
    ...rest
  },
  forwardedRef
) {
  const hasWell = Boolean(arrow || icon)
  const magnet = useMagnet(magnetic, forwardedRef, onMouseMove, onMouseLeave)

  return (
    <Link
      data-cursor-snap=""
      {...rest}
      ref={magnet.ref}
      className={buttonClasses({ variant, size, block, hasWell, className })}
      onMouseMove={magnet.onMouseMove}
      onMouseLeave={magnet.onMouseLeave}
    >
      <ButtonInner hasWell={hasWell} icon={icon}>
        {children}
      </ButtonInner>
    </Link>
  )
})
