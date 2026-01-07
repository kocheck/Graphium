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

import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export function useCommandPalette(): [boolean, (isOpen: boolean) => void] {
  const isOpen = useGameStore((state) => state.isCommandPaletteOpen);
  const setIsOpen = useGameStore((state) => state.setCommandPaletteOpen);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+P or Cmd+K (Mac) / Ctrl+P or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'p' || e.key === 'k')) {
        e.preventDefault(); // Prevent browser print dialog or other default actions
        setIsOpen(!isOpen); // Toggle palette
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setIsOpen]);

  return [isOpen, setIsOpen];
}
