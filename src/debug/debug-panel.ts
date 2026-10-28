import GUI from 'lil-gui';
import * as THREE from 'three';
import { AREA_IDS, FLAGS, type AreaId, type FlagId } from '../data/ids';
import type { Game } from '../game';
import type { Quality } from '../render/renderer';

/** Backquote toggles a lil-gui panel with teleports, flags, render options, and stats. */
export function installDebug(game: Game): void {
  if (import.meta.env.DEV) (window as unknown as { floorZero: Game }).floorZero = game;

  let gui: GUI | null = null;
  let lines: THREE.LineSegments | null = null;
  const stats = { fps: 0, calls: 0, triangles: 0, position: '' };
  const options = {
    area: 'entry-yard' as AreaId,
    spawn: 'lift',
    noclip: false,
    colliders: false,
    quality: game.settings.quality as Quality,
    exposure: 1,
    flag: 'test_lever' as FlagId,
  };

  const setColliders = (on: boolean): void => {
    if (on && !lines) {
      lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false }));
      lines.renderOrder = 999;
      lines.frustumCulled = false;
      game.scene.add(lines);
    } else if (!on && lines) {
      lines.removeFromParent();
      lines.geometry.dispose();
      lines = null;
    }
  };

  const build = (): GUI => {
    const panel = new GUI({ title: 'Floor Zero debug' });
    const s = panel.addFolder('Stats');
    s.add(stats, 'fps').listen().disable();
    s.add(stats, 'calls').name('draw calls').listen().disable();
    s.add(stats, 'triangles').listen().disable();
    s.add(stats, 'position').listen().disable();
    const t = panel.addFolder('Travel');
    t.add(options, 'area', [...AREA_IDS]);
    t.add(options, 'spawn');
    t.add({ go: () => void game.travel(options.area, options.spawn) }, 'go').name('Teleport');
    t.add(options, 'noclip').onChange((v: boolean) => (game.player.noclip = v));
    const f = panel.addFolder('Flags');
    f.add(options, 'flag', [...FLAGS]);
    f.add({ set: () => game.setFlag(options.flag) }, 'set').name('Set flag');
    f.add({ clear: () => (game.state.flags = game.state.flags.filter((x) => x !== options.flag)) }, 'clear').name('Clear flag');
    const r = panel.addFolder('Render');
    r.add(options, 'quality', ['low', 'medium', 'high']).onChange((q: Quality) => game.renderer.setQuality(q));
    r.add(options, 'exposure', 0.2, 3, 0.05).onChange((v: number) => game.renderer.setExposure(v));
    r.add(options, 'colliders').onChange(setColliders);
    for (const hook of extraFolders) hook(panel);
    return panel;
  };

  let smoothed = 60;
  game.onFrame((dt) => {
    if (game.input.consume('debug')) {
      if (gui) {
        gui.destroy();
        gui = null;
      } else {
        gui = build();
      }
    }
    if (gui) {
      smoothed = smoothed * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;
      stats.fps = Math.round(smoothed);
      stats.calls = game.renderer.info.render.calls;
      stats.triangles = game.renderer.info.render.triangles;
      const p = game.player.position;
      stats.position = `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
    }
    if (lines) {
      const { vertices, colors } = game.physics.debugLines();
      lines.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      lines.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    }
  });
}

/** Later systems add their own debug controls here. */
const extraFolders: ((gui: GUI) => void)[] = [];

export function addDebugFolder(hook: (gui: GUI) => void): void {
  extraFolders.push(hook);
}
