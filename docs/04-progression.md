# 04 Progression

## Three tracks

| Track | What grows | Examples |
|---|---|---|
| **Character** | You | Skill levels, gear, tools, license rank, techniques |
| **Routes** | Your access to the dungeon | Repaired bridges, opened gates, mapped passages, restored lifts, safe rooms |
| **Town** | Bellwether | Workshop upgrades, new residents, new services, market stock, your home |

A good expedition advances at least two. You might come back with ore for a weapon, timber for a bridge, fish for healing meals, a map fragment, and enough Mining XP for a new tool. Even if the rare drop didn't happen, the trip was useful.

## Skills

**Change:** the pitch's skills stay, with RuneScape-style levels added.

Skills level by doing. Levels run **1–99** on an exponential, RuneScape-shaped curve. Each level-up shows a fanfare, and every skill has a **skill guide** listing every unlock at every level. Gates are explicit: seeing blue ore for hours is only exciting if you know exactly how to work toward mining it. XP drops float up on screen as you earn them.

| Skill | Kind | Example unlocks *(levels are placeholders)* |
|---|---|---|
| **Mining** | Gathering | Stone and copper (1), iron (10), break cracked walls (12), cobalt (15), lift fragile crystals intact (25), spot rich deposits (30) |
| **Fishing** | Gathering | Common cave fish (1), bait (5), fast currents (15), deep pools (25), things carried through the water system (30+) |
| **Botany** | Gathering and cultivation | Identify plants (1), gather spores safely (10), grow plants in the greenhouse (15), brew antidotes and lamp oil (20) |
| **Smithing** | Production | Copper tools (1), iron gear (10), bridge fittings and lift parts (12), cobalt gear (15), rework old gear into alternate builds (20) |
| **Cooking** | Production | Basic healing food (1), expedition meals with buffs (10), rare-catch preparations (20) |

### The curve

- One function with two tuning constants (base XP, and how many levels it takes to double). Start with RuneScape's values for feel, then tune from playtests.
- Higher-tier resources give more XP per action, so time per level band stays sane as the XP numbers grow.
- Rough bands: Old Works 1–15, Rootvault 15–30, Drowned Exchange 30–45, Ember Foundry 45–60, Quiet City 60–75. Levels 75–99 are post-game mastery.
- Reaching 99 earns that skill's **Master's Mark**, a cosmetic and a small perk, our version of RuneScape's skillcapes.
- Target: Mining 1 to 15 in about 2–3 hours of normal mixed play.

### How gathering works

