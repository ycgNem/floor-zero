import { ITEMS, type ItemId } from '../data/items';
import type { ItemStack } from '../save/world-state';

/** Pure helpers over a list of stacks with a slot limit. */

export function countItem(stacks: readonly ItemStack[], item: ItemId): number {
  let total = 0;
  for (const stack of stacks) if (stack.item === item) total += stack.count;
  return total;
}

/** How many of `item` would fit in the free and partial slots. */
export function spaceFor(stacks: readonly ItemStack[], item: ItemId, slots: number): number {
  const max = ITEMS[item].stack;
  let space = (slots - stacks.length) * max;
  for (const stack of stacks) if (stack.item === item) space += max - stack.count;
  return Math.max(0, space);
}

/** Adds as many as fit. Returns how many were added. Mutates `stacks`. */
export function addItem(stacks: ItemStack[], item: ItemId, count: number, slots: number): number {
  const max = ITEMS[item].stack;
  let left = count;
  for (const stack of stacks) {
    if (left <= 0) break;
    if (stack.item !== item || stack.count >= max) continue;
    const moved = Math.min(left, max - stack.count);
    stack.count += moved;
    left -= moved;
  }
  while (left > 0 && stacks.length < slots) {
    const moved = Math.min(left, max);
    stacks.push({ item, count: moved });
    left -= moved;
  }
  return count - left;
}

/** Removes up to `count`, last stacks first. Returns how many were removed. Mutates `stacks`. */
export function removeItem(stacks: ItemStack[], item: ItemId, count: number): number {
  let left = count;
  for (let i = stacks.length - 1; i >= 0 && left > 0; i--) {
    const stack = stacks[i];
    if (!stack || stack.item !== item) continue;
    const taken = Math.min(left, stack.count);
    stack.count -= taken;
    left -= taken;
    if (stack.count === 0) stacks.splice(i, 1);
  }
  return count - left;
}

/** Totals per item, in first-seen order. */
export function summarize(stacks: readonly ItemStack[]): ItemStack[] {
  const totals = new Map<ItemId, number>();
  for (const stack of stacks) totals.set(stack.item, (totals.get(stack.item) ?? 0) + stack.count);
  return [...totals].map(([item, count]) => ({ item, count }));
}

/** Loses about half of each stack, rounded down: what a rescue costs you. */
export function halveStacks(stacks: ItemStack[]): ItemStack[] {
  const lost: ItemStack[] = [];
  for (const { item, count } of summarize(stacks)) {
    const loss = Math.floor(count / 2);
    if (loss > 0) {
      removeItem(stacks, item, loss);
      lost.push({ item, count: loss });
    }
  }
  return lost;
}
