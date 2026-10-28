import * as THREE from 'three';
import { damp, wrapAngle } from '../core/math';
import type { ItemId } from '../data/items';
import type { Game } from '../game';
import { createGlowTexture } from '../render/textures';
import { Layer, type CharacterController, type Collider } from '../physics/physics';

export interface EnemySpawn {
  /** Stable id: kills are remembered until the next day. */
  id: string;
  type: EnemyType;
  at: readonly [number, number, number];
  yaw?: number;
}

export type EnemyType = 'scuttler' | 'bellcap' | 'slagback' | 'rivet_sentry' | 'lampwarden' | 'sinkmaw' | 'brood_nest' | 'hollowhorn' | 'sluicekeeper';

export interface Drop {
  item: ItemId;
  chance: number;
  count?: number;
}

/** Shared services an enemy needs, provided by Combat. */
export interface EnemyHost {
  game: Game;
  controller: CharacterController;
  requestToken(enemy: Enemy): boolean;
  releaseToken(enemy: Enemy): void;
  damagePlayer(amount: number, from: THREE.Vector3, knockback?: THREE.Vector3): void;
}

/** Base for every creature and construct: health, hit flash, movement, facing. */
let blobMaterial: THREE.MeshBasicMaterial | null = null;

/** A soft dark disc underfoot, so enemies sit on the floor where lamps cast no shadow for them. */
function blobShadow(radius: number): THREE.Mesh {
  blobMaterial ??= new THREE.MeshBasicMaterial({
    color: 0x000000,
    map: createGlowTexture(),
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2.8, radius * 2.8), blobMaterial);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  return mesh;
}

export abstract class Enemy {
  abstract readonly type: EnemyType;
  abstract readonly displayName: string;
  readonly group = new THREE.Group();
  readonly position: THREE.Vector3;
  yaw: number;
  health: number;
  alive = true;
  aggro = false;
  state = 'idle';
  stateTime = 0;
  /** Takes extra damage while true (stunned, exposed). */
  vulnerable = false;
  /** Blocks damage while > 0 (a Lampwarden's field). */
  shielded = 0;
  protected flash = 0;
  protected readonly flashMaterials: THREE.MeshStandardMaterial[] = [];
  protected collider: Collider | null = null;
  protected velocityY = 0;
  hasToken = false;
  /** Bosses get the big health bar at the top of the screen. */
  readonly boss: boolean = false;

  constructor(
    protected readonly host: EnemyHost,
    readonly spawnId: string,
    position: THREE.Vector3,
    yaw: number,
    readonly maxHealth: number,
    readonly radius: number,
    readonly height: number,
    readonly drops: Drop[],
    mobile: boolean,
  ) {
    this.position = position.clone();
    this.yaw = yaw;
    this.health = maxHealth;
    if (mobile) this.collider = host.game.physics.addActorCapsule(this.position, Math.min(radius, 0.6), Math.max(height, 0.5), Layer.enemy);
    this.group.position.copy(this.position);
    this.group.rotation.y = yaw;
    this.group.userData.dynamic = true;
    this.group.add(blobShadow(radius));
  }

