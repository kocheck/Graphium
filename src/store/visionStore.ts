import { create } from 'zustand';

type VisionPolygon = Array<{ x: number; y: number }>;

interface VisionState {
  polygons: VisionPolygon[];
  hiddenTokenIds: Set<string>;
  setVision: (polygons: VisionPolygon[], hiddenTokenIds: Set<string>) => void;
}

const EMPTY_HIDDEN = new Set<string>();

/**
 * Isolated vision so Fog of War can hide NPCs without writing gameStore
 * and without every TokenNode subscribing to the full polygon array.
 */
export const useVisionStore = create<VisionState>((set) => ({
  polygons: [],
  hiddenTokenIds: EMPTY_HIDDEN,
  setVision: (polygons, hiddenTokenIds) => set({ polygons, hiddenTokenIds }),
}));
