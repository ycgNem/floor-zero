import * as THREE from 'three';
import type { Game } from '../game';
import type { Interactable } from './area';
import type { LevelKit, V3 } from './level-kit';
import { pool, type Pool } from './water';

export interface SurgeChannelDef {
  id: string;
  /** Centre line of the channel, which runs along x. */
  z: number;
  x0: number;
  x1: number;
  width: number;
  /** Seconds between surges, and how far into that cycle it starts. */
  period: number;
  offset: number;
  /** Where its valve wheel sits on the wall. */
  valve: V3;
}

/** Seconds of warning: the hum rises, the gauge climbs, the lamps flash. */
const WARNING = 3;
const WAVE_SPEED = 13;
const SHUT_TIME = 15;
const AMBER = new THREE.Color(0xffa040);
const GREEN = new THREE.Color(0x60ff90);

interface Channel {
  def: SurgeChannelDef;
  clock: number;
  waveX: number | null;
  hit: boolean;
  shut: number;
  lamps: THREE.MeshStandardMaterial;
  needle: THREE.Object3D;
  wave: THREE.Mesh;
  water: Pool;
  telegraphed: boolean;
}

/**
 * Pump Station surge channels. A rising hum and a gauge give about three seconds of warning before
 * a wall of water sweeps the channel, knocking you down it. A valve shuts a channel for a while.
 */
export class Surges {
  private readonly channels: Channel[] = [];
  private readonly waveMaterial = new THREE.MeshStandardMaterial({ color: 0xd8f4ff, roughness: 0.2, emissive: 0x4a9ab0, emissiveIntensity: 0.6, transparent: true, opacity: 0.82 });

