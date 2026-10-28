import type { BuffId } from './buffs';

export type ItemKind =
  | 'ore' | 'fish' | 'food' | 'herb' | 'core' | 'material' | 'bait'
  | 'tool' | 'weapon' | 'armour' | 'charm' | 'quest';

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
  /** For counting more than one, when it isn't a mass noun like ore: "glowcaps". */
  plural?: string;
}

export const ITEMS = {
  copper_ore: { name: 'Copper ore', kind: 'ore', stack: 1, value: 4 },
  iron_ore: { name: 'Iron ore', kind: 'ore', stack: 1, value: 9 },
  cobalt_ore: { name: 'Cobalt ore', kind: 'ore', stack: 1, value: 22, description: 'The blue ore. Heavy, and faintly warm.' },

  cave_minnow: { name: 'Cave minnow', kind: 'fish', stack: 1, value: 5, plural: 'cave minnows' },
  lantern_eel: { name: 'Lantern eel', kind: 'fish', stack: 1, value: 12, plural: 'lantern eels' },
  white_cavefish: { name: 'White cavefish', kind: 'fish', stack: 1, value: 26 },

  cooked_minnow: { name: 'Cooked minnow', kind: 'food', stack: 1, value: 8, heal: 14 },
  smoked_eel: { name: 'Smoked eel', kind: 'food', stack: 1, value: 18, heal: 26, buff: { id: 'surefoot', minutes: 6 }, description: 'Sure-footed: dashes recharge faster for 6 minutes.' },
  cavefish_stew: { name: 'Cavefish stew', kind: 'food', stack: 1, value: 40, heal: 45, buff: { id: 'hearty', minutes: 10 }, description: 'Hearty: +20 max health for 10 minutes.' },
  glowcap_broth: { name: 'Glowcap broth', kind: 'food', stack: 1, value: 14, heal: 20, buff: { id: 'keen', minutes: 5 }, description: 'Keen: mine and gather faster for 5 minutes.' },
  trail_bread: { name: 'Trail bread', kind: 'food', stack: 1, value: 4, heal: 10, description: 'Sold at the market. Dependable, if dull.' },
  eel_skewers: { name: 'Eel skewers', kind: 'food', stack: 1, value: 24, heal: 32, buff: { id: 'keen', minutes: 8 }, description: 'Keen: mine and gather faster for 8 minutes.' },
  delvers_pie: { name: 'Delver’s pie', kind: 'food', stack: 1, value: 34, heal: 48, buff: { id: 'steady', minutes: 8 }, description: 'Steady: take 15% less damage for 8 minutes.' },

  glowcap: { name: 'Glowcap', kind: 'herb', stack: 10, value: 3, plural: 'glowcaps' },
  lampmoss: { name: 'Lampmoss', kind: 'herb', stack: 10, value: 6 },

  dim_core: { name: 'Dim core', kind: 'core', stack: 50, value: 6, plural: 'dim cores' },
  bright_core: { name: 'Bright core', kind: 'core', stack: 50, value: 18, plural: 'bright cores' },
  radiant_core: { name: 'Radiant core', kind: 'core', stack: 10, value: 120, plural: 'radiant cores' },

  rope: { name: 'Rope', kind: 'material', stack: 5, value: 6 },
  planks: { name: 'Planks', kind: 'material', stack: 10, value: 3 },
  salvaged_spring: { name: 'Salvaged spring', kind: 'material', stack: 10, value: 10, plural: 'salvaged springs' },
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
  delvers_pack: { name: 'Delver’s pack', kind: 'tool', stack: 1, value: 0, description: 'Six more slots for the haul.' },

  lucky_knot: { name: 'Tavi’s lucky knot', kind: 'charm', stack: 1, value: 0, description: 'A delver’s knot in faded red cord. Your feet find an extra step: one more dash charge.' },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;

export function itemDef(id: ItemId): ItemDef {
  return ITEMS[id];
}

/** "6 glowcaps", "1 glowcap", "8 iron ore". */
export function countOf(item: ItemId, count: number): string {
  const def: ItemDef = ITEMS[item];
  return `${count} ${count !== 1 && def.plural ? def.plural : def.name.toLowerCase()}`;
}

export function isItemId(value: unknown): value is ItemId {
  return typeof value === 'string' && value in ITEMS;
}
