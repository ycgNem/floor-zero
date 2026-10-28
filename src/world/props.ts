import * as THREE from 'three';
import { randRange, type Rng } from '../core/rng';
import { lightCone } from '../render/atmosphere';
import type { LevelKit, V3 } from './level-kit';
import type { MaterialKey } from './materials';

/** A point offset from `at` in a frame rotated by `yaw` around Y. */
export function offset(at: V3, yaw: number, dx: number, dy: number, dz: number): V3 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [at[0] + dx * c + dz * s, at[1] + dy, at[2] - dx * s + dz * c];
}

export function polar(angleDeg: number, radius: number, y = 0): V3 {
  const a = (angleDeg * Math.PI) / 180;
  return [Math.sin(a) * radius, y, -Math.cos(a) * radius];
}

/** Yaw that makes a prop's local +Z face toward the origin from a polar angle. */
export function faceCenter(angleDeg: number): number {
  return -(angleDeg * Math.PI) / 180;
}

/**
 * A six-sided iron lantern: a peaked cap with a ring to hang it by, glowing panes in a frame,
 * and a base with a drip finial. `cone` is how far its glow hangs down through the dusty air.
 */
function lanternHead(kit: LevelKit, at: V3, intensity: number, color: number, shadow: boolean, cone: number): THREE.PointLight {
  const [x, y, z] = at;
  const part = (geometry: THREE.BufferGeometry, mat: MaterialKey, dy: number, rotation?: THREE.Euler): void => {
    kit.geometry(geometry, mat, [x, y + dy, z], rotation, false);
  };
  part(new THREE.ConeGeometry(0.2, 0.16, 6), 'metal', 0.27);
  part(new THREE.CylinderGeometry(0.18, 0.18, 0.035, 6), 'metal', 0.18);
  part(new THREE.TorusGeometry(0.05, 0.012, 6, 14), 'metal', 0.39);
  part(new THREE.CylinderGeometry(0.125, 0.125, 0.3, 6), 'lamp', 0.02);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    kit.box({ at: [x + Math.cos(a) * 0.14, y + 0.02, z + Math.sin(a) * 0.14], size: [0.022, 0.32, 0.022], mat: 'metal', collide: false, shadow: false });
  }
  part(new THREE.CylinderGeometry(0.16, 0.12, 0.05, 6), 'metal', -0.15);
  part(new THREE.ConeGeometry(0.035, 0.08, 6), 'metal', -0.21, new THREE.Euler(Math.PI, 0, 0));
  kit.add(lightCone({ x, y: y - 0.1, z }, cone, cone * 0.55, color));
  return kit.pointLight({ at: [x, y - 0.05, z], intensity, color, distance: 13, shadow, bulb: false });
}

export function lanternPost(kit: LevelKit, at: V3, o: { yaw?: number; height?: number; intensity?: number; color?: number; shadow?: boolean } = {}): THREE.PointLight {
  const yaw = o.yaw ?? 0;
  const h = o.height ?? 2.7;
  kit.box({ at: [at[0], at[1] + 0.12, at[2]], size: [0.34, 0.24, 0.34], mat: 'stone_wall', bevel: 0.03 });
  kit.box({ at: [at[0], at[1] + h / 2, at[2]], size: [0.14, h, 0.14], mat: 'wood_dark' });
  kit.box({ at: offset(at, yaw, 0, h - 0.05, 0.28), size: [0.08, 0.08, 0.62], mat: 'wood_dark', rotY: yaw, collide: false });
  return lanternHead(kit, offset(at, yaw, 0, h - 0.35, 0.52), o.intensity ?? 9, o.color ?? 0xffb064, o.shadow ?? false, h - 0.45);
}

export function wallLantern(kit: LevelKit, at: V3, yaw: number, intensity = 7, shadow = false): THREE.PointLight {
  kit.box({ at, size: [0.06, 0.06, 0.4], mat: 'metal', rotY: yaw, collide: false });
  return lanternHead(kit, offset(at, yaw, 0, -0.3, 0.22), intensity, 0xffb064, shadow, 1.9);
}

