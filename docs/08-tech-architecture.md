# 08 Tech Architecture

## Stack

| Piece | Choice | Status |
|---|---|---|
| Language | TypeScript 7, `strict: true` | Installed |
| Build | Vite 8 | Installed |
| Rendering | three.js **0.186.1** with `@types/three` **0.186.0**. Bump both together, matching minor versions. | Installed |
| Physics | `@dimforge/rapier3d-compat` 0.21 (character controller, static colliders, sensors, ray casts) | Planned for M0 |
| Debug UI | lil-gui | Planned for M0 |
| Tests | Vitest | Planned for M0 |
| UI | DOM overlay in plain TypeScript. Revisit Preact if menus get heavy. | Decided |
| Audio | Web Audio through three's `AudioListener` and `PositionalAudio` | Decided |

**Targets:** desktop browsers (Chrome, Edge, Firefox, Safari), keyboard and mouse first, gamepad later. A desktop build (Tauri or Electron) for Steam can come much later without changing the code.

We use `WebGLRenderer`. `WebGPURenderer` is worth revisiting if we ever need compute shaders.

## Code layout

```
src/
  main.ts      entry point, creates the Game
  core/        game loop, typed event bus, input, seeded RNG, math helpers
  render/      renderer setup, tone mapping, post-processing, shared materials
  physics/     Rapier world wrapper, colliders built from glTF, character controller
  world/       area loading and unloading, markers, triggers, lifts, the day cycle
  player/      first-person controller, camera, viewmodel, interaction ray
  combat/      weapons, projectiles, damage, enemy AI, attack tokens
  skills/      XP curve, skill state, gathering nodes and swings      (pure logic)
  items/       inventory, bank, equipment, crafting, market           (pure logic)
  town/        NPCs, dialogue, shops, requests, projects, home
  ui/          DOM HUD and menus
  audio/       audio manager and cues
  save/        WorldState serialization and migrations                (pure logic)
  data/        typed content: items, recipes, skills, enemies, areas, NPCs, flags
```

**Rule:** pure-logic modules (`skills/`, `items/`, `save/`, `data/`) never import three.js or touch the DOM. That keeps the game's rules fast to test and easy to reason about.

## Runtime shape

- **`Game`** owns the loop, the services, and the current `Area`.
- **Services:** `Input`, `Assets` (GLTFLoader plus a cache), `Physics`, `Audio`, `Save`, and `Events`.
- **`Area`** is one loaded place: a GLB plus its `AreaDef`. It owns its entities and disposes of everything when unloaded.
- **Entities** are plain TypeScript classes with `update(dt)`. No ECS library until we actually feel the pain.
- **`WorldState`** is one serializable object holding everything that persists. The save file is just this object.
- **Events:** systems change `WorldState` and emit typed events (`xpGained`, `itemAdded`, `flagSet`, `dayStarted`). UI and audio subscribe. Systems don't call the UI directly.

```ts
interface EventMap {
  xpGained: { skill: SkillId; amount: number };
  itemAdded: { item: ItemId; count: number };
  flagSet: { flag: FlagId };
  dayStarted: { day: number };
}
```

## Game loop

- **Simulation runs at a fixed 60 Hz** with an accumulator: input snapshot, player movement, AI, projectiles, combat, gathering swings, triggers.
- **Rendering runs every animation frame.** Mouse look is applied immediately each frame, never in the fixed step, so aiming stays crisp at any refresh rate. Moving objects are interpolated between the last two simulation states.

## Content as typed data

All content lives in `src/data/` as TypeScript objects, and IDs are derived types. A typo in a recipe is a compile error, not a bug you find on Floor 4.

```ts
export interface ItemDef {
  name: string;
  stack: number; // max per pack slot; 1 means it doesn't stack
  value: number; // base sell price in bells
}

export const ITEMS = {
  copper_ore: { name: 'Copper ore', stack: 1, value: 4 },
  iron_ore: { name: 'Iron ore', stack: 1, value: 9 },
  dim_core: { name: 'Dim core', stack: 50, value: 6 },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;
```

Recipes, loot tables, node definitions, and shop stock all reference `ItemId`, `SkillId`, `FlagId`, and so on.

## Areas and streaming

