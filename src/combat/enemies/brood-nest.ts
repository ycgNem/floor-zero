import * as THREE from 'three';
import { Enemy, type EnemyHost } from '../enemy';

/** A Sinkmaw brood clogging the pump intake. It doesn't fight back; its brood does. */
export class BroodNest extends Enemy {
  readonly type = 'brood_nest';
  readonly displayName = 'Sinkmaw brood';
  private readonly pods: THREE.Mesh[] = [];
  private readonly glow: THREE.MeshStandardMaterial;

  constructor(host: EnemyHost, id: string, pos: THREE.Vector3, yaw: number) {
    super(host, id, pos, yaw, 90, 1.1, 1.3, [{ item: 'dim_core', chance: 1, count: 3 }], false);
    const flesh = this.mat(0x4a2e2e, { roughness: 0.55 });
    this.glow = this.mat(0x301008, { emissive: 0xff6a3a, emissiveIntensity: 1.4, roughness: 0.3 });
    const mound = this.part(new THREE.SphereGeometry(1.1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), flesh, 0, 0, 0);
    mound.scale.set(1, 0.7, 1);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + (i % 2) * 0.3;
      const r = 0.45 + (i % 3) * 0.18;
      const pod = this.part(new THREE.SphereGeometry(0.16 + (i % 2) * 0.06, 10, 8), this.glow, Math.cos(a) * r, 0.45 + (i % 3) * 0.12, Math.sin(a) * r);
      this.pods.push(pod);
    }
  }

  think(): void {
    if (!this.aggro && this.distanceToPlayer() < 10) this.aggro = true;
  }

  protected override animate(_dt: number, time: number): void {
    for (const [i, pod] of this.pods.entries()) pod.scale.setScalar(1 + Math.sin(time * 2.4 + i * 1.7) * 0.12);
    this.glow.emissiveIntensity = 1.2 + Math.sin(time * 1.8) * 0.5;
  }
}
