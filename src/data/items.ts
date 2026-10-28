import type { BuffId } from './buffs';

export type ItemKind =
  | 'ore' | 'fish' | 'food' | 'herb' | 'core' | 'material' | 'bait'
  | 'tool' | 'weapon' | 'armour' | 'quest';

export interface ItemDef {
  name: string;
  kind: ItemKind;
  /** Max per pack slot. 1 means it doesn't stack. */
  stack: number;
  /** Base sell price in bells. 0 means it can't be sold. */
  value: number;
  /** Health restored when eaten. */
  heal?: number;
  /** A meal buff granted when eaten. */
  buff?: { id: BuffId; minutes: number };
  description?: string;
}

export const ITEMS = {
  copper_ore: { name: 'Copper ore', kind: 'ore', stack: 1, value: 4 },
  iron_ore: { name: 'Iron ore', kind: 'ore', stack: 1, value: 9 },
  cobalt_ore: { name: 'Cobalt ore', kind: 'ore', stack: 1, value: 22, description: 'The blue ore. Heavy, and faintly warm.' },

  cave_minnow: { name: 'Cave minnow', kind: 'fish', stack: 1, value: 5 },
  lantern_eel: { name: 'Lantern eel', kind: 'fish', stack: 1, value: 12 },
  white_cavefish: { name: 'White cavefish', kind: 'fish', stack: 1, value: 26 },

  cooked_minnow: { name: 'Cooked minnow', kind: 'food', stack: 1, value: 8, heal: 14 },
  smoked_eel: { name: 'Smoked eel', kind: 'food', stack: 1, value: 18, heal: 26, buff: { id: 'surefoot', minutes: 6 }, description: 'Sure-footed: dashes recharge faster for 6 minutes.' },
  cavefish_stew: { name: 'Cavefish stew', kind: 'food', stack: 1, value: 40, heal: 45, buff: { id: 'hearty', minutes: 10 }, description: 'Hearty: +20 max health for 10 minutes.' },
  glowcap_broth: { name: 'Glowcap broth', kind: 'food', stack: 1, value: 14, heal: 20, buff: { id: 'keen', minutes: 5 }, description: 'Keen: mine and gather faster for 5 minutes.' },
  trail_bread: { name: 'Trail bread', kind: 'food', stack: 1, value: 4, heal: 10, description: 'Sold at the market. Dependable, if dull.' },

  glowcap: { name: 'Glowcap', kind: 'herb', stack: 10, value: 3 },
  lampmoss: { name: 'Lampmoss', kind: 'herb', stack: 10, value: 6 },

  dim_core: { name: 'Dim core', kind: 'core', stack: 50, value: 6 },
  bright_core: { name: 'Bright core', kind: 'core', stack: 50, value: 18 },
  radiant_core: { name: 'Radiant core', kind: 'core', stack: 10, value: 120 },

  rope: { name: 'Rope', kind: 'material', stack: 5, value: 6 },
  planks: { name: 'Planks', kind: 'material', stack: 10, value: 3 },
  salvaged_spring: { name: 'Salvaged spring', kind: 'material', stack: 10, value: 10 },
  bait_grubs: { name: 'Bait grubs', kind: 'bait', stack: 50, value: 1 },

  storeroom_schematic: { name: 'Storeroom schematic', kind: 'quest', stack: 1, value: 0, description: 'Old drawings of the Old Works. Iona will want these.' },
  control_plate: { name: 'Control plate', kind: 'quest', stack: 1, value: 0, description: 'A brass plate from the Pump Station, covered in the old script.' },
  tempered_pick_head: { name: 'Tempered pick head', kind: 'quest', stack: 1, value: 0, description: 'Builders’ steel. Oren could make something of this.' },
  pressure_valve: { name: 'Pressure valve', kind: 'quest', stack: 1, value: 0, description: 'The Sluicekeeper’s heart, still humming.' },

  copper_pickaxe: { name: 'Copper pickaxe', kind: 'tool', stack: 1, value: 0 },
  iron_pickaxe: { name: 'Iron pickaxe', kind: 'tool', stack: 1, value: 0 },
  cobalt_pickaxe: { name: 'Cobalt pickaxe', kind: 'tool', stack: 1, value: 0 },
  fishing_rod: { name: 'Fishing rod', kind: 'tool', stack: 1, value: 0 },
  bright_lantern: { name: 'Bright lantern', kind: 'tool', stack: 1, value: 0 },

  copper_blade: { name: 'Copper blade', kind: 'weapon', stack: 1, value: 0 },
  iron_blade: { name: 'Iron blade', kind: 'weapon', stack: 1, value: 0 },
  cobalt_blade: { name: 'Cobalt blade', kind: 'weapon', stack: 1, value: 0 },
  boltcaster: { name: 'Boltcaster', kind: 'weapon', stack: 1, value: 0 },
  surge_lantern: { name: 'Surge lantern', kind: 'weapon', stack: 1, value: 0, description: 'A resonance tool. Burns a core to release a shockwave.' },

  leather_vest: { name: 'Leather vest', kind: 'armour', stack: 1, value: 0 },
  iron_mail: { name: 'Iron mail', kind: 'armour', stack: 1, value: 0 },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;

export function itemDef(id: ItemId): ItemDef {
  return ITEMS[id];
}

export function isItemId(value: unknown): value is ItemId {
  return typeof value === 'string' && value in ITEMS;
}
