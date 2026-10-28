# 01 Vision

> A town built over an impossible descent. A life built one expedition at a time.

**Floor Zero** is a first-person delving game. You move to Bellwether, a town clinging to the rim of an ancient shaft, and make a living from the dungeon below: mining, fishing, foraging, fighting, and slowly restoring the old lift network that leads deeper.

The dungeon isn't a disposable level generator. It's a place you learn, work in, and build a relationship with. You remember the good fishing pool. You know which corridor has the nasty projectile enemies. You know there's a blue mineral behind the waterfall that your pickaxe can't touch yet.

At first, getting to the old lift is an expedition. Later, it's your commute.

## The fantasy

You are not the chosen one. You're a new resident applying for a delver's license. The fantasy is becoming a respected local expert, the person who knows the lower cisterns better than anyone in town, rather than an unstoppable visitor who outgrows the setting.

Your ambitions grow in three steps:

1. Make enough money to stay.
2. Get good enough to reach somewhere nobody else can.
3. Find out why this place exists, and decide what the town should do with that knowledge.

## Pillars

Every feature should serve at least one of these. If it fights one, cut it or change it.

1. **A place you learn.** The world is persistent, handcrafted, and interconnected. Knowing where things are is progression. Shortcuts, opened gates, and mapped routes are rewards on par with gear.
2. **Every trip counts.** A good expedition advances at least two of: your character, your routes, your town. Progress is rarely all-or-nothing.
3. **Cozy work, dangerous frontier.** Familiar territory becomes comfortable, productive work, the RuneScape skilling mood. The edge of the map is where the real risk lives, the DanMachi mood.
4. **The town remembers.** Progress shows up in ordinary life: market stock, what people talk about, lifts running again, your own house.
5. **Respect the player's time.** No hunger meters, no rotting crops, no daily logins, no losing a week of progress to one bad fight. The pressure lives inside the expedition. Home is relief.

## Inspirations, and what we take from each

| Source | What we take |
|---|---|
| **RuneScape** | Skills that level by doing. Tiered resource nodes with visible level requirements. XP drops and level-up fanfare. Skill guides that show every unlock. The relaxed "skilling while listening to something" mood. Eating food to heal mid-fight. |
| **DanMachi** (*Is It Wrong to Try to Pick Up Girls in a Dungeon?*) | A town living off a living dungeon. Numbered floors as bragging rights. Monsters dropping cores that power the town's economy. A guild that licenses delvers and records their deeds. Rank-ups earned by great feats, not grinding. The "Irregular": a monster that has no business being this high up. (The dungeon and the town only. No romance.) |
| **King's Field, Lunacid, Dark Souls** | First-person handcrafted dungeons. Shortcuts that loop back to places you know. Atmosphere over exposition. |
| **Stardew Valley** | A town that visibly changes as you progress. A home that reflects how you play. |
| **Metroidvanias** | Tools and abilities that reopen places you've already been. |

## Why first-person

**Decision:** first-person 3D in Three.js.

What it gives us:

- **Spatial learning is felt, not shown.** You recognize a corridor by standing in it. That's exactly the "place you learn" pillar.
- **Scale.** Looking down the shaft from a bridge, or up at the town lights from the lift platform, sells the setting better than any camera above the player.
- **Tactile skilling.** Swinging a pickaxe at the seam in front of you, watching a float bob on dark water.
- **A much cheaper asset pipeline.** There is no animated player body to build. The player is a pair of hands and whatever tool they're holding.

What it costs, and how we pay for it:

- **The pitch's combat was top-down and projectile-heavy.** In first person you can't see behind you, so dense bullet patterns become unfair. Combat is redesigned around first person: fewer, slower, bigger projectiles, ground telegraphs, audio cues, threat indicators, and a dash. See [05 Combat](05-combat.md).
- **You can't see your own gear.** RuneScape players love looking at their armour. We use armour stands and a mirror at home, gauntlets and sleeves in the viewmodel, and trophies on the walls.

## The emotional arc

- **Early:** "I hope I can make it back with enough to buy a better tool."
- **Middle:** "I know exactly where to go for that. Let me take my route."
- **Late:** "We can restore this whole district if I get the lower station working."
- **Endgame:** "This town looks different because I live here."

The payoff isn't becoming someone who can kill deeper monsters. It's turning an intimidating place into a livelihood, that livelihood into a home, and finally helping a whole town imagine a future.

## What changed from the original pitch

1. **Top-down became first-person,** and combat was rebuilt around it.
2. **Numbered floors (DanMachi).** Every restored station reveals its floor number. "Deepest floor reached" is public bragging rights. Floor Zero stops being the only number and becomes the first one. See [02](02-world-and-story.md).
3. **License ranks earned by Feats (DanMachi levels).** Ranks gate the deeper lifts. See [04](04-progression.md).
4. **Cores.** Creatures and constructs drop cores, a baseline combat income and the fuel behind Bellwether's warm lights.
5. **RuneScape-style skill levels** on a 1–99 curve with explicit unlock lists.
6. **Days advance when you sleep,** not in real time. Renewables refresh on day boundaries. See [03](03-core-loop.md).
7. **An early Irregular encounter** in the Old Works foreshadows the mystery. See [07](07-regions.md).
8. **Defeat means rescue.** The lift crew drags you out for a fee and a cut of your haul. No corpse runs.
9. **Scope.** We build a vertical slice (Bellwether, the Old Works, the Sluicekeeper) before anything deeper. See [10](10-roadmap.md).
