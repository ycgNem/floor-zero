import * as THREE from 'three';

const MAX = 600;

interface Particle {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
}

export interface BurstOptions {
  count: number;
  color: number;
  speed?: number;
  size?: number;
  life?: number;
  gravity?: number;
  /** Bias the burst upward (0) or keep it spherical (1). */
  spread?: number;
  emissive?: boolean;
}

/** Pooled particle bursts: debris, sparks, motes. One draw call per material. */
export class Effects {
  private readonly lit: THREE.InstancedMesh;
  private readonly glow: THREE.InstancedMesh;
  private readonly litParticles: Particle[] = [];
  private readonly glowParticles: Particle[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly color = new THREE.Color();
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.lit = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), MAX);
    this.glow = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.6, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), MAX);
    for (const [mesh, list] of [[this.lit, this.litParticles], [this.glow, this.glowParticles]] as const) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < MAX; i++) {
        mesh.setMatrixAt(i, this.hidden);
        mesh.setColorAt(i, new THREE.Color(1, 1, 1));
        list.push({ alive: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, maxLife: 1, size: 0.05, gravity: 9 });
      }
      scene.add(mesh);
    }
  }

  burst(at: THREE.Vector3, o: BurstOptions): void {
    const mesh = o.emissive ? this.glow : this.lit;
    const list = o.emissive ? this.glowParticles : this.litParticles;
    const speed = o.speed ?? 3;
    const spread = o.spread ?? 0.6;
    let spawned = 0;
    for (let i = 0; i < list.length && spawned < o.count; i++) {
      const p = list[i];
      if (!p || p.alive) continue;
      p.alive = true;
      p.pos.copy(at);
      p.vel.set(Math.random() - 0.5, Math.random() * (1 - spread) + (Math.random() - 0.5) * spread, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      p.life = p.maxLife = (o.life ?? 0.7) * (0.6 + Math.random() * 0.8);
      p.size = (o.size ?? 0.06) * (0.6 + Math.random() * 0.8);
      p.gravity = o.gravity ?? 9;
      mesh.setColorAt(i, this.color.setHex(o.color));
      spawned++;
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    for (const [mesh, list] of [[this.lit, this.litParticles], [this.glow, this.glowParticles]] as const) {
      let any = false;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (!p || !p.alive) continue;
        any = true;
        p.life -= dt;
        if (p.life <= 0) {
          p.alive = false;
          mesh.setMatrixAt(i, this.hidden);
          continue;
        }
        p.vel.y -= p.gravity * dt;
        p.pos.addScaledVector(p.vel, dt);
        const s = p.size * Math.min(1, (p.life / p.maxLife) * 2);
        this.matrix.makeScale(s, s, s).setPosition(p.pos);
        mesh.setMatrixAt(i, this.matrix);
      }
      if (any) mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