- Each area is built in code with the level kit (`src/world/level-kit.ts`): rooms, corridors, ramps, props, and markers. Static geometry is merged into one mesh per material, with box colliders. Props from Blender or ComfyUI arrive as GLBs ([09](09-content-pipeline.md)).
- **Lift rides and heavy doors are the loading screens.** While the lift descends, the old area unloads and the next one loads. Neighbouring areas preload in idle time.
- Unloading must dispose geometries, materials, and textures. GPU memory isn't garbage collected.
- For areas built in Blender later, empties carry custom properties that arrive as `userData` on three.js objects and map to the same marker types (spawns, nodes, enemies, triggers, lifts, lights). Meshes prefixed `COL_` become Rapier colliders and are hidden.

## World state and saves

```ts
interface WorldState {
  version: number;
  day: number;
  player: {
    area: AreaId;
    position: [number, number, number];
    yaw: number;
    health: number;
    licenseRank: number;
    deepestFloor: number;
    money: number;
    skills: Record<SkillId, number>; // total XP per skill
    proficiencies: Record<WeaponFamily, number>;
    pack: ItemStack[];
    equipment: Equipment;
  };
  bank: ItemStack[];
  flags: FlagId[]; // permanent world changes: gates, lifts, bosses
  nodes: Record<NodeId, { depletedOnDay: number }>; // renewables
  discoveries: DiscoveryId[];
  town: { projects: Record<ProjectId, ProjectState>; bonds: Record<NpcId, number> };
}
```

- JSON in `localStorage` to start. Move to IndexedDB if saves pass about 1 MB.
- Every save has a `version`. Loading runs migrations in order (`migrations[v](state)`), so old saves never break.
- Autosave on area transitions and when sleeping. Three manual slots. Export and import of save files, for debugging.
- Level-placed IDs (nodes, gates, spawns) are save keys. **Never rename one without a migration.**

## Interaction and gathering

- A centre-screen ray from the camera finds the interactable you're looking at, and the HUD shows a prompt such as "Hold E: mine copper seam."
- Gathering runs in swings ([04](04-progression.md)): every swing interval (set by tool tier), roll success from skill level against node level. All randomness uses the seeded RNG.

## Combat tech

- **Projectiles are not physics bodies.** They're pooled, drawn with one `InstancedMesh` per projectile type, moved in the fixed step, and tested with simple sphere checks against the player plus Rapier ray casts against the world.
- **Enemy AI** is small state machines (idle, patrol, alert, windup, attack, recover, flee) driven by data: windup time, telegraph type, projectile pattern.
- An **attack token** manager limits how many enemies can attack at once ([05](05-combat.md)).

## Rendering

The look is detailed, grounded PBR with heavy atmosphere (D13).

- AgX tone mapping, sRGB output, exponential fog per area.
- PBR materials with colour, normal, roughness, and AO maps, on world-space UVs from the level kit.
- Post-processing: render, ground-truth ambient occlusion (GTAO), bloom for lanterns and cores, output, then SMAA.
- Shadows from a few key lights per area. Lanterns are emissive bulbs plus a limited set of real point lights.
- Atmosphere: fake volumetric light shafts, floating dust, mist rising from the shaft.
- Quality presets (Low, Medium, High) toggle AO, shadow resolution, pixel ratio, and bloom.

## Performance budget

60 fps at 1080p on integrated laptop GPUs (Intel Iris Xe class):

- 250 draw calls or fewer per area
- 500k triangles in view or fewer
- `InstancedMesh` for repeated props
- KTX2 textures and meshopt-compressed GLBs once real art arrives

The debug panel shows `renderer.info` draw calls, triangles, and frame time at all times in dev.

## Debug tools

A lil-gui panel (toggle with the backquote key): teleport to any marker, give items, set skill levels, advance the day, set or clear flags, show colliders, free camera, and the stats above.

## Testing

Vitest for the pure logic: the XP curve, swing success rolls, loot tables, recipe validation, market saturation, save migrations. Seeded RNG makes tests and bug repros deterministic.

## Conventions

- Units are metres and seconds. +Y is up.
- Player capsule: 1.8 m tall, 0.35 m radius. Eye height 1.65 m.
- File names are kebab-case. Named exports only.
- No `any`. Prefer `unknown` and narrowing at boundaries (save files, glTF `userData`).
- `npm run typecheck` passes before any change is called done.
