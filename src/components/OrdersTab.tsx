import { useState } from 'react';
import { useLang } from '../i18n/LanguageProvider';
import type { Key } from '../i18n/translate';
import type { OrderRow, OrderStatus } from '../types';

interface Props {
  orders: OrderRow[];
  error: string | null;
  setStatus: (id: number, status: OrderStatus) => Promise<void>;
}

export const STATUS_KEY: Record<OrderStatus, Key> = {
  new: 'status.new',
  confirmed: 'status.confirmed',
  delivered: 'status.delivered',
  cancelled: 'status.cancelled',
};

// Allowed next steps per status.
const NEXT: Record<OrderStatus, { to: OrderStatus; label: Key; danger?: boolean }[]> = {
  new: [{ to: 'confirmed', label: 'orders.actionConfirm' }, { to: 'cancelled', label: 'orders.actionCancel', danger: true }],
  confirmed: [{ to: 'delivered', label: 'orders.actionDeliver' }, { to: 'cancelled', label: 'orders.actionCancel', danger: true }],
  delivered: [],
  cancelled: [],
};

const FILTERS: (OrderStatus | 'all')[] = ['all', 'new', 'confirmed', 'delivered', 'cancelled'];

export function OrdersTab({ orders, error, setStatus }: Props) {
  const { t, locale } = useLang();
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const shown = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  return (
    <>
      <div className="order-filters">
        {FILTERS.map((f) => (
          <button key={f} className={`order-filter ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? t('orders.filterAll') : t(STATUS_KEY[f])}
            {f !== 'all' && ` (${orders.filter((o) => o.status === f).length})`}
          </button>
        ))}
      </div>

      {error && <div className="pincode-fixed-badge">⚠️ {error}</div>}
      {!error && shown.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('orders.none')}</div>
      )}

      {shown.map((o) => (
        <div key={o.id} className={`order-card ${o.status === 'new' ? 'is-new' : ''}`}>
          <div className="order-head">
            <b>#{o.id}</b>
            <span className={`order-status s-${o.status}`}>{t(STATUS_KEY[o.status])}</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {new Date(o.created_at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
          <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
            <b>{o.customer_name}</b> ·{' '}
            <a href={`tel:+91${o.customer_phone}`} style={{ color: 'var(--gold-primary)' }}>📞 {o.customer_phone}</a>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{o.address}, {o.pincode}</div>
          <ul className="order-lines">
            {o.order_items.map((i) => (
              <li key={i.id}>{i.name} × {i.qty} = ₹{i.unit_price * i.qty}</li>
            ))}
          </ul>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>
              {t('orders.totalCod')} <span style={{ color: 'var(--gold-primary)' }}>₹{o.total}</span>
              {o.coupon_code && <span className="order-bogo"> {o.coupon_code}{o.discount > 0 ? ` -₹${o.discount}` : ''}</span>}
            </span>
          </div>
          {NEXT[o.status].length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {NEXT[o.status].map((n) => (
                <button
                  key={n.to}
                  className={`order-action ${n.danger ? 'danger' : ''}`}
                  onClick={() => {
                    if (n.to !== 'cancelled' || confirm(t('orders.cancelConfirm', { id: o.id }))) void setStatus(o.id, n.to);
                  }}
                >
                  {t(n.label)}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
