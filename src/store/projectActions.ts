/**
 * What the dashboard and the result page DO to a project, as opposed to how a
 * project is stored (./projects) or mirrored (./sync).
 *
 * Every action first makes sure the project is on this device: a card listed
 * from the account (made on another device) has no brief, renders or plan here
 * until it is opened, and renaming or copying it must work all the same.
 */
import i18n from '@/i18n/config'
import { duplicateRecord, getRecord, newProjectId, persistRecord } from '@/features/capture/store'

import { localProject, useProjects, type Project } from './projects'
import { copyScene, hasScene, writeScene, type StoredScene } from './roomScene'
import { ensureProject } from './sync'
import { projectChanged } from './syncBus'

export async function renameProject(id: string, title: string): Promise<void> {
  await ensureProject(id)
  useProjects.getState().rename(id, title)
}

/**
 * A copy to keep working on.
 *
 * - A project with a 3D plan is copied as a draft of that room: same walls and
 *   furniture, ready to be rearranged and generated again.
 * - A photographed project has no plan to edit, so the whole result is copied
 *   (renders included) — otherwise the copy would be an empty card.
 *
 * Resolves with the new project's id, or null when it could not be made.
 */
export async function duplicateProject(id: string): Promise<string | null> {
  await ensureProject(id)
  if (hasScene(id)) return useProjects.getState().duplicate(id)?.id ?? null

  const record = getRecord(id)
  if (!record?.result?.renders?.length) return useProjects.getState().duplicate(id)?.id ?? null
  const copy = duplicateRecord(record)
  copy.roomName = `${record.roomName || localProject(id)?.title || ''} — 2`.trim()
  try {
    await persistRecord(copy)
  } catch {
    // No room on the device. For a signed-in account the copy still went up
    // (persistRecord announces it either way); for a guest it lives until reload.
  }
  useProjects.getState().hydrate()
  return copy.id
}

/* ---------------------------------------------------------------- sample */

/**
 * The empty dashboard's sample: a small furnished living room, laid out in the
 * builder's own scene format, so "open the sample" opens something real — a
 * room that can be rearranged and sent to "Generate design" like any other.
 *
 * Only fields every version of the scene has are written (room, fixtures,
 * items, lighting, budget); the builder fills in whatever newer fields it has
 * added (wall paint, flooring) with its defaults when it loads the room.
 * Coordinates are metres from the room's north-west corner; rotation 0 faces
 * south.
 */
function sampleScene(): StoredScene {
  return {
    room: { shape: 'rect', width: 3.8, depth: 4.4, height: 2.7, notchW: 1.4, notchD: 1.2 },
    fixtures: [
      { id: 'fx_sample_window', kind: 'window', wall: 'north', t: 1.9 },
      { id: 'fx_sample_door', kind: 'door', wall: 'west', t: 3.7 },
    ],
    items: [
      { id: 'it_sample_rug', catalogId: 'rug', x: 1.9, z: 2.3, rotation: 0, material: 'sand' },
      { id: 'it_sample_sofa', catalogId: 'sofa3', x: 2.1, z: 0.52, rotation: 0, material: 'linen' },
      { id: 'it_sample_table', catalogId: 'coffeeTable', x: 2.1, z: 1.9, rotation: 0, material: 'oak' },
      { id: 'it_sample_chair', catalogId: 'armchair', x: 0.75, z: 2.2, rotation: Math.PI / 2, material: 'clay' },
      { id: 'it_sample_plant', catalogId: 'plant', x: 3.4, z: 3.95, rotation: 0, material: 'olive' },
      { id: 'it_sample_lamp', catalogId: 'floorLamp', x: 0.45, z: 0.45, rotation: 0, material: 'ink' },
    ],
    lighting: 'afternoon',
    budget: 18_000_000,
  }
}

/** Creates the sample as a draft project with its plan. Returns it, or null on a full device. */
export function createSampleProject(): Project | null {
  const id = newProjectId()
  // The plan first: `create` announces the whole project, plan included.
  if (!writeScene(id, sampleScene())) return null
  return useProjects.getState().create({
    id,
    title: i18n.t('app.dash.empty.sampleTitle'),
    roomType: 'living',
    style: 'Japandi',
    status: 'draft',
    notes: i18n.t('app.dash.empty.sampleMeta'),
  })
}

/** Copies a room's plan under another project id and marks it for upload. */
export function attachSceneCopy(fromId: string, toId: string): boolean {
  if (!copyScene(fromId, toId)) return false
  projectChanged(toId, 'scene')
  return true
}
