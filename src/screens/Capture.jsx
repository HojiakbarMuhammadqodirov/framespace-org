import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import { CameraIcon, CheckIcon, RetryIcon, ChevronIcon } from '../components/Icons.jsx'
import { ANGLES, REQUIRED_ANGLE_IDS } from '../../server/angles.js'
import { prepareCapture } from '../lib/image.js'

// One photo is not a room. This screen names each side in turn and refuses to
// move on until the four walls are covered, because that is what the model
// needs to work out the layout rather than guess at it.

function AngleCard({ angle, capture, busy, onFile, onClear }) {
  const done = Boolean(capture)
  return (
    <li className={`card overflow-hidden ${done ? 'border-sage/40' : ''}`}>
      <div className="flex gap-4 p-4">
        <div className="relative h-[74px] w-[74px] shrink-0 overflow-hidden rounded-xl bg-ink-3">
          {done ? (
            <img src={capture.dataUrl} alt="" className="h-full w-full object-cover" />
          ) : busy ? (
            <div className="shimmer h-full w-full" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted">
              <CameraIcon width={22} height={22} />
            </div>
          )}
          {done && (
            <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-sage text-ink">
              <CheckIcon width={13} height={13} strokeWidth={2.4} />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="text-[15px] font-semibold">{angle.label}</h3>
            {angle.required ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-clay">
                Required
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-wider text-muted">Optional</span>
            )}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{angle.hint}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <label className="btn btn-ghost cursor-pointer !px-4 !py-2 !text-[13px]">
              {done ? <RetryIcon width={16} height={16} /> : <CameraIcon width={16} height={16} />}
              {done ? 'Retake' : 'Take photo'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="file-input"
                onChange={(e) => onFile(angle.id, e.target.files?.[0], e.target)}
              />
            </label>

            <label className="cursor-pointer self-center text-[12.5px] text-muted underline underline-offset-4">
              from photos
              <input
                type="file"
                accept="image/*"
                className="file-input"
                onChange={(e) => onFile(angle.id, e.target.files?.[0], e.target)}
              />
            </label>

            {done && (
              <button
                type="button"
                onClick={() => onClear(angle.id)}
                className="self-center text-[12.5px] text-muted underline underline-offset-4"
              >
                remove
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

export default function Capture({ captures, onCapture, onClear, onContinue, onExit }) {
  const [busyAngle, setBusyAngle] = useState(null)
  const [error, setError] = useState(null)

  const doneRequired = REQUIRED_ANGLE_IDS.filter((id) => captures[id]).length
  const totalRequired = REQUIRED_ANGLE_IDS.length
  const ready = doneRequired === totalRequired
  const optionalCount = Object.keys(captures).length - doneRequired

  const nextAngle = useMemo(
    () => ANGLES.find((a) => a.required && !captures[a.id]) || ANGLES.find((a) => !captures[a.id]),
    [captures]
  )

  async function handleFile(angleId, file, input) {
    if (!file) return
    setBusyAngle(angleId)
    setError(null)
    try {
      const capture = await prepareCapture(file)
      onCapture(angleId, capture)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyAngle(null)
      // Reset so picking the same file twice still fires a change event.
      if (input) input.value = ''
    }
  }

  return (
    <div className="screen screen-with-action">
      <PageHeader
        eyebrow={`Step 1 of 2 · ${doneRequired}/${totalRequired} walls`}
        title="Which side is this?"
        subtitle="Stand roughly in the middle of the room and work your way around. The more sides you give it, the better it understands your space."
        onBack={onExit}
      />

      <div className="mx-auto max-w-lg px-5 pt-5">
        <div className="mb-5 flex gap-1.5">
          {REQUIRED_ANGLE_IDS.map((id) => (
            <div
              key={id}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                captures[id] ? 'bg-clay' : 'bg-line'
              }`}
            />
          ))}
        </div>

        {nextAngle && (
          <div className="card mb-5 flex items-center gap-3 border-clay/40 bg-clay/10 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clay text-white">
              <CameraIcon width={18} height={18} />
            </span>
            <p className="text-[13.5px] leading-snug">
              <span className="text-muted">Next up — </span>
              <span className="font-semibold">{nextAngle.label}</span>
            </p>
          </div>
        )}

        {error && (
          <p className="mb-4 rounded-xl border border-clay/50 bg-clay/10 px-4 py-3 text-[13px] text-clay-soft">
            {error}
          </p>
        )}

        <ul className="space-y-3">
          {ANGLES.map((angle) => (
            <AngleCard
              key={angle.id}
              angle={angle}
              capture={captures[angle.id]}
              busy={busyAngle === angle.id}
              onFile={handleFile}
              onClear={onClear}
            />
          ))}
        </ul>

        {ready && optionalCount < 2 && (
          <p className="mt-5 text-center text-[12px] leading-relaxed text-muted">
            You can continue — but adding the window and a wide corner shot noticeably improves the
            result.
          </p>
        )}
      </div>

      <div className="action-bar">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={onContinue}
            disabled={!ready}
            className="btn btn-primary w-full"
          >
            {ready
              ? 'Choose a style'
              : `${totalRequired - doneRequired} more wall${totalRequired - doneRequired > 1 ? 's' : ''} to go`}
            {ready && <ChevronIcon width={18} height={18} />}
          </button>
        </div>
      </div>
    </div>
  )
}
