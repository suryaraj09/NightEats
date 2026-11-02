import { useAuth } from '../hooks/useAuth';
import { useLang } from '../i18n/LanguageProvider';
import { LanguageToggle } from './LanguageToggle';

export function Header({ onOpenAuth, onOpenOrders }: { onOpenAuth: () => void; onOpenOrders: () => void }) {
  const { session, profile, signOut } = useAuth();
  const { t } = useLang();
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
        <div className="header-actions">
          <LanguageToggle />
          <a href="tel:7202806140" className="call-btn-header">📞 7202806140</a>
        </div>
      </header>
      <div className="banner-strip">
        <span className="badge-bogo">{t('header.bogoBadge')}</span>
        <span>{t('header.bogoText')} <b>BOGO1ST</b>)</span>
      </div>
      <div style={{ textAlign: 'right', padding: '6px 16px 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        {session ? (
          <>
            👤 {profile?.name ?? session.user.email}{' '}
            <span style={{ color: 'var(--gold-primary)', cursor: 'pointer' }} onClick={onOpenOrders}>
              {t('header.myOrders')}
            </span>{' '}
            <span style={{ color: 'var(--gold-primary)', cursor: 'pointer' }} onClick={() => void signOut()}>
              {t('header.logout')}
            </span>
          </>
        ) : (
          <span style={{ color: 'var(--gold-primary)', cursor: 'pointer' }} onClick={onOpenAuth}>
            {t('header.login')}
          </span>
        )}
      </div>
    </>
  );
}
