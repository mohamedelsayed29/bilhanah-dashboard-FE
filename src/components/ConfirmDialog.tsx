import type { ReactNode } from 'react';
import { WarningIcon } from '@phosphor-icons/react';
import { useLanguage } from '../lib/language';
import { Button } from './Button';
import { Dialog } from './Dialog';

type Props = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
};

/** In-app confirmation for destructive actions (never window.confirm). */
export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onCancel, busy }: Props) {
  const { text } = useLanguage();
  return <Dialog open={open} onClose={onCancel} title={title} size="small" busy={busy}
    footer={<>
      <Button variant="secondary" onClick={onCancel} disabled={busy} data-autofocus>{text('إلغاء', 'Cancel')}</Button>
      <Button variant="danger" onClick={onConfirm} loading={busy}>{confirmLabel}</Button>
    </>}>
    <div className="confirm-body">
      <span className="confirm-icon" aria-hidden="true"><WarningIcon size={22} weight="bold" /></span>
      <p>{description}</p>
    </div>
  </Dialog>;
}
