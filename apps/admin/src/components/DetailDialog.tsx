import { useEffect, useRef, type ReactNode } from 'react';
import type { Translate } from '../i18n.ts';
import { Icon } from './Icon.tsx';

// Native dialog: modal focus containment, Escape and an inert background; focus returns to the trigger.
export function DetailDialog({ title, children, onClose, t, onBack }: {
  title: string; children: ReactNode; onClose: () => void; t: Translate; onBack?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    const dialog = ref.current;
    const opener = trigger.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      opener?.focus();
    };
  }, []);
  return (
    <dialog ref={ref} className="detail-dialog" aria-labelledby="dialog-title"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <header>
        {onBack && <button className="icon-button" onClick={onBack} aria-label={t('返回上一条详情', 'Back to previous detail')}>←</button>}
        <div>
          <div className="eyebrow">FANCY INSIGHTS</div>
          <h2 id="dialog-title">{title}</h2>
        </div>
        <button className="icon-button" autoFocus onClick={onClose} aria-label={t('关闭详情', 'Close details')}><Icon name="close" /></button>
      </header>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
