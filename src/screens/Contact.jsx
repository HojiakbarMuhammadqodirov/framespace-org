import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { CheckIcon, MailIcon } from '../components/Icons.jsx'
import { sendContact } from '../lib/api.js'

const SUBJECTS = ['A render looked wrong', 'Budget or pricing', 'Feature request', 'Something else']

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: SUBJECTS[0], message: '' })
  const [state, setState] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState('')

  function set(patch) {
    setForm((f) => ({ ...f, ...patch }))
  }

  async function submit(e) {
    e.preventDefault()
    setState('sending')
    setError('')
    try {
      await sendContact({
        name: form.name,
        email: form.email,
        message: `[${form.subject}] ${form.message}`,
      })
      setState('sent')
    } catch (err) {
      setError(err.message)
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div className="screen">
        <PageHeader eyebrow="Contact us" title="Message sent" />
        <div className="mx-auto max-w-lg px-5 pt-8">
          <div className="card flex flex-col items-center px-6 py-14 text-center">
            <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-sage text-ink">
              <CheckIcon width={26} height={26} strokeWidth={2.2} />
            </span>
            <p className="display text-[20px]">Thanks — we have it</p>
            <p className="mt-2 max-w-[30ch] text-[13px] leading-relaxed text-muted">
              We'll reply to {form.email || 'your email'}. If it's about a specific render, keep the
              project in your Archive so we can look at the same one.
            </p>
            <button
              type="button"
              onClick={() => {
                setForm({ name: '', email: '', subject: SUBJECTS[0], message: '' })
                setState('idle')
              }}
              className="btn btn-ghost mt-6"
            >
              Write another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <PageHeader
        eyebrow="Contact us"
        title="Tell us what happened"
        subtitle="Bug, bad render, or an idea — it all lands in the same place and a person reads it."
      />

      <form onSubmit={submit} className="mx-auto max-w-lg space-y-4 px-5 pt-6">
        <div>
          <label htmlFor="name" className="eyebrow mb-2 block">
            Name
          </label>
          <input
            id="name"
            className="field"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Optional"
            autoComplete="name"
          />
        </div>

        <div>
          <label htmlFor="email" className="eyebrow mb-2 block">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            className="field"
            value={form.email}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
          />
        </div>

        <div>
          <span className="eyebrow mb-2 block">What's it about</span>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((subject) => (
              <button
                key={subject}
                type="button"
                onClick={() => set({ subject })}
                aria-pressed={form.subject === subject}
                className={`rounded-full border px-3.5 py-2 text-[12.5px] transition-colors ${
                  form.subject === subject
                    ? 'border-clay bg-clay/15 text-cream'
                    : 'border-line text-muted'
                }`}
              >
                {subject}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="message" className="eyebrow mb-2 block">
            Message
          </label>
          <textarea
            id="message"
            rows={6}
            required
            className="field resize-none"
            value={form.message}
            onChange={(e) => set({ message: e.target.value })}
            placeholder="The render moved my window to the other wall…"
          />
        </div>

        {error && (
          <p className="rounded-xl border border-clay/50 bg-clay/10 px-4 py-3 text-[13px] text-clay-soft">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={state === 'sending' || !form.message.trim() || !form.email.trim()}
          className="btn btn-primary w-full"
        >
          <MailIcon width={18} height={18} />
          {state === 'sending' ? 'Sending…' : 'Send message'}
        </button>

        <p className="pt-1 text-center text-[11.5px] leading-relaxed text-muted">
          Messages are stored on your own server at{' '}
          <span className="font-mono text-[11px]">server/data/messages.json</span>. Wire it to email
          or a ticketing tool whenever you're ready.
        </p>
      </form>
    </div>
  )
}
