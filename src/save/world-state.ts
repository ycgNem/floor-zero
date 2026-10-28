import { SKILL_IDS, type AreaId, type FlagId, type SkillId } from '../data/ids';
import type { BuffId } from '../data/buffs';
import type { DailyCondition } from '../data/conditions';
import type { ItemId } from '../data/items';
import type { ProjectId } from '../data/projects';

/** v2 added daily conditions, town projects, and the pack and charm slots. */
export const SAVE_VERSION = 2;

export interface ItemStack {
  item: ItemId;
  count: number;
}

/** Owned gear. Tools and weapons live on your belt, not in the pack. */
export interface Equipment {
  pickaxe: ItemId | null;
  rod: ItemId | null;
  blade: ItemId | null;
  boltcaster: ItemId | null;
  resonance: ItemId | null;
  armour: ItemId | null;
  lantern: ItemId | null;
  /** A bigger pack from Oren's forge. */
  pack: ItemId | null;
  charm: ItemId | null;
}

/** A Town Works project: what's been handed in, and the day it was paid for. */
export interface ProjectState {
  delivered: Partial<Record<ItemId, number>>;
  fundedOn: number | null;
}

export interface PlayerState {
  area: AreaId;
  /** Spawn marker to place the player at on load. Null means use `position`. */
  spawn: string | null;
  position: [number, number, number];
  yaw: number;
  health: number;
  money: number;
  /** 0 until the license test is passed. */
  licenseRank: number;
  deepestFloor: number;
  /** Total XP per skill. */
  skills: Record<SkillId, number>;
  pack: ItemStack[];
  equipment: Equipment;
  /** Meal buffs, each running until a moment in `playTime`. */
  buffs: { id: BuffId; until: number }[];
}

export interface WorldState {
  version: number;
  seed: number;
  day: number;
  /** False until the first trip down each day; the town shows evening after that. */
  evening: boolean;
  player: PlayerState;
  bank: ItemStack[];
  flags: FlagId[];
  /** Renewable node id -> the day it was depleted. */
  depleted: Record<string, number>;
  /** Units of each item sold today, for market saturation. */
  soldToday: Partial<Record<ItemId, number>>;
  /** Small persistent tallies, keyed by level ids: power cells fed, and the like. */
  counters: Record<string, number>;
  /** Today's accepted optional objective. */
  objective: { id: string; progress: number; done: boolean } | null;
  /** The noticeboard's local conditions, rolled once for `day`. */
  conditions: { day: number; list: DailyCondition[] };
  projects: Partial<Record<ProjectId, ProjectState>>;
  /** Seconds played. */
  playTime: number;
}

export const PACK_SLOTS = 24;
/** Slots the delver's pack adds. */
export const BIG_PACK_SLOTS = 6;

export function emptySkills(): Record<SkillId, number> {
  const skills = {} as Record<SkillId, number>;
  for (const id of SKILL_IDS) skills[id] = 0;
  return skills;
}

export function createNewState(seed: number = Date.now() % 1_000_000): WorldState {
  return {
    version: SAVE_VERSION,
    seed,
    day: 1,
    evening: false,
    player: {
      area: 'lift-plaza',
      spawn: 'start',
      position: [0, 0, 0],
      yaw: 0,
      health: 100,
      money: 25,
      licenseRank: 0,
      deepestFloor: 0,
      skills: emptySkills(),
      pack: [{ item: 'trail_bread', count: 1 }, { item: 'trail_bread', count: 1 }, { item: 'trail_bread', count: 1 }],
      equipment: {
        pickaxe: 'copper_pickaxe',
        rod: null,
        blade: 'copper_blade',
        boltcaster: null,
        resonance: null,
        armour: null,
        lantern: null,
        pack: null,
        charm: null,
      },
      buffs: [],
    },
    bank: [],
    flags: [],
    depleted: {},
    soldToday: {},
    counters: {},
    objective: null,
    conditions: { day: 0, list: [] },
    projects: {},
    playTime: 0,
  };
}

export function hasFlag(state: WorldState, flag: FlagId): boolean {
  return state.flags.includes(flag);
}
