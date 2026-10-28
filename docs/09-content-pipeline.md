# 09 Content Pipeline

## Folders

| Folder | Holds | Shipped? |
|---|---|---|
| `assets-src/blender/` | `.blend` files, one per area plus prop libraries | No |
| `assets-src/textures/` | Source textures, layered files, ComfyUI outputs | No |
| `assets-src/audio/` | Raw recordings and project files | No |
| `assets-src/concept/` | Concept art and reference | No |
| `public/assets/areas/` | One GLB per area | Yes |
| `public/assets/models/` | Props, weapons, viewmodels, enemies | Yes |
| `public/assets/textures/` | Runtime textures | Yes |
| `public/assets/audio/` | Runtime audio | Yes |
| `public/assets/ui/` | Icons and UI art | Yes |

Paths mirror each other: `assets-src/blender/areas/old-works/entry-yard.blend` exports to `public/assets/areas/old-works/entry-yard.glb`.

## Greybox first

Every area starts as untextured blocks plus markers, and gets playtested as a route before any art goes in. Greybox colour code:

| Colour | Means |
|---|---|
| Light grey | Walkable floor |
| Dark grey | Walls |
| Yellow | Interactables: nodes, levers, NPCs |
| Red | Hazards |
| Blue | Shortcuts and one-way routes |
| Green | Safe rooms |

## Blender to glTF

For the vertical slice, areas are built in code with the level kit (`src/world/level-kit.ts`), so routes can be playtested and changed quickly. Blender is for props and for hand-built areas later.

**Blender is shared with other projects on this machine.** Automated work for Floor Zero runs in its own headless process (`blender --background --factory-startup --python <script>`), never in the live session someone else may be using.

**Export settings** (glTF 2.0 exporter):

- Format: glTF Binary (`.glb`)
- Include: the area's collection only, with **Custom Properties** on
- Transform: **+Y Up** (Blender is Z-up; the exporter converts)
- Mesh: apply modifiers, UVs, normals, vertex colours
- Punctual lights: **off**. Lights are placed as markers so the game controls intensity.
- Compression: off for now. Meshopt via gltf-transform once real art arrives.

**Scale:** 1 Blender unit is 1 metre. The player capsule is 1.8 m tall, eyes at 1.65 m. Keep doorways at least 2.2 m tall and corridors at least 1.6 m wide, wider wherever there's combat.

### Markers

Markers are **empties** with a custom property `kind`. The loader reads them from `userData` and turns them into typed data.

| `kind` | Other properties | Used for |
|---|---|---|
| `spawn` | `id` | Where the player arrives from a lift or door |
| `node` | `id`, `type` (e.g. `copper_seam`) | A resource node |
| `fish` | `id`, `pool` | A fishing spot |
| `enemy` | `type`, `group` | An enemy spawn point |
| `trigger` | `id`, `event` | A volume. Use a cube mesh; its scale is the volume's size |
| `gate` | `id`, `flag` | A gate or door that opens when a flag is set |
| `lift` | `id`, `station` | A lift platform or control |
| `light` | `color`, `intensity`, `range` | A point light the game creates |
| `safe` | `id` | A safe room bench |
| `floor_panel` | `floor` | A floor marker that lights up when its station has power |

### Colliders

- Collision comes from dedicated low-poly meshes named `COL_*`. They become static Rapier colliders and are hidden at runtime.
- Render meshes never collide. Collision stays simple, fast, and free of snagging on decorative detail.
- Leave small gaps out of collision meshes, smooth stairs into ramps, and keep walls slightly thicker than they look.

### Repeated props

Use linked duplicates in Blender, then run gltf-transform's instancing step, so repeated props (lanterns, carts, crates) export as GPU instances instead of separate draw calls.

### Stable IDs

`id` values are save-file keys: node depletion, opened gates, and spawns are all stored by ID. **Never rename a placed ID without writing a save migration** ([08](08-tech-architecture.md)).

## Art direction

**Decided 2026-10-28:** detailed and grounded, going for a lowkey triple-A feel within what a browser and a small team can do. Not low-poly, not pixel art.

The theme: **warm lamplight over cold depths.** Bellwether glows amber. The dungeon is cold, blue, and foggy. Cores and lanterns are the light you carry between them.

How we get there:

