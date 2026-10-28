import * as THREE from 'three';
import { FISHING_SPOTS, type FishingSpotDef, type FishingSpotType } from '../data/fishing';
import { ITEMS } from '../data/items';
import type { Game } from '../game';
import type { Interactable } from '../world/area';
import type { LevelKit, V3 } from '../world/level-kit';
import { biteDelay, hookChance, strikeWindow } from './fishing-math';
import { biteScale } from '../story/conditions';

export interface FishingSpotSpawn {
  /** Stable id for the spot. */
  id: string;
  type: FishingSpotType;
  /** Where the float lands, on the water surface. */
  at: V3;
}

interface Spot {
  id: string;
  type: FishingSpotType;
  def: FishingSpotDef;
  position: THREE.Vector3;
  rings: THREE.Mesh[];
}

type Phase = 'idle' | 'casting' | 'waiting' | 'bite' | 'reeling';

const CAST_TIME = 0.7;
const REEL_TIME = 0.55;
/** How far you can drift from where you cast before the line comes in. */
const STOP_DISTANCE = 1.2;
const LINE_POINTS = 16;
const SPLASH = 0x9fd4e8;

/** Fishing spots, the float and line, and the cast, wait, strike loop. Keeps casting until you walk away. */
export class Fishing {
  private phase: Phase = 'idle';
  private spot: Spot | null = null;
  private spots: Spot[] = [];
  private timer = 0;
  private waitFor = 0;
  private window = 0;
  private hooked = false;
  private pressedThisStep = false;
  private readonly castFrom = new THREE.Vector3();
  private readonly float = new THREE.Group();
  private readonly floatAt = new THREE.Vector3();
  private readonly tip = new THREE.Vector3();
  private readonly line: THREE.Line;
  private readonly linePositions = new Float32Array(LINE_POINTS * 3);
  private readonly ringMaterial = new THREE.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 0.3, depthWrite: false });
  private readonly ringGeometry = new THREE.RingGeometry(0.92, 1, 40);

  constructor(private readonly game: Game) {
    const red = new THREE.MeshStandardMaterial({ color: 0xc8322a, roughness: 0.5, emissive: 0x3a0806 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.5, emissive: 0x504a40 });
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), red);
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), white);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 5), red);
    stem.position.y = 0.1;
    this.float.add(top, bottom, stem);
    this.float.visible = false;
    game.scene.add(this.float);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.linePositions, 3));
    this.line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xe8e4d8, transparent: true, opacity: 0.6 }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    game.scene.add(this.line);

    game.onFixed((dt) => this.update(dt));
    game.onFrame(() => this.frame());
    game.events.on('areaUnloading', () => {
      this.stop();
      for (const spot of this.spots) for (const ring of spot.rings) (ring.material as THREE.Material).dispose();
      this.spots = [];
    });
    game.events.on('playerDamaged', () => this.stop('The line goes slack as you’re hit.'));
  }

  get busy(): boolean {
    return this.phase !== 'idle';
  }

  /** A prompt that overrides whatever you're looking at: a bite needs answering now. */
  get cue(): string | null {
    return this.phase === 'bite' ? 'Strike!' : null;
  }

  /** Marks fishing spots on the water and adds their interactables. */
  spawn(kit: LevelKit, spawns: readonly FishingSpotSpawn[], interactables: Interactable[]): void {
    for (const s of spawns) {
      const def: FishingSpotDef = FISHING_SPOTS[s.type];
      const position = new THREE.Vector3(...s.at);
      // Slow rings spreading on the water, like fish rising, show where to cast.
      const rings: THREE.Mesh[] = [];
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial.clone());
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(position).setY(position.y + 0.01);
        ring.userData.phase = i / 3;
        kit.add(ring);
        rings.push(ring);
      }
      const spot: Spot = { id: s.id, type: s.type, def, position, rings };
      this.spots.push(spot);
      interactables.push({
        id: `fish-${s.id}`,
        position: position.clone().setY(position.y + 0.15),
        radius: 1.4,
        range: 8,
        mode: 'press',
        enabled: () => true,
        label: () => this.label(spot),
        press: () => {
          this.pressedThisStep = true;
          this.act(spot);
        },
      });
    }
  }

  stop(message?: string): void {
    if (this.phase === 'idle') return;
    this.phase = 'idle';
    this.spot = null;
    this.float.visible = false;
    this.line.visible = false;
    if (message) this.game.hud.toast(message);
  }

  private blocker(spot: Spot): string | null {
    const g = this.game;
    const def = spot.def;
    if (!g.state.player.equipment.rod) return 'needs a fishing rod';
    if (g.progress.level('fishing') < def.level) return `needs Fishing ${def.level}`;
    if (def.bait && g.progress.count(def.bait) <= 0) return `needs ${ITEMS[def.bait].name.toLowerCase()}`;
    return null;
  }

  private label(spot: Spot): string {
    if (this.spot === spot) {
      if (this.phase === 'bite') return 'Strike!';
      if (this.phase === 'reeling') return 'Reeling in…';
      return 'Reel in';
    }
    const fish = ITEMS[spot.def.fish].name.toLowerCase();
    const blocked = this.blocker(spot);
    return blocked ? `${spot.def.name} (${blocked})` : `Fish the ${spot.def.name.toLowerCase()} (${fish})`;
  }

  /** E or a click: cast, strike, or reel in, depending on where the line is. */
  private act(spot: Spot): void {
    if (this.spot !== spot) {
      this.cast(spot);
      return;
    }
    if (this.phase === 'bite') this.strike();
    else if (this.phase === 'waiting' || this.phase === 'casting') this.stop();
  }

  private cast(spot: Spot): void {
    const g = this.game;
    if (this.busy) this.stop();
    const blocked = this.blocker(spot);
    if (blocked) {
      g.hud.toast(`${spot.def.name}: ${blocked}.`, 'warn');
      return;
    }
    if (!g.progress.hasSpace(spot.def.fish)) {
      g.hud.toast('Your pack is full.', 'warn');
      return;
    }
    if (g.gathering.busy) g.gathering.stop();
    this.spot = spot;
    this.phase = 'casting';
    this.timer = 0;
    this.castFrom.copy(g.player.position);
    g.viewmodel.swing(CAST_TIME, 'cast');
  }

  private strike(): void {
    const spot = this.spot;
    if (!spot) return;
    this.phase = 'reeling';
    this.timer = 0;
    this.hooked = this.game.rng() < hookChance(spot.def, this.game.progress.level('fishing'));
    this.game.events.emit('sound', { name: this.hooked ? 'catch' : 'splash', position: spot.position });
    this.game.viewmodel.swing(REEL_TIME, 'recoil');
    this.game.effects.burst(spot.position, { count: 10, color: SPLASH, speed: 2.4, size: 0.04, life: 0.5 });
  }

  private land(spot: Spot): void {
    const g = this.game;
    const def = spot.def;
    if (this.hooked) {
      g.progress.give(def.fish);
      if (def.bait) g.progress.take(def.bait, 1);
      g.progress.addXp('fishing', def.xp);
      g.state.counters[`caught:${def.fish}`] = (g.state.counters[`caught:${def.fish}`] ?? 0) + 1;
      g.events.emit('nodeYield', { position: spot.position.clone(), item: def.fish });
    } else {
      g.hud.toast('It slipped the hook.');
    }
    // Straight back out, as long as there's bait and room.
    if (this.blocker(spot) || !g.progress.hasSpace(def.fish)) {
      this.stop(!g.progress.hasSpace(def.fish) ? 'Your pack is full.' : undefined);
      return;
    }
    this.phase = 'casting';
    this.timer = 0;
    g.viewmodel.swing(CAST_TIME, 'cast');
  }

  private update(dt: number): void {
    const g = this.game;
    const input = g.input;
    const pressed = (input.wasPressed('interact') && !this.pressedThisStep) || input.wasPressed('attack');
    this.pressedThisStep = false;
    const spot = this.spot;
    if (!spot || this.phase === 'idle') return;
    if (g.panelOpen || g.player.position.distanceTo(this.castFrom) > STOP_DISTANCE) {
      this.stop();
      return;
    }
    // You strike wherever you happen to be looking.
    if (pressed) {
      this.act(spot);
      if (!this.busy) return;
    }

    const level = g.progress.level('fishing');
    this.timer += dt;
    switch (this.phase) {
      case 'casting':
        if (this.timer >= CAST_TIME) {
          this.phase = 'waiting';
          this.timer = 0;
          this.waitFor = this.biteWait(spot, level);
          g.events.emit('sound', { name: 'splash', position: spot.position });
          g.effects.burst(spot.position, { count: 6, color: SPLASH, speed: 1.2, size: 0.03, life: 0.4 });
        }
        break;
      case 'waiting':
        if (this.timer >= this.waitFor) {
          this.phase = 'bite';
          this.timer = 0;
          this.window = strikeWindow(spot.def, level);
          g.events.emit('sound', { name: 'bite', position: spot.position });
          g.effects.burst(spot.position, { count: 14, color: SPLASH, speed: 2, size: 0.035, life: 0.45 });
        }
        break;
      case 'bite':
        if (this.timer >= this.window) {
          this.phase = 'waiting';
          this.timer = 0;
          this.waitFor = this.biteWait(spot, level);
          g.hud.toast('Too slow. It took the bait and ran.');
        }
        break;
      case 'reeling':
        if (this.timer >= REEL_TIME) this.land(spot);
        break;
    }
  }

  /** Seconds until the next bite, quicker when today's conditions say the fish are running. */
  private biteWait(spot: Spot, level: number): number {
    return biteDelay(spot.def, level, this.game.rng()) * biteScale(this.game.conditions, spot.type);
  }

  private frame(): void {
    const time = this.game.time;
    for (const spot of this.spots) {
      for (const ring of spot.rings) {
        const t = (time * 0.35 + (ring.userData.phase as number)) % 1;
        ring.scale.setScalar(0.2 + t * 0.7);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.2 * (1 - t);
      }
    }

    const spot = this.spot;
    if (!spot || this.phase === 'idle') return;
    const camera = this.game.camera;
    const ndc = this.game.viewmodel.rodTipNdc(this.tip);
    if (ndc) {
      const dir = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(camera).sub(camera.position).normalize();
      this.tip.copy(camera.position).addScaledVector(dir, 0.9);
    } else {
      this.tip.copy(camera.position).add(new THREE.Vector3(0.3, -0.1, -0.8).applyQuaternion(camera.quaternion));
    }

    const water = spot.position;
    const k = Math.min(1, this.timer / (this.phase === 'reeling' ? REEL_TIME : CAST_TIME));
    let sag = 0.05;
    switch (this.phase) {
      case 'casting':
        // A lob from the rod tip to the water.
        this.floatAt.lerpVectors(this.tip, water, k);
        this.floatAt.y += Math.sin(k * Math.PI) * 1.2;
        sag = 0.02;
        break;
      case 'waiting':
        this.floatAt.copy(water).setY(water.y + 0.02 + Math.sin(time * 2.6) * 0.015);
        sag = 0.35;
        break;
      case 'bite':
        this.floatAt.copy(water).setY(water.y - 0.07 + Math.sin(time * 34) * 0.03);
        sag = 0.1;
        break;
      case 'reeling':
        this.floatAt.lerpVectors(water, this.tip, k * k);
        if (this.hooked) this.floatAt.y += Math.sin(k * Math.PI) * 0.5;
        sag = 0.02;
        break;
    }
    this.float.position.copy(this.floatAt);
    this.float.visible = true;
    this.float.rotation.z = this.phase === 'bite' ? Math.sin(time * 30) * 0.4 : Math.sin(time * 1.7) * 0.08;

    // A sagging line from the tip to the float.
    for (let i = 0; i < LINE_POINTS; i++) {
      const t = i / (LINE_POINTS - 1);
      const x = this.tip.x + (this.floatAt.x - this.tip.x) * t;
      const z = this.tip.z + (this.floatAt.z - this.tip.z) * t;
      const y = this.tip.y + (this.floatAt.y + 0.16 - this.tip.y) * t - sag * 4 * t * (1 - t);
      this.linePositions.set([x, y, z], i * 3);
    }
    this.line.geometry.getAttribute('position').needsUpdate = true;
    this.line.visible = true;
  }
}
