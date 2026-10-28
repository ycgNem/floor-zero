import * as THREE from 'three';
import { DANGER } from '../telegraphs';
import { Enemy, type EnemyHost } from '../enemy';

interface Ring {
  mesh: THREE.Mesh;
  radius: number;
  low: boolean;
  hit: boolean;
}

const RING_SPEED = 5;
const RING_MAX = 13;
const LOW_Y = 0.3;
const HIGH_Y = 1.45;

/**
 * A rooted fungus whose cap rings like a bell. Each ring sends out an expanding band
 * at foot height (jump it) or head height (crouch under it), alternating.
 */
export class Bellcap extends Enemy {
  readonly type = 'bellcap';
  readonly displayName = 'Bellcap';
  private readonly cap: THREE.Group;
  private readonly gills: THREE.MeshStandardMaterial;
  private readonly rings: Ring[] = [];
  private readonly ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(DANGER).multiplyScalar(2), toneMapped: false, transparent: true, opacity: 0.9 });
  private nextLow = true;

  constructor(host: EnemyHost, id: string, pos: THREE.Vector3, yaw: number) {
    super(host, id, pos, yaw, 40, 0.5, 1.5, [{ item: 'dim_core', chance: 0.8 }, { item: 'glowcap', chance: 0.4 }], false);
    const stem = this.mat(0xb7a78a, { roughness: 0.95 });
    const top = this.mat(0x5a3a4a, { roughness: 0.6 });
    this.gills = this.mat(0x223344, { emissive: 0x5fb0ff, emissiveIntensity: 0.8 });
    this.part(new THREE.CylinderGeometry(0.13, 0.22, 1.0, 12), stem, 0, 0.5, 0);
    this.part(new THREE.SphereGeometry(0.28, 12, 8), stem, 0, 0.05, 0).scale.y = 0.4;
    this.cap = new THREE.Group();
    this.cap.position.y = 1.05;
    this.group.add(this.cap);
    const profile = [new THREE.Vector2(0, 0.42), new THREE.Vector2(0.22, 0.38), new THREE.Vector2(0.42, 0.22), new THREE.Vector2(0.58, 0.02), new THREE.Vector2(0.62, -0.06), new THREE.Vector2(0.5, -0.04)];
    this.part(new THREE.LatheGeometry(profile, 20), top, 0, 0, 0, this.cap);
    this.part(new THREE.CylinderGeometry(0.5, 0.12, 0.08, 20), this.gills, 0, -0.04, 0, this.cap);
    this.ringMat.depthWrite = false;
  }

  think(dt: number): void {
    if (!this.aggro && this.canSeePlayer(14)) this.aggro = true;
    switch (this.state) {
      case 'idle':
        if (this.aggro && this.host.requestToken(this)) this.setState('charge');
        break;
      case 'charge':
        if (this.stateTime > 0.95) {
          this.emitRing();
          this.host.releaseToken(this);
          this.setState('cooldown');
        }
        break;
      case 'cooldown':
        if (this.stateTime > 2.4) this.setState('idle');
        break;
    }
    this.updateRings(dt);
  }

  private emitRing(): void {
    const low = this.nextLow;
    this.nextLow = !this.nextLow;
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 6, 64), this.ringMat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(this.position.x, this.position.y + (low ? LOW_Y : HIGH_Y), this.position.z);
    mesh.scale.setScalar(0.6);
    this.game.scene.add(mesh);
    this.rings.push({ mesh, radius: 0.6, low, hit: false });
    this.game.events.emit('enemyAttack', { type: 'bellcap-ring', position: this.center });
  }

  private updateRings(dt: number): void {
    const player = this.game.player;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      if (!ring) continue;
      ring.radius += RING_SPEED * dt;
      ring.mesh.scale.set(ring.radius, ring.radius, 1);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
      if (!ring.hit) {
        const p = player.position;
        const d = Math.hypot(p.x - this.position.x, p.z - this.position.z);
        if (Math.abs(d - ring.radius) < 0.4) {
          const heightAbove = p.y - this.position.y;
          const dodged = ring.low ? heightAbove > 0.45 : player.crouching;
          if (!dodged) {
            ring.hit = true;
            this.host.damagePlayer(12, ring.mesh.position.clone());
          }
        }
      }
      if (ring.radius > RING_MAX) {
        ring.mesh.removeFromParent();
        ring.mesh.geometry.dispose();
        this.rings.splice(i, 1);
      }
    }
  }

  protected override animate(_dt: number, time: number): void {
    const charging = this.state === 'charge';
    const t = charging ? this.stateTime / 0.95 : 0;
    this.gills.emissiveIntensity = charging ? 0.8 + t * 6 + Math.sin(time * 40) * t : 0.8;
    this.cap.scale.set(1 + t * 0.12, 1 - t * 0.1, 1 + t * 0.12);
    this.cap.rotation.z = Math.sin(time * 1.3) * 0.04;
    this.cap.position.y = 1.05 + Math.sin(time * 2) * 0.01;
  }

  override dispose(): void {
    for (const ring of this.rings) {
      ring.mesh.removeFromParent();
      ring.mesh.geometry.dispose();
    }
    this.rings.length = 0;
    this.ringMat.dispose();
    super.dispose();
  }
}
