import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Seo } from '@/lib/seo'
import { Button } from '@/ui/Button'
import { Input, Select, Textarea } from '@/ui/Field'
import { Reveal } from '@/ui/Reveal'
import { useSession } from '@/store/session'
// The only transport allowed to touch /api — frozen, imported never rewritten.
import { sendContact } from '@/lib/api.js'
import { EditorialStyles } from './editorial'

/* Direct channels — change them here and nowhere else. Most visitors are in
   Uzbekistan, where Telegram is the default way to reach a business, so it
   goes first. (No phone row until a real number is confirmed.) */
const TELEGRAM_HANDLE = 'framespace_uz'
const EMAIL = 'hello@framespace.uz'

const TOPICS = ['general', 'business', 'pricing', 'studio'] as const
type Topic = (typeof TOPICS)[number]

const TOPIC_FALLBACK: Record<Topic, string> = {
  general: 'Umumiy savol',
  business: 'Biznes va hamkorlik',
  pricing: 'Narxlar',
  studio: 'Studio tarifi',
}

const MAX_MESSAGE = 4000

const schema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email(),
  message: z.string().trim().min(10).max(MAX_MESSAGE),
})

type Status = 'idle' | 'sending' | 'sent' | 'error'

const CSS = `
.ct-hero { padding-block: var(--s16) var(--s12); }
@media (min-width: 768px) { .ct-hero { padding-block: var(--s24) var(--s16); } }
.ct-hero__grid { display: grid; gap: var(--s8); align-items: end; }
@media (min-width: 960px) { .ct-hero__grid { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: var(--s16); } }
.ct-hero__title { margin-top: var(--s6); max-width: 12ch; font-size: var(--step-5); font-weight: 400; }

.ct { display: grid; gap: var(--s12); padding-bottom: var(--s24); }
@media (min-width: 1024px) {
  .ct { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: var(--s16); align-items: start; }
  .ct__aside { position: sticky; top: calc(var(--hdr-offset, 88px) + var(--s6)); }
}
.ct__aside { display: grid; gap: var(--s10); }
.ct__channels { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--border-strong); }
.ct__channel { border-bottom: 1px solid var(--hairline); }
.ct__link {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: var(--s1) var(--s4);
  min-height: var(--tap);
  padding: var(--s5) 0;
  color: var(--text-strong);
  text-decoration: none;
}
.ct__name { font-family: var(--font-display); font-size: var(--step-2); line-height: 1.1; transition: color var(--d-fast) var(--ease); }
.ct__arrow { color: var(--accent-ink); transition: transform var(--d-base) var(--ease); }
.ct__link:focus-visible { outline: 2px solid var(--focus); outline-offset: 4px; border-radius: var(--radius-sm); }
@media (hover: hover) and (pointer: fine) {
  .ct__link:hover .ct__name { color: var(--accent-ink); }
  .ct__link:hover .ct__arrow { transform: translate3d(3px, -3px, 0); }
}
.ct__value {
  grid-column: 1 / -1;
  font-family: var(--font-mono);
  font-size: var(--step--1);
  color: var(--text-muted);
  overflow-wrap: anywhere;
}
.ct__facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s5); margin: 0; }
.ct__facts dt { margin-bottom: var(--s2); }
.ct__facts dd { margin: 0; color: var(--text-strong); font-size: var(--step--1); }
.ct__faq {
  display: grid; gap: var(--s3); padding: var(--s6);
  border-radius: var(--radius-2xl); background: var(--bg-sunken); box-shadow: inset 0 0 0 1px var(--hairline);
}
.ct__faq p { color: var(--text-muted); font-size: var(--step--1); }
.ct__form-head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--s4); flex-wrap: wrap; margin-bottom: var(--s6); padding-bottom: var(--s5); border-bottom: 1px solid var(--hairline); }
.ct__pair { display: grid; gap: var(--s5); }
@media (min-width: 640px) { .ct__pair { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.ct__sent { display: grid; gap: var(--s4); min-height: 420px; align-content: center; justify-items: start; }
.ct__sent h2:focus { outline: none; }
.ct__mark { width: 56px; height: 56px; }
`

