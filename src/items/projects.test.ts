import { describe, expect, it } from 'vitest';
import { PROJECTS } from '../data/projects';
import type { ItemStack } from '../save/world-state';
import { addItem, countItem } from './inventory';
import { builtBy, deliverTo, emptyProject, owed, projectStage } from './projects';

describe('town projects', () => {
  it('takes only what is owed, across several trips', () => {
    const def = PROJECTS.yard_hoist;
    const state = emptyProject();
    const pack: ItemStack[] = [];
    addItem(pack, 'planks', 7, 24);
    addItem(pack, 'iron_ore', 9, 24);
    expect(deliverTo(def, state, pack)).toEqual([{ item: 'planks', count: 7 }, { item: 'iron_ore', count: 6 }]);
    expect(countItem(pack, 'iron_ore')).toBe(3);
    expect(owed(def, state)).toEqual([['planks', 3], ['rope', 2]]);
    expect(projectStage(def, state, false)).toBe('collecting');

    addItem(pack, 'planks', 5, 24);
    addItem(pack, 'rope', 2, 24);
    deliverTo(def, state, pack);
    expect(countItem(pack, 'planks')).toBe(2);
    expect(projectStage(def, state, false)).toBe('ready');
  });

  it('goes up the morning after it is funded', () => {
    const state = { ...emptyProject(), fundedOn: 4 };
    expect(projectStage(PROJECTS.forge_bellows, state, false)).toBe('funded');
    expect(builtBy(state, 4)).toBe(false);
    expect(builtBy(state, 5)).toBe(true);
    expect(builtBy(emptyProject(), 9)).toBe(false);
  });
});
