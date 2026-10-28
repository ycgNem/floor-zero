import * as THREE from 'three';
import { createRng, hashString, randInt, randRange, type Rng } from '../core/rng';
import { SKILL_NAMES } from '../data/ids';
import { NODES, PICKAXE_TIER, type NodeDef, type NodeType } from '../data/nodes';
import type { Game } from '../game';
import type { Interactable } from '../world/area';
import type { LevelKit, V3 } from '../world/level-kit';
import type { MaterialLibrary } from '../world/materials';
import { swingInterval, swingSuccessChance } from './gathering-math';

export interface NodeSpawn {
  /** Stable id: saved with depletion state. */
  id: string;
  type: NodeType;
  at: V3;
  scale?: number;
}

interface NodeInstance {
  id: string;
  def: NodeDef;
  position: THREE.Vector3;
  chunks: THREE.Object3D[];
  remaining: number;
}

const STOP_DISTANCE = 3.6;

function boulder(rng: Rng, materials: MaterialLibrary, scale: number): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const pos = geo.getAttribute('position');
  const seedA = rng() * 10;
  const seedB = rng() * 10;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const n = 1 + Math.sin(v.x * 3.1 + seedA) * 0.08 + Math.sin(v.y * 4.3 + seedB) * 0.07 + Math.sin(v.z * 5.7 + seedA) * 0.05;
    v.multiplyScalar(n);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, materials.get('rock'));
  mesh.scale.set(scale * randRange(rng, 0.9, 1.2), scale * randRange(rng, 0.6, 0.8), scale * randRange(rng, 0.85, 1.1));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Resource nodes and the swing-by-swing gathering loop. */
export class Gathering {
  private active: NodeInstance | null = null;
  private timer = 0;
  private nodes: NodeInstance[] = [];

  constructor(private readonly game: Game) {
    game.onFixed((dt) => this.update(dt));
    game.events.on('areaEntered', () => {
      this.active = null;
    });
    game.events.on('playerDamaged', () => this.stop());
  }

  get busy(): boolean {
    return this.active !== null;
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
      if (def.skill === 'mining') {
        const rock = boulder(rng, kit.materials, 0.75 * scale);
        rock.position.y = 0.25 * scale;
        group.add(rock);
        const count = 7;
        for (let i = 0; i < count; i++) {
          const chunk = new THREE.Mesh(new THREE.OctahedronGeometry(randRange(rng, 0.09, 0.19) * scale, 0), kit.materials.get(def.mat));
          const a = (i / count) * Math.PI * 2 + rng() * 0.5;
          const up = randRange(rng, 0.15, 0.9);
          chunk.position.set(Math.cos(a) * 0.62 * scale * (1 - up * 0.4), 0.25 * scale + up * 0.5 * scale, Math.sin(a) * 0.55 * scale * (1 - up * 0.4));
          chunk.rotation.set(rng() * 3, rng() * 3, rng() * 3);
          chunk.castShadow = true;
          group.add(chunk);
          chunks.push(chunk);
        }
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
      };
      if (this.isAvailable(node)) {
        node.remaining = randInt(createRng(hashString(s.id) + this.game.state.day * 31), def.yields[0], def.yields[1]);
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
    return blocked ? `${node.def.name} (${blocked})` : `${node.def.verb} ${node.def.name.toLowerCase()}`;
  }

  private toggle(node: NodeInstance): void {
    if (this.active === node) {
      this.stop();
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

  private update(dt: number): void {
    const node = this.active;
    if (!node) return;
    if (this.game.panelOpen || this.game.player.position.distanceTo(node.position) > STOP_DISTANCE) {
      this.stop();
      return;
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
    this.beginSwing(node);
  }

  /** Shows one chunk per remaining yield, so you can read a node at a glance. */
  private refresh(node: NodeInstance): void {
    const visible = node.remaining <= 0 ? 0 : Math.max(2, Math.ceil((node.remaining / node.def.yields[1]) * node.chunks.length));
    node.chunks.forEach((chunk, i) => (chunk.visible = i < visible));
  }
}