export function crate(kit: LevelKit, at: V3, size = 0.9, yaw = 0): void {
  const y = at[1] + size / 2;
  kit.box({ at: [at[0], y, at[2]], size: [size, size, size], mat: 'wood', rotY: yaw, bevel: 0.02 });
  for (const dy of [-0.32, 0.32]) {
    kit.box({ at: [at[0], y + dy * size, at[2]], size: [size + 0.02, 0.07, size + 0.02], mat: 'wood_dark', rotY: yaw, collide: false });
  }
}

export function barrel(kit: LevelKit, at: V3): void {
  kit.cylinder({ at: [at[0], at[1] + 0.45, at[2]], radius: 0.32, radiusTop: 0.29, height: 0.9, mat: 'wood', segments: 14 });
  for (const dy of [0.18, 0.72]) {
    kit.cylinder({ at: [at[0], at[1] + dy, at[2]], radius: 0.335, height: 0.05, mat: 'metal', segments: 14, collide: false });
  }
}

/** Mine timber set: two posts and a cap beam. */
export function supportFrame(kit: LevelKit, at: V3, width: number, height: number, yaw = 0): void {
  for (const side of [-1, 1]) {
    kit.box({ at: offset(at, yaw, side * width / 2, height / 2, 0), size: [0.26, height, 0.26], mat: 'wood_dark', rotY: yaw });
    kit.box({ at: offset(at, yaw, side * (width / 2 - 0.3), height - 0.35, 0), size: [0.5, 0.14, 0.2], mat: 'wood_dark', rotY: yaw, rotZ: side * 0.7, collide: false });
  }
  kit.box({ at: offset(at, yaw, 0, height - 0.15, 0), size: [width + 0.5, 0.3, 0.3], mat: 'wood_dark', rotY: yaw, collide: false });
}

export function rails(kit: LevelKit, from: V3, to: V3): void {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  const mid: V3 = [(from[0] + to[0]) / 2, from[1], (from[2] + to[2]) / 2];
  for (const side of [-0.5, 0.5]) {
    kit.box({ at: offset(mid, yaw, side, 0.13, 0), size: [0.06, 0.08, length], mat: 'metal', rotY: yaw, collide: false });
  }
  for (let d = 0.35; d < length; d += 0.75) {
    kit.box({ at: offset(from, yaw, 0, 0.04, d), size: [1.4, 0.08, 0.2], mat: 'wood_dark', rotY: yaw, collide: false });
  }
}

export function cart(kit: LevelKit, at: V3, yaw = 0, ore: MaterialKey | null = null): void {
  kit.box({ at: offset(at, yaw, 0, 0.7, 0), size: [1.0, 0.62, 1.3], mat: 'rust', rotY: yaw, bevel: 0.04 });
  kit.box({ at: offset(at, yaw, 0, 1.0, 0), size: [0.86, 0.04, 1.16], mat: ore ?? 'wood_dark', rotY: yaw, collide: false });
  for (const [dx, dz] of [[-0.52, -0.42], [0.52, -0.42], [-0.52, 0.42], [0.52, 0.42]] as const) {
    kit.geometry(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 12), 'metal', offset(at, yaw, dx, 0.2, dz), new THREE.Euler(0, yaw, Math.PI / 2, 'YXZ'));
  }
}

/** Scattered fallen rock. Only the bigger pieces collide. */
export function rubble(kit: LevelKit, rng: Rng, at: V3, radius: number, count: number, mat: MaterialKey = 'rock'): void {
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * radius;
    const s = randRange(rng, 0.18, 0.7);
    kit.box({
      at: [at[0] + Math.cos(a) * r, at[1] + s * 0.3, at[2] + Math.sin(a) * r],
      size: [s * randRange(rng, 0.8, 1.5), s, s * randRange(rng, 0.8, 1.4)],
      mat,
      rotY: rng() * Math.PI,
      rotX: randRange(rng, -0.4, 0.4),
      rotZ: randRange(rng, -0.4, 0.4),
      bevel: Math.min(0.06, s * 0.2),
      collide: s > 0.5,
    });
  }
}

