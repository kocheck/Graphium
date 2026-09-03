import { create } from 'zustand';

import type { GridCell } from '../types/grid';

export interface SnapPreview {
  id: string;
  x: number;
  y: number;
  size: number;
}

interface PointerOverlayState {
  hoveredCell: GridCell | null;
  doorPreviewPos: { x: number; y: number } | null;
  hoveredTokenId: string | null;
  snapPreviews: SnapPreview[];
  setHoveredCell: (cell: GridCell | null) => void;
  setDoorPreviewPos: (pos: { x: number; y: number } | null) => void;
  setHoveredTokenId: (id: string | null) => void;
  setSnapPreviews: (previews: SnapPreview[]) => void;
}

/**
 * Pointer-rate overlay state kept off CanvasManager so hover/door preview
 * do not reconcile tokens and drawings.
 */
export const usePointerOverlayStore = create<PointerOverlayState>((set) => ({
  hoveredCell: null,
  doorPreviewPos: null,
  hoveredTokenId: null,
  snapPreviews: [],
  setHoveredCell: (hoveredCell) => set({ hoveredCell }),
  setDoorPreviewPos: (doorPreviewPos) => set({ doorPreviewPos }),
  setHoveredTokenId: (hoveredTokenId) => set({ hoveredTokenId }),
  setSnapPreviews: (snapPreviews) => set({ snapPreviews }),
}));
