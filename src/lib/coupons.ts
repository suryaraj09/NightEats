import type { Tables } from './database.types';
import type { Category, MenuItem } from '../types';

export type CouponType = 'percent' | 'flat' | 'buy_x_get_y' | 'free_item' | 'bundle';
export type AppliesTo = 'cart' | 'category' | 'items';

/** A row of public.coupons (admin only; customers never see this table). Unions are the DB check constraints. */
export type CouponRow = Omit<Tables<'coupons'>, 'type' | 'applies_to' | 'category'> & {
  type: CouponType;
  applies_to: AppliesTo;
  category: Category | null;
};

/** Result of the validate_coupon() RPC. */
export interface CouponCheck {
  valid: boolean;
  reason: string | null;
  discount: number;
  free_item_name: string | null;
  coupon_code: string | null;
  coupon_desc: string | null;
}

/** The admin form keeps everything as strings so inputs stay editable. */
export interface CouponForm {
  code: string;
  description: string;
  type: CouponType;
  percentOff: string;
  maxDiscount: string;
  flatOff: string;
  buyQty: string;
  freeQty: string;
  freeItemId: string;
  bundleQty: string;
  bundlePrice: string;
  appliesTo: AppliesTo;
  category: Category;
  itemIds: number[];
  minQty: string;
  minOrderValue: string;
  maxTotalUses: string;
  maxUsesPerUser: string;
  maxUsesPerPhone: string;
  firstOrderOnly: boolean;
  startsAt: string; // datetime-local, browser time
  endsAt: string;
  days: number[]; // 0 = Sunday; empty = every day
  startTime: string; // HH:MM, Asia/Kolkata
  endTime: string;
  isActive: boolean;
}

export const TYPE_LABEL: Record<CouponType, string> = {
  percent: 'ટકાવારી ડિસ્કાઉન્ટ (% off)',
  flat: 'ફ્લેટ ₹ ડિસ્કાઉન્ટ',
  buy_x_get_y: 'Buy X Get Y ફ્રી',
  free_item: 'ફ્રી આઇટમ (ઓર્ડર ₹X થી વધુ)',
  bundle: 'બંડલ ભાવ (દા.ત. 2 બર્ગર ₹140)',
};

export const DAY_LABEL = ['રવિ', 'સોમ', 'મંગળ', 'બુધ', 'ગુરુ', 'શુક્ર', 'શનિ'];

export const emptyForm: CouponForm = {
  code: '', description: '', type: 'percent',
  percentOff: '', maxDiscount: '', flatOff: '', buyQty: '1', freeQty: '1', freeItemId: '', bundleQty: '2', bundlePrice: '',
  appliesTo: 'cart', category: 'Burger', itemIds: [],
  minQty: '', minOrderValue: '', maxTotalUses: '', maxUsesPerUser: '', maxUsesPerPhone: '',
  firstOrderOnly: false, startsAt: '', endsAt: '', days: [], startTime: '', endTime: '', isActive: true,
};

const str = (n: number | null) => (n === null ? '' : String(n));

