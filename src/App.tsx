import { useEffect, useMemo, useState } from 'react';
import { AdminModal } from './components/AdminModal';
import { AuthModal } from './components/AuthModal';
import { CartBar } from './components/CartBar';
import { CartModal } from './components/CartModal';
import { CategoryScroll, type ActiveCategory } from './components/CategoryScroll';
import { Header } from './components/Header';
import { MenuCard } from './components/MenuCard';
import { MyOrdersModal } from './components/MyOrdersModal';
import { Modal } from './components/Modal';
import { ProfileModal } from './components/ProfileModal';
import { useAuth } from './hooks/useAuth';
import { useMenu } from './hooks/useMenu';
import { useShop } from './hooks/useShop';
import { useLang } from './i18n/LanguageProvider';
import { cartTotals } from './lib/cart';
import { loadCart, loadIntent, saveCart, saveIntent } from './lib/persist';
import { supabaseConfigured } from './lib/supabase';
import type { Cart, MenuItem, Variant } from './types';

type Dialog = 'none' | 'auth' | 'profile' | 'cart' | 'adminAuth' | 'admin' | 'myOrders';

export default function App() {
  const auth = useAuth();
  const menu = useMenu();
  const shop = useShop();
  const { t } = useLang();
  const closed = !shop.isOpen;
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [category, setCategory] = useState<ActiveCategory>('All');
  // Google sign-in reloads the page: restore the cart and the dialog the user was heading to.
  const [cart, setCart] = useState<Cart>(loadCart);
  const [dialog, setDialog] = useState<Dialog>(() => loadIntent() ?? 'none');

  useEffect(() => saveCart(cart), [cart]);

  // Show the "shop closed" notice again whenever the owner closes the shop (or changes the note).
  useEffect(() => {
    if (closed) setNoticeDismissed(false);
  }, [closed, shop.note]);
  // Nobody can stay in checkout once the shop closes; the saved cart is kept.
  useEffect(() => {
    if (closed && dialog === 'cart') setDialog('none');
  }, [closed, dialog]);
  useEffect(() => saveIntent(dialog === 'auth' || dialog === 'adminAuth' ? dialog : null), [dialog]);

  const visible = useMemo(
    () => (category === 'All' ? menu.items : menu.items.filter((i) => i.category === category)),
    [menu.items, category],
  );
  const { items: cartCount, subtotal } = cartTotals(cart);

  const addToCart = (item: MenuItem, variant: Variant) => {
    const key = `${item.id}_${variant}`;
    const price = variant === 'cheese' ? (item.cheesePrice as number) : item.price;
    const name =
      variant === 'cheese' ? `${item.name} (Double Cheese)` : item.cheesePrice !== null ? `${item.name} (Regular)` : item.name;
    setCart((c) => ({
      ...c,
      [key]: c[key] ? { ...c[key], qty: c[key].qty + 1 } : { key, itemId: item.id, variant, name, price, qty: 1 },
    }));
  };

  const updateQty = (key: string, delta: number) =>
    setCart((c) => {
      const line = c[key];
      if (!line) return c;
      const next = { ...c };
      if (line.qty + delta <= 0) delete next[key];
      else next[key] = { ...line, qty: line.qty + delta };
      return next;
    });

  // Checkout gate: must be logged in, then must have name + phone on file.
  const startCheckout = () => {
    if (closed) return setNoticeDismissed(false);
    if (!auth.session) return setDialog('auth');
    if (!auth.profileComplete) return setDialog('profile');
    setDialog('cart');
  };

  const openAdmin = () => {
    if (!auth.session) return setDialog('adminAuth');
    if (auth.isAdmin) return setDialog('admin');
    alert(t('app.adminDenied'));
  };

  // Continue where the user was heading once login (or the admin check) completes.
  useEffect(() => {
    if (!auth.session || !auth.ready) return;
    if (dialog === 'auth') startCheckout();
    else if (dialog === 'adminAuth' && auth.isAdmin) setDialog('admin');
    else if (dialog === 'adminAuth') {
      setDialog('none');
      alert(t('app.adminDenied'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.session, auth.ready, auth.isAdmin, auth.profileComplete]);

  return (
    <>
      <Header onOpenAuth={() => setDialog('auth')} onOpenOrders={() => setDialog('myOrders')} />
      <CategoryScroll active={category} onChange={setCategory} />

      <main className={`menu-container ${closed ? 'shop-closed' : ''}`}>
        {!supabaseConfigured && (
          <div className="pincode-fixed-badge">{t('app.supabaseMissing')}</div>
        )}
        {closed && (
          <div className="shop-closed-banner">{t('shop.closedBanner')}{shop.note ? ` — ${shop.note}` : ''}</div>
        )}
        {menu.error && <div className="pincode-fixed-badge">{t('app.menuLoadFailed', { error: menu.error })}</div>}
        {menu.loading && <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{t('app.loading')}</div>}
        {visible.map((item) => (
          <MenuCard key={item.id} item={item} cart={cart} onAdd={addToCart} onQty={updateQty} />
        ))}
      </main>

      <CartBar items={cartCount} total={subtotal} onOpen={startCheckout} disabled={closed} />

      <Modal open={closed && !noticeDismissed && dialog === 'none'} title={t('shop.closedTitle')} onClose={() => setNoticeDismissed(true)}>
        <div style={{ fontSize: '0.9rem' }}>
          {t('shop.closedBody')}
        </div>
        {shop.note && <div style={{ fontWeight: 700, color: 'var(--gold-primary)' }}>{shop.note}</div>}
        <button className="btn-primary-action" onClick={() => setNoticeDismissed(true)}>{t('shop.viewMenu')}</button>
      </Modal>

      <AuthModal open={dialog === 'auth'} onClose={() => setDialog('none')} />
      <MyOrdersModal open={dialog === 'myOrders'} onClose={() => setDialog('none')} />
      <ProfileModal
        open={dialog === 'profile'}
        onClose={() => setDialog('none')}
        onSaved={() => cartCount > 0 && setTimeout(() => setDialog('cart'), 0)}
      />
      <CartModal
        open={dialog === 'cart'}
        cart={cart}
        onClose={() => setDialog('none')}
        onQty={updateQty}
        onOrdered={() => setCart({})}
        onEditProfile={() => setDialog('profile')}
      />

      <AuthModal
        open={dialog === 'adminAuth'}
        onClose={() => setDialog('none')}
        title={t('app.adminLogin')}
      />
      <AdminModal open={dialog === 'admin'} onClose={() => setDialog('none')} items={menu.items} reload={menu.reload} shop={shop} />

      <footer>
        <p>© 2026 NIGHT EATS - PURE VEG BURGER CAFÉ</p>
        <p style={{ marginTop: 4 }}>{t('footer.call')}</p>
        <span className="admin-link" onClick={openAdmin}>{t('footer.admin')}</span>
      </footer>
    </>
  );
}
