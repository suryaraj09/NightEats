import { useState } from 'react';
import type { OrderRow, OrderStatus } from '../types';

interface Props {
  orders: OrderRow[];
  error: string | null;
  setStatus: (id: number, status: OrderStatus) => Promise<void>;
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'નવો',
  confirmed: 'કન્ફર્મ',
  delivered: 'ડિલિવર થયો',
  cancelled: 'રદ',
};

// Allowed next steps per status.
const NEXT: Record<OrderStatus, { to: OrderStatus; label: string; danger?: boolean }[]> = {
  new: [{ to: 'confirmed', label: '✔ કન્ફર્મ કરો' }, { to: 'cancelled', label: '✖ રદ કરો', danger: true }],
  confirmed: [{ to: 'delivered', label: '🛵 ડિલિવર થયો' }, { to: 'cancelled', label: '✖ રદ કરો', danger: true }],
  delivered: [],
  cancelled: [],
};

const FILTERS: (OrderStatus | 'all')[] = ['all', 'new', 'confirmed', 'delivered', 'cancelled'];

export function OrdersTab({ orders, error, setStatus }: Props) {
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const shown = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  return (
    <>
      <div className="order-filters">
        {FILTERS.map((f) => (
          <button key={f} className={`order-filter ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'બધા' : STATUS_LABEL[f]}
            {f !== 'all' && ` (${orders.filter((o) => o.status === f).length})`}
          </button>
        ))}
      </div>

      {error && <div className="pincode-fixed-badge">⚠️ {error}</div>}
      {!error && shown.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>કોઈ ઓર્ડર નથી.</div>
      )}

      {shown.map((o) => (
        <div key={o.id} className={`order-card ${o.status === 'new' ? 'is-new' : ''}`}>
          <div className="order-head">
            <b>#{o.id}</b>
            <span className={`order-status s-${o.status}`}>{STATUS_LABEL[o.status]}</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
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
              કુલ (COD): <span style={{ color: 'var(--gold-primary)' }}>₹{o.total}</span>
              {o.bogo_applied && <span className="order-bogo"> BOGO -₹{o.discount}</span>}
            </span>
          </div>
          {NEXT[o.status].length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {NEXT[o.status].map((n) => (
                <button
                  key={n.to}
                  className={`order-action ${n.danger ? 'danger' : ''}`}
                  onClick={() => {
                    if (n.to !== 'cancelled' || confirm(`ઓર્ડર #${o.id} રદ કરવો છે?`)) void setStatus(o.id, n.to);
                  }}
                >
                  {n.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
