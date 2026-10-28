import * as THREE from 'three';
import { wrapAngle } from '../core/math';
import { ITEMS } from '../data/items';
import type { Game } from '../game';
import { el } from './dom';

const THREAT_STATES = new Set(['windup', 'charge', 'lunge', 'aim', 'fire', 'burrow', 'emerge', 'slam']);
const VIEW_CONE = 0.85;

/** Food hotbar, weapon and ammo, hitsplats, off-screen threat arrows, and the hurt vignette. */
export class CombatHud {
  private readonly hotbar: HTMLElement;
  private readonly weapon: HTMLElement;
  private readonly splats: HTMLElement;
  private readonly threats: HTMLElement;
  private readonly vignette: HTMLElement;
  private readonly bossBar: HTMLElement;
  private readonly bossName: HTMLElement;
  private readonly bossFill: HTMLElement;
  private hotbarKey = '';
  private hurt = 0;

  constructor(private readonly game: Game) {
    const root = game.hud.root;
    this.vignette = el('div', 'hurt-vignette', root);
    this.hotbar = el('div', 'hotbar', root);
    this.weapon = el('div', 'weapon-readout', root);
    this.splats = el('div', 'splats', root);
    this.threats = el('div', 'threats', root);
    this.bossBar = el('div', 'boss-bar', root);
    this.bossName = el('div', 'boss-name', this.bossBar);
    this.bossFill = el('i', '', el('div', 'boss-track', this.bossBar));
    game.events.on('hit', ({ position, amount, weakPoint }) => this.splat(position, amount, weakPoint));
    game.events.on('playerDamaged', () => {
      this.hurt = 1;
    });
    game.onFrame((dt) => this.update(dt));
  }

  private splat(position: THREE.Vector3, amount: number, weak: boolean): void {
    if (!this.game.settings.hitsplats) return;
    const v = position.clone().project(this.game.camera);
    if (v.z > 1) return;
    const node = el('div', `splat${amount === 0 ? ' blocked' : weak ? ' weak' : ''}`, this.splats, amount === 0 ? '0' : String(amount));
    node.style.left = `${((v.x + 1) / 2) * 100}%`;
    node.style.top = `${((1 - v.y) / 2) * 100}%`;
    setTimeout(() => node.remove(), 800);
  }

  private update(dt: number): void {
    const g = this.game;
    const combat = g.combat;
    const below = (g.area?.def.floor ?? 0) > 0 && g.mode === 'playing';

    this.hurt = Math.max(0, this.hurt - dt * 1.6);
    const low = 1 - g.state.player.health / g.progress.maxHealth();
    this.vignette.style.opacity = String(Math.min(1, this.hurt * 0.9 + Math.max(0, low - 0.6) * 1.5));

    const bar = combat.hotbar();
    const key = bar.map((s) => `${s.item}:${s.count}`).join('|') + (combat.eating ? `|eat:${combat.eating.item}` : '');
    if (key !== this.hotbarKey) {
      this.hotbarKey = key;
      this.hotbar.replaceChildren();
      for (let i = 0; i < 4; i++) {
        const slot = bar[i];
        const cell = el('div', `hot-slot${slot ? '' : ' empty'}${slot && combat.eating?.item === slot.item ? ' eating' : ''}`, this.hotbar);
        el('span', 'hot-key', cell, String(i + 1));
        if (slot) {
          el('span', 'hot-name', cell, ITEMS[slot.item].name);
          el('span', 'hot-count', cell, `×${slot.count}`);
        }
      }
    }
    this.hotbar.style.display = below ? '' : 'none';

    if (below) {
      const held = combat.heldItem();
      const name = held.item ? ITEMS[held.item].name : '';
      const ammo = held.held === 'boltcaster' ? (combat.reloading > 0 ? ' · reloading' : ` · ${combat.magazine} bolts`) : '';
      this.weapon.textContent = `${name}${ammo}`;
      this.weapon.style.display = '';
    } else this.weapon.style.display = 'none';

    const boss = below ? combat.enemies.find((e) => e.boss && e.aggro && e.alive && e.health > 0) : undefined;
    this.bossBar.classList.toggle('show', boss !== undefined);
    if (boss) {
      if (this.bossName.textContent !== boss.displayName) this.bossName.textContent = boss.displayName;
      this.bossFill.style.width = `${(boss.health / boss.maxHealth) * 100}%`;
    }

    this.threats.replaceChildren();
    if (!below) return;
    const p = g.player;
    const facing = p.yaw + Math.PI;
    let shown = 0;
    for (const enemy of combat.enemies) {
      if (shown >= 4 || !enemy.alive || !THREAT_STATES.has(enemy.state)) continue;
      const rel = wrapAngle(Math.atan2(enemy.position.x - p.position.x, enemy.position.z - p.position.z) - facing);
      if (Math.abs(rel) < VIEW_CONE && enemy.distanceToPlayer() > 2) continue;
      const arrow = el('div', 'threat', this.threats);
      arrow.style.transform = `rotate(${-rel}rad) translateY(-96px)`;
      shown++;
    }
  }
}
