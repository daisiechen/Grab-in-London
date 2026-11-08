import type { ReactNode } from 'react';
import { FormMessage, Primary, TextAction } from './components.tsx';
import { Sheet } from './Sheet.tsx';

/** iOS confirmation pattern: “keep” as the secondary button first, the destructive text action second. */
export function ConfirmSheet({ open, onOpenChange, title, children, confirmLabel, keepLabel = 'Keep things as they are', onConfirm, busy, error }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode;
  confirmLabel: string; keepLabel?: string; onConfirm: () => void; busy?: boolean; error?: string | null;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      <div className="body">{children}</div>
      <FormMessage message={error} />
      <Primary secondary onClick={() => onOpenChange(false)}>{keepLabel}</Primary>
      <TextAction danger disabled={busy} onClick={onConfirm}>{confirmLabel}</TextAction>
    </Sheet>
  );
}
