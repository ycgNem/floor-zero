import { FISHING_SPOTS, type FishingSpotDef } from '../data/fishing';
import type { SkillId } from '../data/ids';
import { ITEMS } from '../data/items';
import { NODES, type NodeDef } from '../data/nodes';
import { RECIPES, type RecipeDef } from '../data/recipes';

export interface Unlock {
  level: number;
  text: string;
}

/** Unlocks that live in level code rather than in the data tables. */
const EXTRAS: Partial<Record<SkillId, Unlock[]>> = {
  mining: [{ level: 12, text: 'Break cracked walls (with an iron pickaxe)' }],
  smithing: [{ level: 2, text: 'Repair the walkway at Lantern Pool' }],
};

const COMBAT: readonly SkillId[] = ['blade', 'boltcaster', 'resonance'];

/**
 * Every unlock for a skill, in level order: RuneScape's skill guide (doc 04). Built from the
 * nodes, fishing spots and recipes, so it can't drift from what the game actually does.
 */
export function skillUnlocks(skill: SkillId): Unlock[] {
  if (COMBAT.includes(skill)) return [{ level: 1, text: 'Each level adds a little damage: up to a fifth more at 99' }];
  const unlocks: Unlock[] = [...(EXTRAS[skill] ?? [])];
  for (const def of Object.values(NODES) as NodeDef[]) {
    if (def.skill !== skill) continue;
    const tool = def.toolTier >= 3 ? ' (needs a cobalt pickaxe)' : '';
    unlocks.push({ level: def.level, text: `${def.name}${tool}` });
  }
  if (skill === 'fishing') {
    for (const def of Object.values(FISHING_SPOTS) as FishingSpotDef[]) {
      const bait = def.bait ? ', with bait' : '';
      unlocks.push({ level: def.level, text: `${def.name}: ${ITEMS[def.fish].name.toLowerCase()}${bait}` });
    }
  }
  for (const def of Object.values(RECIPES) as RecipeDef[]) {
    if (def.skill !== skill) continue;
    unlocks.push({ level: def.level, text: `${def.name}${def.requires ? ' (after a discovery)' : ''}` });
  }
  return unlocks.sort((a, b) => a.level - b.level);
}

/** The next thing a level brings, for the expedition card. Null when there's nothing more in the Old Works. */
export function nextUnlock(skill: SkillId, level: number): Unlock | null {
  if (COMBAT.includes(skill)) return null;
  return skillUnlocks(skill).find((u) => u.level > level) ?? null;
}
