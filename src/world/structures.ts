import * as THREE from 'three';
import type { LevelKit, V3 } from './level-kit';
import { beam, offset, pipe } from './props';

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

/** The big timber headframe over the main lift, with its sheave wheel: Bellwether's landmark. */
export function headframe(kit: LevelKit, cage: V3, yaw: number, rimDistance: number): THREE.Group {
  const top = 13.2;
  const P = (dx: number, dy: number, dz: number): V3 => offset(cage, yaw, dx, dy, dz);
  const along = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const sides: { foot: V3; head: V3; stayFoot: V3; stayHead: V3 }[] = [];
  for (const side of [-1, 1]) {
    // A front post leaning out over the shaft, and a back stay, both footed in stone on the plaza.
    const foot = P(side * 3.0, 0, -rimDistance - 2.4);
    const head = P(side * 1.55, top, -0.25);
    const stayFoot = P(side * 3.3, 0, -rimDistance - 8.8);
    const stayHead = P(side * 1.7, top - 0.5, -1.15);
    sides.push({ foot, head, stayFoot, stayHead });
    beam(kit, foot, head, 0.34, 'wood_dark');
    beam(kit, stayFoot, stayHead, 0.3, 'wood_dark');
    for (const f of [foot, stayFoot]) kit.box({ at: [f[0], 0.4, f[2]], size: [1.15, 0.8, 1.15], mat: 'stone_wall', bevel: 0.05 });
    // Walers tie post to stay, with an X of bracing in each panel.
    const levels = [0.08, 0.36, 0.64, 0.9];
    for (const t of levels) beam(kit, along(foot, head, t), along(stayFoot, stayHead, t), 0.2, 'wood_dark');
    for (let k = 0; k < levels.length - 1; k++) {
      const t0 = levels[k] as number;
      const t1 = levels[k + 1] as number;
      beam(kit, along(foot, head, t0), along(stayFoot, stayHead, t1), 0.14, 'wood_dark');
      beam(kit, along(stayFoot, stayHead, t0), along(foot, head, t1), 0.14, 'wood_dark');
    }
    // Iron straps at the joints.
    for (const t of levels) {
      const j = along(foot, head, t);
      kit.box({ at: j, size: [0.4, 0.08, 0.4], mat: 'metal', rotY: yaw, collide: false, shadow: false });
    }
  }
  const [l, r] = sides as [typeof sides[0], typeof sides[0]];
  // Cross-members between the two sides, braced, so the frame reads as one structure.
  for (const t of [0.36, 0.64, 0.9]) beam(kit, along(l.foot, l.head, t), along(r.foot, r.head, t), 0.22, 'wood_dark');
  for (const t of [0.36, 0.64]) beam(kit, along(l.stayFoot, l.stayHead, t), along(r.stayFoot, r.stayHead, t), 0.2, 'wood_dark');
  beam(kit, along(l.foot, l.head, 0.36), along(r.foot, r.head, 0.64), 0.14, 'wood_dark');
  beam(kit, along(r.foot, r.head, 0.36), along(l.foot, l.head, 0.64), 0.14, 'wood_dark');
  // The head: a deck with a rail, the sheave's bearing blocks, and a lamp you can see from anywhere.
  kit.box({ at: P(0, top + 0.1, -0.7), size: [4.2, 0.24, 2.4], mat: 'wood', rotY: yaw, collide: false });
  for (const dz of [-1.85, 0.45]) kit.box({ at: P(0, top + 0.75, dz), size: [4.2, 0.07, 0.07], mat: 'wood_dark', rotY: yaw, collide: false, shadow: false });
  for (const dx of [-2, -0.7, 0.7, 2]) for (const dz of [-1.85, 0.45]) beam(kit, P(dx, top + 0.2, dz), P(dx, top + 0.8, dz), 0.07, 'wood_dark');
  for (const side of [-1, 1]) kit.box({ at: P(side * 0.55, top + 0.75, 0), size: [0.25, 1.1, 0.5], mat: 'metal', rotY: yaw, collide: false });
  kit.box({ at: P(-1.6, top + 1.1, -1.7), size: [0.3, 0.42, 0.3], mat: 'lamp', rotY: yaw, collide: false, shadow: false });
  kit.pointLight({ at: P(-1.6, top + 1.1, -1.5), color: 0xffb064, intensity: 9, distance: 16, bulb: false });
  // A ladder up the back stay, for whoever greases the sheave.
  const lf = P(-3.3, 0, -rimDistance - 8.8);
  for (const s of [-0.25, 0.25]) beam(kit, [lf[0] + s, 0, lf[2] + 0.3], [sides[0]!.stayHead[0] + s * 0.6, sides[0]!.stayHead[1] - 0.3, sides[0]!.stayHead[2] + 0.3], 0.06, 'wood_dark');
  // The sheave spins while the lift moves, so it stays a separate mesh.
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.1, 10, 40), kit.materials.get('rust'));
  wheel.add(rim);
  const groove = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.05, 8, 40), kit.materials.get('metal'));
  wheel.add(groove);
  for (let i = 0; i < 8; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.8, 0.06), kit.materials.get('metal'));
    spoke.rotation.z = (i / 8) * Math.PI;
    wheel.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 16), kit.materials.get('rust'));
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  const p = P(0, top + 1.45, 0);
  wheel.position.set(p[0], p[1], p[2]);
  wheel.rotation.y = yaw + Math.PI / 2;
  wheel.traverse((o) => {
    o.castShadow = true;
  });
  kit.materials.fit(wheel);
  kit.add(wheel);
  // Cables: down into the cage, and back to the winding house.
  for (const s of [-0.12, 0.12]) {
    pipe(kit, P(s, top + 1.45 - 1.4, 1.42), P(s, 2.9, 1.42), 0.025, 'metal');
    pipe(kit, P(s, top + 1.45 - 1.4, -1.42), P(s, 2.2, -rimDistance - 12.2), 0.025, 'metal');
  }
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
