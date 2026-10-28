import * as THREE from 'three';
import { createRippleNormalTexture } from '../render/textures';
import type { LevelKit, V3 } from './level-kit';

/**
 * Glowworms: thousands of tiny blue-green lights hanging from a cave ceiling. One draw call.
 * `area` is the rectangle they cover, as [x0, z0, x1, z1].
 */
export function glowworms(kit: LevelKit, area: readonly [number, number, number, number], y: number, count: number): THREE.InstancedMesh {
  const [x0, z0, x1, z1] = area;
  const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.5, 1.4), toneMapped: false });
  const worms = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.018, 0), material, count);
  const matrix = new THREE.Matrix4();
  let seed = 97;
  const rnd = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < count; i++) {
    const s = 0.5 + rnd() * 1.2;
    matrix.makeScale(s, s * 2.5, s).setPosition(x0 + rnd() * (x1 - x0), y - rnd() * rnd() * 2.5, z0 + rnd() * (z1 - z0));
    worms.setMatrixAt(i, matrix);
  }
  worms.userData.ownedMaterial = material;
  kit.add(worms);
  return worms;
}

export interface Pool {
  /** The water surface, for anything that raises or lowers it. */
  surface: THREE.Mesh;
  /** Per-frame animation: drifting ripples, gliding eels, floating motes. */
  frame(dt: number, time: number): void;
  dispose(): void;
}

interface Eel {
  mesh: THREE.Mesh;
  ax: number;
  az: number;
  speed: number;
  phase: number;
  depth: number;
}

/**
 * A still underground pool: a dark glassy surface with drifting ripple normals, lantern eels
 * gliding underneath, and motes hanging over the water.
 */
export function pool(kit: LevelKit, o: { center: V3; size: readonly [number, number]; eels?: number; motes?: number }): Pool {
  const [cx, cy, cz] = o.center;
  const [w, d] = o.size;

  const normal = createRippleNormalTexture(11);
  normal.wrapS = THREE.RepeatWrapping;
  normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(w / 5, d / 5);
  const surfaceMat = new THREE.MeshStandardMaterial({
    color: 0x0a1c24,
    roughness: 0.08,
    metalness: 0.3,
    normalMap: normal,
    normalScale: new THREE.Vector2(0.45, 0.45),
    transparent: true,
    opacity: 0.74,
    depthWrite: false,
  });
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(w, d), surfaceMat);
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(cx, cy, cz);
  surface.receiveShadow = true;
  surface.renderOrder = 1;
  kit.add(surface);

  // Lantern eels: soft glowing shapes under the surface, the pool's namesake.
  const eelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.2, 2.6), toneMapped: false });
  const eelGeo = new THREE.CapsuleGeometry(0.035, 0.46, 3, 6);
  eelGeo.rotateX(Math.PI / 2);
  const eels: Eel[] = [];
  let seed = 31;
  const rnd = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < (o.eels ?? 6); i++) {
    const mesh = new THREE.Mesh(eelGeo, eelMat);
    kit.add(mesh);
    eels.push({ mesh, ax: (w / 2 - 1.2) * (0.4 + rnd() * 0.6), az: (d / 2 - 1.2) * (0.4 + rnd() * 0.6), speed: 0.08 + rnd() * 0.1, phase: rnd() * 10, depth: 0.5 + rnd() * 0.7 });
  }

  // Motes drifting over the water.
  const moteCount = o.motes ?? 40;
  const moteMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.8, 0.9), toneMapped: false });
  const motes = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.022, 0), moteMat, moteCount);
  motes.frustumCulled = false;
  const moteBase = Array.from({ length: moteCount }, () => ({
    pos: new THREE.Vector3(cx + (rnd() - 0.5) * w, cy + 0.4 + rnd() * 2.6, cz + (rnd() - 0.5) * d),
    phase: rnd() * Math.PI * 2,
  }));
  kit.add(motes);
  const matrix = new THREE.Matrix4();
  const spot = new THREE.Vector3();

  return {
    surface,
    frame(_dt, time) {
      normal.offset.set(time * 0.012, time * 0.007);

      for (const eel of eels) {
        const t = time * eel.speed + eel.phase;
        const x = cx + eel.ax * Math.sin(t);
        const z = cz + eel.az * Math.sin(t * 0.7 + eel.phase * 1.3);
        const vx = eel.ax * Math.cos(t);
        const vz = eel.az * 0.7 * Math.cos(t * 0.7 + eel.phase * 1.3);
        eel.mesh.position.set(x, cy - eel.depth + Math.sin(time * 1.7 + eel.phase) * 0.05, z);
        eel.mesh.rotation.set(0, Math.atan2(vx, vz) + Math.sin(time * 6 + eel.phase) * 0.15, 0);
      }

      for (let i = 0; i < moteCount; i++) {
        const m = moteBase[i] as (typeof moteBase)[number];
        spot.set(
          m.pos.x + Math.sin(time * 0.3 + m.phase) * 0.6,
          m.pos.y + Math.sin(time * 0.5 + m.phase * 2) * 0.25,
          m.pos.z + Math.cos(time * 0.27 + m.phase) * 0.6,
        );
        const s = 0.6 + 0.5 * (0.5 + 0.5 * Math.sin(time * 2.1 + m.phase * 3));
        matrix.makeScale(s, s, s).setPosition(spot);
        motes.setMatrixAt(i, matrix);
      }
      motes.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      normal.dispose();
      surfaceMat.dispose();
      eelMat.dispose();
      moteMat.dispose();
    },
  };
}