- Look at a node and hold interact. Your character works it in **swings** (our version of RuneScape's game ticks).
- Every swing rolls for success based on skill level, tool tier, and node level. Success gives an item and XP.
- Nodes yield several times, then deplete until their cooldown passes (see [03](03-core-loop.md)).
- Gathering continues on its own until the node is empty, your pack is full, or something hits you. You can relax, look around, or listen to something.
- **Optional active bonus:** now and then a glint appears on the node. Strike it for a bonus yield. It's never required, and it's not a timing minigame.

## Combat proficiencies

Each weapon family (Blade, Spear, Boltcaster, Resonance) has its own proficiency that levels from use, like DanMachi's status growing through use. Proficiencies unlock **techniques** at milestones and give small passive bonuses capped at around +20% at 99. Gear tier and player skill matter more than proficiency level. A veteran handles early enemies comfortably without every threat becoming meaningless. Techniques are listed in [05 Combat](05-combat.md).

## License ranks and Feats

**Change:** new. This is DanMachi's level system merged with the pitch's delver's license.

Your license has a **rank**. Ranks are the big, rare jumps in power. They aren't earned by grinding. Each one needs a **Feat**: a great deed recorded by the Survey Office.

| Rank | Title *(placeholder)* | Qualifying Feats | Opens |
|---|---|---|---|
| I | Novice Delver | Pass the license test (tutorial) | The Old Works, basic contracts |
| II | Delver | Defeat the Sluicekeeper, *or* hunt down the Irregular | The deep lift to the Rootvault, forge tier 2 |
| III | Senior Delver | A Rootvault Feat | The Drowned Exchange |
| IV | Expert Delver | A Drowned Exchange Feat | The Ember Foundry |
| V | Master Delver | An Ember Foundry Feat | The Quiet City |

Every rank-up:

- is a small ceremony at the Survey Office, and the town notices
- raises max health in a large step (health comes mainly from rank, a little from armour)
- adds carry capacity and new contracts
- changes how residents talk to you

Optional deeds (first to reach a floor, surviving the Irregular, discovering a species) are recorded on your license for prestige and cosmetics, but only regional Feats unlock ranks.

## Gear tiers

| Tier | Material | Found in | The first item needs |
|---|---|---|---|
| 1 | Copper | Old Works | Nothing, it's where you start |
| 2 | Iron | Old Works | Mining 10 |
| 3 | Cobalt (the blue ore) | Old Works, Lower Cut | Mining 15 and a tempered pick head made from a part recovered at the Pump Station |
| 4 | *Verdant bronze (placeholder)* | Rootvault | A Rootvault discovery |
| 5 | *Tidesilver (placeholder)* | Drowned Exchange | A Drowned Exchange discovery |
| 6 | *Foundry steel (placeholder)* | Ember Foundry | A Foundry workshop restored |
| 7 | *Lumen alloy (placeholder)* | Quiet City | A Quiet City discovery |

Money can buy ordinary materials from tiers you've unlocked. **The first item of every new tier always needs a discovery.** That keeps the game from collapsing into "find the best gold per minute."

## Tools are keys

Tools reopen old places, Metroidvania-style. That's the **capability** layer of every region.

| Tool | Opens | First matters at |
|---|---|---|
| Pickaxe tiers | New ore tiers, cracked walls | The cracked wall by the Entry Yard |
| Rope and climbing hooks | Climb-down points and ledges | The drop from the upper quarry to Lantern Pool |
| Lantern upgrades | Dark tunnels where things hunt in the dark | Lower Cut side tunnels |
| Filter mask | Spore zones | Rootvault |
| Waders, then diving gear | Deep water | Drowned Exchange |
| Cooling suit | Heat zones | Ember Foundry |

In first person, traversal stays simple: no precision jumping. Tools turn obstacles into interactions (climb, rappel, wade, cut).

## Economy

Three kinds of value, kept separate:

| | Used for | Example |
|---|---|---|
| **Money** (*bells*, placeholder) | Convenience, purchases, lifestyle | Buying iron, furniture, rescue fees |
| **Materials** | Production and upgrades | Ore, timber, fish, cores |
| **Discoveries** | Unlocking new possibilities | Schematics, map fragments, components, translations |

**Income:** raw materials, crafted goods, cores, town requests, exploration rewards, boss contracts, rare finds. A player who loves fishing can fund upgrades by fishing. A fighter can buy ore with core money.

**Sinks:** crafting fees, workshop upgrades, the house and furniture, rescue fees, bait and consumables.

**Guardrails:**

- **Daily market saturation.** Selling a lot of one item lowers its price for the day, and it recovers overnight. Variety pays a little better without forcing anyone to rotate skills.
- Town requests pay a premium, but there's never a daily obligation.
- Money never buys discoveries.

## Shortcuts and routes

A shortcut can be as exciting as a weapon: a ladder dropped from the upper quarry to the fishing basin, a hand-cranked lift, a freight gate opened from behind, a tram between two old stations, a regional lift stop.

A difficult thirty-minute expedition can permanently become a five-minute resource route. That isn't content becoming obsolete. It's the reward for mastering it.

The Routes track is visible in town: the Survey Office has a **map table**, a physical model of the known dungeon that fills in as you restore infrastructure.

## Slice pacing *(targets)*

| Play time | What should have happened |
|---|---|
| 0–1 h | License test, first expedition, copper and first iron, first sale, first fish, first craft |
| 1–3 h | Broken Galleries mapped, iron pickaxe, the cracked wall, the Irregular chase, Lantern Pool, first shortcut |
| 3–6 h | The Lower Cut, the blue seam spotted, Pump Station repairs, Mining around 15 |
| 6–8 h | The Sluicekeeper, Rank II, floor markers light up, the deep lift descends |
