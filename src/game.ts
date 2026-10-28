import * as THREE from 'three';
import { EventBus } from './core/events';
import { Input } from './core/input';
import { Loop } from './core/loop';
import { createRng, type Rng } from './core/rng';
import { BUFFS } from './data/buffs';
import type { AreaId, FlagId } from './data/ids';
import type { ItemId } from './data/items';
import type { GameEvents } from './game-events';
import { Physics } from './physics/physics';
import { Interaction } from './player/interaction';
import { Player } from './player/player';
import { Progress } from './player/progress';
import { Viewmodel, type Held } from './player/viewmodel';
import { Fishing } from './skills/fishing';
import { Gathering } from './skills/gathering';
import { SKILL_NAMES } from './data/ids';
import { ITEMS } from './data/items';
import { Story } from './story/beats';
import { trackerJob } from './story/jobs';
import { mainObjective } from './story/story';
import { Town } from './town/town';
import { Panels } from './ui/panels';
import { ExpeditionCard } from './ui/card';
import { Combat } from './combat/combat';
import { Effects } from './render/effects';
import { CombatHud } from './ui/combat-hud';
import { AudioEngine } from './audio/audio';
import { bindAudio } from './audio/sound-events';
import { Dust } from './render/atmosphere';
import { Renderer } from './render/renderer';
import { hasSave, loadGame, saveGame } from './save/save';
import { createNewState, hasFlag, type WorldState } from './save/world-state';
import { wait } from './ui/dom';
import { Hud } from './ui/hud';
import { Menus } from './ui/menus';
import { loadSettings, type Settings } from './ui/settings';
import type { AreaDef, AreaRuntime } from './world/area';
import { AREAS, floorLabel } from './world/areas';
import { LevelKit } from './world/level-kit';
import { MaterialLibrary } from './world/materials';

type Mode = 'title' | 'playing' | 'paused';

interface LoadedArea {
  def: AreaDef;
  kit: LevelKit;
  runtime: AreaRuntime;
}

const BASE_SENSITIVITY = 0.0022;
/** AgX at 1.0 reads murky underground; this is the 100% brightness setting. */
const BASE_EXPOSURE = 1.3;
const KILL_Y = -8;

