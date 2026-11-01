import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { cartTotals } from '../lib/cart';
import { couponErrorText, type CouponCheck } from '../lib/coupons';
import type { Cart, PlacedOrder } from '../types';

interface Props {
  open: boolean;
  cart: Cart;
  onClose: () => void;
  onQty: (key: string, delta: number) => void;
  onOrdered: () => void;
  onEditProfile: () => void;
}

type Feedback = { text: string; color: string } | null;

export function CartModal({ open, cart, onClose, onQty, onOrdered, onEditProfile }: Props) {
  const { profile } = useAuth();
  const [address, setAddress] = useState('');
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState<{ code: string; discount: number; freeItem: string | null; desc: string | null } | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<{ order: PlacedOrder; address: string } | null>(null);

  const { items, subtotal } = cartTotals(cart);
  const discount = applied?.discount ?? 0;
  const final = Math.max(0, subtotal - discount);
  const orderItems = Object.values(cart).map((l) => ({ menu_item_id: l.itemId, variant: l.variant, qty: l.qty }));
  const itemsKey = JSON.stringify(orderItems);

  // Forget the confirmation once the modal is closed by any route.
  useEffect(() => {
    if (!open) setPlaced(null);
  }, [open]);

  // The server prices coupons. Ask it (validate_coupon); the real discount is recomputed again in place_order.
  const check = async (c: string): Promise<CouponCheck | string> => {
    const { data, error } = await supabase.rpc('validate_coupon', { p_code: c, p_items: JSON.parse(itemsKey) });
    if (error) return error.message;
    return (Array.isArray(data) ? data[0] : data) as CouponCheck;
  };

  const applyCoupon = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setFeedback({ text: 'કોડ ચકાસી રહ્યા છીએ...', color: 'var(--gold-primary)' });
    const res = await check(c);
    if (typeof res === 'string' || !res.valid) {
      setApplied(null);
      return setFeedback({ text: `❌ ${typeof res === 'string' ? res : res.reason}`, color: 'var(--danger)' });
    }
    setApplied({ code: c, discount: res.discount, freeItem: res.free_item_name, desc: res.coupon_desc });
    setFeedback(null);
  };

  const removeCoupon = () => {
    setApplied(null);
    setFeedback(null);
    setCode('');
  };

  // Keep the preview honest when the cart changes (quantities, items removed...).
  const appliedCode = applied?.code;
  useEffect(() => {
    if (!appliedCode || !open) return;
    let stale = false;
    void check(appliedCode).then((res) => {
      if (stale) return;
      if (typeof res === 'string' || !res.valid) {
        setApplied(null);
        setFeedback({ text: `❌ ${typeof res === 'string' ? res : res.reason}`, color: 'var(--danger)' });
      } else {
        setApplied({ code: appliedCode, discount: res.discount, freeItem: res.free_item_name, desc: res.coupon_desc });
      }
    });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, appliedCode, open]);

  const placeOrder = async () => {
    if (!address.trim()) return alert('કૃપા કરીને નામ અને વાસણાનું પૂરું સરનામું દાખલ કરો!');
    setBusy(true);
    const { data, error } = await supabase.rpc('place_order', {
      p_items: orderItems,
      p_address: address,
      p_coupon_code: applied?.code,
    });
    setBusy(false);
    const order = (Array.isArray(data) ? data[0] : data) as PlacedOrder | undefined;
    if (error || !order) {
      const couponReason = error ? couponErrorText(error.message) : null;
      if (couponReason) setApplied(null);
      return alert(
        couponReason ?? (error?.message === 'shop closed' ? 'શોપ હમણાં બંધ છે. કૃપા કરીને પછી પ્રયાસ કરો.' : (error?.message ?? 'ઓર્ડર નિષ્ફળ ગયો. ફરી પ્રયાસ કરો.')),
      );
    }
    setPlaced({ order, address: address.trim() });
    setAddress('');
    setApplied(null);
    setCode('');
    setFeedback(null);
    onOrdered();
  };

  const close = () => {
    setPlaced(null);
    onClose();
  };

  if (placed) {
    const { order, address: addr } = placed;
    return (
      <Modal open={open} title="✅ ઓર્ડર મળી ગયો!" onClose={close}>
        <div style={{ textAlign: 'center', fontSize: '0.9rem' }}>
          ઓર્ડર નંબર <b style={{ color: 'var(--gold-primary)', fontSize: '1.1rem' }}>#{order.order_id}</b>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4 }}>
            અમે તમારો ઓર્ડર તૈયાર કરવાનું શરૂ કરીએ છીએ. જરૂર પડે તો અમે તમને ફોન કરીશું.
          </div>
        </div>
        <ul className="order-lines">
          {order.lines.map((l, i) => (
            <li key={i}>{l.name} × {l.qty} = ₹{l.unit_price * l.qty}</li>
          ))}
        </ul>
        <div style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>સબટોટલ:</span><span>₹{order.subtotal}</span></div>
          {order.discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}><span>કૂપન{order.coupon_code ? ` (${order.coupon_code})` : ''}:</span><span>-₹{order.discount}</span></div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: 'var(--gold-primary)', borderTop: '1px dashed var(--border-subtle)', paddingTop: 6 }}>
            <span>કુલ ચૂકવવાપાત્ર (COD):</span><span>₹{order.total}</span>
          </div>
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          📍 {addr}, વાસણા (380007)<br />
          📞 {order.customer_name} · {order.customer_phone}<br />
          💵 પેમેન્ટ: Cash on Delivery / UPI on Delivery
        </div>
        <button className="btn-primary-action" onClick={close}>બરાબર</button>
      </Modal>
    );
  }

  return (
    <Modal open={open} title="ઓર્ડર વિગતો (Your Cart)" onClose={close}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Object.values(cart).map((l) => (
          <div className="cart-item-row" key={l.key}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{l.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--gold-primary)' }}>
                ₹{l.price} × {l.qty} = ₹{l.price * l.qty}
              </div>
            </div>
            <div className="qty-control">
              <button className="qty-btn" onClick={() => onQty(l.key, -1)}>-</button>
              <span className="qty-val">{l.qty}</span>
              <button className="qty-btn" onClick={() => onQty(l.key, 1)}>+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="coupon-box">
        {applied ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                🎟️ <b style={{ color: 'var(--gold-primary)' }}>{applied.code}</b> લાગુ થયો
                {applied.desc && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{applied.desc}</div>}
              </div>
              <button className="btn-add-item" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={removeCoupon}>કાઢી નાખો</button>
            </div>
            <div style={{ color: 'var(--success)', fontWeight: 600 }}>
              {applied.freeItem ? `🎁 ફ્રી: ${applied.freeItem}` : `🎉 તમે ₹${applied.discount} બચાવ્યા!`}
            </div>
          </>
        ) : (
          <>
            <b style={{ color: 'var(--gold-primary)' }}>કૂપન કોડ</b>
            <div className="coupon-row">
              <input
                type="text"
                value={code}
                maxLength={20}
                placeholder="દા.ત. BOGO1ST"
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && void applyCoupon()}
              />
              <button className="btn-add-item" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => void applyCoupon()}>
                લાગુ કરો
              </button>
            </div>
          </>
        )}
      </div>
      {feedback && <div style={{ fontSize: '0.75rem', fontWeight: 600, color: feedback.color }}>{feedback.text}</div>}

      <div className="pincode-fixed-badge">
        📍 ડિલિવરી એરિયા: <b>વાસણા (380007)</b> - ફક્ત આ પિનકોડ માન્ય છે.
      </div>

      <div className="input-group">
        <label>મોબાઈલ નંબર (10 આંકડા) *</label>
        <input type="tel" value={profile?.phone ?? ''} readOnly style={{ background: '#111', color: '#888' }} />
      </div>
      <div className="input-group">
        <label>ગ્રાહકનું પૂરું નામ *</label>
        <input type="text" value={profile?.name ?? ''} readOnly style={{ background: '#111', color: '#888' }} />
        <span style={{ fontSize: '0.7rem', color: 'var(--gold-primary)', cursor: 'pointer' }} onClick={onEditProfile}>
          ✏️ નામ / નંબર બદલો
        </span>
      </div>
      <div className="input-group">
        <label>ડિલિવરીનું ચોક્કસ સરનામું (વાસણા 380007) *</label>
        <textarea
          rows={2}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="ઘર નંબર, સોસાયટી/ફ્લેટનું નામ, લેન્ડમાર્ક, વાસણા"
        />
      </div>
      <div className="input-group">
        <label>પિનકોડ *</label>
        <input type="text" value="380007" readOnly style={{ background: '#111', color: '#888' }} />
      </div>

      <div style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>સબટોટલ:</span><span>₹{subtotal}</span></div>
        {applied && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
            <span>કૂપન ({applied.code}):</span><span>{applied.freeItem ? `🎁 ${applied.freeItem}` : `-₹${discount}`}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>ડિલિવરી ચાર્જ:</span><span style={{ color: 'var(--success)' }}>FREE</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.05rem', color: 'var(--gold-primary)', borderTop: '1px dashed var(--border-subtle)', paddingTop: 6 }}>
          <span>કુલ ચૂકવવાપાત્ર (COD):</span><span>₹{final}</span>
        </div>
      </div>

      <button className="btn-primary-action" disabled={busy || items === 0} onClick={() => void placeOrder()}>
        ઓર્ડર કન્ફર્મ કરો
      </button>
    </Modal>
  );
}
