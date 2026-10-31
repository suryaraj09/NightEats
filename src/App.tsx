import { useEffect, useMemo, useState } from 'react';
import { AdminModal } from './components/AdminModal';
import { AuthModal } from './components/AuthModal';
import { CartBar } from './components/CartBar';
import { CartModal } from './components/CartModal';
import { CategoryScroll, type ActiveCategory } from './components/CategoryScroll';
import { Header } from './components/Header';
import { MenuCard } from './components/MenuCard';
import { ProfileModal } from './components/ProfileModal';
import { useAuth } from './hooks/useAuth';
import { useMenu } from './hooks/useMenu';
import { cartTotals } from './lib/cart';
import { supabaseConfigured } from './lib/supabase';
import type { Cart, MenuItem, Variant } from './types';

type Dialog = 'none' | 'auth' | 'profile' | 'cart' | 'adminAuth' | 'admin';

export default function App() {
  const auth = useAuth();
  const menu = useMenu();
  const [category, setCategory] = useState<ActiveCategory>('All');
  const [cart, setCart] = useState<Cart>({});
  const [dialog, setDialog] = useState<Dialog>('none');

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
    if (!auth.session) return setDialog('auth');
    if (!auth.profileComplete) return setDialog('profile');
    setDialog('cart');
  };

  const openAdmin = () => {
    if (!auth.session) return setDialog('adminAuth');
    if (auth.isAdmin) return setDialog('admin');
    alert('❌ આ એકાઉન્ટને માલિક એક્સેસ નથી.');
  };

  // Continue where the user was heading once login (or the admin check) completes.
  useEffect(() => {
    if (!auth.session || !auth.ready) return;
    if (dialog === 'auth') startCheckout();
    else if (dialog === 'adminAuth' && auth.isAdmin) setDialog('admin');
    else if (dialog === 'adminAuth') {
      setDialog('none');
      alert('❌ આ એકાઉન્ટને માલિક એક્સેસ નથી.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.session, auth.ready, auth.isAdmin, auth.profileComplete]);

  return (
    <>
      <Header onOpenAuth={() => setDialog('auth')} />
      <CategoryScroll active={category} onChange={setCategory} />

      <main className="menu-container">
        {!supabaseConfigured && (
          <div className="pincode-fixed-badge">⚠️ Supabase env vars missing — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</div>
        )}
        {menu.error && <div className="pincode-fixed-badge">⚠️ મેનૂ લોડ થઈ શક્યું નથી: {menu.error}</div>}
        {menu.loading && <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>લોડ થઈ રહ્યું છે...</div>}
        {visible.map((item) => (
          <MenuCard key={item.id} item={item} cart={cart} onAdd={addToCart} onQty={updateQty} />
        ))}
      </main>

      <CartBar items={cartCount} total={subtotal} onOpen={startCheckout} />

      <AuthModal open={dialog === 'auth'} onClose={() => setDialog('none')} />
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
        title="માલિક એક્સેસ (Admin Login)"
      />
      <AdminModal open={dialog === 'admin'} onClose={() => setDialog('none')} items={menu.items} reload={menu.reload} />

      <footer>
        <p>© 2026 NIGHT EATS - PURE VEG BURGER CAFÉ</p>
        <p style={{ marginTop: 4 }}>ઓર્ડર કોલ: +91 7202806140 | વાસણા, અમદાવાદ</p>
        <span className="admin-link" onClick={openAdmin}>માલિક પોર્ટલ (Admin Menu Manager)</span>
      </footer>
    </>
  );
}
