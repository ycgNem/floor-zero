import * as THREE from 'three';
import { randRange, type Rng } from '../core/rng';
import type { LevelKit, V3 } from './level-kit';
import type { MaterialKey } from './materials';
import { beam, faceCenter, offset, polar } from './props';

/**
 * Bellwether's ring: builders' stone with a hand-made town crowded up it (doc 12). The ring is
 * precise and monumental: pilasters, terraces on corbels, a cornice at the rim. The town is the
 * opposite: timber and plaster, jettied storeys, lean-to roofs, lit windows, stairs tacked on.
 */
export const RING = {
  /** The wall's inner face. */
  face: 37,
  /** Heights of the terraces houses stand on. */
  terraces: [10, 19, 28],
  /** How far each terrace reaches out from the wall. */
  terraceDepth: 4.6,
  rim: 42,
  pilasters: 24,
} as const;

const SEGMENTS = 64;

/** Chord width of one wall segment at radius r, with a hair of overlap. */
const chord = (r: number): number => (2 * Math.PI * r) / SEGMENTS + 0.12;

/** The angles (degrees) the pilasters stand at. Bays, and the houses in them, sit between. */
export const PILASTERS = Array.from({ length: RING.pilasters }, (_, i) => (i + 0.5) * (360 / RING.pilasters));

/** The ring itself: ashlar body, pilasters on plinths, terraces on corbels, cornice at the rim. */
export function ringWall(kit: LevelKit): void {
  const R = RING.face;
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * 360;
    const yaw = faceCenter(a);
    kit.box({ at: polar(a, R + 1.5, RING.rim / 2), size: [chord(R + 1.5), RING.rim, 3], mat: 'stone_wall', rotY: yaw, shadow: false });
    for (const h of RING.terraces) {
      const d = RING.terraceDepth;
      kit.box({ at: polar(a, R - d / 2, h - 0.45), size: [chord(R - d / 2), 0.9, d], mat: 'stone_wall', rotY: yaw, collide: false, shadow: false });
      // A moulded edge, and a low parapet along the walkway in front of the houses.
      kit.box({ at: polar(a, R - d + 0.2, h - 1.05), size: [chord(R - d), 0.35, 0.7], mat: 'ancient', rotY: yaw, collide: false, shadow: false });
      kit.box({ at: polar(a, R - d + 0.15, h + 0.45), size: [chord(R - d), 0.9, 0.3], mat: 'stone_wall', rotY: yaw, collide: false, shadow: false });
    }
    kit.box({ at: polar(a, R - 1.1, RING.rim + 0.5), size: [chord(R - 1.1), 1.3, 4.6], mat: 'ancient', rotY: yaw, collide: false, shadow: false });
    kit.box({ at: polar(a, R - 0.4, RING.rim - 0.55), size: [chord(R - 0.4), 0.8, 2.8], mat: 'stone_wall', rotY: yaw, collide: false, shadow: false });
  }
  for (const a of PILASTERS) {
    const yaw = faceCenter(a);
    kit.box({ at: polar(a, R - 0.55, RING.rim / 2), size: [2.2, RING.rim, 1.5], mat: 'ancient', rotY: yaw, collide: false, shadow: false });
    kit.box({ at: polar(a, R - 0.8, 1.3), size: [3.1, 2.6, 2.2], mat: 'stone_wall', rotY: yaw, bevel: 0.05 });
    for (const h of RING.terraces) {
      // Stepped corbels carry each terrace.
      kit.box({ at: polar(a, R - 2.3, h - 1.35), size: [1.7, 0.9, 4.4], mat: 'ancient', rotY: yaw, collide: false, shadow: false });
      kit.box({ at: polar(a, R - 1.4, h - 2.3), size: [1.5, 1.0, 2.6], mat: 'ancient', rotY: yaw, collide: false, shadow: false });
      kit.box({ at: polar(a, R - 0.9, h - 3.2), size: [1.3, 0.8, 1.4], mat: 'ancient', rotY: yaw, collide: false, shadow: false });
    }
  }
}

export interface HouseOptions {
  /** Centre of the front wall at ground level. The front faces local +Z. */
  at: V3;
  yaw: number;
  width: number;
  depth: number;
  /** Storeys: the ground floor, then jettied timber-framed storeys above. */
  floors: number;
  wall: MaterialKey;
  roof: 'gable' | 'gable-front' | 'lean';
  /** Share of windows lit. */
  lit: number;
  rng: Rng;
  door?: boolean;
  collide?: boolean;
  chimney?: boolean;
  shutters?: boolean;
}

const GROUND = 3.2;
const STOREY = 2.8;
const JETTY = 0.35;

/** Total height of a house to its eaves, for stacking things on and around it. */
export function houseHeight(floors: number): number {
  return GROUND + (floors - 1) * STOREY;
}

