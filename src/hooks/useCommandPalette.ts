/**
 * Command Palette Keyboard Shortcut Hook
 *
 * Provides global keyboard shortcut (Cmd+P / Ctrl+P) to toggle command palette.
 * Prevents default browser print dialog from opening.
 *
 * Platform detection:
 * - macOS: Cmd+P (metaKey)
 * - Windows/Linux: Ctrl+P (ctrlKey)
 *
 * @returns Tuple with [isOpen, setIsOpen] state and setter
 */

import { useState, useEffect } from 'react';

export function useCommandPalette(): [boolean, (isOpen: boolean) => void] {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+P (Mac) or Ctrl+P (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault(); // Prevent browser print dialog
        setIsOpen(prev => !prev); // Toggle palette
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return [isOpen, setIsOpen];
}
