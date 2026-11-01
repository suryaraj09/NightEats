import { Modal } from './Modal';
import { STATUS_LABEL } from './OrdersTab';
import { useAuth } from '../hooks/useAuth';
import { useMyOrders } from '../hooks/useMyOrders';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function MyOrdersModal({ open, onClose }: Props) {
  const { session } = useAuth();
  const { orders, loading, error } = useMyOrders(session?.user.id, open);

  return (
    <Modal open={open} title="મારા ઓર્ડર (My Orders)" onClose={onClose} sheetStyle={{ maxHeight: '90vh' }}>
      {error && <div className="pincode-fixed-badge">⚠️ {error}</div>}
      {loading && orders.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>લોડ થઈ રહ્યું છે...</div>
      )}
      {!loading && !error && orders.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          તમે હજી સુધી કોઈ ઓર્ડર આપ્યો નથી.
        </div>
      )}

      {orders.map((o) => (
        <div key={o.id} className="order-card">
          <div className="order-head">
            <b>#{o.id}</b>
            <span className={`order-status s-${o.status}`}>{STATUS_LABEL[o.status]}</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
          <ul className="order-lines">
            {o.order_items.map((i) => (
              <li key={i.id}>{i.name} × {i.qty} = ₹{i.unit_price * i.qty}</li>
            ))}
          </ul>
          <div style={{ fontWeight: 700 }}>
            કુલ (COD): <span style={{ color: 'var(--gold-primary)' }}>₹{o.total}</span>
            {o.coupon_code && <span className="order-bogo"> {o.coupon_code}{o.discount > 0 ? ` -₹${o.discount}` : ''}</span>}
          </div>
        </div>
      ))}
    </Modal>
  );
}
