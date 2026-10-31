import type { Cart } from '../types';

export function cartTotals(cart: Cart) {
  let items = 0;
  let subtotal = 0;
  const unitPrices: number[] = [];
  for (const line of Object.values(cart)) {
    items += line.qty;
    subtotal += line.price * line.qty;
    for (let i = 0; i < line.qty; i++) unitPrices.push(line.price);
  }
  return { items, subtotal, unitPrices };
}

/** BOGO1ST: cheapest single unit is free, needs >= 2 units. Display only; the server recomputes. */
export function bogoDiscount(unitPrices: number[], applied: boolean): number {
  if (!applied || unitPrices.length < 2) return 0;
  return Math.min(...unitPrices);
}
