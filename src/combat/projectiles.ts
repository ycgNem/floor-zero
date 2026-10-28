import * as THREE from 'three';
import type { Physics } from '../physics/physics';
import { DANGER } from './telegraphs';

export type ProjectileKind = 'orb' | 'rivet' | 'bolt';

export interface Projectile {
  alive: boolean;
  kind: ProjectileKind;
  /** True for the player's shots and deflected orbs. */
  friendly: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  radius: number;
  damage: number;
  life: number;
  /** Optional slow homing toward the player. */
  homing: number;
  owner: unknown;
}

const MAX_PER_KIND = 160;

interface Pool {
  mesh: THREE.InstancedMesh;
  items: Projectile[];
}

/**
 * Every projectile in flight. Moved in the fixed step, drawn instanced, and tested
 * against the world with ray casts. Hits against actors are resolved by the caller.
 */
export class Projectiles {
  private readonly pools = new Map<ProjectileKind, Pool>();
  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene, private readonly physics: Physics) {
    const danger = new THREE.MeshBasicMaterial({ color: new THREE.Color(DANGER).multiplyScalar(2.2), toneMapped: false });
    this.addPool(scene, 'orb', new THREE.SphereGeometry(1, 14, 10), danger);
    this.addPool(scene, 'rivet', new THREE.CapsuleGeometry(0.5, 1.6, 4, 8), danger);
    this.addPool(scene, 'bolt', new THREE.CylinderGeometry(0.15, 0.15, 6, 6), new THREE.MeshStandardMaterial({ color: 0xc8b08a, emissive: 0x6a4a20, roughness: 0.5 }));
  }

  private addPool(scene: THREE.Scene, kind: ProjectileKind, geometry: THREE.BufferGeometry, material: THREE.Material): void {
    const mesh = new THREE.InstancedMesh(geometry, material, MAX_PER_KIND);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const items: Projectile[] = [];
    for (let i = 0; i < MAX_PER_KIND; i++) {
      mesh.setMatrixAt(i, this.hidden);
      items.push({ alive: false, kind, friendly: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), radius: 0.2, damage: 0, life: 0, homing: 0, owner: null });
    }
    scene.add(mesh);
    this.pools.set(kind, { mesh, items });
  }

  spawn(o: { kind: ProjectileKind; pos: THREE.Vector3; vel: THREE.Vector3; radius: number; damage: number; friendly?: boolean; life?: number; homing?: number; owner?: unknown }): Projectile | null {
    const pool = this.pools.get(o.kind);
    const p = pool?.items.find((x) => !x.alive);
    if (!p) return null;
    p.alive = true;
    p.friendly = o.friendly ?? false;
    p.pos.copy(o.pos);
    p.vel.copy(o.vel);
    p.radius = o.radius;
    p.damage = o.damage;
    p.life = o.life ?? 6;
    p.homing = o.homing ?? 0;
    p.owner = o.owner ?? null;
    return p;
  }

  *alive(): Generator<Projectile> {
    for (const pool of this.pools.values()) for (const p of pool.items) if (p.alive) yield p;
  }

  kill(p: Projectile): void {
    p.alive = false;
  }

  clear(): void {
    for (const pool of this.pools.values()) for (const p of pool.items) p.alive = false;
  }

  /** Moves everything; kills what hits walls. `onWallHit` gets the impact point. */
  update(dt: number, target: THREE.Vector3, onWallHit: (p: Projectile, at: THREE.Vector3) => void): void {
    for (const pool of this.pools.values()) {
      for (const p of pool.items) {
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.alive = false;
          continue;
        }
        if (p.homing > 0 && !p.friendly) {
          const speed = p.vel.length();
          const desired = target.clone().sub(p.pos).normalize().multiplyScalar(speed);
          p.vel.lerp(desired, Math.min(1, p.homing * dt)).setLength(speed);
        }
        const step = p.vel.clone().multiplyScalar(dt);
        const distance = step.length();
        if (distance > 1e-5) {
          const hit = this.physics.castRay(p.pos, step.clone().divideScalar(distance), distance + p.radius * 0.5);
          if (hit) {
            p.alive = false;
            onWallHit(p, hit.point);
            continue;
          }
        }
        p.pos.add(step);
      }
    }
  }

  /** Writes instance transforms. Call once per rendered frame. */
  sync(): void {
    for (const pool of this.pools.values()) {
      pool.items.forEach((p, i) => {
        if (!p.alive) {
          pool.mesh.setMatrixAt(i, this.hidden);
          return;
        }
        const dir = p.vel.lengthSq() > 0 ? p.vel.clone().normalize() : this.up;
        this.quat.setFromUnitVectors(this.up, dir);
        const s = p.kind === 'bolt' ? 0.1 : p.radius;
        this.scale.set(s, s, s);
        this.matrix.compose(p.pos, this.quat, this.scale);
        pool.mesh.setMatrixAt(i, this.matrix);
      });
      pool.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
