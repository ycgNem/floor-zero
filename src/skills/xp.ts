export const MAX_LEVEL = 99;

/** RuneScape-shaped curve: the XP for each level roughly doubles every `DOUBLING` levels. */
const BASE = 300;
const DOUBLING = 7;

const TABLE: number[] = (() => {
  const table = [0, 0];
  let points = 0;
  for (let level = 1; level < MAX_LEVEL; level++) {
    points += Math.floor(level + BASE * 2 ** (level / DOUBLING));
    table.push(Math.floor(points / 4));
  }
  return table;
})();

/** Total XP needed to reach `level`. Level 1 needs 0. */
export function xpForLevel(level: number): number {
  const clamped = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return TABLE[clamped] ?? 0;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

export interface LevelProgress {
  level: number;
  /** XP earned since the current level started. */
  into: number;
  /** XP between the current level and the next. 0 at max level. */
  span: number;
  fraction: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return { level, into: 0, span: 0, fraction: 1 };
  const start = xpForLevel(level);
  const span = xpForLevel(level + 1) - start;
  return { level, into: xp - start, span, fraction: (xp - start) / span };
}
