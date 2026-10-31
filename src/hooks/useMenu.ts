import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Category, MenuItem } from '../types';

interface Row {
  id: number;
  name: string;
  category: Category;
  price: number;
  cheese_price: number | null;
  description: string;
  in_stock: boolean;
}

const fromRow = (r: Row): MenuItem => ({
  id: r.id,
  name: r.name,
  category: r.category,
  price: r.price,
  cheesePrice: r.cheese_price,
  description: r.description,
  inStock: r.in_stock,
});

export function useMenu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('menu_items')
      .select('*')
      .order('sort_order')
      .order('id');
    if (err) setError(err.message);
    else {
      setError(null);
      setItems((data as Row[]).map(fromRow));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    // Live updates for every customer when the owner edits the menu.
    const channel = supabase
      .channel('menu-items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return { items, loading, error, reload: load };
}
