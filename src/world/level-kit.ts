import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Collider, Physics } from '../physics/physics';
import { applyWorldUVs, type MaterialKey, type MaterialLibrary } from './materials';

export type V3 = readonly [number, number, number];
export type Side = 'n' | 's' | 'e' | 'w';

/** A gap in a room wall. `at` is the offset from the wall's centre along the wall. */
export interface Opening {
  side: Side;
  at?: number;
  width?: number;
  height?: number;
}

export interface BoxOptions {
  at: V3;
  size: V3;
  mat: MaterialKey;
  rotY?: number;
  rotX?: number;
  rotZ?: number;
  collide?: boolean;
  bevel?: number;
  shadow?: boolean;
}

export interface RoomOptions {
  /** Centre of the floor surface. */
  at: V3;
  /** Inner width (x), height, depth (z). */
  size: V3;
  floor?: MaterialKey | null;
  wall?: MaterialKey | null;
  ceiling?: MaterialKey | null;
  openings?: Opening[];
  /** Walls to leave out, where this room abuts another room's wall. */
  omit?: Side[];
  thickness?: number;
}

const tmpEuler = new THREE.Euler();
const tmpQuat = new THREE.Quaternion();
const tmpMatrix = new THREE.Matrix4();

/**
 * Builds static area geometry. Everything added is batched per material and merged
 * into one mesh each on finish(), with Rapier colliders created as you go.
 */
export class LevelKit {
  readonly root = new THREE.Group();
  readonly colliders: Collider[] = [];
  private readonly batches = new Map<MaterialKey, { cast: THREE.BufferGeometry[]; noCast: THREE.BufferGeometry[] }>();

  constructor(
    readonly physics: Physics,
    readonly materials: MaterialLibrary,
  ) {}

  /** Geometry with an exact triangle-mesh collider (floors with holes, odd shapes). */
  solid(geometry: THREE.BufferGeometry, mat: MaterialKey, at: V3, rotation?: THREE.Euler): void {
    const geo = this.geometry(geometry, mat, at, rotation);
    const positions = geo.getAttribute('position').array;
    this.colliders.push(this.physics.addTrimesh(new Float32Array(positions)));
  }

