import type * as THREE from 'three';
import type { AreaId } from '../data/ids';
import type { Game } from '../game';
import type { LevelKit } from './level-kit';

export interface Spawn {
  pos: THREE.Vector3;
  yaw: number;
}

/** Anything the player can look at and use with E. */
export interface Interactable {
  id: string;
  position: THREE.Vector3;
  /** How close to the centre of the view the object must be, in metres. */
  radius: number;
  /** Max distance from the eye. Defaults to 2.8 m. */
  range?: number;
  mode: 'press' | 'hold';
  enabled(): boolean;
  label(): string;
  press?(): void;
  holdStart?(): void;
  holdTick?(dt: number): void;
  holdEnd?(): void;
}

export interface AreaRuntime {
  spawns: Map<string, Spawn>;
  interactables: Interactable[];
  /** Fixed-step area logic: hazards, scripted events. */
  update?(dt: number): void;
  /** Per-frame visuals: animated props, flicker. */
  frame?(dt: number, time: number): void;
  dispose?(): void;
}

export interface AreaContext {
  game: Game;
  kit: LevelKit;
}

export interface AreaDef {
  id: AreaId;
  name: string;
  /** 0 is Bellwether. */
  floor: number;
  fog: { color: number; density: number };
  /** Motes in the air underground: their tint and strength. */
  dust?: { color?: number; opacity?: number };
  build(ctx: AreaContext): AreaRuntime;
}
