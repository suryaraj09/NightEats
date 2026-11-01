import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CouponRow } from '../lib/coupons';

/** Admin only: all coupons plus how many times each was used (cancelled orders excluded). RLS blocks everyone else. */
export function useCoupons(enabled: boolean) {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [usage, setUsage] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [c, u] = await Promise.all([
      supabase.from('coupons').select('*').order('id'),
      supabase.from('coupon_usage').select('coupon_id,uses'),
    ]);
    const err = c.error ?? u.error;
    if (err) return setError(err.message);
    setError(null);
    setCoupons(c.data as CouponRow[]);
    setUsage(Object.fromEntries((u.data as { coupon_id: number; uses: number }[]).map((r) => [r.coupon_id, r.uses])));
  }, []);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  return { coupons, usage, error, reload: load };
}
