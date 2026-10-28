import { describe, expect, it } from 'vitest';
import type { ItemStack } from '../save/world-state';
import { addItem, countItem, halveStacks, removeItem, spaceFor } from './inventory';

describe('inventory', () => {
  it('fills partial stacks before new slots', () => {
    const pack: ItemStack[] = [{ item: 'dim_core', count: 48 }];
    expect(addItem(pack, 'dim_core', 5, 24)).toBe(5);
    expect(pack).toEqual([{ item: 'dim_core', count: 50 }, { item: 'dim_core', count: 3 }]);
  });

  it('stops at the slot limit', () => {
    const pack: ItemStack[] = [];
    expect(addItem(pack, 'copper_ore', 30, 24)).toBe(24);
    expect(spaceFor(pack, 'copper_ore', 24)).toBe(0);
    expect(spaceFor(pack, 'dim_core', 24)).toBe(0);
  });

  it('removes across stacks and drops empty ones', () => {
    const pack: ItemStack[] = [];
    addItem(pack, 'copper_ore', 3, 24);
    expect(removeItem(pack, 'copper_ore', 2)).toBe(2);
    expect(countItem(pack, 'copper_ore')).toBe(1);
    expect(pack.length).toBe(1);
    expect(removeItem(pack, 'copper_ore', 5)).toBe(1);
    expect(pack.length).toBe(0);
  });

  it('halves each item type, rounding the loss down', () => {
    const pack: ItemStack[] = [];
    addItem(pack, 'copper_ore', 5, 24);
    addItem(pack, 'dim_core', 3, 24);
    addItem(pack, 'glowcap', 1, 24);
    const lost = halveStacks(pack);
    expect(lost).toEqual([{ item: 'copper_ore', count: 2 }, { item: 'dim_core', count: 1 }]);
    expect(countItem(pack, 'copper_ore')).toBe(3);
    expect(countItem(pack, 'glowcap')).toBe(1);
  });
});
