import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { aa, contrast, palette } from '@/design/theme'
import { EASE, reveal, staggerParent } from '@/design/motion'
import { LANGUAGES, type LanguageCode } from '@/i18n/config'
import { usePrefs } from '@/store/prefs'
import { STYLES } from '@/lib/styles'

import { Button } from '@/ui/Button'
import { Card, MediaCard } from '@/ui/Card'
import { Chip } from '@/ui/Chip'
import { DimensionLine } from '@/ui/DimensionLine'
import { Input, Select, Slider, Textarea } from '@/ui/Field'
import { Logo } from '@/ui/Logo'
import { BeforeAfter } from '@/ui/BeforeAfter'
import { CardSkeleton, ProgressBar, Skeleton } from '@/ui/Skeleton'
import { CountUp } from '@/ui/CountUp'

/* ------------------------------------------------------------------ shell */

function Section({
  index,
  title,
  children,
}: {
  index: string
  title: string
  children: ReactNode
}) {
  return (
    <section style={{ paddingBlock: 'var(--s16)' }}>
      <hr className="fs-rule" />
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 'var(--s4)',
          paddingBlock: 'var(--s6)',
        }}
      >
        <span className="fs-label">{index}</span>
        <h2 style={{ fontSize: 'var(--step-3)' }}>{title}</h2>
      </header>
      {children}
    </section>
  )
}

function Row({ children, gap = 'var(--s3)' }: { children: ReactNode; gap?: string }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap, alignItems: 'center' }}>{children}</div>
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontSize: 'var(--step--1)',
        color: 'var(--text-muted)',
        marginTop: 'var(--s3)',
        maxWidth: '60ch',
      }}
    >
      {children}
    </p>
  )
}

/* ------------------------------------------------------------------ colour */

const RAMP: Array<[string, string]> = [
  ['clay-900', palette.clay900],
  ['clay-700', palette.clay700],
  ['clay-500', palette.clay500],
  ['clay-300', palette.clay300],
  ['sand-200', palette.sand200],
  ['paper', palette.paper],
  ['white', palette.white],
]

const STATUS: Array<[string, string]> = [
  ['accent', palette.accent],
  ['accent-ink', palette.accentInk],
  ['ok', palette.ok],
  ['warn', palette.warn],
  ['warn-ink', palette.warnInk],
  ['err', palette.err],
]

function Swatch({ name, hex }: { name: string; hex: string }) {
  return (
    <div style={{ minWidth: 128 }}>
      <div
        style={{
          height: 72,
          background: hex,
          borderRadius: 'var(--radius)',
          border: '1px solid var(--hairline)',
        }}
      />
      <div style={{ marginTop: 'var(--s2)' }}>
        <div style={{ fontSize: 'var(--step--1)' }}>{name}</div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--step--2)',
            color: 'var(--text-muted)',
          }}
        >
          {hex.toUpperCase()}
        </div>
      </div>
    </div>
  )
}

