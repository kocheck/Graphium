import { create } from 'zustand';
import { rollForMessage } from '../utils/systemMessages';
import { Measurement } from '../types/measurement';

/**
 * TokenMetadata represents the shared metadata properties between library items and map tokens
 * This interface defines the properties that can be inherited from prototypes (library items)
 * or overridden on instances (map tokens).
 */
export interface TokenMetadata {
  name?: string;
  type?: 'PC' | 'NPC';
  visionRadius?: number;
  scale?: number;
}

/**
 * Token represents a character, creature, or object on the battlemap (Instance)
 *
 * Implements a Prototype/Instance pattern:
 * - If libraryItemId is set, this token references a library item as its prototype
 * - Properties like name, type, visionRadius, scale act as OVERRIDES when present
 * - If a property is undefined, it should fall back to the library item's default value
 * - Position (x, y) and src are always instance-specific
 *
 * @property libraryItemId - Optional reference to a TokenLibraryItem (prototype)
 * @property x - Position X in world coordinates (instance-specific)
 * @property y - Position Y in world coordinates (instance-specific)
 * @property src - Image file:// URL (instance-specific or inherited)
 * @property scale - Size multiplier override (falls back to library defaultScale)
 * @property type - Token type override (falls back to library defaultType)
 * @property visionRadius - Vision radius override (falls back to library defaultVisionRadius)
 * @property name - Name override (falls back to library name)
 */
export interface Token {
  id: string;
  x: number;
  y: number;
  src: string;
  libraryItemId?: string; // Reference to library item prototype
  scale?: number; // Override for library defaultScale
  type?: 'PC' | 'NPC'; // Override for library defaultType
  visionRadius?: number; // Override for library defaultVisionRadius
  name?: string; // Override for library name
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
  doors: Door[];
  stairs: Stairs[];
  map: MapConfig | null;
  gridSize: number;
  gridType: GridType;
  exploredRegions: ExploredRegion[];
  isDaylightMode: boolean;
}

/**
 * TokenLibraryItem represents a reusable token in the persistent library
 *
 * The library persists across campaigns and sessions, allowing users to
 * build a collection of frequently-used tokens (monsters, NPCs, props).
 *
 * **Storage:**
 * - Full-size images: userData/library/assets/{id}.webp
 * - Thumbnails: userData/library/assets/thumb-{id}.webp
 * - Metadata index: userData/library/index.json
 */
export interface TokenLibraryItem {
  id: string;
  name: string;
  src: string; // file:// URL to full-size image
  thumbnailSrc: string; // file:// URL to 128x128 thumbnail
  category: string; // e.g., "Monsters", "NPCs", "Props", "Custom"
  tags: string[]; // For fuzzy search (e.g., ["dragon", "red", "large"])
  dateAdded: number; // Timestamp (Date.now())
  defaultScale?: number; // Optional default scale when placed
  defaultVisionRadius?: number; // Optional default vision radius
  defaultType?: 'PC' | 'NPC'; // Optional default token type
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
 * ConfirmDialog represents a confirmation dialog state
 */
export interface ConfirmDialog {
  message: string;
  onConfirm: () => void;
  confirmText?: string;
}

/**
 * ExploredRegion represents an area that PC tokens have previously seen
 */
export interface ExploredRegion {
  points: Array<{ x: number; y: number }>;
  timestamp: number;
}

/**
 * Door represents an interactive door object in the dungeon
 *
 * Doors are rendered as white rectangles with black outlines (standard tabletop symbol).
 * When open, they display a swing arc to show the door's position.
 * Closed doors block Fog of War vision, while open doors allow vision through.
 *
 * @property id - Unique identifier
 * @property x - Center position X in world coordinates
 * @property y - Center position Y in world coordinates
 * @property orientation - Door alignment ('horizontal' = east-west wall, 'vertical' = north-south wall)
 * @property isOpen - Current state (true = open, false = closed)
 * @property isLocked - Whether door requires unlocking (shows lock icon)
 * @property size - Door width/height in pixels (typically gridSize)
 * @property thickness - Visual thickness for rendering (default: 12px for better visibility)
 * @property swingDirection - Which way door opens: 'left', 'right', 'up', 'down' (for swing arc)
 */
export interface Door {
  id: string;
  x: number;
  y: number;
  orientation: 'horizontal' | 'vertical';
  isOpen: boolean;
  isLocked: boolean;
  size: number;
  thickness?: number;
  swingDirection?: 'left' | 'right' | 'up' | 'down';
}

/**
 * Stairs represents a staircase connecting different levels in a dungeon
 *
 * Stairs are rendered with a stepped pattern and directional arrows.
 * They provide visual indication of level transitions in multi-floor dungeons.
 *
 * @property id - Unique identifier
 * @property x - Center position X in world coordinates
 * @property y - Center position Y in world coordinates
 * @property direction - Which compass direction the stairs face ('north', 'south', 'east', 'west')
 * @property type - Whether stairs go up or down ('up' or 'down')
 * @property width - Width in pixels (typically 2 * gridSize for 2-cell width)
 * @property height - Height in pixels (typically 2 * gridSize for 2-cell height)
 */
export interface Stairs {
  id: string;
  x: number;
  y: number;
  direction: 'north' | 'south' | 'east' | 'west';
  type: 'up' | 'down';
  width: number;
  height: number;
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
  doors: [],
  stairs: [],
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
  doors: Door[];
  stairs: Stairs[];
  gridSize: number;
  gridType: GridType;
  map: MapConfig | null;
  exploredRegions: ExploredRegion[];
  isDaylightMode: boolean;

