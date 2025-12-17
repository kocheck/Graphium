import { create } from 'zustand';

/**
 * Token represents a character, creature, or object on the battlemap
 *
 * Tokens are draggable images that snap to the grid. They represent player
 * characters, NPCs, monsters, or environmental objects in tactical combat.
 *
 * @property id - Unique identifier (generated with crypto.randomUUID())
 * @property x - X coordinate in pixels, grid-snapped (e.g., 0, 50, 100, 150...)
 * @property y - Y coordinate in pixels, grid-snapped (e.g., 0, 50, 100, 150...)
 * @property src - Image URL (file:// for uploaded, https:// for library). Note: Only file:// and https:// URLs are stored in the store; conversion to media:// is performed at render time (e.g., in the URLImage component).
 * @property scale - Size multiplier for grid cells (1 = 1x1, 2 = 2x2 for Large creatures)
 * @property type - Token type: 'PC' (player character with vision) or 'NPC' (no vision). Defaults to 'NPC' for backward compatibility.
 * @property visionRadius - Vision range in feet (e.g., 60 for darkvision). Only applies to PC tokens. 0 = no vision.
 * @property name - Optional display name for the token (shown in inspector/UI)
 *
 * @example
 * const goblin: Token = {
 *   id: crypto.randomUUID(),
 *   x: 150,  // Grid-snapped
 *   y: 100,
 *   src: 'file:///Users/.../temp_assets/goblin.webp',
 *   scale: 1,  // Medium creature (1x1)
 *   type: 'NPC',
 *   visionRadius: 0,
 *   name: 'Goblin Scout'
 * };
 *
 * @example
 * // Player character with darkvision
 * const playerToken: Token = {
 *   id: crypto.randomUUID(),
 *   x: 200,
 *   y: 200,
 *   src: 'file:///path/player.webp',
 *   scale: 1,
 *   type: 'PC',
 *   visionRadius: 60,  // 60ft darkvision
 *   name: 'Drizzt'
 * };
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
 *
 * Drawings are temporary markings (spell effects, hazard zones, movement paths, etc.).
 * Walls are special drawings that block vision for Fog of War calculations.
 * Synchronized in real-time to World View for player visibility.
 *
 * @property id - Unique identifier (generated with crypto.randomUUID())
 * @property tool - Tool used: 'marker' (visible stroke), 'eraser' (destination-out blend), or 'wall' (vision blocker)
 * @property points - Flat array of coordinates [x1, y1, x2, y2, ...] forming the stroke path
 * @property color - Hex color (e.g., '#df4b26' for marker, '#000000' for eraser, '#ff0000' for wall)
 * @property size - Stroke width in pixels (5 for marker, 20 for eraser, 8 for wall)
 * @property scale - Optional size multiplier for future scaling support
 * @property x - Optional X offset for future transform support
 * @property y - Optional Y offset for future transform support
 *
 * @example
 * const markerStroke: Drawing = {
 *   id: crypto.randomUUID(),
 *   tool: 'marker',
 *   points: [100, 100, 105, 102, 110, 105],
 *   color: '#df4b26',  // Red
 *   size: 5
 * };
 *
 * @example
 * const eraserStroke: Drawing = {
 *   id: crypto.randomUUID(),
 *   tool: 'eraser',
 *   points: [200, 200, 210, 210],
 *   color: '#000000',  // Rendered with destination-out
 *   size: 20
 * };
 *
 * @example
 * const wallSegment: Drawing = {
 *   id: crypto.randomUUID(),
 *   tool: 'wall',
 *   points: [150, 100, 350, 100],  // Horizontal wall
 *   color: '#ff0000',  // Red (DM view only)
 *   size: 8
 * };
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
 *
 * Uploaded maps are displayed behind tokens/drawings. Supports calibration
 * to align map grid with Hyle's tactical grid.
 *
 * @property src - Image URL (file:// path from processImage)
 * @property x - X position offset in pixels (adjusted during pan/calibration)
 * @property y - Y position offset in pixels (adjusted during pan/calibration)
 * @property width - Original map width in pixels
 * @property height - Original map height in pixels
 * @property scale - Scale multiplier (adjusted during zoom/calibration)
 *
 * @example
 * const map: MapConfig = {
 *   src: 'file:///Users/.../temp_assets/dungeon-map.webp',
 *   x: 0,
 *   y: 0,
 *   width: 2048,
 *   height: 2048,
 *   scale: 1.0
 * };
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
 *
 * - **LINES**: Traditional grid lines (vertical + horizontal, default)
 * - **DOTS**: Dots at grid intersections (cleaner, less visual clutter)
 * - **HIDDEN**: No grid visible (theater-of-mind or custom map grids)
 */
