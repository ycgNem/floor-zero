import * as THREE from 'three';
import { createRng, hashString, randInt, randRange } from '../core/rng';
import { SKILL_NAMES } from '../data/ids';
import { NODES, PICKAXE_TIER, type NodeDef, type NodeSpawn } from '../data/nodes';
import type { Game } from '../game';
import type { Interactable } from '../world/area';
import type { LevelKit } from '../world/level-kit';
import { isSeam, seam } from '../world/seams';
import { createGlowTexture } from '../render/textures';
import { swingInterval, swingSuccessChance } from './gathering-math';
import { yieldBonus, yieldScale } from '../story/conditions';

export type { NodeSpawn };

interface NodeInstance {
  id: string;
  def: NodeDef;
  position: THREE.Vector3;
  chunks: THREE.Object3D[];
  remaining: number;
  /** Running rich today (a daily condition). */
  rich: boolean;
}

const STOP_DISTANCE = 3.6;
/** Chance a mining swing turns up a glint, and how long it shines. Rich seams glint more. */
const GLINT_CHANCE = 0.2;
const RICH_GLINT_CHANCE = 0.38;
const GLINT_TIME = 1.7;

/** A glint on a chunk of ore: strike it (E or click) for a bonus. Never needed, never a minigame. */
interface Glint {
  node: NodeInstance;
  chunk: THREE.Object3D;
  time: number;
}

/** Resource nodes and the swing-by-swing gathering loop. */
export class Gathering {
  private active: NodeInstance | null = null;
  private timer = 0;
  private nodes: NodeInstance[] = [];
  private glint: Glint | null = null;
  private readonly sparkle: THREE.Sprite;

  constructor(private readonly game: Game) {
    this.sparkle = new THREE.Sprite(new THREE.SpriteMaterial({ map: createGlowTexture(), color: new THREE.Color(2.2, 1.9, 1.3), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.sparkle.visible = false;
    this.sparkle.renderOrder = 6;
    game.scene.add(this.sparkle);
    game.onFixed((dt) => this.update(dt));
    game.onFrame(() => this.frame());
    game.events.on('areaEntered', () => {
      this.active = null;
      this.glint = null;
    });
    game.events.on('playerDamaged', () => this.stop());
  }

  get busy(): boolean {
    return this.active !== null;
  }

  /** A prompt that overrides whatever you're looking at while a glint shines. */
  get cue(): string | null {
    return this.glint ? 'Strike the glint!' : null;
  }

  get activeSkill(): NodeDef['skill'] | null {
    return this.active?.def.skill ?? null;
  }

  isAvailable(node: { id: string; def: NodeDef }): boolean {
    const depletedOn = this.game.state.depleted[node.id];
    return depletedOn === undefined || this.game.state.day >= depletedOn + node.def.respawnDays;
  }

  /** Builds node visuals and their interactables for the area being built. */
  spawn(kit: LevelKit, spawns: readonly NodeSpawn[], interactables: Interactable[]): void {
    this.nodes = [];
    for (const s of spawns) {
      const def: NodeDef = NODES[s.type];
      const rng = createRng(hashString(s.id));
      const group = new THREE.Group();
      group.position.set(...s.at);
      group.rotation.y = rng() * Math.PI * 2;
      const chunks: THREE.Object3D[] = [];
      const scale = s.scale ?? 1;
      if (isSeam(s.type)) {
        const built = seam(s.type, rng, kit.materials, def.mat, scale);
        group.add(built.group);
        chunks.push(...built.chunks);
      } else {
        const count = randInt(rng, 6, 9);
        for (let i = 0; i < count; i++) {
          const a = rng() * Math.PI * 2;
          const r = Math.sqrt(rng()) * 0.45 * scale;
          const h = randRange(rng, 0.08, 0.22) * scale;
          const plant = new THREE.Group();
          plant.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
          plant.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, h, 5), kit.materials.get('canvas')));
          (plant.children[0] as THREE.Mesh).position.y = h / 2;
          const cap = new THREE.Mesh(new THREE.SphereGeometry(randRange(rng, 0.04, 0.09) * scale, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), kit.materials.get(def.mat));
          cap.position.y = h;
          plant.add(cap);
          group.add(plant);
          chunks.push(plant);
        }
      }
      kit.add(group);
      if (def.skill === 'mining') kit.blocker([s.at[0], s.at[1] + 0.35 * scale, s.at[2]], [1.1 * scale, 0.7 * scale, 1.0 * scale]);
      const node: NodeInstance = {
        id: s.id,
        def,
        position: new THREE.Vector3(s.at[0], s.at[1] + 0.45 * scale, s.at[2]),
        chunks,
        remaining: 0,
        rich: false,
      };
      if (this.isAvailable(node)) {
        // Today's conditions: a rich seam yields double, a bloom adds to every patch.
        const conditions = this.game.conditions;
        const base = randInt(createRng(hashString(s.id) + this.game.state.day * 31), def.yields[0], def.yields[1]);
        node.remaining = base * yieldScale(conditions, s.id) + yieldBonus(conditions, s.type);
        node.rich = yieldScale(conditions, s.id) > 1;
      }
      this.refresh(node);
      this.nodes.push(node);
      interactables.push({
        id: `node-${s.id}`,
        position: node.position,
        radius: 0.8 * scale,
        range: 2.6,
        mode: 'press',
        enabled: () => true,
        label: () => this.label(node),
        press: () => this.toggle(node),
      });
    }
  }

