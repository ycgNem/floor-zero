import * as THREE from 'three';
import type { LevelKit, V3 } from './level-kit';
import { offset, pipe } from './props';

/**
 * A lift cage: metal floor, bars on three sides, roof, and cables running up.
 * `yaw` is the direction the open side faces.
 */
export function liftCage(kit: LevelKit, at: V3, yaw: number, cableHeight = 30): void {
  const size = 3.2;
  const half = size / 2;
  // Sits 2 cm proud of the floor so the two surfaces never fight.
  kit.box({ at: [at[0], at[1] - 0.1, at[2]], size: [size, 0.24, size], mat: 'metal', rotY: yaw });
  kit.box({ at: [at[0], at[1] + 2.75, at[2]], size: [size + 0.1, 0.12, size + 0.1], mat: 'rust', rotY: yaw, collide: false });
  // Bars on the back and both sides; the front (local +Z) stays open.
  for (let i = 0; i <= 8; i++) {
    const t = -half + (size * i) / 8;
    kit.box({ at: offset(at, yaw, t, 1.35, -half), size: [0.05, 2.7, 0.05], mat: 'metal', rotY: yaw, collide: false });
    kit.box({ at: offset(at, yaw, -half, 1.35, t), size: [0.05, 2.7, 0.05], mat: 'metal', rotY: yaw, collide: false });
    kit.box({ at: offset(at, yaw, half, 1.35, t), size: [0.05, 2.7, 0.05], mat: 'metal', rotY: yaw, collide: false });
  }
  for (const y of [0.05, 1.1, 2.65]) {
    kit.box({ at: offset(at, yaw, 0, y, -half), size: [size, 0.08, 0.08], mat: 'rust', rotY: yaw, collide: false });
    kit.box({ at: offset(at, yaw, -half, y, 0), size: [0.08, 0.08, size], mat: 'rust', rotY: yaw, collide: false });
    kit.box({ at: offset(at, yaw, half, y, 0), size: [0.08, 0.08, size], mat: 'rust', rotY: yaw, collide: false });
  }
  kit.blocker(offset(at, yaw, 0, 1.4, -half), [size, 2.8, 0.1], yaw);
  kit.blocker(offset(at, yaw, -half, 1.4, 0), [0.1, 2.8, size], yaw);
  kit.blocker(offset(at, yaw, half, 1.4, 0), [0.1, 2.8, size], yaw);
  for (const side of [-0.6, 0.6]) {
    const base = offset(at, yaw, side, 2.8, 0);
    pipe(kit, base, [base[0], base[1] + cableHeight, base[2]], 0.025, 'metal');
  }
  kit.box({ at: offset(at, yaw, half - 0.25, 1.1, half - 0.1), size: [0.25, 0.4, 0.15], mat: 'rust', rotY: yaw, collide: false });
  kit.box({ at: offset(at, yaw, half - 0.25, 1.15, half - 0.02), size: [0.08, 0.08, 0.06], mat: 'lamp', rotY: yaw, collide: false, shadow: false });
}

/** The big timber headframe over the main lift, with its sheave wheel. */
export function headframe(kit: LevelKit, cage: V3, yaw: number, rimDistance: number): THREE.Group {
  const top = 13;
  for (const side of [-1, 1]) {
    const foot = offset(cage, yaw, side * 3.2, 0, -rimDistance - 2.6);
    const head = offset(cage, yaw, side * 1.5, top, 0);
    pipe(kit, foot, head, 0.22, 'wood_dark');
    kit.box({ at: [foot[0], foot[1] + 0.4, foot[2]], size: [1, 0.8, 1], mat: 'stone_wall', bevel: 0.05 });
    const brace = offset(cage, yaw, side * 3.4, 0, -rimDistance - 6.5);
    pipe(kit, brace, offset(cage, yaw, side * 2.2, top * 0.7, -rimDistance * 0.3), 0.16, 'wood_dark');
  }
  kit.box({ at: offset(cage, yaw, 0, top, 0), size: [4, 0.45, 0.6], mat: 'wood_dark', rotY: yaw, collide: false });
  kit.box({ at: offset(cage, yaw, 0, top * 0.55, -rimDistance - 1.2), size: [6, 0.35, 0.4], mat: 'wood_dark', rotY: yaw, collide: false });
  // The sheave spins while the lift moves, so it stays a separate mesh.
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.09, 8, 28), kit.materials.get('rust'));
  wheel.add(rim);
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.5, 0.06), kit.materials.get('metal'));
    spoke.rotation.z = (i / 6) * Math.PI;
    wheel.add(spoke);
  }
  const p = offset(cage, yaw, 0, top + 1.3, 0);
  wheel.position.set(p[0], p[1], p[2]);
  wheel.rotation.y = yaw + Math.PI / 2;
  wheel.traverse((o) => {
    o.castShadow = true;
  });
  kit.add(wheel);
  return wheel;
}

/** An open market stall: counter, posts, striped canvas roof. */
export function marketStall(kit: LevelKit, at: V3, yaw: number): void {
  kit.box({ at: offset(at, yaw, 0, 0.5, 0), size: [2.6, 1, 0.8], mat: 'wood', rotY: yaw, bevel: 0.02 });
  for (const [dx, dz] of [[-1.3, -0.5], [1.3, -0.5], [-1.3, -1.9], [1.3, -1.9]] as const) {
    kit.box({ at: offset(at, yaw, dx, 1.3, dz), size: [0.1, 2.6, 0.1], mat: 'wood_dark', rotY: yaw, collide: false });
  }
  kit.box({ at: offset(at, yaw, 0, 2.7, -1.1), size: [3, 0.05, 2.2], mat: 'canvas', rotY: yaw, rotX: 0.18, collide: false });
  for (const dx of [-0.8, 0, 0.8]) kit.box({ at: offset(at, yaw, dx, 1.08, 0), size: [0.5, 0.16, 0.4], mat: 'crack', rotY: yaw, collide: false });
}
