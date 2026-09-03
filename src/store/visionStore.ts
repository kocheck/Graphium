import { create } from 'zustand';

type VisionPolygon = Array<{ x: number; y: number }>;

interface VisionState {
  polygons: VisionPolygon[];
  setPolygons: (polygons: VisionPolygon[]) => void;
}

/**
 * Isolated vision polygons so Fog of War can update token visibility
 * without writing back into gameStore (which re-renders CanvasManager).
 */
export const useVisionStore = create<VisionState>((set) => ({
  polygons: [],
  setPolygons: (polygons) => set({ polygons }),
}));
