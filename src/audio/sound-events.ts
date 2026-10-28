import * as THREE from 'three';
import type { AreaId } from '../data/ids';
import type { Game } from '../game';
import type { Ambience, AudioEngine } from './audio';

const AMBIENCE: Record<AreaId, Ambience> = {
  'lift-plaza': 'town',
  'entry-yard': 'mine',
  'broken-galleries': 'mine',
  'lantern-pool': 'water',
  'lower-cut': 'mine',
  'pump-station': 'machine',
};

/** Connects game events to sounds, and keeps ambience, music, and footsteps in step with play. */
export function bindAudio(game: Game, audio: AudioEngine): void {
  const e = game.events;
  let lastYield = 0;
  e.on('areaEntered', ({ area }) => {
    const underground = (game.area?.def.floor ?? 0) > 0;
    audio.setAmbience(AMBIENCE[area]);
    audio.setReverb(underground ? 0.35 : 0.12);
  });
  e.on('playerAttack', ({ weapon }) => audio.play(weapon === 'boltcaster' ? 'bolt' : weapon === 'resonance' ? 'surge' : 'swing'));
  e.on('hit', ({ position, weakPoint }) => audio.play(weakPoint ? 'weak' : 'hit', { at: position }));
  e.on('enemyKilled', ({ position }) => audio.play('kill', { at: position }));
  e.on('enemyAttack', ({ position }) => audio.play('telegraph', { at: position, volume: 0.8 }));
  e.on('slam', ({ position }) => audio.play('slam', { at: position }));
  e.on('deflect', ({ position }) => audio.play('deflect', { at: position }));
  e.on('playerDamaged', () => audio.play('hurt'));
  e.on('playerHealed', () => audio.play('heal', { volume: 0.7 }));
  e.on('nodeStruck', ({ position, skill }) => audio.play(skill === 'botany' ? 'pickup' : 'pick', { at: position, volume: skill === 'botany' ? 0.5 : 1 }));
  e.on('nodeYield', ({ position }) => {
    lastYield = performance.now();
    audio.play('yield', { at: position, volume: 0.8 });
  });
  e.on('itemAdded', () => {
    if (performance.now() - lastYield > 250) audio.play('pickup', { volume: 0.5 });
  });
  e.on('levelUp', () => audio.play('level'));
  e.on('moneyChanged', ({ delta }) => {
    if (delta > 0) audio.play('coin');
  });
  e.on('packFull', () => audio.play('full'));
  e.on('dialogue', () => audio.play('ui'));
  e.on('sound', ({ name, position }) => audio.play(name, { at: position }));

  let stride = 0;
  const last = new THREE.Vector3();
  game.onFrame((dt) => {
    audio.setListener(game.camera);
    const floor = game.area?.def.floor ?? 0;
    const boss = floor > 0 && game.combat.enemies.some((enemy) => enemy.boss && enemy.aggro && enemy.alive && enemy.health > 0);
    audio.setMusic(boss ? 'boss' : floor > 0 ? 'delve' : 'town');
    audio.update();

    // Footsteps by distance walked, so pace follows speed.
    const p = game.player.position;
    const moved = Math.hypot(p.x - last.x, p.z - last.z);
    last.copy(p);
    if (game.mode !== 'playing' || !game.player.grounded || moved > 1) return;
    const speed = moved / Math.max(dt, 1e-3);
    stride += moved;
    if (stride > (speed > 5 ? 2.3 : speed > 1.8 ? 1.9 : 1.4)) {
      stride = 0;
      audio.play('step', { volume: speed > 5 ? 0.9 : speed < 1.8 ? 0.35 : 0.6 });
    }
  });
}
