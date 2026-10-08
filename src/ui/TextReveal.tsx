import { Fragment, createElement, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { EASE_FLUID } from '@/design/motion'
import { Accent, accentWords, plainText, renderParts } from './Accent'

/**
 * Headline reveal. Each line sits in an overflow-hidden mask and the words
 * inside rise out of it, staggered — the motion reads as type being set rather
 * than as a fade.
 *
 * Splitting happens on words, never on characters: a per-character split
 * destroys shaping for Cyrillic and breaks the Uzbek `oʻ` digraph apart.
 */
type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div'

export function TextReveal({
  text,
  as = 'h2',
  className,
  style,
  delay = 0,
  stagger = 0.045,
  duration = 0.85,
  immediate = false,
}: {
  text: string
  as?: HeadingTag
  className?: string
  style?: React.CSSProperties
  delay?: number
  stagger?: number
  duration?: number
  /** Play on mount rather than on scroll-into-view. Use above the fold (see MaskRise). */
  immediate?: boolean
}) {
  const reduced = useReducedMotion()

  if (reduced) {
    return createElement(as, { className, style }, <Accent text={text} />)
  }

  const words = accentWords(text)

  return createElement(
    as,
    { className, style, 'aria-label': plainText(text) },
    words.map((word, i) => (
        <Fragment key={`${plainWord(word)}-${i}`}>
          <span
            style={{
              display: 'inline-block',
              overflow: 'hidden',
              verticalAlign: 'bottom',
              // A mask that clips exactly at the baseline crops descenders, so
              // the box is padded and pulled back by the same amount.
              paddingBottom: '0.14em',
              marginBottom: '-0.14em',
              // Italic accents lean past their advance width; give the mask
              // room so the last letter's overhang is not shaved off.
              paddingInline: '0.06em',
              marginInline: '-0.06em',
            }}
            aria-hidden="true"
          >
            <motion.span
              // No will-change here: this fires once per word and there can be
              // dozens on a page — permanently promoting each one costs more than
              // the animation saves.
              style={{ display: 'inline-block' }}
              initial={{ y: '110%' }}
              {...(immediate
                ? { animate: { y: 0 } }
                : { whileInView: { y: 0 }, viewport: { once: true, margin: '-8% 0px' } })}
              transition={{ duration, ease: EASE_FLUID, delay: delay + i * stagger }}
            >
              {renderParts(word)}
            </motion.span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
    ))
  )
}

function plainWord(word: { text: string }[]) {
  return word.map((p) => p.text).join('')
}

/**
 * The same mask-rise for arbitrary content — a line of a paragraph, a label, a
 * row of chips.
 *
 * `immediate` plays the rise on mount instead of on scroll-into-view. Content
 * that is above the fold must never wait for an intersection callback: in the
 * hero, four of these stayed parked at their initial `y: 105%` inside the
 * clipping box, which silently hid the lead, both CTAs, the style chips and
 * the note — the page looked like it had simply lost half its markup. An
 * element that is on screen at first paint has nothing to scroll into.
 */
export function MaskRise({
  children,
  delay = 0,
  duration = 0.7,
  className,
  immediate = false,
}: {
  children: ReactNode
  delay?: number
  duration?: number
  className?: string
  immediate?: boolean
}) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>

  return (
    <span className={className} style={{ display: 'block', overflow: 'hidden' }}>
      <motion.span
        style={{ display: 'block' }}
        initial={{ y: '105%' }}
        {...(immediate
          ? { animate: { y: 0 } }
          : { whileInView: { y: 0 }, viewport: { once: true, margin: '-8% 0px' } })}
        transition={{ duration, ease: EASE_FLUID, delay }}
      >
        {children}
      </motion.span>
    </span>
  )
}
