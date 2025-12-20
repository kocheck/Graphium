import { create } from 'zustand';

/**
 * Token represents a character, creature, or object on the battlemap
 * ... (same documentation as before)
 */
export interface Token {
  id: string;
  x: number;
  y: number;
  src: string;
  scale: number;
  type?: 'PC' | 'NPC';
  visionRadius?: number;
  name?: string;
}

/**
 * Drawing represents a freehand stroke drawn with marker, eraser, or wall tool
 * ... (same documentation as before)
 */
export interface Drawing {
  id: string;
  tool: 'marker' | 'eraser' | 'wall';
  points: number[];
  color: string;
  size: number;
  scale?: number;
  x?: number;
  y?: number;
}

/**
 * MapConfig represents the background map image configuration
 * ... (same documentation as before)
 */
export interface MapConfig {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

/**
 * GridType determines how the tactical grid is displayed
 */
export type GridType = 'LINES' | 'DOTS' | 'HIDDEN';

/**
 * MapData represents the persistent state of a single map within a campaign
 */
export interface MapData {
  id: string;
  name: string;
  tokens: Token[];
  drawings: Drawing[];
  map: MapConfig | null;
  gridSize: number;
  gridType: GridType;
  exploredRegions: ExploredRegion[];
  isDaylightMode: boolean;
}

/**
 * TokenLibraryItem represents a reusable token template in the campaign library
 */
export interface TokenLibraryItem {
  id: string;
  name: string;
  src: string;
  defaultScale: number;
  defaultVisionRadius?: number;
  defaultType?: 'PC' | 'NPC';
}

/**
 * Campaign represents a collection of maps and shared assets
 */
export interface Campaign {
  id: string;
  name: string;
  maps: Record<string, MapData>;
  activeMapId: string;
  tokenLibrary: TokenLibraryItem[];
}

/**
 * ToastMessage represents a temporary notification
 */
export interface ToastMessage {
  message: string;
  type: 'error' | 'success' | 'info';
}

/**
 * ExploredRegion represents an area that PC tokens have previously seen
 */
export interface ExploredRegion {
  points: Array<{ x: number; y: number }>;
  timestamp: number;
}

/**
 * Maximum number of explored regions to store in memory.
 */
const MAX_EXPLORED_REGIONS = 200;

/**
 * Helper to create a default empty map
 */
const createDefaultMap = (name: string = 'New Map'): MapData => ({
  id: crypto.randomUUID(),
  name,
  tokens: [],
  drawings: [],
  map: null,
  gridSize: 50,
  gridType: 'LINES',
  exploredRegions: [],
  isDaylightMode: false,
});

/**
 * Helper to create a default campaign
 */
const createDefaultCampaign = (firstMap?: MapData): Campaign => {
  const map = firstMap || createDefaultMap('Default Map');
  return {
    id: crypto.randomUUID(),
    name: 'New Campaign',
    maps: { [map.id]: map },
    activeMapId: map.id,
    tokenLibrary: [],
  };
};

/**
 * GameState is the central state interface for Hyle
 *
 * It now implements a Hybrid pattern:
 * 1. Top-level properties (tokens, drawings, etc.) represent the ACTIVE MAP state.
 *    This ensures backward compatibility with all components.
 * 2. `campaign` property holds the full persistence data for all maps.
 * 3. Switching maps involves syncing Top-level -> Campaign, then Campaign -> Top-level.
 */
export interface GameState {
  // --- Active Map State (Proxied for Component Compatibility) ---
  tokens: Token[];
  drawings: Drawing[];
  gridSize: number;
  gridType: GridType;
  map: MapConfig | null;
  exploredRegions: ExploredRegion[];
  isDaylightMode: boolean;

  // --- UI/System State (Not persisted in MapData) ---
  isCalibrating: boolean;
  toast: ToastMessage | null;
  showResourceMonitor: boolean;

  // --- Campaign State ---
  campaign: Campaign;

  // --- Actions ---

  // Campaign Actions
  loadCampaign: (campaign: Campaign) => void;
  addMap: (name?: string) => void;
  deleteMap: (mapId: string) => void;
  switchMap: (mapId: string) => void;
  renameMap: (mapId: string, newName: string) => void;

  // Campaign Library Actions
  addTokenToLibrary: (item: TokenLibraryItem) => void;
  removeTokenFromLibrary: (id: string) => void;
  updateLibraryToken: (id: string, updates: Partial<TokenLibraryItem>) => void;

  // Helper to sync active state back to campaign (call before save)
  syncActiveMapToCampaign: () => void;

  // Token Actions
  addToken: (token: Token) => void;
  removeToken: (id: string) => void;
  removeTokens: (ids: string[]) => void;
  updateTokenPosition: (id: string, x: number, y: number) => void;
  updateTokenTransform: (id: string, x: number, y: number, scale: number) => void;
  updateTokenProperties: (id: string, properties: Partial<Pick<Token, 'type' | 'visionRadius' | 'name'>>) => void;

