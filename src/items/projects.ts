import type { ItemId } from '../data/items';
import type { ProjectDef } from '../data/projects';
import type { ItemStack, ProjectState } from '../save/world-state';
import { countItem, removeItem } from './inventory';

/** collecting: materials still owed. ready: only the bells. funded: built overnight. */
export type ProjectStage = 'collecting' | 'ready' | 'funded' | 'built';

export function emptyProject(): ProjectState {
  return { delivered: {}, fundedOn: null };
}

/** Materials still owed, in the order the project lists them. */
export function owed(def: ProjectDef, state: ProjectState | undefined): [ItemId, number][] {
  const result: [ItemId, number][] = [];
  for (const [item, need] of Object.entries(def.inputs) as [ItemId, number][]) {
    const left = need - (state?.delivered[item] ?? 0);
    if (left > 0) result.push([item, left]);
  }
  return result;
}

export function projectStage(def: ProjectDef, state: ProjectState | undefined, built: boolean): ProjectStage {
  if (built) return 'built';
  if (state?.fundedOn !== null && state?.fundedOn !== undefined) return 'funded';
  return owed(def, state).length === 0 ? 'ready' : 'collecting';
}

/**
 * Hands in whatever the pack holds toward the materials still owed. Mutates the pack and the
 * project. Returns what was handed in.
 */
export function deliverTo(def: ProjectDef, state: ProjectState, pack: ItemStack[]): ItemStack[] {
  const moved: ItemStack[] = [];
  for (const [item, left] of owed(def, state)) {
    const count = removeItem(pack, item, Math.min(left, countItem(pack, item)));
    if (count === 0) continue;
    state.delivered[item] = (state.delivered[item] ?? 0) + count;
    moved.push({ item, count });
  }
  return moved;
}

/** Funded projects go up overnight: built once a morning has passed since the money changed hands. */
export function builtBy(state: ProjectState | undefined, day: number): boolean {
  return state?.fundedOn !== null && state?.fundedOn !== undefined && day > state.fundedOn;
}
