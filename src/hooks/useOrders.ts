import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { OrderRow } from '../types';

/** Short two-tone beep via WebAudio (no audio file). Browsers only allow it after a user gesture. */
function beep(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    void ctx.resume();
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.18;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  } catch {
    /* ignore */
  }
}

/** Admin orders feed. Only active while `enabled` (admin portal open). Beeps on every new order. */
export function useOrders(enabled: boolean) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<AudioContext | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('orders')
      .select('*, order_items(id,name,unit_price,qty)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (err) setError(err.message);
    else {
      setError(null);
      setOrders(data as OrderRow[]);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    try {
      audio.current = audio.current ?? new AudioContext();
    } catch {
      audio.current = null;
    }
    void load();
    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        beep(audio.current);
        void load();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, load]);

  const setStatus = async (id: number, status: OrderRow['status']) => {
    const { error: err } = await supabase.from('orders').update({ status }).eq('id', id);
    if (err) alert(err.message);
    else await load();
  };

  return { orders, error, setStatus, newCount: orders.filter((o) => o.status === 'new').length };
}
