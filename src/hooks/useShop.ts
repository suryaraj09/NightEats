import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface ShopState {
  isOpen: boolean;
  note: string;
}

/**
 * Shop open/closed flag, live for every visitor.
 * Fails open: until loaded (or if the table is missing) the shop counts as open,
 * and place_order() enforces the real rule server-side anyway.
 */
export function useShop() {
  const [shop, setShop] = useState<ShopState>({ isOpen: true, note: '' });

  const load = useCallback(async () => {
    const { data } = await supabase.from('shop_settings').select('is_open,note').maybeSingle();
    if (data) setShop({ isOpen: data.is_open as boolean, note: ((data.note as string | null) ?? '').trim() });
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('shop-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_settings' }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return { ...shop, reload: load };
}
