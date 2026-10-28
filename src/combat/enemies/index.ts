import type * as THREE from 'three';
import type { Enemy, EnemyHost, EnemyType } from '../enemy';
import { Bellcap } from './bellcap';
import { BroodNest } from './brood-nest';
import { Hollowhorn } from './hollowhorn';
import { Lampwarden } from './lampwarden';
import { RivetSentry } from './rivet-sentry';
import { Scuttler } from './scuttler';
import { Sinkmaw } from './sinkmaw';
import { Slagback } from './slagback';

type Factory = (host: EnemyHost, id: string, pos: THREE.Vector3, yaw: number) => Enemy;

/** Every enemy type that can be spawned from an area. */
export const ENEMY_FACTORIES: Partial<Record<EnemyType, Factory>> = {
  scuttler: (h, id, p, y) => new Scuttler(h, id, p, y),
  bellcap: (h, id, p, y) => new Bellcap(h, id, p, y),
  slagback: (h, id, p, y) => new Slagback(h, id, p, y),
  rivet_sentry: (h, id, p, y) => new RivetSentry(h, id, p, y),
  lampwarden: (h, id, p, y) => new Lampwarden(h, id, p, y),
  sinkmaw: (h, id, p, y) => new Sinkmaw(h, id, p, y),
  brood_nest: (h, id, p, y) => new BroodNest(h, id, p, y),
  hollowhorn: (h, id, p, y) => new Hollowhorn(h, id, p, y),
};
