import { describe, expect, it } from 'vitest';
import type { Cart, CartLine } from '../types';
import { cartTotals } from './cart';

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
    expect(cartTotals({})).toEqual({ items: 0, subtotal: 0 });
  });

  it('sums quantity and price', () => {
    const t = cartTotals(cartOf(line(1, 80, 2), line(2, 140, 1)));
    expect(t.items).toBe(3);
    expect(t.subtotal).toBe(300);
  });
});
