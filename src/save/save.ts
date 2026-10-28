import { AREA_IDS, isFlagId, type AreaId } from '../data/ids';
import { isBuffId } from '../data/buffs';
import { isItemId } from '../data/items';
import { createNewState, SAVE_VERSION, type ItemStack, type WorldState } from './world-state';

type Raw = Record<string, unknown>;

/** migrations[v] upgrades a version-v save to version v + 1. */
const migrations: Record<number, (raw: Raw) => Raw> = {};

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
