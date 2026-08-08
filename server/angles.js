// The guided capture plan. The app asks for these one at a time so the AI gets
// enough coverage to understand the room instead of guessing from one photo.
//
// `required: true` angles must all be captured before the user can continue.
// The rest are optional but each one measurably improves the result, which is
// why the capture screen keeps nudging for them.

export const ANGLES = [
  {
    id: 'front',
    label: 'Front wall',
    hint: 'Stand in the doorway and shoot the wall straight ahead.',
    required: true,
    yaw: 0,
  },
  {
    id: 'right',
    label: 'Right wall',
    hint: 'Turn 90° right from where you just stood.',
    required: true,
    yaw: 90,
  },
  {
    id: 'back',
    label: 'Back wall',
    hint: 'Turn around — the wall with the door you came through.',
    required: true,
    yaw: 180,
  },
  {
    id: 'left',
    label: 'Left wall',
    hint: 'Turn 90° left from the front wall.',
    required: true,
    yaw: 270,
  },
  {
    id: 'corner',
    label: 'Wide corner',
    hint: 'Back into a corner and get as much of the room in one frame as you can.',
    required: false,
    yaw: 45,
  },
  {
    id: 'window',
    label: 'Window / light',
    hint: 'Where the daylight comes from. Helps the AI light the render correctly.',
    required: false,
    yaw: 135,
  },
  {
    id: 'floor',
    label: 'Floor',
    hint: 'Point down. Shows the existing flooring and its condition.',
    required: false,
    yaw: 225,
  },
  {
    id: 'ceiling',
    label: 'Ceiling',
    hint: 'Point up. Catches beams, vents, and existing light fittings.',
    required: false,
    yaw: 315,
  },
]

export const REQUIRED_ANGLE_IDS = ANGLES.filter((a) => a.required).map((a) => a.id)

export function angleById(id) {
  return ANGLES.find((a) => a.id === id)
}

// Angles that make sense to render as a finished room view. Floor and ceiling
// close-ups produce poor "here is your new room" images, so they inform the
// design brief but never become renders.
export const RENDERABLE_ANGLE_IDS = ['front', 'right', 'back', 'left', 'corner', 'window']
