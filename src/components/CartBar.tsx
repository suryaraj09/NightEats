import { useLang } from '../i18n/LanguageProvider';

export function CartBar({ items, total, onOpen, disabled = false }: { items: number; total: number; onOpen: () => void; disabled?: boolean }) {
  const { t } = useLang();
  return (
    <div className={`cart-sticky-bar ${items > 0 ? 'visible' : ''}`}>
      <div className="cart-summary-text">
        <div className="cart-qty-info">{items} {items === 1 ? t('cartbar.item') : t('cartbar.items')}</div>
        <div className="cart-total-info">₹{total}</div>
      </div>
      <button className="btn-view-cart" onClick={onOpen} disabled={disabled}>
        {disabled ? t('cartbar.closed') : t('cartbar.next')}
      </button>
    </div>
  );
}
