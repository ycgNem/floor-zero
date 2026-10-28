import { describe, expect, it } from 'vitest';
import { CONDITIONS } from '../data/conditions';
import type { FlagId } from '../data/ids';
import { biteScale, describeCondition, priceScale, rollConditions, yieldBonus, yieldScale } from './conditions';

const context = (flags: FlagId[], mining = 1) => ({ has: (f: FlagId) => flags.includes(f), mining });
const LATE: FlagId[] = ['license_granted', 'irregular_seen', 'galleries_route_open', 'rod_received', 'pool_walkway_repaired', 'lower_cut_reached', 'cobalt_pick_forged', 'pump_intake_cleared'];

describe('daily conditions', () => {
  it('posts nothing before the license', () => {
    expect(rollConditions(7, 1, context([]))).toEqual([]);
  });

  it('is the same roll for the same seed and day', () => {
    expect(rollConditions(7, 3, context(LATE, 20))).toEqual(rollConditions(7, 3, context(LATE, 20)));
  });

  it('posts two a day, never two of the same kind, and only what you can reach', () => {
    for (let day = 1; day < 60; day++) {
      const list = rollConditions(12345, day, context(['license_granted'], 3));
      expect(list.length).toBe(2);
      const kinds = list.map((c) => CONDITIONS[c.id].effect.kind);
      expect(new Set(kinds).size).toBe(kinds.length);
      for (const c of list) {
        expect(c.id).not.toBe('rich_iron');
        if (c.node) expect(c.node).not.toMatch(/^lc-/);
      }
    }
  });

  it('applies its effects', () => {
    const today = [{ id: 'rich_iron' as const, node: 'bg-iron-1' }, { id: 'market_demand' as const, item: 'iron_ore' as const }];
    expect(yieldScale(today, 'bg-iron-1')).toBe(2);
    expect(yieldScale(today, 'bg-iron-2')).toBe(1);
    expect(priceScale(today, 'iron_ore', 'market')).toBe(1.5);
    expect(priceScale(today, 'copper_ore', 'market')).toBe(1);
    expect(priceScale([{ id: 'core_bounty' }], 'dim_core', 'cores')).toBe(1.33);
    expect(yieldBonus([{ id: 'glowcap_bloom' }], 'glowcap_patch')).toBe(2);
    expect(biteScale([{ id: 'eels_running' }], 'eel_run')).toBe(0.5);
    expect(describeCondition(today[0]!).detail).toContain('east chamber');
    expect(describeCondition(today[1]!).title).toBe('Bram is buying iron ore');
  });
});
