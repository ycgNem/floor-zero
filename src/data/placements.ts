import type { AreaId } from './ids';
import type { NodeSpawn } from './nodes';

/**
 * Where every resource node sits, per area. Node ids are save keys (depletion is stored by id):
 * never rename one without a save migration.
 */
export const NODE_PLACEMENTS = {
  'entry-yard': [
    { id: 'ey-copper-1', type: 'copper_seam', at: [-9.6, 0, 20.5] },
    { id: 'ey-copper-2', type: 'copper_seam', at: [-9.8, 0, 26] },
    { id: 'ey-copper-3', type: 'copper_seam', at: [9.8, 0, 30.5] },
    { id: 'ey-copper-4', type: 'copper_seam', at: [-5.5, 0, 35] },
    { id: 'ey-copper-5', type: 'copper_seam', at: [6.4, 0, 9.6] },
    { id: 'ey-copper-6', type: 'copper_seam', at: [0.5, 0, 35.2] },
    { id: 'ey-copper-7', type: 'copper_seam', at: [-6, 0, 13.6] },
    { id: 'ey-iron-1', type: 'iron_seam', at: [16, 0, 19.2] },
    { id: 'ey-iron-2', type: 'iron_seam', at: [16.2, 0, 22.8] },
    { id: 'ey-glowcap-1', type: 'glowcap_patch', at: [-7.5, 0, 17.2] },
    { id: 'ey-glowcap-2', type: 'glowcap_patch', at: [12.8, 0, 18.6] },
  ],
  'broken-galleries': [
    { id: 'bg-copper-1', type: 'copper_seam', at: [-2.6, 0, 6.2] },
    { id: 'bg-copper-2', type: 'copper_seam', at: [2.6, 0, 12.5] },
    { id: 'bg-copper-3', type: 'copper_seam', at: [-2.5, 0, 22.5] },
    { id: 'bg-iron-1', type: 'iron_seam', at: [15.6, 0, 26] },
    { id: 'bg-iron-2', type: 'iron_seam', at: [9.8, 0, 26] },
    { id: 'bg-iron-3', type: 'iron_seam', at: [-13.2, 0, 15.8], scale: 0.9 },
    { id: 'bg-glowcap-1', type: 'glowcap_patch', at: [-7, 0, 15.5] },
    { id: 'bg-glowcap-2', type: 'glowcap_patch', at: [-13.4, 0, 12] },
    { id: 'bg-lampmoss-1', type: 'lampmoss_patch', at: [-6.6, 0, 8] },
  ],
  'lantern-pool': [
    { id: 'lp-glowcap-1', type: 'glowcap_patch', at: [-16.5, 0, 16.5] },
    { id: 'lp-glowcap-2', type: 'glowcap_patch', at: [-17.2, 0, 33] },
    { id: 'lp-glowcap-3', type: 'glowcap_patch', at: [17, 0, 13.5] },
    { id: 'lp-lampmoss-1', type: 'lampmoss_patch', at: [-15.5, 0, 41.6] },
    { id: 'lp-lampmoss-2', type: 'lampmoss_patch', at: [17.4, 0, 36.5] },
    { id: 'lp-iron-1', type: 'iron_seam', at: [-9.5, 0, 41.2] },
    { id: 'lp-iron-2', type: 'iron_seam', at: [10.4, 0, 41.2] },
  ],
  'lower-cut': [
    { id: 'lc-cobalt-1', type: 'cobalt_seam', at: [-7.1, 0, 18] },
    { id: 'lc-iron-1', type: 'iron_seam', at: [-6.6, 0, 8.5] },
    { id: 'lc-iron-2', type: 'iron_seam', at: [-6.8, 0, 31] },
    { id: 'lc-iron-3', type: 'iron_seam', at: [2.8, 0, 37] },
    { id: 'lc-copper-1', type: 'copper_seam', at: [3, 0, 4] },
    { id: 'lc-lampmoss-1', type: 'lampmoss_patch', at: [-5.5, 0, 41.5] },
    { id: 'lc-lampmoss-2', type: 'lampmoss_patch', at: [2.4, 0, 2.2] },
    { id: 'lc-lampmoss-3', type: 'lampmoss_patch', at: [-36, 0, 30] },
  ],
  'pump-station': [
    { id: 'ps-cobalt-1', type: 'cobalt_seam', at: [27.4, 0, 34.6] },
    { id: 'ps-cobalt-2', type: 'cobalt_seam', at: [27.4, 0, 41.6] },
    { id: 'ps-iron-1', type: 'iron_seam', at: [-16.6, 0, 22] },
  ],
} satisfies Partial<Record<AreaId, readonly NodeSpawn[]>>;