export function Contact() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const user = useSession((s) => s.user)
  const [status, setStatus] = useState<Status>('idle')
  const [errors, setErrors] = useState<{ email?: string; message?: string }>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const sentHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)

  // Links from pricing, the business page and product/store pages say what
  // the message is about, so the visitor does not have to.
  const topicParam = params.get('topic')
  const initialTopic: Topic = (TOPICS as readonly string[]).includes(topicParam ?? '')
    ? (topicParam as Topic)
    : 'general'
  const product = params.get('product')
  const store = params.get('store')
  const prefill = [
    product && t('contact.prefill.product', { product, defaultValue: 'Mahsulot: {{product}}' }),
    store && t('contact.prefill.store', { store, defaultValue: "Do'kon: {{store}}" }),
  ]
    .filter(Boolean)
    .join('\n')
  const initialMessage = prefill ? `${prefill}\n\n` : ''
  const [length, setLength] = useState(initialMessage.length)

  // Move focus to the confirmation so keyboard and screen-reader users land
  // on it rather than on a button that no longer exists.
  useEffect(() => {
    if (status === 'sent') sentHeadingRef.current?.focus()
  }, [status])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === 'sending') return
    setServerError(null)

    const form = new FormData(event.currentTarget)
    const topic = String(form.get('topic') || 'general') as Topic
    const candidate = {
      name: String(form.get('name') || ''),
      email: String(form.get('email') || ''),
      message: String(form.get('message') || ''),
    }

    const parsed = schema.safeParse(candidate)
    if (!parsed.success) {
      const next: typeof errors = {}
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'email') next.email = t('contact.errors.email')
        if (issue.path[0] === 'message') next.message = t('contact.errors.message')
      }
      setErrors(next)
      // Take the visitor to the first thing that needs fixing.
      const first = next.email ? 'email' : next.message ? 'message' : null
      if (first) {
        const field = formRef.current?.elements.namedItem(first)
        if (field instanceof HTMLElement) field.focus()
      }
      return
    }

    setErrors({})
    setStatus('sending')
    try {
      // POST /api/contact — server validates email + message and appends to
      // server/data/messages.json. It stores no topic field, so the topic
      // travels as the first line of the message.
      const message =
        topic === 'general' ? parsed.data.message : `[${topic}]\n${parsed.data.message}`
      await sendContact({ ...parsed.data, message })
      setStatus('sent')
    } catch (err) {
      // The raw error is for us, not the visitor: it is usually English and
      // technical. They always get the localised sentence.
      console.error('[contact]', err)
      setStatus('error')
      const code = (err as { status?: number } | null)?.status
      setServerError(code === 429 ? t('public2.contact.rateLimited') : t('contact.errors.server'))
    }
  }

  const channels = [
    {
      key: 'telegram',
      href: `https://t.me/${TELEGRAM_HANDLE}`,
      label: t('contact.channels.telegram', { defaultValue: 'Telegram' }),
      value: `@${TELEGRAM_HANDLE}`,
      external: true,
    },
    {
      key: 'email',
      href: `mailto:${EMAIL}`,
      label: t('contact.channels.email', { defaultValue: 'Elektron pochta' }),
      value: EMAIL,
      external: false,
    },
  ]

  return (
    <>
      <Seo title={`${t('nav.contact')} — FrameSpace`} description={t('contact.lead')} path="/contact" />
      <EditorialStyles />
      <style href="fs-contact" precedence="medium">{CSS}</style>

      <section className="fs-container ct-hero">
        <Reveal>
          <div className="ct-hero__grid">
            <div>
              <span className="fs-eyebrow">
                <span className="fs-eyebrow__dot" aria-hidden="true" />
                {t('nav.contact')}
              </span>
              <h1 className="fs-display ct-hero__title">{t('contact.title')}</h1>
            </div>
            <p className="fs-lead" style={{ maxWidth: '40ch' }}>
              {t('contact.lead')}
            </p>
          </div>
        </Reveal>
      </section>

      <section className="fs-container">
        <div className="ct">
          <Reveal className="ct__aside">
            <div>
              <h2 className="fs-label" style={{ marginBottom: 'var(--s4)' }}>
                {t('contact.channels.title')}
              </h2>
              <ul className="ct__channels">
                {channels.map((channel) => (
                  <li key={channel.key} className="ct__channel">
                    <a
                      className="ct__link"
                      href={channel.href}
                      {...(channel.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      <span className="ct__name">{channel.label}</span>
                      <span className="ct__arrow" aria-hidden="true">
                        ↗
                      </span>
                      <span className="ct__value">{channel.value}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="fs-label" style={{ marginTop: 'var(--s4)', color: 'var(--text-muted)' }}>
                {t('contact.reply')}
              </p>
            </div>

            <dl className="ct__facts">
              <div>
                <dt className="fs-label">{t('public2.contact.studioLabel')}</dt>
                <dd>{t('public2.contact.studio')}</dd>
              </div>
              <div>
                <dt className="fs-label">{t('public2.contact.hoursLabel')}</dt>
                <dd>{t('public2.contact.hours')}</dd>
              </div>
            </dl>

            <div className="ct__faq">
              <h2 className="ed-h3" style={{ fontSize: 'var(--step-1)' }}>
                {t('public2.contact.faqTitle')}
              </h2>
              <p>{t('public2.contact.faqBody')}</p>
              <Link to="/faq" className="fs-navlink" style={{ justifySelf: 'start' }}>
                {t('public2.contact.faqLink')} →
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="fs-bezel fs-bezel--lg">
              <div className="fs-bezel__core" style={{ padding: 'clamp(1.25rem, 0.6rem + 2.6vw, 2.5rem)' }}>
                {status === 'sent' ? (
                  <div className="ct__sent" role="status">
                    <svg className="ct__mark" viewBox="0 0 56 56" fill="none" aria-hidden="true">
                      <circle cx="28" cy="28" r="27" stroke="var(--hairline)" />
                      <path
                        d="M18 29 L25 36 L39 21"
                        stroke="var(--accent)"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="fs-label">{t('contact.sentLabel')}</span>
                    <h2
                      ref={sentHeadingRef}
                      tabIndex={-1}
                      className="ed-h2"
                      style={{ fontSize: 'var(--step-3)', maxWidth: '16ch' }}
                    >
                      {t('contact.sentTitle')}
                    </h2>
                    <p className="ed-body">{t('contact.sentBody')}</p>
                    <div style={{ marginTop: 'var(--s4)' }}>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setLength(initialMessage.length)
                          setStatus('idle')
                        }}
                      >
                        {t('contact.again')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="ct__form-head">
                      <h2 className="ed-h3">{t('public2.contact.formTitle')}</h2>
                      <span className="fs-label" aria-hidden="true">
                        * {t('public2.contact.required')}
                      </span>
                    </div>
                    <form ref={formRef} onSubmit={onSubmit} noValidate style={{ display: 'grid', gap: 'var(--s5)' }}>
                      <Select name="topic" label={t('contact.topic.label')} defaultValue={initialTopic}>
                        {TOPICS.map((topic) => (
                          <option key={topic} value={topic}>
                            {t(`contact.topic.${topic}`, { defaultValue: TOPIC_FALLBACK[topic] })}
                          </option>
                        ))}
                      </Select>
                      <div className="ct__pair">
                        <Input
                          name="name"
                          label={t('contact.fields.name')}
                          autoComplete="name"
                          maxLength={120}
                          defaultValue={user?.name}
                        />
                        <Input
                          name="email"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          required
                          maxLength={254}
                          defaultValue={user?.email}
                          label={t('contact.fields.email')}
                          error={errors.email}
                        />
                      </div>
                      <Textarea
                        name="message"
                        required
                        rows={6}
                        maxLength={MAX_MESSAGE}
                        label={t('contact.fields.message')}
                        placeholder={t('contact.fields.messagePlaceholder')}
                        defaultValue={initialMessage || undefined}
                        hint={t('public2.contact.counter', { count: length })}
                        onInput={(e) => setLength(e.currentTarget.value.length)}
                        error={errors.message}
                      />

                      {serverError && (
                        <p className="fs-field__error" role="alert">
                          {serverError}
                        </p>
                      )}

                      <Button
                        type="submit"
                        size="lg"
                        arrow
                        disabled={status === 'sending'}
                        aria-busy={status === 'sending'}
                      >
                        {status === 'sending' ? `${t('common.loading')}…` : t('contact.submit')}
                      </Button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
