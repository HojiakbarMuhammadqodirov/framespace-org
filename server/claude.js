// Claude does the thinking half of FrameSpace: it reads every photo of the
// room, works out what is actually there, designs the new room, picks furniture
// that fits the budget at realistic average market prices, and writes the
// image prompts that Gemini then renders.

import { LANGUAGE_NAME } from './i18n.js'
import Anthropic from '@anthropic-ai/sdk'
import { angleById, RENDERABLE_ANGLE_IDS } from './angles.js'

// Sonnet is the default on cost grounds; set CLAUDE_MODEL to trade up or down.
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5'
const MODEL = CLAUDE_MODEL
/**
 * Upper bound on output tokens (thinking included) for any one call, whatever
 * the call site asks for. A runaway brief is cut off, not billed in full.
 */
const MAX_OUTPUT_TOKENS = Math.max(1024, Math.floor(Number(process.env.CLAUDE_MAX_OUTPUT_TOKENS) || 16000))

let client = null
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null
  // The SDK itself retries 408/409/429/5xx and dropped connections with
  // exponential backoff (honouring retry-after); `timeout` bounds each attempt.
  if (!client)
    client = new Anthropic({
      maxRetries: Number(process.env.CLAUDE_MAX_RETRIES ?? 3),
      timeout: Number(process.env.CLAUDE_TIMEOUT_MS ?? 180_000),
    })
  return client
}

export function claudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

// Structured outputs: every object needs additionalProperties:false and an
// explicit `required` list, and numeric/string constraints aren't supported —
// the ranges live in the prompt instead.
const DESIGN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['room', 'design', 'furniture', 'budget', 'renderPrompts'],
  properties: {
    room: {
      type: 'object',
      additionalProperties: false,
      required: [
        'estimatedWidthM',
        'estimatedDepthM',
        'estimatedHeightM',
        'existingFeatures',
        'lightingNotes',
        'confidence',
      ],
      properties: {
        estimatedWidthM: { type: 'number', description: 'Best estimate of room width in metres.' },
        estimatedDepthM: { type: 'number', description: 'Best estimate of room depth in metres.' },
        estimatedHeightM: { type: 'number', description: 'Best estimate of ceiling height in metres.' },
        existingFeatures: {
          type: 'array',
          description:
            'Fixed things that must survive the redesign: windows, doors, radiators, sockets, beams, alcoves, flooring type.',
          items: { type: 'string' },
        },
        lightingNotes: {
          type: 'string',
          description: 'Where daylight enters, its direction and quality, and what artificial lighting exists.',
        },
        confidence: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'How confident you are in the dimension estimates given the photo coverage.',
        },
      },
    },
    design: {
      type: 'object',
      additionalProperties: false,
      required: ['styleName', 'summary', 'palette', 'materials', 'lighting'],
      properties: {
        styleName: { type: 'string' },
        summary: {
          type: 'string',
          description: 'Two or three sentences describing the finished room to the person who will live in it.',
        },
        palette: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'hex', 'usage'],
            properties: {
              name: { type: 'string' },
              hex: { type: 'string', description: 'Hex colour, e.g. #E8E2D9' },
              usage: { type: 'string', description: 'Where this colour goes: walls, textiles, accents.' },
            },
          },
        },
        materials: { type: 'array', items: { type: 'string' } },
        lighting: { type: 'string', description: 'The lighting scheme for the redesigned room.' },
      },
    },
    furniture: {
      type: 'array',
      description:
        'Everything that has to be bought. Prices are average current retail for that category — not the cheapest and not designer.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'name',
          'category',
          'description',
          'typicalPriceLow',
          'typicalPriceHigh',
          'averagePrice',
          'quantity',
          'placement',
        ],
        properties: {
          name: { type: 'string' },
          category: {
            type: 'string',
            enum: [
              'seating',
              'table',
              'storage',
              'bed',
              'lighting',
              'rug',
              'textiles',
              'wall-decor',
              'plants',
              'paint-and-finishes',
              'other',
            ],
          },
          description: { type: 'string', description: 'Material, colour, and rough dimensions.' },
          typicalPriceLow: { type: 'number' },
          typicalPriceHigh: { type: 'number' },
          averagePrice: {
            type: 'number',
            description: 'The midpoint of the typical range. This is the number that counts against the budget.',
          },
          quantity: { type: 'integer' },
          placement: { type: 'string', description: 'Where it sits in the room, relative to a wall or window.' },
        },
      },
    },
    budget: {
      type: 'object',
      additionalProperties: false,
      required: ['currency', 'limit', 'estimatedTotal', 'withinBudget', 'notes'],
      properties: {
        currency: { type: 'string' },
        limit: { type: 'number', description: 'The ceiling the user gave. 0 when they set none.' },
        estimatedTotal: {
          type: 'number',
          description: 'Sum of averagePrice × quantity across the whole furniture list.',
        },
        withinBudget: { type: 'boolean' },
        notes: {
          type: 'string',
          description: 'What you traded off to hit the number, or what you added with the headroom.',
        },
      },
    },
    renderPrompts: {
      type: 'array',
      description: 'One image-editing prompt per photographed angle that should be rendered.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['angleId', 'angleLabel', 'prompt'],
        properties: {
          angleId: { type: 'string' },
          angleLabel: { type: 'string' },
          prompt: {
            type: 'string',
            description:
              'A self-contained instruction for an image model editing THIS photo: the style, palette, materials, lighting, and the exact furniture visible from this angle.',
          },
        },
      },
    },
  },
}

