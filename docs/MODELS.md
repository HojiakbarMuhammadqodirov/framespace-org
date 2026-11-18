# 3D models in the room builder

The builder is a hybrid: most furniture is built from code (`src/three/furniture`),
and a few hero pieces are real modelled `.glb` files, loaded only on capable
devices and only when that piece is placed. The code-built version of the same
piece is the loading state and the low-tier ("Simplified 3D") fallback.

## What is shipped

| File (`public/models/`) | Used by catalogue id | Source | Licence | Size |
| --- | --- | --- | --- | --- |
| `sofa-velvet.glb` | `sofa3` | *GlamVelvetSofa* — © 2021 Wayfair, LLC | CC BY 4.0 | 0.46 MB |
| `accent-chair.glb` | `armchair` | *SheenChair* — © 2020 Wayfair, LLC | CC0 1.0 | 0.58 MB |
| `plant-pot.glb` | `plant` | *DiffuseTransmissionPlant* — © 2024 Darmstadt Graphics Group GmbH; original asset by Rico Cilliers (CC0) | CC BY 4.0 | 1.4 MB |
| `sofa-classic.glb` | `sofaClassic` | *SheenWoodLeatherSofa* — © 2024 Darmstadt Graphics Group GmbH; original asset by Fran Calvente (CC0) | CC BY 4.0 | 1.2 MB |

All four come from the Khronos Group
[glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) repository.
The CC BY models require attribution wherever the site is published: keep
`public/models/CREDITS.txt` deployed, and link it from the legal/about page.
The files were modified: lights, animation and material variants removed,
meshes simplified, textures resized to 1024 px WebP, meshopt compression.

## Adding a model

1. Get a `.glb` with a licence that allows commercial use (CC0 from Poly Haven
   is the easiest). Front of the piece should face +Z; if it does not, add a
   quarter-turn for it in `YAW` in `src/three/builder/GlbBody.tsx`.
2. Optimise it — target under ~1.5 MB:
   ```bash
   npx @gltf-transform/cli optimize in.glb public/models/<name>.glb \
     --texture-compress webp --texture-size 1024 --compress meshopt --simplify-ratio 0.5
   ```
   Use **meshopt**, not Draco: the meshopt decoder is bundled, Draco's would be
   fetched from a third-party CDN at runtime.
3. Point a catalogue entry at it in `src/features/room-builder/catalog.ts`:
   `model: '<name>'`, and set the entry's `w` / `d` / `h` to the real piece's
   dimensions in metres — the model is scaled to fit them.
4. If the upholstery should follow the Finish swatches, add a regex matching
   that material's name to `TINTABLE` in `GlbBody.tsx`; otherwise set
   `tintable: false` on the entry so the inspector hides the swatches.
5. Add its row to the table above and to `public/models/CREDITS.txt`.

Still code-built, and the best candidates to replace next: bed, dining chair,
dining table, wardrobe.
