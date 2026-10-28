# Floor Zero

A first-person delving game about a town built over an impossible descent. Learn the dungeon, make a living from it, and slowly turn it into somewhere you belong.

RuneScape-style skilling meets a DanMachi-style town over a living dungeon. Built with three.js, TypeScript, and Vite.

**Play it:** [ycgnem.github.io/floor-zero](https://ycgnem.github.io/floor-zero/), in a desktop browser with a mouse and keyboard.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest
npm run typecheck  # TypeScript only
npm run build      # typecheck, then a production build in dist/
```

Every push to `main` runs the tests and the build, then deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## Where things are

| Folder | What's there |
|---|---|
| `docs/` | Design docs. Start at [docs/README.md](docs/README.md) |
| `src/` | Game code. Layout in [docs/08-tech-architecture.md](docs/08-tech-architecture.md) |
| `public/assets/` | Runtime assets. Today that's the surface textures |
| `assets-src/` | Source files (Blender, raw textures, audio, concept art). Not shipped |
| `tools/` | Asset scripts. `textures.ts` makes the surface textures |

## Status

Milestones 0 to 5 are built: chapter one plays from the license test to the deep-lift ceremony. M5 (textures, lighting, audio, performance) is a first pass, and props and enemies are still built from code shapes. See [docs/10-roadmap.md](docs/10-roadmap.md).
