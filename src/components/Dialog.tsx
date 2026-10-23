import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { XIcon } from '@phosphor-icons/react';
import { useLanguage } from '../lib/language';

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'small' | 'default' | 'wide';
  /** Prevent closing (e.g. while saving). */
  busy?: boolean;
  /** Wraps body and footer in a form, so Enter submits. */
  onSubmit?: () => void;
};

/**
 * Native modal <dialog>: focus is trapped and returned by the browser, Escape closes,
 * and the page behind is inert. Becomes a full-screen sheet on phones.
 */
export function Dialog({ open, onClose, title, children, footer, size = 'default', busy, onSubmit }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { text } = useLanguage();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    // React's autoFocus runs before showModal(); focus the intended control afterwards.
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  const content = <>
    <div className="dialog-body">{children}</div>
    {footer && <div className="dialog-footer">{footer}</div>}
  </>;
  return <dialog ref={ref} className={`dialog ${size === 'default' ? '' : `dialog-${size}`}`} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="dialog-header">
      <h2 id={titleId}>{title}</h2>
      <button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label={text('إغلاق', 'Close')}><XIcon size={20} /></button>
    </div>
    {onSubmit
      ? <form noValidate onSubmit={event => { event.preventDefault(); onSubmit(); }} style={{ display: 'contents' }}>{content}</form>
      : content}
  </dialog>;
}
