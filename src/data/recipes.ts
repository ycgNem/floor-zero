import type { Equipment } from '../save/world-state';
import type { FlagId, SkillId } from './ids';
import type { ItemId } from './items';

export type Station = 'forge' | 'kitchen';

export interface RecipeDef {
  name: string;
  station: Station;
  skill: SkillId;
  level: number;
  inputs: Partial<Record<ItemId, number>>;
  /** Fee in bells. */
  cost?: number;
  /** A pack item, or a piece of gear that replaces what's on your belt. */
  output: { item: ItemId; count: number } | { equip: keyof Equipment; item: ItemId };
  xp: number;
  /** A discovery that unlocks the recipe. */
  requires?: FlagId;
  /** Flag set the first time it's made. */
  sets?: FlagId;
  description?: string;
}

export const RECIPES = {
  iron_pickaxe: { name: 'Iron pickaxe', station: 'forge', skill: 'smithing', level: 1, inputs: { iron_ore: 8 }, cost: 20, output: { equip: 'pickaxe', item: 'iron_pickaxe' }, xp: 150, sets: 'iron_pick_forged', description: 'Swings faster, and bites through cracked rock.' },
  iron_blade: { name: 'Iron blade', station: 'forge', skill: 'smithing', level: 5, inputs: { iron_ore: 10 }, cost: 30, output: { equip: 'blade', item: 'iron_blade' }, xp: 180, description: 'Heavier and keener than copper.' },
  bright_lantern: { name: 'Bright lantern', station: 'forge', skill: 'smithing', level: 6, inputs: { iron_ore: 3, lampmoss: 4 }, cost: 15, output: { equip: 'lantern', item: 'bright_lantern' }, xp: 90, description: 'Lampmoss oil burns bright enough for the dark tunnels.' },
  boltcaster: { name: 'Boltcaster', station: 'forge', skill: 'smithing', level: 8, inputs: { iron_ore: 6, salvaged_spring: 2 }, cost: 40, output: { equip: 'boltcaster', item: 'boltcaster' }, xp: 220, requires: 'schematic_delivered', description: 'Built from the storeroom drawings. Reliable at range.' },
  iron_mail: { name: 'Iron mail', station: 'forge', skill: 'smithing', level: 12, inputs: { iron_ore: 14 }, cost: 50, output: { equip: 'armour', item: 'iron_mail' }, xp: 300, description: '+30 max health.' },
  cobalt_pickaxe: { name: 'Cobalt pickaxe', station: 'forge', skill: 'smithing', level: 14, inputs: { tempered_pick_head: 1, iron_ore: 6 }, cost: 60, output: { equip: 'pickaxe', item: 'cobalt_pickaxe' }, xp: 400, requires: 'pick_head_found', sets: 'cobalt_pick_forged', description: 'Builders’ steel on a new haft. It can cut cobalt.' },
  surge_lantern: { name: 'Surge lantern', station: 'forge', skill: 'smithing', level: 10, inputs: { pressure_valve: 1, iron_ore: 4 }, cost: 30, output: { equip: 'resonance', item: 'surge_lantern' }, xp: 260, requires: 'sluicekeeper_defeated', description: 'The Sluicekeeper’s valve in a lantern housing. Burns a core to release a shockwave.' },
  cobalt_blade: { name: 'Cobalt blade', station: 'forge', skill: 'smithing', level: 18, inputs: { cobalt_ore: 8, iron_ore: 4 }, cost: 80, output: { equip: 'blade', item: 'cobalt_blade' }, xp: 520, description: 'Holds an edge like nothing else in town.' },

  cooked_minnow: { name: 'Cooked minnow', station: 'kitchen', skill: 'cooking', level: 1, inputs: { cave_minnow: 1 }, output: { item: 'cooked_minnow', count: 1 }, xp: 30 },
  glowcap_broth: { name: 'Glowcap broth', station: 'kitchen', skill: 'cooking', level: 5, inputs: { glowcap: 2, cave_minnow: 1 }, output: { item: 'glowcap_broth', count: 1 }, xp: 45 },
  smoked_eel: { name: 'Smoked eel', station: 'kitchen', skill: 'cooking', level: 10, inputs: { lantern_eel: 1 }, output: { item: 'smoked_eel', count: 1 }, xp: 60 },
  cavefish_stew: { name: 'Cavefish stew', station: 'kitchen', skill: 'cooking', level: 20, inputs: { white_cavefish: 1, lampmoss: 1 }, output: { item: 'cavefish_stew', count: 1 }, xp: 110 },
} as const satisfies Record<string, RecipeDef>;

export type RecipeId = keyof typeof RECIPES;
