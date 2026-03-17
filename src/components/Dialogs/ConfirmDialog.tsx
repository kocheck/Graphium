/**
 * Confirmation Dialog Component
 *
 * Displays a modal dialog for user confirmations (e.g., deleting maps or tokens).
 * Integrated with uiStore for centralized dialog management.
 * Uses the Dialog primitive for overlay, focus trap, and ARIA attributes.
 *
 * **Features:**
 * - Confirm/Cancel buttons using Button primitive
 * - Customizable message and confirm button text
 * - Keyboard support (Enter to confirm, Escape to cancel via Dialog)
 * - Accessible with ARIA attributes (via Dialog)
 *
 * **Integration with uiStore:**
 * Dialogs are triggered via uiStore method:
 * - `showConfirmDialog(message, onConfirm, confirmText?)` - Show confirmation dialog
 *
 * @example
 * // Show delete confirmation
 * const { showConfirmDialog } = useUiStore();
 * showConfirmDialog(
 *   'Are you sure you want to delete this map?',
 *   () => deleteMap(mapId),
 *   'Delete'
 * );
 *
 * @component
 * @returns {React.JSX.Element | null} Confirmation dialog or null if not active
 */

import { useEffect, useCallback } from 'react';

import { useUiStore } from '../../store/uiStore';
import Button from '../primitives/Button';
import Dialog from '../primitives/Dialog';

function ConfirmDialog(): React.JSX.Element | null {
  const { confirmDialog, clearConfirmDialog } = useUiStore();

  const handleConfirm = useCallback(() => {
    if (confirmDialog) {
      confirmDialog.onConfirm();
      clearConfirmDialog();
    }
  }, [confirmDialog, clearConfirmDialog]);

  // Enter key to confirm (Dialog handles Escape)
  useEffect(() => {
    if (!confirmDialog) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDialog, handleConfirm]);

  if (!confirmDialog) {
    return null;
  }

  return (
    <Dialog
      isOpen={!!confirmDialog}
      onClose={clearConfirmDialog}
      title="Confirm Action"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={clearConfirmDialog}>
            Cancel
          </Button>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <Button variant="destructive" onClick={handleConfirm} autoFocus>
            {confirmDialog.confirmText ?? 'Confirm'}
          </Button>
        </>
      }
    >
      <p style={{ color: 'var(--app-text-muted)' }}>{confirmDialog.message}</p>
    </Dialog>
  );
}

export default ConfirmDialog;