/** Composition root: owns every system and the current area. */
export class Game {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(85, 1, 0.05, 400);
  readonly events = new EventBus<GameEvents>();
  readonly materials = new MaterialLibrary();
  readonly renderer: Renderer;
  readonly input: Input;
  readonly loop: Loop;
  readonly hud: Hud;
  readonly menus: Menus;
  readonly player: Player;
  readonly interaction: Interaction;
  readonly settings: Settings;
  readonly progress: Progress;
  readonly viewmodel: Viewmodel;
  readonly gathering: Gathering;
  readonly fishing: Fishing;
  readonly panels: Panels;
  readonly town: Town;
  readonly story: Story;
  readonly effects: Effects;
  readonly dust: Dust;
  readonly audio = new AudioEngine();
  private shadowBake = false;
  readonly combat: Combat;
  /** A warm light you carry below ground, so caves stay readable. */
  readonly playerLight = new THREE.PointLight(0xffc68a, 3, 9, 2);
  state: WorldState = createNewState(1);
  rng: Rng = createRng(1);
  mode: Mode = 'title';
  /** Seconds since boot, for animation. */
  time = 0;
  area: LoadedArea | null = null;
  private transitioning = false;
  /** True while an in-game panel (shop, dialogue) owns the mouse. */
  panelOpen = false;
  private readonly frameHooks: ((dt: number) => void)[] = [];
  private readonly fixedHooks: ((dt: number) => void)[] = [];

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly uiRoot: HTMLElement,
    readonly physics: Physics,
  ) {
    this.settings = loadSettings();
    this.renderer = new Renderer(canvas, this.scene, this.camera);
    this.input = new Input(canvas);
    this.hud = new Hud(uiRoot);
    this.player = new Player(physics, this.input, this.camera);
    this.interaction = new Interaction(physics, this.input, this.camera);
    this.viewmodel = new Viewmodel(this.materials, this.renderer);
    this.progress = new Progress(this);
    this.gathering = new Gathering(this);
    this.fishing = new Fishing(this);
    this.panels = new Panels(uiRoot, this);
    this.town = new Town(this);
    this.story = new Story(this);
    this.effects = new Effects(this.scene);
    this.combat = new Combat(this);
    this.dust = new Dust(this.scene);
    this.onFrame((dt) => {
      this.effects.update(dt);
      this.dust.update(this.time, this.camera, this.renderer.gl.domElement.height);
    });
    new CombatHud(this);
    new ExpeditionCard(uiRoot, this);
    this.scene.add(this.playerLight);
    this.bindHud();
    bindAudio(this, this.audio);
    // Flags mark nearly every change to the world (a wall broken, a walkway built), so re-bake then.
    this.events.on('flagSet', () => this.refreshShadows());
    this.menus = new Menus(uiRoot, this.settings, {
      hasSave: () => hasSave(),
      onContinue: () => this.continueGame(),
      onNewGame: () => this.newGame(),
      onResume: () => this.resume(),
      onSave: () => this.hud.toast(this.save() ? 'Game saved.' : 'Could not save.', 'good'),
      onQuitToTitle: () => this.quitToTitle(),
      onSettingsChanged: () => this.applySettings(),
    });
    this.applySettings();
    this.loop = new Loop({ fixedUpdate: (dt) => this.fixedUpdate(dt), update: (dt, alpha) => this.update(dt, alpha) });

    canvas.addEventListener('click', () => {
      if (this.mode === 'playing' && !this.panelOpen) this.input.requestLock();
    });
    this.input.onLockChange((locked) => {
      if (!locked && this.mode === 'playing' && !this.panelOpen) this.pause();
    });
  }

  start(): void {
    this.showTitle();
    this.loop.start();
  }

  private bindHud(): void {
    const e = this.events;
    e.on('xpGained', ({ skill, amount }) => this.hud.xpDrop(SKILL_NAMES[skill], amount));
    e.on('levelUp', ({ skill, level }) => this.hud.levelUp(SKILL_NAMES[skill], level));
    e.on('itemAdded', ({ item, count }) => this.hud.pickup(ITEMS[item].name, count));
    e.on('moneyChanged', ({ delta }) => {
      if (delta !== 0) this.hud.pickup(delta > 0 ? 'bells' : 'bells spent', Math.abs(delta));
    });
    e.on('nodeStruck', ({ position, skill }) => {
      if (skill === 'mining') this.effects.burst(position, { count: 7, color: 0x6a645c, speed: 3.2, size: 0.05, life: 0.6 });
      this.player.addShake(skill === 'mining' ? 0.06 : 0);
    });
    e.on('nodeYield', ({ position, item }) => {
      const color = item === 'copper_ore' ? 0xd07a40 : item === 'iron_ore' ? 0xb8bcc4 : item === 'cobalt_ore' ? 0x4a7aff : 0x9fd4ff;
      this.effects.burst(position, { count: 12, color, speed: 2.5, size: 0.06, life: 0.7, emissive: item === 'cobalt_ore' || item === 'glowcap' });
    });
  }

  /** Lets other systems run every fixed step or every frame without editing Game. */
  onFixed(hook: (dt: number) => void): void {
    this.fixedHooks.push(hook);
  }

  /** Re-renders the cached lamp shadows on the next frame. */
  refreshShadows(): void {
    this.shadowBake = true;
  }

  /**
   * Lamp point lights never move, so their six-sided shadow maps render once instead of every
   * frame (most of each area's draw calls). Moving things sit out the frame that bakes them, so
   * they don't leave frozen shadows behind; enemies carry blob shadows instead.
   */
  private prepareShadowBake(): THREE.Object3D[] {
    this.shadowBake = false;
    const movers: THREE.Object3D[] = [];
    this.scene.traverse((object) => {
      if (object instanceof THREE.PointLight && object.castShadow) {
        object.shadow.autoUpdate = false;
        object.shadow.needsUpdate = true;
      }
      if (object.userData.dynamic) {
        object.traverse((o) => {
          if (o.castShadow) {
            o.castShadow = false;
            movers.push(o);
          }
        });
      }
    });
    return movers;
  }

  onFrame(hook: (dt: number) => void): void {
    this.frameHooks.push(hook);
  }

  // ---- Flags ----

  hasFlag(flag: FlagId): boolean {
    return hasFlag(this.state, flag);
  }

  setFlag(flag: FlagId): void {
    if (this.hasFlag(flag)) return;
    this.state.flags.push(flag);
    this.events.emit('flagSet', { flag });
  }

  toggleFlag(flag: FlagId): void {
    if (this.hasFlag(flag)) this.state.flags = this.state.flags.filter((f) => f !== flag);
    else this.setFlag(flag);
  }

  // ---- Areas ----

  setSky(color: number, density: number): void {
    this.scene.background = new THREE.Color(color);
    this.scene.fog = new THREE.FogExp2(color, density);
  }

  /** Rebuilds the current area in place, e.g. after the time of day changes. */
  reloadArea(): void {
    if (!this.area) return;
    const pos = this.player.position.clone();
    const yaw = this.player.yaw;
    this.loadArea(this.area.def.id, null);
    this.player.teleport(pos, yaw);
  }

  loadArea(id: AreaId, spawnId: string | null): void {
    const def = AREAS[id];
    if (!def) throw new Error(`Area not built: ${id}`);
    this.unloadArea();
    this.setSky(def.fog.color, def.fog.density);
    const kit = new LevelKit(this.physics, this.materials);
    const runtime = def.build({ game: this, kit });
    kit.finish();
    this.scene.add(kit.root);
    this.renderer.applyShadowSize(kit.root);
    this.refreshShadows();
    this.physics.step();
    this.area = { def, kit, runtime };
    this.state.player.area = id;
    this.state.player.deepestFloor = Math.max(this.state.player.deepestFloor, def.floor);
    this.playerLight.visible = def.floor > 0;
    this.dust.set({ visible: def.floor > 0, ...def.dust });
    this.updateLantern();
    this.viewmodel.setAmbient(def.floor > 0 ? 0.5 : 1.1);
    const spawn = (spawnId ? runtime.spawns.get(spawnId) : undefined) ?? runtime.spawns.values().next().value;
    if (spawn) this.player.teleport(spawn.pos, spawn.yaw);
    this.events.emit('areaEntered', { area: id });
  }

  /** Your carried light: the bright lantern roughly doubles its reach. */
  updateLantern(): void {
    const bright = this.state.player.equipment.lantern !== null;
    this.playerLight.intensity = bright ? 11 : 6;
    this.playerLight.distance = bright ? 18 : 12;
  }

  private unloadArea(): void {
    if (!this.area) return;
    this.events.emit('areaUnloading', {});
    this.interaction.cancel();
    this.area.runtime.dispose?.();
    this.area.kit.dispose();
    this.area = null;
    this.objectiveOverride = null;
  }

  async travel(id: AreaId, spawnId: string, style: 'lift' | 'walk' = 'walk'): Promise<void> {
    if (this.transitioning) return;
    const def = AREAS[id];
    if (!def) {
      this.hud.toast('That way isn’t open yet.', 'warn');
      return;
    }
    this.transitioning = true;
    this.player.frozen = true;
    await this.hud.fade(1, style === 'lift' ? 0.9 : 0.45);
    if (style === 'lift') {
      this.events.emit('sound', { name: 'lift' });
      await wait(0.5);
    }
    if (def.floor > 0 && !this.state.evening) {
      this.state.evening = true;
    }
    this.loadArea(id, spawnId);
    this.save();
    await wait(0.15);
    void this.hud.fade(0, 0.8);
    this.hud.showCaption(floorLabel(def.floor), def.name);
    this.player.frozen = false;
    this.transitioning = false;
  }

  // ---- Modes ----

  private showTitle(): void {
    this.mode = 'title';
    this.input.gameplay = false;
    this.hud.setVisible(false);
    this.state = createNewState(1);
    this.state.evening = true;
    this.loadArea('lift-plaza', 'start');
    this.menus.showTitle();
    this.hud.setFadeInstant(1);
    void this.hud.fade(0, 1.5);
  }

  newGame(): void {
    this.beginPlay(createNewState(), 'start');
  }

  continueGame(): void {
    const saved = loadGame();
    if (!saved) {
      this.hud.toast('No save found.', 'warn');
      return;
    }
    this.beginPlay(saved, saved.player.spawn);
  }

  private beginPlay(state: WorldState, spawn: string | null): void {
    this.state = state;
    this.rng = createRng(state.seed + state.day * 7919);
    this.menus.hide();
    this.mode = 'playing';
    this.input.gameplay = true;
    this.hud.setVisible(true);
    this.loadArea(state.player.area, spawn);
    if (!spawn) {
      const [x, y, z] = state.player.position;
      this.player.teleport(new THREE.Vector3(x, y, z), state.player.yaw);
    }
    this.hud.setFadeInstant(1);
    void this.hud.fade(0, 1.2);
    const def = this.area?.def;
    if (def) this.hud.showCaption(floorLabel(def.floor), def.name);
    this.input.requestLock();
  }

  pause(): void {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.loop.timeScale = 0;
    this.input.gameplay = false;
    this.interaction.cancel();
    this.menus.showPause();
  }

  resume(): void {
    this.menus.hide();
    this.mode = 'playing';
    this.loop.timeScale = 1;
    this.input.gameplay = true;
    this.input.requestLock();
  }

  private quitToTitle(): void {
    this.save();
    this.loop.timeScale = 1;
    this.input.exitLock();
    this.showTitle();
  }

  /** Opens an in-game panel: frees the mouse without pausing. */
  openPanel(): void {
    this.panelOpen = true;
    this.input.gameplay = false;
    this.interaction.cancel();
    this.input.exitLock();
  }

  closePanel(): void {
    this.panelOpen = false;
    this.input.gameplay = true;
    this.input.requestLock();
  }

  save(): boolean {
    if (this.mode === 'title') return false;
    const p = this.player.position;
    this.state.player.position = [p.x, p.y, p.z];
    this.state.player.yaw = this.player.yaw;
    this.state.player.spawn = null;
    return saveGame(this.state);
  }

  applySettings(): void {
    const s = this.settings;
    this.input.sensitivity = BASE_SENSITIVITY * s.sensitivity;
    this.input.invertY = s.invertY;
    this.player.settings = { fov: s.fov, headBob: s.headBob };
    this.renderer.setQuality(s.quality);
    this.renderer.setExposure(BASE_EXPOSURE * s.brightness);
    this.audio.setVolumes(s.volume, s.music);
  }

  // ---- Loop ----

  private fixedUpdate(dt: number): void {
    if (this.mode === 'playing') {
      this.state.playTime += dt;
      this.progress.tickBuffs();
      this.player.dashRechargeScale = this.progress.buffScale('dashRecharge');
      this.player.fixedUpdate(dt);
      const interactables = this.area?.runtime.interactables ?? [];
      this.interaction.update(dt, interactables, this.player.frozen || this.panelOpen);
      this.area?.runtime.update?.(dt);
      for (const hook of this.fixedHooks) hook(dt);
      if (this.player.position.y < KILL_Y && !this.transitioning) this.onFell();
    }
    this.physics.step();
    this.input.clearPressed();
  }

  /** What's in your hands: the pickaxe while mining, otherwise your weapon below ground. */
  heldOverride: { held: Held; item: ItemId | null } | null = null;
  /** Replaces the main objective while a scripted event plays out. Cleared when the area unloads. */
  objectiveOverride: string | null = null;

  private updateHeld(): void {
    const eq = this.state.player.equipment;
    if (this.heldOverride) {
      this.viewmodel.setHeld(this.heldOverride.held, this.heldOverride.item);
      return;
    }
    const skill = this.gathering.activeSkill;
    if (this.fishing.busy) this.viewmodel.setHeld('rod');
    else if (skill === 'mining') this.viewmodel.setHeld('pickaxe', eq.pickaxe);
    else if (skill) this.viewmodel.setHeld('none');
    else if (this.combat.eating) this.viewmodel.setHeld('none');
    else if ((this.area?.def.floor ?? 0) > 0) {
      const held = this.combat.heldItem();
      this.viewmodel.setHeld(held.held, held.item);
    } else this.viewmodel.setHeld('none');
  }

  private onFell(): void {
    const spawn = this.area?.runtime.spawns.values().next().value;
    if (spawn) this.player.teleport(spawn.pos, spawn.yaw);
    this.hud.toast('You fell. Someone hauled you back up, grumbling.', 'warn');
  }

  private update(dt: number, alpha: number): void {
    this.time += dt;
    if (this.mode === 'title') {
      const t = this.time * 0.05;
      this.camera.position.set(Math.sin(t) * 19, 5.5, Math.cos(t) * 19);
      this.camera.lookAt(0, 3, -4);
    } else {
      this.player.frameUpdate(dt, alpha);
      this.updateHeld();
      const speed = Math.hypot(this.player.velocity.x, this.player.velocity.z);
      this.viewmodel.update(dt, speed, this.player.lookDelta.yaw, this.player.lookDelta.pitch, !this.panelOpen && this.mode === 'playing');
      this.playerLight.position.copy(this.camera.position).add(new THREE.Vector3(0, -0.25, 0));
      const target = this.interaction.target;
      const cue = this.fishing.cue;
      this.hud.setPrompt(cue ?? (target ? target.label() : null), !cue && target?.mode === 'hold' ? 'Hold E' : 'E');
      this.hud.setDash(this.player.dashCharges, 2);
      this.hud.setBuffs(this.progress.activeBuffs().map((b) => ({ name: BUFFS[b.id].name, remaining: b.remaining })));
      this.hud.setHealth(this.state.player.health, this.progress.maxHealth());
      this.hud.setObjectives(this.objectiveOverride ?? mainObjective(this), trackerJob(this));
    }
    this.area?.runtime.frame?.(dt, this.time);
    for (const hook of this.frameHooks) hook(dt);
    const movers = this.shadowBake ? this.prepareShadowBake() : null;
    this.renderer.render();
    if (movers) for (const o of movers) o.castShadow = true;
  }
}
