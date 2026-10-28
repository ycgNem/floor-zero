import { describe, expect, it } from 'vitest';
import { levelForXp, levelProgress, MAX_LEVEL, xpForLevel } from './xp';

describe('xp curve', () => {
  it('matches the RuneScape reference points', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(83);
    expect(xpForLevel(10)).toBe(1154);
    expect(xpForLevel(15)).toBe(2411);
    expect(xpForLevel(99)).toBe(13034431);
  });

  it('maps XP back to levels at the boundaries', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(82)).toBe(1);
    expect(levelForXp(83)).toBe(2);
    expect(levelForXp(13034431)).toBe(MAX_LEVEL);
    expect(levelForXp(1e12)).toBe(MAX_LEVEL);
  });

  it('reports progress within a level', () => {
    const progress = levelProgress(83 + 10);
    expect(progress.level).toBe(2);
    expect(progress.into).toBe(10);
    expect(progress.span).toBe(xpForLevel(3) - 83);
    expect(levelProgress(xpForLevel(99)).fraction).toBe(1);
  });
});
