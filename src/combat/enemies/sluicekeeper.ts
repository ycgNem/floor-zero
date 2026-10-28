import * as THREE from 'three';
import { clamp, wrapAngle } from '../../core/math';
import { taperedTube } from '../../render/shapes';
import { Enemy, type EnemyHost } from '../enemy';

const JET_LENGTH = 15;
const LOW_JET = 0.45;
const HIGH_JET = 1.5;
const BURST_RADIUS = 1.5;
const VENT_TIME = 3.2;
const PHASE_ONE: readonly Attack[] = ['jets', 'vent', 'bursts', 'vent'];
const PHASE_TWO: readonly Attack[] = ['jets', 'vent', 'rings', 'bursts', 'vent'];

type Attack = 'jets' | 'bursts' | 'rings' | 'vent';

interface Jet {
  mesh: THREE.Mesh;
  angle: number;
  height: number;
  cooldown: number;
}

interface Burst {
  at: THREE.Vector3;
  timer: number;
}

/**
 * The Old Works' boss: an ancient maintenance automaton tangled in roots and mineral growth, whose
 * damaged instructions read any movement near the pump as contamination. Its plating shrugs off most
 * of what you throw at it until it vents and its panels open.
 */
export class Sluicekeeper extends Enemy {
  readonly type = 'sluicekeeper';
  readonly displayName = 'The Sluicekeeper';
  override readonly boss = true;
  /** Called once, after it powers down. */
  onShutdown: (() => void) | null = null;
  /** Called when phase two floods the basin. */
  onFlood: (() => void) | null = null;
  private phase = 1;
  private step = 0;
  private readonly torso = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly panels: THREE.Group[] = [];
  private readonly lens: THREE.MeshStandardMaterial;
  private readonly cores: THREE.MeshStandardMaterial;
  private readonly crystals: THREE.MeshStandardMaterial;
  private readonly jetMaterial: THREE.MeshBasicMaterial;
  private readonly jets: Jet[] = [];
  private readonly bursts: Burst[] = [];
  private burstTimer = 0;
  private waves = 0;
  private waveTimer = 0;

