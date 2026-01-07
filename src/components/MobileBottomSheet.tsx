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
 * - Escape key to close
 * - Proper focus management
 * - Max height 70vh to avoid covering entire screen
 *
 * @param isOpen - Controls bottom sheet visibility
 * @param onClose - Callback when bottom sheet should close
 * @param children - Content to render inside bottom sheet
 */

import { useEffect, useRef } from 'react';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const MobileBottomSheet = ({ isOpen, onClose, children }: MobileBottomSheetProps) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Don't render anything if not open
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] rounded-t-xl shadow-xl transform transition-transform duration-300 ease-in-out overflow-y-auto"
        style={{
          backgroundColor: 'var(--app-bg-surface)',
          borderTopWidth: '1px',
          borderTopStyle: 'solid',
          borderTopColor: 'var(--app-border-default)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Bottom sheet"
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div
            className="w-12 h-1 rounded-full"
            style={{ backgroundColor: 'var(--app-border-default)' }}
          />
        </div>

        {/* Content */}
        <div className="px-4 pb-4">{children}</div>
      </div>
    </>
  );
};

export default MobileBottomSheet;
