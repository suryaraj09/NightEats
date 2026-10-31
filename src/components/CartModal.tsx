import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { bogoDiscount, cartTotals } from '../lib/cart';
import { buildWhatsAppUrl } from '../lib/whatsapp';
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
  const [bogo, setBogo] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  const { items, subtotal, unitPrices } = cartTotals(cart);
  const discount = bogoDiscount(unitPrices, bogo);
  const final = Math.max(0, subtotal - discount);

  // BOGO needs >= 2 units; drop it if the cart shrinks below that.
  useEffect(() => {
    if (bogo && items < 2) setBogo(false);
  }, [bogo, items]);

  const applyBogo = async () => {
    if (items < 2) {
      setBogo(false);
      return setFeedback({ text: '⚠️ BOGO ઓફર માટે કાર્ટમાં ઓછામાં ઓછી 2 આઇટમ્સ હોવી જરૂરી છે!', color: 'var(--danger)' });
    }
    setFeedback({ text: 'નંબર ચકાસી રહ્યા છીએ...', color: 'var(--gold-primary)' });
    const { data, error } = await supabase.rpc('bogo_available');
    if (error) return setFeedback({ text: error.message, color: 'var(--danger)' });
    if (!data) {
      setBogo(false);
      return setFeedback({ text: '❌ માફ કરશો, આ મોબાઈલ નંબર પર BOGO1ST ઓફર અગાઉ વપરાઈ ચૂકેલી છે!', color: 'var(--danger)' });
    }
    setBogo(true);
    setFeedback({ text: '🎉 BOGO1ST સફળતાપૂર્વક લાગુ થઈ ગયો! સૌથી ઓછી કિંમતની 1 આઇટમ બિલકુલ ફ્રી.', color: 'var(--success)' });
  };

  const placeOrder = async () => {
    if (!address.trim()) return alert('કૃપા કરીને નામ અને વાસણાનું પૂરું સરનામું દાખલ કરો!');
    // Open the tab synchronously (before awaiting) so mobile popup blockers allow it.
    const tab = window.open('', '_blank');
    setBusy(true);
    const { data, error } = await supabase.rpc('place_order', {
      p_items: Object.values(cart).map((l) => ({ menu_item_id: l.itemId, variant: l.variant, qty: l.qty })),
      p_address: address,
      p_use_bogo: bogo,
    });
    setBusy(false);
    const order = (Array.isArray(data) ? data[0] : data) as PlacedOrder | undefined;
    if (error || !order) {
      tab?.close();
      if (error?.message.includes('BOGO1ST already used')) setBogo(false);
      return alert(error?.message ?? 'ઓર્ડર નિષ્ફળ ગયો. ફરી પ્રયાસ કરો.');
    }
    const url = buildWhatsAppUrl(order, address.trim());
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setAddress('');
    setBogo(false);
    setFeedback(null);
    onOrdered();
    onClose();
  };

  return (
    <Modal open={open} title="ઓર્ડર વિગતો (Your Cart)" onClose={onClose}>
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

      <div className="bogo-card">
        <div>
          <b style={{ color: 'var(--gold-primary)' }}>BOGO1ST</b>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>૧ મોબાઈલ નંબર પર ૧ વાર મફત આઇટમ!</div>
        </div>
        <button className="btn-add-item" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => void applyBogo()}>
          લાગુ કરો
        </button>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}><span>BOGO ડિસ્કાઉન્ટ:</span><span>-₹{discount}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>ડિલિવરી ચાર્જ:</span><span style={{ color: 'var(--success)' }}>FREE</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.05rem', color: 'var(--gold-primary)', borderTop: '1px dashed var(--border-subtle)', paddingTop: 6 }}>
          <span>કુલ ચૂકવવાપાત્ર (COD):</span><span>₹{final}</span>
        </div>
      </div>

      <button className="btn-primary-action" disabled={busy || items === 0} onClick={() => void placeOrder()}>
        💬 WhatsApp પર ઓર્ડર કન્ફર્મ કરો
      </button>
    </Modal>
  );
}
