/**
 * MobileBottomSheet Component
 *
 * Bottom sheet component for mobile devices that slides up from the bottom.
 * Used for the TokenInspector and other modal content on mobile.
 *
 * Features:
 * - Smooth slide-up animation
 * - Semi-transparent backdrop
 * - Drag handle for visual affordance
 * - Close on backdrop click
 * - Proper focus management
 * - Max height 70vh to avoid covering entire screen
 *
 * @param isOpen - Controls bottom sheet visibility
 * @param onClose - Callback when bottom sheet should close
 * @param children - Content to render inside bottom sheet
 */

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function MobileBottomSheet({
  isOpen,
  onClose,
  children,
}: MobileBottomSheetProps): JSX.Element | null {
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
        side="bottom"
        className="max-h-[70vh] rounded-t-lg p-0 overflow-y-auto bg-[var(--app-bg-surface)] border-t border-[var(--app-border-default)]"
        ownsEscape={false}
        aria-label="Bottom sheet"
        data-testid="sheet-mobile-bottom-root"
      >
        <SheetTitle className="sr-only">Bottom sheet</SheetTitle>
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 rounded-full bg-[var(--app-border-default)]" />
        </div>
        <div className="px-4 pb-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export default MobileBottomSheet;
