import { useAuth } from '../hooks/useAuth';

export function Header({ onOpenAuth }: { onOpenAuth: () => void }) {
  const { session, profile, signOut } = useAuth();
  return (
    <>
      <header>
        <div className="brand-wrapper">
          <div className="brand-logo-badge">🦉</div>
          <div>
            <div className="brand-title">NIGHT EATS</div>
            <div className="brand-sub">Pure Veg Burger Café</div>
          </div>
        </div>
        <a href="tel:7202806140" className="call-btn-header">📞 7202806140</a>
      </header>
      <div className="banner-strip">
        <span className="badge-bogo">BOGO OFFER</span>
        <span>પહેલા ઓર્ડર પર BUY 1 GET 1 FREE! (Code: <b>BOGO1ST</b>)</span>
      </div>
      <div style={{ textAlign: 'right', padding: '6px 16px 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        {session ? (
          <>
            👤 {profile?.name ?? session.user.email}{' '}
            <span style={{ color: 'var(--gold-primary)', cursor: 'pointer' }} onClick={() => void signOut()}>
              | લૉગઆઉટ
            </span>
          </>
        ) : (
          <span style={{ color: 'var(--gold-primary)', cursor: 'pointer' }} onClick={onOpenAuth}>
            🔐 લૉગિન / સાઇન અપ
          </span>
        )}
      </div>
    </>
  );
}
