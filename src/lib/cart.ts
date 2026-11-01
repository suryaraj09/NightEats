import type { Cart } from '../types';

export function cartTotals(cart: Cart) {
  let items = 0;
  let subtotal = 0;
  for (const line of Object.values(cart)) {
    items += line.qty;
    subtotal += line.price * line.qty;
  }
  return { items, subtotal };
}
