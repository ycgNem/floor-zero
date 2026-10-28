import type { ItemId } from '../data/items';

/** Each unit sold today knocks 2% off the price, down to half. Resets overnight. */
export function sellPrice(value: number, soldToday: number): number {
  return Math.max(1, Math.round(value * Math.max(0.5, 1 - soldToday * 0.02)));
}

/** Total for selling `count` more units after `soldToday` already went. */
export function saleTotal(value: number, soldToday: number, count: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) total += sellPrice(value, soldToday + i);
  return total;
}

export const MARKET_STOCK: readonly { item: ItemId; price: number; count: number }[] = [
  { item: 'trail_bread', price: 8, count: 1 },
  { item: 'rope', price: 12, count: 1 },
  { item: 'planks', price: 6, count: 1 },
  { item: 'bait_grubs', price: 10, count: 10 },
];
