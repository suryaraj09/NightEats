import { describe, expect, it } from 'vitest';
import { couponErrorText, emptyForm, formFromRow, rowFromForm, summarize, toLocalInput, type CouponForm, type CouponRow } from './coupons';
import type { MenuItem } from '../types';

const form = (patch: Partial<CouponForm>): CouponForm => ({ ...emptyForm, code: 'test10', ...patch });
const ok = (f: CouponForm) => {
  const r = rowFromForm(f);
  if ('error' in r) throw new Error(r.error);
  return r.row;
};
const err = (f: CouponForm) => {
  const r = rowFromForm(f);
  return 'error' in r ? r.error : null;
};

describe('rowFromForm', () => {
  it('upper-cases the code and builds a percent coupon, dropping other types fields', () => {
    const row = ok(form({ type: 'percent', percentOff: '10', maxDiscount: '50', flatOff: '99', bundleQty: '5' }));
    expect(row).toMatchObject({ code: 'TEST10', type: 'percent', percent_off: 10, max_discount: 50, flat_off: null, bundle_qty: null, buy_qty: null });
  });

  it('builds each coupon type', () => {
    expect(ok(form({ type: 'flat', flatOff: '30' })).flat_off).toBe(30);
    expect(ok(form({ type: 'buy_x_get_y', buyQty: '2', freeQty: '1' }))).toMatchObject({ buy_qty: 2, free_qty: 1 });
    expect(ok(form({ type: 'free_item', freeItemId: '7', minOrderValue: '300' }))).toMatchObject({ free_item_id: 7, min_order_value: 300 });
    expect(ok(form({ type: 'bundle', bundleQty: '2', bundlePrice: '140', appliesTo: 'category', category: 'Burger' }))).toMatchObject({
      bundle_qty: 2, bundle_price: 140, applies_to: 'category', category: 'Burger',
    });
  });

  it('keeps scope fields only for the chosen scope', () => {
    expect(ok(form({ type: 'flat', flatOff: '5', appliesTo: 'cart', category: 'Fries', itemIds: [1, 2] }))).toMatchObject({ category: null, item_ids: [] });
    expect(ok(form({ type: 'flat', flatOff: '5', appliesTo: 'items', itemIds: [1, 2] }))).toMatchObject({ category: null, item_ids: [1, 2] });
  });

  it('turns empty limits into null (unlimited) and empty minimums into 0', () => {
    expect(ok(form({ type: 'flat', flatOff: '5' }))).toMatchObject({
      min_qty: 0, min_order_value: 0, max_total_uses: null, max_uses_per_user: null, max_uses_per_phone: null,
      days_of_week: null, start_time: null, end_time: null, starts_at: null, ends_at: null,
    });
  });

  it('sorts weekdays and keeps the time window', () => {
    expect(ok(form({ type: 'flat', flatOff: '5', days: [5, 1], startTime: '22:00', endTime: '02:00' }))).toMatchObject({
      days_of_week: [1, 5], start_time: '22:00', end_time: '02:00',
    });
  });

  it('rejects bad input', () => {
    expect(err(form({ code: 'a b', type: 'flat', flatOff: '5' }))).toMatch(/કોડ/);
    expect(err(form({ type: 'percent', percentOff: '0' }))).toMatch(/ટકાવારી/);
    expect(err(form({ type: 'percent', percentOff: '101' }))).toMatch(/ટકાવારી/);
    expect(err(form({ type: 'percent', percentOff: '10.5' }))).toMatch(/પૂર્ણ/);
    expect(err(form({ type: 'flat', flatOff: '' }))).toMatch(/ફ્લેટ/);
    expect(err(form({ type: 'free_item', freeItemId: '' }))).toMatch(/ફ્રી આઇટમ/);
    expect(err(form({ type: 'bundle', bundleQty: '1', bundlePrice: '100' }))).toMatch(/બંડલ/);
    expect(err(form({ type: 'flat', flatOff: '5', appliesTo: 'items', itemIds: [] }))).toMatch(/આઇટમ/);
    expect(err(form({ type: 'flat', flatOff: '5', startTime: '10:00' }))).toMatch(/સમય/);
    expect(err(form({ type: 'flat', flatOff: '5', startTime: '10:00', endTime: '10:00' }))).toMatch(/અલગ/);
    expect(err(form({ type: 'flat', flatOff: '5', startsAt: '2026-02-01T10:00', endsAt: '2026-01-01T10:00' }))).toMatch(/તારીખ/);
    expect(err(form({ type: 'flat', flatOff: '5', maxTotalUses: '0' }))).toMatch(/મર્યાદા/);
  });
});

const row: CouponRow = {
  id: 1, code: 'BOGO1ST', description: '', type: 'buy_x_get_y', percent_off: null, max_discount: null, flat_off: null,
  buy_qty: 1, free_qty: 1, free_item_id: null, bundle_qty: null, bundle_price: null, applies_to: 'cart', category: null,
  item_ids: [], min_qty: 0, min_order_value: 0, max_total_uses: null, max_uses_per_user: 1, max_uses_per_phone: 1,
  first_order_only: false, starts_at: null, ends_at: null, days_of_week: null, start_time: '22:00:00', end_time: '02:00:00', is_active: true,
};

describe('form <-> row', () => {
  it('round-trips a row through the form', () => {
    const back = ok(formFromRow(row));
    expect(back).toMatchObject({ code: 'BOGO1ST', type: 'buy_x_get_y', buy_qty: 1, free_qty: 1, max_uses_per_user: 1, start_time: '22:00', end_time: '02:00' });
  });

  it('toLocalInput handles null and formats minutes', () => {
    expect(toLocalInput(null)).toBe('');
    expect(toLocalInput(new Date(2026, 0, 5, 9, 7).toISOString())).toBe('2026-01-05T09:07');
  });
});

describe('summarize', () => {
  const items: MenuItem[] = [{ id: 7, name: 'Salted Fries', category: 'Fries', price: 70, cheesePrice: null, description: '', inStock: true }];
  it('describes the offer and its rules', () => {
    expect(summarize(row, items)).toBe('Buy 1 Get 1 free · 1/એકાઉન્ટ · 1/નંબર · 22:00-02:00');
    expect(summarize({ ...row, type: 'free_item', free_item_id: 7, min_order_value: 300, max_uses_per_user: null, max_uses_per_phone: null, start_time: null, end_time: null }, items))
      .toBe('ફ્રી Salted Fries · min ₹300');
  });
});

describe('couponErrorText', () => {
  it('extracts the customer-facing reason from the RPC error', () => {
    expect(couponErrorText('COUPON: આ કોડ માન્ય નથી.')).toBe('આ કોડ માન્ય નથી.');
    expect(couponErrorText('shop closed')).toBeNull();
  });
});