/** A window: frame, sill, glass lit or dark, and sometimes shutters folded back. */
function window(kit: LevelKit, p: (dx: number, dy: number, dz: number) => V3, yaw: number, x: number, y: number, z: number, lit: boolean, shutters: boolean): void {
  kit.box({ at: p(x, y, z + 0.02), size: [0.68, 0.95, 0.05], mat: lit ? 'window' : 'window_dark', rotY: yaw, collide: false, shadow: false });
  kit.box({ at: p(x, y - 0.52, z + 0.08), size: [0.9, 0.08, 0.18], mat: 'wood_dark', rotY: yaw, collide: false, shadow: false });
  kit.box({ at: p(x, y + 0.53, z + 0.06), size: [0.86, 0.1, 0.12], mat: 'wood_dark', rotY: yaw, collide: false, shadow: false });
  if (shutters) {
    for (const side of [-1, 1]) kit.box({ at: p(x + side * 0.6, y, z + 0.06), size: [0.4, 0.98, 0.05], mat: 'wood', rotY: yaw, collide: false, shadow: false });
  }
}

/**
 * A Bellwether house: a masonry ground floor, jettied timber-framed storeys oversailing it, a roof
 * (gable to the side, gable to the front, or a lean-to against the ring), a chimney, and windows,
 * some lit.
 */
export function townhouse(kit: LevelKit, o: HouseOptions): void {
  const { at, yaw, width: w, depth: d, rng } = o;
  const p = (dx: number, dy: number, dz: number): V3 => offset(at, yaw, dx, dy, dz);
  const box = (dx: number, dy: number, dz: number, size: V3, mat: MaterialKey, collide = false, shadow = true): void =>
    kit.box({ at: p(dx, dy, dz), size, mat, rotY: yaw, collide, shadow });
  box(0, GROUND / 2, -d / 2, [w, GROUND, d], o.wall, o.collide ?? false);
  box(0, 0.25, 0.03, [w + 0.08, 0.5, 0.1], 'stone_wall', false, false);
  // Ground floor: a door, and windows either side of it.
  const door = o.door ?? true;
  if (door) {
    box(0, 1.1, 0.03, [1.05, 2.2, 0.07], 'wood_dark', false, false);
    box(0, 2.3, 0.07, [1.35, 0.14, 0.14], 'wood_dark', false, false);
    box(0.75, 2.35, 0.12, [0.12, 0.18, 0.12], 'lamp', false, false);
  }
  const groundWindows = Math.max(1, Math.floor(w / 1.7));
  for (let k = 0; k < groundWindows; k++) {
    const x = (k - (groundWindows - 1) / 2) * (w / groundWindows);
    if (door && Math.abs(x) < 1.1) continue;
    window(kit, p, yaw, x, 1.65, 0, rng() < o.lit, o.shutters ?? rng() < 0.4);
  }
  // Upper storeys, each oversailing the last, framed in dark timber.
  let y = GROUND;
  for (let f = 1; f < o.floors; f++) {
    const fw = w + 0.16 * f;
    const front = JETTY * f;
    const fd = d + front;
    box(0, y + STOREY / 2, front - fd / 2, [fw, STOREY, fd], 'plaster');
    box(0, y + 0.08, front - 0.1, [fw + 0.1, 0.18, 0.28], 'wood_dark', false, false);
    box(0, y + STOREY - 0.08, front + 0.04, [fw, 0.14, 0.1], 'wood_dark', false, false);
    const bays = Math.max(2, Math.round(fw / 1.3));
    for (let k = 0; k <= bays; k++) box(-fw / 2 + (fw * k) / bays, y + STOREY / 2, front + 0.04, [0.14, STOREY, 0.1], 'wood_dark', false, false);
    for (const side of [-1, 1]) {
      kit.box({ at: p(side * (fw / 2 - 0.45), y + STOREY * 0.35, front + 0.03), size: [0.11, 1.35, 0.08], mat: 'wood_dark', rotY: yaw, rotZ: side * 0.62, collide: false, shadow: false });
    }
    const windows = Math.max(1, Math.floor(fw / 1.6));
    for (let k = 0; k < windows; k++) {
      window(kit, p, yaw, (k - (windows - 1) / 2) * (fw / windows), y + 1.45, front, rng() < o.lit, o.shutters ?? rng() < 0.3);
    }
    y += STOREY;
  }
  const top = y;
  const fw = w + 0.16 * (o.floors - 1);
  const front = JETTY * (o.floors - 1);
  const fd = d + front;
  if (o.roof === 'lean') {
    // Against the ring: one slope falling toward the plaza.
    const rise = 1.1;
    kit.box({ at: p(0, top + rise / 2 + 0.05, front - fd / 2 + 0.15), size: [fw + 0.5, 0.14, Math.hypot(fd + 0.8, rise)], mat: 'roof', rotY: yaw, rotX: -Math.atan2(rise, fd + 0.8), collide: false });
    box(0, top + rise / 2, -d + 0.1, [fw, rise, 0.2], 'plaster', false, false);
  } else {
    const across = o.roof === 'gable';
    const span = across ? fd : fw;
    const run = across ? fw : fd;
    const shape = new THREE.Shape();
    const eave = span / 2 + 0.4;
    shape.moveTo(-eave, 0);
    shape.lineTo(eave, 0);
    shape.lineTo(0, Math.min(2.3, span * 0.5));
    shape.closePath();
    const roof = new THREE.ExtrudeGeometry(shape, { depth: run + 0.5, bevelEnabled: false });
    roof.translate(0, 0, -(run + 0.5) / 2);
    kit.geometry(roof, 'roof', p(0, top, front - fd / 2), new THREE.Euler(0, yaw + (across ? Math.PI / 2 : 0), 0));
    if (!across) {
      // The gable end faces the plaza: fill it with plaster, a beam, and a little window.
      const gable = new THREE.Shape();
      gable.moveTo(-fw / 2, 0);
      gable.lineTo(fw / 2, 0);
      gable.lineTo(0, Math.min(2.3, fw * 0.5) - 0.15);
      gable.closePath();
      kit.geometry(new THREE.ExtrudeGeometry(gable, { depth: 0.12, bevelEnabled: false }), 'plaster', p(0, top, front - 0.12), new THREE.Euler(0, yaw, 0), false);
      window(kit, p, yaw, 0, top + 0.75, front, rng() < o.lit * 0.7, false);
    }
  }
  if (o.chimney ?? rng() < 0.6) {
    const side = rng() < 0.5 ? -1 : 1;
    box(side * (w / 2 - 0.5), top + 1.2, -d + 0.6, [0.6, 2.6, 0.6], 'brick', false);
    box(side * (w / 2 - 0.5), top + 2.55, -d + 0.6, [0.78, 0.12, 0.78], 'stone_wall', false, false);
  }
}

