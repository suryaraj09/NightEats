import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { OrderRow } from '../types';

/** The signed-in customer's own orders, live. RLS already limits reads to their own rows. */
export function useMyOrders(userId: string | undefined, enabled: boolean) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('orders')
      .select('*, order_items(id,name,unit_price,qty)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (err) setError(err.message);
    else {
      setError(null);
      setOrders(data as OrderRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled || !userId) return;
    setLoading(true);
    void load();
    const channel = supabase
      .channel(`my-orders-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, userId, load]);

  return { orders, loading, error };
}
