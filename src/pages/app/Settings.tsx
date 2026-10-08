import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { TextReveal } from '@/ui/TextReveal'
import { RevealGroup, RevealItem } from '@/ui/Reveal'
import { Seo } from '@/lib/seo'
import { LANGUAGES } from '@/i18n/config'
import { usePrefs, type Currency, type Theme } from '@/store/prefs'
import { useProjects, useSaved } from '@/store/projects'
import { useSession } from '@/store/session'
import { clearRecords } from '@/features/capture/store'
import { radioProps, useDateFormat } from '@/features/capture/hooks'
import { UZS_PER_USD, localeTagOf } from '@/features/capture/money'
import { formatMoney } from '@/lib/styles.js'
import { AppStyles, ArrowCta, Bezel, Eyebrow, RevealBlur } from './Dashboard'

/**
 * /app/settings — language, currency, theme, account, local data.
 *
 * The first three are NOT duplicated here: they read and write the existing
 * `usePrefs` store, which already owns i18n switching, the <html data-theme>
 * attribute and the theme-color meta tag.
 *
 * The account section reads the server-backed session (/api/auth/me). "Log
 * out" ends the cookie session; "erase everything" also signs out and empties
 * this browser's local projects and saved pieces.
 */

const CSS = `
.fsg-row {
  display: grid;
  gap: var(--s4);
  padding-block: var(--s6);
  border-top: 1px solid var(--hairline);
  align-items: start;
}
.fsg-rowwrap:first-child .fsg-row { border-top: 0; padding-top: 0; }
@media (min-width: 720px) {
  .fsg-row { grid-template-columns: minmax(0, 18rem) minmax(0, 1fr); gap: var(--s8); align-items: center; }
  .fsg-row__control { justify-self: end; }
}
.fsg-row__label {
  font-family: var(--font-display);
  font-size: var(--step-1);
  color: var(--text-strong);
  line-height: var(--lh-tight);
}
.fsg-row__hint { margin-top: var(--s1); color: var(--text-muted); font-size: var(--step--1); }
.fsg-row__value {
  font-family: var(--font-mono);
  font-size: var(--step--1);
  letter-spacing: 0.06em;
  color: var(--text-strong);
  overflow-wrap: anywhere;
}
.fsg-set { display: flex; gap: var(--s2); flex-wrap: wrap; }
@media (min-width: 720px) { .fsg-set { justify-content: flex-end; } }
.fsg-row__note {
  margin-top: var(--s3);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
@media (min-width: 720px) { .fsg-row__note { text-align: right; } }
.fsg-count {
  font-family: var(--font-display);
  font-size: var(--step-2);
  line-height: 1;
  color: var(--text-strong);
  font-variant-numeric: lining-nums tabular-nums;
}
.fsg-section { margin-top: var(--s12); }
.fsg-danger { color: var(--err); }
.fsg-danger .fsd-cta__orb { background: color-mix(in srgb, var(--err) 14%, transparent); }
`

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="fsg-row">
      <div>
        <div className="fsg-row__label">{label}</div>
        {hint && <div className="fsg-row__hint">{hint}</div>}
      </div>
      <div className="fsg-row__control">{children}</div>
    </div>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  name,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  name: string
}) {
  return (
    <div className="fsg-set" role="radiogroup" aria-label={name}>
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          className="fs-chip"
          data-selected={option.value === value}
          {...radioProps(
            options.map((o) => o.value),
            value,
            index,
            onChange
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Settings() {
  const { t } = useTranslation()
  const format = useDateFormat()

  const lang = usePrefs((s) => s.lang)
  const setLang = usePrefs((s) => s.setLang)
  const currency = usePrefs((s) => s.currency)
  const setCurrency = usePrefs((s) => s.setCurrency)
  const theme = usePrefs((s) => s.theme)
  const setTheme = usePrefs((s) => s.setTheme)

  const user = useSession((s) => s.user)
  const logOut = useSession((s) => s.logOut)
  const forgetEverything = useSession((s) => s.forgetEverything)

  const projects = useProjects((s) => s.projects)
  const hydrate = useProjects((s) => s.hydrate)
  const savedItems = useSaved((s) => s.items)
  const clearSaved = useSaved((s) => s.clear)

  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  function eraseEverything() {
    // Local only. Projects go through the frozen storage helper's own API.
    for (const project of projects) useProjects.getState().remove(project.id)
    // The capture feature's own slice (compass trails, "before" photos — also
    // for projects the archive already evicted) and any half-finished capture.
    clearRecords()
    try {
      // DRAFT_KEY in features/capture/useCaptureFlow.ts.
      sessionStorage.removeItem('framespace.capture.draft')
    } catch {
      // Storage blocked: there is no draft to remove either.
    }
    clearSaved()
    void forgetEverything()
    setConfirming(false)
  }

  return (
    <>
      <AppStyles />
      <style href="fs-app-settings" precedence="medium">
        {CSS}
      </style>
      <Seo
        title={`${t('app.settings.eyebrow')} — ${t('brand.name')}`}
        description={t('app.settings.lead')}
        path="/app/settings"
      />

      <section className="fsd-page">
        <div className="fs-container" style={{ maxWidth: '58rem' }}>
          <RevealBlur>
            <Eyebrow>{t('app.settings.eyebrow')}</Eyebrow>
            <TextReveal
              as="h1"
              text={t('app.settings.title')}
              delay={0.06}
              duration={0.6}
              stagger={0.035}
              className="fs-display"
              style={{ marginTop: 'var(--s6)', maxWidth: '12ch', fontSize: 'var(--step-4)' }}
            />
            <p className="fs-lead" style={{ marginTop: 'var(--s6)', maxWidth: '44ch' }}>
              {t('app.settings.lead')}
            </p>
          </RevealBlur>

          {/* ---- appearance --------------------------------------- */}
          <RevealBlur delay={0.04}>
            <div className="fsg-section" style={{ marginTop: 'var(--s16)' }}>
              <span className="fs-label" style={{ marginBottom: 'var(--s5)', display: 'block' }}>
                {t('app.settings.sections.appearance')}
              </span>
              <Bezel>
                <RevealGroup>
                  <RevealItem className="fsg-rowwrap">
                    <Row label={t('app.settings.rows.language')} hint={t('app.settings.rows.languageHint')}>
                      <Segmented
                        name={t('app.settings.rows.language')}
                        value={lang}
                        onChange={setLang}
                        options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
                      />
                    </Row>
                  </RevealItem>

                  <RevealItem className="fsg-rowwrap">
                    <Row label={t('app.settings.rows.currency')} hint={t('app.settings.rows.currencyHint')}>
                      <Segmented<Currency>
                        name={t('app.settings.rows.currency')}
                        value={currency}
                        onChange={setCurrency}
                        options={[
                          { value: 'UZS', label: t('app.settings.rows.currencyUzs') },
                          { value: 'USD', label: t('app.settings.rows.currencyUsd') },
                        ]}
                      />
                      <p className="fsg-row__note">
                        {t('app.settings.rows.currencyRate', {
                          rate: formatMoney(UZS_PER_USD, 'UZS', localeTagOf(lang)),
                        })}
                      </p>
                    </Row>
                  </RevealItem>

                  <RevealItem className="fsg-rowwrap">
                    <Row label={t('app.settings.rows.theme')} hint={t('app.settings.rows.themeHint')}>
                      <Segmented<Theme>
                        name={t('app.settings.rows.theme')}
                        value={theme}
                        onChange={setTheme}
                        options={[
                          { value: 'light', label: t('common.themeLight') },
                          { value: 'dark', label: t('common.themeDark') },
                        ]}
                      />
                    </Row>
                  </RevealItem>
                </RevealGroup>
              </Bezel>
            </div>
          </RevealBlur>

          {/* ---- account ------------------------------------------ */}
          <RevealBlur delay={0.04}>
            <div className="fsg-section">
              <span className="fs-label" style={{ marginBottom: 'var(--s5)', display: 'block' }}>
                {t('app.settings.sections.account')}
              </span>
              <Bezel>
                {user ? (
                  <RevealGroup>
                    <RevealItem className="fsg-rowwrap">
                      <Row label={t('app.settings.rows.name')}>
                        <span className="fsg-row__value">{user.name}</span>
                      </Row>
                    </RevealItem>
                    <RevealItem className="fsg-rowwrap">
                      <Row label={t('app.settings.rows.email')}>
                        <span className="fsg-row__value">{user.email}</span>
                      </Row>
                    </RevealItem>
                    <RevealItem className="fsg-rowwrap">
                      <Row label={t('app.settings.rows.plan')}>
                        <span className="fsd-badge">
                          {t(user.plan === 'studio' ? 'app.settings.planStudio' : 'app.settings.planFree')}
                        </span>
                      </Row>
                    </RevealItem>
                    <RevealItem className="fsg-rowwrap">
                      <Row label={t('app.settings.rows.member')}>
                        <span className="fsg-row__value">{format(user.createdAt)}</span>
                      </Row>
                    </RevealItem>
                    <RevealItem className="fsg-rowwrap">
                      <Row label={t('app.settings.logout')}>
                        <ArrowCta variant="quiet" onClick={() => void logOut()}>
                          {t('app.settings.logout')}
                        </ArrowCta>
                      </Row>
                    </RevealItem>
                  </RevealGroup>
                ) : (
                  <>
                    <h2 style={{ fontSize: 'var(--step-2)' }}>{t('app.settings.guest.title')}</h2>
                    <p
                      style={{
                        marginTop: 'var(--s4)',
                        color: 'var(--text-muted)',
                        maxWidth: '44ch',
                      }}
                    >
                      {t('app.settings.guest.body')}
                    </p>
                    <div
                      style={{
                        marginTop: 'var(--s6)',
                        display: 'flex',
                        gap: 'var(--s4)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <ArrowCta to="/signup">{t('nav.signup')}</ArrowCta>
                      <ArrowCta variant="quiet" to="/login">
                        {t('nav.login')}
                      </ArrowCta>
                    </div>
                  </>
                )}

                <hr className="fs-rule" style={{ marginTop: 'var(--s6)' }} />
                <p
                  style={{
                    marginTop: 'var(--s5)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    lineHeight: 1.7,
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted)',
                  }}
                >
                  {t('app.auth.notice')}
                </p>
              </Bezel>
            </div>
          </RevealBlur>

          {/* ---- local data --------------------------------------- */}
          <RevealBlur delay={0.04}>
            <div className="fsg-section">
              <span className="fs-label" style={{ marginBottom: 'var(--s5)', display: 'block' }}>
                {t('app.settings.sections.data')}
              </span>
              <Bezel tone="sunken">
                <RevealGroup>
                  <RevealItem className="fsg-rowwrap">
                    <Row label={t('app.settings.data.projects', { count: projects.length })}>
                      <span className="fsg-count">{projects.length}</span>
                    </Row>
                  </RevealItem>
                  <RevealItem className="fsg-rowwrap">
                    <Row label={t('app.settings.data.saved', { count: savedItems.length })}>
                      <span className="fsg-count">{savedItems.length}</span>
                    </Row>
                  </RevealItem>
                  <RevealItem className="fsg-rowwrap">
                    <Row label={t('app.settings.data.forget')} hint={t('app.settings.data.forgetHint')}>
                      {confirming ? (
                        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span role="alert" style={{ fontSize: 'var(--step--1)', color: 'var(--err)' }}>
                            {t('app.settings.data.confirm')}
                          </span>
                          <ArrowCta variant="quiet" className="fsg-danger" onClick={eraseEverything}>
                            {t('app.settings.data.forget')}
                          </ArrowCta>
                          <button
                            type="button"
                            className="fs-chip"
                            onClick={() => setConfirming(false)}
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      ) : (
                        <ArrowCta variant="quiet" className="fsg-danger" onClick={() => setConfirming(true)}>
                          {t('app.settings.data.forget')}
                        </ArrowCta>
                      )}
                    </Row>
                  </RevealItem>
                </RevealGroup>
              </Bezel>
            </div>
          </RevealBlur>
        </div>
      </section>
    </>
  )
}

export default Settings
