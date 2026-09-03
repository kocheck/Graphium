import { create } from 'zustand';

import type { GridCell } from '../types/grid';

interface PointerOverlayState {
  hoveredCell: GridCell | null;
  doorPreviewPos: { x: number; y: number } | null;
  hoveredTokenId: string | null;
  setHoveredCell: (cell: GridCell | null) => void;
  setDoorPreviewPos: (pos: { x: number; y: number } | null) => void;
  setHoveredTokenId: (id: string | null) => void;
}

/**
 * Pointer-rate overlay state kept off CanvasManager so hover/door preview
 * do not reconcile tokens and drawings.
 */
export const usePointerOverlayStore = create<PointerOverlayState>((set) => ({
  hoveredCell: null,
  doorPreviewPos: null,
  hoveredTokenId: null,
  setHoveredCell: (hoveredCell) => set({ hoveredCell }),
  setDoorPreviewPos: (doorPreviewPos) => set({ doorPreviewPos }),
  setHoveredTokenId: (hoveredTokenId) => set({ hoveredTokenId }),
}));
