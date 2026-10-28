import { clamp } from '../core/math';
import type { NodeDef } from '../data/nodes';

/** Seconds between swings for a pickaxe tier. Tier 0 is bare hands (herbs). */
export function swingInterval(toolTier: number): number {
  return [1.0, 1.6, 1.25, 0.95][toolTier] ?? 0.95;
}

/** Chance that one swing yields an item. */
export function swingSuccessChance(node: Pick<NodeDef, 'level' | 'hardness'>, level: number, toolTier: number): number {
  const chance = 0.35 + (level - node.level) * 0.03 + Math.max(0, toolTier - 1) * 0.1 - (node.hardness - 1) * 0.06;
  return clamp(chance, 0.12, 0.95);
}

/** Expected seconds per item, for tuning and the skill guide. */
export function secondsPerItem(node: Pick<NodeDef, 'level' | 'hardness'>, level: number, toolTier: number): number {
  return swingInterval(toolTier) / swingSuccessChance(node, level, toolTier);
}