  /** Adds any geometry (in local space) at a transform, merged with its material batch. */
  geometry(geometry: THREE.BufferGeometry, mat: MaterialKey, at: V3, rotation?: THREE.Euler, shadow = true): THREE.BufferGeometry {
    const geo = geometry.index ? geometry.toNonIndexed() : geometry;
    if (geo !== geometry) geometry.dispose();
    tmpQuat.setFromEuler(rotation ?? tmpEuler.set(0, 0, 0));
    tmpMatrix.compose(new THREE.Vector3(at[0], at[1], at[2]), tmpQuat, new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(tmpMatrix);
    for (const name of Object.keys(geo.attributes)) {
      if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
    }
    applyWorldUVs(geo, this.materials.tile(mat));
    const batch = this.batches.get(mat) ?? { cast: [], noCast: [] };
    this.batches.set(mat, batch);
    (shadow ? batch.cast : batch.noCast).push(geo);
    return geo;
  }

  box(o: BoxOptions): void {
    const [w, h, d] = o.size;
    const geo = o.bevel ? new RoundedBoxGeometry(w, h, d, 2, o.bevel) : new THREE.BoxGeometry(w, h, d);
    const rotation = new THREE.Euler(o.rotX ?? 0, o.rotY ?? 0, o.rotZ ?? 0, 'YXZ');
    this.geometry(geo, o.mat, o.at, rotation, o.shadow ?? true);
    if (o.collide ?? true) {
      const quat = new THREE.Quaternion().setFromEuler(rotation);
      this.colliders.push(this.physics.addBox(new THREE.Vector3(...o.at), new THREE.Vector3(w, h, d), quat));
    }
  }

  /** An invisible wall: collider only. Keep the result to open it up later. */
  blocker(at: V3, size: V3, rotY = 0): Collider {
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0));
    const collider = this.physics.addBox(new THREE.Vector3(...at), new THREE.Vector3(...size), quat);
    this.colliders.push(collider);
    return collider;
  }

  /** Takes one collider out of the world before the area unloads (a gate opening, a wall falling). */
  removeCollider(collider: Collider): void {
    const index = this.colliders.indexOf(collider);
    if (index < 0) return;
    this.colliders.splice(index, 1);
    this.physics.remove(collider);
  }

  cylinder(o: { at: V3; radius: number; height: number; mat: MaterialKey; segments?: number; collide?: boolean; radiusTop?: number }): void {
    const geo = new THREE.CylinderGeometry(o.radiusTop ?? o.radius, o.radius, o.height, o.segments ?? 16);
    this.geometry(geo, o.mat, o.at);
    if (o.collide ?? true) this.colliders.push(this.physics.addCylinder(new THREE.Vector3(...o.at), o.radius, o.height));
  }

  /** A sloped slab whose top surface runs from `from` to `to`. */
  ramp(o: { from: V3; to: V3; width: number; mat: MaterialKey; thickness?: number; visible?: boolean }): void {
    const t = o.thickness ?? 0.3;
    const dx = o.to[0] - o.from[0];
    const dz = o.to[2] - o.from[2];
    const rise = o.to[1] - o.from[1];
    const run = Math.hypot(dx, dz);
    const length = Math.hypot(run, rise);
    const rotation = new THREE.Euler(-Math.atan2(rise, run), Math.atan2(dx, dz), 0, 'YXZ');
    const normal = new THREE.Vector3(0, 1, 0).applyEuler(rotation);
    const center = new THREE.Vector3(...o.from).add(new THREE.Vector3(...o.to)).multiplyScalar(0.5).addScaledVector(normal, -t / 2);
    if (o.visible ?? true) this.geometry(new THREE.BoxGeometry(o.width, t, length), o.mat, [center.x, center.y, center.z], rotation);
    this.colliders.push(this.physics.addBox(center, new THREE.Vector3(o.width, t, length), new THREE.Quaternion().setFromEuler(rotation)));
  }

  /** Visual steps with a smooth ramp collider, so walking up them never snags. */
  stairs(o: { from: V3; to: V3; width: number; mat: MaterialKey }): void {
    const rise = o.to[1] - o.from[1];
    const steps = Math.max(2, Math.ceil(Math.abs(rise) / 0.2));
    const dx = (o.to[0] - o.from[0]) / steps;
    const dz = (o.to[2] - o.from[2]) / steps;
    const dy = rise / steps;
    const yaw = Math.atan2(o.to[0] - o.from[0], o.to[2] - o.from[2]);
    const depth = Math.hypot(dx, dz);
    for (let i = 0; i < steps; i++) {
      const top = o.from[1] + dy * (i + 1);
      const height = Math.abs(top - Math.min(o.from[1], o.to[1])) + 0.05;
      this.geometry(
        new THREE.BoxGeometry(o.width, height, depth),
        o.mat,
        [o.from[0] + dx * (i + 0.5), top - height / 2, o.from[2] + dz * (i + 0.5)],
        new THREE.Euler(0, yaw, 0),
      );
    }
    this.ramp({ ...o, visible: false });
  }

  /** A room: floor, ceiling, and four walls with openings. Walls sit outside the inner size. */
  room(o: RoomOptions): void {
    const [x, y, z] = o.at;
    const [w, h, d] = o.size;
    const t = o.thickness ?? 0.5;
    const floor = o.floor === undefined ? 'stone_floor' : o.floor;
    const wall = o.wall === undefined ? 'stone_wall' : o.wall;
    const ceiling = o.ceiling === undefined ? 'rock' : o.ceiling;
    const omit = new Set(o.omit ?? []);
    // Floors and ceilings reach under the walls, but not past a wall that was left out.
    const x0 = x - w / 2 - (omit.has('w') ? 0 : t);
    const x1 = x + w / 2 + (omit.has('e') ? 0 : t);
    const z0 = z - d / 2 - (omit.has('n') ? 0 : t);
    const z1 = z + d / 2 + (omit.has('s') ? 0 : t);
    const slab = (yc: number, mat: MaterialKey, shadow: boolean): void =>
      this.box({ at: [(x0 + x1) / 2, yc, (z0 + z1) / 2], size: [x1 - x0, t, z1 - z0], mat, shadow });
    if (floor) slab(y - t / 2, floor, true);
    if (ceiling) slab(y + h + t / 2, ceiling, false);
    if (!wall) return;
    const openings = o.openings ?? [];
    const on = (side: Side, center: number): { center: number; width: number; height: number }[] =>
      openings
        .filter((op) => op.side === side)
        .map((op) => ({ center: center + (op.at ?? 0), width: op.width ?? 2.4, height: op.height ?? Math.min(3, h) }));
    if (!omit.has('n')) this.wallRun('x', z - d / 2 - t / 2, x - w / 2 - t, x + w / 2 + t, y, h, t, wall, on('n', x));
    if (!omit.has('s')) this.wallRun('x', z + d / 2 + t / 2, x - w / 2 - t, x + w / 2 + t, y, h, t, wall, on('s', x));
    if (!omit.has('w')) this.wallRun('z', x - w / 2 - t / 2, z - d / 2, z + d / 2, y, h, t, wall, on('w', z));
    if (!omit.has('e')) this.wallRun('z', x + w / 2 + t / 2, z - d / 2, z + d / 2, y, h, t, wall, on('e', z));
  }

  /** A straight run of wall along an axis, broken by openings with lintels above them. */
  wallRun(
    axis: 'x' | 'z',
    fixed: number,
    start: number,
    end: number,
    y: number,
    h: number,
    t: number,
    mat: MaterialKey,
    openings: { center: number; width: number; height: number }[] = [],
  ): void {
    const segment = (a: number, b: number, y0: number, height: number): void => {
      if (b - a < 0.01 || height < 0.01) return;
      const mid = (a + b) / 2;
      const at: V3 = axis === 'x' ? [mid, y0 + height / 2, fixed] : [fixed, y0 + height / 2, mid];
      const size: V3 = axis === 'x' ? [b - a, height, t] : [t, height, b - a];
      this.box({ at, size, mat });
    };
    let cursor = start;
    for (const op of [...openings].sort((p, q) => p.center - q.center)) {
      const a = Math.max(start, op.center - op.width / 2);
      const b = Math.min(end, op.center + op.width / 2);
      segment(cursor, a, y, h);
      segment(a, b, y + op.height, h - op.height);
      cursor = b;
    }
    segment(cursor, end, y, h);
  }

  pointLight(o: { at: V3; color?: number; intensity?: number; distance?: number; shadow?: boolean; bulb?: boolean }): THREE.PointLight {
    const light = new THREE.PointLight(o.color ?? 0xffb46b, o.intensity ?? 12, o.distance ?? 14, 2);
    light.position.set(...o.at);
    if (o.shadow) {
      light.castShadow = true;
      light.shadow.bias = -0.002;
      light.shadow.normalBias = 0.03;
      light.shadow.camera.near = 0.2;
    }
    if (o.bulb ?? true) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), this.materials.get('lamp'));
      light.add(bulb);
    }
    this.root.add(light);
    return light;
  }

  /** Adds an object that stays separate (animated or interactive). */
  add<T extends THREE.Object3D>(object: T): T {
    this.root.add(object);
    return object;
  }

  /** Merges every batch into meshes. Call once, after building. */
  finish(): void {
    for (const [key, batch] of this.batches) {
      for (const [list, cast] of [[batch.cast, true], [batch.noCast, false]] as const) {
        if (list.length === 0) continue;
        const merged = mergeGeometries(list, false);
        merged.userData.worldUVs = true;
        for (const geo of list) geo.dispose();
        const mesh = new THREE.Mesh(merged, this.materials.get(key));
        mesh.castShadow = cast && key !== 'water';
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        this.root.add(mesh);
      }
    }
    this.batches.clear();
    this.materials.fit(this.root);
  }

  /** Removes colliders and frees GPU geometry. Shared materials are left alone. */
  dispose(): void {
    for (const collider of this.colliders) this.physics.remove(collider);
    this.colliders.length = 0;
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
      if (object instanceof THREE.Light) object.dispose();
    });
    this.root.removeFromParent();
  }
}
