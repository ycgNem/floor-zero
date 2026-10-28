import { clamp } from '../core/math';
import type { FishingSpotDef } from '../data/fishing';

/** Chance a fish stays on the hook when you strike in time. */
export function hookChance(spot: Pick<FishingSpotDef, 'level' | 'hardness'>, level: number): number {
  return clamp(0.55 + (level - spot.level) * 0.025 - (spot.hardness - 1) * 0.12, 0.25, 0.97);
}

/** Seconds until the next bite, from a 0–1 roll. Practised anglers get bites a little sooner. */
export function biteDelay(spot: Pick<FishingSpotDef, 'level' | 'wait'>, level: number, roll: number): number {
  const [min, max] = spot.wait;
  const practice = clamp((level - spot.level) / 30, 0, 0.35);
  return (min + (max - min) * clamp(roll, 0, 1)) * (1 - practice);
}

/** Seconds you have to strike once the float dips. A little more forgiving as you level. */
export function strikeWindow(spot: Pick<FishingSpotDef, 'level' | 'window'>, level: number): number {
  return spot.window * (1 + clamp((level - spot.level) / 40, 0, 0.5));
}
