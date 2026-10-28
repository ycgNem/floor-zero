import { describe, expect, it } from 'vitest';
import { FISHING_SPOTS } from '../data/fishing';
import { biteDelay, hookChance, strikeWindow } from './fishing-math';

describe('fishing math', () => {
  const shallows = FISHING_SPOTS.shallows;
  const deep = FISHING_SPOTS.deep_pool;

  it('hooks more often as you level, within bounds', () => {
    expect(hookChance(shallows, 1)).toBeCloseTo(0.55);
    expect(hookChance(shallows, 20)).toBeGreaterThan(hookChance(shallows, 1));
    expect(hookChance(shallows, 99)).toBe(0.97);
    expect(hookChance(deep, 15)).toBeGreaterThanOrEqual(0.25);
    expect(hookChance(deep, 15)).toBeLessThan(hookChance(shallows, 15));
  });

  it('keeps bite delays inside the spot range at its level', () => {
    expect(biteDelay(shallows, 1, 0)).toBe(shallows.wait[0]);
    expect(biteDelay(shallows, 1, 1)).toBe(shallows.wait[1]);
    expect(biteDelay(shallows, 1, 2)).toBe(shallows.wait[1]);
  });

  it('gives practised anglers quicker bites and wider windows, up to a cap', () => {
    expect(biteDelay(shallows, 30, 0.5)).toBeLessThan(biteDelay(shallows, 1, 0.5));
    expect(biteDelay(shallows, 99, 0.5)).toBeCloseTo(biteDelay(shallows, 1, 0.5) * 0.65);
    expect(strikeWindow(shallows, 41)).toBeCloseTo(shallows.window * 1.5);
    expect(strikeWindow(shallows, 99)).toBeCloseTo(shallows.window * 1.5);
  });
});