/** A timber stair climbing from one point to another: two stringers and treads. Visual only. */
export function timberStair(kit: LevelKit, from: V3, to: V3, width = 1.1): void {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const yaw = Math.atan2(dx, dz);
  for (const side of [-1, 1]) {
    beam(kit, offset(from, yaw, side * width / 2, 0, 0), offset(to, yaw, side * width / 2, 0, 0), 0.08, 'wood_dark', 0.26);
  }
  const rise = to[1] - from[1];
  const steps = Math.ceil(rise / 0.22);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    kit.box({ at: [from[0] + dx * t, from[1] + rise * t + 0.1, from[2] + dz * t], size: [width, 0.06, 0.3], mat: 'wood', rotY: yaw, collide: false, shadow: false });
  }
  // A post at each end, and a handrail.
  for (const end of [from, to]) beam(kit, [end[0], end[1], end[2]], [end[0], end[1] + 1.1, end[2]], 0.09, 'wood_dark');
  beam(kit, offset(from, yaw, width / 2, 1.0, 0), offset(to, yaw, width / 2, 1.0, 0), 0.06, 'wood_dark');
}

/** A sagging line between two points with things hung on it: lamps for a festoon, or washing. */
export function hangingLine(kit: LevelKit, from: V3, to: V3, sag: number, items: number, item: 'bulb' | 'washing', rng: Rng): void {
  const at = (t: number): V3 => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t - Math.sin(t * Math.PI) * sag, from[2] + (to[2] - from[2]) * t];
  const pieces = 10;
  for (let i = 0; i < pieces; i++) beam(kit, at(i / pieces), at((i + 1) / pieces), 0.015, 'canvas');
  const yaw = Math.atan2(to[0] - from[0], to[2] - from[2]);
  for (let k = 1; k <= items; k++) {
    const p = at(k / (items + 1));
    if (item === 'bulb') {
      kit.geometry(new THREE.SphereGeometry(0.05, 8, 6), 'lamp', [p[0], p[1] - 0.08, p[2]], undefined, false);
    } else {
      const w = randRange(rng, 0.4, 0.8);
      const h = randRange(rng, 0.5, 0.9);
      kit.box({ at: [p[0], p[1] - h / 2, p[2]], size: [0.03, h, w], mat: rng() < 0.5 ? 'canvas' : 'plaster', rotY: yaw + Math.PI / 2, collide: false, shadow: false });
    }
  }
}

/**
 * Houses crowding every terrace of the ring and the plaza's edge, with stairs between the
 * terraces and washing strung across. `keepClear` lists angles (degrees) where the ground level
 * must stay open: the shops' backs, the lamplighter's house.
 */
