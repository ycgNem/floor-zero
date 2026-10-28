import { AREA_IDS, isFlagId, type AreaId } from '../data/ids';
import { isBuffId } from '../data/buffs';
import { isConditionId, type DailyCondition } from '../data/conditions';
import { isItemId, type ItemId } from '../data/items';
import { isProjectId } from '../data/projects';
import { createNewState, SAVE_VERSION, type ItemStack, type ProjectState, type WorldState } from './world-state';

type Raw = Record<string, unknown>;

/** migrations[v] upgrades a version-v save to version v + 1. */
const migrations: Record<number, (raw: Raw) => Raw> = {
  // v2 only adds things (conditions, projects, the pack and charm slots); sanitize fills in their defaults.
  1: (raw) => raw,
};

const key = (slot: number): string => `floor-zero/save/${slot}`;

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stacks(value: unknown): ItemStack[] {
  if (!Array.isArray(value)) return [];
  const result: ItemStack[] = [];
  for (const entry of value) {
    if (isRecord(entry) && isItemId(entry.item) && typeof entry.count === 'number' && entry.count > 0) {
      result.push({ item: entry.item, count: Math.floor(entry.count) });
    }
  }
  return result;
}

function conditions(value: unknown): WorldState['conditions'] {
  if (!isRecord(value) || typeof value.day !== 'number' || !Array.isArray(value.list)) return { day: 0, list: [] };
  const list: DailyCondition[] = [];
  for (const entry of value.list) {
    if (!isRecord(entry) || !isConditionId(entry.id)) continue;
    const condition: DailyCondition = { id: entry.id };
    if (typeof entry.node === 'string') condition.node = entry.node;
    if (isItemId(entry.item)) condition.item = entry.item;
    list.push(condition);
  }
  return { day: value.day, list };
}

function projects(value: unknown): WorldState['projects'] {
  const result: WorldState['projects'] = {};
  if (!isRecord(value)) return result;
  for (const [id, entry] of Object.entries(value)) {
    if (!isProjectId(id) || !isRecord(entry)) continue;
    const delivered: Partial<Record<ItemId, number>> = {};
    if (isRecord(entry.delivered)) {
      for (const [item, count] of Object.entries(entry.delivered)) {
        if (isItemId(item) && typeof count === 'number' && count > 0) delivered[item] = Math.floor(count);
      }
    }
    const state: ProjectState = { delivered, fundedOn: typeof entry.fundedOn === 'number' ? entry.fundedOn : null };
    result[id] = state;
  }
  return result;
}

/** Fills anything missing or malformed with defaults, so a damaged save still loads. */
function sanitize(raw: Raw): WorldState {
  const base = createNewState();
  const player = isRecord(raw.player) ? raw.player : {};
  const merged: WorldState = {
    ...base,
    ...(raw as Partial<WorldState>),
    player: {
      ...base.player,
      ...(player as Partial<WorldState['player']>),
      skills: { ...base.player.skills, ...(isRecord(player.skills) ? player.skills : {}) },
      equipment: { ...base.player.equipment, ...(isRecord(player.equipment) ? player.equipment : {}) },
      pack: stacks(player.pack),
      buffs: Array.isArray(player.buffs) ? player.buffs.filter((b): b is WorldState['player']['buffs'][number] => isRecord(b) && isBuffId(b.id) && typeof b.until === 'number') : [],
    },
    bank: stacks(raw.bank),
    flags: Array.isArray(raw.flags) ? raw.flags.filter(isFlagId) : [],
    depleted: isRecord(raw.depleted) ? (raw.depleted as Record<string, number>) : {},
    soldToday: isRecord(raw.soldToday) ? (raw.soldToday as WorldState['soldToday']) : {},
    counters: isRecord(raw.counters) ? (raw.counters as Record<string, number>) : {},
    conditions: conditions(raw.conditions),
    projects: projects(raw.projects),
  };
  if (!(AREA_IDS as readonly string[]).includes(merged.player.area)) merged.player.area = 'lift-plaza' as AreaId;
  return merged;
}

export function migrate(raw: unknown): WorldState | null {
  if (!isRecord(raw) || typeof raw.version !== 'number') return null;
  let data = raw;
  let version = raw.version;
  while (version < SAVE_VERSION) {
    const step = migrations[version];
    if (!step) return null;
    data = step(data);
    version++;
    data.version = version;
  }
  return version === SAVE_VERSION ? sanitize(data) : null;
}

export function saveGame(state: WorldState, slot = 0): boolean {
  try {
    localStorage.setItem(key(slot), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(slot = 0): WorldState | null {
  try {
    const text = localStorage.getItem(key(slot));
    return text ? migrate(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

export function hasSave(slot = 0): boolean {
  try {
    return localStorage.getItem(key(slot)) !== null;
  } catch {
    return false;
  }
}

export function deleteSave(slot = 0): void {
  try {
    localStorage.removeItem(key(slot));
  } catch {
    // Storage blocked; nothing to delete.
  }
}
