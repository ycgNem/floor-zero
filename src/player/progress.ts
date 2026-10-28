import { BUFFS, type BuffDef, type BuffId } from '../data/buffs';
import { SKILL_NAMES, type SkillId } from '../data/ids';
import { ITEMS, type ItemId } from '../data/items';
import type { Game } from '../game';
import { addItem, countItem, removeItem, spaceFor } from '../items/inventory';
import { BIG_PACK_SLOTS, PACK_SLOTS } from '../save/world-state';
import { levelForXp } from '../skills/xp';

/** Health by license rank. Rank-ups are the big jumps. */
const RANK_HEALTH = [100, 100, 150, 200, 260, 330];
const ARMOUR_HEALTH: Partial<Record<ItemId, number>> = { leather_vest: 15, iron_mail: 30 };

/** Skills, pack, money, and health: everything the player earns, with events. */
export class Progress {
  constructor(private readonly game: Game) {}

  private get player() {
    return this.game.state.player;
  }

  level(skill: SkillId): number {
    return levelForXp(this.player.skills[skill]);
  }

  addXp(skill: SkillId, amount: number): void {
    const before = this.level(skill);
    this.player.skills[skill] += amount;
    this.game.events.emit('xpGained', { skill, amount });
    const after = this.level(skill);
    if (after > before) this.game.events.emit('levelUp', { skill, level: after });
  }

  count(item: ItemId): number {
    return countItem(this.player.pack, item);
  }

  /** Pack capacity: Oren's delver's pack adds a few slots. */
  packSlots(): number {
    return PACK_SLOTS + (this.player.equipment.pack ? BIG_PACK_SLOTS : 0);
  }

  /** Dash charges: Tavi's lucky knot adds one. */
  dashCharges(): number {
    return 2 + (this.player.equipment.charm === 'lucky_knot' ? 1 : 0);
  }

  hasSpace(item: ItemId, count = 1): boolean {
    return spaceFor(this.player.pack, item, this.packSlots()) >= count;
  }

  /** Adds to the pack. Returns how many fit; warns if some didn't. */
  give(item: ItemId, count = 1, quiet = false): number {
    const added = addItem(this.player.pack, item, count, this.packSlots());
    if (added > 0) this.game.events.emit('itemAdded', { item, count: added });
    if (added < count) {
      this.game.events.emit('packFull', { item });
      if (!quiet) this.game.hud.toast('Your pack is full.', 'warn');
    }
    return added;
  }

  take(item: ItemId, count = 1): number {
    const removed = removeItem(this.player.pack, item, count);
    if (removed > 0) this.game.events.emit('itemRemoved', { item, count: removed });
    return removed;
  }

  get money(): number {
    return this.player.money;
  }

  addMoney(delta: number): void {
    this.player.money = Math.max(0, this.player.money + delta);
    this.game.events.emit('moneyChanged', { money: this.player.money, delta });
  }

  maxHealth(): number {
    const base = RANK_HEALTH[this.player.licenseRank] ?? 100;
    const armour = this.player.equipment.armour;
    return base + (armour ? ARMOUR_HEALTH[armour] ?? 0 : 0) + this.buffTotal('maxHealth');
  }

  // ---- Meal buffs ----

  /** Starts a buff, or refreshes it if it's already running. */
  addBuff(id: BuffId, minutes: number): void {
    const until = this.game.state.playTime + minutes * 60;
    const existing = this.player.buffs.find((b) => b.id === id);
    if (existing) existing.until = Math.max(existing.until, until);
    else this.player.buffs.push({ id, until });
    this.game.hud.toast(`${BUFFS[id].name}: ${BUFFS[id].description.toLowerCase()} for ${minutes} minutes.`, 'good');
  }

  /** Running buffs with seconds left. */
  activeBuffs(): { id: BuffId; remaining: number }[] {
    const now = this.game.state.playTime;
    return this.player.buffs.filter((b) => b.until > now).map((b) => ({ id: b.id, remaining: b.until - now }));
  }

  /** Drops buffs that ran out, and trims health that a Hearty buff was holding up. */
  tickBuffs(): void {
    const now = this.game.state.playTime;
    if (!this.player.buffs.some((b) => b.until <= now)) return;
    this.player.buffs = this.player.buffs.filter((b) => b.until > now);
    this.player.health = Math.min(this.player.health, this.maxHealth());
  }

  /** Sums an additive buff stat across running buffs. */
  buffTotal(stat: 'maxHealth'): number {
    return this.activeBuffs().reduce((sum, b) => sum + ((BUFFS[b.id] as BuffDef)[stat] ?? 0), 0);
  }

  /** Multiplies a scaling buff stat across running buffs. 1 means no change. */
  buffScale(stat: 'dashRecharge' | 'gatherSpeed' | 'damageTaken'): number {
    return this.activeBuffs().reduce((scale, b) => scale * ((BUFFS[b.id] as BuffDef)[stat] ?? 1), 1);
  }

  heal(amount: number): void {
    const before = this.player.health;
    this.player.health = Math.min(this.maxHealth(), this.player.health + amount);
    if (this.player.health > before) this.game.events.emit('playerHealed', { amount: this.player.health - before });
  }

  describeLevelUp(skill: SkillId, level: number): string {
    return `${SKILL_NAMES[skill]} level ${level}`;
  }

  itemName(item: ItemId): string {
    return ITEMS[item].name;
  }
}
