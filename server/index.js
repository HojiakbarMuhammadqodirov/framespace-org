import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'

import { ANGLES, REQUIRED_ANGLE_IDS, angleById, RENDERABLE_ANGLE_IDS } from './angles.js'
import { buildDesignBrief, claudeConfigured } from './claude.js'
import { renderAll, geminiConfigured } from './gemini.js'
import { demoBrief, demoRenders } from './demo.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(here, 'data')
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json')

const app = express()
app.use(cors())
// Six photos at ~1280px come to a few megabytes of base64. Give it room.
app.use(express.json({ limit: '30mb' }))

const demoMode = !claudeConfigured() || !geminiConfigured()

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    demoMode,
    providers: {
      claude: claudeConfigured(),
      gemini: geminiConfigured(),
    },
    models: {
      claude: process.env.CLAUDE_MODEL || 'claude-opus-5',
      gemini: process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview',
    },
  })
})

app.get('/api/angles', (req, res) => {
  res.json({ angles: ANGLES, requiredAngleIds: REQUIRED_ANGLE_IDS })
})

function validate(body) {
  const { photos, style } = body
  if (!Array.isArray(photos) || photos.length === 0) return 'Send at least one photo.'
  if (!style) return 'Pick a design style first.'

  const ids = new Set(photos.map((p) => p.angleId))
  const missing = REQUIRED_ANGLE_IDS.filter((id) => !ids.has(id))
  if (missing.length) {
    const labels = missing.map((id) => angleById(id)?.label || id).join(', ')
    return `Still need a photo of: ${labels}.`
  }
  for (const p of photos) {
    if (!p.data || typeof p.data !== 'string') return `Photo for "${p.angleId}" has no image data.`
    if (!angleById(p.angleId)) return `Unknown angle "${p.angleId}".`
  }
  return null
}

// The whole pipeline: Claude reads the room and designs it, Gemini renders it.
app.post('/api/render', async (req, res) => {
  const problem = validate(req.body)
  if (problem) return res.status(400).json({ error: problem })

  const { photos, style, notes = '' } = req.body
  const rawBudget = req.body.budget
  const budget =
    rawBudget && Number(rawBudget.limit) > 0
      ? { limit: Number(rawBudget.limit), currency: rawBudget.currency || 'USD' }
      : null

  const startedAt = Date.now()

  try {
    // --- Step 1: the design brief -------------------------------------------
    const brief = claudeConfigured()
      ? await buildDesignBrief({ photos, style, budget, notes })
      : demoBrief({ photos, style, budget, notes })

    // Trust but verify the budget arithmetic — the total that reaches the user
    // is computed here from the line items, not taken on faith.
    const computedTotal = (brief.furniture || []).reduce(
      (sum, item) => sum + Number(item.averagePrice || 0) * Number(item.quantity || 1),
      0
    )
    brief.budget = {
      ...brief.budget,
      currency: budget?.currency || brief.budget?.currency || 'USD',
      limit: budget?.limit || 0,
      estimatedTotal: Math.round(computedTotal),
      withinBudget: !budget?.limit || Math.round(computedTotal) <= budget.limit,
    }

    // --- Step 2: the renders -------------------------------------------------
    const photoByAngle = new Map(photos.map((p) => [p.angleId, p]))
    const jobs = (brief.renderPrompts || [])
      .filter((rp) => photoByAngle.has(rp.angleId) && RENDERABLE_ANGLE_IDS.includes(rp.angleId))
      .slice(0, 4)
      .map((rp) => ({
        angleId: rp.angleId,
        angleLabel: rp.angleLabel || angleById(rp.angleId)?.label || rp.angleId,
        prompt: rp.prompt,
        photo: photoByAngle.get(rp.angleId),
      }))

    const { renders, failures } = geminiConfigured()
      ? await renderAll({ jobs })
      : demoRenders({ brief, style })

    if (!renders.length) {
      return res.status(502).json({
        error: 'The design was written but no images came back.',
        details: failures,
      })
    }

    res.json({
      demoMode,
      style,
      brief,
      renders,
      failures,
      elapsedMs: Date.now() - startedAt,
    })
  } catch (err) {
    console.error('[render]', err)
    res.status(500).json({ error: err.message || 'Render failed.' })
  }
})

app.post('/api/contact', async (req, res) => {
  const { name = '', email = '', message = '' } = req.body || {}
  if (!message.trim()) return res.status(400).json({ error: 'Write a message first.' })
  if (!email.trim()) return res.status(400).json({ error: 'We need an email address to reply to.' })

  const entry = { name, email, message, receivedAt: new Date().toISOString() }
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
    let existing = []
    try {
      existing = JSON.parse(await fs.readFile(MESSAGES_FILE, 'utf8'))
    } catch {
      // First message — file does not exist yet.
    }
    existing.push(entry)
    await fs.writeFile(MESSAGES_FILE, JSON.stringify(existing, null, 2))
  } catch (err) {
    console.error('[contact]', err)
    return res.status(500).json({ error: 'Could not save your message. Try again.' })
  }
  res.json({ ok: true })
})

// Serve the built frontend in production (`npm run build && npm start`).
const dist = path.join(here, '..', 'dist')
app.use(express.static(dist))
app.get(/^(?!\/api\/).*/, (req, res, next) => {
  res.sendFile(path.join(dist, 'index.html'), (err) => {
    if (err) next()
  })
})

const port = Number(process.env.PORT) || 8787
app.listen(port, () => {
  console.log(`FrameSpace API on http://localhost:${port}`)
  if (demoMode) {
    console.log(
      `  DEMO MODE — claude:${claudeConfigured() ? 'ok' : 'missing key'} gemini:${
        geminiConfigured() ? 'ok' : 'missing key'
      }. Copy .env.example to .env to go live.`
    )
  }
})
