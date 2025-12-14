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
  width: number;
  height: number;
  scale: number;
}

export type GridType = 'LINES' | 'DOTS' | 'HIDDEN';

export interface ToastMessage {
  message: string;
  type: 'error' | 'success' | 'info';
}

export interface GameState {
  tokens: Token[];
  drawings: Drawing[];
  gridSize: number;
  gridType: GridType;
  map: MapConfig | null;
  addToken: (token: Token) => void;
  removeToken: (id: string) => void; // Add default remove
  removeTokens: (ids: string[]) => void; // Batch remove
  updateTokenPosition: (id: string, x: number, y: number) => void;
  updateTokenTransform: (id: string, x: number, y: number, scale: number) => void;
  addDrawing: (drawing: Drawing) => void;
  removeDrawing: (id: string) => void; // Add default remove
  removeDrawings: (ids: string[]) => void; // Batch remove
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
  toast: ToastMessage | null;
  showToast: (message: string, type: 'error' | 'success' | 'info') => void;
  clearToast: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  tokens: [],
  drawings: [],
  gridSize: 50,
  gridType: 'LINES',
  map: null,
  addToken: (token) => set((state) => ({ tokens: [...state.tokens, token] })),
  removeToken: (id) => set((state) => ({ tokens: state.tokens.filter(t => t.id !== id) })),
  removeTokens: (ids) => set((state) => ({ tokens: state.tokens.filter(t => !ids.includes(t.id)) })),
  updateTokenPosition: (id, x, y) => set((state) => ({
    tokens: state.tokens.map((t) => t.id === id ? { ...t, x, y } : t)
  })),
  updateTokenTransform: (id, x, y, scale) => set((state) => ({
    tokens: state.tokens.map((t) => t.id === id ? { ...t, x, y, scale } : t)
  })),

  addDrawing: (drawing) => set((state) => ({ drawings: [...state.drawings, drawing] })),
  removeDrawing: (id) => set((state) => ({ drawings: state.drawings.filter(d => d.id !== id) })),
  removeDrawings: (ids) => set((state) => ({ drawings: state.drawings.filter(d => !ids.includes(d.id)) })),
  updateDrawingTransform: (id, x, y, scale) => set((state) => ({
    drawings: state.drawings.map((d) => d.id === id ? { ...d, x, y, scale } : d)
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
  toast: null,
  showToast: (message, type) => set({ toast: { message, type } }),
  clearToast: () => set({ toast: null }),
}));