export function stalactites(kit: LevelKit, rng: Rng, at: V3, radius: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * radius;
    const h = randRange(rng, 0.4, 1.6);
    kit.geometry(
      new THREE.ConeGeometry(randRange(rng, 0.1, 0.35), h, 6),
      'rock',
      [at[0] + Math.cos(a) * r, at[1] - h / 2, at[2] + Math.sin(a) * r],
      new THREE.Euler(Math.PI, rng() * Math.PI, 0),
      false,
    );
  }
}

export function noticeboard(kit: LevelKit, at: V3, yaw: number): void {
  for (const side of [-0.9, 0.9]) kit.box({ at: offset(at, yaw, side, 1.1, 0), size: [0.12, 2.2, 0.12], mat: 'wood_dark', rotY: yaw });
  kit.box({ at: offset(at, yaw, 0, 1.45, 0), size: [1.8, 1.1, 0.08], mat: 'wood', rotY: yaw, collide: false });
  kit.box({ at: offset(at, yaw, 0, 2.15, 0.05), size: [2.1, 0.08, 0.4], mat: 'roof', rotY: yaw, rotX: -0.2, collide: false });
  const papers: [number, number, number, number][] = [[-0.5, 1.6, 0.4, 0.5], [0.05, 1.5, 0.45, 0.6], [0.55, 1.65, 0.35, 0.4], [-0.2, 1.15, 0.5, 0.3]];
  for (const [dx, dy, w, h] of papers) {
    kit.box({ at: offset(at, yaw, dx, dy, 0.05), size: [w, h, 0.01], mat: 'canvas', rotY: yaw, collide: false, shadow: false });
  }
}

export function bench(kit: LevelKit, at: V3, yaw: number): void {
  kit.box({ at: offset(at, yaw, 0, 0.45, 0), size: [1.6, 0.08, 0.45], mat: 'wood', rotY: yaw, bevel: 0.015 });
  for (const side of [-0.65, 0.65]) kit.box({ at: offset(at, yaw, side, 0.22, 0), size: [0.08, 0.44, 0.4], mat: 'wood_dark', rotY: yaw, collide: false });
}

/** Posts and a top rail, with a single solid collider so nobody falls through. */
export function railing(kit: LevelKit, from: V3, to: V3, mat: MaterialKey = 'wood_dark'): void {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  const mid: V3 = [(from[0] + to[0]) / 2, from[1], (from[2] + to[2]) / 2];
  const posts = Math.max(2, Math.round(length / 1.6) + 1);
  for (let i = 0; i < posts; i++) {
    kit.box({ at: offset(from, yaw, 0, 0.5, (length * i) / (posts - 1)), size: [0.1, 1, 0.1], mat, rotY: yaw, collide: false });
  }
  kit.box({ at: offset(mid, yaw, 0, 1.02, 0), size: [0.09, 0.08, length], mat, rotY: yaw, collide: false });
  kit.box({ at: offset(mid, yaw, 0, 0.55, 0), size: [0.05, 0.05, length], mat, rotY: yaw, collide: false });
  kit.box({ at: offset(mid, yaw, 0, 0.6, 0), size: [0.12, 1.2, length], mat, rotY: yaw, collide: true, shadow: false });
}

export function pipe(kit: LevelKit, from: V3, to: V3, radius = 0.12, mat: MaterialKey = 'rust'): void {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const length = dir.length();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const mid = a.add(b).multiplyScalar(0.5);
  kit.geometry(new THREE.CylinderGeometry(radius, radius, length, 10), mat, [mid.x, mid.y, mid.z], new THREE.Euler().setFromQuaternion(quat));
}

/** A squared timber (or iron bar) between two points, its grain along its length. */
export function beam(kit: LevelKit, from: V3, to: V3, width: number, mat: MaterialKey, depth = width): void {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const dir = b.clone().sub(a);
  const length = dir.length();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const mid = a.add(b).multiplyScalar(0.5);
  kit.geometry(new THREE.BoxGeometry(width, length, depth), mat, [mid.x, mid.y, mid.z], new THREE.Euler().setFromQuaternion(quat), false);
}

