import * as THREE from 'three';
import { wrapAngle } from '../../core/math';
import { Enemy, type EnemyHost } from '../enemy';

const LANES = [-0.24, 0, 0.24];
const RIVET_SPEED = 13;
const FIRE_TIME = 2.6;
const SWEEP = 0.45;

/** A bolted-down construct that fills a corridor with lanes of rivets. Armoured in front; flank it. */
export class RivetSentry extends Enemy {
  readonly type = 'rivet_sentry';
  readonly displayName = 'Rivet Sentry';
  private readonly head = new THREE.Group();
  private readonly eye: THREE.MeshStandardMaterial;
  private readonly vents: THREE.MeshStandardMaterial;
  private aim = 0;
  private shot = 0;
  private recoil = 0;

  constructor(host: EnemyHost, id: string, pos: THREE.Vector3, yaw: number) {
    super(host, id, pos, yaw, 70, 0.6, 1.4, [{ item: 'bright_core', chance: 0.6 }, { item: 'salvaged_spring', chance: 0.5 }], false);
    const iron = this.mat(0x5a5650, { roughness: 0.5, metalness: 0.7 });
    const rust = this.mat(0x6a3e26, { roughness: 0.8, metalness: 0.3 });
    const plate = this.mat(0x7a756c, { roughness: 0.4, metalness: 0.8 });
    this.eye = this.mat(0x200000, { emissive: 0xff4a2a, emissiveIntensity: 2 });
    this.vents = this.mat(0x1a1410, { emissive: 0xff7a2a, emissiveIntensity: 0 });
    this.part(new THREE.CylinderGeometry(0.62, 0.75, 0.5, 12), rust, 0, 0.25, 0);
    this.part(new THREE.CylinderGeometry(0.22, 0.3, 0.5, 10), iron, 0, 0.7, 0);
    this.head.position.y = 1.05;
    this.group.add(this.head);
    const body = this.part(new THREE.BoxGeometry(0.9, 0.55, 0.8), iron, 0, 0, 0, this.head);
    body.rotation.x = 0.05;
    // The front shield: rivets bounce off it, so get around to the back.
    this.part(new THREE.BoxGeometry(1.15, 0.75, 0.08), plate, 0, 0.02, 0.45, this.head);
    for (const x of [-0.28, 0, 0.28]) {
      const barrel = this.part(new THREE.CylinderGeometry(0.05, 0.06, 0.55, 8), iron, x, -0.05, 0.62, this.head);
      barrel.rotation.x = Math.PI / 2;
    }
    this.part(new THREE.SphereGeometry(0.07, 10, 8), this.eye, 0, 0.28, 0.5, this.head);
    this.part(new THREE.BoxGeometry(0.6, 0.12, 0.1), this.vents, 0, 0.08, -0.42, this.head);
  }

  think(dt: number): void {
    const player = this.game.player.position;
    if (!this.aggro && this.canSeePlayer(18)) this.aggro = true;
    this.vulnerable = this.state === 'cool';
    this.recoil = Math.max(0, this.recoil - dt * 6);

    switch (this.state) {
      case 'idle':
        if (this.aggro) this.setState('aim');
        break;
      case 'aim':
        this.face(player, 3, dt);
        if (this.stateTime > 0.4 && this.stateTime - dt <= 0.4) {
          for (const lane of LANES) {
            const dir = new THREE.Vector3(Math.sin(this.yaw + lane), 0, Math.cos(this.yaw + lane));
            this.game.combat.telegraphs.line(this.position, this.position.clone().addScaledVector(dir, 16), 0.5, 0.45);
          }
        }
        if (this.stateTime > 0.85) {
          this.aim = this.yaw;
          this.shot = 0;
          this.setState(this.canSeePlayer(20) ? 'fire' : 'idle');
          this.game.events.emit('enemyAttack', { type: 'rivet-volley', position: this.center });
        }
        break;
      case 'fire': {
        // Sweeps slowly back and forth across the corridor while it fires.
        this.yaw = wrapAngle(this.aim + Math.sin((this.stateTime / FIRE_TIME) * Math.PI * 2) * SWEEP);
        this.shot -= dt;
        if (this.shot <= 0) {
          this.shot = 0.42;
          this.volley();
        }
        if (this.stateTime > FIRE_TIME) this.setState('cool');
        break;
      }
      case 'cool':
        if (this.stateTime > 1.8) this.setState('aim');
        break;
    }
  }

  private volley(): void {
    const muzzle = this.position.clone().setY(this.position.y + 1.0);
    for (const lane of LANES) {
      const dir = new THREE.Vector3(Math.sin(this.yaw + lane), 0, Math.cos(this.yaw + lane));
      this.game.combat.projectiles.spawn({ kind: 'rivet', pos: muzzle.clone().addScaledVector(dir, 0.8), vel: dir.multiplyScalar(RIVET_SPEED), radius: 0.12, damage: 9, life: 2.4 });
    }
    this.recoil = 1;
  }

  /** Half damage through the front shield, extra from behind. */
  override damage(amount: number, from: THREE.Vector3): number {
    const toAttacker = Math.atan2(from.x - this.position.x, from.z - this.position.z);
    const off = Math.abs(wrapAngle(toAttacker - this.yaw));
    const scale = off < 0.9 ? 0.5 : off > 2.0 ? 1.5 : 1;
    return super.damage(amount * scale, from);
  }

  protected override animate(_dt: number, time: number): void {
    this.head.position.z = -this.recoil * 0.06;
    this.eye.emissiveIntensity = this.state === 'aim' ? 2 + Math.sin(time * 30) * 1.5 + this.stateTime * 3 : this.state === 'cool' ? 0.4 : 2;
    this.vents.emissiveIntensity = this.state === 'cool' ? 2.5 + Math.sin(time * 12) * 0.8 : 0;
  }
}
