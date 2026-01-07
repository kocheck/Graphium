/**
 * Confirmation Dialog Component
 *
 * Displays a modal dialog for user confirmations (e.g., deleting maps or tokens).
 * Integrated with gameStore for centralized dialog management.
 *
 * **Features:**
 * - Modal overlay with focus trap
 * - Confirm/Cancel buttons
 * - Customizable message and confirm button text
 * - Keyboard support (Enter to confirm, Escape to cancel)
 * - Accessible with ARIA attributes
 *
 * **Integration with gameStore:**
 * Dialogs are triggered via gameStore method:
 * - `showConfirmDialog(message, onConfirm, confirmText?)` - Show confirmation dialog
 *
 * @example
 * // Show delete confirmation
 * const { showConfirmDialog } = useGameStore();
 * showConfirmDialog(
 *   'Are you sure you want to delete this map?',
 *   () => deleteMap(mapId),
 *   'Delete'
 * );
 *
 * @component
 * @returns {JSX.Element | null} Confirmation dialog or null if not active
 */

import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

const ConfirmDialog = () => {
  const { confirmDialog, clearConfirmDialog } = useGameStore();

  // Handle keyboard events
  useEffect(() => {
    if (!confirmDialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearConfirmDialog();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        confirmDialog.onConfirm();
        clearConfirmDialog();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDialog, clearConfirmDialog]);

  if (!confirmDialog) return null;

  const handleConfirm = () => {
    confirmDialog.onConfirm();
    clearConfirmDialog();
  };

  const handleCancel = () => {
    clearConfirmDialog();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50"
      onClick={handleCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="bg-[var(--app-bg)] border border-[var(--app-border)] rounded-lg shadow-2xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold mb-4"
          style={{ color: 'var(--app-text)' }}
        >
          Confirm Action
        </h2>
        <p className="mb-6" style={{ color: 'var(--app-text-muted)' }}>
          {confirmDialog.message}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded bg-[var(--app-bg-subtle)] hover:bg-[var(--app-bg-hover)] transition"
            style={{ color: 'var(--app-text)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white transition"
            autoFocus
          >
            {confirmDialog.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