  // --- UI/System State (Not persisted in MapData) ---
  isCalibrating: boolean;
  toast: ToastMessage | null;
  confirmDialog: ConfirmDialog | null;
  showResourceMonitor: boolean;
  dungeonDialog: boolean;
  isGamePaused: boolean;
  isMobileSidebarOpen: boolean;

  // --- Vision State (Computed, not persisted) ---
  /** Active vision polygons for current PC tokens (used for token visibility) */
  activeVisionPolygons: Array<Array<{ x: number; y: number }>>;

  // --- Measurement State (Temporary, not persisted) ---
  activeMeasurement: Measurement | null;
  broadcastMeasurement: boolean;
  dmMeasurement: Measurement | null; // For World View to display DM's measurement

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

  // Door Actions
  addDoor: (door: Door) => void;
  removeDoor: (id: string) => void;
  removeDoors: (ids: string[]) => void;
  toggleDoor: (id: string) => void;
  updateDoorState: (id: string, isOpen: boolean) => void;
  updateDoorLock: (id: string, isLocked: boolean) => void;
  /** Updates all unlocked doors to the specified state (locked doors are skipped) */
  updateAllDoorStates: (isOpen: boolean) => void;
  /** Updates all doors to the specified lock state */
  updateAllDoorLocks: (isLocked: boolean) => void;

  // Stairs Actions
  addStairs: (stairs: Stairs) => void;
  removeStairs: (id: string) => void;
  removeMultipleStairs: (ids: string[]) => void;

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

  // Vision Actions
  setActiveVisionPolygons: (polygons: Array<Array<{ x: number; y: number }>>) => void;

  // System Actions
  setIsCalibrating: (isCalibrating: boolean) => void;
  setDaylightMode: (enabled: boolean) => void;
  setState: (state: Partial<GameState>) => void; // Legacy support
  setTokens: (tokens: Token[]) => void;
  showToast: (message: string, type: 'error' | 'success' | 'info') => void;
  clearToast: () => void;
  showConfirmDialog: (message: string, onConfirm: () => void, confirmText?: string) => void;
  clearConfirmDialog: () => void;
  setShowResourceMonitor: (show: boolean) => void;
  showDungeonDialog: () => void;
  clearDungeonDialog: () => void;
  setIsGamePaused: (isPaused: boolean) => void;
  setMobileSidebarOpen: (isOpen: boolean) => void;

