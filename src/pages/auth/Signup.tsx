import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { z } from 'zod'

import { EASE, staggerParent, useMotionSafe } from '@/design/motion'
import { AuthFailure, useSession } from '@/store/session'
import {
  ArrowCta,
  AuthScene,
  PasswordField,
  errorMotion,
  fieldReveal,
  focusFirstInvalid,
  useAuthDestination,
} from './Login'

/**
 * Sign-up. Shares the editorial split with Login (see `AuthScene` there) so
 * the two pages are one page with a different form in it.
 *
 * Creates a real account through POST /api/auth/signup (see
 * src/store/session.ts). Server errors land on the field they belong to:
 * `email_taken` under the email input, everything else above the form.
 *
 * There is no confirm-password field: on a phone it doubled the typing for
 * the one field people mistype least — the reveal toggle shows what was typed.
 */

type Fields = {
  name: string
  email: string
  password: string
  terms: boolean
}

type Errors = Partial<Record<keyof Fields | 'form', string>>

const EMPTY: Fields = { name: '', email: '', password: '', terms: false }

/** Form order, for moving focus to the first field that needs fixing. */
const FOCUS_ORDER: Array<[keyof Fields, string]> = [
  ['name', 'signup-name'],
  ['email', 'signup-email'],
  ['password', 'signup-password'],
  ['terms', 'signup-terms'],
]