export type GridType = 'LINES' | 'DOTS' | 'HIDDEN';

/**
 * ToastMessage represents a temporary notification
 *
 * Toasts appear at top of screen, auto-dismiss after 5 seconds.
 * Used for user feedback (save success, upload errors, etc.).
 *
 * @property message - Text content to display
 * @property type - Visual style: 'error' (red), 'success' (green), 'info' (blue)
 *
 * @example
 * const errorToast: ToastMessage = {
 *   message: 'Failed to upload map',
 *   type: 'error'
 * };
 */
export interface ToastMessage {
  message: string;
  type: 'error' | 'success' | 'info';
}

/**
 * GameState is the central state interface for Hyle
 *
 * All game data (tokens, drawings, map, settings) and actions to mutate it.
 * Managed via Zustand and synced between Architect View (DM) and World View (players)
 * via IPC.
 *
 * **Critical pattern**: Architect View is source of truth. World View receives
 * updates via IPC but never modifies state (read-only display).
 *
 * @property tokens - Array of all tokens on battlemap
 * @property drawings - Array of all marker/eraser strokes
 * @property gridSize - Size of grid cells in pixels (default: 50)
 * @property gridType - Visual style: 'LINES', 'DOTS', or 'HIDDEN'
 * @property map - Background map configuration (null if no map loaded)
 * @property isCalibrating - Whether map calibration mode is active
 * @property toast - Current toast notification (null if none visible)
 *
 * **Token Actions:**
 * @property addToken - Adds new token
 * @property removeToken - Removes single token by ID
 * @property removeTokens - Removes multiple tokens (batch delete)
 * @property updateTokenPosition - Updates x/y of existing token
 * @property updateTokenTransform - Updates x/y/scale together (atomic)
 * @property updateTokenProperties - Updates token properties (type, visionRadius, name)
 *
 * **Drawing Actions:**
 * @property addDrawing - Adds new drawing stroke
 * @property removeDrawing - Removes single drawing by ID
 * @property removeDrawings - Removes multiple drawings (batch delete)
 * @property updateDrawingTransform - Updates x/y/scale of drawing
 *
 * **Map Actions:**
 * @property setMap - Sets or clears background map
 * @property updateMapPosition - Updates map x/y offset
 * @property updateMapScale - Updates map zoom level
 * @property updateMapTransform - Updates scale/x/y together (atomic, more efficient)
 *
 * **Grid Actions:**
 * @property setGridSize - Changes grid cell size (affects snapping)
 * @property setGridType - Changes grid visual style
 *
 * **Calibration Actions:**
 * @property setIsCalibrating - Enters/exits map calibration mode
 *
 * **Bulk State Actions:**
 * @property setState - Bulk state update (for load/sync operations)
 * @property setTokens - Replaces entire tokens array
 *
 * **Toast Actions:**
 * @property showToast - Shows notification message
 * @property clearToast - Dismisses current notification
 */
export interface GameState {
  tokens: Token[];
  drawings: Drawing[];
  gridSize: number;
  gridType: GridType;
  map: MapConfig | null;
  addToken: (token: Token) => void;
  removeToken: (id: string) => void;
  removeTokens: (ids: string[]) => void;
  updateTokenPosition: (id: string, x: number, y: number) => void;
  updateTokenTransform: (id: string, x: number, y: number, scale: number) => void;
  updateTokenProperties: (id: string, properties: Partial<Pick<Token, 'type' | 'visionRadius' | 'name'>>) => void;
  addDrawing: (drawing: Drawing) => void;
  removeDrawing: (id: string) => void;
  removeDrawings: (ids: string[]) => void;
  updateDrawingTransform: (id: string, x: number, y: number, scale: number) => void;
  setGridSize: (size: number) => void;
  setState: (state: Partial<GameState>) => void;
  setTokens: (tokens: Token[]) => void;
  setMap: (map: MapConfig | null) => void;
  updateMapPosition: (x: number, y: number) => void;
  updateMapScale: (scale: number) => void;
  updateMapTransform: (scale: number, x: number, y: number) => void;
  isCalibrating: boolean;
  setIsCalibrating: (isCalibrating: boolean) => void;
  setGridType: (type: GridType) => void;
  toast: ToastMessage | null;
  showToast: (message: string, type: 'error' | 'success' | 'info') => void;
  clearToast: () => void;
}

