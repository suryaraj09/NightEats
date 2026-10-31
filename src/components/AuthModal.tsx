import { useState } from 'react';
import { Modal } from './Modal';
import { useAuth } from '../hooks/useAuth';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
}

export function AuthModal({ open, onClose, title = 'લૉગિન / સાઇન અપ' }: Props) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const submit = async () => {
    setMsg(null);
    if (!email.includes('@') || password.length < 6) {
      setMsg({ text: 'સાચો ઈમેલ અને ઓછામાં ઓછા 6 અક્ષરનો પાસવર્ડ દાખલ કરો.', ok: false });
      return;
    }
    setBusy(true);
    const err = mode === 'signin' ? await signInWithEmail(email, password) : await signUpWithEmail(email, password);
    setBusy(false);
    if (err === 'CONFIRM_EMAIL') {
      setMsg({ text: '📧 તમારા ઈમેલ પર કન્ફર્મેશન લિંક મોકલી છે. લિંક ખોલ્યા પછી લૉગિન કરો.', ok: true });
    } else if (err) {
      setMsg({ text: err, ok: false });
    } else {
      onClose();
    }
  };

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <button className="btn-primary-action" onClick={() => void signInWithGoogle()}>
        🔵 Google સાથે ચાલુ રાખો
      </button>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>— અથવા ઈમેલથી —</div>

      <div className="input-group">
        <label>ઈમેલ</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" />
      </div>
      <div className="input-group">
        <label>પાસવર્ડ</label>
        <div className="pin-wrapper">
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="ઓછામાં ઓછા 6 અક્ષર"
          />
          <button type="button" className="pin-toggle-btn" onClick={() => setShowPw((v) => !v)}>
            {showPw ? '🙈' : '👁️'}
          </button>
        </div>
      </div>

      {msg && <div style={{ fontSize: '0.78rem', fontWeight: 600, color: msg.ok ? 'var(--success)' : 'var(--danger)' }}>{msg.text}</div>}

      <button className="btn-primary-action" disabled={busy} onClick={() => void submit()}>
        {mode === 'signin' ? 'લૉગિન કરો' : 'એકાઉન્ટ બનાવો'}
      </button>
      <div
        style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--gold-primary)', cursor: 'pointer' }}
        onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg(null); }}
      >
        {mode === 'signin' ? 'નવા છો? એકાઉન્ટ બનાવો' : 'પહેલેથી એકાઉન્ટ છે? લૉગિન કરો'}
      </div>
    </Modal>
  );
}
