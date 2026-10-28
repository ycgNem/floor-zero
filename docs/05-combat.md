# 05 Combat

**Goal:** dangerous but readable, in first person.

**Change:** the pitch described top-down, projectile-heavy combat. Everything here is rebuilt for first person, keeping the pitch's spirit: movement-driven, enemies recognizable by behaviour, room layout that matters, and a screen that gets exciting without becoming unreadable.

## Readability rules for first person

1. **Telegraph everything.** Every attack has a distinct windup pose and sound. Area attacks draw a glowing decal on the floor before they land.
2. **Fewer, meaner patterns.** No screens full of bullets. A few projectiles with clear shapes (rings, lanes, fans, slow homing orbs) that you beat by moving, strafing, jumping, and dashing.
3. **Big, bright, slow-ish projectiles.** All hostile projectiles share one colour family *(placeholder: acid magenta)* and never reuse the town's warm amber or the dungeon's cold blue. Each projectile type has its own whoosh.
4. **No unfair hits from behind.** An enemy outside your view must be announced (positional sound plus a directional HUD marker) for about half a second before it can start an attack.
5. **Attack tokens.** Only a couple of enemies may attack at once *(tunable per difficulty)*. The rest reposition, threaten, and wait their turn.
6. **Space is a weapon.** Pillars block projectiles, ledges give height, shallow water slows everything, narrow corridors turn into lanes. Rooms are designed around encounters, not decorated after.

## Controls *(defaults, all rebindable)*

| Action | Default |
|---|---|
| Move / look | WASD / mouse |
| Primary attack | Left mouse |
| Weapon ability | Right mouse |
| Secondary device | F |
| Dash | Shift, 2 charges |
| Jump / crouch | Space / C |
| Interact, gather (hold) | E |
| Food and consumables | 1–4 |
| Cycle weapon and tools | Q or mouse wheel |
| Map and expedition card | M / Tab |

- **Dash:** a short burst with brief invulnerability (~0.2 s). Two charges, each recharging in about 1.5 s. There's no stamina bar, and sprinting is free.
- **Healing:** food only, RuneScape-style. Eating takes a moment and slows you while you chew, so when to eat in a fight is a real decision. Nothing regenerates passively in the dungeon. Safe rooms heal you fully.

## Weapon families

No classes. Your build is your weapon, secondary device, up to two charms, armour, and the food you packed. Each family has a signature ability on right mouse and techniques that unlock through its proficiency ([04](04-progression.md)).

### Blades: close range, aggression, mobility

- Fast combos, short reach.
- **Ability: Deflect.** A well-timed swing knocks a projectile back where it came from. This is what makes projectile enemies fun for melee players.
- Techniques: lunge (gap closer), riposte after a deflect, spin cut.

### Spears: reach, positioning, piercing

- Long thrusts, slower recovery.
- **Ability: Brace.** Plant the spear and a charging enemy impales itself for heavy damage and a long stagger.
- Techniques: charged pierce that hits everything in a line, a knockback sweep.

### Boltcasters: reliable ranged damage

- A magazine and a reload rhythm. Basic bolts are unlimited. Special bolts (piercing, flare, shock) are crafted.
- **Ability: Steady.** Zoom in, with bonus damage to weak points.
- Techniques: quick reload, a double shot, a pinning bolt that roots small enemies.

### Resonance tools: strange recovered devices

- Each device does something unusual: a shockwave, a slow field, an arc that chains between enemies, a pull.
- They burn **cores** as charge, so selling a core and spending one is a real choice.
- The first one is a reward late in the vertical slice.

### Secondary devices

Used with F, briefly taking your off hand, with any weapon: a **buckler** (short frontal block), a **flare launcher** (light, scares wildlife), a **grapnel** (pulls small enemies and loose objects).

## The Old Works roster

Enemies are recognizable by what they do.

| Enemy | Kind | Behaviour | What it teaches |
|---|---|---|---|
| **Scuttler** | Wildlife | Small melee biters in packs of 3–5 | Basic aiming, dashing out of a surround |
| **Bellcap** | Overgrowth | Rooted fungus whose cap rings like a bell, sending slow expanding rings at foot or head height | Listen for the ring, then jump or crouch, or dash through a gap |
| **Slagback** | Wildlife | Long scraping windup, then a straight charge. Stuns itself if it hits a wall | Sidestep late, brace with a spear, bait it into walls |
| **Rivet Sentry** | Construct | Fills a corridor with lanes of rivets, sweeping slowly | Move between lanes, use pillars, flank it |
| **Lampwarden** | Construct | Projects a protective field over nearby enemies and backs away from you | Kill it first; boltcasters shine |
| **Sinkmaw** | Overgrowth | Tunnels toward where you're standing and erupts beneath you, then is stuck and exposed | Keep moving, then punish the recovery |

### The Irregular

**Change:** new, from DanMachi's minotaur on the 5th floor.

On an early trip into the Broken Galleries, something far too strong for Floor 2 shows up: **the Hollowhorn** *(placeholder)*, a huge horned beast from somewhere much deeper. You can't beat it. You run. The chase is scripted: the first time you reach the collapse, it bursts through the rockfall and charges you down the main gallery. Small creatures freeze in fear while it's near, and anything in its path is trampled. Sprinting and dashing keep you just ahead of it; walking gets you gored. It gives up at the gallery mouth (or at the doorway of a side room you duck into), bellows, and goes back down through the hole it made, which is the new route to Lantern Pool.

It's the first hard clue that something below is pushing creatures upward. Later you can track it to the Lower Cut and kill it, which is one of the Feats that qualifies for Rank II.

## Bosses are regional exams

A boss tests what its region taught. If a region teaches moving between safe lanes, reading water surges, and hitting exposed weak points, its boss combines exactly those.

Defeating a boss for the first time:

- resolves a regional problem
- unlocks a permanent route or system
- gives a guaranteed meaningful reward
- reveals part of the story
- opens new possibilities in town

The first defeat is a permanent world milestone. For rematches, the **Echo Lens** *(placeholder)* at the Survey Office, an ancient device that replays recorded encounters, offers challenge variants with modifiers and its own rewards. Nobody pretends the same unique creature comes back to life every afternoon.

The first boss, the Sluicekeeper, is detailed in [07 Regions](07-regions.md).

## Feel checklist

- Hit-stop of 40–80 ms on heavy hits
- Camera kick, weapon sway, and an FOV punch on dash
- Enemies flinch and stagger visibly
- Impact sounds differ by material: flesh, shell, stone, metal
- Damage numbers as RuneScape-style hitsplats (toggleable)
- XP drops after kills, same as gathering

## Accessibility and assists

- FOV slider (default 90), head-bob toggle, motion-reduction options
- Telegraphs use shape and sound, never colour alone
- Subtitles for combat audio cues, such as "[ringing, left]"
- A damage-taken slider, so players who mainly want to skill can still progress
- Light aim assist when we add controller support
