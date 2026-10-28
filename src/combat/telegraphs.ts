import * as THREE from 'three';

/** The single colour language for danger. Never used for anything friendly. */
export const DANGER = 0xff3d9a;

interface Decal {
  group: THREE.Group;
  fill: THREE.Mesh;
  time: number;
  duration: number;
  kind: 'circle' | 'line';
}

/** Ground warnings that fill up before an attack lands. Shape and timing, not just colour. */
export class Telegraphs {
  private readonly root = new THREE.Group();
  private readonly decals: Decal[] = [];
  private readonly outline = new THREE.MeshBasicMaterial({ color: DANGER, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  private readonly fillMat = new THREE.MeshBasicMaterial({ color: DANGER, transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });

  constructor(scene: THREE.Scene) {
    this.root.renderOrder = 5;
    scene.add(this.root);
  }

  circle(center: THREE.Vector3, radius: number, duration: number): void {
    const group = new THREE.Group();
    group.position.set(center.x, center.y + 0.04, center.z);
    group.rotation.x = -Math.PI / 2;
    group.add(new THREE.Mesh(new THREE.RingGeometry(radius * 0.94, radius, 40), this.outline));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), this.fillMat);
    fill.scale.setScalar(0.01);
    group.add(fill);
    this.add(group, fill, duration, 'circle');
  }

  /** A charge lane from `from` toward `to`. */
  line(from: THREE.Vector3, to: THREE.Vector3, width: number, duration: number): void {
    const dir = to.clone().sub(from).setY(0);
    const length = dir.length();
    const group = new THREE.Group();
    group.position.set(from.x, from.y + 0.04, from.z);
    group.rotation.y = Math.atan2(dir.x, dir.z);
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.86, length), this.fillMat);
    fill.rotation.x = -Math.PI / 2;
    fill.position.z = length / 2;
    fill.scale.y = 0.01;
    group.add(this.edges(width, length), fill);
    this.add(group, fill, duration, 'line');
  }

  private edges(width: number, length: number): THREE.Group {
    const g = new THREE.Group();
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.08, length), this.outline);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set((side * width) / 2, 0, length / 2);
      g.add(edge);
    }
    return g;
  }

  private add(group: THREE.Group, fill: THREE.Mesh, duration: number, kind: Decal['kind']): void {
    this.root.add(group);
    this.decals.push({ group, fill, time: 0, duration, kind });
  }

  clear(): void {
    for (const d of this.decals) this.dispose(d);
    this.decals.length = 0;
  }

  update(dt: number): void {
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      if (!d) continue;
      d.time += dt;
      const t = Math.min(1, d.time / d.duration);
      if (d.kind === 'circle') d.fill.scale.setScalar(Math.max(0.01, t));
      else {
        d.fill.scale.y = Math.max(0.01, t);
        d.fill.position.z = ((d.fill.geometry as THREE.PlaneGeometry).parameters.height * t) / 2;
      }
      if (d.time >= d.duration + 0.08) {
        this.dispose(d);
        this.decals.splice(i, 1);
      }
    }
  }

  private dispose(d: Decal): void {
    d.group.removeFromParent();
    d.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}
