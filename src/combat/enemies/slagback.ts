import * as THREE from 'three';
import { Enemy, type EnemyHost } from '../enemy';

const CHARGE_SPEED = 14;
const CHARGE_RANGE = 14;

/**
 * A heavy beast plated in cooled slag. Long scraping windup, then a straight charge.
 * If it hits a wall it stuns itself and takes extra damage.
 */
export class Slagback extends Enemy {
  readonly type = 'slagback';
  readonly displayName = 'Slagback';
  private readonly chargeDir = new THREE.Vector3();
  private charged = 0;
  private hitPlayer = false;
  private blocked = 0;
  private readonly body: THREE.Group;
  private readonly head: THREE.Group;
  private readonly legs: THREE.Mesh[] = [];
  private readonly seams: THREE.MeshStandardMaterial;

  constructor(host: EnemyHost, id: string, pos: THREE.Vector3, yaw: number) {
    super(host, id, pos, yaw, 90, 0.75, 1.3, [{ item: 'bright_core', chance: 1 }, { item: 'dim_core', chance: 0.5 }], true);
    const hide = this.mat(0x3a302a, { roughness: 0.9 });
    const plate = this.mat(0x2a2624, { roughness: 0.7, metalness: 0.2 });
    this.seams = this.mat(0x200800, { emissive: 0xff6a1a, emissiveIntensity: 1.2 });
    const tusk = this.mat(0xd8cdb0, { roughness: 0.5 });
    this.body = new THREE.Group();
    this.body.position.y = 0.75;
    this.group.add(this.body);
    const torso = this.part(new THREE.CapsuleGeometry(0.45, 0.9, 6, 14), hide, 0, 0, 0, this.body);
    torso.rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const p = this.part(new THREE.DodecahedronGeometry(0.28, 0), plate, (i % 2 ? 0.12 : -0.12), 0.4, -0.55 + i * 0.27, this.body);
      p.scale.set(1.2, 0.55, 1);
      p.rotation.set(Math.random(), Math.random(), Math.random());
      this.part(new THREE.BoxGeometry(0.3, 0.03, 0.05), this.seams, p.position.x, 0.33, p.position.z + 0.12, this.body);
    }
    this.head = new THREE.Group();
    this.head.position.set(0, 0.85, 0.85);
    this.group.add(this.head);
    this.part(new THREE.BoxGeometry(0.5, 0.42, 0.55), hide, 0, 0, 0.1, this.head);
    for (const side of [-1, 1]) {
      const t = this.part(new THREE.ConeGeometry(0.06, 0.4, 6), tusk, side * 0.22, -0.1, 0.4, this.head);
      t.rotation.set(Math.PI / 2 - 0.5, 0, side * -0.3);
      this.part(new THREE.SphereGeometry(0.04, 6, 4), this.seams, side * 0.16, 0.08, 0.38, this.head);
    }
    for (const [x, z] of [[-0.3, 0.5], [0.3, 0.5], [-0.3, -0.5], [0.3, -0.5]] as const) {
      this.legs.push(this.part(new THREE.CylinderGeometry(0.1, 0.08, 0.55, 8), hide, x, 0.28, z));
    }
  }

  think(dt: number): void {
    const player = this.game.player.position;
    const toPlayer = player.clone().sub(this.position).setY(0);
    const dist = toPlayer.length();
    if (!this.aggro && this.canSeePlayer(16)) this.aggro = true;
    this.vulnerable = this.state === 'stunned';

    switch (this.state) {
      case 'idle':
        this.move(new THREE.Vector3(), 0, dt);
        if (this.aggro) this.setState('stalk');
        break;
      case 'stalk':
        this.face(player, 4, dt);
        if (dist > 7) this.move(toPlayer.normalize(), 2.6, dt);
        else this.move(new THREE.Vector3(), 0, dt);
        if (dist < 12 && this.stateTime > 1.2 && this.canSeePlayer(14) && this.host.requestToken(this)) {
          this.setState('windup');
          this.game.events.emit('enemyAttack', { type: 'slagback-scrape', position: this.center });
        }
        break;
      case 'windup': {
        // Tracks you for most of the windup, then commits to a lane.
        if (this.stateTime < 0.8) {
          this.face(player, 6, dt);
          this.chargeDir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        }
        if (this.stateTime >= 0.8 && this.stateTime - dt < 0.8) {
          const end = this.position.clone().addScaledVector(this.chargeDir, CHARGE_RANGE);
          this.game.combat.telegraphs.line(this.position, end, 1.6, 0.35);
        }
        this.move(new THREE.Vector3(), 0, dt);
        if (this.stateTime > 1.15) {
          this.charged = 0;
          this.hitPlayer = false;
          this.setState('charge');
        }
        break;
      }
      case 'charge': {
        const moved = this.move(this.chargeDir, CHARGE_SPEED, dt);
        this.charged += CHARGE_SPEED * dt * moved;
        if (!this.hitPlayer && this.position.distanceTo(player) < 1.4) {
          this.hitPlayer = true;
          this.host.damagePlayer(22, this.center, this.chargeDir.clone().multiplyScalar(10).setY(3));
        }
        // A wall, not a one-step snag: it has to stay blocked for a moment.
        this.blocked = moved < 0.35 ? this.blocked + dt : 0;
        if (this.blocked > 0.05 && this.stateTime > 0.1) {
          this.game.player.addShake(0.4);
          this.game.events.emit('slam', { position: this.center });
          this.setState('stunned');
        } else if (this.charged > CHARGE_RANGE) {
          this.setState('recover');
        }
        break;
      }
      case 'stunned':
        this.move(new THREE.Vector3(), 0, dt);
        if (this.stateTime > 2.6) {
          this.host.releaseToken(this);
          this.setState('stalk');
        }
        break;
      case 'recover':
        this.move(new THREE.Vector3(), 0, dt);
        if (this.stateTime > 1.0) {
          this.host.releaseToken(this);
          this.setState('stalk');
        }
        break;
    }
  }

  protected override animate(_dt: number, time: number): void {
    const s = this.state;
    const gait = s === 'charge' ? 26 : s === 'stalk' ? 8 : 0;
    this.legs.forEach((leg, i) => (leg.rotation.x = gait ? Math.sin(time * gait + (i % 2) * Math.PI) * 0.6 : 0));
    this.head.rotation.x = s === 'windup' ? 0.35 + Math.sin(time * 30) * 0.05 : s === 'stunned' ? -0.3 : 0;
    this.body.rotation.z = s === 'stunned' ? Math.sin(time * 9) * 0.12 : 0;
    this.body.position.y = 0.75 + (s === 'charge' ? Math.abs(Math.sin(time * 26)) * 0.06 : 0);
    this.seams.emissiveIntensity = s === 'windup' ? 1.2 + this.stateTime * 4 : s === 'stunned' ? 0.3 : 1.2;
  }
}
