export function CartBar({ items, total, onOpen, disabled = false }: { items: number; total: number; onOpen: () => void; disabled?: boolean }) {
  return (
    <div className={`cart-sticky-bar ${items > 0 ? 'visible' : ''}`}>
      <div className="cart-summary-text">
        <div className="cart-qty-info">{items} {items === 1 ? 'આઇટમ' : 'આઇટમ્સ'}</div>
        <div className="cart-total-info">₹{total}</div>
      </div>
      <button className="btn-view-cart" onClick={onOpen} disabled={disabled}>
        {disabled ? 'શોપ હજી બંધ છે' : 'ઓર્ડર આગળ વધારો →'}
      </button>
    </div>
  );
}
