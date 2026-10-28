# 10 Roadmap

## Strategy

Build the smallest thing that proves the loop is fun, then widen it. Everything is greyboxed first. Art comes after the slice plays well.

The **vertical slice** is Bellwether's core, the whole Old Works, and the Sluicekeeper: the full first chapter, about 6–8 hours of play. Nothing deeper gets built until the slice is fun.

| Milestone | Goal | Proves | Status |
|---|---|---|---|
| **M0 Foundations** | Walk around, ride a lift, save and load | The tech works | Done |
| **M1 First Commute** | Mine, sell, craft, sleep, repeat | The economy loop is satisfying without combat | Done |
| **M2 Danger** | Fight readable enemies in first person | Combat is fair and fun | Done, needs a hands-on feel pass |
| **M3 Lantern Pool** | Fish, cook, take the first shortcut, survive the Irregular | Relaxed and tense trips both feel good | Done, needs a hands-on feel pass |
| **M4 The Pump Station** | Repair the station, beat the Sluicekeeper, rank up | The full chapter works start to finish | Done, needs a hands-on feel pass |
| **M5 Art and feel** | Replace greybox, light it, score it | It looks and sounds like the game | First pass done: textures, light, atmosphere, audio, UI, performance. Models still built in code |
| **M6 Bellwether Grows** | Give money and materials somewhere to go, and each day something different | The town track and daily variety hold up | Done |
| **M7 The Loop Holds** | Make the loop itself better: pacing, feedback, clarity | Trips feel worth taking, start to finish | Done, pacing checked by tests |
| **M8 Art Overhaul** | One cohesive, distinctive look across the slice ([12](12-art-direction.md)) | It looks like nothing else | First pass done |

## M0 Foundations

Walk around a greybox Lift Plaza, ride the lift down into a greybox Entry Yard and back, and keep your position and a test flag through a save and reload.

## M1 First Commute

- Copper and iron nodes with swings, Mining XP, levels, XP drops, and the skill guide
- Pack slots, the bank, and selling at the market
- Oren crafts an iron pickaxe (Smithing XP)
- Sleep to start a new day; nodes refresh on their cooldowns
- Noticeboard with one main and one optional objective, pinned on the expedition card
- The cracked wall by the Entry Yard

**Exit:** the "make enough money to stay" loop holds up for 30–60 minutes with no combat at all.

## M2 Danger

- Blade and boltcaster, dash, health, eating food to heal
- Scuttler, Bellcap, Slagback
- The telegraph system, attack tokens, off-screen threat markers
- Cores drop and sell at the Survey Office
- Defeat and rescue

**Exit:** fights in the Broken Galleries are readable and fair, and going down feels like a setback rather than a reset.

## M3 Lantern Pool

- Fishing, Pell's kitchen, cooking, meal buffs
- The ladder-drop shortcut
- The Irregular chase sequence
- Safe rooms
- Tavi's first appearance

**Exit:** a relaxed fishing trip and a tense mining trip both feel good, in the same session.

## M4 The Pump Station

- The Lower Cut and the Pump Station
- Rivet Sentry, Lampwarden, Sinkmaw
- Water surges, valves, and the three repair objectives
- Cobalt and the tempered pick head
- The Sluicekeeper
- The Rank II ceremony, the floor markers lighting up, the deep lift descending, the festival

**Exit:** a new player can go from the license test to the deep lift without help.

## M5 Art and feel

Real models and textures for the slice, lighting, bloom, audio, music, UI polish, a settings menu, and performance hitting the budget in [08](08-tech-architecture.md).

## M6 Bellwether Grows

- Daily conditions on the noticeboard: rich seams, blooms, fish running, Bram's demand, core bounties, swarms
- The Town Works board: supply and fund projects that go up overnight and change the town
- Your own house on the plaza: bed, storage, hearth, and a trophy shelf
- Tavi's rescue, a mirror of your own
- The main lift reaches the Pump Station once it runs; the Sluicekeeper can be repaired and put back to work

**Exit:** after the license test there's always something to save for and something different about today.

## M7 The Loop Holds

- Pacing targets from doc 04 written down as tests against the real placements and numbers
- Glints: the optional active bonus while mining
- The skill guide, and the next unlock on the expedition card
- A trip summary when you come back up
- Fixes from a scripted run through the chapter

