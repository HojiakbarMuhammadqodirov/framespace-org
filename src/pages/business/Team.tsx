import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

import { Seo } from '@/lib/seo'
import { cn } from '@/lib/cn'
import {
  Avatar,
  BusinessShell,
  Icon,
  Panel,
  Pill,
  SaveState,
  relativeTime,
  useSegScroll,
  type Tone,
} from '@/features/business/chrome'
import { TEAM, type TeamMember, type TeamRole, type TeamStatus } from '@/features/business/data'
import { EASE } from '@/design/motion'
import { Reveal } from '@/ui/Reveal'

/**
 * §10 — the team.
 *
 * Roles are the point: an uploader can push a 12 MB `.glb` into the public
 * catalog, so the table shows who can do that, whether they have a second
 * factor, and when they were last here. The invite form validates the
 * address (format and duplicates), then adds a pending row locally — there is
 * no `POST /api/business/team/invite`, and the confirmation says so.
 */

const CSS = `
.tm-split { display: grid; gap: var(--s5); grid-template-columns: minmax(0, 1fr); }
.tm-side { display: grid; gap: var(--s5); grid-template-columns: minmax(0, 1fr); align-items: start; }
@media (min-width: 820px) { .tm-side { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); } }
.tm-who { display: flex; align-items: center; gap: var(--s3); min-width: 0; }
.tm-who__text { display: grid; gap: 2px; min-width: 0; }
.tm-name { color: var(--text-strong); font-weight: 600; }
.tm-mail { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); overflow-wrap: anywhere; }
.tm-fa { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; }
.tm-fa--ok { color: var(--ok); }
.tm-fa--no { color: var(--warn-ink); }
.tm-row--new td { background: color-mix(in srgb, var(--accent) 5%, transparent); }
.tm-form { display: grid; gap: var(--s4); }
.tm-roles { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.tm-role { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--s3); padding: var(--s3) 0; border-top: 1px solid var(--hairline); }
.tm-role:first-child { border-top: 0; padding-top: 0; }
.tm-role__dot { margin-top: 6px; width: 8px; height: 8px; border-radius: 50%; background: var(--clay-300); }
.tm-role__dot--owner { background: var(--accent); }
.tm-role__key { font-weight: 600; font-size: var(--step--1); color: var(--text-strong); }
.tm-role__body { font-size: 12.5px; color: var(--text-muted); }
.tm-revoke { min-height: 30px; padding: 0 var(--s3); font-size: 12px; }

.tm-roleseg button { position: relative; }
.tm-roleseg button[aria-pressed='true'] { background: transparent; box-shadow: none; }
.tm-roleseg__thumb { position: absolute; inset: 0; border-radius: var(--radius-full); background: var(--bg-raised); box-shadow: inset 0 0 0 1px var(--hairline), var(--inset-hi); z-index: 0; }
.tm-roleseg__label { position: relative; z-index: 1; }
`