export function ladder(kit: LevelKit, at: V3, height: number, yaw: number): void {
  for (const side of [-0.25, 0.25]) kit.box({ at: offset(at, yaw, side, height / 2, 0), size: [0.07, height, 0.07], mat: 'wood_dark', rotY: yaw, collide: false });
  for (let y = 0.3; y < height; y += 0.32) kit.box({ at: offset(at, yaw, 0, y, 0), size: [0.5, 0.05, 0.05], mat: 'wood', rotY: yaw, collide: false });
}

export interface BuildingOptions {
  /** Centre of the front wall at ground level. The front faces local +Z. */
  at: V3;
  yaw: number;
  width: number;
  depth: number;
  height: number;
  wall?: MaterialKey;
  roof?: MaterialKey;
  door?: boolean;
  windows?: number;
  awning?: boolean;
  collide?: boolean;
}

/** A timber-framed house: body, gable roof, corner beams, door, lit windows. */
export function building(kit: LevelKit, o: BuildingOptions): void {
  const { at, yaw, width: w, depth: d, height: h } = o;
  const collide = o.collide ?? true;
  kit.box({ at: offset(at, yaw, 0, h / 2, -d / 2), size: [w, h, d], mat: o.wall ?? 'plaster', rotY: yaw, collide });
  const shape = new THREE.Shape();
  const eave = d / 2 + 0.45;
  shape.moveTo(-eave, 0);
  shape.lineTo(eave, 0);
  shape.lineTo(0, Math.min(2.4, d * 0.45));
  shape.closePath();
  const roof = new THREE.ExtrudeGeometry(shape, { depth: w + 0.6, bevelEnabled: false });
  roof.translate(0, 0, -(w + 0.6) / 2);
  kit.geometry(roof, o.roof ?? 'roof', offset(at, yaw, 0, h, -d / 2), new THREE.Euler(0, yaw + Math.PI / 2, 0));
  for (const side of [-1, 1]) {
    kit.box({ at: offset(at, yaw, side * (w / 2 - 0.08), h / 2, 0.02), size: [0.2, h, 0.2], mat: 'wood_dark', rotY: yaw, collide: false });
  }
  kit.box({ at: offset(at, yaw, 0, h * 0.55, 0.03), size: [w, 0.18, 0.12], mat: 'wood_dark', rotY: yaw, collide: false });
  if (o.door ?? true) {
    kit.box({ at: offset(at, yaw, 0, 1.15, 0.03), size: [1.2, 2.3, 0.08], mat: 'wood_dark', rotY: yaw, collide: false });
    kit.box({ at: offset(at, yaw, 0, 2.38, 0.08), size: [1.5, 0.16, 0.16], mat: 'wood_dark', rotY: yaw, collide: false });
  }
  const windows = o.windows ?? 2;
  for (let i = 0; i < windows; i++) {
    const dx = (i - (windows - 1) / 2) * (w / Math.max(windows, 1)) * 0.9;
    if ((o.door ?? true) && Math.abs(dx) < 1) continue;
    for (const wy of h > 5 ? [1.6, h * 0.55 + 1.3] : [1.6]) {
      kit.box({ at: offset(at, yaw, dx, wy, 0.02), size: [0.75, 0.95, 0.06], mat: 'window', rotY: yaw, collide: false, shadow: false });
      kit.box({ at: offset(at, yaw, dx, wy - 0.52, 0.08), size: [0.95, 0.08, 0.16], mat: 'wood_dark', rotY: yaw, collide: false });
    }
  }
  if (o.awning) {
    kit.box({ at: offset(at, yaw, 0, 2.75, 0.9), size: [w * 0.8, 0.06, 1.9], mat: 'canvas', rotY: yaw, rotX: 0.28, collide: false });
    for (const side of [-1, 1]) kit.box({ at: offset(at, yaw, side * w * 0.38, 1.25, 1.75), size: [0.1, 2.5, 0.1], mat: 'wood_dark', rotY: yaw });
  }
}
