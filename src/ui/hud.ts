import { el, wait } from './dom';

export type ToastKind = 'info' | 'good' | 'warn';

/** The in-game overlay. Pure DOM, no game logic. */
export class Hud {
  readonly root: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly promptKey: HTMLElement;
  private readonly promptText: HTMLElement;
  private readonly caption: HTMLElement;
  private readonly captionFloor: HTMLElement;
  private readonly captionTitle: HTMLElement;
  private readonly toasts: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly healthLabel: HTMLElement;
  private readonly pips: HTMLElement;
  private readonly buffs: HTMLElement;
  private buffKey = '';
  private readonly fadeEl: HTMLElement;
  private readonly subtitleEl: HTMLElement;
  private readonly xpColumn: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly pickups: HTMLElement;
  private readonly tracker: HTMLElement;
  private captionTimer = 0;
  private subtitleTimer = 0;
  private lastPrompt = '';

  constructor(container: HTMLElement) {
    this.root = el('div', 'hud', container);
    this.crosshair = el('div', 'crosshair', this.root);
    this.prompt = el('div', 'prompt', this.root);
    this.promptKey = el('span', 'key', this.prompt, 'E');
    this.promptText = el('span', '', this.prompt);
    this.caption = el('div', 'caption', this.root);
    this.captionFloor = el('div', 'floor', this.caption);
    this.captionTitle = el('div', 'title', this.caption);
    this.toasts = el('div', 'toasts', this.root);
    const vitals = el('div', 'vitals', this.root);
    this.buffs = el('div', 'buffs', vitals);
    this.healthLabel = el('div', 'bar-label', vitals);
    this.healthFill = el('i', '', el('div', 'bar', vitals));
    this.pips = el('div', 'pips', vitals);
    this.subtitleEl = el('div', 'subtitle', this.root);
    this.xpColumn = el('div', 'xp-column', this.root);
    this.banner = el('div', 'banner', this.root);
    this.pickups = el('div', 'pickups', this.root);
    this.tracker = el('div', 'tracker', this.root);
    this.fadeEl = el('div', 'fade', container);
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? '' : 'none';
  }

  setPrompt(text: string | null, key = 'E'): void {
    const id = text ? `${key}|${text}` : '';
    if (id === this.lastPrompt) return;
    this.lastPrompt = id;
    this.prompt.classList.toggle('show', text !== null);
    this.crosshair.classList.toggle('active', text !== null);
    if (text) {
      this.promptKey.textContent = key;
      this.promptText.textContent = text;
    }
  }

  toast(text: string, kind: ToastKind = 'info', seconds = 3.2): void {
    const node = el('div', `toast ${kind === 'info' ? '' : kind}`, this.toasts, text);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
    setTimeout(() => node.classList.add('out'), seconds * 1000);
    setTimeout(() => node.remove(), seconds * 1000 + 600);
  }

  showCaption(floor: string, title: string, seconds = 3.5): void {
    this.captionFloor.textContent = floor;
    this.captionTitle.textContent = title;
    this.caption.classList.add('show');
    window.clearTimeout(this.captionTimer);
    this.captionTimer = window.setTimeout(() => this.caption.classList.remove('show'), seconds * 1000);
  }

  subtitle(text: string, seconds = 3): void {
    this.subtitleEl.textContent = text;
    this.subtitleEl.classList.add('show');
    window.clearTimeout(this.subtitleTimer);
    this.subtitleTimer = window.setTimeout(() => this.subtitleEl.classList.remove('show'), seconds * 1000);
  }

  setHealth(current: number, max: number): void {
    this.healthFill.style.width = `${Math.max(0, Math.min(1, current / max)) * 100}%`;
    this.healthLabel.textContent = `${Math.ceil(current)} / ${max}`;
  }

  /** Meal buff chips above the health bar, with minutes and seconds left. */
  setBuffs(buffs: { name: string; remaining: number }[]): void {
    const clock = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const key = buffs.map((b) => `${b.name} ${clock(b.remaining)}`).join('|');
    if (key === this.buffKey) return;
    this.buffKey = key;
    this.buffs.replaceChildren();
    for (const b of buffs) {
      const chip = el('span', 'buff', this.buffs, b.name);
      el('b', '', chip, clock(b.remaining));
    }
  }

  setDash(charges: number, max: number): void {
    if (this.pips.children.length !== max) {
      this.pips.replaceChildren();
      for (let i = 0; i < max; i++) el('i', '', this.pips);
    }
    Array.from(this.pips.children).forEach((pip, i) => pip.classList.toggle('empty', i >= charges));
  }

  xpDrop(label: string, amount: number): void {
    const node = el('div', 'xp-drop', this.xpColumn, `+${Number.isInteger(amount) ? amount : amount.toFixed(1)} ${label}`);
    setTimeout(() => node.remove(), 1600);
  }

  levelUp(skill: string, level: number): void {
    this.announce('Level up', `${skill} ${level}`);
  }

  /** A big centred announcement: level-ups, rank-ups, discoveries. */
  announce(eyebrow: string, title: string): void {
    this.banner.replaceChildren();
    el('div', 'banner-eyebrow', this.banner, eyebrow);
    el('div', 'banner-title', this.banner, title);
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
  }

  pickup(name: string, count: number): void {
    const now = performance.now();
    const last = this.pickups.lastElementChild as HTMLElement | null;
    if (last && last.dataset.name === name && now - Number(last.dataset.time) < 1500) {
      const total = Number(last.dataset.count) + count;
      last.dataset.count = String(total);
      last.dataset.time = String(now);
      last.textContent = `+${total} ${name}`;
      return;
    }
    const node = el('div', 'pickup', this.pickups, `+${count} ${name}`);
    node.dataset.name = name;
    node.dataset.count = String(count);
    node.dataset.time = String(now);
    while (this.pickups.children.length > 5) this.pickups.firstElementChild?.remove();
    setTimeout(() => node.remove(), 2600);
  }

  setObjectives(main: string, optional: string | null): void {
    const text = `${main}|${optional ?? ''}`;
    if (this.tracker.dataset.text === text) return;
    this.tracker.dataset.text = text;
    this.tracker.replaceChildren();
    el('div', 'tracker-label', this.tracker, 'Main');
    el('div', 'tracker-main', this.tracker, main);
    if (optional) {
      el('div', 'tracker-label', this.tracker, 'Optional');
      el('div', 'tracker-optional', this.tracker, optional);
    }
  }

  /** Fades the screen to black (1) or back (0). */
  async fade(to: 0 | 1, seconds = 0.6): Promise<void> {
    this.fadeEl.style.transition = `opacity ${seconds}s ease`;
    this.fadeEl.style.opacity = String(to);
    await wait(seconds);
  }

  setFadeInstant(value: number): void {
    this.fadeEl.style.transition = 'none';
    this.fadeEl.style.opacity = String(value);
  }
}