const ROLES: TeamRole[] = ['owner', 'manager', 'uploader', 'analyst', 'viewer']
const STATUS_TONE: Record<TeamStatus, Tone> = { active: 'ok', invited: 'warn', suspended: 'err' }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function Team() {
  const { t, i18n } = useTranslation()
  const reduced = useReducedMotion()
  const uid = useId()
  const [members, setMembers] = useState<Array<TeamMember & { fresh?: boolean }>>(TEAM)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('viewer')
  const [touched, setTouched] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [lastInvite, setLastInvite] = useState('')
  const timer = useRef(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const roleSeg = useSegScroll(role)
  const column = (key: string) => t(`business.team.columns.${key}`)

  const normalized = email.trim().toLowerCase()
  const duplicate = members.some((m) => m.email.toLowerCase() === normalized)
  const error = !normalized
    ? t('business.team.emailRequired')
    : !EMAIL.test(normalized)
      ? t('business.team.emailInvalid')
      : duplicate
        ? t('business.team.emailDuplicate')
        : null
  const showError = touched && error

  const activeCount = useMemo(() => members.filter((m) => m.status === 'active').length, [members])
  const pendingCount = useMemo(() => members.filter((m) => m.status === 'invited').length, [members])
  const uploaders = useMemo(
    () => members.filter((m) => m.status === 'active' && (m.role === 'uploader' || m.role === 'manager' || m.role === 'owner')),
    [members],
  )
  const noTwoFactor = useMemo(() => members.filter((m) => m.status === 'active' && !m.twoFactor), [members])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (error) {
      input.current?.focus()
      return
    }
    setStatus('saving')
    timer.current = window.setTimeout(() => {
      const name = normalized.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
      setMembers((prev) => [
        ...prev,
        {
          id: `tm-${Date.now()}`,
          name,
          email: normalized,
          role,
          status: 'invited',
          twoFactor: false,
          lastActiveAt: null,
          uploads: 0,
          fresh: true,
        },
      ])
      setLastInvite(normalized)
      setEmail('')
      setTouched(false)
      setStatus('saved')
    }, 600)
  }

  return (
    <>
      <style href="fs-biz-team" precedence="medium">
        {CSS}
      </style>
      <Seo
        title={`${t('business.team.title')} — ${t('business.meta.title')}`}
        description={t('business.team.lead')}
        path="/business/team"
      />

      <BusinessShell
        title={t('business.team.title')}
        lead={t('business.team.lead')}
        badges={
          <>
            <Pill tone="ok">{t('business.team.activeCount', { n: activeCount })}</Pill>
            {pendingCount > 0 && <Pill tone="warn">{t('business.team.pendingCount', { n: pendingCount })}</Pill>}
            <Pill tone={noTwoFactor.length ? 'err' : 'ok'}>{t('business.team.twoFactorGap', { n: noTwoFactor.length })}</Pill>
          </>
        }
      >
        <Reveal className="tm-split" blur={false}>
          <Panel title={t('business.team.membersTitle')} sub={t('business.team.membersSub', { n: members.length })} flush>
            <div className="biz-table__scroll">
              <table className="biz-table biz-table--stack">
                <caption className="biz-sr">{t('business.team.membersTitle')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{column('person')}</th>
                    <th scope="col">{column('role')}</th>
                    <th scope="col">{column('status')}</th>
                    <th scope="col">{column('twoFactor')}</th>
                    <th scope="col" className="biz-num">
                      {column('uploads')}
                    </th>
                    <th scope="col">{column('lastActive')}</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {members.map((member) => (
                      <motion.tr
                        key={member.id}
                        className={cn(member.fresh && 'tm-row--new')}
                        initial={reduced ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={reduced ? undefined : { opacity: 0 }}
                        transition={{ duration: reduced ? 0 : 0.3, ease: EASE }}
                      >
                        <td>
                          <span className="tm-who">
                            <Avatar name={member.name} />
                            <span className="tm-who__text">
                              <span className="tm-name">{member.name}</span>
                              <span className="tm-mail">{member.email}</span>
                            </span>
                          </span>
                        </td>
                        <td data-label={column('role')}>
                          <Pill tone={member.role === 'owner' ? 'accent' : 'muted'}>{t(`business.team.role.${member.role}`)}</Pill>
                        </td>
                        <td data-label={column('status')}>
                          <span style={{ display: 'inline-flex', gap: 'var(--s2)', alignItems: 'center', flexWrap: 'wrap' }}>
                            <Pill tone={STATUS_TONE[member.status]}>{t(`business.team.status.${member.status}`)}</Pill>
                            {member.fresh && (
                              <button
                                type="button"
                                className="biz-btn biz-btn--ghost tm-revoke"
                                onClick={() => setMembers((prev) => prev.filter((m) => m.id !== member.id))}
                                aria-label={t('business.team.revokeFor', { email: member.email })}
                              >
                                {t('business.team.revoke')}
                              </button>
                            )}
                          </span>
                        </td>
                        <td data-label={column('twoFactor')}>
                          {member.status === 'invited' ? (
                            <span className="biz-table__sub">—</span>
                          ) : member.twoFactor ? (
                            <span className="tm-fa tm-fa--ok">
                              <Icon name="check" size={14} />
                              {t('business.team.twoFactorOn')}
                            </span>
                          ) : (
                            <span className="tm-fa tm-fa--no">
                              <Icon name="alert" size={14} />
                              {t('business.team.twoFactorOff')}
                            </span>
                          )}
                        </td>
                        <td className="biz-num" data-label={column('uploads')}>
                          {member.uploads || '—'}
                        </td>
                        <td className="biz-table__sub" data-label={column('lastActive')}>
                          {member.lastActiveAt ? (
                            <time dateTime={member.lastActiveAt}>{relativeTime(member.lastActiveAt, i18n.language)}</time>
                          ) : (
                            t('business.team.never')
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="tm-side">
            <Panel title={t('business.team.inviteTitle')} sub={t('business.team.inviteSub')}>
              <form className="tm-form" noValidate onSubmit={submit}>
                <label className="biz-field" htmlFor={`${uid}-email`}>
                  <span className="biz-label">{t('business.team.emailLabel')}</span>
                  <input
                    ref={input}
                    id={`${uid}-email`}
                    className="biz-input"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    value={email}
                    placeholder={t('business.team.emailPlaceholder')}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      if (status === 'saved') setStatus('idle')
                    }}
                    onBlur={() => email && setTouched(true)}
                    aria-invalid={showError ? true : undefined}
                    aria-describedby={showError ? `${uid}-email-err` : undefined}
                  />
                  {showError && (
                    <span className="biz-error" id={`${uid}-email-err`}>
                      <Icon name="alert" size={13} />
                      {error}
                    </span>
                  )}
                </label>

                <div className="biz-field">
                  <span className="biz-label" id={`${uid}-role`}>
                    {column('role')}
                  </span>
                  <div
                    ref={roleSeg}
                    className={cn('biz-seg', !reduced && 'tm-roleseg')}
                    role="group"
                    aria-labelledby={`${uid}-role`}
                  >
                    {ROLES.filter((item) => item !== 'owner').map((item) => (
                      <button key={item} type="button" aria-pressed={role === item} onClick={() => setRole(item)}>
                        {!reduced && role === item && (
                          <motion.span
                            className="tm-roleseg__thumb"
                            layoutId="tm-role-thumb"
                            aria-hidden="true"
                            transition={{ duration: 0.3, ease: EASE }}
                          />
                        )}
                        <span className="tm-roleseg__label">{t(`business.team.role.${item}`)}</span>
                      </button>
                    ))}
                  </div>
                  <span className="biz-hint">{t(`business.team.roleBody.${role}`)}</span>
                </div>

                <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="submit" className="biz-btn biz-btn--primary" disabled={status === 'saving'}>
                    <Icon name="send" size={15} />
                    {t('business.team.invite')}
                  </button>
                  <SaveState state={status}>
                    {status === 'saving'
                      ? t('business.team.inviting')
                      : status === 'saved'
                        ? t('business.team.invited', { email: lastInvite })
                        : null}
                  </SaveState>
                </div>
                <span className="biz-hint">{t('business.team.inviteNote')}</span>
              </form>
            </Panel>

            <Panel title={t('business.team.rolesTitle')} sub={t('business.team.uploaderNote', { n: uploaders.length })}>
              <ul className="tm-roles">
                {ROLES.map((item) => (
                  <li className="tm-role" key={item}>
                    <span className={cn('tm-role__dot', item === 'owner' && 'tm-role__dot--owner')} aria-hidden="true" />
                    <span style={{ display: 'grid', gap: 2 }}>
                      <span className="tm-role__key">{t(`business.team.role.${item}`)}</span>
                      <span className="tm-role__body">{t(`business.team.roleBody.${item}`)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </Reveal>
      </BusinessShell>
    </>
  )
}

export default Team
