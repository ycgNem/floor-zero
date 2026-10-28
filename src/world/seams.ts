import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise3, fbm3 } from '../core/noise';
import { randRange, type Rng } from '../core/rng';
import type { NodeType } from '../data/nodes';
import type { MaterialKey, MaterialLibrary } from './materials';

type SeamType = Extract<NodeType, 'copper_seam' | 'iron_seam' | 'cobalt_seam'>;

/**
 * How each ore shows itself (doc 12: ore reads by colour and shine from across a room). The host
 * rock is stained by its ore, green with malachite round copper, rust red round iron, and
 * blue-black round cobalt, and the ore itself breaks out of it in its own habit.
 */
const LOOKS: Record<SeamType, { stain: number; habit: 'nugget' | 'cube' | 'prism'; size: number; bed: number }> = {
  copper_seam: { stain: 0x4fb88a, habit: 'nugget', size: 1, bed: 0.3 },
  iron_seam: { stain: 0xd25a36, habit: 'cube', size: 1.35, bed: 0.12 },
  cobalt_seam: { stain: 0x4656c8, habit: 'prism', size: 1, bed: 0.3 },
};

export function isSeam(type: NodeType): type is SeamType {
  return type in LOOKS;
}

/** A lump of host rock: noise-shaped, flat underneath, and stained in patches by its ore. */
function hostRock(rng: Rng, materials: MaterialLibrary, scale: number, stain: THREE.Color): THREE.Mesh {
  const noise = createNoise3(Math.floor(rng() * 1e6));
  const geo = mergeVertices(new THREE.IcosahedronGeometry(1, 4).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const white = new THREE.Color(1, 1, 1);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const lump = fbm3(noise, v.x * 1.1, v.y * 1.1, v.z * 1.1, 4);
    const crease = 0.5 - Math.abs(noise(v.x * 2.6 + 4, v.y * 2.6, v.z * 2.6));
    v.multiplyScalar(1 + lump * 0.3 + crease * 0.12);
    // Settle into the ground: squash the underside flat.
    if (v.y < -0.25) v.y = -0.25 + (v.y + 0.25) * 0.15;
    pos.setXYZ(i, v.x, v.y, v.z);
    const patch = THREE.MathUtils.smoothstep(fbm3(noise, v.x * 2.1 + 9, v.y * 2.1, v.z * 2.1 - 3, 3), -0.15, 0.2);
    c.copy(white).lerp(stain, patch);
    // Darker where the rock folds in.
    c.multiplyScalar(0.8 + 0.3 * THREE.MathUtils.smoothstep(crease, -0.3, 0.4));
    c.toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, materials.get('rock', 'shaded'));
  mesh.scale.set(scale * randRange(rng, 0.95, 1.2), scale * randRange(rng, 0.65, 0.8), scale * randRange(rng, 0.9, 1.1));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** One piece of ore in its natural habit, standing up along +Y from its root. */
function oreGeometry(habit: 'nugget' | 'cube' | 'prism', rng: Rng, size: number): THREE.BufferGeometry {
  if (habit === 'nugget') {
    // Native copper: a rounded, knobbly lump.
    const noise = createNoise3(Math.floor(rng() * 1e6));
    const geo = mergeVertices(new THREE.IcosahedronGeometry(size, 2).deleteAttribute('normal').deleteAttribute('uv'));
    const pos = geo.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      v.multiplyScalar(1 + noise((v.x / size) * 2.5, (v.y / size) * 2.5, (v.z / size) * 2.5) * 0.35);
      v.y *= 0.75;
      pos.setXYZ(i, v.x, v.y + size * 0.35, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }
  if (habit === 'cube') {
    // Iron: blunt cubic crystals grown together.
    const parts: THREE.BufferGeometry[] = [];
    const count = 2 + Math.floor(rng() * 2);
    for (let k = 0; k < count; k++) {
      const s = size * randRange(rng, 0.55, 0.9);
      const part = new THREE.BoxGeometry(s, s, s);
      part.rotateX(randRange(rng, -0.5, 0.5));
      part.rotateZ(randRange(rng, -0.5, 0.5));
      part.translate(randRange(rng, -0.4, 0.4) * size, s * 0.45 + k * size * 0.15, randRange(rng, -0.4, 0.4) * size);
      parts.push(part);
    }
    const geo = mergeGeometries(parts, false);
    for (const part of parts) part.dispose();
    return geo;
  }
  // Cobalt: long six-sided crystals with pointed ends, in a little spray.
  const parts: THREE.BufferGeometry[] = [];
  const count = 2 + Math.floor(rng() * 3);
  for (let k = 0; k < count; k++) {
    const r = size * randRange(rng, 0.18, 0.3);
    const h = size * randRange(rng, 1.2, 2.2);
    const shaft = new THREE.CylinderGeometry(r, r * 1.08, h, 6);
    shaft.translate(0, h / 2, 0);
    const tip = new THREE.ConeGeometry(r, r * 1.6, 6);
    tip.translate(0, h + r * 0.8, 0);
    const crystal = mergeGeometries([shaft.toNonIndexed(), tip.toNonIndexed()], false);
    shaft.dispose();
    tip.dispose();
    crystal.rotateX(randRange(rng, -0.55, 0.55));
    crystal.rotateZ(randRange(rng, -0.55, 0.55));
    parts.push(crystal);
  }
  const geo = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  return geo;
}

/**
 * A seam: host rock with ore breaking out of it. The ore pieces come back as `chunks`, one per
 * share of the node's yield, so mining visibly strips the seam.
 */
export function seam(type: SeamType, rng: Rng, materials: MaterialLibrary, mat: MaterialKey, scale: number): { group: THREE.Group; chunks: THREE.Object3D[] } {
  const look = LOOKS[type];
  const group = new THREE.Group();
  const rock = hostRock(rng, materials, 0.75 * scale, new THREE.Color(look.stain));
  rock.position.y = 0.22 * scale;
  group.add(rock);
  const chunks: THREE.Object3D[] = [];
  const count = 7;
  const centre = new THREE.Vector3(0, 0.22 * scale, 0);
  const up = new THREE.Vector3(0, 1, 0);
  rock.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rng() * 0.6;
    const lift = randRange(rng, 0.15, 0.9);
    // Find the rock's skin in this direction and bed the ore into it, leaning out.
    const out = new THREE.Vector3(Math.cos(a) * (1 - lift * 0.55), lift * 0.75, Math.sin(a) * (1 - lift * 0.55)).normalize();
    ray.set(centre.clone().addScaledVector(out, 3 * scale), out.clone().negate());
    const skin = ray.intersectObject(rock)[0]?.point ?? centre.clone().addScaledVector(out, 0.6 * scale);
    const size = randRange(rng, 0.12, 0.2) * scale * look.size;
    const chunk = new THREE.Mesh(oreGeometry(look.habit, rng, size), materials.get(mat));
    chunk.position.copy(skin).addScaledVector(out, -size * look.bed);
    chunk.quaternion.setFromUnitVectors(up, out);
    chunk.rotateY(rng() * Math.PI * 2);
    chunk.castShadow = true;
    group.add(chunk);
    chunks.push(chunk);
  }
  return { group, chunks };
}
