export interface BuffDef {
  name: string;
  description: string;
  /** Added to max health. */
  maxHealth?: number;
  /** Multiplies dash recharge time. */
  dashRecharge?: number;
  /** Multiplies the time between mining and gathering swings. */
  gatherSpeed?: number;
}

/** Meal buffs from Pell's kitchen. One of each at a time; eating again refreshes the timer. */
export const BUFFS = {
  hearty: { name: 'Hearty', description: '+20 max health', maxHealth: 20 },
  surefoot: { name: 'Sure-footed', description: 'Dashes recharge 40% faster', dashRecharge: 0.6 },
  keen: { name: 'Keen', description: 'Mine and gather 15% faster', gatherSpeed: 0.85 },
} as const satisfies Record<string, BuffDef>;

export type BuffId = keyof typeof BUFFS;

export function isBuffId(value: unknown): value is BuffId {
  return typeof value === 'string' && value in BUFFS;
}
