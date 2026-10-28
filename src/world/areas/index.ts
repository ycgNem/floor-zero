import type { AreaId } from '../../data/ids';
import type { AreaDef } from '../area';
import { brokenGalleries } from './broken-galleries';
import { entryYard } from './entry-yard';
import { lanternPool } from './lantern-pool';
import { lowerCut } from './lower-cut';
import { pumpStation } from './pump-station';
import { liftPlaza } from './lift-plaza';

/** Every buildable area. */
export const AREAS: Partial<Record<AreaId, AreaDef>> = {
  'lift-plaza': liftPlaza,
  'entry-yard': entryYard,
  'broken-galleries': brokenGalleries,
  'lantern-pool': lanternPool,
  'lower-cut': lowerCut,
  'pump-station': pumpStation,
};

export function floorLabel(floor: number): string {
  return floor === 0 ? 'Floor Zero' : `Floor ${floor}`;
}
