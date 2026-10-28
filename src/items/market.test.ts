import { describe, expect, it } from 'vitest';
import { saleTotal, sellPrice } from './market';

describe('market saturation', () => {
  it('drops 2% per unit sold today, never below half', () => {
    expect(sellPrice(100, 0)).toBe(100);
    expect(sellPrice(100, 10)).toBe(80);
    expect(sellPrice(100, 40)).toBe(50);
    expect(sellPrice(100, 400)).toBe(50);
  });

  it('never pays less than one bell', () => {
    expect(sellPrice(1, 100)).toBe(1);
  });

  it('totals a batch unit by unit', () => {
    expect(saleTotal(10, 0, 3)).toBe(10 + 10 + 10);
    expect(saleTotal(100, 0, 3)).toBe(100 + 98 + 96);
  });
});
