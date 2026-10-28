import * as THREE from 'three';
import { BUFFS } from '../data/buffs';
import { countOf, itemDef, ITEMS, type ItemId } from '../data/items';
import { RECIPES, type RecipeId, type Station } from '../data/recipes';
import type { Game } from '../game';
import { craft, inputsText, maxCrafts, recipeBlocker } from '../items/crafting';
import { addItem, removeItem, summarize } from '../items/inventory';
import { MARKET_STOCK, saleTotal, sellPrice } from '../items/market';
import { activeJob, deliverJob } from '../story/jobs';
import { priceScale } from '../story/conditions';
import type { PanelAction, PanelRow, PanelSpec } from '../ui/panels';
import type { Interactable } from '../world/area';
import { sleep } from '../world/days';
import type { LevelKit } from '../world/level-kit';
import { dialogueFor } from './dialogue';
import { NPCS, NpcFigure, type NpcId } from './npcs';

const BANK_SLOTS = 200;

/** Townsfolk, their services, and the shops. */
export class Town {
  private figures: NpcFigure[] = [];

  constructor(private readonly game: Game) {
    game.onFrame((dt) => {
      for (const figure of this.figures) figure.update(dt, game.player.position);
    });
    game.events.on('areaEntered', () => {
      this.figures = this.figures.filter((f) => f.group.parent !== null);
    });
  }

  spawn(kit: LevelKit, id: NpcId, position: THREE.Vector3, yaw: number, interactables: Interactable[]): NpcFigure {
    const figure = new NpcFigure(NPCS[id].look, position, yaw);
    kit.add(figure.group);
    this.figures.push(figure);
    interactables.push({
      id: `npc-${id}`,
      position: figure.headPosition.setY(position.y + 1.3),
      radius: 0.55,
      range: 3.2,
      mode: 'press',
      enabled: () => true,
      label: () => `Talk to ${NPCS[id].name}`,
      press: () => this.talk(id),
    });
    return figure;
  }

  talk(id: NpcId): void {
    this.game.events.emit('dialogue', { npc: id });
    this.game.panels.show(() => dialogueFor(this.game, id));
  }

  /** A "Deliver" option when today's job belongs to this NPC. */
  jobOption(id: NpcId): PanelAction | null {
    const job = activeJob(this.game);
    if (!job || job.npc !== id) return null;
    const have = this.game.progress.count(job.item);
    return {
      label: `Deliver ${job.count} ${ITEMS[job.item].name.toLowerCase()} (${have}/${job.count})`,
      disabled: have < job.count,
      onClick: () => void deliverJob(this.game),
    };
  }

  // ---- Shops ----

  /** Sell buttons for what you carry. Today's demand and bounties raise what a buyer pays. */
  sellRows(filter: (item: ItemId) => boolean, buyer: 'market' | 'cores' | 'kitchen', markup = 1): PanelRow[] {
    const state = this.game.state;
    return summarize(state.player.pack)
      .filter(({ item }) => ITEMS[item].value > 0 && filter(item))
      .map(({ item, count }) => {
        const sold = state.soldToday[item] ?? 0;
        const boost = priceScale(this.game.conditions, item, buyer);
        const value = Math.round(ITEMS[item].value * markup * boost);
        const sell = (n: number): void => {
          const total = saleTotal(value, state.soldToday[item] ?? 0, n);
          this.game.progress.take(item, n);
          state.soldToday[item] = (state.soldToday[item] ?? 0) + n;
          this.game.progress.addMoney(total);
          this.game.events.emit('sold', { total });
        };
        return {
          title: `${ITEMS[item].name} ×${count}${boost > 1 ? ' · in demand today' : ''}`,
          meta: `${sellPrice(value, sold)} each`,
          actions: [
            { label: 'Sell 1', onClick: () => sell(1) },
            { label: `Sell all (${saleTotal(value, sold, count)})`, onClick: () => sell(count) },
          ],
        };
      });
  }

  market(): PanelSpec {
    const p = this.game.progress;
    const rows: PanelRow[] = [{ title: 'Sell', dim: true }, ...this.sellRows(() => true, 'market')];
    rows.push({ title: 'Buy', dim: true });
    for (const stock of MARKET_STOCK) {
      rows.push({
        title: stock.count > 1 ? `${ITEMS[stock.item].name} ×${stock.count}` : ITEMS[stock.item].name,
        detail: itemDef(stock.item).description,
        meta: `${stock.price} bells`,
        actions: [{
          label: 'Buy',
          disabled: p.money < stock.price || !p.hasSpace(stock.item, stock.count),
          onClick: () => {
            if (p.give(stock.item, stock.count) > 0) p.addMoney(-stock.price);
          },
        }],
      });
    }
    return { name: 'Bram’s stall', role: 'Market', rows, options: [{ label: 'Done', onClick: () => this.game.panels.close() }], footer: `${p.money} bells. Prices drop as you sell more of one thing today.` };
  }

