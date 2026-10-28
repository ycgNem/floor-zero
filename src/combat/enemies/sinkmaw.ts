import * as THREE from 'three';
import { Enemy, type EnemyHost } from '../enemy';

const TUNNEL_SPEED = 5.5;
const ERUPT_RADIUS = 1.6;
const BURIED = new Set(['idle', 'tunnel', 'surface', 'sink']);

/** Tunnels toward where you stand and erupts underneath. Then it's stuck and exposed: punish it. */
export class Sinkmaw extends Enemy {
  readonly type = 'sinkmaw';
  readonly displayName = 'Sinkmaw';
  private readonly body = new THREE.Group();
  private readonly mound: THREE.Mesh;
  private readonly teeth: THREE.Mesh[] = [];
  private readonly target = new THREE.Vector3();
  private hitPlayer = false;

  constructor(host: EnemyHost, id: string, pos: THREE.Vector3, yaw: number) {
    super(host, id, pos, yaw, 50, 0.55, 1.2, [{ item: 'dim_core', chance: 0.8 }, { item: 'glowcap', chance: 0.3 }], true);
    const flesh = this.mat(0x5a3a3a, { roughness: 0.6 });
    const ridges = this.mat(0x3a2a24, { roughness: 0.8 });
    const tooth = this.mat(0xd8cfb8, { roughness: 0.4 });
    const gullet = this.mat(0x200808, { emissive: 0xff5a3a, emissiveIntensity: 1.2 });
    this.group.add(this.body);
    this.part(new THREE.CylinderGeometry(0.42, 0.55, 1.3, 12), flesh, 0, 0.65, 0, this.body);
    for (let i = 0; i < 4; i++) this.part(new THREE.TorusGeometry(0.5 - i * 0.03, 0.06, 6, 16), ridges, 0, 0.2 + i * 0.3, 0, this.body).rotation.x = Math.PI / 2;
    this.part(new THREE.CircleGeometry(0.34, 16), gullet, 0, 1.31, 0, this.body).rotation.x = -Math.PI / 2;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const t = this.part(new THREE.ConeGeometry(0.05, 0.22, 5), tooth, Math.cos(a) * 0.36, 1.38, Math.sin(a) * 0.36, this.body);
      t.rotation.set(Math.sin(a) * -0.5, 0, Math.cos(a) * 0.5);
      this.teeth.push(t);
    }
    // While it's under, all you see is the ground heaving.
    this.mound = this.part(new THREE.SphereGeometry(0.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), ridges, 0, 0, 0);
    this.mound.scale.set(1, 0.35, 1.3);
    this.body.position.y = -1.6;
  }

  get burrowed(): boolean {
    return BURIED.has(this.state);
  }

  override get solid(): boolean {
    return !this.burrowed;
  }

  override hitTest(point: THREE.Vector3, radius: number): boolean {
    return !this.burrowed && super.hitTest(point, radius);
  }

  think(dt: number): void {
    const player = this.game.player.position;
    if (!this.aggro && this.distanceToPlayer() < 14) this.aggro = true;
    this.vulnerable = this.state === 'stuck';

    switch (this.state) {
      case 'idle':
        this.move(new THREE.Vector3(), 0, dt);
        if (this.aggro) this.setState('tunnel');
        break;
      case 'tunnel': {
        this.target.copy(player);
        const to = this.target.clone().sub(this.position).setY(0);
        const d = to.length();
        if (d > 0.3) this.move(to.normalize(), TUNNEL_SPEED, dt);
        if ((d < 0.6 || this.stateTime > 3.5) && this.stateTime > 1) {
          this.game.combat.telegraphs.circle(this.position, ERUPT_RADIUS, 0.75);
          this.setState('surface');
        }
        break;
      }
      case 'surface':
        this.move(new THREE.Vector3(), 0, dt);
        if (this.stateTime > 0.75) {
          this.hitPlayer = false;
          this.setState('erupt');
          this.game.events.emit('slam', { position: this.position.clone() });
          this.game.effects.burst(this.position.clone().setY(0.2), { count: 22, color: 0x5b4a3b, speed: 5, size: 0.08, life: 0.8 });
        }
        break;
      case 'erupt':
        if (!this.hitPlayer && Math.hypot(player.x - this.position.x, player.z - this.position.z) < ERUPT_RADIUS && player.y - this.position.y < 1.2) {
          this.hitPlayer = true;
          this.host.damagePlayer(18, this.center, new THREE.Vector3(0, 6, 0));
        }
        if (this.stateTime > 0.35) this.setState('stuck');
        break;
      case 'stuck':
        if (this.stateTime > 2.2) this.setState('sink');
        break;
      case 'sink':
        if (this.stateTime > 0.5) this.setState('tunnel');
        break;
    }
  }

  protected override animate(dt: number, time: number): void {
    const s = this.state;
    const up = s === 'erupt' || s === 'stuck' ? 0 : s === 'sink' ? -1.6 * Math.min(1, this.stateTime / 0.5) : -1.6;
    this.body.position.y += (up - this.body.position.y) * Math.min(1, dt * (s === 'erupt' ? 30 : 8));
    this.body.rotation.z = s === 'stuck' ? Math.sin(time * 3) * 0.12 : 0;
    this.mound.visible = this.burrowed;
    const heave = s === 'surface' ? 0.55 + Math.sin(time * 40) * 0.08 : s === 'tunnel' ? 0.35 + Math.sin(time * 14) * 0.05 : 0.25;
    this.mound.scale.set(1, heave, 1.3);
    for (const [i, t] of this.teeth.entries()) t.rotation.y = s === 'stuck' ? Math.sin(time * 8 + i) * 0.2 : 0;
  }
}
