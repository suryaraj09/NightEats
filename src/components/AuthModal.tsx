import { Modal } from './Modal';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../i18n/LanguageProvider';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
}

export function AuthModal({ open, onClose, title }: Props) {
  const { signInWithGoogle } = useAuth();
  const { t } = useLang();

  return (
    <Modal open={open} title={title ?? t('auth.title')} onClose={onClose}>
      <button className="btn-primary-action" onClick={() => void signInWithGoogle()}>
        {t('auth.google')}
      </button>
    </Modal>
  );
}
