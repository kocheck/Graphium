import { useEffect } from 'react';

import {
  SessionConsolePackFields,
  SessionConsolePlaybackFields,
  SessionConsoleStageFields,
  SessionConsoleTableSetup,
} from './sessionConsoleSettingsSections';

interface SessionConsoleSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SessionConsoleSettingsSheet({
  isOpen,
  onClose,
}: SessionConsoleSettingsSheetProps): JSX.Element | null {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        data-esc-owns="true"
        data-testid="sheet-session-console-settings-root"
        className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-[var(--app-bg-surface)] shadow-2xl z-50 overflow-y-auto"
      >
        <div className="sticky top-0 bg-[var(--app-bg-surface)] border-b border-[var(--app-border-default)] p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Session Console settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-[var(--app-bg-subtle)] rounded transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-4 space-y-6">
          <SessionConsoleStageFields />
          <SessionConsolePlaybackFields />
          <SessionConsoleTableSetup />
          <SessionConsolePackFields />
        </div>
      </div>
    </>
  );
}