function languageInstruction(locale) {
  const language = LANGUAGE_NAME[locale] || LANGUAGE_NAME.uz
  return `The user reads the app in ${language}. Write every user-facing prose field (summary, palette names and usage, materials, lighting, existingFeatures, lightingNotes, furniture names, descriptions and placements, budget notes) in ${language}. Keep renderPrompts in English — they go to an image model.`
}

function budgetInstruction(budget) {
  if (!budget || !budget.limit) {
    return 'The user set no budget. Choose furniture at sensible mid-market prices and still report an honest estimated total.'
  }
  const { limit, currency } = budget
  return [
    `HARD BUDGET: the whole furniture list must come to ${limit} ${currency} or less.`,
    'Price each item at the average of its typical current retail range — not the cheapest listing you can imagine and not a designer piece.',
    `Sum averagePrice × quantity across every item and put that in budget.estimatedTotal. That number must not exceed ${limit}.`,
    'If the style you would ideally specify does not fit, cut or downgrade items until it does, and say plainly in budget.notes what you gave up.',
    'Never quietly exceed the limit and never pad the list to reach it.',
  ].join(' ')
}

const SYSTEM = `You are the design engine behind FrameSpace, a mobile app where someone photographs their real room from several sides and gets it back reimagined.

What you are given: several photos of one real room, each labelled with the angle it was taken from; a design style the user picked; optionally a furniture budget; optionally a free-text note about what they want.

What you produce: a single design brief covering the room as it is, the room as it will be, a costed furniture list, and one image-editing prompt per photographed angle.

How to work:

Read the room first. Cross-reference the angles — the same window appears in more than one photo, and that is how you work out the layout. Estimate dimensions from door heights (about 2.0m), standard sockets, and floorboard widths. Say so through the confidence field rather than inventing precision you do not have.

Respect what cannot move. Windows, doors, radiators, structural beams, and the position of the ceiling light stay exactly where they are. The redesign works around them. Note every one of them in existingFeatures.

Design for this room, not a catalogue. The furniture has to physically fit the dimensions you estimated and leave walking room. A 2.4m sofa does not go in a 2.6m-wide room.

Write render prompts an image model can follow. Each prompt edits one specific photograph. Name the camera position, then state precisely what changes (wall colour, flooring, furniture visible from that angle, textiles, lighting) and what must not change (room geometry, window and door positions, the direction light comes from, ceiling height, the perspective of the shot). Make the prompts consistent with each other: the same sofa in the same place, the same wall colour, the same floor, described identically in every prompt so the four renders read as one room.

Be concrete about materials and colours. "Warm oak veneer, matte" beats "nice wood".`

function imageBlock(photo) {
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: photo.mediaType || 'image/jpeg',
      data: photo.data,
    },
  }
}

/**
 * @param {object} input
 * @param {Array<{angleId:string,data:string,mediaType:string}>} input.photos
 * @param {string} input.style
 * @param {{limit:number,currency:string}|null} input.budget
 * @param {string} input.notes
 */
export async function buildDesignBrief({ photos, style, budget, notes, locale = 'uz' }) {
  const renderable = photos.filter((p) => RENDERABLE_ANGLE_IDS.includes(p.angleId)).slice(0, 4)

  const content = []
  for (const photo of photos) {
    const angle = angleById(photo.angleId)
    content.push({ type: 'text', text: `Photo — ${angle ? angle.label : photo.angleId} (angleId: ${photo.angleId})` })
    content.push(imageBlock(photo))
  }

  content.push({
    type: 'text',
    text: [
      `Style the user chose: ${style}.`,
      notes ? `What they asked for in their own words: "${notes}"` : 'They left no extra notes.',
      budgetInstruction(budget),
      languageInstruction(locale),
      '',
      `Write exactly one entry in renderPrompts for each of these angleIds, in this order: ${renderable
        .map((p) => p.angleId)
        .join(', ')}. Do not add prompts for any other angle.`,
    ].join('\n'),
  })

  return callStructured({ system: SYSTEM, content, schema: DESIGN_SCHEMA })
}

/**
 * One structured-output call. Returns the parsed JSON with a `usage` field.
 * Errors carry an HTTP-ish `status` and a user-safe message.
 */
