import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

/**
 * Accessible sheet (focus moves in, Escape closes, labelled): a bottom sheet on phones and a
 * centred dialog from 768px (spec §6). An in-sheet Close keeps dismissal reachable, as iOS Sheet.
 */
export function Sheet({ open, onOpenChange, title, description, children, closeLabel = 'Close' }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode; closeLabel?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content className="bs" {...(description ? {} : { 'aria-describedby': undefined })}>
          <div className="bs-head">
            <Dialog.Title asChild><h2>{title}</h2></Dialog.Title>
            <Dialog.Close asChild><button type="button">{closeLabel}</button></Dialog.Close>
          </div>
          {description && <Dialog.Description className="sr-only">{description}</Dialog.Description>}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
