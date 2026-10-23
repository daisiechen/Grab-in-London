import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

/** Accessible bottom sheet (focus trap, Escape, labelled) for confirmations and filters. */
export function Sheet({ open, onOpenChange, title, description, children, onCloseAutoFocus }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode; onCloseAutoFocus?: Dialog.DialogContentProps['onCloseAutoFocus'];
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay" />
        <Dialog.Content onCloseAutoFocus={onCloseAutoFocus} className="bottom-sheet" {...(description ? {} : { 'aria-describedby': undefined })}>
          <span className="sheet-grip" aria-hidden="true" />
          <Dialog.Title className="sheet-title">{title}</Dialog.Title>
          {description && <Dialog.Description className="sr-only">{description}</Dialog.Description>}
          <div className="sheet-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
