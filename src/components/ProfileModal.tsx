import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { useAuth } from '../hooks/useAuth';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function ProfileModal({ open, onClose, onSaved }: Props) {
  const { profile, saveProfile } = useAuth();
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
    if (name.trim().length < 2) return setError('કૃપા કરીને તમારું પૂરું નામ લખો.');
    if (!/^[0-9]{10}$/.test(phone)) return setError('કૃપા કરીને સાચો 10 આંકડાનો મોબાઈલ નંબર દાખલ કરો!');
    setBusy(true);
    const err = await saveProfile(name, phone);
    setBusy(false);
    if (err) return setError(err === 'PHONE_FORMAT' ? 'મોબાઈલ નંબર 10 આંકડાનો હોવો જોઈએ.' : err);
    onSaved?.();
    onClose();
  };

  return (
    <Modal open={open} title="તમારી વિગતો (Contact Details)" onClose={onClose}>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        ઓર્ડર કન્ફર્મ કરવા અમે આ નંબર પર સંપર્ક કરીશું.
      </div>
      <div className="input-group">
        <label>ગ્રાહકનું પૂરું નામ *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="દા.ત. રમેશભાઈ પટેલ" />
      </div>
      <div className="input-group">
        <label>મોબાઈલ નંબર (10 આંકડા) *</label>
        <input
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
          placeholder="દા.ત. 9876543210"
        />
      </div>
      {error && <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--danger)' }}>{error}</div>}
      <button className="btn-primary-action" disabled={busy} onClick={() => void submit()}>સેવ કરો</button>
    </Modal>
  );
}
