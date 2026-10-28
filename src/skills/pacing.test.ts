import { describe, expect, it } from 'vitest';
import type { AreaId } from '../data/ids';
import { NODES, type NodeSpawn, type NodeType } from '../data/nodes';
import { NODE_PLACEMENTS } from '../data/placements';
import { RECIPES } from '../data/recipes';
import { secondsPerItem } from './gathering-math';
import { xpForLevel } from './xp';

/**
 * The slice's pacing targets (doc 04), checked against the real placements and numbers.
 * If one of these fails after a tuning change, the change moved the pacing: decide on purpose.
 */

/** Average ore a day from every node of a type across some areas, before glints and conditions. */
function supply(areas: AreaId[], type: NodeType): number {
  const nodes: readonly NodeSpawn[] = areas.flatMap((a) => (NODE_PLACEMENTS as Partial<Record<AreaId, readonly NodeSpawn[]>>)[a] ?? []);
  const [min, max] = NODES[type].yields;
  return nodes.filter((n) => n.type === type).length * ((min + max) / 2);
}

const EARLY: AreaId[] = ['entry-yard', 'broken-galleries'];

describe('slice pacing', () => {
  it('lets a new delver reach Mining 10 on copper within two days of the yard and galleries', () => {
    const copperNeeded = xpForLevel(10) / NODES.copper_seam.xp;
    expect(copperNeeded).toBeLessThan(70);
    expect(supply(EARLY, 'copper_seam') * 2).toBeGreaterThan(copperNeeded + 5);
  });

  it('has enough iron near the top for the iron pickaxe in one day', () => {
    expect(supply(EARLY, 'iron_seam')).toBeGreaterThanOrEqual(RECIPES.iron_pickaxe.inputs.iron_ore + 4);
  });

  it('takes Mining 10 to 15 in a few days of iron, not weeks', () => {
    const iron = (xpForLevel(15) - xpForLevel(10)) / NODES.iron_seam.xp;
    const perDay = supply([...EARLY, 'lantern-pool', 'lower-cut'], 'iron_seam');
    expect(iron / perDay).toBeGreaterThan(1);
    expect(iron / perDay).toBeLessThan(3);
  });

  it('keeps swings brisk at every tier you meet in the Old Works', () => {
    expect(secondsPerItem(NODES.copper_seam, 1, 1)).toBeLessThan(5);
    expect(secondsPerItem(NODES.iron_seam, 10, 2)).toBeLessThan(4.5);
    expect(secondsPerItem(NODES.cobalt_seam, 15, 3)).toBeLessThan(4.5);
  });
});
