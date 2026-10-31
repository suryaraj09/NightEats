import { Modal } from './Modal';
import { useAuth } from '../hooks/useAuth';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
}

export function AuthModal({ open, onClose, title = 'લૉગિન / સાઇન અપ' }: Props) {
  const { signInWithGoogle } = useAuth();

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <button className="btn-primary-action" onClick={() => void signInWithGoogle()}>
        🔵 Google સાથે ચાલુ રાખો
      </button>
    </Modal>
  );
}