export function Signup() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const destination = useAuthDestination()
  const signUp = useSession((s) => s.signUp)
  const pending = useSession((s) => s.pending)

  const [values, setValues] = useState<Fields>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const reduced = useReducedMotion()
  const stagger = useMotionSafe(staggerParent)
  const field = useMotionSafe(fieldReveal)

  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().trim().min(2, { message: t('app.auth.errors.nameShort') }),
          email: z.email({ message: t('app.auth.errors.emailInvalid') }),
          password: z
            .string()
            .min(8, { message: t('app.auth.errors.passwordShort') })
            .regex(/[0-9]/, { message: t('app.auth.errors.passwordWeak') }),
          terms: z.boolean().refine((v) => v === true, {
            message: t('app.auth.errors.terms'),
          }),
        }),
    [t]
  )

  function collect(next: Fields): Errors {
    const result = schema.safeParse(next)
    if (result.success) return {}
    const out: Errors = {}
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof Fields
      if (key && !out[key]) out[key] = issue.message
    }
    return out
  }

  /**
   * Re-validate everything, but only surface a message for a field the user
   * has already left once.
   */
  function apply(next: Fields, seen: Record<string, boolean>) {
    const found = collect(next)
    const out: Errors = {}
    for (const key of Object.keys(found) as Array<keyof Fields>) {
      if (seen[key]) out[key] = found[key]
    }
    setErrors(out)
  }

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    const next = { ...values, [key]: value }
    setValues(next)
    apply(next, touched)
  }

  function blur(key: keyof Fields) {
    const seen = { ...touched, [key]: true }
    setTouched(seen)
    apply(values, seen)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const found = collect(values)
    setTouched({ name: true, email: true, password: true, terms: true })
    if (Object.keys(found).length) {
      setErrors(found)
      focusFirstInvalid(FOCUS_ORDER, found)
      return
    }
    setErrors({})
    try {
      await signUp({ name: values.name, email: values.email, password: values.password })
      navigate(destination, { replace: true })
    } catch (err) {
      const code = err instanceof AuthFailure ? err.code : 'unknown'
      if (code === 'emailTaken') {
        setErrors({ email: t('app.auth.errors.emailTaken') })
        document.getElementById('signup-email')?.focus()
        return
      }
      const detail = err instanceof AuthFailure && code === 'validation' ? err.detail : undefined
      setErrors({ form: detail || t(`app.auth.errors.${code}`) })
    }
  }

  return (
    <AuthScene mode="signup">
      <motion.form
        className="fsa-stack"
        onSubmit={submit}
        noValidate
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        <motion.h2 variants={field} style={{ fontSize: 'var(--step-2)' }}>
          {t('app.auth.signup.submit')}
        </motion.h2>

        <AnimatePresence initial={false}>
          {errors.form && (
            <motion.p
              className="fsa-alert"
              role="alert"
              key="form-error"
              initial={reduced ? false : errorMotion.initial}
              animate={errorMotion.animate}
              exit={reduced ? { opacity: 0 } : errorMotion.exit}
              transition={{ duration: reduced ? 0 : 0.18, ease: EASE }}
            >
              <span aria-hidden="true">—</span>
              {errors.form}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.div className="fs-field fsa-field" variants={field} layout="position">
          <label className="fs-field__label" htmlFor="signup-name">
            {t('app.auth.fields.name')}
          </label>
          <input
            id="signup-name"
            className="fs-input"
            type="text"
            autoComplete="name"
            readOnly={pending}
            placeholder={t('app.auth.fields.namePlaceholder')}
            value={values.name}
            aria-label={t('app.auth.fields.name')}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'signup-name-error' : undefined}
            onChange={(e) => set('name', e.target.value)}
            onBlur={() => blur('name')}
          />
          <AnimatePresence initial={false} mode="popLayout">
            {errors.name && (
              <motion.p
                className="fs-field__error"
                id="signup-name-error"
                role="alert"
                key="error"
                initial={reduced ? false : errorMotion.initial}
                animate={errorMotion.animate}
                exit={reduced ? { opacity: 0 } : errorMotion.exit}
                transition={{ duration: reduced ? 0 : 0.18, ease: EASE }}
              >
                {errors.name}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div className="fs-field fsa-field" variants={field} layout="position">
          <label className="fs-field__label" htmlFor="signup-email">
            {t('app.auth.fields.email')}
          </label>
          <input
            id="signup-email"
            className="fs-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            readOnly={pending}
            placeholder={t('app.auth.fields.emailPlaceholder')}
            value={values.email}
            aria-label={t('app.auth.fields.email')}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'signup-email-error' : undefined}
            onChange={(e) => set('email', e.target.value)}
            onBlur={() => blur('email')}
          />
          <AnimatePresence initial={false} mode="popLayout">
            {errors.email && (
              <motion.p
                className="fs-field__error"
                id="signup-email-error"
                role="alert"
                key="error"
                initial={reduced ? false : errorMotion.initial}
                animate={errorMotion.animate}
                exit={reduced ? { opacity: 0 } : errorMotion.exit}
                transition={{ duration: reduced ? 0 : 0.18, ease: EASE }}
              >
                {errors.email}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div variants={field}>
          <PasswordField
            id="signup-password"
            label={t('app.auth.fields.password')}
            value={values.password}
            onChange={(v) => set('password', v)}
            onBlur={() => blur('password')}
            error={errors.password}
            hint={t('app.auth.hints.password')}
            autoComplete="new-password"
            readOnly={pending}
            placeholder={t('app.auth.fields.passwordPlaceholder')}
          />
        </motion.div>

        <motion.div className="fs-field" variants={field} layout="position">
          <label className="fsa-check" htmlFor="signup-terms">
            <input
              id="signup-terms"
              type="checkbox"
              checked={values.terms}
              disabled={pending}
              aria-invalid={errors.terms ? true : undefined}
              aria-describedby={errors.terms ? 'signup-terms-error' : undefined}
              onChange={(e) => set('terms', e.target.checked)}
              onBlur={() => blur('terms')}
            />
            <span>{t('app.auth.terms')}</span>
          </label>
          {/* Outside the label, so tapping it reads the terms instead of ticking the box. */}
          <Link className="fsa-terms" to="/legal/terms" target="_blank" rel="noopener">
            {t('app.auth.termsLink', { defaultValue: 'Foydalanish shartlarini o‘qish' })}
          </Link>
          <AnimatePresence initial={false} mode="popLayout">
            {errors.terms && (
              <motion.p
                className="fs-field__error"
                id="signup-terms-error"
                role="alert"
                key="error"
                initial={reduced ? false : errorMotion.initial}
                animate={errorMotion.animate}
                exit={reduced ? { opacity: 0 } : errorMotion.exit}
                transition={{ duration: reduced ? 0 : 0.18, ease: EASE }}
              >
                {errors.terms}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* The button stays mounted while pending; the skeleton shimmer plays
            inside it (see ArrowCta) so focus and layout never jump. */}
        <motion.div variants={field}>
          <ArrowCta type="submit" busy={pending}>
            {pending ? `${t('app.auth.loading')}…` : t('app.auth.signup.submit')}
          </ArrowCta>
          <span className="fsa-sr" role="status">
            {pending ? t('app.auth.loading') : ''}
          </span>
        </motion.div>

        <motion.div variants={field}>
          <hr className="fs-rule" />
          <p className="fsa-note">{t('app.auth.notice')}</p>
        </motion.div>
      </motion.form>
    </AuthScene>
  )
}

export default Signup