  stop(message?: string): void {
    if (!this.active) return;
    this.active = null;
    this.glint = null;
    this.game.viewmodel.swing(0, 'mine');
    if (message) this.game.hud.toast(message);
  }

  private toolTier(def: NodeDef): number {
    if (def.toolTier === 0) return 0;
    const pick = this.game.state.player.equipment.pickaxe;
    return pick ? PICKAXE_TIER[pick] ?? 0 : 0;
  }

  private blocker(node: NodeInstance): string | null {
    const def = node.def;
    if (node.remaining <= 0) return 'exhausted, regrows tomorrow';
    if (this.game.progress.level(def.skill) < def.level) return `needs ${SKILL_NAMES[def.skill]} ${def.level}`;
    if (this.toolTier(def) < def.toolTier) return def.toolTier >= 3 ? 'needs a cobalt pickaxe' : 'needs a better pickaxe';
    return null;
  }

  private label(node: NodeInstance): string {
    if (this.active === node) return `Stop (${node.def.name.toLowerCase()})`;
    const blocked = this.blocker(node);
    const name = `${node.rich && node.remaining > 0 ? 'Rich ' : ''}${node.def.name}`;
    return blocked ? `${name} (${blocked})` : `${node.def.verb} ${name.toLowerCase()}`;
  }

  private toggle(node: NodeInstance): void {
    if (this.active === node) {
      if (this.glint) this.strikeGlint();
      else this.stop();
      return;
    }
    const blocked = this.blocker(node);
    if (blocked) {
      this.game.hud.toast(`${node.def.name}: ${blocked}.`, 'warn');
      return;
    }
    if (!this.game.progress.hasSpace(node.def.item)) {
      this.game.hud.toast('Your pack is full.', 'warn');
      return;
    }
    this.active = node;
    this.timer = 0;
    this.beginSwing(node);
  }

  /** Seconds per swing, quickened by a Keen meal. */
  private interval(node: NodeInstance): number {
    return swingInterval(this.toolTier(node.def)) * this.game.progress.buffScale('gatherSpeed');
  }

  private beginSwing(node: NodeInstance): void {
    const mining = node.def.skill === 'mining';
    this.game.viewmodel.swing(this.interval(node), mining ? 'mine' : 'grab');
  }

