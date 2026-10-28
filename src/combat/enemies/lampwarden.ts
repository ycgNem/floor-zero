import * as THREE from 'three';
import { Enemy, type EnemyHost } from '../enemy';

const FIELD_RANGE = 7;
const MAX_BEAMS = 6;

/** A tall lantern-headed construct that shields everything near it and backs away from you. Kill it first. */
export class Lampwarden extends Enemy {
  readonly type = 'lampwarden';
  readonly displayName = 'Lampwarden';
  private readonly lens: THREE.MeshStandardMaterial;
  private readonly head = new THREE.Group();
  private readonly beams: THREE.LineSegments;
  private readonly beamPositions = new Float32Array(MAX_BEAMS * 6);
  private zap = 2;
  private strafe = Math.random() < 0.5 ? -1 : 1;

  constructor(host: EnemyHost, id: string, pos: THREE.Vector3, yaw: number) {
    super(host, id, pos, yaw, 35, 0.45, 1.9, [{ item: 'bright_core', chance: 0.5 }, { item: 'dim_core', chance: 1 }], true);
    const brass = this.mat(0x8a6a3a, { roughness: 0.4, metalness: 0.8 });
    const dark = this.mat(0x2a2622, { roughness: 0.7, metalness: 0.4 });
    this.lens = this.mat(0x9fe8ff, { emissive: 0x5fd0ff, emissiveIntensity: 2.5 });
    this.part(new THREE.CylinderGeometry(0.28, 0.4, 0.3, 10), dark, 0, 0.15, 0);
    this.part(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 8), brass, 0, 0.9, 0);
    this.head.position.y = 1.6;
    this.group.add(this.head);
    this.part(new THREE.CylinderGeometry(0.22, 0.26, 0.42, 10), brass, 0, 0, 0, this.head);
    this.part(new THREE.SphereGeometry(0.17, 14, 10), this.lens, 0, 0, 0, this.head);
    this.part(new THREE.ConeGeometry(0.26, 0.2, 10), dark, 0, 0.3, 0, this.head);
    for (const side of [-1, 1]) {
      const fin = this.part(new THREE.BoxGeometry(0.04, 0.5, 0.18), dark, side * 0.3, 0.9, 0);
      fin.rotation.z = side * 0.3;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.beamPositions, 3));
    geometry.setDrawRange(0, 0);
    this.beams = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.55 }));
    this.beams.frustumCulled = false;
    host.game.scene.add(this.beams);
  }

  think(dt: number): void {
    const player = this.game.player.position;
    const toPlayer = player.clone().sub(this.position).setY(0);
    const dist = toPlayer.length();
    if (!this.aggro && this.canSeePlayer(16)) this.aggro = true;
    if (!this.aggro) {
      this.move(new THREE.Vector3(), 0, dt);
      return;
    }
    this.face(player, 5, dt);
    // Keep its distance, drifting sideways so it's never a sitting target.
    const away = toPlayer.clone().normalize().multiplyScalar(dist < 7 ? -1 : dist > 11 ? 1 : 0);
    const side = new THREE.Vector3(toPlayer.z, 0, -toPlayer.x).normalize().multiplyScalar(this.strafe * 0.6);
    if (this.stateTime > 2.5) {
      this.strafe *= -1;
      this.stateTime = 0;
    }
    const moved = this.move(away.add(side).normalize(), dist < 5 ? 3.6 : 2.2, dt);
    if (moved < 0.3) this.strafe *= -1;

    // The field: everything nearby shrugs off hits while the warden stands.
    for (const enemy of this.game.combat.enemies) {
      if (enemy === this || !enemy.alive) continue;
      if (enemy.position.distanceTo(this.position) < FIELD_RANGE) enemy.shielded = Math.max(enemy.shielded, 0.2);
    }

    this.zap -= dt;
    if (this.zap <= 0 && this.canSeePlayer(18)) {
      this.zap = 3.6;
      const from = this.center.setY(this.position.y + 1.6);
      const dir = this.game.player.chestPosition().sub(from).normalize();
      this.game.combat.projectiles.spawn({ kind: 'orb', pos: from.addScaledVector(dir, 0.4), vel: dir.multiplyScalar(7), radius: 0.18, damage: 8, life: 4, homing: 0.8 });
    }
  }

  protected override animate(_dt: number, time: number): void {
    this.head.rotation.y = Math.sin(time * 0.8) * 0.3;
    this.lens.emissiveIntensity = 2.5 + Math.sin(time * 3) * 0.6;
    let n = 0;
    const from = this.position.clone().setY(this.position.y + 1.6);
    for (const enemy of this.game.combat.enemies) {
      if (n >= MAX_BEAMS) break;
      if (enemy === this || !enemy.alive || enemy.position.distanceTo(this.position) >= FIELD_RANGE) continue;
      const to = enemy.center;
      this.beamPositions.set([from.x, from.y, from.z, to.x, to.y, to.z], n * 6);
      n++;
    }
    this.beams.geometry.setDrawRange(0, n * 2);
    this.beams.geometry.getAttribute('position').needsUpdate = true;
  }

  override dispose(): void {
    this.beams.removeFromParent();
    this.beams.geometry.dispose();
    (this.beams.material as THREE.Material).dispose();
    super.dispose();
  }
}
