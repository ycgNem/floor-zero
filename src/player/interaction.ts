import * as THREE from 'three';
import type { Input } from '../core/input';
import type { Physics } from '../physics/physics';
import type { Interactable } from '../world/area';

const DEFAULT_RANGE = 2.8;
const tmpDir = new THREE.Vector3();
const tmpTo = new THREE.Vector3();

/** Finds what the player is looking at and routes E presses and holds to it. */
export class Interaction {
  target: Interactable | null = null;
  private holding: Interactable | null = null;

  constructor(
    private readonly physics: Physics,
    private readonly input: Input,
    private readonly camera: THREE.Camera,
  ) {}

  update(dt: number, interactables: readonly Interactable[], blocked: boolean): void {
    this.target = blocked ? null : this.pick(interactables);
    const target = this.target;

    if (target?.mode === 'press' && this.input.wasPressed('interact')) target.press?.();

    const held = target?.mode === 'hold' && this.input.isDown('interact') ? target : null;
    if (this.holding && this.holding !== held) this.cancel();
    if (held) {
      if (!this.holding) {
        this.holding = held;
        held.holdStart?.();
      }
      held.holdTick?.(dt);
    }
  }

  cancel(): void {
    this.holding?.holdEnd?.();
    this.holding = null;
  }

  private pick(interactables: readonly Interactable[]): Interactable | null {
    const origin = this.camera.position;
    const dir = this.camera.getWorldDirection(tmpDir);
    let best: Interactable | null = null;
    let bestT = Infinity;
    for (const item of interactables) {
      if (!item.enabled()) continue;
      tmpTo.subVectors(item.position, origin);
      const t = tmpTo.dot(dir);
      if (t < 0 || t > (item.range ?? DEFAULT_RANGE) + item.radius) continue;
      const missSq = tmpTo.lengthSq() - t * t;
      if (missSq > item.radius * item.radius) continue;
      if (t < bestT) {
        best = item;
        bestT = t;
      }
    }
    if (!best) return null;
    // Occluded if world geometry is hit well before the object's near surface.
    const hit = this.physics.castRay(origin.clone(), dir.clone(), bestT);
    if (hit && hit.distance < bestT - best.radius - 0.1) return null;
    return best;
  }
}
