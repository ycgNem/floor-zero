import * as THREE from 'three';
import { wrapAngle } from '../core/math';
import { itemDef, ITEMS, type ItemId } from '../data/items';
import type { Game } from '../game';
import { summarize } from '../items/inventory';
import type { CharacterController } from '../physics/physics';
import { PLAYER_RADIUS } from '../player/player';
import type { Held } from '../player/viewmodel';
import type { LevelKit } from '../world/level-kit';
import { Enemy, type EnemyHost, type EnemySpawn } from './enemy';
import { ENEMY_FACTORIES } from './enemies';
import { Projectiles, type Projectile } from './projectiles';
import { Telegraphs } from './telegraphs';
import { BLADE_DAMAGE, BOLT_DAMAGE, BOLT_SPEED, COMBO, MAGAZINE, proficiencyBonus, RELOAD_TIME, SURGE_DAMAGE, type WeaponSlot } from './weapons';
import { rescue } from './rescue';

const MAX_TOKENS = 2;
const EAT_TIME = 0.9;

/** Player weapons, health, food, and every enemy in the current area. */
export class Combat implements EnemyHost {
  readonly telegraphs: Telegraphs;
  readonly projectiles: Projectiles;
  readonly controller: CharacterController;
  enemies: Enemy[] = [];
  weapon: WeaponSlot = 'blade';
  magazine = MAGAZINE;
  reloading = 0;
  aiming = false;
  eating: { item: ItemId; time: number } | null = null;
  private readonly tokens = new Set<Enemy>();
  private readonly crushed = new WeakSet<Enemy>();
  private cooldown = 0;
  private combo = 0;
  private comboReset = 0;
  private pendingHit: { at: number; step: (typeof COMBO)[number] } | null = null;
  private deflectTime = 0;
  private deflectCooldown = 0;
  private hurtGrace = 0;
  defeated = false;
  /** Every creature in the area freezes in fear (the Irregular is near). */
  cowed = false;
  /** Set by areas to slow you down, e.g. wading through a flooded basin. Reset on unload. */
  moveScale = 1;

  constructor(readonly game: Game) {
    this.telegraphs = new Telegraphs(game.scene);
    this.projectiles = new Projectiles(game.scene, game.physics);
    this.controller = game.physics.createCharacterController();
    game.events.on('areaUnloading', () => this.clear());
    game.onFixed((dt) => this.fixedUpdate(dt));
    game.onFrame((dt) => this.frameUpdate(dt));
  }

  // ---- EnemyHost ----

  requestToken(enemy: Enemy): boolean {
    if (enemy.hasToken) return true;
    if (this.tokens.size >= MAX_TOKENS) return false;
    this.tokens.add(enemy);
    enemy.hasToken = true;
    return true;
  }

  releaseToken(enemy: Enemy): void {
    this.tokens.delete(enemy);
    enemy.hasToken = false;
  }

  damagePlayer(amount: number, from: THREE.Vector3, knockback?: THREE.Vector3): void {
    const g = this.game;
    if (this.defeated || g.mode !== 'playing' || g.player.invulnerable > 0 || this.hurtGrace > 0) return;
    const dealt = Math.max(1, Math.round(amount * g.settings.damageTaken));
    g.state.player.health -= dealt;
    this.hurtGrace = 0.35;
    g.player.addShake(0.35);
    if (knockback) g.player.push(knockback);
    g.events.emit('playerDamaged', { amount: dealt, from: from.clone() });
    if (g.state.player.health <= 0) {
      g.state.player.health = 0;
      this.defeated = true;
      void rescue(g).then(() => (this.defeated = false));
    }
  }

  // ---- Spawning ----

  spawn(kit: LevelKit, spawns: readonly EnemySpawn[]): void {
    const state = this.game.state;
    for (const s of spawns) {
      const killedOn = state.depleted[s.id];
      if (killedOn !== undefined && state.day < killedOn + 1) continue;
      const factory = ENEMY_FACTORIES[s.type];
      if (!factory) continue;
      const enemy = factory(this, s.id, new THREE.Vector3(...s.at), s.yaw ?? 0);
      kit.add(enemy.group);
      this.enemies.push(enemy);
    }
  }

  /** Adds an enemy created by area or story code (bosses, scripted events). */
  adopt(enemy: Enemy, parent: THREE.Object3D): void {
    parent.add(enemy.group);
    this.enemies.push(enemy);
  }

