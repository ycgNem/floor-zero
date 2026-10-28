import * as THREE from 'three';
import type { Input } from '../core/input';
import { clamp, damp } from '../core/math';
import { Layer, type CharacterController, type Collider, type Physics } from '../physics/physics';

export const PLAYER_HEIGHT = 1.8;
export const PLAYER_RADIUS = 0.35;
const EYE_HEIGHT = 1.65;
const CROUCH_EYE = 1.1;
const WALK_SPEED = 4.2;
const SPRINT_SPEED = 6.4;
const CROUCH_SPEED = 2.2;
const GRAVITY = 22;
const JUMP_SPEED = 7;
const COYOTE_TIME = 0.12;
const DASH_SPEED = 13;
const DASH_TIME = 0.17;
const DASH_RECHARGE = 1.5;
export const DASH_CHARGES = 2;

export interface PlayerSettings {
  fov: number;
  headBob: boolean;
}

/** First-person movement and camera. Health and combat live elsewhere. */
export class Player {
  yaw = 0;
  pitch = 0;
  readonly velocity = new THREE.Vector3();
  grounded = false;
  crouching = false;
  /** Multiplies move speed. Combat sets it every step (eating, aiming). */
  speedMultiplier = 1;
  dashCharges = DASH_CHARGES;
  /** Multiplies dash recharge time (meal buffs). */
  dashRechargeScale = 1;
  /** Seconds of invulnerability left (dash i-frames, respawn grace). */
  invulnerable = 0;
  /** Cutscenes: no movement or look. */
  frozen = false;
  noclip = false;
  settings: PlayerSettings = { fov: 85, headBob: true };
  /** Added to the field of view: negative zooms in (aiming). */
  fovOffset = 0;
  /** This frame's look input, for viewmodel sway. */
  readonly lookDelta = { yaw: 0, pitch: 0 };
  onDash: (() => void) | null = null;
  onLand: ((speed: number) => void) | null = null;

  private readonly collider: Collider;
  private readonly controller: CharacterController;
  private readonly feet = new THREE.Vector3();
  private readonly prevFeet = new THREE.Vector3();
  private readonly renderFeet = new THREE.Vector3();
  private readonly dashDir = new THREE.Vector3();
  private dashTime = 0;
  private dashRecharge = 0;
  private coyote = 0;
  private eye = EYE_HEIGHT;
  private bobPhase = 0;
  private bobAmount = 0;
  private fovKick = 0;
  private shake = 0;

  constructor(
    private readonly physics: Physics,
    private readonly input: Input,
    readonly camera: THREE.PerspectiveCamera,
  ) {
    this.collider = physics.addActorCapsule(new THREE.Vector3(), PLAYER_RADIUS, PLAYER_HEIGHT, Layer.player);
    this.controller = physics.createCharacterController();
  }

  /** Feet position in the simulation. */
  get position(): THREE.Vector3 {
    return this.feet;
  }

  /** Eye position in the simulation, for aiming and line of sight. */
  eyePosition(target = new THREE.Vector3()): THREE.Vector3 {
    return target.copy(this.feet).setY(this.feet.y + this.eye);
  }

  /** Centre of mass, for enemies to aim at. */
  chestPosition(target = new THREE.Vector3()): THREE.Vector3 {
    return target.copy(this.feet).setY(this.feet.y + (this.crouching ? 0.8 : 1.2));
  }

