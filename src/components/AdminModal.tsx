import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { CouponsTab } from './CouponsTab';
import { MenuTab } from './MenuTab';
import { OrdersTab } from './OrdersTab';
import { useOrders } from '../hooks/useOrders';
import { useLang } from '../i18n/LanguageProvider';
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
  const { t } = useLang();
  const [tab, setTab] = useState<'menu' | 'orders' | 'coupons'>('orders');
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
    <Modal open={open} title={t('admin.title')} onClose={onClose} sheetStyle={{ maxHeight: '95vh' }}>
      <div className={`shop-switch ${shop.isOpen ? 'open' : 'closed'}`}>
        <div>
          <b>{shop.isOpen ? t('admin.shopOpen') : t('admin.shopClosed')}</b>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {shop.isOpen ? t('admin.openHint') : t('admin.closedHint')}
          </div>
        </div>
        <button
          className="btn-add-item"
          onClick={() => {
            if (shop.isOpen && !confirm(t('admin.closeConfirm'))) return;
            void saveShop({ is_open: !shop.isOpen });
          }}
        >
          {shop.isOpen ? t('admin.close') : t('admin.open')}
        </button>
      </div>
      <div className="input-group">
        <label>{t('admin.noteLabel')}</label>
        <input
          type="text"
          value={note}
          maxLength={140}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note.trim() !== shop.note && void saveShop({ note: note.trim() })}
          placeholder={t('admin.notePlaceholder')}
        />
      </div>

      <div className="admin-tabs">
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
          {t('admin.tabOrders')} {newCount > 0 && <span className="tab-badge">{newCount}</span>}
        </button>
        <button className={tab === 'menu' ? 'active' : ''} onClick={() => setTab('menu')}>{t('admin.tabMenu')}</button>
        <button className={tab === 'coupons' ? 'active' : ''} onClick={() => setTab('coupons')}>{t('admin.tabCoupons')}</button>
      </div>

      {tab === 'orders' && <OrdersTab orders={orders} error={error} setStatus={setStatus} />}
      {tab === 'menu' && <MenuTab items={items} reload={reload} />}
      {tab === 'coupons' && <CouponsTab items={items} active={open} />}
    </Modal>
  );
}
