import * as THREE from 'three';
import { damp } from '../../core/math';
import { Enemy, type EnemyHost } from '../enemy';
import { Shockwaves } from '../shockwaves';
import { animateHollowhorn, buildHollowhorn, type HollowhornPose, type HollowhornRig } from './hollowhorn-model';

const CHARGE_SPEED = 15;
const CHARGE_RANGE = 24;
const GORE_REACH = 2.4;

/**
 * The Irregular, hunted down in its lair. Charges you can bait into walls, stomps that send rings
 * across the floor, and a horn sweep for anyone who gets greedy up close. Faster below half health.
 */
export class Hollowhorn extends Enemy {
  readonly type = 'hollowhorn';
  readonly displayName = 'The Hollowhorn';
  override readonly boss = true;
  private readonly rig: HollowhornRig;
  private readonly pose: HollowhornPose = { speed: 0, rear: 0, roar: 0, charge: 0 };
  private readonly rings: Shockwaves;
  private readonly chargeDir = new THREE.Vector3();
  private charged = 0;
  private hitPlayer = false;
  private blocked = 0;
  private stomps = 0;

  constructor(host: EnemyHost, id: string, pos: THREE.Vector3, yaw: number) {
    super(host, id, pos, yaw, 420, 1.3, 3, [{ item: 'radiant_core', chance: 1 }, { item: 'bright_core', chance: 1, count: 3 }], true);
    this.rig = buildHollowhorn((color, o) => this.mat(color, o));
    this.rig.light.intensity = 6;
    this.group.add(this.rig.root);
    this.rings = new Shockwaves(host);
  }

  private get enraged(): boolean {
    return this.health < this.maxHealth / 2;
  }

