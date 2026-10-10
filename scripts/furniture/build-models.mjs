/**
 * Builds the optimised furniture .glb files in public/models/furniture from
 * the original downloads (Poly Haven glTF + Khronos glTF-Sample-Assets glb).
 *
 *   node scripts/furniture/build-models.mjs <downloadsDir> [onlyId ...]
 *
 * <downloadsDir> holds one folder per source asset, exactly as downloaded:
 *   ph/<polyhavenId>/<polyhavenId>_1k.gltf (+ .bin + textures/)
 *   kh/<KhronosName>/<KhronosName>.glb
 *
 * Per model: drop material variants and punctual lights, bake a yaw so the
 * piece faces +Z with its width on X, mark "tintable" upholstery materials
 * (their colour texture becomes a normalised greyscale so a catalogue finish
 * can be multiplied in without losing the weave), dedupe/prune, resize
 * textures, convert them to WebP and Meshopt-compress the geometry.
 * Sources, authors and licences are listed in public/models/furniture/CREDITS.md.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, KHRMaterialsVariants, KHRLightsPunctual } from '@gltf-transform/extensions'
import { dedup, prune, textureCompress, meshopt, simplify, weld } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(here, '../../public/models/furniture')

/**
 * yaw: radians about +Y applied at the root so the front faces +Z.
 * tint: material-name patterns whose colour follows the catalogue finish.
 * tex: max texture edge. simplify: keep-ratio for very dense meshes.
 */
const MODELS = [
  { id: 'sofa-glam', src: 'kh/GlamVelvetSofa/GlamVelvetSofa.glb', yaw: 0, tex: 2048, tint: [/fabric/i] },
  { id: 'armchair-lounge', src: 'kh/SheenChair/SheenChair.glb', yaw: 0, tex: 1024, tint: [/fabric/i] },
  { id: 'armchair-modern', src: 'ph/modern_arm_chair_01/modern_arm_chair_01_1k.gltf', yaw: 0, tex: 1024, tint: [/pillow/i] },
  { id: 'chair-dining', src: 'ph/dining_chair_02/dining_chair_02_1k.gltf', yaw: 0, tex: 1024 },
  { id: 'coffeetable-stone', src: 'ph/modern_coffee_table_01/modern_coffee_table_01_1k.gltf', yaw: -Math.PI / 2, tex: 1024 },
  { id: 'diningtable-wood', src: 'ph/wooden_table_02/wooden_table_02_1k.gltf', yaw: 0, tex: 1024 },
  { id: 'desk-metal', src: 'ph/metal_office_desk/metal_office_desk_1k.gltf', yaw: 0, tex: 1024 },
  { id: 'shelf-cube', src: 'ph/wooden_display_shelves_01/wooden_display_shelves_01_1k.gltf', yaw: -Math.PI / 2, tex: 1024 },
  { id: 'sideboard-fluted', src: 'ph/modern_wooden_cabinet/modern_wooden_cabinet_1k.gltf', yaw: 0, tex: 1024 },
  { id: 'plant-ficus', src: 'ph/potted_plant_01/potted_plant_01_1k.gltf', yaw: 0, tex: 1024, simplify: 0.5 },
  { id: 'pendant-globe', src: 'ph/modern_ceiling_lamp_01/modern_ceiling_lamp_01_1k.gltf', yaw: 0, tex: 1024 },
  { id: 'divider-screen', src: 'ph/chinese_screen_panels/chinese_screen_panels_1k.gltf', yaw: 0, tex: 1024 },
]

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder })

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const hex = (rgb) => '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('')

/** Greyscale the colour map, normalised to a bright mean, and return the mean sRGB colour. */
async function neutralise(texture) {
  const img = sharp(Buffer.from(texture.getImage()))
  const stats = await img.stats()
  const ch = stats.channels.map((c) => c.mean / 255)
  // Greyscale (+alpha) sources report one or two channels.
  const mean = ch.length >= 3 ? ch.slice(0, 3) : [ch[0], ch[0], ch[0]]
  const lum = 0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2]
  const TARGET = 0.82
  const gain = TARGET / Math.max(lum, 0.02)
  // Brightening a dark texture to TARGET multiplies its wear and dirt by the
  // same gain; cap the resulting contrast so a black leather does not turn
  // into a blotchy cream one. out = TARGET + (x - mean) * slope.
  const greyStats = await sharp(Buffer.from(texture.getImage())).grayscale().stats()
  const std = greyStats.channels[0].stdev / 255
  const MAX_STD = 0.07
  const slope = Math.min(gain, MAX_STD / Math.max(std, 1e-3))
  const grey = await sharp(Buffer.from(texture.getImage()))
    .grayscale()
    .linear(slope, (TARGET - slope * lum) * 255)
    .png()
    .toBuffer()
  texture.setImage(new Uint8Array(grey)).setMimeType('image/png')
  return mean
}

async function build(spec, root) {
  const doc = await io.read(path.join(root, spec.src))
  const gltf = doc.getRoot()

  // Material variants (Khronos showcase assets): keep each primitive's default.
  for (const ext of gltf.listExtensionsUsed()) {
    if (ext instanceof KHRMaterialsVariants || ext instanceof KHRLightsPunctual) ext.dispose()
  }
  for (const node of gltf.listNodes()) if (node.getCamera()) node.setCamera(null)

  // Bake the facing.
  const scene = gltf.getDefaultScene() ?? gltf.listScenes()[0]
  const pivot = doc.createNode('fs_root').setRotation([0, Math.sin(spec.yaw / 2), 0, Math.cos(spec.yaw / 2)])
  for (const child of scene.listChildren()) {
    scene.removeChild(child)
    pivot.addChild(child)
  }
  scene.addChild(pivot)

  // Tintable upholstery.
  if (spec.tint) {
    for (const mat of gltf.listMaterials()) {
      if (!spec.tint.some((re) => re.test(mat.getName()))) continue
      const base = mat.getBaseColorTexture()
      let srgb
      if (base) {
        srgb = await neutralise(base)
        const lin = srgb.map((c) => srgbToLinear(Math.min(1, c / 0.82)))
        mat.setBaseColorFactor([...lin, mat.getBaseColorFactor()[3]])
      } else {
        srgb = mat.getBaseColorFactor().slice(0, 3).map((c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055))
      }
      mat.setExtras({ ...mat.getExtras(), fsTint: true, fsDefault: hex(srgb) })
    }
  }

  await doc.transform(dedup(), prune(), weld())
  if (spec.simplify) {
    await MeshoptSimplifier.ready
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: spec.simplify, error: 0.002 }))
  }
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [spec.tex, spec.tex], slots: /^(?!normalTexture).*$/, quality: 82 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [spec.tex, spec.tex], slots: /^normalTexture$/, quality: 90 }),
    prune(),
  )
  await MeshoptEncoder.ready
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }))

  fs.mkdirSync(OUT, { recursive: true })
  const out = path.join(OUT, `${spec.id}.glb`)
  await io.write(out, doc)
  console.log(spec.id.padEnd(20), (fs.statSync(out).size / 1024).toFixed(0).padStart(6), 'KB')
}

const [root, ...only] = process.argv.slice(2)
if (!root) {
  console.error('usage: node scripts/furniture/build-models.mjs <downloadsDir> [id ...]')
  process.exit(1)
}
for (const spec of MODELS) {
  if (only.length && !only.includes(spec.id)) continue
  await build(spec, path.resolve(root))
}
