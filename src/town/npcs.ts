import * as THREE from 'three';
import { damp, wrapAngle } from '../core/math';
import type { NpcId } from '../data/ids';

export type { NpcId };

export interface NpcLook {
  coat: number;
  under: number;
  skin: number;
  hair: number;
  build: number;
  hat?: 'cap' | 'hood' | 'none';
}

export const NPCS: Record<NpcId, { name: string; role: string; look: NpcLook }> = {
  mara: { name: 'Mara', role: 'Liftkeeper', look: { coat: 0x3f4a42, under: 0x2a2622, skin: 0xc79a7a, hair: 0x9a9690, build: 1, hat: 'none' } },
  iona: { name: 'Iona', role: 'Surveyor', look: { coat: 0x34486a, under: 0xcfc6b4, skin: 0xb07a5a, hair: 0x2a1c14, build: 0.95, hat: 'none' } },
  oren: { name: 'Oren', role: 'Smith', look: { coat: 0x5a3a24, under: 0x3a3430, skin: 0x8a5a3e, hair: 0x1c1410, build: 1.15, hat: 'cap' } },
  pell: { name: 'Pell', role: 'Cook', look: { coat: 0xd8d0c0, under: 0x6a4a3a, skin: 0xe0b090, hair: 0xb06a3a, build: 1.05, hat: 'cap' } },
  hollis: { name: 'Hollis', role: 'Innkeeper', look: { coat: 0x6a2f2f, under: 0xd8cbb0, skin: 0xd6a88a, hair: 0x5a5048, build: 1.08, hat: 'none' } },
  bram: { name: 'Bram', role: 'Trader', look: { coat: 0x8a6d2a, under: 0x3a3226, skin: 0xa8785a, hair: 0x3a2a1c, build: 1, hat: 'hood' } },
  tavi: { name: 'Tavi', role: 'Delver', look: { coat: 0x4a5a3a, under: 0x2a2a26, skin: 0xc49070, hair: 0x2a1e18, build: 0.92, hat: 'hood' } },
};

const materialCache = new Map<number, THREE.MeshStandardMaterial>();
function mat(color: number, roughness = 0.85): THREE.MeshStandardMaterial {
  const cached = materialCache.get(color);
  if (cached) return cached;
  const m = new THREE.MeshStandardMaterial({ color, roughness });
  materialCache.set(color, m);
  return m;
}

function part(geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, mat(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

/** A townsperson: a simple, readable figure that breathes and turns to face you. */
export class NpcFigure {
  readonly group = new THREE.Group();
  private readonly head: THREE.Group;
  private readonly torso: THREE.Group;
  private baseYaw: number;
  private headYaw = 0;
  private phase = Math.random() * 10;

  constructor(look: NpcLook, position: THREE.Vector3, yaw: number) {
    this.baseYaw = yaw;
    const b = look.build;
    for (const side of [-0.1, 0.1]) this.group.add(part(new THREE.CylinderGeometry(0.075 * b, 0.065, 0.82, 8), look.under, side * b, 0.41, 0));
    this.torso = new THREE.Group();
    this.torso.position.y = 0.82;
    this.torso.add(part(new THREE.CylinderGeometry(0.21 * b, 0.3 * b, 0.62, 12), look.coat, 0, 0.12, 0));
    this.torso.add(part(new THREE.CapsuleGeometry(0.19 * b, 0.32, 4, 12), look.coat, 0, 0.46, 0));
    this.torso.add(part(new THREE.CylinderGeometry(0.2 * b, 0.21 * b, 0.06, 12), look.under, 0, 0.26, 0));
    for (const side of [-1, 1]) {
      const arm = part(new THREE.CapsuleGeometry(0.055 * b, 0.46, 4, 8), look.coat, side * 0.26 * b, 0.4, 0.02);
      arm.rotation.z = side * 0.12;
      this.torso.add(arm);
      this.torso.add(part(new THREE.SphereGeometry(0.05, 8, 6), look.skin, side * 0.29 * b, 0.1, 0.04));
    }
    this.group.add(this.torso);
    this.head = new THREE.Group();
    this.head.position.y = 1.62;
    this.head.add(part(new THREE.SphereGeometry(0.125, 16, 12), look.skin, 0, 0, 0));
    this.head.add(part(new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), look.hair, 0, 0.015, -0.01));
    this.head.add(part(new THREE.BoxGeometry(0.03, 0.05, 0.04), look.skin, 0, -0.01, 0.125));
    for (const side of [-0.045, 0.045]) this.head.add(part(new THREE.SphereGeometry(0.014, 6, 4), 0x161210, side, 0.02, 0.115));
    if (look.hat === 'cap') this.head.add(part(new THREE.CylinderGeometry(0.135, 0.14, 0.08, 14), look.under, 0, 0.1, 0));
    if (look.hat === 'hood') this.head.add(part(new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), look.coat, 0, 0.0, -0.02));
    this.group.add(this.head);
    this.group.position.copy(position);
    this.group.rotation.y = yaw;
  }

  get headPosition(): THREE.Vector3 {
    return this.group.position.clone().setY(this.group.position.y + 1.6);
  }

  setYaw(yaw: number): void {
    this.baseYaw = yaw;
  }

  /** Breathe, and turn the head toward the player when they're close. */
  update(dt: number, playerPos: THREE.Vector3): void {
    this.phase += dt;
    this.torso.scale.y = 1 + Math.sin(this.phase * 1.8) * 0.012;
    const toPlayer = playerPos.clone().sub(this.group.position);
    let target = 0;
    if (toPlayer.lengthSq() < 36) {
      const desired = Math.atan2(toPlayer.x, toPlayer.z);
      target = Math.max(-1.1, Math.min(1.1, wrapAngle(desired - this.baseYaw)));
    }
    this.headYaw = damp(this.headYaw, target, 5, dt);
    this.head.rotation.y = this.headYaw;
    this.group.rotation.y = this.baseYaw + this.headYaw * 0.25;
  }
}
