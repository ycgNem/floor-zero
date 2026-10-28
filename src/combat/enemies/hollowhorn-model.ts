import * as THREE from 'three';
import { taperedTube, type Vec3 } from '../../render/shapes';

export type MaterialFactory = (
  color: number,
  o?: { roughness?: number; metalness?: number; emissive?: number; emissiveIntensity?: number },
) => THREE.MeshStandardMaterial;

interface Leg {
  hip: THREE.Group;
  knee: THREE.Group;
  front: boolean;
  /** Where this leg sits in the gallop cycle, in radians. */
  offset: number;
}

/** The posable Hollowhorn. Built facing +z with its hooves at the origin; about 3.6 m tall at the horns. */
export interface HollowhornRig {
  root: THREE.Group;
  /** Pivots at the hind hips, so pitching it back rears the beast up. Hide it to hide the beast. */
  body: THREE.Group;
  neck: THREE.Group;
  jaw: THREE.Group;
  legs: Leg[];
  eyes: THREE.MeshStandardMaterial;
  veins: THREE.MeshStandardMaterial;
  /** Lives on the root, not the body, so hiding the body never changes the scene's light count. */
  light: THREE.PointLight;
  /** Gallop cycle, in radians. */
  phase: number;
}

export interface HollowhornPose {
  /** Ground speed in m/s. Drives the gallop. */
  speed: number;
  /** 0 on all fours, 1 reared up on the hind legs. */
  rear: number;
  /** 0 jaw shut, 1 bellowing. */
  roar: number;
  /** 0 head up, 1 horns lowered to charge. */
  charge: number;
}

const PIVOT = new THREE.Vector3(0, 1.85, -1.25);
const REAR_PITCH = 0.6;

/** Model space to body space. */
function b(x: number, y: number, z: number): Vec3 {
  return [x - PIVOT.x, y - PIVOT.y, z - PIVOT.z];
}

