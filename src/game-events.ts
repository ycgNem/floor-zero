import type * as THREE from 'three';
import type { SoundName } from './audio/audio';
import type { AreaId, FlagId, SkillId } from './data/ids';
import type { ItemId } from './data/items';

export interface GameEvents {
  areaEntered: { area: AreaId };
  flagSet: { flag: FlagId };
  xpGained: { skill: SkillId; amount: number };
  levelUp: { skill: SkillId; level: number };
  itemAdded: { item: ItemId; count: number };
  itemRemoved: { item: ItemId; count: number };
  packFull: { item: ItemId };
  moneyChanged: { money: number; delta: number };
  dayStarted: { day: number };
  playerDamaged: { amount: number; from: THREE.Vector3 | null };
  playerHealed: { amount: number };
  playerDefeated: Record<string, never>;
  enemyKilled: { type: string; position: THREE.Vector3 };
  hit: { position: THREE.Vector3; amount: number; weakPoint: boolean };
  nodeStruck: { position: THREE.Vector3; skill: SkillId };
  nodeYield: { position: THREE.Vector3; item: ItemId };
  dialogue: { npc: string };
  sold: { total: number };
  ceremony: Record<string, never>;
  enemyAttack: { type: string; position: THREE.Vector3 };
  slam: { position: THREE.Vector3 };
  playerAttack: { weapon: string };
  deflect: { position: THREE.Vector3 };
  areaUnloading: Record<string, never>;
  /** A one-off sound with no other event behind it. */
  sound: { name: SoundName; position?: THREE.Vector3 };
}
