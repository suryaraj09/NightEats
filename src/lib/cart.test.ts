import { describe, expect, it } from 'vitest';
import type { Cart, CartLine } from '../types';
import { bogoDiscount, cartTotals } from './cart';

const line = (itemId: number, price: number, qty: number): CartLine => ({
  key: `${itemId}_reg`,
  itemId,
  variant: 'reg',
  name: `Item ${itemId}`,
  price,
  qty,
});
const cartOf = (...lines: CartLine[]): Cart => Object.fromEntries(lines.map((l) => [l.key, l]));

describe('cartTotals', () => {
  it('is empty for an empty cart', () => {
    expect(cartTotals({})).toEqual({ items: 0, subtotal: 0, unitPrices: [] });
  });

  it('sums quantity and price and expands one price per unit', () => {
    const t = cartTotals(cartOf(line(1, 80, 2), line(2, 140, 1)));
    expect(t.items).toBe(3);
    expect(t.subtotal).toBe(300);
    expect([...t.unitPrices].sort((a, b) => a - b)).toEqual([80, 80, 140]);
  });
});

describe('bogoDiscount', () => {
  it('is 0 when the coupon is not applied', () => {
    expect(bogoDiscount([80, 100], false)).toBe(0);
  });

  it('is 0 with fewer than 2 units', () => {
    expect(bogoDiscount([80], true)).toBe(0);
    expect(bogoDiscount([], true)).toBe(0);
  });

  it('makes the cheapest single unit free', () => {
    expect(bogoDiscount([120, 80, 100], true)).toBe(80);
  });

  it('works for two units of the same item', () => {
    expect(bogoDiscount([80, 80], true)).toBe(80);
  });
});
