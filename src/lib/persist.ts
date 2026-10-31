import type { Cart } from '../types';

const CART_KEY = 'nighteats.cart';
const INTENT_KEY = 'nighteats.intent';

/** Where the user was heading when the Google redirect reloaded the page. */
export type Intent = 'auth' | 'adminAuth';

// Storage can throw (private mode, blocked site data), so every access is guarded.
function read(store: 'local' | 'session', key: string): string | null {
  try {
    return (store === 'local' ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function write(store: 'local' | 'session', key: string, value: string | null) {
  try {
    const s = store === 'local' ? localStorage : sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function loadCart(): Cart {
  const raw = read('local', CART_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const cart: Cart = {};
    for (const [key, l] of Object.entries(parsed as Record<string, any>)) {
      const ok =
        l && l.key === key && Number.isInteger(l.itemId) && (l.variant === 'reg' || l.variant === 'cheese') &&
        typeof l.name === 'string' && Number.isFinite(l.price) && Number.isInteger(l.qty) && l.qty > 0;
      if (ok) cart[key] = { key, itemId: l.itemId, variant: l.variant, name: l.name, price: l.price, qty: l.qty };
    }
    return cart;
  } catch {
    return {};
  }
}

export function saveCart(cart: Cart) {
  write('local', CART_KEY, Object.keys(cart).length ? JSON.stringify(cart) : null);
}

export function loadIntent(): Intent | null {
  const v = read('session', INTENT_KEY);
  return v === 'auth' || v === 'adminAuth' ? v : null;
}

export function saveIntent(intent: Intent | null) {
  write('session', INTENT_KEY, intent);
}
