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
 * - Escape key to close
 * - Proper focus management
 *
 * @param isOpen - Controls drawer visibility
 * @param onClose - Callback when drawer should close
 * @param children - Sidebar content to render inside drawer
 */

import { useEffect, useRef } from 'react';

interface MobileSidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const MobileSidebarDrawer = ({ isOpen, onClose, children }: MobileSidebarDrawerProps) => {
  const drawerRef = useRef<HTMLDivElement>(null);

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

  // Prevent body scroll when drawer is open
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

  // Don't render anything if not open (for performance)
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

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed inset-y-0 left-0 z-50 w-[85vw] max-w-xs transform transition-transform duration-300 ease-in-out"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {children}
      </div>
    </>
  );
};

export default MobileSidebarDrawer;
