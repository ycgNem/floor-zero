import type { FishingSpotType } from './fishing';
import type { AreaId, FlagId } from './ids';
import type { ItemId } from './items';
import type { NodeType } from './nodes';

/** A seam that can run rich on a given day, and how the noticeboard tells you where it is. */
export interface RichSeam {
  node: string;
  area: AreaId;
  where: string;
  /** Only once you can reach it. */
  requires?: FlagId;
}

export type ConditionEffect =
  /** One of these seams yields double today. */
  | { kind: 'rich'; seams: readonly RichSeam[] }
  /** Every patch of a plant yields extra. */
  | { kind: 'bloom'; node: NodeType; bonus: number }
  /** Bites come quicker at one kind of fishing spot: the wait is multiplied by `wait`. */
  | { kind: 'run'; spot: FishingSpotType; wait: number }
  /** Bram pays more for one of these items. */
  | { kind: 'demand'; items: readonly ItemId[]; price: number }
  /** Iona pays more for every core. */
  | { kind: 'bounty'; price: number }
  /** Extra creatures in an area, carrying cores. */
  | { kind: 'swarm'; area: AreaId };

export interface ConditionDef {
  title: string;
  /** What it means for you. `{where}` and `{item}` are filled in from the day's roll. */
  detail: string;
  requires?: FlagId;
  /** Mining level before it's worth posting (no point telling a novice about rich iron). */
  minMining?: number;
  effect: ConditionEffect;
}

/**
 * Each morning's local conditions (doc 03): the map stays knowable, the opportunities keep moving.
 * Two are posted per day, never two of the same kind.
 */
export const CONDITIONS = {
  rich_copper: {
    title: 'Rich copper',
    detail: 'A copper seam {where} is running thick today: twice the ore.',
    requires: 'license_granted',
    effect: {
      kind: 'rich',
      seams: [
        { node: 'ey-copper-3', area: 'entry-yard', where: 'by the grated shaft in the Entry Yard' },
        { node: 'ey-copper-1', area: 'entry-yard', where: 'along the west wall of the Entry Yard' },
        { node: 'bg-copper-2', area: 'broken-galleries', where: 'beside the rails in the Broken Galleries' },
        { node: 'lc-copper-1', area: 'lower-cut', where: 'at the top of the Lower Cut', requires: 'lower_cut_reached' },
      ],
    },
  },
  rich_iron: {
    title: 'Rich iron',
    detail: 'An iron seam {where} is running thick today: twice the ore.',
    requires: 'license_granted',
    minMining: 8,
    effect: {
      kind: 'rich',
      seams: [
        { node: 'ey-iron-2', area: 'entry-yard', where: 'in the east alcove of the Entry Yard' },
        { node: 'bg-iron-1', area: 'broken-galleries', where: 'in the east chamber of the Broken Galleries' },
        { node: 'lp-iron-2', area: 'lantern-pool', where: 'on the south shore of Lantern Pool', requires: 'galleries_route_open' },
        { node: 'lc-iron-2', area: 'lower-cut', where: 'past the cobalt in the Lower Cut', requires: 'lower_cut_reached' },
      ],
    },
  },
  rich_cobalt: {
    title: 'Rich cobalt',
    detail: 'The cobalt {where} is showing bright today: twice the ore.',
    requires: 'cobalt_pick_forged',
    effect: {
      kind: 'rich',
      seams: [
        { node: 'lc-cobalt-1', area: 'lower-cut', where: 'in the west wall of the Lower Cut' },
        { node: 'ps-cobalt-1', area: 'pump-station', where: 'in the intake wing of the Pump Station', requires: 'pump_intake_cleared' },
      ],
    },
  },
  glowcap_bloom: {
    title: 'Glowcap bloom',
    detail: 'Glowcaps are fruiting all over the Old Works: two extra from every patch.',
    requires: 'license_granted',
    effect: { kind: 'bloom', node: 'glowcap_patch', bonus: 2 },
  },
  eels_running: {
    title: 'The eels are running',
    detail: 'Lantern eels are biting twice as fast at the eel run.',
    requires: 'rod_received',
    effect: { kind: 'run', spot: 'eel_run', wait: 0.5 },
  },
  cavefish_rising: {
    title: 'White cavefish rising',
    detail: 'The deep pool off the stranded platform is lively: bites come much faster.',
    requires: 'pool_walkway_repaired',
    effect: { kind: 'run', spot: 'deep_pool', wait: 0.55 },
  },
  market_demand: {
    title: 'Bram is buying',
    detail: 'Bram pays half again for {item} today.',
    requires: 'license_granted',
    effect: { kind: 'demand', items: ['copper_ore', 'iron_ore', 'glowcap', 'lampmoss', 'cave_minnow', 'lantern_eel', 'salvaged_spring'], price: 1.5 },
  },
  core_bounty: {
    title: 'Core bounty',
    detail: 'The lamplighters are short. Iona pays a third more for cores today.',
    requires: 'irregular_seen',
    effect: { kind: 'bounty', price: 1.33 },
  },
  scuttler_swarm: {
    title: 'Scuttlers swarming',
    detail: 'The Broken Galleries are crawling with them: more bites, and more cores for anyone who wants them.',
    requires: 'irregular_seen',
    effect: { kind: 'swarm', area: 'broken-galleries' },
  },
} as const satisfies Record<string, ConditionDef>;

export type ConditionId = keyof typeof CONDITIONS;

export function isConditionId(value: unknown): value is ConditionId {
  return typeof value === 'string' && value in CONDITIONS;
}

/** One of today's conditions, with the seam or item it landed on. */
export interface DailyCondition {
  id: ConditionId;
  /** Rich seams: the node id. */
  node?: string;
  /** Market demand: the item. */
  item?: ItemId;
}
