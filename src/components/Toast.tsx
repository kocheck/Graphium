/**
 * Toast Notification Component
 *
 * Displays transient notification messages at the top of the screen.
 * Integrated with uiStore for centralized notification management.
 *
 * **Features:**
 * - Auto-dismiss after 5 seconds
 * - Manual dismiss via close button
 * - Three types: error (red), success (green), info (blue)
 * - Fixed positioning at top-center with slide-down animation
 * - High z-index (100) to appear above all other content
 * - Accessible with ARIA labels
 *
 * **Integration with uiStore:**
 * Toast messages are dispatched via uiStore methods:
 * - `showToast(message, type)` - Show new toast
 * - `clearToast()` - Dismiss current toast
 *
 * Only one toast is shown at a time (newer toasts replace older ones).
 *
 * @example
 * // Show success toast
 * const { showToast } = useUiStore();
 * showToast('Map uploaded successfully!', 'success');
 *
 * @example
 * // Show error toast
 * const { showToast } = useUiStore();
 * showToast('Failed to load game state', 'error');
 *
 * @example
 * // Show info toast
 * const { showToast } = useUiStore();
 * showToast('Autosave enabled', 'info');
 *
 * @component
 * @returns {React.JSX.Element | null} Toast notification or null if no active toast
 */

import { useEffect } from 'react';

import { useUiStore } from '../store/uiStore';

/**
 * Toast component displays notification messages
 */
function Toast(): React.JSX.Element | null {
  const { toast, clearToast } = useUiStore();

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        clearToast();
      }, 5000); // Auto-dismiss after 5 seconds

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [toast, clearToast]);

  if (!toast) {
    return null;
  }

  let bgColor = 'bg-blue-600';
  if (toast.type === 'error') {
    bgColor = 'bg-red-600';
  } else if (toast.type === 'success') {
    bgColor = 'bg-green-600';
  }

  let toastIcon = 'ℹ️';
  if (toast.type === 'error') {
    toastIcon = '⚠️';
  } else if (toast.type === 'success') {
    toastIcon = '✓';
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-slide-down">
      <div
        className={`${bgColor} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-[500px]`}
      >
        <span className="text-lg">{toastIcon}</span>
        <span className="flex-1">{toast.message}</span>
        <button
          onClick={clearToast}
          className="text-white/80 hover:text-white text-xl leading-none"
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default Toast;