export function buildHollowhorn(mat: MaterialFactory): HollowhornRig {
  const hide = mat(0x2a2320, { roughness: 0.92 });
  const plate = mat(0x4a443e, { roughness: 0.55, metalness: 0.12 });
  const horn = mat(0xc9b994, { roughness: 0.42 });
  const hoof = mat(0x191512, { roughness: 0.6 });
  const eyes = mat(0x1a0600, { roughness: 0.3, emissive: 0xff6a2a, emissiveIntensity: 6 });
  const veins = mat(0x160400, { emissive: 0xff4a18, emissiveIntensity: 3 });

  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const stone = new THREE.DodecahedronGeometry(1, 0);
  const cube = new THREE.BoxGeometry(1, 1, 1);

  const root = new THREE.Group();
  root.name = 'hollowhorn';
  const body = new THREE.Group();
  body.position.copy(PIVOT);
  root.add(body);

  const add = (geo: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, at: Vec3, scale: Vec3 = [1, 1, 1], rot: Vec3 = [0, 0, 0]): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(...at);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rot);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // The bulk: a chest and hump far heavier than the haunches, like a bison built from rock.
  add(sphere, hide, body, b(0, 2.05, 0.85), [1.22, 1.18, 1.3]);
  add(sphere, hide, body, b(0, 2.72, 0.7), [1.02, 0.88, 1.08]);
  add(sphere, hide, body, b(0, 1.98, -0.35), [1.06, 0.98, 1.35]);
  add(sphere, hide, body, b(0, 1.98, -1.28), [0.98, 0.98, 0.98]);
  add(sphere, hide, body, b(0, 2.5, 1.62), [0.78, 0.8, 0.9]);

  // Stone plates grown into the hide.
  const ridge: [number, number, number][] = [[1.55, 3.28, 0.3], [1.1, 3.55, 0.36], [0.62, 3.62, 0.38], [0.15, 3.44, 0.34], [-0.35, 3.04, 0.3], [-0.85, 3.0, 0.27], [-1.38, 2.98, 0.24]];
  ridge.forEach(([z, y, s], i) => add(stone, plate, body, b(0, y, z), [s * 0.9, s * 0.62, s * 1.25], [0.2 - i * 0.06, i * 0.7, 0]));
  for (const side of [-1, 1]) {
    add(stone, plate, body, b(side * 0.82, 3.05, 0.85), [0.58, 0.3, 0.74], [0.1, side * 0.3, side * -0.65]);
    add(stone, plate, body, b(side * 1.02, 2.45, 1.15), [0.42, 0.26, 0.55], [0, side * 0.5, side * -1.0]);
    add(stone, plate, body, b(side * 0.66, 2.62, -1.32), [0.46, 0.26, 0.56], [0, side * 0.2, side * -0.55]);
  }

  // Glowing fissures between the plates: whatever lives down there lives in this thing too.
  let seed = 7;
  const rnd = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const blobs: { c: Vec3; r: Vec3 }[] = [
    { c: [0, 2.05, 0.85], r: [1.22, 1.18, 1.3] },
    { c: [0, 1.98, -0.35], r: [1.06, 0.98, 1.35] },
    { c: [0, 1.98, -1.28], r: [0.98, 0.98, 0.98] },
  ];
  const zAxis = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < 14; i++) {
    const blob = blobs[i % blobs.length] as { c: Vec3; r: Vec3 };
    const side = i % 2 === 0 ? 1 : -1;
    const d = new THREE.Vector3(side * (0.75 + rnd() * 0.25), (rnd() - 0.35) * 0.9, (rnd() - 0.5) * 1.3).normalize();
    const t = 1 / Math.sqrt((d.x / blob.r[0]) ** 2 + (d.y / blob.r[1]) ** 2 + (d.z / blob.r[2]) ** 2);
    const p = new THREE.Vector3(blob.c[0] + d.x * t, blob.c[1] + d.y * t, blob.c[2] + d.z * t);
    const n = new THREE.Vector3((p.x - blob.c[0]) / blob.r[0] ** 2, (p.y - blob.c[1]) / blob.r[1] ** 2, (p.z - blob.c[2]) / blob.r[2] ** 2).normalize();
    const vein = add(cube, veins, body, b(p.x - n.x * 0.01, p.y - n.y * 0.01, p.z - n.z * 0.01), [0.35 + rnd() * 0.55, 0.035, 0.03]);
    vein.quaternion.setFromUnitVectors(zAxis, n);
    vein.rotateZ(rnd() * Math.PI);
    vein.castShadow = false;
  }

  // Head, on a neck pivot so it can lower its horns or throw itself back to bellow.
  const neck = new THREE.Group();
  neck.position.set(...b(0, 2.55, 1.95));
  body.add(neck);
  add(sphere, hide, neck, [0, 0.02, 0.42], [0.56, 0.5, 0.72]);
  add(sphere, hide, neck, [0, -0.2, 0.98], [0.42, 0.36, 0.48]);
  add(stone, plate, neck, [0, 0.3, 0.74], [0.52, 0.16, 0.3], [-0.25, 0, 0]);
  add(stone, plate, neck, [0, 0.42, 0.34], [0.42, 0.14, 0.38], [0.1, 0.4, 0]);
  for (const side of [-1, 1]) {
    const eye = add(sphere, eyes, neck, [side * 0.3, 0.14, 0.93], [0.075, 0.06, 0.06]);
    eye.castShadow = false;
    // The great horns sweep out and then forward, so a charge points them straight at you.
    add(taperedTube([[side * 0.34, 0.14, 0.3], [side * 0.9, 0.24, 0.22], [side * 1.26, 0.42, 0.56], [side * 1.3, 0.62, 1.06], [side * 1.1, 0.88, 1.46]], 0.19, 0.02), horn, neck, [0, 0, 0]);
    add(taperedTube([[side * 0.22, 0.36, 0.08], [side * 0.42, 0.6, -0.3], [side * 0.5, 0.78, -0.72]], 0.09, 0.012, 10, 8), horn, neck, [0, 0, 0]);
  }
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.32, 0.55);
  neck.add(jaw);
  add(sphere, hide, jaw, [0, -0.06, 0.4], [0.34, 0.14, 0.52]);
  const tooth = new THREE.ConeGeometry(0.035, 0.14, 6);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) add(tooth, horn, jaw, [side * (0.2 - i * 0.04), 0.07, 0.48 + i * 0.16]).castShadow = false;
  }

  // Legs: hip and knee pivots. Front legs are pillars; hind legs a little shorter.
  const legs: Leg[] = [];
  const leg = (side: number, front: boolean, offset: number): void => {
    const hipY = front ? 1.95 : 1.85;
    const upper = front ? 1.0 : 0.92;
    const lower = hipY - upper - 0.2;
    const hip = new THREE.Group();
    hip.position.set(...b(side * (front ? 0.72 : 0.68), hipY, front ? 1.05 : -1.3));
    body.add(hip);
    const r = front ? 0.3 : 0.34;
    add(new THREE.CapsuleGeometry(r, upper - r, 4, 12), hide, hip, [0, -upper / 2, 0]);
    if (front) add(stone, plate, hip, [side * 0.14, -0.28, 0.06], [0.3, 0.4, 0.32], [0, 0, side * -0.2]);
    const knee = new THREE.Group();
    knee.position.set(0, -upper, front ? 0 : -0.05);
    hip.add(knee);
    add(new THREE.CapsuleGeometry(front ? 0.2 : 0.22, lower - 0.15, 4, 10), hide, knee, [0, -lower / 2, 0]);
    add(new THREE.CylinderGeometry(0.19, 0.24, 0.2, 10), hoof, knee, [0, -lower - 0.1, 0.03]);
    legs.push({ hip, knee, front, offset });
  };
  leg(-1, true, 0);
  leg(1, true, 0.45);
  leg(-1, false, Math.PI + 0.6);
  leg(1, false, Math.PI + 1.05);

  add(taperedTube([b(0, 2.42, -2.15), b(0, 2.25, -2.6), b(0, 1.8, -2.95), b(0, 1.25, -3.05)], 0.17, 0.04, 12, 8), hide, body, [0, 0, 0]);
  add(stone, plate, body, b(0, 1.2, -3.05), [0.14, 0.2, 0.12]);

  const light = new THREE.PointLight(0xff6a30, 0, 9, 2);
  light.position.set(0, 2.9, 3.4);
  root.add(light);

  return { root, body, neck, jaw, legs, eyes, veins, light, phase: 0 };
}

