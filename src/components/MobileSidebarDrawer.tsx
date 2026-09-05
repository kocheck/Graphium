/**
 * MobileSidebarDrawer Component
 *
 * Slide-over drawer for mobile devices that contains the Sidebar content.
 * Slides in from the left edge with a backdrop overlay.
 *
 * Features:
 * - Smooth slide-in/out animation
 * - Semi-transparent backdrop
 * - Close on backdrop click
 * - 85% width on mobile (leaving edge visible for context)
 * - Proper focus management
 *
 * @param isOpen - Controls drawer visibility
 * @param onClose - Callback when drawer should close
 * @param children - Sidebar content to render inside drawer
 */

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

interface MobileSidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function MobileSidebarDrawer({
  isOpen,
  onClose,
  children,
}: MobileSidebarDrawerProps): JSX.Element | null {
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
        side="left"
        className="w-[85vw] max-w-xs p-0"
        ownsEscape={false}
        aria-label="Navigation menu"
        data-testid="sheet-mobile-sidebar-root"
      >
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}

export default MobileSidebarDrawer;
