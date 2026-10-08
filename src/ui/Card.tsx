import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cardCaption, cardMedia } from '@/design/motion'
import { cn } from '@/lib/cn'

export function Card({
  children,
  interactive,
  className,
}: {
  children: ReactNode
  interactive?: boolean
  className?: string
}) {
  return (
    <div className={cn('fs-card', interactive && 'fs-card--interactive', className)}>{children}</div>
  )
}

const MotionLink = motion.create(Link)

/**
 * The hover behaviour from §3: the media scales 1.04 inside a fixed frame and
 * the caption rises 6px. `rest`/`hover` are driven by the parent so both move
 * together.
 *
 * With `to`, the whole card is the link. Without it the card is not focusable:
 * a tab stop that does nothing on Enter is worse than none.
 */
export function MediaCard({
  media,
  eyebrow,
  title,
  meta,
  to,
  className,
}: {
  media: ReactNode
  eyebrow?: string
  title: ReactNode
  meta?: ReactNode
  to?: string
  className?: string
}) {
  const body = (
    <>
      <div className="fs-card__frame">
        <motion.div variants={cardMedia} style={{ height: '100%' }}>
          {media}
        </motion.div>
      </div>
      <motion.div className="fs-card__body" variants={cardCaption}>
        {eyebrow && <span className="fs-label">{eyebrow}</span>}
        <h3 style={{ fontSize: 'var(--step-2)', lineHeight: 'var(--lh-tight)' }}>{title}</h3>
        {meta && (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--step--1)' }}>{meta}</p>
        )}
      </motion.div>
    </>
  )

  const motionProps = {
    className: cn('fs-card fs-card--interactive', className),
    initial: 'rest',
    animate: 'rest',
    whileHover: 'hover',
  } as const

  if (to) {
    return (
      <MotionLink
        to={to}
        {...motionProps}
        whileFocus="hover"
        style={{ color: 'inherit', textDecoration: 'none' }}
      >
        {body}
      </MotionLink>
    )
  }

  return <motion.div {...motionProps}>{body}</motion.div>
}