/** ISO timestamp -> value for <input type="datetime-local"> in the browser's time zone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formFromRow(r: CouponRow): CouponForm {
  return {
    code: r.code, description: r.description, type: r.type,
    percentOff: str(r.percent_off), maxDiscount: str(r.max_discount), flatOff: str(r.flat_off),
    buyQty: str(r.buy_qty), freeQty: str(r.free_qty), freeItemId: str(r.free_item_id),
    bundleQty: str(r.bundle_qty), bundlePrice: str(r.bundle_price),
    appliesTo: r.applies_to, category: r.category ?? 'Burger', itemIds: r.item_ids ?? [],
    minQty: r.min_qty ? String(r.min_qty) : '', minOrderValue: r.min_order_value ? String(r.min_order_value) : '',
    maxTotalUses: str(r.max_total_uses), maxUsesPerUser: str(r.max_uses_per_user), maxUsesPerPhone: str(r.max_uses_per_phone),
    firstOrderOnly: r.first_order_only, startsAt: toLocalInput(r.starts_at), endsAt: toLocalInput(r.ends_at),
    days: r.days_of_week ?? [], startTime: r.start_time?.slice(0, 5) ?? '', endTime: r.end_time?.slice(0, 5) ?? '',
    isActive: r.is_active,
  };
}

type Num = number | null | 'bad';
const num = (v: string): Num => {
  const t = v.trim();
  if (t === '') return null;
  return /^\d+$/.test(t) ? parseInt(t, 10) : 'bad';
};

export type CouponPayload = Omit<CouponRow, 'id' | 'created_at'>;

/** Validate the form and build the row to save, or return a Gujarati error message. */
export function rowFromForm(f: CouponForm): { row: CouponPayload } | { error: string } {
  const code = f.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) return { error: 'કોડ 3-20 અક્ષરનો હોવો જોઈએ (A-Z, 0-9, _ અથવા -).' };

  const percent = num(f.percentOff), maxDisc = num(f.maxDiscount), flat = num(f.flatOff);
  const buy = num(f.buyQty), free = num(f.freeQty), bundleQty = num(f.bundleQty), bundlePrice = num(f.bundlePrice);
  const minQty = num(f.minQty), minValue = num(f.minOrderValue);
  const maxTotal = num(f.maxTotalUses), maxUser = num(f.maxUsesPerUser), maxPhone = num(f.maxUsesPerPhone);
  const all = [percent, maxDisc, flat, buy, free, bundleQty, bundlePrice, minQty, minValue, maxTotal, maxUser, maxPhone];
  if (all.includes('bad')) return { error: 'બધા આંકડા ૦ કે તેથી વધુના પૂર્ણ સંખ્યા હોવા જોઈએ.' };
  const n = (v: Num) => (v === 'bad' ? null : v);

  if (f.type === 'percent' && !(n(percent) !== null && n(percent)! >= 1 && n(percent)! <= 100)) return { error: 'ટકાવારી 1 થી 100 વચ્ચે હોવી જોઈએ.' };
  if (f.type === 'flat' && !(n(flat) !== null && n(flat)! >= 1)) return { error: 'ફ્લેટ ડિસ્કાઉન્ટ ₹1 કે તેથી વધુ હોવું જોઈએ.' };
  if (f.type === 'buy_x_get_y' && !(n(buy) !== null && n(buy)! >= 1 && n(free) !== null && n(free)! >= 1)) return { error: 'Buy અને Free બંને સંખ્યા 1 કે તેથી વધુ હોવી જોઈએ.' };
  if (f.type === 'free_item' && !f.freeItemId) return { error: 'ફ્રી આઇટમ પસંદ કરો.' };
  if (f.type === 'bundle' && !(n(bundleQty) !== null && n(bundleQty)! >= 2 && n(bundlePrice) !== null)) return { error: 'બંડલમાં ઓછામાં ઓછી 2 આઇટમ અને બંડલ ભાવ જોઈએ.' };
  if (f.appliesTo === 'items' && f.itemIds.length === 0) return { error: 'ઓછામાં ઓછી એક આઇટમ પસંદ કરો.' };
  if (!f.startTime !== !f.endTime) return { error: 'સમય મર્યાદા માટે શરૂ અને પૂરો બંને સમય ભરો.' };
  if (f.startTime && f.startTime === f.endTime) return { error: 'શરૂ અને પૂરો સમય અલગ હોવા જોઈએ.' };
  if (f.startsAt && f.endsAt && new Date(f.startsAt) >= new Date(f.endsAt)) return { error: 'શરૂઆતની તારીખ પૂરી થવાની તારીખ પહેલાં હોવી જોઈએ.' };
  for (const [v, label] of [[maxTotal, 'કુલ વપરાશ'], [maxUser, 'દરેક એકાઉન્ટ'], [maxPhone, 'દરેક નંબર']] as const) {
    if (v === 0) return { error: `${label} મર્યાદા 1 કે તેથી વધુ હોવી જોઈએ (ખાલી = અમર્યાદિત).` };
  }

  const isPercent = f.type === 'percent', isFlat = f.type === 'flat', isBogo = f.type === 'buy_x_get_y';
  const isFree = f.type === 'free_item', isBundle = f.type === 'bundle';
  return {
    row: {
      code,
      description: f.description.trim(),
      type: f.type,
      percent_off: isPercent ? n(percent) : null,
      max_discount: isPercent ? n(maxDisc) : null,
      flat_off: isFlat ? n(flat) : null,
      buy_qty: isBogo ? n(buy) : null,
      free_qty: isBogo ? n(free) : null,
      free_item_id: isFree ? Number(f.freeItemId) : null,
      bundle_qty: isBundle ? n(bundleQty) : null,
      bundle_price: isBundle ? n(bundlePrice) : null,
      applies_to: f.appliesTo,
      category: f.appliesTo === 'category' ? f.category : null,
      item_ids: f.appliesTo === 'items' ? f.itemIds : [],
      min_qty: n(minQty) ?? 0,
      min_order_value: n(minValue) ?? 0,
      max_total_uses: n(maxTotal),
      max_uses_per_user: n(maxUser),
      max_uses_per_phone: n(maxPhone),
      first_order_only: f.firstOrderOnly,
      starts_at: f.startsAt ? new Date(f.startsAt).toISOString() : null,
      ends_at: f.endsAt ? new Date(f.endsAt).toISOString() : null,
      days_of_week: f.days.length ? [...f.days].sort() : null,
      start_time: f.startTime || null,
      end_time: f.endTime || null,
      is_active: f.isActive,
    },
  };
}

