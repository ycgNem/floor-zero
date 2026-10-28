# Floor Zero

First-person 3D delving game: RuneScape-style skilling plus a DanMachi-style town over a living dungeon. Design docs live in `docs/`. Read `docs/README.md` first, and `docs/10-roadmap.md` for what's next.

## Stack

- TypeScript with `strict: true`. Never add plain `.js` source files.
- Vite 8. three.js pinned at 0.186.1 with `@types/three` 0.186.0. Bump both together, matching minor versions.
- `@dimforge/rapier3d-compat` 0.21 (physics), lil-gui (debug panel), Vitest (tests).

## Art and shared tools

- Art direction: detailed, grounded PBR with heavy atmosphere, a lowkey triple-A feel. Not low-poly, not pixel art.
- No romance and no relationship meters. DanMachi is a reference for the dungeon and the town.
- Blender is shared with other projects on this machine. Never use the live Blender session (the Blender MCP) for this project's automated work. Run a separate headless process instead: `blender --background --factory-startup --python <script>`.

## Conventions

- Units are metres and seconds, +Y up. Player capsule 1.8 m tall, 0.35 m radius, eyes at 1.65 m.
- File names kebab-case, named exports only, no `any`.
- Pure-logic modules (`src/skills`, `src/items`, `src/save`, `src/data`) never import three.js or touch the DOM.
- Game content lives in `src/data` as typed objects (`as const satisfies Record<string, Def>`), with IDs derived as types so typos fail the typecheck.
- IDs placed in levels (nodes, gates, spawns) are save-file keys. Never rename one without a save migration.
- Areas are built in code with `LevelKit` (`src/world/level-kit.ts`), not Blender files (D14). Room walls sit outside the inner size, so rooms that share a wall sit 1 m apart (two 0.5 m walls back to back) with matching openings.
- Run `npm run typecheck` and `npm test` before calling work done.
- Textures come from `node tools/textures.ts` (see docs/09). Sounds are synthesized in `src/audio/audio.ts`: emit a game event, or `events.emit('sound', ...)` for one-offs, rather than calling the audio engine from gameplay code.
- Lamp shadow maps are baked. After changing level geometry at runtime without setting a flag, call `game.refreshShadows()`. Mark moving objects `userData.dynamic = true` so they stay out of the bake.

## Testing in the browser

- In dev, `window.floorZero` is the `Game`. Force play with `g.mode = 'playing'; g.input.gameplay = true; g.menus.hide()`.
- `g.loop.advance(seconds)` steps the game by hand. Use it whenever the preview pane is hidden, because hidden pages get no animation frames and the game stands still.
- `g.input.simulate(action, held)` holds or releases an action; `g.area.runtime.interactables` lists everything usable in the area, each with `press()`.

## Deploying

- Every push to `main` runs `.github/workflows/deploy.yml` (tests, typecheck, build) and publishes `dist/` to https://ycgnem.github.io/floor-zero/.
- Vite builds with a relative base (`./`), so runtime asset URLs start with `import.meta.env.BASE_URL`, never `/`.
- To check a production build at the same path as Pages, start the `floor-zero-build` preview (after `npm run build`) and open `/floor-zero/`.

## Keeping docs current

- When a design decision is made or changed, update the relevant doc and log it in `docs/11-decisions-and-questions.md` with the date.
- Mark placeholder names *(placeholder)* in docs so they're easy to find and replace.
