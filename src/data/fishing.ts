import type { ItemId } from './items';

export interface FishingSpotDef {
  name: string;
  level: number;
  fish: ItemId;
  xp: number;
  /** Used up by each catch. Null means they bite on a bare hook. */
  bait: ItemId | null;
  /** Seconds the float sits before a bite: [min, max]. */
  wait: readonly [number, number];
  /** Seconds you have to strike once the float dips. */
  window: number;
  /** Harder fish slip the hook more often. 1 is a minnow. */
  hardness: number;
}

export const FISHING_SPOTS = {
  shallows: { name: 'Shallows', level: 1, fish: 'cave_minnow', xp: 20, bait: null, wait: [2.5, 6], window: 1.1, hardness: 1 },
  eel_run: { name: 'Eel run', level: 5, fish: 'lantern_eel', xp: 42, bait: 'bait_grubs', wait: [3.5, 8], window: 0.85, hardness: 1.5 },
  deep_pool: { name: 'Deep pool', level: 15, fish: 'white_cavefish', xp: 90, bait: 'bait_grubs', wait: [5, 11], window: 0.65, hardness: 2.2 },
} as const satisfies Record<string, FishingSpotDef>;

export type FishingSpotType = keyof typeof FISHING_SPOTS;
