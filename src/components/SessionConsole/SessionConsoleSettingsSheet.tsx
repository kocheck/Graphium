import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

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
  if (!isOpen) {
    return null;
  }

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:w-96 sm:max-w-none p-0 overflow-y-auto"
        data-testid="sheet-session-console-settings-root"
      >
        <SheetHeader className="sticky top-0 bg-[var(--app-bg-surface)] border-b border-[var(--app-border-default)] p-4">
          <SheetTitle className="text-lg font-bold">Session Console settings</SheetTitle>
        </SheetHeader>
        <div className="p-4 space-y-6">
          <SessionConsoleStageFields />
          <SessionConsolePlaybackFields />
          <SessionConsoleTableSetup />
          <SessionConsolePackFields />
        </div>
      </SheetContent>
    </Sheet>
  );
}