export function stackedTown(kit: LevelKit, rng: Rng, lit: number, keepClear: readonly number[]): void {
  const R = RING.face;
  const bay = 360 / RING.pilasters;
  const clear = (a: number): boolean => keepClear.some((k) => Math.abs(((a - k + 540) % 360) - 180) < 9);
  const levels = [0, ...RING.terraces];
  for (const h of levels) {
    for (let b = 0; b < RING.pilasters; b++) {
      const centre = b * bay;
      if (h === 0 && clear(centre)) continue;
      // One or two houses fill the bay between pilasters, never quite the same.
      const split = rng() < 0.55 ? 2 : 1;
      for (let s = 0; s < split; s++) {
        const span = (bay - 4.6) / split;
        const a = centre - (bay - 4.6) / 2 + span * (s + 0.5) + randRange(rng, -0.5, 0.5);
        const depth = h === 0 ? randRange(rng, 3.6, 4.6) : randRange(rng, 2.6, 3.1);
        const width = Math.min(randRange(rng, 3.4, 6), ((span * Math.PI) / 180) * (R - depth) - 0.4);
        const floors = h === 0 ? (rng() < 0.6 ? 3 : 2) : rng() < 0.65 ? 2 : 1;
        const wall: MaterialKey = rng() < 0.35 ? 'brick' : rng() < 0.6 ? 'plaster' : 'stone_wall';
        townhouse(kit, {
          at: polar(a, R - depth - 0.05, h),
          yaw: faceCenter(a),
          width,
          depth,
          floors,
          wall,
          roof: h === 0 || floors === 2 ? 'lean' : rng() < 0.5 ? 'gable-front' : 'gable',
          lit,
          rng,
          collide: h === 0,
        });
      }
    }
  }
  // Stairs climbing the ring from terrace to terrace, along the walkways.
  const walk = R - RING.terraceDepth + 0.8;
  for (const [a0, h0] of [[95, 10], [205, 19], [265, 10], [345, 19], [30, 10], [150, 19]] as const) {
    const a1 = a0 + ((9 / Math.tan(0.62)) / walk) * (180 / Math.PI);
    timberStair(kit, polar(a0, walk, h0), polar(a1, walk, h0 + 9));
  }
  // Washing strung between houses on the terraces.
  for (let i = 0; i < 9; i++) {
    const h = RING.terraces[i % RING.terraces.length] as number;
    const a = rng() * 360;
    hangingLine(kit, polar(a, R - 3.2, h + 2.6), polar(a + 6, R - 3.2, h + 2.4), 0.4, 4, 'washing', rng);
  }
}

/** Dressed stone bands set in the cobbles: rings round the shaft and spokes out to the wall. */
export function paving(kit: LevelKit, from: number, to: number): void {
  for (const r of [from + 1.6, 13.5, 24.2]) {
    const pieces = Math.ceil((2 * Math.PI * r) / 1.4);
    for (let i = 0; i < pieces; i++) {
      const a = (i / pieces) * 360;
      kit.box({ at: polar(a, r, 0.01), size: [(2 * Math.PI * r) / pieces + 0.03, 0.04, 1.1], mat: 'stone_floor', rotY: faceCenter(a), collide: false, shadow: false });
    }
  }
  for (let k = 0; k < 12; k++) {
    const a = k * 30 + 15;
    const r0 = from + 2.4;
    const r1 = to - 0.5;
    kit.box({ at: polar(a, (r0 + r1) / 2, 0.012), size: [0.9, 0.04, r1 - r0], mat: 'stone_floor', rotY: faceCenter(a), collide: false, shadow: false });
  }
}

/** A tree in a stone planter: life in the plaza. */
export function plantedTree(kit: LevelKit, at: V3, rng: Rng): void {
  kit.box({ at: [at[0], at[1] + 0.4, at[2]], size: [1.6, 0.8, 1.6], mat: 'stone_wall', bevel: 0.05 });
  kit.box({ at: [at[0], at[1] + 0.79, at[2]], size: [1.4, 0.04, 1.4], mat: 'dirt', collide: false, shadow: false });
  const h = randRange(rng, 3.2, 4.2);
  kit.cylinder({ at: [at[0], at[1] + 0.8 + h / 2, at[2]], radius: 0.13, radiusTop: 0.08, height: h, mat: 'wood_dark', segments: 8, collide: false });
  for (let i = 0; i < 5; i++) {
    const r = randRange(rng, 0.8, 1.3);
    const a = rng() * Math.PI * 2;
    const off = i === 0 ? 0 : randRange(rng, 0.5, 0.9);
    kit.geometry(new THREE.IcosahedronGeometry(r, 1), 'moss', [at[0] + Math.cos(a) * off, at[1] + 0.8 + h + randRange(rng, -0.4, 0.5), at[2] + Math.sin(a) * off]);
  }
}
