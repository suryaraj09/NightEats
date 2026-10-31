import { OWNER_PHONE } from './supabase';
import type { PlacedOrder } from '../types';

export function buildWhatsAppUrl(order: PlacedOrder, address: string): string {
  const items = order.lines.map((l) => `• ${l.name} x ${l.qty} = ₹${l.unit_price * l.qty}\n`).join('');
  const msg =
    `*નવો ઓર્ડર - NIGHT EATS (વાસણા)*\n` +
    `------------------------------------\n` +
    `*ગ્રાહક:* ${order.customer_name}\n` +
    `*મોબાઈલ:* ${order.customer_phone}\n` +
    `*સરનામું:* ${address}, વાસણા (380007)\n` +
    `------------------------------------\n` +
    `*ઓર્ડર આઇટમ્સ:*\n${items}` +
    `------------------------------------\n` +
    `સબટોટલ: ₹${order.subtotal}\n` +
    (order.discount > 0 ? `BOGO ડિસ્કાઉન્ટ: -₹${order.discount}\n` : '') +
    `*કુલ રકમ (COD): ₹${order.total}*\n` +
    `ઓર્ડર નંબર: #${order.order_id}\n` +
    `પેમેન્ટ: Cash on Delivery / UPI on Delivery\n` +
    `------------------------------------\n` +
    `કૃપા કરીને મારો ઓર્ડર કન્ફર્મ કરો!`;
  return `https://wa.me/${OWNER_PHONE}?text=${encodeURIComponent(msg)}`;
}
