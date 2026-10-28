import type { MaterialKey } from '../world/materials';
import type { SkillId } from './ids';
import type { ItemId } from './items';

export interface NodeDef {
  name: string;
  skill: SkillId;
  level: number;
  item: ItemId;
  xp: number;
  /** Successful swings before the node is exhausted: [min, max]. */
  yields: readonly [number, number];
  respawnDays: number;
  /** Harder nodes succeed less often. 1 is copper. */
  hardness: number;
  /** Minimum tool tier (pickaxes: copper 1, iron 2, cobalt 3). */
  toolTier: number;
  /** Visual material for the vein or growth. */
  mat: MaterialKey;
  verb: string;
}

export const NODES = {
  copper_seam: { name: 'Copper seam', skill: 'mining', level: 1, item: 'copper_ore', xp: 17.5, yields: [3, 5], respawnDays: 1, hardness: 1, toolTier: 1, mat: 'ore_copper', verb: 'Mine' },
  iron_seam: { name: 'Iron seam', skill: 'mining', level: 10, item: 'iron_ore', xp: 35, yields: [2, 4], respawnDays: 1, hardness: 1.6, toolTier: 1, mat: 'ore_iron', verb: 'Mine' },
  cobalt_seam: { name: 'Cobalt seam', skill: 'mining', level: 15, item: 'cobalt_ore', xp: 80, yields: [2, 3], respawnDays: 2, hardness: 2.2, toolTier: 3, mat: 'ore_cobalt', verb: 'Mine' },
  glowcap_patch: { name: 'Glowcaps', skill: 'botany', level: 1, item: 'glowcap', xp: 12, yields: [2, 3], respawnDays: 1, hardness: 0.6, toolTier: 0, mat: 'glow_blue', verb: 'Pick' },
  lampmoss_patch: { name: 'Lampmoss', skill: 'botany', level: 8, item: 'lampmoss', xp: 26, yields: [2, 3], respawnDays: 1, hardness: 0.9, toolTier: 0, mat: 'moss', verb: 'Gather' },
} as const satisfies Record<string, NodeDef>;

export type NodeType = keyof typeof NODES;

export const PICKAXE_TIER: Partial<Record<ItemId, number>> = {
  copper_pickaxe: 1,
  iron_pickaxe: 2,
  cobalt_pickaxe: 3,
};
