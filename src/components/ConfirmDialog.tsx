/**
 * Confirmation Dialog Component
 *
 * Store-driven confirmation dialog on the `dialog` primitive. Triggered via
 * `showConfirmDialog(message, onConfirm, confirmText?)` in gameStore and cleared via
 * `clearConfirmDialog()`. Enter confirms from anywhere inside the dialog, the primitive
 * cancels, and the Cancel button receives initial focus (the safe action on a destructive
 * dialog). This file does not attach a second host-key handler.
 *
 * @component
 */

import { type JSX, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useGameStore } from '../store/gameStore';

/** Radix focuses the first tabbable element on open; we want Cancel instead. */
function focusCancelButton(event: Event): void {
  event.preventDefault();
  const root = event.currentTarget;
  if (root instanceof HTMLElement) {
    root.querySelector<HTMLButtonElement>('[data-testid="dialog-confirm-cancel"]')?.focus();
  }
}

function ConfirmDialog(): JSX.Element | null {
  const confirmDialog = useGameStore((state) => state.confirmDialog);
  const clearConfirmDialog = useGameStore((state) => state.clearConfirmDialog);

  // Enter confirms (the primitive supplies the host-key close, not Enter)
  useEffect(() => {
    if (!confirmDialog) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmDialog.onConfirm();
        clearConfirmDialog();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDialog, clearConfirmDialog]);

  if (!confirmDialog) {
    return null;
  }

  const handleConfirm = (): void => {
    confirmDialog.onConfirm();
    clearConfirmDialog();
  };

  const handleOpenChange = (open: boolean): void => {
    if (!open) {
      clearConfirmDialog();
    }
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md rounded-lg"
        data-testid="dialog-confirm-root"
        showCloseButton={false}
        onOpenAutoFocus={focusCancelButton}
      >
        <DialogHeader>
          <DialogTitle id="confirm-dialog-title" className="text-lg font-semibold">
            Confirm Action
          </DialogTitle>
          <DialogDescription>{confirmDialog.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={clearConfirmDialog}
            data-testid="dialog-confirm-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            data-testid="dialog-confirm-confirm"
          >
            {confirmDialog.confirmText ?? 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmDialog;
