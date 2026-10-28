import * as THREE from 'three';
import { damp } from '../core/math';
import type { ItemId } from '../data/items';
import { environment } from '../render/environment';
import { dress, loadModels } from '../render/models';
import type { Renderer } from '../render/renderer';
import type { MaterialKey, MaterialLibrary } from '../world/materials';

export type Held = 'none' | 'pickaxe' | 'blade' | 'boltcaster' | 'rod' | 'resonance';
export type SwingKind = 'mine' | 'slash' | 'slash2' | 'recoil' | 'cast' | 'grab' | 'eat' | 'thrust';

const TIER_MAT: Partial<Record<ItemId, MaterialKey>> = {
  copper_pickaxe: 'tool_copper',
  iron_pickaxe: 'tool_iron',
  cobalt_pickaxe: 'tool_cobalt',
  copper_blade: 'tool_copper',
  iron_blade: 'tool_iron',
  cobalt_blade: 'tool_cobalt',
};

type Tool = Exclude<Held, 'none'>;

/** How each modelled tool (tools/blender/viewmodels.py) sits in view: size, angle, and a nudge. */
const POSES: Record<Tool, { scale: number; rot: readonly [number, number, number]; at: readonly [number, number, number] }> = {
  pickaxe: { scale: 0.75, rot: [-0.1, 0.5, 0.5], at: [0, 0.08, 0.05] },
  blade: { scale: 0.9, rot: [-0.4, -0.25, -0.3], at: [0, 0.07, 0.04] },
  // Angled out toward the water so the tip, and the line, stay in view while you watch the float.
  rod: { scale: 0.85, rot: [-1.05, 0.1, 0.12], at: [0, 0.1, 0.02] },
  boltcaster: { scale: 1, rot: [0.06, 0.08, 0], at: [-0.12, 0.1, 0.06] },
  resonance: { scale: 1, rot: [0.05, 0.1, 0], at: [-0.08, 0.14, 0.05] },
};

