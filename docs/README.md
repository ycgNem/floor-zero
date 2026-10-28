# Floor Zero: design docs

Working title **Floor Zero**. The town is **Bellwether**; the original pitch was called *The Town at Floor Zero*.

These docs are the source of truth for what we're building. The original pitch came from a brainstorm with GPT. It has been folded into these docs, reorganized, and changed where it didn't fit a first-person 3D game. Anything that differs from the pitch is marked **Change:** so you can see what moved and why.

| Doc | What's in it |
|---|---|
| [01 Vision](01-vision.md) | Pitch, pillars, inspirations, why first-person, what changed |
| [02 World & Story](02-world-and-story.md) | Bellwether, the dungeon, cores, floor numbers, the mystery |
| [03 Core Loop](03-core-loop.md) | The expedition loop, days, defeat and rescue, what persists |
| [04 Progression](04-progression.md) | Skills, license ranks, gear tiers, tools, economy, shortcuts |
| [05 Combat](05-combat.md) | First-person combat, weapons, enemy roster, bosses |
| [06 Town & People](06-town-and-people.md) | Places, residents, bonds, your home |
| [07 Regions](07-regions.md) | The Old Works in detail, outlines of the deeper regions |
| [08 Tech Architecture](08-tech-architecture.md) | Stack, code layout, game loop, data, saves, performance |
| [09 Content Pipeline](09-content-pipeline.md) | Blender to glTF rules, asset folders, art direction |
| [10 Roadmap](10-roadmap.md) | Milestones up to the vertical slice, the M0 task list |
| [11 Decisions & Questions](11-decisions-and-questions.md) | What's decided, what's still open |

## How to use these

- Docs describe intent. Code is the truth for how things actually work. When they disagree, fix one of them.
- Log every design decision in doc 11 with a date and a one-line reason.
- Numbers here (XP, prices, timings, floor ranges) are starting points for tuning, not promises.
- Names marked *(placeholder)* are fine to change at any time.