/** One-line summary for the admin list. */
export function summarize(r: CouponRow, items: MenuItem[]): string {
  const name = (id: number | null) => items.find((i) => i.id === id)?.name ?? '(કાઢી નાખેલી આઇટમ)';
  let what = '';
  switch (r.type) {
    case 'percent': what = `${r.percent_off}% off${r.max_discount !== null ? ` (મહત્તમ ₹${r.max_discount})` : ''}`; break;
    case 'flat': what = `₹${r.flat_off} off`; break;
    case 'buy_x_get_y': what = `Buy ${r.buy_qty} Get ${r.free_qty} free`; break;
    case 'free_item': what = `ફ્રી ${name(r.free_item_id)}`; break;
    case 'bundle': what = `${r.bundle_qty} આઇટમ ₹${r.bundle_price}`; break;
  }
  const scope = r.applies_to === 'category' ? ` · ${r.category}` : r.applies_to === 'items' ? ` · ${r.item_ids.length} આઇટમ` : '';
  const rules = [
    r.min_qty > 0 && `min ${r.min_qty} આઇટમ`,
    r.min_order_value > 0 && `min ₹${r.min_order_value}`,
    r.first_order_only && 'પહેલો ઓર્ડર',
    r.max_uses_per_user !== null && `${r.max_uses_per_user}/એકાઉન્ટ`,
    r.max_uses_per_phone !== null && `${r.max_uses_per_phone}/નંબર`,
    r.days_of_week && r.days_of_week.length > 0 && r.days_of_week.map((d) => DAY_LABEL[d]).join(','),
    r.start_time && r.end_time && `${r.start_time.slice(0, 5)}-${r.end_time.slice(0, 5)}`,
  ].filter(Boolean);
  return what + scope + (rules.length ? ` · ${rules.join(' · ')}` : '');
}

/** The RPC raises 'COUPON: <reason>'; show just the reason. */
export function couponErrorText(message: string): string | null {
  return message.startsWith('COUPON: ') ? message.slice('COUPON: '.length) : null;
}