  constructor(host: EnemyHost, id: string, pos: THREE.Vector3, yaw: number) {
    super(host, id, pos, yaw, 900, 1.4, 3.6, [], false);
    const iron = this.mat(0x4e4a44, { roughness: 0.55, metalness: 0.7 });
    const rust = this.mat(0x6a3c24, { roughness: 0.8, metalness: 0.35 });
    const brass = this.mat(0x8a6a38, { roughness: 0.4, metalness: 0.85 });
    const root = this.mat(0x3a2a1e, { roughness: 0.95 });
    this.lens = this.mat(0x0a1a20, { emissive: 0x7ff0ff, emissiveIntensity: 0.2 });
    this.cores = this.mat(0x0a1a20, { emissive: 0x9ef3ff, emissiveIntensity: 0.5 });
    this.crystals = this.mat(0x2a4a8a, { roughness: 0.25, metalness: 0.3, emissive: 0x2a5ad0, emissiveIntensity: 0.8 });

    this.part(new THREE.CylinderGeometry(1.25, 1.45, 0.8, 16), rust, 0, 0.4, 0);
    this.group.add(this.torso);
    this.torso.position.y = 0.8;
    this.part(new THREE.CylinderGeometry(0.95, 1.05, 1.8, 16), iron, 0, 0.9, 0, this.torso);
    for (const y of [0.15, 0.9, 1.65]) this.part(new THREE.TorusGeometry(1.0, 0.06, 6, 24), brass, 0, y, 0, this.torso).rotation.x = Math.PI / 2;
    // Chest panels over its cores. They swing open when it vents.
    for (const side of [-1, 1]) {
      this.part(new THREE.SphereGeometry(0.17, 12, 10), this.cores, side * 0.28, 1.0, 0.82, this.torso);
      const hinge = new THREE.Group();
      hinge.position.set(side * 0.56, 1.0, 0.95);
      this.torso.add(hinge);
      this.part(new THREE.BoxGeometry(0.52, 0.72, 0.08), brass, -side * 0.27, 0, 0, hinge);
      this.panels.push(hinge);
    }
    this.head.position.y = 1.85;
    this.torso.add(this.head);
    this.part(new THREE.SphereGeometry(0.72, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), iron, 0, 0, 0, this.head);
    this.part(new THREE.CylinderGeometry(0.28, 0.32, 0.18, 16), brass, 0, 0.3, 0.6, this.head).rotation.x = Math.PI / 2;
    this.part(new THREE.SphereGeometry(0.24, 14, 10), this.lens, 0, 0.3, 0.68, this.head);
    for (const side of [-1, 1]) {
      const arm = this.part(new THREE.CylinderGeometry(0.16, 0.2, 1.3, 10), iron, side * 1.25, 1.2, 0, this.torso);
      arm.rotation.z = side * 0.5;
      const nozzle = this.part(new THREE.ConeGeometry(0.2, 0.5, 10), brass, side * 1.62, 0.62, 0, this.torso);
      nozzle.rotation.z = side * -2.6;
    }
    // Mineral growth and roots: it has stood in the pump's spray for a very long time.
    const crystal = new THREE.OctahedronGeometry(1, 0);
    for (const [x, y, z, s] of [[0.8, 1.9, 0.3, 0.32], [0.95, 1.7, -0.2, 0.22], [-0.85, 1.85, -0.35, 0.28], [1.1, 0.2, 0.6, 0.35], [-1.2, 0.3, -0.5, 0.42], [0.4, 0.5, -1.25, 0.3]] as const) {
      const m = this.part(crystal, this.crystals, x, y, z, y > 1 ? this.torso : this.group);
      m.scale.set(s * 0.6, s * 1.6, s * 0.6);
      m.rotation.set(x, z, y);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const pts: [number, number, number][] = [];
      for (let k = 0; k <= 5; k++) {
        const t = k / 5;
        const r = 1.05 + Math.sin(t * Math.PI) * 0.12;
        pts.push([Math.cos(a + t * 2.2) * r, 0.05 + t * 2.4, Math.sin(a + t * 2.2) * r]);
      }
      this.part(taperedTube(pts, 0.11, 0.025, 20, 6), root, 0, 0, 0);
    }

    this.jetMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 2.0, 2.4), toneMapped: false, transparent: true, opacity: 0.85, depthWrite: false });
    for (let i = 0; i < 2; i++) {
      const geometry = new THREE.BoxGeometry(0.32, 0.32, JET_LENGTH);
      geometry.translate(0, 0, JET_LENGTH / 2 + 1.2);
      const mesh = new THREE.Mesh(geometry, this.jetMaterial);
      mesh.visible = false;
      host.game.scene.add(mesh);
      this.jets.push({ mesh, angle: i * Math.PI, height: LOW_JET, cooldown: 0 });
    }
    this.setState('dormant');
  }

  /** Leaves it standing, powered down, as scenery: for visits after it has been shut down. */
  retire(): void {
    for (const jet of this.jets) {
      jet.mesh.removeFromParent();
      jet.mesh.geometry.dispose();
    }
    this.jets.length = 0;
    this.health = 0;
    this.setState('off');
  }

  /** The main controls were engaged. */
  wake(): void {
    if (this.state !== 'dormant') return;
    this.setState('wake');
    this.game.events.emit('enemyAttack', { type: 'sluicekeeper-wake', position: this.center });
    this.game.events.emit('sound', { name: 'roar', position: this.center });
  }

  private get pattern(): readonly Attack[] {
    return this.phase === 1 ? PHASE_ONE : PHASE_TWO;
  }

  private next(): void {
    const attack = this.pattern[this.step % this.pattern.length] as Attack;
    this.step++;
    if (attack === 'jets') this.startJets();
    if (attack === 'bursts') this.burstTimer = 0;
    if (attack === 'rings') {
      this.waves = 3;
      this.waveTimer = 0;
    }
    this.setState(attack);
  }

  private startJets(): void {
    const facing = Math.atan2(this.game.player.position.x - this.position.x, this.game.player.position.z - this.position.z);
    const highFirst = Math.random() < 0.5;
    this.jets.forEach((jet, i) => {
      jet.angle = facing + Math.PI / 2 + i * Math.PI;
      // Phase two fires one low and one high together.
      jet.height = this.phase === 1 ? (highFirst ? HIGH_JET : LOW_JET) : i === 0 ? LOW_JET : HIGH_JET;
      jet.cooldown = 0;
      jet.mesh.visible = true;
    });
  }

  think(dt: number): void {
    this.vulnerable = this.state === 'vent';
    this.updateBursts(dt);
    if (this.phase === 1 && this.health < this.maxHealth * 0.55 && this.state === 'vent' && this.stateTime > VENT_TIME) {
      this.phase = 2;
      this.step = 0;
      this.setState('flood');
      this.onFlood?.();
      return;
    }

    switch (this.state) {
      case 'dormant':
        return;
      case 'wake':
        if (this.stateTime > 2.4) {
          this.aggro = true;
          this.next();
        }
        break;
      case 'flood':
        if (this.stateTime > 3) this.next();
        break;
      case 'jets': {
        const warn = 0.9;
        const speed = this.phase === 1 ? 1.05 : 1.35;
        for (const jet of this.jets) {
          jet.mesh.position.set(this.position.x, this.position.y + jet.height, this.position.z);
          jet.mesh.rotation.y = jet.angle;
          (jet.mesh.material as THREE.MeshBasicMaterial).opacity = this.stateTime < warn ? 0.18 : 0.85;
          if (this.stateTime >= warn) {
            jet.angle += speed * dt;
            jet.cooldown = Math.max(0, jet.cooldown - dt);
            if (jet.cooldown <= 0 && this.jetHits(jet)) {
              jet.cooldown = 0.7;
              const tangent = new THREE.Vector3(Math.cos(jet.angle), 0, -Math.sin(jet.angle)).multiplyScalar(-8);
              this.host.damagePlayer(16, this.center, tangent.setY(2));
            }
          }
        }
        if (this.stateTime > warn + 5.2) {
          for (const jet of this.jets) jet.mesh.visible = false;
          this.next();
        }
        break;
      }
      case 'bursts':
        this.burstTimer -= dt;
        if (this.burstTimer <= 0 && this.stateTime < 4.2) {
          this.burstTimer = this.phase === 1 ? 0.8 : 0.6;
          const at = this.game.player.position.clone();
          this.bursts.push({ at, timer: 0.9 });
          this.game.combat.telegraphs.circle(at, BURST_RADIUS, 0.9);
        }
        if (this.stateTime > 5) this.next();
        break;
      case 'rings':
        this.waveTimer -= dt;
        if (this.waveTimer <= 0 && this.waves > 0) {
          this.waveTimer = 0.9;
          this.waves--;
          const offset = this.waves * 0.13;
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2 + offset;
            const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
            this.game.combat.projectiles.spawn({ kind: 'orb', pos: this.position.clone().setY(this.position.y + 1.0).addScaledVector(dir, 1.6), vel: dir.multiplyScalar(5.5), radius: 0.25, damage: 10, life: 5 });
          }
          this.game.events.emit('enemyAttack', { type: 'sluicekeeper-rings', position: this.center });
        }
        if (this.waves === 0 && this.waveTimer <= 0) this.next();
        break;
      case 'vent':
        if (this.stateTime < 0.1 || Math.random() < dt * 6) {
          const side = Math.random() < 0.5 ? -1 : 1;
          this.game.effects.burst(this.position.clone().add(new THREE.Vector3(side * 0.9, 2.4, 0)), { count: 6, color: 0xd8dde0, speed: 1.6, size: 0.14, life: 1.2, gravity: -2, spread: 0.3 });
        }
        if (this.stateTime > VENT_TIME) this.next();
        break;
      case 'shutdown':
        if (this.stateTime > 3.5) {
          this.setState('off');
          this.onShutdown?.();
        }
        break;
    }
  }

  /** Is the player inside this jet: in its arc, at its height, and not behind a pillar? */
  private jetHits(jet: Jet): boolean {
    const p = this.game.player;
    const dx = p.position.x - this.position.x;
    const dz = p.position.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.2 || dist > JET_LENGTH + 1.2) return false;
    const off = Math.abs(wrapAngle(Math.atan2(dx, dz) - jet.angle));
    if (off > Math.PI / 2 || dist * Math.sin(off) > 0.55) return false;
    // Overlap in height: jump the low jet, crouch under the high one.
    const feet = p.position.y;
    const top = feet + (p.crouching ? 1.15 : 1.8);
    if (feet > jet.height + 0.2 || top < jet.height - 0.2) return false;
    const from = this.position.clone().setY(jet.height);
    return this.game.physics.lineOfSight(from, p.position.clone().setY(clamp(jet.height, feet + 0.1, top - 0.1)));
  }

  private updateBursts(dt: number): void {
    const player = this.game.player.position;
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i] as Burst;
      burst.timer -= dt;
      if (burst.timer > 0) continue;
      this.bursts.splice(i, 1);
      this.game.effects.burst(burst.at.clone().setY(burst.at.y + 0.1), { count: 26, color: 0xbfefff, speed: 6, size: 0.07, life: 0.8, spread: 0.2 });
      if (Math.hypot(player.x - burst.at.x, player.z - burst.at.z) < BURST_RADIUS && player.y - burst.at.y < 1.5) {
        this.host.damagePlayer(16, burst.at, new THREE.Vector3(0, 7, 0));
      }
    }
  }

  /** Its plating turns most hits aside until it vents. It shuts down rather than dying. */
  override damage(amount: number, from: THREE.Vector3): number {
    if (['dormant', 'wake', 'shutdown', 'off'].includes(this.state)) return 0;
    const dealt = super.damage(amount * (this.vulnerable ? 1 : 0.35), from);
    if (!this.alive) {
      this.alive = true;
      this.health = 0;
      this.vulnerable = false;
      this.bursts.length = 0;
      for (const jet of this.jets) jet.mesh.visible = false;
      this.setState('shutdown');
      this.game.events.emit('enemyAttack', { type: 'sluicekeeper-shutdown', position: this.center });
    }
    return dealt;
  }

  protected override animate(_dt: number, time: number): void {
    const s = this.state;
    const open = s === 'vent' ? Math.min(1, this.stateTime * 4) * (this.stateTime > VENT_TIME - 0.3 ? (VENT_TIME - this.stateTime) / 0.3 : 1) : 0;
    this.panels.forEach((hinge, i) => (hinge.rotation.y = (i === 0 ? -1 : 1) * open * 1.6));
    this.cores.emissiveIntensity = 0.5 + open * 4 + (open > 0 ? Math.sin(time * 10) * 0.6 : 0);
    const awake = s !== 'dormant' && s !== 'off';
    const powering = s === 'wake' ? Math.min(1, this.stateTime / 2) : s === 'shutdown' ? Math.max(0, 1 - this.stateTime / 3) : awake ? 1 : 0;
    this.lens.emissiveIntensity = 0.2 + powering * (s === 'vent' ? 1 : 4);
    this.crystals.emissiveIntensity = 0.5 + powering * 0.6;
    this.torso.position.y = 0.8 - (1 - powering) * 0.25;
    this.head.rotation.x = (1 - powering) * 0.45;
    if (awake && s !== 'shutdown') {
      const target = Math.atan2(this.game.player.position.x - this.position.x, this.game.player.position.z - this.position.z);
      this.yaw = wrapAngle(this.yaw + wrapAngle(target - this.yaw) * 0.04);
    }
    if (s === 'jets') this.torso.rotation.y = wrapAngle((this.jets[0]?.angle ?? 0) - Math.PI / 2 - this.yaw);
    else this.torso.rotation.y *= 0.9;
  }

  override dispose(): void {
    for (const jet of this.jets) {
      jet.mesh.removeFromParent();
      jet.mesh.geometry.dispose();
    }
    this.jetMaterial.dispose();
    super.dispose();
  }
}
