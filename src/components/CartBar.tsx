export function CartBar({ items, total, onOpen }: { items: number; total: number; onOpen: () => void }) {
  return (
    <div className={`cart-sticky-bar ${items > 0 ? 'visible' : ''}`}>
      <div className="cart-summary-text">
        <div className="cart-qty-info">{items} {items === 1 ? 'આઇટમ' : 'આઇટમ્સ'}</div>
        <div className="cart-total-info">₹{total}</div>
      </div>
      <button className="btn-view-cart" onClick={onOpen}>ઓર્ડર આગળ વધારો →</button>
    </div>
  );
}
