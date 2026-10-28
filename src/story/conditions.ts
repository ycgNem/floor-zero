import { createRng, pick, type Rng } from '../core/rng';
import { CONDITIONS, type ConditionDef, type ConditionId, type DailyCondition } from '../data/conditions';
import type { FishingSpotType } from '../data/fishing';
import type { AreaId, FlagId } from '../data/ids';
import { ITEMS, type ItemId } from '../data/items';
import type { NodeType } from '../data/nodes';

/** What the roll needs to know about the player: no Game, so it stays testable. */
export interface ConditionContext {
  has(flag: FlagId): boolean;
  mining: number;
}

const PER_DAY = 2;

function eligible(def: ConditionDef, ctx: ConditionContext): boolean {
  if (def.requires && !ctx.has(def.requires)) return false;
  return ctx.mining >= (def.minMining ?? 0);
}

/** Fills in the seam or item a condition lands on. Null if nothing it could land on is reachable. */
function landOn(id: ConditionId, def: ConditionDef, rng: Rng, ctx: ConditionContext): DailyCondition | null {
  const effect = def.effect;
  if (effect.kind === 'rich') {
    const seams = effect.seams.filter((s) => !s.requires || ctx.has(s.requires));
    return seams.length > 0 ? { id, node: pick(rng, seams).node } : null;
  }
  if (effect.kind === 'demand') return { id, item: pick(rng, effect.items) };
  return { id };
}

/** The day's conditions, from the ones that make sense for where you are in the story. Same seed and day, same roll. */
export function rollConditions(seed: number, day: number, ctx: ConditionContext): DailyCondition[] {
  const rng = createRng(seed * 31 + day * 977);
  const pool = (Object.keys(CONDITIONS) as ConditionId[]).filter((id) => eligible(CONDITIONS[id], ctx));
  const picked: DailyCondition[] = [];
  const kinds = new Set<string>();
  while (pool.length > 0 && picked.length < PER_DAY) {
    const [id] = pool.splice(Math.floor(rng() * pool.length), 1);
    if (!id) break;
    const def: ConditionDef = CONDITIONS[id];
    if (kinds.has(def.effect.kind)) continue;
    const condition = landOn(id, def, rng, ctx);
    if (!condition) continue;
    kinds.add(def.effect.kind);
    picked.push(condition);
  }
  return picked;
}

/** The noticeboard's headline and line for a condition, with its seam or item filled in. */
export function describeCondition(condition: DailyCondition): { title: string; detail: string } {
  const def: ConditionDef = CONDITIONS[condition.id];
  const seam = def.effect.kind === 'rich' ? def.effect.seams.find((s) => s.node === condition.node) : undefined;
  const item = condition.item ? ITEMS[condition.item].name.toLowerCase() : '';
  return {
    title: condition.item ? `${def.title} ${item}` : def.title,
    detail: def.detail.replace('{where}', seam?.where ?? 'somewhere in the Old Works').replace('{item}', item),
  };
}

function effects(conditions: readonly DailyCondition[]): ConditionDef['effect'][] {
  return conditions.map((c) => (CONDITIONS[c.id] as ConditionDef).effect);
}

/** Yield multiplier for a placed node: rich seams give double. */
export function yieldScale(conditions: readonly DailyCondition[], nodeId: string): number {
  return conditions.some((c) => c.node === nodeId && CONDITIONS[c.id].effect.kind === 'rich') ? 2 : 1;
}

/** Extra yield for every node of a type: a bloom. */
export function yieldBonus(conditions: readonly DailyCondition[], node: NodeType): number {
  return effects(conditions).reduce((sum, e) => sum + (e.kind === 'bloom' && e.node === node ? e.bonus : 0), 0);
}

/** Multiplier on the wait for a bite at a kind of spot. */
export function biteScale(conditions: readonly DailyCondition[], spot: FishingSpotType): number {
  return effects(conditions).reduce((scale, e) => scale * (e.kind === 'run' && e.spot === spot ? e.wait : 1), 1);
}

/** What a buyer pays on top of the usual for an item today. */
export function priceScale(conditions: readonly DailyCondition[], item: ItemId, buyer: 'market' | 'cores' | 'kitchen'): number {
  let scale = 1;
  for (const c of conditions) {
    const e = (CONDITIONS[c.id] as ConditionDef).effect;
    if (e.kind === 'demand' && c.item === item && buyer !== 'cores') scale *= e.price;
    if (e.kind === 'bounty' && buyer === 'cores' && ITEMS[item].kind === 'core') scale *= e.price;
  }
  return scale;
}

export function hasSwarm(conditions: readonly DailyCondition[], area: AreaId): boolean {
  return effects(conditions).some((e) => e.kind === 'swarm' && e.area === area);
}
