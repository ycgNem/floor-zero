import type { ItemId } from '../data/items';

export type WeaponSlot = 'blade' | 'boltcaster' | 'resonance';

export const BLADE_DAMAGE: Partial<Record<ItemId, number>> = {
  copper_blade: 9,
  iron_blade: 14,
  cobalt_blade: 22,
};

export const BOLT_DAMAGE = 13;
export const BOLT_SPEED = 48;
export const MAGAZINE = 6;
export const RELOAD_TIME = 1.4;
export const SURGE_DAMAGE = 34;

/** Proficiency adds up to +20% at level 99. Gear and skill matter more. */
export function proficiencyBonus(level: number): number {
  return 1 + (Math.min(99, level) / 99) * 0.2;
}

/** The blade combo: two slashes and a thrust. */
export const COMBO = [
  { kind: 'slash', duration: 0.42, reach: 2.7, arc: 55, scale: 1 },
  { kind: 'slash2', duration: 0.42, reach: 2.7, arc: 55, scale: 1 },
  { kind: 'thrust', duration: 0.5, reach: 3.3, arc: 22, scale: 1.35 },
] as const;