/** The tool in your hands, drawn in its own overlay scene so it never clips into walls. */
export class Viewmodel {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.01, 10);
  private readonly root = new THREE.Group();
  private readonly hemi = new THREE.HemisphereLight(0xfff1dd, 0x3a3a44, 1.1);
  private models = new Map<string, THREE.Object3D>();
  private held: Held = 'none';
  private swingTime = 0;
  private swingDuration = 0;
  private swingKind: SwingKind = 'mine';
  private bobPhase = 0;
  private swayX = 0;
  private swayY = 0;
  private lower = 1;

  constructor(
    private readonly materials: MaterialLibrary,
    renderer: Renderer,
  ) {
    const key = new THREE.DirectionalLight(0xffd7a8, 1.6);
    key.position.set(-1, 2, 1.5);
    this.scene.add(this.hemi, key, this.root);
    // Something for tool metal to reflect: a dark room, one warm lamp, the cold depths.
    this.scene.environment = environment(renderer.gl, {
      ambient: new THREE.Color(0.012, 0.011, 0.011),
      lamp: new THREE.Color(4.2, 2.5, 1.15),
      depths: new THREE.Color(0.22, 0.4, 0.75),
      floor: new THREE.Color(0.45, 0.32, 0.22),
    });
    renderer.setOverlay(this.scene, this.camera);
    const resize = (): void => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', resize);
    resize();
  }

  /** Loads the modelled tools. Until (or unless) they arrive, primitive stand-ins are used. */
  async preload(): Promise<void> {
    this.models = await loadModels('viewmodels.glb');
    this.root.userData.key = null;
  }

  /** Dimmer in caves so the tool sits in the scene's light. */
  setAmbient(intensity: number): void {
    this.hemi.intensity = intensity;
    this.scene.environmentIntensity = intensity * 0.9;
  }

  setHeld(held: Held, tierItem: ItemId | null = null): void {
    const key = `${held}:${tierItem ?? ''}`;
    if (this.root.userData.key === key) return;
    this.root.userData.key = key;
    this.root.clear();
    this.held = held;
    if (held === 'none') return;
    const model = this.build(held, tierItem);
    this.root.add(model);
    this.lower = 1;
  }

  get current(): Held {
    return this.held;
  }

  swing(duration: number, kind: SwingKind): void {
    this.swingDuration = duration;
    this.swingTime = 0;
    this.swingKind = kind;
  }

  /** Where the rod tip is on screen, in normalized device coordinates, or null without a rod in hand. */
  rodTipNdc(target: THREE.Vector3): THREE.Vector3 | null {
    if (this.held !== 'rod') return null;
    const tip = this.root.getObjectByName('rod-tip');
    if (!tip) return null;
    this.root.updateMatrixWorld(true);
    this.camera.updateMatrixWorld();
    return tip.getWorldPosition(target).project(this.camera);
  }

  get swinging(): boolean {
    return this.swingTime < this.swingDuration;
  }

  update(dt: number, speed: number, lookYaw: number, lookPitch: number, visible: boolean): void {
    this.swingTime += dt;
    this.bobPhase += dt * (1.5 + speed * 1.6);
    this.swayX = damp(this.swayX, -lookYaw * 6, 10, dt);
    this.swayY = damp(this.swayY, lookPitch * 6, 10, dt);
    this.lower = damp(this.lower, visible ? 0 : 1, 10, dt);
    const bob = Math.min(1, speed / 4);
    const base = new THREE.Vector3(0.3 + this.swayX * 0.02, -0.38 - this.lower * 0.5 + Math.sin(this.bobPhase * 2) * 0.012 * bob + this.swayY * 0.02, -0.66);
    const rot = new THREE.Euler(0, 0.12, 0);
    const t = this.swingDuration > 0 ? Math.min(1, this.swingTime / this.swingDuration) : 1;
    if (t < 1) this.applySwing(t, base, rot);
    this.root.position.copy(base);
    this.root.rotation.copy(rot);
  }

  private applySwing(t: number, pos: THREE.Vector3, rot: THREE.Euler): void {
    const ease = (x: number): number => x * x * (3 - 2 * x);
    switch (this.swingKind) {
      case 'mine': {
        // Wind up slowly, strike fast at the end.
        const raise = t < 0.7 ? ease(t / 0.7) : 1 - ease((t - 0.7) / 0.3) * 1.4;
        rot.x += raise * 0.7;
        rot.z -= raise * 0.2;
        pos.y += raise * 0.08 - Math.max(0, -raise) * 0.1;
        pos.z += raise * 0.06;
        break;
      }
      case 'slash':
      case 'slash2': {
        const dir = this.swingKind === 'slash' ? 1 : -1;
        const s = t < 0.25 ? ease(t / 0.25) : 1 - ease((t - 0.25) / 0.75);
        const arc = t < 0.25 ? -ease(t / 0.25) : -1 + ease(Math.min(1, (t - 0.25) / 0.3)) * 2;
        rot.z += arc * dir * 1.2 * (t < 0.55 ? 1 : 1 - ease((t - 0.55) / 0.45));
        rot.y += arc * dir * 0.6 * s;
        pos.x -= arc * dir * 0.15 * s;
        break;
      }
      case 'thrust': {
        const s = t < 0.3 ? ease(t / 0.3) : 1 - ease((t - 0.3) / 0.7);
        pos.z -= s * 0.35;
        pos.x -= s * 0.12;
        break;
      }
      case 'recoil': {
        const s = 1 - ease(t);
        pos.z += s * 0.1;
        rot.x += s * 0.25;
        break;
      }
      case 'cast': {
        const s = t < 0.4 ? -ease(t / 0.4) : -1 + ease((t - 0.4) / 0.6) * 1.4;
        rot.x += s * 0.9;
        break;
      }
      case 'grab': {
        const s = t < 0.5 ? ease(t / 0.5) : 1 - ease((t - 0.5) / 0.5);
        pos.z -= s * 0.2;
        pos.y -= s * 0.1;
        break;
      }
      case 'eat': {
        const s = t < 0.3 ? ease(t / 0.3) : t > 0.8 ? 1 - ease((t - 0.8) / 0.2) : 1;
        pos.x -= s * 0.25;
        pos.y += s * 0.18 + Math.sin(t * 40) * 0.01 * s;
        break;
      }
    }
  }

  private mesh(geometry: THREE.BufferGeometry, mat: MaterialKey, x: number, y: number, z: number): THREE.Mesh {
    const m = new THREE.Mesh(geometry, this.materials.get(mat));
    this.materials.fit(m);
    m.position.set(x, y, z);
    return m;
  }

  private build(held: Held, tierItem: ItemId | null): THREE.Group {
    const tier = (tierItem && TIER_MAT[tierItem]) || 'tool_iron';
    const model = held === 'none' ? undefined : this.models.get(held);
    const hand = this.models.get('hand');
    if (held !== 'none' && model) {
      const g = new THREE.Group();
      const pose = POSES[held];
      const tool = dress(model, this.materials, { tier });
      if (hand) tool.getObjectByName(`${held}_grip`)?.add(dress(hand, this.materials));
      tool.scale.setScalar(pose.scale);
      tool.rotation.set(...pose.rot);
      tool.position.set(...pose.at);
      g.add(tool);
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) o.frustumCulled = false;
      });
      return g;
    }
    return this.buildPrimitive(held, tier);
  }

  /** The stand-in tools made of primitives, for when the models haven't loaded. */
  private buildPrimitive(held: Held, tier: MaterialKey): THREE.Group {
    const g = new THREE.Group();
    const glove = this.mesh(new THREE.BoxGeometry(0.09, 0.1, 0.12), 'wood_dark', 0, -0.02, 0.06);
    switch (held) {
      case 'pickaxe': {
        const handle = this.mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.62, 8), 'wood', 0, 0.2, 0);
        const head = this.mesh(new THREE.BoxGeometry(0.42, 0.06, 0.06), tier, 0, 0.5, 0);
        const tipL = this.mesh(new THREE.ConeGeometry(0.03, 0.12, 6), tier, -0.26, 0.47, 0);
        tipL.rotation.z = Math.PI / 2 + 0.3;
        const tipR = this.mesh(new THREE.ConeGeometry(0.03, 0.1, 6), tier, 0.25, 0.47, 0);
        tipR.rotation.z = -Math.PI / 2 - 0.3;
        g.add(handle, head, tipL, tipR, glove);
        g.scale.setScalar(0.72);
        g.rotation.set(-0.1, 0.35, 0.4);
        break;
      }
      case 'blade': {
        const grip = this.mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), 'wood_dark', 0, 0, 0);
        const guard = this.mesh(new THREE.BoxGeometry(0.16, 0.025, 0.04), 'metal', 0, 0.09, 0);
        const blade = this.mesh(new THREE.BoxGeometry(0.045, 0.62, 0.012), tier, 0, 0.41, 0);
        const tip = this.mesh(new THREE.ConeGeometry(0.032, 0.08, 4), tier, 0, 0.76, 0);
        tip.scale.z = 0.3;
        g.add(grip, guard, blade, tip, glove);
        g.rotation.set(-0.5, 0, -0.2);
        break;
      }
      case 'boltcaster': {
        const stock = this.mesh(new THREE.BoxGeometry(0.07, 0.08, 0.5), 'wood', 0, 0, 0.05);
        const rail = this.mesh(new THREE.BoxGeometry(0.03, 0.02, 0.5), 'metal', 0, 0.05, -0.15);
        const limbs = this.mesh(new THREE.BoxGeometry(0.5, 0.025, 0.04), 'metal', 0, 0.04, -0.36);
        const bolt = this.mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 6), 'wood_dark', 0, 0.07, -0.2);
        bolt.rotation.x = Math.PI / 2;
        g.add(stock, rail, limbs, bolt, glove);
        g.position.x = -0.12;
        break;
      }
      case 'rod': {
        // Angled out toward the water so the tip, and the line, stay in view while you watch the float.
        const rod = this.mesh(new THREE.CylinderGeometry(0.006, 0.016, 1.3, 6), 'wood', 0, 0.3, -0.45);
        rod.rotation.x = -1.15;
        const tip = new THREE.Object3D();
        tip.name = 'rod-tip';
        tip.position.y = 0.65;
        rod.add(tip);
        const reel = this.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12), 'metal', 0.04, 0.05, 0);
        reel.rotation.z = Math.PI / 2;
        g.add(rod, reel, glove);
        break;
      }
      case 'resonance': {
        const body = this.mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.22, 10), 'rust', 0, 0.06, -0.05);
        const lens = this.mesh(new THREE.SphereGeometry(0.06, 12, 10), 'core', 0, 0.06, -0.18);
        body.rotation.x = Math.PI / 2;
        g.add(body, lens, glove);
        break;
      }
      case 'none':
        break;
    }
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) o.frustumCulled = false;
    });
    return g;
  }
}
