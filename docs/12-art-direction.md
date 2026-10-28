# 12 Art Direction

The rules for how Floor Zero looks. Doc 09 covers the pipeline; this covers the choices. When a change doesn't serve one of these, it doesn't go in.

## The one line

**Warm lamplight over cold depths.** Bellwether is a lit window. The dungeon is a held breath. The light you carry is the thread between them.

## What the player should feel

| Where | Feeling | How it shows |
|---|---|---|
| Bellwether | Home, relief, a crowded little life clinging to something enormous | Warm windows stacked up the ring, smoke, washing, lamps strung over the plaza, and always the shaft breathing cold mist in the middle |
| The near dungeon (Entry Yard, Galleries) | Work. Familiar danger | Timber, rails and lamps that people put there, over older stone that nobody made |
| The deep dungeon (Pool, Cut, Station) | Wonder, unease, smallness | Fewer lamps, bigger spaces, the builders' architecture taking over from the miners' timber, light that isn't ours |

The emotional arc in doc 01 ("I hope I can make it back" to "this town looks different because I live here") should be readable in the frames themselves: the further down, the less human the light.

## Three kinds of light

Every light in the game is one of these, and each has one job.

| Light | Colour | Means | Where |
|---|---|---|---|
| **Lamplight** | Amber, 2000–2700 K | People have been here. Safety, routes, exits | Lanterns, windows, hearths, the lift. Lamps mark the way: an exit always has a lamp near it |
| **Corelight** | Pale cyan-white | The builders' power: old, precise, waking up | Cores, power cells, the floor markers, the Sluicekeeper's lens, cobalt's glow |
| **Biolight** | Teal and blue-green | The dungeon's own life | Glowcaps, glowworms, lantern eels, lampmoss |
| *Danger* | *Acid magenta* | *Something is about to hurt you* | *Telegraphs and hostile projectiles only. Never decoration* |

Fog is cold: blue-grey in the near dungeon, teal at the pool, smoky umber at the lair. Lamplight hangs in it as a halo, so a lamp across a cavern reads as a warm sphere of lit air, not a dot.

## Three families of material

| Family | Character | Palette | Shapes |
|---|---|---|---|
| **The builders** | Precise, monumental, cold, unexplained. Built for something bigger than people | Pale grey-green stone, verdigris bronze, dark core-glass that lights cyan when powered | Chamfered blocks, perfect circles, radial patterns, the sun-wheel glyph, arches and doors far taller than they need to be |
| **Bellwether** | Hand-made, improvised, warm, a bit crooked | Honey and soot-dark timber, black iron, lime plaster, terracotta roofs, canvas, rope | Posts and braces, stacked boxes, lean-tos, things tied on |
| **The overgrowth** | Soft, slow, quietly alive | Moss green, root brown, mineral cream and rust stains, biolight | Drapes, clusters, crusts, things that drip and spread |

A space reads as a mix of the three. The Entry Yard is mostly Bellwether over builders' bones. The Pump Station is almost all builders. Lantern Pool is builders drowned in overgrowth.

Rough rock (caves, cuts, rubble) is the ground everything sits in: organic, layered, never a flat wall with a rock picture on it.

## Value and composition

- **Dark, never black.** The darkest shadows are deep cold blue, and silhouettes stay readable against the fog.
- **Pools, not floods.** Lamps make pools of warm light with dark between them. The eye travels from pool to pool, which is also the route.
- **One brightest thing per view.** In a room it's the lamp at the exit, the glowing seam, or the boss's eye: the thing that matters.
- **Scale is shown, not stated.** Builders' doors are 5 m tall next to 2 m human doors; the shaft drops out of sight into mist; ceilings disappear upward.

## Readability rules

These outrank everything above.

1. Ore reads by colour and shine from across a room: copper warm orange metal, iron grey-silver with rust, cobalt deep blue with its own glow.
2. Anything you can use is lit or framed: a lamp beside a lever, a lit window by a door.
3. Enemies read against the background: their eyes and seams carry light, and they're never the same colour as the walls they stand against.
4. Magenta means danger and nothing else.
5. Exits have lamps. Dead ends don't.

## The grade

AgX tone mapping, then a gentle filmic grade: cool lifted shadows, warm highlights, a soft S-curve, a light vignette and fine grain. Bellwether's grade is warmer; the dungeon's is cooler. The grade supports the lighting; it never fixes it.

## What we don't do

- Flat boxes standing in for rock, and textures standing in for shape.
- Detail for its own sake: noise on everything, props nobody would have put there, glow on everything.
- Saturated rainbow fantasy colour, purple-pink magic glows, neon.
- Pure black, or pure white skies.
- Low-poly faceting or pixel art (D13).

## How it's built

Where each rule lives in the code, so changes go to the right place.

| Rule | Where |
|---|---|
| Lamplight halos, mist | `src/render/air-pass.ts`, lights chosen in `Game.updateAir`. A light's `userData.air` scales its glow; ore glows and fill lights use a fraction |
| The grade | `src/render/grade-pass.ts`: `GRADES`, picked per area with `grade` on the `AreaDef` |
| Sky | `src/render/sky.ts` |
| Metal that reads as metal | `src/render/environment.ts` |
| Organic rock | `ROUGH` in `src/world/level-kit.ts` (shape), `strata` in `src/world/materials.ts` (colour) |
| Hiding the tile | `weather` on each material in `src/world/materials.ts` |
| Timber grain | `grain` on a material: UVs follow each piece's longest side |
| Ore readability | `src/world/seams.ts` |
| Bellwether | `src/world/town-ring.ts`, assembled in `src/world/areas/lift-plaza.ts` |
| Held tools | `tools/blender/viewmodels.py`, posed by `POSES` in `src/player/viewmodel.ts` |

## Area identities

| Area | Identity | Dominant light | Signature |
|---|---|---|---|
| Bellwether | A town stacked up the inside of a ring | Amber windows over blue dusk, or warm morning sun across the ring | The shaft's cold mist and the headframe over the lift |
| Entry Yard | A working mine landing | Amber | Timber sets, rails, lamps, the grated quarry shaft |
| Broken Galleries | Builders' halls, collapsed and re-propped | Amber pools in grey-blue | Fallen columns, cracked arches, the freight gate |
| Lantern Pool | A drowned cathedral | Teal biolight | The glowworm ceiling over black water |
| Lower Cut | A raw quarry slot with a stream | Sparse amber, deep dark | Strata in the walls, the cobalt glow, the black tunnel, the lair's red fissures |
| Pump Station | The builders' machine, waking | Red emergency light, then cyan corelight | The basin, the pumps, the Sluicekeeper |