  crafting(station: Station): PanelSpec {
    const rows: PanelRow[] = [];
    for (const id of Object.keys(RECIPES) as RecipeId[]) {
      const recipe = RECIPES[id];
      if (recipe.station !== station) continue;
      if ('requires' in recipe && recipe.requires && !this.game.hasFlag(recipe.requires)) continue;
      const blocker = recipeBlocker(this.game, id);
      const actions: PanelAction[] = [{ label: station === 'forge' ? 'Forge' : 'Cook', disabled: blocker !== null, onClick: () => void craft(this.game, id) }];
      if (station === 'kitchen' && maxCrafts(this.game, id) > 1) {
        actions.push({ label: `All (${maxCrafts(this.game, id)})`, onClick: () => { while (recipeBlocker(this.game, id) === null && craft(this.game, id)); } });
      }
      const output = recipe.output;
      const food = 'count' in output ? itemDef(output.item) : null;
      const buff = food?.buff ? `. ${BUFFS[food.buff.id].name} for ${food.buff.minutes} min: ${BUFFS[food.buff.id].description.toLowerCase()}` : '';
      const note = food?.heal ? `Heals ${food.heal}${buff}` : 'description' in recipe ? recipe.description : undefined;
      rows.push({
        title: recipe.name,
        detail: `${inputsText(this.game, id)}${note ? ` — ${note}` : ''}`,
        meta: blocker ?? `${recipe.level > 1 ? `Lv ${recipe.level}` : ''}`,
        actions,
        dim: blocker !== null && blocker !== 'Already owned',
      });
    }
    return {
      name: station === 'forge' ? 'Oren’s forge' : 'Communal kitchen',
      role: station === 'forge' ? 'Smithing' : 'Cooking',
      rows,
      options: [{ label: 'Done', onClick: () => this.game.panels.close() }],
      footer: `${this.game.progress.money} bells`,
    };
  }

  bank(): PanelSpec {
    const state = this.game.state;
    const rows: PanelRow[] = summarize(state.bank).map(({ item, count }) => ({
      title: `${ITEMS[item].name} ×${count}`,
      actions: [
        { label: 'Take 1', onClick: () => this.withdraw(item, 1) },
        { label: 'Take all', onClick: () => this.withdraw(item, count) },
      ],
    }));
    if (rows.length === 0) rows.push({ title: 'Storage is empty.', dim: true });
    return {
      name: 'Storage',
      role: 'The Counterweight',
      text: 'Anything stored here is safe. Anything in your pack is not, until you bring it home.',
      rows,
      options: [
        { label: 'Store everything in my pack', onClick: () => this.depositAll() },
        { label: 'Done', onClick: () => this.game.panels.close() },
      ],
    };
  }

  /**
   * Freight service: sends everything in your pack up to storage without you riding with it.
   * Quest items stay with you; someone has to hand them over.
   */
  freight(by: string): void {
    const pack = this.game.state.player.pack;
    const sent: string[] = [];
    for (const { item, count } of summarize(pack)) {
      if (ITEMS[item].kind === 'quest') continue;
      const moved = addItem(this.game.state.bank, item, count, BANK_SLOTS);
      removeItem(pack, item, moved);
      if (moved > 0) sent.push(countOf(item, moved));
    }
    if (sent.length === 0) {
      this.game.hud.toast('Nothing in your pack worth sending up.', 'warn');
      return;
    }
    this.game.events.emit('sound', { name: 'lift' });
    this.game.events.emit('freight', { count: sent.length });
    this.game.hud.toast(`Sent up ${by}: ${sent.join(', ')}. It’ll be in storage.`, 'good', 4.5);
    this.game.save();
  }

  private depositAll(): void {
    const pack = this.game.state.player.pack;
    for (const { item, count } of summarize(pack)) {
      const moved = addItem(this.game.state.bank, item, count, BANK_SLOTS);
      removeItem(pack, item, moved);
    }
    this.game.hud.toast('Stored.', 'good');
  }

  private withdraw(item: ItemId, count: number): void {
    const moved = this.game.progress.give(item, count, false);
    removeItem(this.game.state.bank, item, moved);
  }

  goToSleep(): void {
    void sleep(this.game);
  }
}
