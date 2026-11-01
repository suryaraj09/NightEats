import type { Tables } from './lib/database.types';

export type Category = 'Burger' | 'Sandwich' | 'Tikka Pav' | 'Fries';
export type Variant = 'reg' | 'cheese';

export interface MenuItem {
  id: number;
  name: string;
  category: Category;
  price: number;
  cheesePrice: number | null;
  description: string;
  inStock: boolean;
}

export interface CartLine {
  key: string; // `${itemId}_${variant}`
  itemId: number;
  variant: Variant;
  name: string;
  price: number;
  qty: number;
}

export type Cart = Record<string, CartLine>;

export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
}

export interface PlacedOrder {
  order_id: number;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  discount: number;
  total: number;
  coupon_code: string | null;
  lines: { name: string; unit_price: number; qty: number }[];
}

export type OrderStatus = 'new' | 'confirmed' | 'delivered' | 'cancelled';

/** An order with its lines, as selected by `orders` + `order_items(...)`. status is narrowed to the DB check constraint. */
export type OrderRow = Omit<Tables<'orders'>, 'status'> & {
  status: OrderStatus;
  order_items: Pick<Tables<'order_items'>, 'id' | 'name' | 'unit_price' | 'qty'>[];
};