**Exit:** every trip ends with a visible result, and the first hour has no dead time.

## M8 Art Overhaul

The art direction is in [12](12-art-direction.md). Lighting and grading, organic caves, the builders' architecture, the town rebuilt as a vertical ring, and hero props from Blender.

First pass (done):

- [x] The art direction doc: one line, three kinds of light, three material families, readability rules, each area's identity
- [x] Lit air: every nearby lamp hangs in the fog as a warm halo, and mist pools in the shaft and on the pool (D41)
- [x] A colour grade per area: cool lifted shadows, warm highlights, vignette, grain (D42)
- [x] Natural rock reshaped at build time, with strata, seeps, and darker hollows; builders' stone stays precise (D43)
- [x] New rock, iron, rust, and timber textures; timber grain follows each beam; a slow colour drift hides tiling everywhere
- [x] Held tools modelled in headless Blender: pickaxe, blade, rod, boltcaster, resonance, and a gloved hand, with tier metals that read as copper, iron, and cobalt (D44, D45)
- [x] Ore seams stained by their ore, with the ore in its own habit: copper nuggets, iron cubes, cobalt crystals (D47)
- [x] Six-sided iron lanterns everywhere a lamp hangs
- [x] Bellwether rebuilt: the builders' ring with pilasters, terraces, and cornice; a hundred houses stacked up it; jettied shops; paving, trees, and strung lamps; a braced headframe with a winding house; a gradient sky (D46)

Next:

- Characters and enemies: Bellwether's people are still capsules, and the enemies are primitive builds
- Hand-built hero spaces in Blender for the Pump Station and Lantern Pool
- Chimney smoke, birds over the ring by day, drips and falling grit underground
- The Lower Cut runs at about 275 draw calls, over the 250 budget: instance the botany patches and seam chunks
- Character-scale props from Blender (crates, barrels, carts) to replace the box-built ones

## After the slice

Resident arcs beyond Tavi, the Echo Lens, then pre-production on the Rootvault.

---

## Build log

### M0 (done)

- [x] Vite + TypeScript (strict) + three.js scaffold, build passing
- [x] Folder structure and design docs
- [x] Rapier, lil-gui, and Vitest
- [x] `Game` shell: fixed 60 Hz simulation, per-frame render with interpolation, hit-stop, resize handling
- [x] Typed event bus and seeded RNG in `core/`
- [x] Input service: keyboard and mouse, pointer lock, a rebindable action map
- [x] First-person controller: Rapier kinematic character controller, steps and slopes, crouch, sprint, dash with i-frames, head-bob toggle
- [x] Areas built in code with `LevelKit` instead of GLB files (D14)
- [x] Greybox Lift Plaza (Bellwether) and Entry Yard
- [x] Lift transition: fade, unload, load, place the player at the spawn
- [x] Interaction ray with occlusion, press and hold, DOM prompt
- [x] Typed data: items, flags, areas, nodes, recipes
- [x] `WorldState` with versioned save, migrations, and load in `localStorage`
- [x] Debug panel: teleport, give item, set flag, show colliders, stats
- [x] Vitest tests (XP curve, inventory, gathering odds, market)

### M1 (done)

Mining with swings and success odds, XP drops and level-ups, the pack and bank, the market with daily sell limits, Oren's forge, sleeping at the inn, the noticeboard and job tracker, the expedition card (Tab), the license test, the cracked wall and storeroom, and the schematic delivery.

### M2 (done)

- Blade combo, deflect, boltcaster with aim and reload, resonance surge, food on 1–4
- Scuttler, Bellcap, Slagback; telegraphs, attack tokens, hitsplats, off-screen threat arrows, hurt vignette
- Defeat and rescue: Mara hauls you up, half of each unbanked stack is lost, a small fee
- The Broken Galleries: main gallery, west cavern, east pillar chamber, the collapse, the freight gate
- The worker shelter in the Entry Yard is a safe room: rest on the bench to heal and save
- The Irregular chase (pulled forward from M3)

### M3 (done)