async function callStructured({ system, content, schema, maxTokens = 16000, effort = 'high' }) {
  const anthropic = getClient()
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY is not set')

  const params = {
    model: MODEL,
    max_tokens: Math.min(maxTokens, MAX_OUTPUT_TOKENS),
    system,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content }],
    output_config: {
      effort,
      format: { type: 'json_schema', schema },
    },
  }

  let response
  try {
    // Server-side fallbacks: if a safety classifier declines the request, the
    // API re-serves it on a fallback model in the same call instead of handing
    // us a refusal. Costs nothing when it never fires.
    response = await anthropic.beta.messages.create({
      ...params,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })
  } catch (err) {
    if (err?.status === 400) {
      // Account not enrolled in the fallback beta — run it plain.
      response = await anthropic.messages.create(params)
    } else {
      throw err
    }
  }

  if (response.stop_reason === 'refusal') {
    const category = response.stop_details?.category ?? 'unspecified'
    throw providerError(422, `Claude declined this request (${category}). Try different input or a different note.`)
  }
  if (response.stop_reason === 'max_tokens') {
    throw providerError(502, 'The design brief was cut off before it finished. Try again.')
  }

  const text = response.content.find((b) => b.type === 'text')?.text
  if (!text) throw providerError(502, 'Claude returned no design brief.')

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw providerError(502, 'Claude returned a malformed design brief. Try again.')
  }
  parsed.usage = {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  }
  return parsed
}

function providerError(status, message) {
  const err = new Error(message)
  err.status = status
  err.expose = true
  return err
}

// ---------------------------------------------------------------- 3D scenes

const SCENE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['design', 'lightingNotes', 'furnitureNotes', 'budgetNotes', 'renderPrompts'],
  properties: {
    design: DESIGN_SCHEMA.properties.design,
    lightingNotes: {
      type: 'string',
      description: 'How light falls in this room given its windows and the lighting preset.',
    },
    furnitureNotes: {
      type: 'array',
      description: 'One entry per numbered furniture line, in the same order.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['line', 'name', 'description', 'placement'],
        properties: {
          line: { type: 'integer', description: 'The line number as given.' },
          name: { type: 'string', description: 'A specific product-style name in the chosen style.' },
          description: { type: 'string', description: 'Material, colour, upholstery, and how it suits the style.' },
          placement: { type: 'string', description: 'Where it sits, relative to walls, windows and other pieces.' },
        },
      },
    },
    budgetNotes: { type: 'string', description: 'One or two sentences on the total against the budget.' },
    renderPrompts: DESIGN_SCHEMA.properties.renderPrompts,
  },
}

const SCENE_SYSTEM = `You are the design engine behind FrameSpace. Here the user has not photographed a room: they built it in a 3D planner — exact dimensions, windows and doors, and furniture they placed themselves at fixed positions with chosen finishes and catalogue prices.

Your job: dress that layout in the style they picked. Keep every placed piece where it is; you choose wall colour, flooring, textiles, upholstery, lighting and small styling details. Describe each furniture line as a concrete product in that style.

Then write one text-to-image prompt per camera view. There is no photograph to edit, so each prompt must stand alone: camera position and direction, room size, what is on the wall ahead (windows, doors), which furniture is visible and where, materials, palette hexes, and the light. Describe shared elements identically across prompts so the views read as one room. Photorealistic interior photography, no people, no text.`

/**
 * Design brief for a 3D builder scene.
 * @returns {Promise<{design, lightingNotes, furnitureNotes, budgetNotes, renderPrompts, usage}>}
 */
export async function buildSceneBrief({ scene, lines, views, description }) {
  const linesText = lines
    .map(
      (l, i) =>
        `${i + 1}. ${l.catalogId} (${l.category}) x ${l.items.length}, ${l.material} finish, ${l.unitPrice} ${scene.budget.currency} each`
    )
    .join('\n')
  const text = [
    `Style: ${scene.style}.`,
    languageInstruction(scene.locale),
    scene.notes ? `Builder notes: ${scene.notes}` : '',
    '',
    description,
    '',
    lines.length ? `Furniture lines:\n${linesText}` : 'Furniture lines: none.',
    scene.budget.limit
      ? `Budget ceiling: ${scene.budget.limit} ${scene.budget.currency}. The total is fixed by the user's picks; comment on it honestly.`
      : 'No budget ceiling was set.',
    '',
    `Write exactly one renderPrompts entry for each of these views, in this order: ${views
      .map((v) => `${v.angleId} ("${v.angleLabel}", camera looking towards the ${v.wall} wall)`)
      .join('; ')}.`,
  ]
    .filter((x, i, a) => x !== '' || a[i - 1] !== '')
    .join('\n')

  return callStructured({
    system: SCENE_SYSTEM,
    content: [{ type: 'text', text }],
    schema: SCENE_SCHEMA,
    maxTokens: 12000,
    effort: 'medium',
  })
}
