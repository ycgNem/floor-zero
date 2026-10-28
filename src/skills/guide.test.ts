import { describe, expect, it } from 'vitest';
import { nextUnlock, skillUnlocks } from './guide';

describe('skill guide', () => {
  it('lists unlocks in level order, from the data', () => {
    const mining = skillUnlocks('mining');
    expect(mining.map((u) => u.level)).toEqual([...mining.map((u) => u.level)].sort((a, b) => a - b));
    expect(mining.some((u) => u.text.startsWith('Iron seam'))).toBe(true);
    expect(mining.some((u) => u.level === 12 && u.text.includes('cracked walls'))).toBe(true);
  });

  it('points at the next unlock', () => {
    expect(nextUnlock('mining', 1)?.level).toBe(10);
    expect(nextUnlock('mining', 12)?.level).toBe(15);
    expect(nextUnlock('blade', 5)).toBeNull();
    expect(nextUnlock('fishing', 99)).toBeNull();
  });
});
