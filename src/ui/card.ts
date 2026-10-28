import { SKILL_IDS, SKILL_NAMES } from '../data/ids';
import { ITEMS } from '../data/items';
import type { Game } from '../game';
import { nextUnlock } from '../skills/guide';
import { levelProgress } from '../skills/xp';
import { describeCondition } from '../story/conditions';
import { trackerJob } from '../story/jobs';
import { mainObjective, sideObjective } from '../story/story';
import { el } from './dom';

const RANK_TITLES = ['Unlicensed', 'Novice Delver', 'Delver', 'Senior Delver', 'Expert Delver', 'Master Delver'];

/** The expedition card: Tab shows your pack, skills, and goals without pausing. */
export class ExpeditionCard {
  private readonly root: HTMLElement;
  private visible = false;
  private refreshTimer = 0;

  constructor(container: HTMLElement, private readonly game: Game) {
    this.root = el('div', 'card', container);
    this.root.style.display = 'none';
    game.onFrame((dt) => {
      if (game.mode !== 'playing') {
        if (this.visible) this.toggle(false);
        return;
      }
      if (game.input.consume('card')) this.toggle(!this.visible);
      if (!this.visible) return;
      this.refreshTimer -= dt;
      if (this.refreshTimer <= 0) this.render();
    });
  }

  toggle(show: boolean): void {
    this.visible = show;
    this.root.style.display = show ? '' : 'none';
    if (show) this.render();
  }

  private render(): void {
    this.refreshTimer = 0.4;
    const g = this.game;
    const s = g.state;
    const p = s.player;
    this.root.replaceChildren();

    const left = el('div', 'card-col', this.root);
    el('div', 'card-title', left, 'Expedition');
    el('div', 'card-sub', left, `Day ${s.day} · ${RANK_TITLES[p.licenseRank] ?? ''} · ${p.money} bells`);
    el('div', 'card-label', left, 'Main');
    el('div', 'card-text', left, mainObjective(g));
    const optional = [trackerJob(g), sideObjective(g)].filter((line): line is string => line !== null);
    if (optional.length > 0) {
      el('div', 'card-label', left, 'Optional');
      for (const line of optional) el('div', 'card-text dim', left, line);
    }
    const today = g.conditions.map(describeCondition);
    if (today.length > 0) {
      el('div', 'card-label', left, 'Today below');
      el('div', 'card-text dim', left, today.map((c) => c.title).join(' · '));
    }
    const slots = g.progress.packSlots();
    el('div', 'card-label', left, `Pack (${p.pack.length}/${slots})`);
    const grid = el('div', 'pack-grid', left);
    for (let i = 0; i < slots; i++) {
      const stack = p.pack[i];
      const slot = el('div', `slot${stack ? ` kind-${ITEMS[stack.item].kind}` : ''}`, grid);
      if (stack) {
        slot.title = ITEMS[stack.item].name;
        el('span', 'slot-name', slot, ITEMS[stack.item].name);
        if (stack.count > 1) el('span', 'slot-count', slot, String(stack.count));
      }
    }
    el('div', 'card-label', left, 'Gear');
    const eq = p.equipment;
    const gear = [eq.pickaxe, eq.blade, eq.boltcaster, eq.rod, eq.armour, eq.lantern, eq.resonance, eq.pack, eq.charm]
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .map((id) => ITEMS[id].name);
    el('div', 'card-text dim', left, gear.join(' · '));

    const right = el('div', 'card-col', this.root);
    el('div', 'card-title', right, 'Skills');
    for (const id of SKILL_IDS) {
      const progress = levelProgress(p.skills[id]);
      const row = el('div', 'skill-row', right);
      el('span', 'skill-name', row, SKILL_NAMES[id]);
      el('span', 'skill-level', row, String(progress.level));
      const bar = el('div', 'skill-bar', row);
      el('i', '', bar).style.width = `${Math.round(progress.fraction * 100)}%`;
      const next = nextUnlock(id, progress.level);
      if (next) el('div', 'skill-next', row, `${next.level}: ${next.text}`);
    }
    el('div', 'card-hint', right, 'Tab to close · the full skill guide is in the pause menu');
  }
}
