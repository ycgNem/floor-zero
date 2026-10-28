import type { FlagId, NpcId } from './ids';
import type { ItemId } from './items';

/** A community project on the Town Works board (doc 06). */
export interface ProjectDef {
  name: string;
  /** Who asked for it. */
  npc: NpcId;
  /** Why the town wants it, in their words. */
  pitch: string;
  /** What exists once it's built. */
  gives: string;
  inputs: Partial<Record<ItemId, number>>;
  /** Bells for the labour, paid once every material is in. */
  cost: number;
  /** Posted on the board once this is set. */
  requires?: FlagId;
  /** Set the morning after it's funded: the thing now stands in the world. */
  flag: FlagId;
  /** Handed in where it stands, not on the Town Works board, and done the moment it's complete. */
  onSite?: boolean;
}

export const PROJECTS = {
  yard_hoist: {
    name: 'Freight hoist at the Entry Yard',
    npc: 'mara',
    pitch: 'Half my rescues are people too proud to come up with a full pack. Put a hoist at the yard landing and they can send the haul up without riding with it.',
    gives: 'A hoist on the Entry Yard landing that sends your whole pack up to storage.',
    inputs: { planks: 10, iron_ore: 6, rope: 2 },
    cost: 80,
    requires: 'license_granted',
    flag: 'hoist_built',
  },
  kitchen_hearth: {
    name: 'A second hearth for the kitchen',
    npc: 'pell',
    pitch: 'One hearth, a whole town, and now fish again. Give me a second fire and I’ll give you food worth carrying.',
    gives: 'Two new recipes at the kitchen: eel skewers and delver’s pie.',
    inputs: { planks: 6, copper_ore: 8, glowcap: 6 },
    cost: 60,
    requires: 'rod_received',
    flag: 'kitchen_expanded',
  },
  forge_bellows: {
    name: 'Great bellows for the forge',
    npc: 'oren',
    pitch: 'My forge was built for horseshoes. Builders’ drawings need builders’ heat. Springs, iron, timber, and I’ll make it breathe.',
    gives: 'A hotter forge: Oren can work cobalt into blades and stitch you a bigger delver’s pack.',
    inputs: { iron_ore: 12, salvaged_spring: 3, planks: 4 },
    cost: 120,
    requires: 'schematic_delivered',
    flag: 'forge_bellows',
  },
  keeper_repair: {
    name: 'Repair the Sluicekeeper',
    npc: 'iona',
    pitch: 'It wasn’t a monster. It was the station’s keeper, doing its job with a broken memory. Fix its joints and its valve housing, give it cores to run on, and I think it would go back to work.',
    gives: 'The Sluicekeeper back at work in the Pump Station, sending your haul up in its freight cradle.',
    inputs: { cobalt_ore: 4, salvaged_spring: 3, bright_core: 4 },
    cost: 0,
    requires: 'sluicekeeper_defeated',
    flag: 'sluicekeeper_repaired',
    onSite: true,
  },
} as const satisfies Record<string, ProjectDef>;

export type ProjectId = keyof typeof PROJECTS;

export function isProjectId(value: unknown): value is ProjectId {
  return typeof value === 'string' && value in PROJECTS;
}

/** What it takes to buy the old lamplighter's house on the plaza. */
export const HOUSE_PRICE = 300;