  /** Now and then a swing knocks loose a face of ore that catches the light. */
  private maybeGlint(node: NodeInstance): void {
    if (this.glint || node.def.skill !== 'mining' || node.remaining <= 0) return;
    if (this.game.rng() >= (node.rich ? RICH_GLINT_CHANCE : GLINT_CHANCE)) return;
    const visible = node.chunks.filter((c) => c.visible);
    const chunk = visible[Math.floor(this.game.rng() * visible.length)];
    if (!chunk) return;
    this.glint = { node, chunk, time: GLINT_TIME };
    this.game.events.emit('sound', { name: 'glint', position: node.position.clone() });
  }

  /** The bonus for striking a glint: an extra piece, half again the XP, and a shower of sparks. */
  private strikeGlint(): void {
    const glint = this.glint;
    if (!glint) return;
    this.glint = null;
    const def = glint.node.def;
    const at = glint.chunk.getWorldPosition(new THREE.Vector3());
    this.game.viewmodel.swing(0.35, 'mine');
    this.game.player.addShake(0.1);
    this.game.effects.burst(at, { count: 22, color: 0xffe2a0, speed: 3.5, size: 0.045, life: 0.6, emissive: true });
    if (this.game.progress.give(def.item, 1, true) > 0) {
      this.game.progress.addXp(def.skill, Math.round(def.xp * 0.5 * 10) / 10);
      this.game.events.emit('nodeYield', { position: at, item: def.item });
      this.game.events.emit('glintStruck', { item: def.item });
    }
  }

  private update(dt: number): void {
    const node = this.active;
    if (!node) return;
    if (this.game.panelOpen || this.game.player.position.distanceTo(node.position) > STOP_DISTANCE) {
      this.stop();
      return;
    }
    if (this.glint) {
      this.glint.time -= dt;
      const input = this.game.input;
      if (input.wasPressed('attack') || input.wasPressed('interact')) this.strikeGlint();
      else if (this.glint.time <= 0) this.glint = null;
    }
    const tier = this.toolTier(node.def);
    this.timer += dt;
    const interval = this.interval(node);
    if (this.timer < interval) return;
    this.timer -= interval;

    const def = node.def;
    this.game.events.emit('nodeStruck', { position: node.position.clone(), skill: def.skill });
    const chance = swingSuccessChance(def, this.game.progress.level(def.skill), tier);
    if (this.game.rng() < chance) {
      if (this.game.progress.give(def.item) === 0) {
        this.stop();
        return;
      }
      this.game.progress.addXp(def.skill, def.xp);
      node.remaining--;
      this.game.events.emit('nodeYield', { position: node.position.clone(), item: def.item });
      if (node.remaining <= 0) {
        this.game.state.depleted[node.id] = this.game.state.day;
        this.refresh(node);
        this.stop(`The ${def.name.toLowerCase()} is exhausted.`);
        return;
      }
      this.refresh(node);
      if (!this.game.progress.hasSpace(def.item)) {
        this.stop('Your pack is full.');
        return;
      }
    }
    this.maybeGlint(node);
    this.beginSwing(node);
  }

  /** The glint's sparkle, pulsing on its chunk of ore. */
  private frame(): void {
    const glint = this.glint;
    this.sparkle.visible = glint !== null;
    if (!glint) return;
    glint.chunk.getWorldPosition(this.sparkle.position);
    const toCamera = this.game.camera.position.clone().sub(this.sparkle.position).normalize();
    this.sparkle.position.addScaledVector(toCamera, 0.12);
    const t = this.game.time;
    const fade = Math.min(1, glint.time / 0.3);
    this.sparkle.scale.setScalar((0.32 + Math.sin(t * 14) * 0.08) * fade);
    this.sparkle.material.rotation = t * 1.5;
  }

  /** Shows one chunk per remaining yield, so you can read a node at a glance. */
  private refresh(node: NodeInstance): void {
    const visible = node.remaining <= 0 ? 0 : Math.max(2, Math.ceil((node.remaining / node.def.yields[1]) * node.chunks.length));
    node.chunks.forEach((chunk, i) => (chunk.visible = i < visible));
  }
}
