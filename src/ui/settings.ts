import type { Quality } from '../render/renderer';

export interface Settings {
  /** Multiplier on the base mouse sensitivity. */
  sensitivity: number;
  fov: number;
  invertY: boolean;
  headBob: boolean;
  quality: Quality;
  /** Multiplier on the renderer's exposure. */
  brightness: number;
  volume: number;
  music: number;
  /** Multiplier on damage the player takes. */
  damageTaken: number;
  hitsplats: boolean;
}

const KEY = 'floor-zero/settings';

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1,
  fov: 85,
  invertY: false,
  headBob: true,
  quality: 'medium',
  brightness: 1,
  volume: 0.8,
  music: 0.6,
  damageTaken: 1,
  hitsplats: true,
};

export function loadSettings(): Settings {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { ...DEFAULT_SETTINGS, ...(typeof raw === 'object' && raw !== null ? (raw as Partial<Settings>) : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked; settings last for this session only.
  }
}
