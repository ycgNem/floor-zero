# 11 Decisions & Questions

## Decided

| # | Date | Decision | Why |
|---|---|---|---|
| D1 | 2026-10-28 | TypeScript (strict), Vite, three.js pinned with matching `@types/three` | House standard for every project |
| D2 | 2026-10-28 | First-person 3D | Spatial learning is felt directly, the scale of the shaft and town lands, and there's no animated player body to build |
| D3 | 2026-10-28 | Combat redesigned for first person: fewer, slower, bigger projectiles, telegraphs, attack tokens | The pitch's top-down bullet patterns are unfair when you can't see behind you |
| D4 | 2026-10-28 | Single-player | Scope. Tavi and ambient delvers carry the "other adventurers" feel |
| D5 | 2026-10-28 | Persistent, handcrafted regions. Any variable or endless mode only lives below the story's end | It's the core pillar: a place you learn |
| D6 | 2026-10-28 | Rapier for character collision, sensors, and ray casts (added in M0) | A solid kinematic character controller out of the box |
| D7 | 2026-10-28 | Days advance only when you sleep. No real-time timers | Respect the player's time |
| D8 | 2026-10-28 | Numbered floors, revealed when stations get power | DanMachi's bragging rights, plus a recontextualization moment |
| D9 | 2026-10-28 | License ranks earned by Feats | DanMachi's levels, merged with the pitch's license |
| D10 | 2026-10-28 | The vertical slice is Bellwether, the Old Works, and the Sluicekeeper | Prove it's fun before building deeper |
| D11 | 2026-10-28 | Working title "Floor Zero" | Short and evocative. Easy to change |
| D12 | 2026-10-28 | No romance and no relationship meters. DanMachi is a reference for the dungeon and the town only | Your call |
| D13 | 2026-10-28 | Detailed, grounded PBR art with heavy atmosphere: a lowkey triple-A feel, not low-poly | Your call |
| D14 | 2026-10-28 | Slice areas are built in code with a level kit. Blender is for props, run headless so the shared live session is never touched | Fast iteration, and Blender is shared with other projects |
| D15 | 2026-10-28 | Fishing is cast, wait, strike: you have about a second to answer a bite, and it keeps casting until you walk away | Keeps the RuneScape rhythm while asking for a little attention |
| D16 | 2026-10-28 | The first shortcut is a rope ladder from Lantern Pool straight up to the Entry Yard, rigged from below | Skipping the galleries on the daily commute is worth more than a shortcut inside one area |
| D17 | 2026-10-28 | Meal buffs: one of each kind at a time, timed in play time, refreshed by eating again | Simple to read, and cooking matters without a hunger meter |
| D18 | 2026-10-28 | The Irregular chase is built into M2 and plays the first time you reach the collapse | The galleries needed their big moment as soon as they existed |
| D19 | 2026-10-28 | Either Feat earns Rank II: the Sluicekeeper or the Hollowhorn. Only the Sluicekeeper runs the pump, so the deep lift still needs it | Players who love fighting get recognised early, and the story still ends at the pump |
| D20 | 2026-10-28 | The Sluicekeeper takes about a third damage until it opens its vents; its jets come low (jump) or high (crouch) and pillars block them | Teaches waiting for an opening, and uses the movement you already have |
| D21 | 2026-10-28 | The generator is repaired by feeding it cores (dim and bright) instead of a fetch item | Gives cores a use beyond selling, and ties the repair to fighting |
| D22 | 2026-10-28 | A valve wheel shuts its surge channel for 15 seconds | Timing a crossing is more interesting than a switch that turns the hazard off for good |
| D23 | 2026-10-28 | The dark tunnel in the Lower Cut hurts without the bright lantern | A gentle gear gate, and the reason to forge the lantern |
| D24 | 2026-10-28 | The freight gate opens from below, unbolted from the Lower Cut side | Shortcuts are earned by getting there the long way once |
| D25 | 2026-10-28 | Surface textures are procedural (`tools/textures.ts`); a ComfyUI render dropped in `assets-src/textures/` replaces an organic one | ComfyUI wasn't running for the art pass, and procedural maps tile perfectly with matching normals |
| D26 | 2026-10-28 | All audio is synthesized at runtime with WebAudio: no sound files yet | Covers every gameplay cue now, costs nothing to download, and recorded sounds can replace any of it later |
| D27 | 2026-10-28 | Lamp shadows render once per area and again when a flag changes; enemies use blob shadows | Six-sided point-light shadows every frame were most of each area's draw calls |
| D28 | 2026-10-28 | Below 1000 px wide, the vitals move to the top-left | The hotbar and vitals collided on narrow windows |
| D29 | 2026-10-28 | Base exposure 1.3, with a Brightness setting from 60% to 180% | The dungeon read as murky rather than dark, and screens differ |
| D30 | 2026-10-28 | The browser build is hosted on GitHub Pages at ycgnem.github.io/floor-zero. Every push to `main` runs the tests, typechecks, builds and deploys | Same setup as the other projects, and the latest build is always one link away |

## Open questions

Each has a recommendation, and the build follows the recommendation until you say otherwise. Q1 (romance) and Q2 (art direction) were answered on 2026-10-28: see D12 and D13.

### Q3. What's the answer to the mystery?

"The owners are coming home" (A) or "the bloom" (B), or something else? And one ending, or a final choice? See [02](02-world-and-story.md).

*Recommendation:* A, with a final choice about what Bellwether does.

### Q4. How long is the grind?

A full RuneScape-style 1–99 with a long post-game tail, or a tighter cap like 1–60?

*Recommendation:* 1–99 with region bands, where 99 is post-game mastery (Master's Marks). The RuneScape feel needs the long tail.

### Q5. What earns Rank II?

The Sluicekeeper only, or also hunting down the Irregular?

*Recommendation:* either one. It gives players a choice and makes the Irregular rematch matter.

### Q6. Parties and supporters

DanMachi has parties and supporters who carry the loot. Do we want Tavi as an occasional party member, or hireable haulers who expand your pack?

*Recommendation:* design hooks only for now, and build it after the slice. Companion AI in first person is expensive.

### Q7. Familia-style affiliations

Join one of the town's houses (lift crew, forge, kitchen, survey office) for perks and a storyline?

*Recommendation:* skip. Bonds already cover it with less overlap.

### Q8. A sixth skill: Salvage?

Taking apart ancient machinery for components fits the setting.

*Recommendation:* maybe, with the Ember Foundry. Five skills are plenty for the slice.

### Q9. How much jumping?

*Recommendation:* jump, yes. Light traversal only. No precision platforming in first person.

### Q10. Names

Keep "Floor Zero" as the title? Is the currency called **bells**? Do the placeholder names (Hollowhorn, the Counterweight, Hollis, the Echo Lens) work?

### Q11. Platform

Browser only, or a desktop build for Steam eventually?

*Recommendation:* develop in the browser, and package with Tauri or Electron when it matters.
