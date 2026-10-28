import * as THREE from 'three';
import { Enemy, type EnemyHost } from '../enemy';

/** Small biting crawlers in packs. They teach aiming and getting out of a surround. */
export class Scuttler extends Enemy {
  readonly type = 'scuttler';
  readonly displayName = 'Scuttler';
  private readonly legs: THREE.Mesh[] = [];
  private readonly body: THREE.Group;
  private lungeDir = new THREE.Vector3();
  private bit = false;
  private wanderPhase = Math.random() * 10;

  constructor(host: EnemyHost, id: string, pos: THREE.Vector3, yaw: number) {
    super(host, id, pos, yaw, 22, 0.4, 0.5, [{ item: 'dim_core', chance: 0.7 }], true);
    const shell = this.mat(0x4a2a22, { roughness: 0.45, metalness: 0.2 });
    const belly = this.mat(0x2a1a16);
    const eye = this.mat(0x000000, { emissive: 0xff8a3a, emissiveIntensity: 3 });
    this.body = new THREE.Group();
    this.body.position.y = 0.28;
    this.group.add(this.body);
    const carapace = this.part(new THREE.SphereGeometry(1, 16, 10), shell, 0, 0.02, 0, this.body);
    carapace.scale.set(0.34, 0.16, 0.44);
    const under = this.part(new THREE.SphereGeometry(1, 12, 8), belly, 0, -0.04, 0, this.body);
    under.scale.set(0.3, 0.1, 0.38);
    for (const side of [-0.08, 0.08]) this.part(new THREE.SphereGeometry(0.035, 8, 6), eye, side, 0.06, 0.38, this.body);
    for (const side of [-1, 1]) {
      const pincer = this.part(new THREE.ConeGeometry(0.05, 0.22, 6), shell, side * 0.14, -0.02, 0.48, this.body);
      pincer.rotation.x = Math.PI / 2;
      for (let i = 0; i < 3; i++) {
        const leg = this.part(new THREE.CylinderGeometry(0.018, 0.012, 0.34, 5), belly, side * 0.3, -0.12, -0.18 + i * 0.18, this.body);
        leg.rotation.z = side * 1.0;
        this.legs.push(leg);
      }
    }
  }

  think(dt: number): void {
    const player = this.game.player.position;
    const toPlayer = player.clone().sub(this.position).setY(0);
    const dist = toPlayer.length();
    if (!this.aggro && this.canSeePlayer(12)) this.aggro = true;

    switch (this.state) {
      case 'idle': {
        this.wanderPhase += dt;
        this.move(new THREE.Vector3(Math.sin(this.wanderPhase * 0.7), 0, Math.cos(this.wanderPhase * 0.5)), 0.4, dt);
        if (this.aggro) this.setState('chase');
        break;
      }
      case 'chase': {
        this.face(player, 8, dt);
        if (dist > 1.7) this.move(toPlayer.normalize(), 4.2, dt);
        else this.move(new THREE.Vector3(), 0, dt);
        if (dist < 2.6 && this.host.requestToken(this)) this.setState('windup');
        break;
      }
      case 'windup': {
        this.face(player, 10, dt);
        this.move(new THREE.Vector3(), 0, dt);
        if (this.stateTime > 0.42) {
          this.lungeDir.copy(toPlayer).normalize();
          this.bit = false;
          this.setState('lunge');
        }
        break;
      }
      case 'lunge': {
        this.move(this.lungeDir, 9, dt);
        if (!this.bit && this.position.distanceTo(player) < 1.05) {
          this.bit = true;
          this.host.damagePlayer(8, this.center);
        }
        if (this.stateTime > 0.24) this.setState('recover');
        break;
      }
      case 'recover': {
        this.move(new THREE.Vector3(), 0, dt);
        if (this.stateTime > 0.65) {
          this.host.releaseToken(this);
          this.setState('chase');
        }
        break;
      }
    }
  }

  protected override animate(_dt: number, time: number): void {
    const moving = this.state === 'chase' || this.state === 'lunge' || this.state === 'idle';
    this.legs.forEach((leg, i) => {
      leg.rotation.x = moving ? Math.sin(time * 18 + i * 1.7) * 0.5 : 0;
    });
    this.body.position.y = 0.28 + (this.state === 'windup' ? -0.08 : Math.sin(time * 20) * 0.01);
    this.body.rotation.x = this.state === 'windup' ? 0.25 : this.state === 'lunge' ? -0.2 : 0;
  }
}