  // Measurement Actions
  setActiveMeasurement: (measurement: Measurement | null) => void;
  setBroadcastMeasurement: (broadcast: boolean) => void;
  setDmMeasurement: (measurement: Measurement | null) => void;
}

export const useGameStore = create<GameState>((set, get) => {
  // Initialize with a default campaign
  const initialMap = createDefaultMap('Map 1');
  const initialCampaign = createDefaultCampaign(initialMap);

  return {
    // --- Initial State (Active Map) ---
    tokens: initialMap.tokens,
    drawings: initialMap.drawings,
    doors: initialMap.doors,
    stairs: initialMap.stairs,
    gridSize: initialMap.gridSize,
    gridType: initialMap.gridType,
    map: initialMap.map,
    exploredRegions: initialMap.exploredRegions,
    isDaylightMode: initialMap.isDaylightMode,

    // --- Initial State (System) ---
    isCalibrating: false,
    toast: null,
    confirmDialog: null,
    showResourceMonitor: false,
    dungeonDialog: false,
    isGamePaused: false,
    isMobileSidebarOpen: false,
    activeVisionPolygons: [],

    // --- Initial State (Measurement) ---
    activeMeasurement: null,
    broadcastMeasurement: false,
    dmMeasurement: null,

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
        doors: activeMap.doors || [],
        stairs: activeMap.stairs || [],
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
        doors: state.doors,
        stairs: state.stairs,
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
        doors: newMap.doors,
        stairs: newMap.stairs,
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
        get().showToast(rollForMessage('CANNOT_DELETE_ONLY_MAP'), 'error');
        return;
      }

      // If deleting active map, switch first without syncing the map being deleted
      if (mapId === activeMapId) {
        const mapIds = Object.keys(maps);
        const currentIndex = mapIds.indexOf(mapId);
        // Try next, or prev
        const nextActiveId = mapIds[currentIndex + 1] || mapIds[currentIndex - 1];

        // Directly switch active map without calling switchMap to avoid syncing the deleted map
        set((currentState) => {
          const nextMap = currentState.campaign.maps[nextActiveId];
          if (!nextMap) {
            // If for some reason the next map cannot be found, leave state unchanged
            return currentState;
          }

          return {
            ...currentState,
            campaign: {
              ...currentState.campaign,
              activeMapId: nextActiveId,
            },
            tokens: nextMap.tokens,
            drawings: nextMap.drawings,
            doors: nextMap.doors || [],
            stairs: nextMap.stairs || [],
            map: nextMap.map,
            gridSize: nextMap.gridSize,
            gridType: nextMap.gridType,
            exploredRegions: nextMap.exploredRegions,
            isDaylightMode: nextMap.isDaylightMode,
          };
        });
      }

      // Now delete from store (need to fetch fresh state after potential switch)
      set((currentState) => {
        const remainingMaps = Object.fromEntries(
          Object.entries(currentState.campaign.maps).filter(([id]) => id !== mapId)
        );
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
        doors: newMap.doors || [],
        stairs: newMap.stairs || [],
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

    // --- Door Actions ---
    addDoor: (door: Door) => set((state) => {
      // Prevent duplicates - only add if door doesn't already exist
      const exists = state.doors.some(d => d.id === door.id);
      if (exists) {
        return state; // Silent deduplication
      }
      return { doors: [...state.doors, door] };
    }),
    removeDoor: (id: string) => set((state) => ({ doors: state.doors.filter(d => d.id !== id) })),
    removeDoors: (ids: string[]) => set((state) => ({ doors: state.doors.filter(d => !ids.includes(d.id)) })),
    toggleDoor: (id: string) => set((state) => {
      const door = state.doors.find(d => d.id === id);
      if (!door) return state; // Door not found, no change
      
      const newDoors = state.doors.map(d => 
        d.id === id ? { ...d, isOpen: !d.isOpen } : d
      );

      // DIRECT SYNC: Send DOOR_TOGGLE immediately (bypasses subscription/throttle)
      // This ensures door toggles always sync, even if the subscription system has issues
      if (typeof window !== 'undefined') {
        // @ts-expect-error - window.hyleSync is injected by SyncManager
        const hyleSync = window.hyleSync;
        if (hyleSync && typeof hyleSync === 'function') {
          hyleSync({ type: 'DOOR_TOGGLE', payload: { id } });
        }
      }

      return { doors: newDoors };
    }),
    updateDoorState: (id: string, isOpen: boolean) => set((state) => ({
      doors: state.doors.map(d => d.id === id ? { ...d, isOpen } : d)
    })),
    updateDoorLock: (id: string, isLocked: boolean) => set((state) => ({
      doors: state.doors.map(d => d.id === id ? { ...d, isLocked } : d)
    })),
    updateAllDoorStates: (isOpen: boolean) => set((state) => ({
      doors: state.doors.map(d => d.isLocked ? d : { ...d, isOpen })
    })),
    updateAllDoorLocks: (isLocked: boolean) => set((state) => ({
      doors: state.doors.map(d => ({ ...d, isLocked }))
    })),

    // --- Stairs Actions ---
    addStairs: (stairs: Stairs) => set((state) => ({ stairs: [...state.stairs, stairs] })),
    removeStairs: (id: string) => set((state) => ({ stairs: state.stairs.filter(s => s.id !== id) })),
    removeMultipleStairs: (ids: string[]) => set((state) => ({ stairs: state.stairs.filter(s => !ids.includes(s.id)) })),

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
    setActiveVisionPolygons: (polygons: Array<Array<{ x: number; y: number }>>) => set({ activeVisionPolygons: polygons }),
    setDaylightMode: (enabled: boolean) => set({ isDaylightMode: enabled }),
    setTokens: (tokens: Token[]) => set({ tokens }),
    setState: (state: Partial<GameState>) => set(state),
    showToast: (message: string, type: 'error' | 'success' | 'info') => set({ toast: { message, type } }),
    clearToast: () => set({ toast: null }),
    showConfirmDialog: (message: string, onConfirm: () => void, confirmText?: string) =>
      set({ confirmDialog: { message, onConfirm, confirmText } }),
    clearConfirmDialog: () => set({ confirmDialog: null }),
    setShowResourceMonitor: (show: boolean) => set({ showResourceMonitor: show }),
    showDungeonDialog: () => set({ dungeonDialog: true }),
    clearDungeonDialog: () => set({ dungeonDialog: false }),
    setIsGamePaused: (isPaused: boolean) => set({ isGamePaused: isPaused }),
    setMobileSidebarOpen: (isOpen: boolean) => set({ isMobileSidebarOpen: isOpen }),

    // --- Measurement Actions ---
    setActiveMeasurement: (measurement: Measurement | null) => set({ activeMeasurement: measurement }),
    setBroadcastMeasurement: (broadcast: boolean) => set({ broadcastMeasurement: broadcast }),
    setDmMeasurement: (measurement: Measurement | null) => set({ dmMeasurement: measurement }),
  };
});

// Expose store to window for E2E testing
if (typeof window !== 'undefined' && (import.meta.env.DEV || import.meta.env.MODE === 'test')) {
  interface GameStoreWindow extends Window {
    __GAME_STORE__?: typeof useGameStore;
  }
  
  (window as GameStoreWindow).__GAME_STORE__ = useGameStore;
}
