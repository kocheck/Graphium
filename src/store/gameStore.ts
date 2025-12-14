import { create } from 'zustand';

export interface Token {
  id: string;
  x: number;
  y: number;
  src: string;
  scale: number;
}

export interface Drawing {
  id: string;
  tool: 'marker' | 'eraser';
  points: number[];
  color: string;
  size: number;
  scale?: number;
  x?: number;
  y?: number;
}

export interface MapConfig {
  src: string;
  x: number;
  y: number;
  scale: number;
}

export type GridType = 'LINES' | 'DOTS' | 'HIDDEN';

export interface GameState {
  tokens: Token[];
  drawings: Drawing[];
  gridSize: number;
  gridType: GridType;
  map: MapConfig | null;
  addToken: (token: Token) => void;
  updateTokenPosition: (id: string, x: number, y: number) => void;
  updateTokenTransform: (id: string, x: number, y: number, scale: number) => void;
  addDrawing: (drawing: Drawing) => void;
  updateDrawingTransform: (id: string, x: number, y: number, scale: number) => void;
  setGridSize: (size: number) => void;
  setState: (state: GameState) => void; // Generic set state
  setTokens: (tokens: Token[]) => void;
  setMap: (map: MapConfig | null) => void;
  updateMapPosition: (x: number, y: number) => void;
  updateMapScale: (scale: number) => void;
  isCalibrating: boolean;
  setIsCalibrating: (isCalibrating: boolean) => void;
  setGridType: (type: GridType) => void;
}

export const useGameStore = create<GameState>((set) => ({
  tokens: [],
  drawings: [],
  gridSize: 50,
  gridType: 'LINES',
  map: null,
  addToken: (token) => set((state) => ({ tokens: [...state.tokens, token] })),
  updateTokenPosition: (id, x, y) => set((state) => ({
    tokens: state.tokens.map((t) => t.id === id ? { ...t, x, y } : t)
  })),
  updateTokenTransform: (id, x, y, scale) => set((state) => ({
    tokens: state.tokens.map((t) => t.id === id ? { ...t, x, y, scale } : t)
  })),
  addDrawing: (drawing) => set((state) => ({ drawings: [...state.drawings, drawing] })),
  updateDrawingTransform: (id, x, y, scale) => set((state) => ({
    drawings: state.drawings.map((d) => d.id === id ? { ...d, x, y, scale } : d) // Wait, Drawing points are absolute?
    // Drawing interface doesn't have x, y. It has points[].
    // But Konva Group/Line can be transformed.
    // If we transform a Line, it gets x, y (offset) and scale.
    // So we should add x, y to Drawing interface too, or handle points?
    // The Transformer usually changes node.x/y/scale.
    // So we need x, y, scale in Drawing.
  })),
  setGridSize: (size) => set({ gridSize: size }),
  setTokens: (tokens) => set({ tokens }),
  setState: (state) => set(state),
  setMap: (map) => set({ map }),
  updateMapPosition: (x, y) => set((state) => ({
    map: state.map ? { ...state.map, x, y } : null
  })),
  updateMapScale: (scale) => set((state) => ({
    map: state.map ? { ...state.map, scale } : null
  })),
  isCalibrating: false,
  setIsCalibrating: (isCalibrating) => set({ isCalibrating }),
  setGridType: (type) => set({ gridType: type }),
}));
