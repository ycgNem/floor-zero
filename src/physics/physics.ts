import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export type Collider = RAPIER.Collider;
export type CharacterController = RAPIER.KinematicCharacterController;

/** Collision layers. World geometry blocks everything; actors only collide with the world. */
export const Layer = {
  world: 0x0001,
  player: 0x0002,
  enemy: 0x0004,
  all: 0xffff,
} as const;

export function groups(membership: number, filter: number): number {
  return (((membership & 0xffff) << 16) | (filter & 0xffff)) >>> 0;
}

/** Query groups that only see world geometry. */
export const WORLD_ONLY = groups(Layer.all, Layer.world);

export interface RayHit {
  distance: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
}

export class Physics {
  readonly world: RAPIER.World;

  static async create(): Promise<Physics> {
    await RAPIER.init();
    return new Physics();
  }

  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
  }

  step(): void {
    this.world.step();
  }

  addBox(center: THREE.Vector3, size: THREE.Vector3, rotation?: THREE.Quaternion): Collider {
    const desc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
      .setTranslation(center.x, center.y, center.z)
      .setCollisionGroups(groups(Layer.world, Layer.all));
    if (rotation) desc.setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
    return this.world.createCollider(desc);
  }

  addCylinder(center: THREE.Vector3, radius: number, height: number): Collider {
    const desc = RAPIER.ColliderDesc.cylinder(height / 2, radius)
      .setTranslation(center.x, center.y, center.z)
      .setCollisionGroups(groups(Layer.world, Layer.all));
    return this.world.createCollider(desc);
  }

  /** Static triangle-mesh collider from world-space, non-indexed positions. */
  addTrimesh(positions: Float32Array): Collider {
    const indices = new Uint32Array(positions.length / 3);
    for (let i = 0; i < indices.length; i++) indices[i] = i;
    const desc = RAPIER.ColliderDesc.trimesh(positions, indices).setCollisionGroups(groups(Layer.world, Layer.all));
    return this.world.createCollider(desc);
  }

  /** A capsule for an actor, standing with its feet at `feet`. */
  /** A capsule standing on `feet`, centred height / 2 above them. Squat actors get a thinner capsule so it never sinks into the floor. */
  addActorCapsule(feet: THREE.Vector3, radius: number, height: number, layer: number): Collider {
    const r = Math.min(radius, height / 2);
    const halfHeight = Math.max(0.01, height / 2 - r);
    const desc = RAPIER.ColliderDesc.capsule(halfHeight, r)
      .setTranslation(feet.x, feet.y + height / 2, feet.z)
      .setCollisionGroups(groups(layer, Layer.world));
    return this.world.createCollider(desc);
  }

  createCharacterController(): CharacterController {
    const controller = this.world.createCharacterController(0.02);
    controller.enableAutostep(0.45, 0.2, false);
    controller.enableSnapToGround(0.35);
    controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    controller.setMinSlopeSlideAngle((60 * Math.PI) / 180);
    controller.setSlideEnabled(true);
    return controller;
  }

  /** Moves a collider through the world with sliding. Returns the movement applied and grounding. */
  moveActor(
    controller: CharacterController,
    collider: Collider,
    delta: THREE.Vector3,
  ): { moved: THREE.Vector3; grounded: boolean } {
    controller.computeColliderMovement(collider, delta, undefined, WORLD_ONLY);
    const m = controller.computedMovement();
    const t = collider.translation();
    collider.setTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    return { moved: new THREE.Vector3(m.x, m.y, m.z), grounded: controller.computedGrounded() };
  }

  /** Ray cast against world geometry only. `dir` must be normalized. */
  castRay(origin: THREE.Vector3, dir: THREE.Vector3, maxDistance: number): RayHit | null {
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRayAndGetNormal(ray, maxDistance, true, undefined, WORLD_ONLY);
    if (!hit) return null;
    const distance = hit.timeOfImpact;
    return {
      distance,
      point: origin.clone().addScaledVector(dir, distance),
      normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
    };
  }

  /** True if nothing in the world blocks the straight line between a and b. */
  lineOfSight(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const dir = b.clone().sub(a);
    const length = dir.length();
    if (length < 1e-4) return true;
    dir.divideScalar(length);
    return this.castRay(a, dir, length - 0.05) === null;
  }

  remove(collider: Collider): void {
    this.world.removeCollider(collider, false);
  }

  /** Line segments of every collider, for the debug view. */
  debugLines(): { vertices: Float32Array; colors: Float32Array } {
    return this.world.debugRender();
  }
}
