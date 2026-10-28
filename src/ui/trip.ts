import { SKILL_IDS, SKILL_NAMES, type SkillId } from '../data/ids';
import { countOf, type ItemId } from '../data/items';
import type { Game } from '../game';
import { summarize } from '../items/inventory';
import { levelForXp } from '../skills/xp';
import { el } from './dom';

interface TripStart {
  skills: Record<SkillId, number>;
  money: number;
  playTime: number;
  pack: Map<ItemId, number>;
}

const SHOW_SECONDS = 11;

/**
 * Every trip counts (pillar 2): from the moment you go below until you're back on the plaza, it
 * keeps a tally, and on the way home shows what the trip was worth.
 */
export class TripLog {
  private readonly root: HTMLElement;
  private start: TripStart | null = null;
  private deepest = 0;
  private kills = 0;
  private freight = 0;
  private rescued = false;
  private hideTimer = 0;

  constructor(container: HTMLElement, private readonly game: Game) {
    this.root = el('div', 'trip', container);
    const e = game.events;
    e.on('areaEntered', () => {
      const floor = game.area?.def.floor ?? 0;
      if (game.mode !== 'playing') {
        this.start = null;
        return;
      }
      if (floor > 0) {
        if (!this.start) this.begin();
        this.deepest = Math.max(this.deepest, floor);
      } else if (this.start) {
        this.finish();
      }
    });
    e.on('enemyKilled', () => {
      if (this.start) this.kills++;
    });
    e.on('freight', () => {
      if (this.start) this.freight++;
    });
    e.on('playerDefeated', () => {
      this.rescued = true;
    });
  }

  private snapshot(): Map<ItemId, number> {
    return new Map(summarize(this.game.state.player.pack).map(({ item, count }) => [item, count]));
  }

  private begin(): void {
    const p = this.game.state.player;
    this.start = { skills: { ...p.skills }, money: p.money, playTime: this.game.state.playTime, pack: this.snapshot() };
    this.deepest = 0;
    this.kills = 0;
    this.freight = 0;
    this.rescued = false;
  }

  private finish(): void {
    const start = this.start;
    this.start = null;
    if (!start) return;
    const p = this.game.state.player;
    const lines: { text: string; dim?: boolean }[] = [];
    const minutes = Math.max(1, Math.round((this.game.state.playTime - start.playTime) / 60));
    lines.push({ text: `${minutes} minute${minutes === 1 ? '' : 's'} below, as deep as Floor ${this.deepest}`, dim: true });

    const gains = SKILL_IDS.map((id) => ({ id, xp: p.skills[id] - start.skills[id] }))
      .filter((g) => g.xp >= 1)
      .sort((a, b) => b.xp - a.xp);
    for (const { id, xp } of gains.slice(0, 4)) {
      const before = levelForXp(start.skills[id]);
      const after = levelForXp(p.skills[id]);
      lines.push({ text: `${SKILL_NAMES[id]} +${Math.round(xp)} XP${after > before ? `, level ${before} → ${after}` : ''}` });
    }

    const now = this.snapshot();
    const hauled = [...now].map(([item, count]) => ({ item, count: count - (start.pack.get(item) ?? 0) })).filter((h) => h.count > 0).sort((a, b) => b.count - a.count);
    if (hauled.length > 0) {
      const shown = hauled.slice(0, 4).map((h) => countOf(h.item, h.count)).join(', ');
      lines.push({ text: `Carrying ${shown}${hauled.length > 4 ? `, and ${hauled.length - 4} more` : ''}` });
    }
    if (this.freight > 0) lines.push({ text: `Sent a load up by freight${this.freight > 1 ? ` ${this.freight} times` : ''}`, dim: true });
    if (this.kills > 0) lines.push({ text: `${this.kills} creature${this.kills === 1 ? '' : 's'} put down`, dim: true });
    const bells = p.money - start.money;
    if (bells !== 0) lines.push({ text: `${bells > 0 ? '+' : ''}${bells} bells`, dim: bells < 0 });
    if (gains.length === 0 && hauled.length === 0) lines.push({ text: 'Nothing to show for it. It happens.', dim: true });

    this.root.replaceChildren();
    el('div', 'trip-eyebrow', this.root, this.rescued ? 'Hauled out by Mara’s crew' : 'Back in Bellwether');
    for (const line of lines) el('div', `trip-line${line.dim ? ' dim' : ''}`, this.root, line.text);
    this.rescued = false;
    window.clearTimeout(this.hideTimer);
    window.setTimeout(() => this.root.classList.add('show'), 1400);
    this.hideTimer = window.setTimeout(() => this.root.classList.remove('show'), (1.4 + SHOW_SECONDS) * 1000);
  }
}
