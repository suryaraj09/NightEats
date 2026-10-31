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
  lines: { name: string; unit_price: number; qty: number }[];
}

export type OrderStatus = 'new' | 'confirmed' | 'delivered' | 'cancelled';

export interface OrderRow {
  id: number;
  customer_name: string;
  customer_phone: string;
  address: string;
  pincode: string;
  subtotal: number;
  discount: number;
  total: number;
  bogo_applied: boolean;
  status: OrderStatus;
  created_at: string;
  order_items: { id: number; name: string; unit_price: number; qty: number }[];
}