- Lantern Pool: the lake and its glowworm ceiling, lantern eels under the water, the stranded platform
- Fishing: Pell's rod, bait, three kinds of spot, cast, wait, strike (D15)
- Meal buffs from Pell's kitchen: Hearty, Sure-footed, Keen (D17)
- The rope-ladder shortcut between Lantern Pool and the Entry Yard (D16)
- The platform walkway repair
- Safe rooms share one rest bench: the worker shelter and the maintenance hut
- Tavi's first appearance, with hints toward the ladder and the walkway

### M4 (done)

- The Lower Cut (Floor 4): the cut and its stream, the cobalt seam, the dark tunnel that needs the bright lantern (D23), the Hollowhorn's lair, the sentry corridor
- The freight gate, unbolted from the Lower Cut side: a second shortcut back to the galleries (D24)
- Rivet Sentry, Lampwarden, Sinkmaw, the brood nest, and the Hollowhorn as an optional Feat (D19)
- The Pump Station (Floor 5): the sluice gallery's surges and valves (D22), the flooded hall, the generator, intake and control wings
- The three repairs: feed cores to the power cells (D21), clear the intake nest, have Iona translate the control plate
- The tempered pick head in the control-room locker, for the cobalt pickaxe
- The Sluicekeeper: armoured until it vents, jets you jump or crouch, a second phase that floods the basin (D20)
- Rank II for either Feat, Mara's deep-lift ceremony, the floor markers lighting up, festival lights left strung over the plaza
- The surge lantern, forged from the Sluicekeeper's pressure valve

### M5 (first pass)

- PBR texture sets for all 16 level-kit surfaces (albedo, normal, ORM), generated by `tools/textures.ts` and tiling at real-world scale (D25)
- Loose props and held tools get the same metre-scaled UVs as level geometry
- Lighting pass: base exposure 1.3 with a Brightness setting, stronger lantern, more fill underground, tinted fog so distance reads as haze (D29)
- Atmosphere: dust motes around the player underground (cyan at Lantern Pool), fake volumetric glow under every lantern
- Audio, all synthesized at runtime: effects for combat, gathering, fishing and the lift; ambience per area; town, delve and boss music; cave reverb; footsteps (D26)
- Volume and Music sliders
- Narrow windows move the vitals to the top-left so the hotbar never covers them (D28)
- Lamp shadows bake once per area and on world changes; enemies get blob shadows. Every area is now 110–210 draw calls and under 150k triangles (D27)

Still to do for M5 proper: real models for props and enemies (Blender headless or ComfyUI's TRELLIS), ComfyUI-sourced surface detail for the organic textures, KTX2 compression, mist in the shaft, and a hands-on pass on the mix.

### M6 (done)

- Daily conditions: two a day, never the same kind, rolled once and saved (D31). Shown on both noticeboards, the expedition card, and a morning toast
- Town Works board on the plaza: the yard freight hoist, a second kitchen hearth (two recipes and the Steady buff), and great bellows for the forge (the delver's pack and the cobalt blade) (D32)
- The lamplighter's house on the plaza ring, sold by Hollis for 300 bells: sleep, storage, cooking, and a shelf of eight trophies that fill in from what you've done (D33)
- Tavi goes missing after you reach the Lower Cut; a note at the hut, then a rescue in the dark tunnel that takes food. Reward: Tavi's lucky knot, a charm for a third dash (D34)
- The main lift stops at the Pump Station once the Sluicekeeper is shut down, and the station has its own lift home (D35)
- Repairing the Sluicekeeper is an on-site project; afterwards it tends the pumps and sends your haul up (D38)
- Saves are version 2, migrated from 1

### M7 (done)

- `src/skills/pacing.test.ts` checks the doc 04 targets: Mining 10 inside two days of yard and gallery copper, the iron pickaxe in a day of iron, Mining 10 to 15 in a few days, brisk swings at every tier
- Copper seams yield 4–6, and the Entry Yard has seven of them (D37)
- Glints while mining (D36)
- The skill guide in the pause menu, built from the data, and the next unlock under each skill on the card
- The trip summary when you come back up, including after a rescue
- Objectives name a landmark for town buildings; the level-up banner sits below the area caption; the Entry Yard noticeboard shows the full board; a side objective to save for the house

## Not now

Multiplayer, procedural generation, controller support, a desktop build, localization, and every region below the Old Works.