/** Procedural gallop, rear and bellow. Call once per frame. */
export function animateHollowhorn(rig: HollowhornRig, pose: HollowhornPose, dt: number, time: number): void {
  const gait = Math.min(1, pose.speed / 6);
  rig.phase += dt * (1.5 + pose.speed * 1.1);
  const p = rig.phase;
  const rear = pose.rear;

  for (const leg of rig.legs) {
    const q = p + leg.offset;
    // Positive pitch swings a hoof backward: stance pushes back, the swing bends the knee and reaches forward.
    let swing = Math.sin(q) * 0.62 * gait;
    let bend = Math.max(0, -Math.cos(q)) * gait;
    if (leg.front) {
      swing = THREE.MathUtils.lerp(swing, -1.0 + Math.sin(time * 6 + leg.offset * 3) * 0.35, rear);
      bend = THREE.MathUtils.lerp(bend, 1.3, rear);
    } else {
      // Keep the hind hooves planted while the body tips back.
      swing += REAR_PITCH * rear;
    }
    leg.hip.rotation.x = swing;
    leg.knee.rotation.x = bend;
  }

  rig.body.position.y = PIVOT.y + Math.abs(Math.sin(p)) * 0.16 * gait;
  rig.body.rotation.x = Math.sin(p + 0.6) * 0.05 * gait - REAR_PITCH * rear;
  rig.body.rotation.z = Math.sin(p * 0.5) * 0.03 * gait;

  rig.neck.rotation.x = pose.charge * 0.42 - pose.roar * 0.55 + Math.sin(p + 1.2) * 0.07 * gait;
  rig.neck.rotation.y = Math.sin(time * 0.7) * 0.1 * (1 - gait) * (1 - pose.roar);
  rig.jaw.rotation.x = pose.roar * 0.6 + Math.sin(time * 38) * 0.03 * pose.roar;

  const pulse = 0.5 + 0.5 * Math.sin(time * 2.6);
  rig.veins.emissiveIntensity = 2.2 + pulse * 1.2 + pose.roar * 2.5;
  rig.eyes.emissiveIntensity = 5 + pose.roar * 4;
}
