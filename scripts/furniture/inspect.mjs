// usage: node inspect.mjs <file.gltf|glb> ...   (run with cwd = repo so node resolves @gltf-transform)
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { getBounds } from '@gltf-transform/core'

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
for (const file of process.argv.slice(2)) {
  const doc = await io.read(file)
  const root = doc.getRoot()
  const scene = root.getDefaultScene() || root.listScenes()[0]
  const b = getBounds(scene)
  let tris = 0
  for (const mesh of root.listMeshes())
    for (const p of mesh.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3
  console.log('==', file.split(/[\\/]/).slice(-2).join('/'))
  console.log('  bbox min', b.min.map((v) => v.toFixed(3)).join(','), 'max', b.max.map((v) => v.toFixed(3)).join(','), 'tris', Math.round(tris))
  for (const m of root.listMaterials()) {
    const tex = []
    if (m.getBaseColorTexture()) tex.push('base')
    if (m.getNormalTexture()) tex.push('nrm')
    if (m.getMetallicRoughnessTexture()) tex.push('mr')
    if (m.getOcclusionTexture()) tex.push('ao')
    if (m.getEmissiveTexture()) tex.push('emis')
    console.log('  mat', JSON.stringify(m.getName()), 'base', m.getBaseColorFactor().map((v) => +v.toFixed(2)).join(','), tex.join('+'), m.getAlphaMode(), m.listExtensions().map((e) => e.extensionName).join(','))
  }
  for (const t of root.listTextures()) {
    const s = t.getSize()
    console.log('  tex', t.getURI() || t.getName(), t.getMimeType(), s?.join('x'), Math.round((t.getImage()?.byteLength ?? 0) / 1024) + 'KB')
  }
}
