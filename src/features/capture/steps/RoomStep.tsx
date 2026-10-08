/**
 * Step 2 — name the room and say what it is.
 *
 * Neither field has a home in `/api/render` — the endpoint takes photos, a
 * style, a budget and free text, nothing else. So the room type is folded into
 * the notes string at send time, where the model does read it, and the name
 * stays on the device to title the project.
 */
import { useTranslation } from 'react-i18next'

import { ArrowButton, Bezel, Eyebrow, Rise } from '../Chrome'
import { radioProps } from '../hooks'
import { ROOM_TYPES } from '../types'
import type { RoomTypeId } from '../types'
import type { CaptureFlow } from '../useCaptureFlow'

const CSS = `
.cap-room { display: grid; gap: var(--s8); }
.cap-room__head { display: grid; gap: var(--s5); justify-items: start; }
.cap-room__title { font-size: var(--step-3); max-width: 16ch; }
.cap-room__lead { color: var(--text-muted); max-width: 44ch; }
.cap-room__label {
  display: block;
  font-family: var(--font-mono);
  font-size: var(--step--2);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: var(--s3);
}
.cap-room__input {
  width: 100%;
  min-height: var(--tap);
  padding: var(--s2) 0;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--border-strong);
  color: var(--text-strong);
  font-family: var(--font-display);
  font-size: var(--step-2);
  letter-spacing: var(--tracking-display);
  transition: border-color var(--d-base) var(--ease);
}
.cap-room__input::placeholder { color: var(--text-muted); opacity: 0.45; }
.cap-room__input:focus { outline: none; border-color: var(--accent); }
.cap-room__types { display: flex; flex-wrap: wrap; gap: var(--s2); }
.cap-room__type {
  min-height: var(--tap);
  padding: 0 var(--s5);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--step--1);
  cursor: pointer;
  transition: color var(--d-fast) var(--ease), border-color var(--d-fast) var(--ease),
    background-color var(--d-fast) var(--ease), transform var(--d-fast) var(--ease);
}
@media (hover: hover) and (pointer: fine) {
  .cap-room__type:hover { color: var(--text-strong); border-color: var(--border-strong); }
}
.cap-room__type:active { transform: scale(0.98); }
.cap-room__type[aria-checked='true'] {
  background: var(--text-strong);
  border-color: var(--text-strong);
  color: var(--bg);
}
.cap-room__grid { display: grid; gap: var(--s8); }
@media (min-width: 900px) {
  .cap-room { grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: var(--s16); align-items: start; }
  .cap-room__title { font-size: var(--step-4); }
}
`

export function RoomStep({ flow }: { flow: CaptureFlow }) {
  const { t } = useTranslation()

  return (
    <div className="cap-room">
      <style href="fs-cap-room" precedence="medium">
        {CSS}
      </style>

      <Rise className="cap-room__head">
        <Eyebrow>{t('capture.room.eyebrow')}</Eyebrow>
        <h1 className="cap-room__title" tabIndex={-1}>{t('capture.room.title')}</h1>
        <p className="cap-room__lead">{t('capture.room.lead')}</p>
      </Rise>

      <Rise delay={0.06}>
        <Bezel>
          <div className="cap-room__grid">
            <div>
              <label className="cap-room__label" htmlFor="cap-room-name">
                {t('capture.room.nameLabel')}
              </label>
              <input
                id="cap-room-name"
                className="cap-room__input"
                value={flow.roomName}
                onChange={(event) => flow.setRoomName(event.target.value)}
                placeholder={t('capture.room.namePlaceholder')}
                autoComplete="off"
                enterKeyHint="next"
              />
            </div>

            <div>
              <span className="cap-room__label" id="cap-room-type-label">
                {t('capture.room.typeLabel')}
              </span>
              {/* One choice of seven: a radio group, one tab stop, arrows move. */}
              <div className="cap-room__types" role="radiogroup" aria-labelledby="cap-room-type-label">
                {ROOM_TYPES.map((id: RoomTypeId, index) => (
                  <button
                    key={id}
                    type="button"
                    className="cap-room__type"
                    {...radioProps(ROOM_TYPES, flow.roomType, index, flow.setRoomType)}
                    onClick={() => flow.setRoomType(id)}
                  >
                    {t(`capture.room.types.${id}`)}
                  </button>
                ))}
              </div>
            </div>

            <ArrowButton onClick={() => flow.setStep('shoot')}>
              {t('capture.room.cta')}
            </ArrowButton>
          </div>
        </Bezel>
      </Rise>
    </div>
  )
}
