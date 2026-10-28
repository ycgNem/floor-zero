import * as THREE from 'three';
import type { Game } from '../game';
import type { EnemyHost } from './enemy';
import { DANGER } from './telegraphs';

/** Feet height of a low ring above its origin; jump it. */
export const LOW_RING = 0.25;
/** Head height of a high ring; crouch under it. */
export const HIGH_RING = 1.45;

interface Ring {
  mesh: THREE.Mesh;
  center: THREE.Vector3;
  radius: number;
  speed: number;
  max: number;
  damage: number;
  low: boolean;
  hit: boolean;
}

/** Expanding rings along the floor: jump the low ones, crouch under the high ones, or dash through. */
export class Shockwaves {
  private readonly rings: Ring[] = [];
  private readonly material = new THREE.MeshBasicMaterial({ color: new THREE.Color(DANGER).multiplyScalar(1.8), toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false });

  constructor(private readonly host: EnemyHost) {}

  private get game(): Game {
    return this.host.game;
  }

  emit(center: THREE.Vector3, o: { low: boolean; speed: number; max: number; damage: number }): void {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(1, o.low ? 0.07 : 0.05, 6, 72), this.material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(center.x, center.y + (o.low ? LOW_RING : HIGH_RING), center.z);
    mesh.scale.setScalar(0.5);
    this.game.scene.add(mesh);
    this.rings.push({ mesh, center: center.clone(), radius: 0.5, speed: o.speed, max: o.max, damage: o.damage, low: o.low, hit: false });
  }

  update(dt: number): void {
    const player = this.game.player;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i] as Ring;
      ring.radius += ring.speed * dt;
      ring.mesh.scale.set(ring.radius, ring.radius, 1);
      if (!ring.hit) {
        const p = player.position;
        const d = Math.hypot(p.x - ring.center.x, p.z - ring.center.z);
        if (Math.abs(d - ring.radius) < 0.45) {
          const dodged = ring.low ? p.y - ring.center.y > 0.45 : player.crouching;
          if (!dodged) {
            ring.hit = true;
            this.host.damagePlayer(ring.damage, ring.mesh.position.clone());
          }
        }
      }
      if (ring.radius > ring.max) {
        ring.mesh.removeFromParent();
        ring.mesh.geometry.dispose();
        this.rings.splice(i, 1);
      }
    }
  }

  dispose(): void {
    for (const ring of this.rings) {
      ring.mesh.removeFromParent();
      ring.mesh.geometry.dispose();
    }
    this.rings.length = 0;
    this.material.dispose();
  }
}
