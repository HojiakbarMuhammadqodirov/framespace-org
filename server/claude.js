// Claude does the thinking half of FrameSpace: it reads every photo of the
// room, works out what is actually there, designs the new room, picks furniture
// that fits the budget at realistic average market prices, and writes the
// image prompts that Gemini then renders.

import Anthropic from '@anthropic-ai/sdk'
import { angleById, RENDERABLE_ANGLE_IDS } from './angles.js'

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5'

let client = null
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!client) client = new Anthropic()
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
export async function buildDesignBrief({ photos, style, budget, notes }) {
  const anthropic = getClient()
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY is not set')

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
      '',
      `Write exactly one entry in renderPrompts for each of these angleIds, in this order: ${renderable
        .map((p) => p.angleId)
        .join(', ')}. Do not add prompts for any other angle.`,
    ].join('\n'),
  })

  const params = {
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content }],
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: DESIGN_SCHEMA },
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
    throw new Error(`Claude declined this request (${category}). Try different photos or a different note.`)
  }

  const text = response.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('Claude returned no design brief.')

  const brief = JSON.parse(text)
  brief.usage = {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  }
  return brief
}
