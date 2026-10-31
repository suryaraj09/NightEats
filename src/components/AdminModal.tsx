import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { MenuTab } from './MenuTab';
import { OrdersTab } from './OrdersTab';
import { useOrders } from '../hooks/useOrders';
import { supabase } from '../lib/supabase';
import type { MenuItem } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  items: MenuItem[];
  reload: () => Promise<void>;
  shop: { isOpen: boolean; note: string };
}

export function AdminModal({ open, onClose, items, reload, shop }: Props) {
  const [tab, setTab] = useState<'menu' | 'orders'>('orders');
  const { orders, error, setStatus, newCount } = useOrders(open);
  const [note, setNote] = useState(shop.note);
  useEffect(() => setNote(shop.note), [shop.note]);

  const saveShop = async (patch: { is_open?: boolean; note?: string }) => {
    const { error: err } = await supabase
      .from('shop_settings')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', true);
    if (err) alert(err.message);
  };

  return (
    <Modal open={open} title="લાઇવ ક્લાઉડ મેનેજમેન્ટ (Night Eats)" onClose={onClose} sheetStyle={{ maxHeight: '95vh' }}>
      <div className={`shop-switch ${shop.isOpen ? 'open' : 'closed'}`}>
        <div>
          <b>{shop.isOpen ? '🟢 શોપ ખુલ્લી છે' : '🔴 શોપ બંધ છે'}</b>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {shop.isOpen ? 'ગ્રાહકો ઓર્ડર આપી શકે છે.' : 'ગ્રાહકો મેનૂ જોઈ શકે છે, ઓર્ડર નહીં.'}
          </div>
        </div>
        <button
          className="btn-add-item"
          onClick={() => {
            if (shop.isOpen && !confirm('શોપ બંધ કરવી છે? ગ્રાહકો ઓર્ડર આપી શકશે નહીં.')) return;
            void saveShop({ is_open: !shop.isOpen });
          }}
        >
          {shop.isOpen ? 'બંધ કરો' : 'ખોલો'}
        </button>
      </div>
      <div className="input-group">
        <label>બંધ હોય ત્યારે ગ્રાહકોને સંદેશ (વૈકલ્પિક)</label>
        <input
          type="text"
          value={note}
          maxLength={140}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note.trim() !== shop.note && void saveShop({ note: note.trim() })}
          placeholder="દા.ત. સાંજે 7 વાગ્યે ખુલશે"
        />
      </div>

      <div className="admin-tabs">
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
          ઓર્ડર્સ {newCount > 0 && <span className="tab-badge">{newCount}</span>}
        </button>
        <button className={tab === 'menu' ? 'active' : ''} onClick={() => setTab('menu')}>મેનૂ</button>
      </div>

      {tab === 'orders' ? (
        <OrdersTab orders={orders} error={error} setStatus={setStatus} />
      ) : (
        <MenuTab items={items} reload={reload} />
      )}
    </Modal>
  );
}