  clear(): void {
    for (const enemy of this.enemies) enemy.dispose();
    this.enemies = [];
    this.tokens.clear();
    this.projectiles.clear();
    this.telegraphs.clear();
    this.eating = null;
    this.pendingHit = null;
    this.aiming = false;
    this.cowed = false;
    this.moveScale = 1;
    this.game.player.speedMultiplier = 1;
    this.game.player.fovOffset = 0;
  }

  get inDungeon(): boolean {
    return (this.game.area?.def.floor ?? 0) > 0;
  }

  /** Which weapon the viewmodel should show. */
  heldItem(): { held: Held; item: ItemId | null } {
    const eq = this.game.state.player.equipment;
    if (this.weapon === 'boltcaster' && eq.boltcaster) return { held: 'boltcaster', item: eq.boltcaster };
    if (this.weapon === 'resonance' && eq.resonance) return { held: 'resonance', item: eq.resonance };
    return { held: 'blade', item: eq.blade };
  }

  /** The first four kinds of food in your pack, in pack order. */
  hotbar(): { item: ItemId; count: number }[] {
    return summarize(this.game.state.player.pack).filter(({ item }) => ITEMS[item].kind === 'food').slice(0, 4);
  }

  // ---- Fixed step ----

  private fixedUpdate(dt: number): void {
    const g = this.game;
    if (g.mode !== 'playing') return;
    this.hurtGrace = Math.max(0, this.hurtGrace - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.deflectCooldown = Math.max(0, this.deflectCooldown - dt);
    this.deflectTime = Math.max(0, this.deflectTime - dt);
    this.comboReset -= dt;
    if (this.comboReset <= 0) this.combo = 0;
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) this.magazine = MAGAZINE;
    }

    const canAct = this.inDungeon && !g.panelOpen && !g.player.frozen && !g.gathering.busy && !g.fishing.busy && !this.defeated;
    if (canAct) this.handleInput();
    else this.aiming = false;
    this.updateEating(dt);
    // Set in one place every step, so a panel, cutscene or rescue can never leave them stuck.
    g.player.speedMultiplier = (this.eating ? 0.5 : this.aiming ? 0.55 : 1) * this.moveScale;
    g.player.fovOffset = this.aiming ? -24 : 0;
    this.resolvePendingHit(dt);

