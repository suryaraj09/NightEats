import type { CSSProperties, ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  sheetStyle?: CSSProperties;
}

export function Modal({ open, title, onClose, children, sheetStyle }: Props) {
  return (
    <div className={`modal-overlay ${open ? 'open' : ''}`}>
      <div className="modal-sheet" style={sheetStyle}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn-close-modal" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{open ? children : null}</div>
      </div>
    </div>
  );
}
