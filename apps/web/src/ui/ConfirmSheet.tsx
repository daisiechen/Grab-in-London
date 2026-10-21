import type { ReactNode } from 'react';
import { FormError, Primary } from './components.tsx';
import { Sheet } from './Sheet.tsx';

/** Prototype destructive confirmation: "keep" first, red outlined confirm second. */
export function ConfirmSheet({ open, onOpenChange, title, children, confirmLabel, keepLabel = 'Keep things as they are', onConfirm, busy, error }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode;
  confirmLabel: string; keepLabel?: string; onConfirm: () => void; busy?: boolean; error?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      {children}
      <FormError>{error}</FormError>
      <Primary secondary onClick={() => onOpenChange(false)}>{keepLabel}</Primary>
      <button type="button" className="cancel-confirm" disabled={busy} onClick={onConfirm}>{confirmLabel}</button>
    </Sheet>
  );
}
