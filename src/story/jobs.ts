import { createRng, pick } from '../core/rng';
import type { FlagId } from '../data/ids';
import { ITEMS, type ItemId } from '../data/items';
import type { Game } from '../game';
import type { NpcId } from '../town/npcs';
import { NPCS } from '../town/npcs';

/** A day's optional work from the noticeboard. */
export interface JobDef {
  id: string;
  npc: NpcId;
  item: ItemId;
  count: number;
  reward: number;
  requires?: FlagId;
  minMining?: number;
}

export const JOBS: readonly JobDef[] = [
  { id: 'oren-copper', npc: 'oren', item: 'copper_ore', count: 6, reward: 40 },
  { id: 'pell-glowcaps', npc: 'pell', item: 'glowcap', count: 4, reward: 30, requires: 'license_granted' },
  { id: 'bram-iron', npc: 'bram', item: 'iron_ore', count: 4, reward: 55, minMining: 10 },
  { id: 'iona-cores', npc: 'iona', item: 'dim_core', count: 5, reward: 45, requires: 'irregular_seen' },
  { id: 'pell-minnows', npc: 'pell', item: 'cave_minnow', count: 4, reward: 35, requires: 'rod_received' },
  { id: 'oren-bright-cores', npc: 'oren', item: 'bright_core', count: 2, reward: 70, requires: 'lower_cut_reached' },
];

function eligible(game: Game, job: JobDef): boolean {
  if (job.requires && !game.hasFlag(job.requires)) return false;
  if (job.minMining && game.progress.level('mining') < job.minMining) return false;
  return true;
}

/** The job posted today. The same every time you look, for a given day. */
export function postedJob(game: Game): JobDef | null {
  const options = JOBS.filter((job) => eligible(game, job));
  if (options.length === 0) return null;
  return pick(createRng(game.state.seed * 13 + game.state.day * 101), options);
}

export function activeJob(game: Game): JobDef | null {
  const objective = game.state.objective;
  if (!objective || objective.done) return null;
  return JOBS.find((job) => job.id === objective.id) ?? null;
}

export function describeJob(job: JobDef): string {
  return `${NPCS[job.npc].name} wants ${job.count} ${ITEMS[job.item].name.toLowerCase()} (${job.reward} bells)`;
}

export function trackerJob(game: Game): string | null {
  const job = activeJob(game);
  if (!job) return null;
  return `${describeJob(job)}: you have ${game.progress.count(job.item)}`;
}

export function acceptJob(game: Game, job: JobDef): void {
  game.state.objective = { id: job.id, progress: 0, done: false };
  game.hud.toast(`Job taken: ${describeJob(job)}.`);
}

/** Hands in the active job at its NPC, if you carry enough. */
export function deliverJob(game: Game): boolean {
  const job = activeJob(game);
  if (!job || game.progress.count(job.item) < job.count) return false;
  game.progress.take(job.item, job.count);
  game.progress.addMoney(job.reward);
  if (game.state.objective) game.state.objective.done = true;
  game.hud.toast(`Job done. +${job.reward} bells.`, 'good');
  return true;
}