- **PBR materials everywhere:** colour, normal, roughness, and ambient occlusion maps at 1K–2K, tiled with world-space UVs so surfaces never stretch.
- **Detail where light hits it:** bevelled edges, chamfered stone, beams, trims, pipes, rubble, and displaced rock for cave walls. Silhouettes stay readable; surfaces carry the detail.
- **Lighting does most of the work:** AgX tone mapping, real shadows from a few key lights, screen-space ambient occlusion, bloom on lanterns and cores, exponential fog, fake volumetric light shafts, floating dust.
- **Hero props** (machinery, the lift, statues) can come from ComfyUI's image-to-3D, cleaned up and decimated.
- **A quality setting** (Low, Medium, High) scales shadows, ambient occlusion, and resolution so it still runs on laptops.

**Palette starting points:**

| Where | Colours |
|---|---|
| Town | Amber, honey, warm wood, soot |
| Old Works | Slate, rust, damp stone, lantern amber |
| Dungeon light | Teal and cold blue |
| Hostile projectiles | Acid magenta, reserved for danger only |
| Cores | Pale cyan-white glow |

Texture density: about 512 texture pixels per metre up close (a 1K texture tiling every 2 m), with anisotropic filtering on floors.

## Blender scripts

Props are built by Python scripts in `tools/blender/`, not hand-edited `.blend` files, so they can be reviewed, rerun, and changed by anyone.

```
blender --background --factory-startup --python tools/blender/viewmodels.py -- --preview <out.png>
```

- `common.py` has the shared helpers: lofts along paths, lathes, tori, boxes, smooth shading split by angle, export, and a Workbench preview render.
- `viewmodels.py` builds the held tools and the gloved hand into `public/assets/models/viewmodels.glb`. Each tool is a root empty named for its `Held` kind, with a `<tool>_grip` empty where the hand goes.
- Name each Blender material for a MaterialLibrary key (`wood`, `leather`, `metal`). The game swaps in its own materials at load, and `tier` becomes the tool's metal.
- `--preview` renders every model in a grid before exporting, so a script change can be checked without starting the game.
- Always run headless. The live Blender session is shared with other projects.

## Textures

`node tools/textures.ts [name ...]` regenerates the level kit's texture sets into `public/assets/textures/` as `<name>_albedo.jpg`, `<name>_normal.jpg` (OpenGL convention) and `<name>_orm.jpg` (occlusion, roughness, metalness). It needs ImageMagick's `magick` on the PATH. Every map is periodic, so everything tiles.

- Structured surfaces (brick, stone courses, flagstones, cobbles, planks, roof tiles) are laid out block by block, with per-block colour and surface variation.
- Rock, iron, rust, and timber carry detail at hand scale only. The big shapes (rock relief and strata, colour drift) come from the geometry and from shaders in world space, so nothing large enough to show the tile repeating is baked in.
- Timber's grain runs vertically in the image; level geometry turns it to run along each beam.
- Organic surfaces (rock, dirt, plaster, moss, canvas) take a source image if one exists at `assets-src/textures/<name>.png`, made seamless by the tool. That's where ComfyUI renders go.
- Each material's real-world tile size lives in `src/world/materials.ts`. Level geometry and loose props both get box-projected UVs in metres.

## Tools available on this machine

| Tool | Use it for |
|---|---|
| **Blender** | Props and future hand-built areas. Shared with other projects, so automated work uses a separate headless process |
| **ComfyUI** (local GPU) | Seamless textures, item icons, concept art. TRELLIS image-to-GLB for props, which need cleanup and decimation afterwards |
| **Poly Haven, Poly Pizza** (CC0) | Placeholder props and textures |
| **jsfxr** | Placeholder sound effects (unused so far: everything is synthesized in `src/audio/audio.ts`) |

## Icons and UI

- Item icons are painted 128×128 images on transparent backgrounds, lit from the top left.
- The HUD stays sparse in the dungeon: health, food hotbar, expedition card, XP drops, threat markers, interaction prompt.

## Audio priorities

In first person, sound carries half the gameplay information. In priority order:

1. Every enemy windup and every projectile type's whoosh (gameplay-critical)
2. The lift bell, the game's signature sound
3. Ore strikes and breaks, a fish biting, the float plopping
4. The XP drop chime and the level-up fanfare
5. Footsteps by surface
6. Ambience: the town (chatter, the forge, wind in the shaft) and the Old Works (drips, distant machinery)