/**
 * Zustand store hook for global game state
 *
 * Single source of truth for all game data. State shared between components
 * and synchronized to World View via IPC.
 *
 * **Access Patterns:**
 *
 * 1. **Component rendering** (triggers re-render):
 *    ```typescript
 *    const tokens = useGameStore((state) => state.tokens);
 *    ```
 *
 * 2. **Event handlers** (no re-render):
 *    ```typescript
 *    const handleClick = () => {
 *      const { addToken } = useGameStore.getState();
 *      addToken(newToken);
 *    };
 *    ```
 *
 * 3. **Bulk updates** (loading/syncing):
 *    ```typescript
 *    useGameStore.setState({ tokens: [...], drawings: [...] });
 *    ```
 *
 * 4. **Subscriptions** (side effects like IPC sync):
 *    ```typescript
 *    useEffect(() => {
 *      const unsub = useGameStore.subscribe((state) => {
 *        window.ipcRenderer.send('SYNC_WORLD_STATE', state);
 *      });
 *      return unsub;
 *    }, []);
 *    ```
 *
 * **Critical Rules:**
 * - NEVER mutate state directly: `state.tokens.push(...)` ❌
 * - ALWAYS use actions: `addToken(...)` ✅
 * - ALWAYS create new array/object references in actions
 *
 * @example
 * // Add token
 * const { addToken } = useGameStore();
 * addToken({
 *   id: crypto.randomUUID(),
 *   x: 100,
 *   y: 100,
 *   src: 'file:///path/token.webp',
 *   scale: 1
 * });
 *
 * @example
 * // Subscribe to changes
 * useEffect(() => {
 *   const unsubscribe = useGameStore.subscribe((state) => {
 *     console.log('State changed:', state);
 *   });
 *   return unsubscribe;
 * }, []);
 *
 * @example
 * // Batch delete tokens
 * const { removeTokens } = useGameStore();
 * removeTokens(['id1', 'id2', 'id3']);  // More efficient than 3 removeToken calls
 *
 * @example
 * // Show toast notification
 * const { showToast } = useGameStore();
 * showToast('Campaign saved!', 'success');
 */
export const useGameStore = create<GameState>((set) => ({
  // Initial state
  tokens: [],
  drawings: [],
  gridSize: 50,
  gridType: 'LINES',
  map: null,
  isCalibrating: false,
  toast: null,

  // Token actions
  addToken: (token: Token) => set((state) => ({ tokens: [...state.tokens, token] })),
  removeToken: (id: string) => set((state) => ({ tokens: state.tokens.filter((t: Token) => t.id !== id) })),
  removeTokens: (ids: string[]) => set((state) => ({ tokens: state.tokens.filter((t: Token) => !ids.includes(t.id)) })),
  updateTokenPosition: (id: string, x: number, y: number) => set((state) => ({
    tokens: state.tokens.map((t: Token) => t.id === id ? { ...t, x, y } : t)
  })),
  updateTokenTransform: (id: string, x: number, y: number, scale: number) => set((state) => ({
    tokens: state.tokens.map((t: Token) => t.id === id ? { ...t, x, y, scale } : t)
  })),
  updateTokenProperties: (id: string, properties: Partial<Pick<Token, 'type' | 'visionRadius' | 'name'>>) => set((state) => ({
    tokens: state.tokens.map((t: Token) => t.id === id ? { ...t, ...properties } : t)
  })),

  // Drawing actions
  addDrawing: (drawing: Drawing) => set((state) => ({ drawings: [...state.drawings, drawing] })),
  removeDrawing: (id: string) => set((state) => ({ drawings: state.drawings.filter((d: Drawing) => d.id !== id) })),
  removeDrawings: (ids: string[]) => set((state) => ({ drawings: state.drawings.filter((d: Drawing) => !ids.includes(d.id)) })),
  updateDrawingTransform: (id: string, x: number, y: number, scale: number) => set((state) => ({
    drawings: state.drawings.map((d: Drawing) => d.id === id ? { ...d, x, y, scale } : d)
  })),

  // Grid actions
  setGridSize: (size: number) => set({ gridSize: size }),
  setGridType: (type: GridType) => set({ gridType: type }),

  // Map actions
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

  // Calibration actions
  setIsCalibrating: (isCalibrating: boolean) => set({ isCalibrating }),

  // Bulk state actions
  setTokens: (tokens: Token[]) => set({ tokens }),
  setState: (state: Partial<GameState>) => set(state),

  // Toast actions
  showToast: (message: string, type: 'error' | 'success' | 'info') => set({ toast: { message, type } }),
  clearToast: () => set({ toast: null }),
}));
