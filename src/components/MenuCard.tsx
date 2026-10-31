import type { Cart, MenuItem, Variant } from '../types';

interface Props {
  item: MenuItem;
  cart: Cart;
  onAdd: (item: MenuItem, variant: Variant) => void;
  onQty: (key: string, delta: number) => void;
}

function Stepper({ qty, onAdd, onQty }: { qty: number; onAdd: () => void; onQty: (d: number) => void }) {
  if (qty === 0) return <button className="btn-add-item" onClick={onAdd}>+ ADD</button>;
  return (
    <div className="qty-control">
      <button className="qty-btn" onClick={() => onQty(-1)}>-</button>
      <span className="qty-val">{qty}</span>
      <button className="qty-btn" onClick={() => onQty(1)}>+</button>
    </div>
  );
}

const rowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: 'var(--bg-elevated)',
  padding: '6px 10px',
  borderRadius: 8,
} as const;

export function MenuCard({ item, cart, onAdd, onQty }: Props) {
  const hasCheese = item.cheesePrice !== null;
  const keyReg = `${item.id}_reg`;
  const keyCheese = `${item.id}_cheese`;
  const qtyReg = cart[keyReg]?.qty ?? 0;
  const qtyCheese = cart[keyCheese]?.qty ?? 0;

  return (
    <div className={`menu-card ${item.inStock ? '' : 'out-of-stock'}`}>
      <div className="item-top-row">
        <div>
          <div className="veg-icon"><div className="veg-dot" /></div>
          <div className="item-name">{item.name}</div>
          <div className="item-desc">{item.description}</div>
          <div className="item-pricing">
            ₹{item.price}{' '}
            {hasCheese && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                | Double Cheese: ₹{item.cheesePrice}
              </span>
            )}
          </div>
        </div>
      </div>

      {!item.inStock ? (
        <div style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 700, marginTop: 8 }}>
          ❌ SOLD OUT (હાલમાં સ્ટોક ખલાસ છે)
        </div>
      ) : hasCheese ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
          <div style={rowStyle}>
            <span style={{ fontSize: '0.8rem' }}>Regular (₹{item.price})</span>
            <Stepper qty={qtyReg} onAdd={() => onAdd(item, 'reg')} onQty={(d) => onQty(keyReg, d)} />
          </div>
          <div style={rowStyle}>
            <span style={{ fontSize: '0.8rem' }}>Double Cheese (₹{item.cheesePrice})</span>
            <Stepper qty={qtyCheese} onAdd={() => onAdd(item, 'cheese')} onQty={(d) => onQty(keyCheese, d)} />
          </div>
        </div>
      ) : (
        <div className="action-row">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>પ્યોર વેજ તાજો સ્વાદ</span>
          <Stepper qty={qtyReg} onAdd={() => onAdd(item, 'reg')} onQty={(d) => onQty(keyReg, d)} />
        </div>
      )}
    </div>
  );
}
