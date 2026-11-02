import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../i18n/LanguageProvider';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function ProfileModal({ open, onClose, onSaved }: Props) {
  const { profile, saveProfile } = useAuth();
  const { t } = useLang();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(profile?.name ?? '');
      setPhone(profile?.phone ?? '');
      setError(null);
    }
  }, [open, profile]);

  const submit = async () => {
    if (name.trim().length < 2) return setError(t('profile.errName'));
    if (!/^[0-9]{10}$/.test(phone)) return setError(t('profile.errPhone'));
    setBusy(true);
    const err = await saveProfile(name, phone);
    setBusy(false);
    if (err) return setError(err === 'PHONE_FORMAT' ? t('profile.errPhoneFormat') : err);
    onSaved?.();
    onClose();
  };

  return (
    <Modal open={open} title={t('profile.title')} onClose={onClose}>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        {t('profile.intro')}
      </div>
      <div className="input-group">
        <label>{t('field.name')}</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('profile.namePlaceholder')} />
      </div>
      <div className="input-group">
        <label>{t('field.phone')}</label>
        <input
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
          placeholder={t('profile.phonePlaceholder')}
        />
      </div>
      {error && <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--danger)' }}>{error}</div>}
      <button className="btn-primary-action" disabled={busy} onClick={() => void submit()}>{t('profile.save')}</button>
    </Modal>
  );
}
