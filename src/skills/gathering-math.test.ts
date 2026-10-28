import { describe, expect, it } from 'vitest';
import { NODES } from '../data/nodes';
import { secondsPerItem, swingSuccessChance } from './gathering-math';

describe('gathering math', () => {
  it('gets better with level and tool tier', () => {
    const copper = NODES.copper_seam;
    expect(swingSuccessChance(copper, 10, 1)).toBeGreaterThan(swingSuccessChance(copper, 1, 1));
    expect(swingSuccessChance(copper, 1, 2)).toBeGreaterThan(swingSuccessChance(copper, 1, 1));
  });

  it('stays inside sensible bounds', () => {
    expect(swingSuccessChance(NODES.cobalt_seam, 1, 1)).toBe(0.12);
    expect(swingSuccessChance(NODES.copper_seam, 99, 3)).toBe(0.95);
  });

  it('keeps early copper mining at a few seconds per ore', () => {
    const s = secondsPerItem(NODES.copper_seam, 1, 1);
    expect(s).toBeGreaterThan(3);
    expect(s).toBeLessThan(6);
  });
});