    if (!this.cowed) {
      for (const enemy of this.enemies) if (enemy.alive) enemy.update(dt);
      this.separate();
    }
    this.updateProjectiles(dt);
    this.collectDead();
  }

  /** Keeps creatures out of the player and out of each other. A handful per area, so pairwise is fine. */
  private separate(): void {
    const player = this.game.player.position;
    for (const a of this.enemies) {
      if (!a.alive || !a.mobile || !a.solid) continue;
      a.keepClear(player, a.radius + PLAYER_RADIUS);
      for (const b of this.enemies) {
        if (b === a || !b.alive || !b.solid) continue;
        // Split the overlap between two movers; a rooted Bellcap doesn't budge.
        a.keepClear(b.position, a.radius + b.radius, b.mobile ? 0.5 : 1);
      }
    }
  }

  private handleInput(): void {
    const g = this.game;
    const input = g.input;
    const eq = g.state.player.equipment;

    if (input.wasPressed('swap')) {
      const owned: WeaponSlot[] = ['blade'];
      if (eq.boltcaster) owned.push('boltcaster');
      if (eq.resonance) owned.push('resonance');
      this.weapon = owned[(owned.indexOf(this.weapon) + 1) % owned.length] ?? 'blade';
      this.aiming = false;
    }

    (['food1', 'food2', 'food3', 'food4'] as const).forEach((key, i) => {
      if (input.wasPressed(key) && !this.eating) {
        const slot = this.hotbar()[i];
        if (slot) {
          this.eating = { item: slot.item, time: 0 };
          g.viewmodel.swing(EAT_TIME, 'eat');
        }
      }
    });
    if (this.eating) return;

    if (this.weapon === 'blade') {
      if (input.isDown('attack') && this.cooldown <= 0) {
        const step = COMBO[this.combo] ?? COMBO[0];
        g.viewmodel.swing(step.duration, step.kind);
        this.pendingHit = { at: step.duration * 0.35, step };
        this.cooldown = step.duration * 0.85;
        this.combo = (this.combo + 1) % COMBO.length;
        this.comboReset = 0.9;
        g.events.emit('playerAttack', { weapon: 'blade' });
      }
      if (input.wasPressed('ability') && this.deflectCooldown <= 0) {
        this.deflectTime = 0.3;
        this.deflectCooldown = 0.75;
        g.viewmodel.swing(0.35, 'slash2');
      }
    } else if (this.weapon === 'boltcaster') {
      this.aiming = input.isDown('ability');
      if (input.isDown('attack') && this.cooldown <= 0 && this.reloading <= 0 && this.magazine > 0) this.fireBolt();
    } else if (this.weapon === 'resonance') {
      if (input.wasPressed('attack') && this.cooldown <= 0) this.surge();
    }
  }

  private updateEating(dt: number): void {
    const g = this.game;
    if (!this.eating) return;
    this.aiming = false;
    this.eating.time += dt;
    if (this.eating.time >= EAT_TIME) {
      const item = this.eating.item;
      this.eating = null;
      if (g.progress.take(item, 1) > 0) {
        const def = itemDef(item);
        if (def.buff) g.progress.addBuff(def.buff.id, def.buff.minutes);
        g.progress.heal(def.heal ?? 0);
      }
    }
  }

  private resolvePendingHit(dt: number): void {
    if (!this.pendingHit) return;
    this.pendingHit.at -= dt;
    if (this.pendingHit.at > 0) return;
    const step = this.pendingHit.step;
    this.pendingHit = null;
    const g = this.game;
    const eye = g.player.eyePosition();
    const facing = g.player.yaw + Math.PI;
    const base = (BLADE_DAMAGE[g.state.player.equipment.blade ?? 'copper_blade'] ?? 9) * proficiencyBonus(g.progress.level('blade'));
    let landed = false;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const c = enemy.center;
      const dx = c.x - eye.x;
      const dz = c.z - eye.z;
      const flat = Math.hypot(dx, dz);
      if (flat > step.reach + enemy.radius) continue;
      if (Math.abs(c.y - eye.y) > 1.8 + enemy.height * 0.5) continue;
      const angle = Math.abs(wrapAngle(Math.atan2(dx, dz) - facing)) * (180 / Math.PI);
      if (angle > step.arc && flat > enemy.radius + 0.6) continue;
      this.hitEnemy(enemy, base * step.scale, 'blade');
      landed = true;
    }
    if (landed) {
      g.loop.freeze(0.05);
      g.player.addShake(0.12);
    }
  }

  private fireBolt(): void {
    const g = this.game;
    const dir = g.player.aimDirection();
    const right = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const origin = g.player.eyePosition().addScaledVector(dir, 0.4).addScaledVector(right, 0.12).add(new THREE.Vector3(0, -0.12, 0));
    this.projectiles.spawn({ kind: 'bolt', pos: origin, vel: dir.multiplyScalar(BOLT_SPEED), radius: 0.12, damage: BOLT_DAMAGE * (this.aiming ? 1.3 : 1), friendly: true, life: 2, owner: 'boltcaster' });
    this.magazine--;
    this.cooldown = 0.32;
    g.viewmodel.swing(0.25, 'recoil');
    g.player.addShake(0.05);
    g.events.emit('playerAttack', { weapon: 'boltcaster' });
    if (this.magazine <= 0) this.reloading = RELOAD_TIME;
  }

  /** The Surge lantern burns a core for a cone shockwave. */
  private surge(): void {
    const g = this.game;
    const core: ItemId | null = g.progress.count('dim_core') > 0 ? 'dim_core' : g.progress.count('bright_core') > 0 ? 'bright_core' : null;
    if (!core) {
      g.hud.toast('The Surge lantern needs a core to burn.', 'warn');
      this.cooldown = 0.5;
      return;
    }
    g.progress.take(core, 1);
    this.cooldown = 1.2;
    g.viewmodel.swing(0.5, 'recoil');
    g.player.addShake(0.3);
    const eye = g.player.eyePosition();
    const facing = g.player.yaw + Math.PI;
    g.effects.burst(eye.clone().addScaledVector(g.player.aimDirection(), 1.2), { count: 40, color: 0x9ef3ff, speed: 9, size: 0.08, life: 0.5, gravity: 0, spread: 1, emissive: true });
    g.events.emit('playerAttack', { weapon: 'resonance' });
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const c = enemy.center;
      const flat = Math.hypot(c.x - eye.x, c.z - eye.z);
      const angle = Math.abs(wrapAngle(Math.atan2(c.x - eye.x, c.z - eye.z) - facing)) * (180 / Math.PI);
      if (flat < 6.5 && angle < 40) this.hitEnemy(enemy, SURGE_DAMAGE * proficiencyBonus(g.progress.level('resonance')), 'resonance');
    }
    for (const p of this.projectiles.alive()) {
      if (!p.friendly && p.pos.distanceTo(eye) < 5) this.projectiles.kill(p);
    }
  }

  hitEnemy(enemy: Enemy, amount: number, skill: 'blade' | 'boltcaster' | 'resonance'): void {
    const g = this.game;
    const dealt = enemy.damage(amount, g.player.position);
    const at = enemy.center;
    if (dealt > 0) {
      g.progress.addXp(skill, dealt * 4);
      g.events.emit('hit', { position: at, amount: dealt, weakPoint: enemy.vulnerable });
      g.effects.burst(at, { count: 8, color: 0xffd2a0, speed: 4, size: 0.04, life: 0.35, emissive: true });
    } else {
      g.events.emit('hit', { position: at, amount: 0, weakPoint: false });
    }
  }

  private updateProjectiles(dt: number): void {
    const g = this.game;
    const chest = g.player.chestPosition();
    this.projectiles.update(dt, chest, (p, at) => {
      g.effects.burst(at, { count: 6, color: p.friendly ? 0xc8b08a : 0xff3d9a, speed: 2.5, size: 0.04, life: 0.3, emissive: !p.friendly });
    });
    const forward = g.player.aimDirection();
    for (const p of this.projectiles.alive()) {
      if (p.friendly) {
        for (const enemy of this.enemies) {
          if (enemy.alive && enemy.hitTest(p.pos, p.radius)) {
            this.hitEnemy(enemy, p.damage, p.owner === 'boltcaster' ? 'boltcaster' : 'blade');
            this.projectiles.kill(p);
            break;
          }
        }
        continue;
      }
      if (this.deflectTime > 0 && p.pos.distanceTo(chest) < 3.2 && p.pos.clone().sub(chest).normalize().dot(forward) > 0.2) {
        this.deflect(p, forward);
        continue;
      }
      if (p.pos.distanceTo(chest) < p.radius + 0.38) {
        this.projectiles.kill(p);
        this.damagePlayer(p.damage, p.pos);
      }
    }
  }

  private deflect(p: Projectile, forward: THREE.Vector3): void {
    const speed = Math.max(14, p.vel.length() * 1.4);
    p.friendly = true;
    p.homing = 0;
    p.damage *= 2;
    p.life = 3;
    p.vel.copy(forward).multiplyScalar(speed);
    this.game.events.emit('deflect', { position: p.pos.clone() });
    this.game.effects.burst(p.pos, { count: 14, color: 0xffe0b0, speed: 5, size: 0.05, life: 0.3, emissive: true });
    this.game.progress.addXp('blade', 10);
  }

  /** Kills an enemy outright, for no loot or credit: trampled by something far bigger. */
  crush(enemy: Enemy): void {
    if (!enemy.alive) return;
    enemy.alive = false;
    this.crushed.add(enemy);
  }

  private collectDead(): void {
    const g = this.game;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy || enemy.alive) continue;
      this.enemies.splice(i, 1);
      this.releaseToken(enemy);
      g.state.depleted[enemy.spawnId] = g.state.day;
      const crushed = this.crushed.delete(enemy);
      if (!crushed) {
        for (const drop of enemy.drops) {
          if (g.rng() < drop.chance) g.progress.give(drop.item, drop.count ?? 1);
        }
        g.events.emit('enemyKilled', { type: enemy.type, position: enemy.center });
      }
      g.effects.burst(enemy.center, { count: 26, color: 0x9ef3ff, speed: 3, size: 0.06, life: 0.8, gravity: -1, emissive: true });
      enemy.dispose();
    }
  }

  // ---- Frame ----

  private frameUpdate(dt: number): void {
    for (const enemy of this.enemies) enemy.frame(dt, this.game.time);
    this.projectiles.sync();
    this.telegraphs.update(dt);
  }
}
