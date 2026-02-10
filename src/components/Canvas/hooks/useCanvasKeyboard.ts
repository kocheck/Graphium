import { useState, useEffect } from 'react';

import type { GridType } from '../../../types/domain';
import type { Measurement } from '../../../types/measurement';

interface UseCanvasKeyboardProps {
  isWorldView: boolean;
  selectedIds: string[];
  activeMeasurement: Measurement | null;
  removeTokens: (ids: string[]) => void;
  removeDrawings: (ids: string[]) => void;
  removeDoors: (ids: string[]) => void;
  handleKeyboardZoom: (zoomIn: boolean) => void;
  setActiveMeasurement: (m: Measurement | null) => void;
  setGridType: (type: GridType) => void;
  setSelectedIds: (ids: string[]) => void;
  showToast: (message: string, type: 'error' | 'success' | 'info') => void;
}

/**
 * Handles keyboard events for canvas operations.
 *
 * Manages modifier key state (Alt for duplication, M for movement range,
 * Space for pan mode) and dispatches keyboard shortcuts:
 * - Delete/Backspace: Remove selected items (Architect View only)
 * - Escape: Clear active measurement
 * - Space: Toggle pan mode
 * - +/-: Zoom in/out
 * - M: Show movement range overlay
 * - 1-5: Change grid type (Architect View only)
 *
 * @returns Modifier key states consumed by CanvasManager for visual feedback
 */
export function useCanvasKeyboard({
  isWorldView,
  selectedIds,
  activeMeasurement,
  removeTokens,
  removeDrawings,
  removeDoors,
  handleKeyboardZoom,
  setActiveMeasurement,
  setGridType,
  setSelectedIds,
  showToast,
}: UseCanvasKeyboardProps) {
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isMKeyPressed, setIsMKeyPressed] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  useEffect(() => {
    const isEditableElement = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) {
        return false;
      }
      const tag = el.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || el.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Track Alt Key (always track, even in inputs, for drag operations)
      // Disabled in World View to prevent duplication
      if (e.key === 'Alt' && !isWorldView) {
        setIsAltPressed(true);
      }

      // Ignore other operations if typing in an input
      if (isEditableElement(e.target)) {
        return;
      }

      // Delete/Backspace - remove selected items
      // BLOCKED in World View (players cannot delete tokens/drawings)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isWorldView) {
          return;
        }
        if (selectedIds.length > 0) {
          removeTokens(selectedIds);
          removeDrawings(selectedIds);
          removeDoors(selectedIds);
          setSelectedIds([]);
        }
      }

      // Escape - clear active measurement
      if (e.key === 'Escape') {
        if (isWorldView) {
          return;
        }
        if (activeMeasurement) {
          setActiveMeasurement(null);
        }
      }

      // Space - enable pan mode
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }

      // Zoom in with + or =
      if ((e.code === 'Equal' || e.code === 'NumpadAdd') && !e.repeat) {
        e.preventDefault();
        handleKeyboardZoom(true);
      }

      // Zoom out with -
      if ((e.code === 'Minus' || e.code === 'NumpadSubtract') && !e.repeat) {
        e.preventDefault();
        handleKeyboardZoom(false);
      }

      // M key - show movement range overlay
      if ((e.key === 'm' || e.key === 'M') && !e.repeat && !isEditableElement(e.target)) {
        e.preventDefault();
        setIsMKeyPressed(true);
      }

      // Grid type shortcuts (DM only) - 1-5 keys
      if (!isWorldView && !e.repeat && !isEditableElement(e.target)) {
        if (e.key === '1') {
          e.preventDefault();
          setGridType('LINES');
          showToast('Grid: Square - Lines', 'success');
        } else if (e.key === '2') {
          e.preventDefault();
          setGridType('DOTS');
          showToast('Grid: Square - Dots', 'success');
        } else if (e.key === '3') {
          e.preventDefault();
          setGridType('HEXAGONAL');
          showToast('Grid: Hexagonal', 'success');
        } else if (e.key === '4') {
          e.preventDefault();
          setGridType('ISOMETRIC');
          showToast('Grid: Isometric', 'success');
        } else if (e.key === '5') {
          e.preventDefault();
          setGridType('HIDDEN');
          showToast('Grid: Hidden', 'success');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Always track Alt key release
      if (e.key === 'Alt') {
        setIsAltPressed(false);
      }

      // Space key release
      if (!isEditableElement(e.target) && e.code === 'Space') {
        setIsSpacePressed(false);
      }

      // M key release
      if (!isEditableElement(e.target) && (e.key === 'm' || e.key === 'M')) {
        setIsMKeyPressed(false);
      }
    };

    const handleBlur = () => {
      setIsSpacePressed(false);
      setIsAltPressed(false);
      setIsMKeyPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [
    selectedIds,
    removeTokens,
    removeDrawings,
    removeDoors,
    handleKeyboardZoom,
    activeMeasurement,
    isWorldView,
    setActiveMeasurement,
    setGridType,
    showToast,
    setSelectedIds,
  ]);

  return { isAltPressed, isMKeyPressed, isSpacePressed };
}