  /** A material this enemy owns, so its hit flash doesn't light up its neighbours. */
  protected mat(color: number, o: { roughness?: number; metalness?: number; emissive?: number; emissiveIntensity?: number } = {}): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ color, roughness: o.roughness ?? 0.8, metalness: o.metalness ?? 0, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissiveIntensity ?? 1 });
    m.userData.baseEmissive = new THREE.Color(o.emissive ?? 0x000000);
    m.userData.baseIntensity = o.emissiveIntensity ?? 1;
    this.flashMaterials.push(m);
    return m;
  }

  protected part(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.group): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  get game(): Game {
    return this.host.game;
  }

  get center(): THREE.Vector3 {
    return this.position.clone().setY(this.position.y + this.height * 0.5);
  }

  setState(state: string): void {
    this.state = state;
    this.stateTime = 0;
  }

  distanceToPlayer(): number {
    return this.position.distanceTo(this.game.player.position);
  }

  canSeePlayer(range: number): boolean {
    if (this.distanceToPlayer() > range) return false;
    return this.game.physics.lineOfSight(this.center, this.game.player.eyePosition());
  }

  /** Turns toward a point at `rate` radians per second-ish. Returns the remaining angle. */
  face(target: THREE.Vector3, rate: number, dt: number): number {
    const desired = Math.atan2(target.x - this.position.x, target.z - this.position.z);
    const delta = wrapAngle(desired - this.yaw);
    this.yaw = wrapAngle(this.yaw + delta * Math.min(1, rate * dt));
    return Math.abs(delta);
  }

  /** Moves with world collision. Returns the fraction of the desired move that happened. */
  move(direction: THREE.Vector3, speed: number, dt: number): number {
    if (!this.collider) return 0;
    this.velocityY = Math.max(this.velocityY - 20 * dt, -20);
    const desired = new THREE.Vector3(direction.x * speed * dt, this.velocityY * dt, direction.z * speed * dt);
    const { moved, grounded } = this.game.physics.moveActor(this.host.controller, this.collider, desired);
    if (grounded) this.velocityY = 0;
    const t = this.collider.translation();
    this.position.set(t.x, t.y - Math.max(this.height, 0.5) / 2, t.z);
    const want = Math.hypot(desired.x, desired.z);
    return want > 1e-5 ? Math.hypot(moved.x, moved.z) / want : 1;
  }

  /** Whether it takes up space: the player and other creatures are kept out of it. */
  get solid(): boolean {
    return true;
  }

  get mobile(): boolean {
    return this.collider !== null;
  }

  /**
   * Pushes this enemy out to `distance` from `point`, sliding along walls. Enemies only collide with
   * the world, so this keeps them from crawling inside the player or stacking on each other.
   */
  keepClear(point: THREE.Vector3, distance: number, share = 1): void {
    if (!this.collider) return;
    const dx = this.position.x - point.x;
    const dz = this.position.z - point.z;
    const d = Math.hypot(dx, dz);
    if (d >= distance) return;
    const push = (distance - d) * share;
    const nx = d > 1e-4 ? dx / d : Math.sin(this.yaw + Math.PI);
    const nz = d > 1e-4 ? dz / d : Math.cos(this.yaw + Math.PI);
    this.game.physics.moveActor(this.host.controller, this.collider, new THREE.Vector3(nx * push, 0, nz * push));
    const t = this.collider.translation();
    this.position.set(t.x, t.y - Math.max(this.height, 0.5) / 2, t.z);
  }

  /** Is a sphere at `point` touching this enemy? Approximated as a vertical capsule. */
  hitTest(point: THREE.Vector3, radius: number): boolean {
    const y = Math.max(this.position.y + this.radius, Math.min(this.position.y + this.height - this.radius, point.y));
    const dx = point.x - this.position.x;
    const dz = point.z - this.position.z;
    const dy = point.y - y;
    const r = this.radius + radius;
    return dx * dx + dy * dy + dz * dz <= r * r;
  }

  /** Returns damage actually dealt. */
  damage(amount: number, from: THREE.Vector3): number {
    if (!this.alive) return 0;
    if (this.shielded > 0) {
      this.flash = 0.3;
      return 0;
    }
    const dealt = Math.round(amount * (this.vulnerable ? 1.5 : 1));
    this.health -= dealt;
    this.flash = 1;
    this.aggro = true;
    this.onHurt(from);
    if (this.health <= 0) this.alive = false;
    return dealt;
  }

  protected onHurt(_from: THREE.Vector3): void {}

  /** Called every fixed step while alive. */
  abstract think(dt: number): void;

  update(dt: number): void {
    this.stateTime += dt;
    if (this.shielded > 0) this.shielded -= dt;
    this.think(dt);
  }

  /** Per-frame visuals: flash, transform, animation. */
  frame(dt: number, time: number): void {
    this.flash = Math.max(0, this.flash - dt * 5);
    for (const m of this.flashMaterials) {
      const base = m.userData.baseEmissive as THREE.Color;
      m.emissive.copy(base).lerp(new THREE.Color(1, 0.85, 0.75), this.flash);
      m.emissiveIntensity = damp(m.emissiveIntensity, this.flash > 0 ? 2 : (m.userData.baseIntensity as number), 20, dt);
    }
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    this.animate(dt, time);
  }

  protected animate(_dt: number, _time: number): void {}

  dispose(): void {
    if (this.collider) this.game.physics.remove(this.collider);
    this.collider = null;
    if (this.hasToken) this.host.releaseToken(this);
    this.group.removeFromParent();
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of this.flashMaterials) m.dispose();
  }
}