  // Drawing Actions
  addDrawing: (drawing: Drawing) => void;
  removeDrawing: (id: string) => void;
  removeDrawings: (ids: string[]) => void;
  updateDrawingTransform: (id: string, x: number, y: number, scale: number) => void;

  // Map/Grid Attributes Actions
  setGridSize: (size: number) => void;
  setGridType: (type: GridType) => void;
  setMap: (map: MapConfig | null) => void;
  updateMapPosition: (x: number, y: number) => void;
  updateMapScale: (scale: number) => void;
  updateMapTransform: (scale: number, x: number, y: number) => void;

  // Exploration Actions
  addExploredRegion: (region: ExploredRegion) => void;
  clearExploredRegions: () => void;

  // System Actions
  setIsCalibrating: (isCalibrating: boolean) => void;
  setDaylightMode: (enabled: boolean) => void;
  setState: (state: Partial<GameState>) => void; // Legacy support
  setTokens: (tokens: Token[]) => void;
  showToast: (message: string, type: 'error' | 'success' | 'info') => void;
  clearToast: () => void;
  setShowResourceMonitor: (show: boolean) => void;
}

export const useGameStore = create<GameState>((set, get) => {
  // Initialize with a default campaign
  const initialMap = createDefaultMap('Map 1');
  const initialCampaign = createDefaultCampaign(initialMap);

  return {
    // --- Initial State (Active Map) ---
    tokens: initialMap.tokens,
    drawings: initialMap.drawings,
    gridSize: initialMap.gridSize,
    gridType: initialMap.gridType,
    map: initialMap.map,
    exploredRegions: initialMap.exploredRegions,
    isDaylightMode: initialMap.isDaylightMode,

    // --- Initial State (System) ---
    isCalibrating: false,
    toast: null,
    showResourceMonitor: false,
    campaign: initialCampaign,

    // --- Campaign Actions ---

    loadCampaign: (campaign: Campaign) => {
      // Validate campaign structure
      if (!campaign.maps || !campaign.activeMapId || !campaign.maps[campaign.activeMapId]) {
        console.error('Invalid campaign structure loaded', campaign);
        return;
      }

      const activeMap = campaign.maps[campaign.activeMapId];
      set({
        campaign,
        // Hydrate active map state
        tokens: activeMap.tokens || [],
        drawings: activeMap.drawings || [],
        gridSize: activeMap.gridSize || 50,
        gridType: activeMap.gridType || 'LINES',
        map: activeMap.map || null,
        exploredRegions: activeMap.exploredRegions || [],
        isDaylightMode: activeMap.isDaylightMode || false,
      });
    },

    addTokenToLibrary: (item: TokenLibraryItem) => set((state) => ({
      campaign: {
        ...state.campaign,
        tokenLibrary: [...(state.campaign.tokenLibrary || []), item]
      }
    })),

    removeTokenFromLibrary: (id: string) => set((state) => ({
      campaign: {
        ...state.campaign,
        tokenLibrary: (state.campaign.tokenLibrary || []).filter(item => item.id !== id)
      }
    })),

    updateLibraryToken: (id: string, updates: Partial<TokenLibraryItem>) => set((state) => ({
      campaign: {
        ...state.campaign,
        tokenLibrary: (state.campaign.tokenLibrary || []).map(item =>
          item.id === id ? { ...item, ...updates } : item
        )
      }
    })),

    syncActiveMapToCampaign: () => {
      const state = get();
      const activeId = state.campaign.activeMapId;

      // Create updated map object
      const updatedMap: MapData = {
        ...state.campaign.maps[activeId], // Preserve name/id
        tokens: state.tokens,
        drawings: state.drawings,
        map: state.map,
        gridSize: state.gridSize,
        gridType: state.gridType,
        exploredRegions: state.exploredRegions,
        isDaylightMode: state.isDaylightMode,
      };

      set((state) => ({
        campaign: {
          ...state.campaign,
          maps: {
            ...state.campaign.maps,
            [activeId]: updatedMap,
          },
        }
      }));
    },

    addMap: (name = 'New Map') => {
      // First sync current map
      get().syncActiveMapToCampaign();

      const newMap = createDefaultMap(name);

      set((state) => ({
        campaign: {
          ...state.campaign,
          maps: {
            ...state.campaign.maps,
            [newMap.id]: newMap
          },
          activeMapId: newMap.id
        },
        // Switch to new map immediately
        tokens: newMap.tokens,
        drawings: newMap.drawings,
        map: newMap.map,
        gridSize: newMap.gridSize,
        gridType: newMap.gridType,
        exploredRegions: newMap.exploredRegions,
        isDaylightMode: newMap.isDaylightMode,
      }));
    },

    deleteMap: (mapId: string) => {
      const state = get();
      const { maps, activeMapId } = state.campaign;

      // Prevent deleting the last map
      if (Object.keys(maps).length <= 1) {
        get().showToast('Cannot delete the only map', 'error');
        return;
      }

      // If deleting active map, switch first
      let nextActiveId = activeMapId;
      if (mapId === activeMapId) {
        const mapIds = Object.keys(maps);
        const currentIndex = mapIds.indexOf(mapId);
        // Try next, or prev
        nextActiveId = mapIds[currentIndex + 1] || mapIds[currentIndex - 1];
        get().switchMap(nextActiveId);
      }

      // Now delete from store (need to fetch fresh state after switchMap)
      set((currentState) => {
        const { [mapId]: deleted, ...remainingMaps } = currentState.campaign.maps;
        return {
          campaign: {
            ...currentState.campaign,
            maps: remainingMaps,
          }
        };
      });
    },

    switchMap: (mapId: string) => {
      const state = get();
      if (state.campaign.activeMapId === mapId) return;
      if (!state.campaign.maps[mapId]) return;

      // 1. Sync current state to campaign
      get().syncActiveMapToCampaign();

      // 2. Load new map state
      // We must get FRESH state because syncActiveMapToCampaign updated it
      const freshState = get();
      const newMap = freshState.campaign.maps[mapId];

      set({
        campaign: {
          ...freshState.campaign,
          activeMapId: mapId,
        },
        // Hydrate active map state
        tokens: newMap.tokens || [],
        drawings: newMap.drawings || [],
        gridSize: newMap.gridSize,
        gridType: newMap.gridType,
        map: newMap.map,
        exploredRegions: newMap.exploredRegions || [],
        isDaylightMode: newMap.isDaylightMode,
      });
    },

    renameMap: (mapId: string, newName: string) => {
      set((state) => ({
        campaign: {
          ...state.campaign,
          maps: {
            ...state.campaign.maps,
            [mapId]: {
              ...state.campaign.maps[mapId],
              name: newName
            }
          }
        }
      }));
    },

    // --- Token Actions (Modifies Active State) ---
    addToken: (token: Token) => set((state) => ({ tokens: [...state.tokens, token] })),
    removeToken: (id: string) => set((state) => ({ tokens: state.tokens.filter(t => t.id !== id) })),
    removeTokens: (ids: string[]) => set((state) => ({ tokens: state.tokens.filter(t => !ids.includes(t.id)) })),
    updateTokenPosition: (id: string, x: number, y: number) => set((state) => ({
      tokens: state.tokens.map(t => t.id === id ? { ...t, x, y } : t)
    })),
    updateTokenTransform: (id: string, x: number, y: number, scale: number) => set((state) => ({
      tokens: state.tokens.map(t => t.id === id ? { ...t, x, y, scale } : t)
    })),
    updateTokenProperties: (id: string, properties: Partial<Pick<Token, 'type' | 'visionRadius' | 'name'>>) => set((state) => ({
      tokens: state.tokens.map(t => t.id === id ? { ...t, ...properties } : t)
    })),

    // --- Drawing Actions ---
    addDrawing: (drawing: Drawing) => set((state) => ({ drawings: [...state.drawings, drawing] })),
    removeDrawing: (id: string) => set((state) => ({ drawings: state.drawings.filter(d => d.id !== id) })),
    removeDrawings: (ids: string[]) => set((state) => ({ drawings: state.drawings.filter(d => !ids.includes(d.id)) })),
    updateDrawingTransform: (id: string, x: number, y: number, scale: number) => set((state) => ({
      drawings: state.drawings.map(d => d.id === id ? { ...d, x, y, scale } : d)
    })),

    // --- Grid/Map Actions ---
    setGridSize: (size: number) => set({ gridSize: size }),
    setGridType: (type: GridType) => set({ gridType: type }),
    setMap: (map: MapConfig | null) => set({ map }),
    updateMapPosition: (x: number, y: number) => set((state) => ({
      map: state.map ? { ...state.map, x, y } : null
    })),
    updateMapScale: (scale: number) => set((state) => ({
      map: state.map ? { ...state.map, scale } : null
    })),
    updateMapTransform: (scale: number, x: number, y: number) => set((state) => ({
      map: state.map ? { ...state.map, scale, x, y } : null
    })),

    // --- Utility Actions ---
    setIsCalibrating: (isCalibrating: boolean) => set({ isCalibrating }),
    addExploredRegion: (region: ExploredRegion) => set((state) => {
      const newRegions = [...state.exploredRegions, region];
      if (newRegions.length > MAX_EXPLORED_REGIONS) {
        return { exploredRegions: newRegions.slice(-MAX_EXPLORED_REGIONS) };
      }
      return { exploredRegions: newRegions };
    }),
    clearExploredRegions: () => set({ exploredRegions: [] }),
    setDaylightMode: (enabled: boolean) => set({ isDaylightMode: enabled }),
    setTokens: (tokens: Token[]) => set({ tokens }),
    setState: (state: Partial<GameState>) => set(state),
    showToast: (message: string, type: 'error' | 'success' | 'info') => set({ toast: { message, type } }),
    clearToast: () => set({ toast: null }),
    setShowResourceMonitor: (show: boolean) => set({ showResourceMonitor: show }),
  };
});