function ContrastTable() {
  const { t } = useTranslation()
  const rows = [...RAMP, ...STATUS]
    .filter(([name]) => name !== 'paper' && name !== 'white')
    .map(([name, hex]) => {
      // Measured against the page background, which is what everything sits on.
      const ratio = contrast(hex, palette.paper)
      return { name, hex, ratio, verdict: aa(ratio) }
    })

  const badge = (verdict: ReturnType<typeof aa>) => {
    const map = {
      pass: { label: t('styleguide.pass'), color: 'var(--ok)' },
      'large-only': { label: t('styleguide.largeOnly'), color: 'var(--warn-ink)' },
      fail: { label: t('styleguide.fail'), color: 'var(--err)' },
    } as const
    const entry = map[verdict]
    return (
      <span style={{ color: entry.color, fontSize: 'var(--step--1)' }}>
        {verdict === 'pass' ? '●' : verdict === 'large-only' ? '◐' : '○'} {entry.label}
      </span>
    )
  }

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
          <thead>
            <tr>
              {['Token', t('styleguide.onPaper'), t('styleguide.ratio'), t('styleguide.verdict')].map(
                (h) => (
                  <th
                    key={h}
                    className="fs-label"
                    style={{ textAlign: 'left', paddingBlock: 'var(--s3)' }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} style={{ borderTop: '1px solid var(--hairline)' }}>
                <td style={{ paddingBlock: 'var(--s3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--step--2)' }}>
                  {row.name}
                </td>
                <td style={{ paddingBlock: 'var(--s3)' }}>
                  <span style={{ color: row.hex, fontSize: 'var(--step-0)' }}>Aa — 17px</span>
                </td>
                <td
                  style={{
                    paddingBlock: 'var(--s3)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--step--2)',
                  }}
                >
                  {row.ratio.toFixed(2)}:1
                </td>
                <td style={{ paddingBlock: 'var(--s3)' }}>{badge(row.verdict)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Note>{t('styleguide.contrastNote')}</Note>
    </>
  )
}

/* ------------------------------------------------------------------- motion */

function MotionLab() {
  const [key, setKey] = useState(0)
  const { t } = useTranslation()

  return (
    <div>
      <Row>
        <Button variant="secondary" size="sm" onClick={() => setKey((k) => k + 1)}>
          {t('styleguide.playMotion')}
        </Button>
      </Row>

      <motion.div
        key={key}
        variants={staggerParent}
        initial="hidden"
        animate="visible"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'var(--s4)',
          marginTop: 'var(--s6)',
        }}
      >
        {['reveal', 'stagger 60ms', 'y 24 → 0', 'opacity 0 → 1'].map((label) => (
          <motion.div
            key={label}
            variants={reveal}
            style={{
              padding: 'var(--s5)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg-raised)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--step--2)',
              color: 'var(--text-muted)',
            }}
          >
            {label}
          </motion.div>
        ))}
      </motion.div>

      {/* page wipe */}
      <div
        style={{
          position: 'relative',
          height: 96,
          marginTop: 'var(--s6)',
          overflow: 'hidden',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          background: 'var(--bg-sunken)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <span className="fs-label">page transition</span>
        <motion.div
          key={`wipe-${key}`}
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: [0, 1, 1, 0], originX: [0, 0, 1, 1] }}
          transition={{ duration: 1, ease: EASE, times: [0, 0.35, 0.55, 1] }}
          style={{ position: 'absolute', inset: 0, background: 'var(--clay-900)' }}
        />
      </div>

      <Note>
        Easing <code style={{ fontFamily: 'var(--font-mono)' }}>cubic-bezier(.22,1,.36,1)</code>,
        durations 180–420&nbsp;ms, transform and opacity only. Under{' '}
        <code style={{ fontFamily: 'var(--font-mono)' }}>prefers-reduced-motion</code> every
        duration collapses to 0 — the end state is still reached, so nothing is left invisible.
      </Note>
    </div>
  )
}

/* ------------------------------------------------------------------- blocks */

function RoomSketch({ tone = 'var(--clay-300)' }: { tone?: string }) {
  // Stroke-only blueprint illustration — the §2 alternative to stock imagery.
  return (
    <svg viewBox="0 0 320 240" width="100%" height="100%" fill="none" aria-hidden="true">
      <rect x="0" y="0" width="320" height="240" fill="var(--bg-sunken)" />
      <g stroke={tone} strokeWidth="1.25">
        <path d="M24 176 L24 64 L296 64 L296 176" />
        <path d="M24 176 L296 176" />
        <rect x="56" y="88" width="72" height="56" />
        <path d="M92 88 L92 144" />
        <rect x="176" y="120" width="104" height="40" rx="4" />
        <path d="M176 152 L280 152" />
        <circle cx="152" cy="40" r="10" />
        <path d="M152 50 L152 64" />
      </g>
      <g stroke="var(--hairline)" strokeWidth="1">
        <path d="M24 200 L296 200" />
        <path d="M24 194 L24 206 M296 194 L296 206" />
      </g>
      <text
        x="160"
        y="216"
        textAnchor="middle"
        fill="var(--text-muted)"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em' }}
      >
        3.40 m
      </text>
    </svg>
  )
}

/* --------------------------------------------------------------------- page */

export default function Styleguide() {
  const { t } = useTranslation()
  const { lang, setLang, theme, toggleTheme, currency, setCurrency } = usePrefs()
  const [budget, setBudget] = useState(12_000_000)
  const [style, setStyle] = useState(STYLES[1].name)
  const [loading, setLoading] = useState(false)

  return (
    <div className="fs-container" style={{ paddingBlock: 'var(--s12)' }}>
      <ProgressBar active={loading} />

      {/* header */}
      <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s6)' }}>
        <Row gap="var(--s6)">
          <Logo size={30} />
          <span style={{ flex: 1 }} />
          <Row gap="var(--s2)">
            {LANGUAGES.map((l) => (
              <Chip key={l.code} selected={lang === l.code} onClick={() => setLang(l.code as LanguageCode)}>
                {l.label}
              </Chip>
            ))}
            <Chip onClick={toggleTheme} aria-label={t('a11y.toggleTheme')}>
              {theme === 'dark' ? t('common.themeLight') : t('common.themeDark')}
            </Chip>
          </Row>
        </Row>

        <div>
          <span className="fs-label">00 — {t('styleguide.title')}</span>
          <h1 className="fs-display" style={{ marginTop: 'var(--s4)' }}>
            {t('brand.tagline')}
          </h1>
          <p className="fs-lead" style={{ marginTop: 'var(--s5)' }}>
            {t('styleguide.subtitle')}
          </p>
        </div>

        <DimensionLine value="1280" unit="px — container" />
      </header>

      {/* 01 colour */}
      <Section index="01" title={t('styleguide.sections.color')}>
        <Row gap="var(--s4)">
          {RAMP.map(([name, hex]) => (
            <Swatch key={name} name={name} hex={hex} />
          ))}
        </Row>
        <div style={{ height: 'var(--s8)' }} />
        <Row gap="var(--s4)">
          {STATUS.map(([name, hex]) => (
            <Swatch key={name} name={name} hex={hex} />
          ))}
        </Row>
        <Note>
          <strong>accent</strong> is the brand orange and is used for fills, live indicators and
          large type. <strong>accent-ink</strong> is the same orange darkened until it passes AA as
          text — every button label and accent-coloured word uses it.
        </Note>
      </Section>

      {/* 02 contrast */}
      <Section index="02" title={t('styleguide.sections.contrast')}>
        <ContrastTable />
      </Section>

      {/* 03 typography */}
      <Section index="03" title={t('styleguide.sections.type')}>
        <div style={{ display: 'grid', gap: 'var(--s6)' }}>
          <div>
            <span className="fs-label">display / step-5</span>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--step-5)', lineHeight: 'var(--lh-display)', letterSpacing: 'var(--tracking-display)', margin: 0 }}>
              Xonangiz, qayta
            </p>
          </div>
          <div>
            <span className="fs-label">display / step-3</span>
            <h2 style={{ fontSize: 'var(--step-3)' }}>Ваша комната в 3D</h2>
          </div>
          <div>
            <span className="fs-label">body / step-0 — 17px / 1.6</span>
            <p style={{ marginTop: 'var(--s2)' }}>
              The same paragraph in three scripts, so a missing glyph is obvious at a glance.
              Oʻzbekcha: oʻzingizning xonangizni suratga oling, uslub va byudjetni tanlang.
              По-русски: сфотографируйте комнату, выберите стиль и бюджет.
            </p>
          </div>
          <div>
            <span className="fs-label">mono / step--2</span>
            <p style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--tracking-mono)', textTransform: 'uppercase', fontSize: 'var(--step--2)', marginTop: 'var(--s2)' }}>
              01 — XONA · 02 — USLUB · 03 — BYUDJET
            </p>
          </div>
        </div>
        <Note>
          Display face is <strong>Cormorant Garamond</strong> — of the three serifs in the brief it
          is the only one with Cyrillic. Inter Tight sits second in the stack so the Uzbek{' '}
          <span style={{ fontFamily: 'var(--font-display)' }}>oʻ / gʻ</span> still renders if the
          serif lacks U+02BB. Check the two lines above in the live page before we commit to it.
        </Note>
      </Section>

      {/* 04 buttons */}
      <Section index="04" title={t('styleguide.sections.buttons')}>
        <Row>
          <Button arrow>{t('common.start')}</Button>
          <Button variant="secondary">{t('common.continue')}</Button>
          <Button variant="ghost">{t('common.back')}</Button>
          <Button disabled>{t('common.save')}</Button>
        </Row>
        <div style={{ height: 'var(--s5)' }} />
        <Row>
          <Button size="sm">Small</Button>
          <Button size="lg" arrow>
            Large
          </Button>
        </Row>
        <div style={{ height: 'var(--s5)' }} />
        <Row>
          {STYLES.slice(0, 5).map((s) => (
            <Chip
              key={s.name}
              swatch={s.swatch}
              selected={style === s.name}
              onClick={() => setStyle(s.name)}
            >
              {t(`styles.${s.name}`, { defaultValue: s.name })}
            </Chip>
          ))}
        </Row>
        <Note>
          Hover a primary button on a desktop pointer: the fill wipes from the left, the label
          shifts 2&nbsp;px, the arrow slides 4&nbsp;px, and the button pulls up to 8&nbsp;px toward
          the cursor. Press is 0.98. The chip labels translate; the value sent to the API stays the
          English style name, because that string is part of the contract.
        </Note>
      </Section>

      {/* 05 inputs */}
      <Section index="05" title={t('styleguide.sections.inputs')}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 'var(--s6)',
          }}
        >
          <Input label="Xona nomi" placeholder="Mehmonxona" />
          <Input label="Email" type="email" defaultValue="not-an-email" error="Email noto'g'ri." />
          <Select
            label={t('common.currency')}
            value={currency}
            onChange={(e) => setCurrency(e.target.value as 'UZS' | 'USD')}
          >
            <option value="UZS">UZS — so'm</option>
            <option value="USD">USD — dollar</option>
          </Select>
          <Slider
            label="Byudjet"
            min={2_000_000}
            max={80_000_000}
            step={500_000}
            value={budget}
            valueLabel={new Intl.NumberFormat('uz-UZ').format(budget) + ' UZS'}
            onChange={(e) => setBudget(Number(e.target.value))}
          />
          <Textarea label="Izoh" placeholder="Nima xohlaysiz?" />
        </div>
        <Note>
          Every control is at least 44&nbsp;px tall and inputs are 16&nbsp;px so iOS does not zoom
          on focus. Tab through them to see the focus ring.
        </Note>
      </Section>

      {/* 06 cards */}
      <Section index="06" title={t('styleguide.sections.cards')}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--s6)',
          }}
        >
          <MediaCard
            media={<RoomSketch />}
            eyebrow="01 — Xona"
            title="Mehmonxona"
            meta="3.40 × 4.20 m · Japandi"
          />
          <MediaCard
            media={<RoomSketch tone="var(--accent)" />}
            eyebrow="02 — Uslub"
            title="Modern Uzbek"
            meta="12 000 000 UZS"
          />
          <Card>
            <div className="fs-card__body">
              <span className="fs-label">plain card</span>
              <h3 style={{ fontSize: 'var(--step-2)' }}>No hover</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--step--1)' }}>
                Used for static content blocks.
              </p>
            </div>
          </Card>
        </div>

        <div style={{ height: 'var(--s8)' }} />
        <BeforeAfter
          before={<RoomSketch />}
          after={<RoomSketch tone="var(--accent)" />}
          className="fs-ba--demo"
        />
        <Note>
          The before/after wipes once by itself, then follows the cursor without a click on
          desktop. Arrow keys move it in 2% steps.
        </Note>
      </Section>

      {/* 06b depth — the luxury layer */}
      <Section index="06b" title="Depth & materials">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--s6)',
          }}
        >
          <div className="fs-bezel fs-bezel--interactive">
            <div className="fs-bezel__core" style={{ padding: 'var(--s6)', minHeight: 150 }}>
              <span className="fs-eyebrow">
                <span className="fs-eyebrow__dot" aria-hidden="true" />
                Double bezel
              </span>
              <p style={{ marginTop: 'var(--s4)', fontSize: 'var(--step--1)', color: 'var(--text-muted)' }}>
                A tray holding a plate. Concentric radii, one inset highlight — it reads as
                machined hardware instead of a div.
              </p>
            </div>
          </div>

          <div className="fs-bezel fs-bezel--sm fs-bezel--sunken">
            <div className="fs-bezel__core" style={{ padding: 'var(--s6)', minHeight: 150 }}>
              <span className="fs-eyebrow">Sunken</span>
              <p style={{ marginTop: 'var(--s4)', fontSize: 'var(--step--1)', color: 'var(--text-muted)' }}>
                For anything a viewport or canvas sits inside.
              </p>
            </div>
          </div>

          <div className="fs-bezel fs-bezel--lg">
            <div className="fs-bezel__core" style={{ padding: 'var(--s6)', minHeight: 150, display: 'grid', alignContent: 'center' }}>
              <span className="fs-label">counts up in view</span>
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--step-4)', lineHeight: 1 }}>
                <CountUp to={12000000} suffix=" UZS" />
              </strong>
            </div>
          </div>
        </div>

        <Note>
          Shadows are warm-tinted and heavily diffused, never neutral black — that is what stops
          them reading as cheap on a cream background. Behind everything sit two very wide warm
          washes and a fractal-noise grain, both fixed so they paint once.
        </Note>
      </Section>

      {/* 07 motion */}
      <Section index="07" title={t('styleguide.sections.motion')}>
        <MotionLab />
      </Section>

      {/* 08 feedback */}
      <Section index="08" title={t('styleguide.sections.feedback')}>
        <Row>
          <Button
            variant="secondary"
            onClick={() => {
              setLoading(true)
              setTimeout(() => setLoading(false), 2400)
            }}
          >
            {t('common.loading')}
          </Button>
        </Row>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--s6)',
            marginTop: 'var(--s6)',
          }}
        >
          <CardSkeleton />
          <div style={{ display: 'grid', gap: 'var(--s3)', alignContent: 'start' }}>
            <Skeleton width={90} height={10} />
            <Skeleton width="80%" height={28} />
            <Skeleton width="100%" height={13} />
            <Skeleton width="60%" height={13} />
          </div>
        </div>
        <Note>
          A skeleton is shaped like the content it replaces, never a bare spinner, and the accent
          progress bar runs along the very top of the viewport.
        </Note>
      </Section>

      {/* 09 i18n */}
      <Section index="09" title={t('styleguide.sections.i18n')}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--s6)',
          }}
        >
          {LANGUAGES.map((l) => (
            <Card key={l.code}>
              <div className="fs-card__body">
                <span className="fs-label">{l.htmlLang}</span>
                <h3 style={{ fontSize: 'var(--step-2)' }}>{l.label}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--step--1)' }}>
                  {l.code === lang ? t('brand.tagline') : '—'}
                </p>
              </div>
            </Card>
          ))}
        </div>
        <Note>
          Default is Uzbek, then the browser language, then English. The choice persists in{' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>framespace.prefs.v1</code> and sets{' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>&lt;html lang&gt;</code>.
        </Note>
      </Section>

      <hr className="fs-rule" />
      <footer style={{ paddingBlock: 'var(--s12)' }}>
        <DimensionLine value="Step 2" unit="— design system" />
      </footer>
    </div>
  )
}
