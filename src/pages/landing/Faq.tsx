import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Reveal } from '@/ui/Reveal'

/**
 * §9 — FAQ.
 *
 * A description list, because that is what a question/answer set is. Each
 * question is a real <button> inside its <dt>, so Tab/Enter/Space work exactly
 * as they did before — nothing about the keyboard behaviour changed.
 *
 * The panel's open/close is the one place the brief allows animating a layout
 * property: `<dd>` keeps `aria-hidden` + `inert` while collapsed (still fully
 * out of the accessibility tree and the tab order, same guarantee `hidden`
 * gave it before), and a nested grid track animates `grid-template-rows`
 * 0fr → 1fr plus opacity — GPU-friendlier than animating `height`, with no
 * layout thrash outside the row itself.
 *
 * Editorial two-column split on desktop: the heading holds columns 1-4 and
 * sticks while the questions scroll past in columns 6-12.
 */

type Item = { q: string; a: string }

const CSS = `
.fs-faq {
  padding-block: var(--section-y);
}
.fs-faq__head,
.fs-faq__list {
  grid-column: 1 / -1;
}
.fs-faq__list {
  margin: var(--s8) 0 0;
}
.fs-faq__row {
  position: relative;
  border-top: 1px solid var(--hairline);
}
.fs-faq__row:last-child {
  border-bottom: 1px solid var(--hairline);
}
.fs-faq__row::before {
  content: '';
  position: absolute;
  top: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--accent);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform var(--d-slow) var(--ease-fluid);
  pointer-events: none;
}
.fs-faq__row:hover::before,
.fs-faq__row:focus-within::before {
  transform: scaleX(1);
}
.fs-faq__dt {
  margin: 0;
}
.fs-faq__btn {
  display: flex;
  align-items: center;
  gap: var(--s4);
  width: 100%;
  min-height: var(--tap);
  padding: var(--s4) 0;
  background: none;
  border: 0;
  text-align: left;
  cursor: pointer;
  color: var(--text-strong);
  font-family: var(--font-display);
  font-size: clamp(1.125rem, 1rem + 0.6vw, 1.5rem);
  font-weight: 400;
  line-height: 1.3;
  letter-spacing: var(--tracking-heading);
  text-wrap: balance;
  transition: color var(--d-fast) var(--ease);
}
.fs-faq__btn:hover {
  color: var(--accent-ink);
}
.fs-faq__num {
  flex: none;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--step--2);
  font-weight: 500;
  letter-spacing: var(--tracking-mono);
}
.fs-faq__q {
  flex: 1;
}
.fs-faq__sign {
  position: relative;
  flex: none;
  width: 14px;
  height: 14px;
}
.fs-faq__sign::before,
.fs-faq__sign::after {
  content: '';
  position: absolute;
  inset: 50% 0 auto 0;
  height: 1.5px;
  margin-top: -0.75px;
  background: var(--accent);
  transition: transform var(--d-base) var(--ease);
}
.fs-faq__sign::after {
  transform: rotate(90deg);
}
.fs-faq__btn[aria-expanded='true'] .fs-faq__sign::after {
  transform: rotate(90deg) scaleX(0);
}
.fs-faq__dd {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.65;
  max-width: 62ch;
}
.fs-faq__ddrow {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows var(--d-lux) var(--ease-fluid), opacity var(--d-base) var(--ease-fluid);
}
.fs-faq__ddrow[data-expanded='true'] {
  grid-template-rows: 1fr;
  opacity: 1;
  transition: grid-template-rows var(--d-lux) var(--ease-fluid), opacity var(--d-slow) var(--ease-fluid) 0.08s;
}
.fs-faq__ddinner {
  min-height: 0;
  overflow: hidden;
  padding-bottom: var(--s5);
}
@media (min-width: 768px) {
  .fs-faq__head {
    grid-column: 1 / 5;
    position: sticky;
    /* Clears the floating header instead of sliding under it. */
    top: var(--hdr-offset, var(--s16));
    align-self: start;
  }
  .fs-faq__list {
    grid-column: 6 / 13;
    margin-top: 0;
  }
  .fs-faq__btn {
    padding-block: var(--s5);
  }
  .fs-faq__dd {
    padding-right: var(--s10);
  }
}
`

export function Faq({ headingLevel = 2 }: { headingLevel?: 2 | 3 } = {}) {
  const { t } = useTranslation()
  const Title = `h${headingLevel}` as 'h2' | 'h3'
  const uid = useId()
  const [open, setOpen] = useState<number | null>(0)

  const raw = t('landing.faq.items', { returnObjects: true }) as unknown
  const items: Item[] = Array.isArray(raw) ? (raw as Item[]) : []

  return (
    <section className="fs-faq" aria-labelledby="fs-faq-title">
      <style href="fs-landing-faq" precedence="medium">
        {CSS}
      </style>

      <div className="fs-container">
        <div className="fs-grid">
          <Reveal className="fs-faq__head">
            <span className="fs-eyebrow"><span className="fs-eyebrow__dot" aria-hidden="true" />{t('landing.faq.label')}</span>
            <Title
              id="fs-faq-title"
              className="fs-h2"
              style={{ marginTop: 'var(--s4)', fontSize: 'var(--step-3)', maxWidth: '14ch' }}
            >
              {t('landing.faq.title')}
            </Title>
          </Reveal>

          <Reveal className="fs-faq__list">
            <dl style={{ margin: 0 }}>
              {items.map((item, i) => {
                const expanded = open === i
                const panelId = `${uid}-panel-${i}`
                const buttonId = `${uid}-q-${i}`
                return (
                  <div className="fs-faq__row" key={item.q}>
                    <dt className="fs-faq__dt">
                      <button
                        type="button"
                        id={buttonId}
                        className="fs-faq__btn"
                        aria-expanded={expanded}
                        aria-controls={panelId}
                        onClick={() => setOpen(expanded ? null : i)}
                      >
                        <span className="fs-faq__num" aria-hidden="true">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="fs-faq__q">{item.q}</span>
                        <span className="fs-faq__sign" aria-hidden="true" />
                      </button>
                    </dt>
                    <dd
                      id={panelId}
                      className="fs-faq__dd"
                      role="region"
                      aria-labelledby={buttonId}
                      aria-hidden={!expanded}
                      inert={!expanded}
                    >
                      <div className="fs-faq__ddrow" data-expanded={expanded}>
                        <div className="fs-faq__ddinner">{item.a}</div>
                      </div>
                    </dd>
                  </div>
                )
              })}
            </dl>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