  think(dt: number): void {
    const player = this.game.player.position;
    const toPlayer = player.clone().sub(this.position).setY(0);
    const dist = toPlayer.length();
    if (!this.aggro && this.canSeePlayer(22)) this.aggro = true;
    this.vulnerable = this.state === 'stunned';
    const pace = this.enraged ? 0.75 : 1;
    this.rings.update(dt);

    switch (this.state) {
      case 'idle':
        this.move(new THREE.Vector3(), 0, dt);
        if (this.aggro) {
          this.setState('roar');
          this.game.events.emit('sound', { name: 'roar', position: this.center });
        }
        break;
      case 'roar':
        this.move(new THREE.Vector3(), 0, dt);
        if (this.stateTime > 1.6) this.setState('stalk');
        break;
      case 'stalk': {
        this.face(player, 3, dt);
        this.move(dist > 9 ? toPlayer.clone().normalize() : new THREE.Vector3(), 2.4, dt);
        if (this.stateTime > 1.6 * pace) {
          if (dist < 4.5) this.setState('gore');
          else if (Math.random() < 0.4) {
            this.stomps = this.enraged ? 2 : 1;
            this.setState('stomp');
          } else this.setState('windup');
        }
        break;
      }
      case 'windup': {
        // Paws the ground and tracks you, then commits to a lane.
        const commit = 0.75 * pace;
        if (this.stateTime < commit) {
          this.face(player, 5, dt);
          this.chargeDir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        } else if (this.stateTime - dt < commit) {
          this.game.combat.telegraphs.line(this.position, this.position.clone().addScaledVector(this.chargeDir, CHARGE_RANGE), 2.6, 0.35 * pace);
          this.game.events.emit('enemyAttack', { type: 'hollowhorn-charge', position: this.center });
        }
        this.move(new THREE.Vector3(), 0, dt);
        if (this.stateTime > commit + 0.35 * pace) {
          this.charged = 0;
          this.hitPlayer = false;
          this.setState('charge');
        }
        break;
      }
      case 'charge': {
        const moved = this.move(this.chargeDir, CHARGE_SPEED, dt);
        this.charged += CHARGE_SPEED * dt * moved;
        const horns = this.position.clone().addScaledVector(this.chargeDir, 1.6);
        if (!this.hitPlayer && Math.hypot(player.x - horns.x, player.z - horns.z) < GORE_REACH) {
          this.hitPlayer = true;
          this.host.damagePlayer(30, this.center, this.chargeDir.clone().multiplyScalar(12).setY(4));
        }
        // A wall, not a one-step snag: it has to stay blocked for a moment.
        this.blocked = moved < 0.35 ? this.blocked + dt : 0;
        if (this.blocked > 0.05 && this.stateTime > 0.1) {
          this.game.player.addShake(0.7);
          this.game.loop.freeze(0.08);
          this.game.events.emit('slam', { position: this.center });
          this.game.effects.burst(horns.setY(1.4), { count: 30, color: 0x857b70, speed: 6, size: 0.09, life: 1 });
          this.setState('stunned');
        } else if (this.charged > CHARGE_RANGE) this.setState('recover');
        break;
      }
      case 'stomp': {
        this.move(new THREE.Vector3(), 0, dt);
        const slamAt = 0.85 * pace;
        if (this.stateTime >= slamAt && this.stateTime - dt < slamAt) {
          // The second stomp of a pair rings at head height: crouch, don't jump.
          const low = this.stomps > 1 || !this.enraged;
          this.rings.emit(this.position, { low, speed: 8.5, max: 20, damage: 18 });
          this.game.player.addShake(0.45 * Math.max(0, 1 - dist / 25));
          this.game.events.emit('slam', { position: this.position.clone() });
          this.game.effects.burst(this.position.clone().setY(0.2), { count: 26, color: 0x857b70, speed: 5, size: 0.08, life: 0.9 });
        }
        if (this.stateTime > slamAt + 0.45) {
          this.stomps--;
          this.setState(this.stomps > 0 ? 'stomp' : 'recover');
        }
        break;
      }
      case 'gore': {
        this.face(player, 4, dt);
        this.move(new THREE.Vector3(), 0, dt);
        const swingAt = 0.55 * pace;
        if (this.stateTime < 0.1) {
          const ahead = this.position.clone().add(new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(2.2));
          this.game.combat.telegraphs.circle(ahead, 2.2, swingAt);
        }
        if (this.stateTime >= swingAt && this.stateTime - dt < swingAt) {
          const ahead = this.position.clone().add(new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(2.2));
          if (Math.hypot(player.x - ahead.x, player.z - ahead.z) < 2.2) {
            this.host.damagePlayer(22, this.center, toPlayer.clone().normalize().multiplyScalar(9).setY(3));
          }
        }
        if (this.stateTime > swingAt + 0.5) this.setState('recover');
        break;
      }
      case 'stunned':
        this.move(new THREE.Vector3(), 0, dt);
        if (this.stateTime > 2.6) this.setState('stalk');
        break;
      case 'recover':
        this.move(new THREE.Vector3(), 0, dt);
        if (this.stateTime > 1.0 * pace) this.setState('stalk');
        break;
    }
  }

  protected override animate(dt: number, time: number): void {
    const s = this.state;
    const p = this.pose;
    const target = {
      speed: s === 'charge' ? CHARGE_SPEED : s === 'stalk' ? 2.4 : 0,
      rear: s === 'stomp' ? (this.stateTime < 0.85 ? 1 : 0) : s === 'roar' ? 0.7 : 0,
      roar: s === 'roar' || (s === 'stomp' && this.stateTime < 0.85) ? 1 : 0,
      charge: s === 'windup' || s === 'charge' || s === 'gore' ? 1 : 0,
    };
    p.speed = damp(p.speed, target.speed, 6, dt);
    p.rear = damp(p.rear, target.rear, s === 'stomp' && this.stateTime >= 0.85 ? 20 : 6, dt);
    p.roar = damp(p.roar, target.roar, 8, dt);
    p.charge = damp(p.charge, target.charge, 6, dt);
    if (s === 'stunned') {
      this.rig.neck.rotation.z = Math.sin(time * 7) * 0.2;
      p.charge = 0.8;
    } else this.rig.neck.rotation.z = 0;
    if (s === 'windup') this.rig.root.position.y = Math.abs(Math.sin(time * 12)) * 0.05;
    else this.rig.root.position.y = 0;
    animateHollowhorn(this.rig, p, dt, time);
    this.rig.light.intensity = 6 + p.roar * 6;
  }

  override dispose(): void {
    this.rings.dispose();
    super.dispose();
  }
}