  aimDirection(target = new THREE.Vector3()): THREE.Vector3 {
    const cp = Math.cos(this.pitch);
    return target.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  get dashing(): boolean {
    return this.dashTime > 0;
  }

  teleport(pos: THREE.Vector3, yaw: number): void {
    this.feet.copy(pos);
    this.prevFeet.copy(pos);
    this.collider.setTranslation({ x: pos.x, y: pos.y + PLAYER_HEIGHT / 2, z: pos.z });
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
  }

  addShake(amount: number): void {
    this.shake = Math.min(1, this.shake + amount);
  }

  /** Knocks the player (surges, charges). */
  push(impulse: THREE.Vector3): void {
    this.velocity.add(impulse);
  }

  fixedUpdate(dt: number): void {
    this.prevFeet.copy(this.feet);
    if (this.invulnerable > 0) this.invulnerable -= dt;
    if (this.dashCharges < DASH_CHARGES) {
      this.dashRecharge += dt;
      if (this.dashRecharge >= DASH_RECHARGE * this.dashRechargeScale) {
        this.dashCharges++;
        this.dashRecharge = 0;
      }
    }

    const input = this.input;
    const active = !this.frozen;
    const forward = active ? (input.isDown('forward') ? 1 : 0) - (input.isDown('back') ? 1 : 0) : 0;
    const strafe = active ? (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0) : 0;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wish = new THREE.Vector3(-sin * forward + cos * strafe, 0, -cos * forward - sin * strafe);
    if (wish.lengthSq() > 1) wish.normalize();

    if (this.noclip) {
      const fly = this.aimDirection().multiplyScalar(forward * 12).add(new THREE.Vector3(cos * strafe * 12, 0, -sin * strafe * 12));
      this.feet.addScaledVector(fly, dt);
      this.collider.setTranslation({ x: this.feet.x, y: this.feet.y + PLAYER_HEIGHT / 2, z: this.feet.z });
      this.velocity.set(0, 0, 0);
      return;
    }

    this.crouching = active && input.isDown('crouch');
    const sprinting = input.isDown('dash') && !this.crouching;
    const speed = (this.crouching ? CROUCH_SPEED : sprinting ? SPRINT_SPEED : WALK_SPEED) * this.speedMultiplier;

    if (active && input.wasPressed('dash') && this.dashCharges > 0) {
      this.dashCharges--;
      this.dashTime = DASH_TIME;
      this.dashDir.copy(wish.lengthSq() > 0.01 ? wish : new THREE.Vector3(-sin, 0, -cos)).normalize();
      this.invulnerable = Math.max(this.invulnerable, 0.22);
      this.fovKick = 1;
      this.onDash?.();
    }

    const accel = this.grounded ? 14 : 3;
    this.velocity.x = damp(this.velocity.x, wish.x * speed, accel, dt);
    this.velocity.z = damp(this.velocity.z, wish.z * speed, accel, dt);
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.velocity.x = this.dashDir.x * DASH_SPEED;
      this.velocity.z = this.dashDir.z * DASH_SPEED;
    }

    this.coyote = this.grounded ? COYOTE_TIME : this.coyote - dt;
    if (active && input.wasPressed('jump') && this.coyote > 0) {
      this.velocity.y = JUMP_SPEED;
      this.coyote = 0;
    }
    this.velocity.y = Math.max(this.velocity.y - GRAVITY * dt, -30);

    const delta = this.velocity.clone().multiplyScalar(dt);
    const wasGrounded = this.grounded;
    const fallSpeed = -this.velocity.y;
    const { moved, grounded } = this.physics.moveActor(this.controller, this.collider, delta);
    this.grounded = grounded;
    if (grounded && this.velocity.y < 0) this.velocity.y = 0;
    if (delta.y > 0 && moved.y < delta.y * 0.5) this.velocity.y = 0;
    if (grounded && !wasGrounded && fallSpeed > 4) this.onLand?.(fallSpeed);

    const t = this.collider.translation();
    this.feet.set(t.x, t.y - PLAYER_HEIGHT / 2, t.z);
  }

  /** Per-frame camera update: look, interpolation, bob, shake, FOV. */
  frameUpdate(dt: number, alpha: number): void {
    const look = this.input.consumeLook(dt);
    this.lookDelta.yaw = this.frozen ? 0 : look.yaw;
    this.lookDelta.pitch = this.frozen ? 0 : look.pitch;
    if (!this.frozen) {
      this.yaw -= look.yaw;
      this.pitch = clamp(this.pitch - look.pitch, -1.45, 1.45);
    }

    this.renderFeet.lerpVectors(this.prevFeet, this.feet, alpha);
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    this.eye = damp(this.eye, this.crouching ? CROUCH_EYE : EYE_HEIGHT, 12, dt);
    const bobbing = this.grounded && speed > 0.5 && this.settings.headBob;
    this.bobAmount = damp(this.bobAmount, bobbing ? Math.min(1, speed / WALK_SPEED) : 0, 8, dt);
    if (bobbing) this.bobPhase += dt * speed * 1.7;
    const bobY = Math.sin(this.bobPhase * 2) * 0.035 * this.bobAmount;
    const bobX = Math.cos(this.bobPhase) * 0.025 * this.bobAmount;

    this.shake = Math.max(0, this.shake - dt * 2.5);
    const shake = this.shake * this.shake;
    const jitter = (): number => (Math.random() - 0.5) * shake;

    this.camera.position.set(
      this.renderFeet.x + Math.cos(this.yaw) * bobX,
      this.renderFeet.y + this.eye + bobY,
      this.renderFeet.z - Math.sin(this.yaw) * bobX,
    );
    this.camera.rotation.set(this.pitch + jitter() * 0.06, this.yaw + jitter() * 0.06, jitter() * 0.03, 'YXZ');

    this.fovKick = Math.max(0, this.fovKick - dt * 3);
    const sprinting = speed > WALK_SPEED + 0.5;
    const targetFov = this.settings.fov + this.fovOffset + (sprinting ? 4 : 0) + this.fovKick * 8;
    const fov = damp(this.camera.fov, targetFov, 10, dt);
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
