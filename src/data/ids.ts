export const AREA_IDS = ['lift-plaza', 'entry-yard', 'broken-galleries', 'lantern-pool', 'lower-cut', 'pump-station'] as const;
export type AreaId = (typeof AREA_IDS)[number];

export const SKILL_IDS = ['mining', 'smithing', 'fishing', 'cooking', 'botany', 'blade', 'boltcaster', 'resonance'] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export const SKILL_NAMES: Record<SkillId, string> = {
  mining: 'Mining',
  smithing: 'Smithing',
  fishing: 'Fishing',
  cooking: 'Cooking',
  botany: 'Botany',
  blade: 'Blade',
  boltcaster: 'Boltcaster',
  resonance: 'Resonance',
};

/** Permanent world changes and story progress. Stored in saves by name. */
export const FLAGS = [
  'test_lever',
  'met_mara', 'met_iona', 'met_oren', 'met_pell', 'met_tavi',
  'license_granted', 'iron_pick_forged', 'cracked_wall_broken', 'storeroom_looted', 'schematic_delivered',
  'irregular_seen', 'galleries_route_open', 'freight_gate_open',
  'rod_received', 'pool_ladder_secured', 'pool_walkway_repaired',
  'lower_cut_reached', 'dark_tunnel_lit', 'hollowhorn_slain',
  'pump_power_restored', 'pump_intake_cleared', 'pump_plate_found', 'pump_sequence_known',
  'pick_head_found', 'cobalt_pick_forged',
  'sluicekeeper_defeated', 'floor_markers_lit', 'rank_two', 'deep_lift_ceremony',
] as const;
export type FlagId = (typeof FLAGS)[number];

export function isFlagId(value: unknown): value is FlagId {
  return typeof value === 'string' && (FLAGS as readonly string[]).includes(value);
}