  constructor(
    private readonly game: Game,
    kit: LevelKit,
    defs: readonly SurgeChannelDef[],
    private readonly floorY: number,
    private readonly enabled: () => boolean,
    interactables: Interactable[],
  ) {
    for (const def of defs) {
      const length = def.x1 - def.x0;
      const water = pool(kit, { center: [(def.x0 + def.x1) / 2, floorY + 0.12, def.z], size: [length, def.width], eels: 0, motes: 0 });
      const lamps = new THREE.MeshStandardMaterial({ color: 0x2a1a08, emissive: AMBER.clone(), emissiveIntensity: 0 });
      for (let i = 0; i < 4; i++) {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), lamps);
        lamp.position.set(def.x0 + length * ((i + 0.5) / 4), 0.12, def.z - def.width / 2 - 0.25);
        kit.add(lamp);
      }
      // The gauge on a post at the channel's head: the needle climbs as the surge builds.
      const gauge = new THREE.Group();
      gauge.position.set(def.x0 + 0.6, 0, def.z - def.width / 2 - 0.6);
      gauge.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.3, 8), kit.materials.get('metal')));
      (gauge.children[0] as THREE.Mesh).position.y = 0.65;
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 20), kit.materials.get('canvas'));
      dial.rotation.x = Math.PI / 2;
      dial.position.set(0, 1.35, 0.05);
      gauge.add(dial);
      const needle = new THREE.Group();
      needle.position.set(0, 1.35, 0.09);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.01), kit.materials.get('hazard'));
      hand.position.y = 0.08;
      needle.add(hand);
      gauge.add(needle);
      kit.add(gauge);
      const wave = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.25, def.width - 0.1), this.waveMaterial);
      wave.visible = false;
      kit.add(wave);
      const channel: Channel = { def, clock: def.offset, waveX: null, hit: false, shut: 0, lamps, needle, wave, water, telegraphed: false };
      this.channels.push(channel);

      const wheel = new THREE.Group();
      wheel.position.set(...def.valve);
      wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 6, 20), kit.materials.get('rust')));
      for (let s = 0; s < 3; s++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.035, 0.035), kit.materials.get('rust'));
        spoke.rotation.z = (s / 3) * Math.PI;
        wheel.add(spoke);
      }
      wheel.rotation.y = Math.PI / 2;
      kit.add(wheel);
      interactables.push({
        id: `valve-${def.id}`,
        position: new THREE.Vector3(...def.valve),
        radius: 0.6,
        mode: 'press',
        enabled: () => this.enabled(),
        label: () => (channel.shut > 0 ? `Valve shut (${Math.ceil(channel.shut)}s)` : 'Heave the valve shut'),
        press: () => {
          if (channel.shut > 0) return;
          channel.shut = SHUT_TIME;
          game.events.emit('sound', { name: 'valve', position: new THREE.Vector3(...def.valve) });
          channel.waveX = null;
          channel.wave.visible = false;
          wheel.rotation.x += Math.PI;
          game.hud.toast('The valve groans shut. That channel will stay dry for a little while.');
        },
      });
    }
  }

  update(dt: number): void {
    const player = this.game.player.position;
    for (const ch of this.channels) {
      const def = ch.def;
      if (!this.enabled()) {
        ch.waveX = null;
        ch.wave.visible = false;
        continue;
      }
      if (ch.shut > 0) {
        ch.shut -= dt;
        continue;
      }
      const before = ch.clock % def.period;
      ch.clock += dt;
      const t = ch.clock % def.period;
      if (t < before) {
        ch.waveX = def.x0;
        ch.hit = false;
        ch.telegraphed = false;
        this.game.events.emit('slam', { position: new THREE.Vector3(def.x0, this.floorY, def.z) });
      }
      const warnLeft = def.period - t;
      if (warnLeft < 1 && !ch.telegraphed) {
        ch.telegraphed = true;
        const y = this.floorY + 0.05;
        this.game.combat.telegraphs.line(new THREE.Vector3(def.x0, y, def.z), new THREE.Vector3(def.x1, y, def.z), def.width, warnLeft);
        if (Math.abs(player.z - def.z) < 8) this.game.hud.subtitle('[rising hum]', 1);
      }
      if (ch.waveX !== null) {
        ch.waveX += WAVE_SPEED * dt;
        const inChannel = Math.abs(player.z - def.z) < def.width / 2 && player.y < this.floorY + 1;
        if (!ch.hit && inChannel && Math.abs(player.x - ch.waveX) < 0.8) {
          ch.hit = true;
          this.game.combat.damagePlayer(14, new THREE.Vector3(ch.waveX, player.y + 1, def.z), new THREE.Vector3(11, 3, 0));
        }
        if (ch.waveX > def.x1) {
          this.game.effects.burst(new THREE.Vector3(def.x1 - 0.3, this.floorY + 0.8, def.z), { count: 20, color: 0xd8f4ff, speed: 4, size: 0.06, life: 0.7 });
          ch.waveX = null;
        }
      }
    }
  }

  frame(dt: number, time: number): void {
    for (const ch of this.channels) {
      ch.water.frame(dt, time * 6);
      const def = ch.def;
      const live = this.enabled();
      const t = ch.clock % def.period;
      const warning = live && ch.shut <= 0 ? Math.max(0, 1 - (def.period - t) / WARNING) : 0;
      ch.needle.rotation.z = 1.2 - warning * 2.4;
      if (ch.shut > 0 && live) {
        ch.lamps.emissive.copy(GREEN);
        ch.lamps.emissiveIntensity = 1.5;
      } else {
        ch.lamps.emissive.copy(AMBER);
        ch.lamps.emissiveIntensity = warning > 0 ? (Math.sin(time * (8 + warning * 14)) > 0 ? 3 : 0.3) : 0;
      }
      ch.wave.visible = ch.waveX !== null;
      if (ch.waveX !== null) {
        ch.wave.position.set(ch.waveX, this.floorY + 0.6 + Math.sin(time * 20) * 0.04, def.z);
        if (Math.random() < 0.5) this.game.effects.burst(ch.wave.position.clone().setY(this.floorY + 1.2), { count: 2, color: 0xe8fbff, speed: 2, size: 0.05, life: 0.4 });
      }
    }
  }

  dispose(): void {
    for (const ch of this.channels) {
      ch.lamps.dispose();
      ch.water.dispose();
    }
    this.waveMaterial.dispose();
  }
}
