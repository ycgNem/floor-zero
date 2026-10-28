import type { Quality } from '../render/renderer';
import { button, el } from './dom';
import { saveSettings, type Settings } from './settings';

/** One skill's page in the guide: where you are, and everything it unlocks. */
export interface GuidePage {
  name: string;
  level: number;
  unlocks: { level: number; text: string }[];
}

export interface MenuCallbacks {
  hasSave(): boolean;
  skillGuide(): GuidePage[];
  onContinue(): void;
  onNewGame(): void;
  onResume(): void;
  onSave(): void;
  onQuitToTitle(): void;
  onSettingsChanged(settings: Settings): void;
}

type Screen = 'none' | 'title' | 'pause' | 'settings' | 'guide';

/** Title, pause, and settings screens. */
export class Menus {
  private readonly root: HTMLElement;
  private screen: Screen = 'none';
  private back: Screen = 'none';

  constructor(
    container: HTMLElement,
    private readonly settings: Settings,
    private readonly callbacks: MenuCallbacks,
  ) {
    this.root = el('div', 'menu', container);
    this.root.style.display = 'none';
  }

  get open(): boolean {
    return this.screen !== 'none';
  }

  get current(): Screen {
    return this.screen;
  }

  hide(): void {
    this.screen = 'none';
    this.root.style.display = 'none';
    this.root.replaceChildren();
  }

  showTitle(): void {
    this.show('title');
    this.root.classList.add('title-screen');
    const box = el('div', 'menu-box title-box', this.root);
    el('div', 'eyebrow', box, 'The Town at');
    el('h1', 'game-title', box, 'Floor Zero');
    el('p', 'tagline', box, 'A town built over an impossible descent.');
    const list = el('div', 'menu-list', box);
    if (this.callbacks.hasSave()) button('Continue', list, () => this.callbacks.onContinue(), 'btn primary');
    button('New game', list, () => {
      if (!this.callbacks.hasSave() || window.confirm('Start a new game? Your current save will be replaced.')) {
        this.callbacks.onNewGame();
      }
    }, this.callbacks.hasSave() ? 'btn' : 'btn primary');
    button('Settings', list, () => this.showSettings('title'));
    el('p', 'menu-hint', box, 'Mouse and keyboard. WASD to move, E to interact, Esc to pause.');
  }

  showPause(): void {
    this.show('pause');
    const box = el('div', 'menu-box', this.root);
    el('h2', 'menu-heading', box, 'Paused');
    const list = el('div', 'menu-list', box);
    button('Resume', list, () => this.callbacks.onResume(), 'btn primary');
    button('Save', list, () => this.callbacks.onSave());
    button('Skill guide', list, () => this.showGuide());
    button('Settings', list, () => this.showSettings('pause'));
    button('Quit to title', list, () => this.callbacks.onQuitToTitle());
    el('p', 'menu-hint', box, 'Click Resume, or click the game, to keep playing.');
  }

  showSettings(back: Screen): void {
    this.back = back;
    this.show('settings');
    const box = el('div', 'menu-box settings-box', this.root);
    el('h2', 'menu-heading', box, 'Settings');
    const s = this.settings;
    const changed = (): void => {
      saveSettings(s);
      this.callbacks.onSettingsChanged(s);
    };
    this.slider(box, 'Mouse sensitivity', 0.2, 3, 0.05, s.sensitivity, (v) => { s.sensitivity = v; changed(); }, (v) => `${v.toFixed(2)}x`);
    this.slider(box, 'Field of view', 70, 110, 1, s.fov, (v) => { s.fov = v; changed(); }, (v) => `${v}°`);
    this.slider(box, 'Brightness', 0.6, 1.8, 0.05, s.brightness, (v) => { s.brightness = v; changed(); }, (v) => `${Math.round(v * 100)}%`);
    this.slider(box, 'Volume', 0, 1, 0.05, s.volume, (v) => { s.volume = v; changed(); }, (v) => `${Math.round(v * 100)}%`);
    this.slider(box, 'Music', 0, 1, 0.05, s.music, (v) => { s.music = v; changed(); }, (v) => `${Math.round(v * 100)}%`);
    this.slider(box, 'Damage taken', 0.25, 1, 0.05, s.damageTaken, (v) => { s.damageTaken = v; changed(); }, (v) => `${Math.round(v * 100)}%`);
    this.choice(box, 'Graphics quality', ['low', 'medium', 'high'], s.quality, (v) => { s.quality = v as Quality; changed(); });
    this.toggle(box, 'Invert mouse Y', s.invertY, (v) => { s.invertY = v; changed(); });
    this.toggle(box, 'Head bob', s.headBob, (v) => { s.headBob = v; changed(); });
    this.toggle(box, 'Damage numbers', s.hitsplats, (v) => { s.hitsplats = v; changed(); });
    const list = el('div', 'menu-list', box);
    button('Back', list, () => (this.back === 'title' ? this.showTitle() : this.showPause()), 'btn primary');
  }

  /** RuneScape's skill guide: every unlock for every skill, with the ones you've reached lit. */
  showGuide(selected = 0): void {
    this.show('guide');
    const pages = this.callbacks.skillGuide();
    const box = el('div', 'menu-box guide-box', this.root);
    el('h2', 'menu-heading', box, 'Skill guide');
    const tabs = el('div', 'segmented guide-tabs', box);
    pages.forEach((page, i) => button(`${page.name} ${page.level}`, tabs, () => this.showGuide(i), i === selected ? 'seg on' : 'seg'));
    const page = pages[selected];
    const list = el('div', 'guide-list', box);
    for (const unlock of page?.unlocks ?? []) {
      const row = el('div', `guide-row${page && unlock.level <= page.level ? ' done' : ''}`, list);
      el('span', 'guide-level', row, String(unlock.level));
      el('span', '', row, unlock.text);
    }
    const back = el('div', 'menu-list', box);
    button('Back', back, () => this.showPause(), 'btn primary');
  }

  private show(screen: Screen): void {
    this.screen = screen;
    this.root.replaceChildren();
    this.root.classList.remove('title-screen');
    this.root.style.display = '';
  }

  private row(parent: HTMLElement, label: string): HTMLElement {
    const row = el('label', 'setting', parent);
    el('span', 'setting-label', row, label);
    return row;
  }

  private slider(parent: HTMLElement, label: string, min: number, max: number, step: number, value: number, onChange: (v: number) => void, format: (v: number) => string): void {
    const row = this.row(parent, label);
    const input = el('input', '', row);
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    const out = el('span', 'setting-value', row, format(value));
    input.addEventListener('input', () => {
      const v = Number(input.value);
      out.textContent = format(v);
      onChange(v);
    });
  }

  private toggle(parent: HTMLElement, label: string, value: boolean, onChange: (v: boolean) => void): void {
    const row = this.row(parent, label);
    const input = el('input', '', row);
    input.type = 'checkbox';
    input.checked = value;
    input.addEventListener('change', () => onChange(input.checked));
  }

  private choice(parent: HTMLElement, label: string, options: string[], value: string, onChange: (v: string) => void): void {
    const row = this.row(parent, label);
    const group = el('span', 'segmented', row);
    for (const option of options) {
      const b = button(option, group, () => {
        for (const child of Array.from(group.children)) child.classList.remove('on');
        b.classList.add('on');
        onChange(option);
      }, option === value ? 'seg on' : 'seg');
    }
  }
}
