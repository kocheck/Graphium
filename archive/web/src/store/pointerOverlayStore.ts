import { create } from 'zustand';

import type { GridCell } from '../types/grid';

export interface SnapPreview {
  id: string;
  x: number;
  y: number;
  size: number;
}

interface LiveTokenPosition {
  x: number;
  y: number;
}

const EMPTY_LIVE_POSITIONS: ReadonlyMap<string, LiveTokenPosition> = new Map();

interface PointerOverlayState {
  hoveredCell: GridCell | null;
  doorPreviewPos: { x: number; y: number } | null;
  hoveredTokenId: string | null;
  snapPreviews: SnapPreview[];
  livePositions: ReadonlyMap<string, LiveTokenPosition>;
  setHoveredCell: (cell: GridCell | null) => void;
  setDoorPreviewPos: (pos: { x: number; y: number } | null) => void;
  setHoveredTokenId: (id: string | null) => void;
  setSnapPreviews: (previews: SnapPreview[]) => void;
  setLivePositions: (positions: Array<{ id: string; x: number; y: number }>) => void;
  clearLivePositions: () => void;
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
  livePositions: EMPTY_LIVE_POSITIONS,
  setHoveredCell: (hoveredCell) => set({ hoveredCell }),
  setDoorPreviewPos: (doorPreviewPos) => set({ doorPreviewPos }),
  setHoveredTokenId: (hoveredTokenId) => set({ hoveredTokenId }),
  setSnapPreviews: (snapPreviews) => set({ snapPreviews }),
  setLivePositions: (positions) =>
    set({
      livePositions: new Map(positions.map((pos) => [pos.id, { x: pos.x, y: pos.y }])),
    }),
  clearLivePositions: () => set({ livePositions: EMPTY_LIVE_POSITIONS }),
}));
