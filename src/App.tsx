import { useState, useEffect, useRef, useMemo } from 'react'
import CanvasManager from './components/Canvas/CanvasManager'
import SyncManager from './components/SyncManager'
import { ThemeManager } from './components/ThemeManager'
import { PauseManager } from './components/PauseManager'
import { LoadingOverlay } from './components/LoadingOverlay'
import Sidebar from './components/Sidebar'
import Toast from './components/Toast'
import ConfirmDialog from './components/ConfirmDialog'
import { DungeonGeneratorDialog } from './components/DungeonGeneratorDialog'
import TokenInspector from './components/TokenInspector'
import ResourceMonitor from './components/ResourceMonitor'
import { useGameStore } from './store/gameStore'
import type { TokenLibraryItem } from './store/gameStore'
import { useWindowType } from './utils/useWindowType'
import AutoSaveManager from './components/AutoSaveManager'
import CommandPalette from './components/AssetLibrary/CommandPalette'
import { useCommandPalette } from './hooks/useCommandPalette';

/**
 * App is the root component for Hyle's dual-window architecture
 *
 * This component renders differently based on window type:
 * - **Architect View** (Main Window): Full DM control panel with UI and editing tools
 * - **World View** (Player Window): Sanitized canvas-only display for projection
 *
 * **UI Sanitization Logic:**
 * Uses the `useWindowType()` hook to detect window type and conditionally render
 * DM-specific UI components. This ensures the World View shows only the game canvas
 * without exposing editing tools, save/load controls, or the asset library.
 *
 * **Component hierarchy (Architect View):**
 * ```
 * App (root)
 *   ├── ThemeManager (invisible, syncs theme across windows)
 *   ├── SyncManager (invisible, handles IPC state sync)
 *   ├── Toast (notifications)
 *   ├── Sidebar (left panel, token library) ← ARCHITECT ONLY
 *   └── Main area
 *       ├── CanvasManager (battlemap canvas)
 *       └── Toolbar (floating top-right) ← ARCHITECT ONLY
 *           ├── Tool buttons (Select, Marker, Eraser, Wall)
 *           ├── Save/Load campaign buttons
 *           └── World View button
 * ```
 *
 * **Component hierarchy (World View):**
 * ```
 * App (root)
 *   ├── ThemeManager (invisible, syncs theme across windows)
 *   ├── SyncManager (invisible, receives IPC state updates)
 *   ├── Toast (notifications)
 *   └── Main area
 *       └── CanvasManager (battlemap canvas only, interaction-restricted)
 * ```
 *
 * **Tool state:**
 * Only managed in Architect View. Passed to CanvasManager to control drawing/interaction
 * mode (select, marker, eraser). World View always uses select mode with limited interactions.
 *
 * **Campaign management:**
 * Only available in Architect View:
 * - Save button: Serializes store state to .hyle ZIP file via IPC
 * - Load button: Deserializes .hyle file and updates store via IPC
 * - Both use Electron dialog API (handled by main process)
 *
 * **World View creation:**
 * "World View" button in Architect View toolbar creates the player-facing window via IPC.
 * The World Window is a separate BrowserWindow that loads the same React app with
 * `?type=world` query parameter for UI differentiation.
 *
 * @returns Root UI with conditional rendering based on window type
 *
 * @example
 * // This is the root component rendered in main.tsx:
 * ReactDOM.createRoot(document.getElementById('root')!).render(
 *   <React.StrictMode>
 *     <App />
 *   </React.StrictMode>
 * )
 *
 * @see {@link file://./utils/useWindowType.ts useWindowType} for window detection
 * @see {@link file://./components/SyncManager.tsx SyncManager} for state synchronization
 * @see {@link file://./components/Canvas/CanvasManager.tsx CanvasManager} for interaction restrictions
 */
function App() {
  // Detect window type for UI sanitization
  const { isArchitectView, isWorldView } = useWindowType();

  // Active tool state (controls CanvasManager behavior)
  // Only used in Architect View; World View always uses 'select' with restricted interactions
  const [tool, setTool] = useState<'select' | 'marker' | 'eraser' | 'wall'>('select');
  const [color, setColor] = useState('#df4b26');
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Selected tokens state (for TokenInspector)
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);

  // Command Palette state (Cmd+P)
  const [isPaletteOpen, setPaletteOpen] = useCommandPalette();

  // Resource Monitor state (from store)
  const showResourceMonitor = useGameStore((state) => state.showResourceMonitor);

  // Pause state (from store)
  const isGamePaused = useGameStore((state) => state.isGamePaused);
  const showToast = useGameStore((state) => state.showToast);

  // Handle pause toggle
  const handlePauseToggle = async () => {
    if (!window.ipcRenderer) return;
    try {
      // @ts-ignore
      await window.ipcRenderer.invoke('TOGGLE_PAUSE');
    } catch (e) {
      console.error('[App] Failed to toggle pause:', e);
      showToast('Failed to toggle pause state', 'error');
    }
  };


  // Filter selected IDs to only include tokens (not drawings)
  const tokens = useGameStore((s) => s.tokens);
  const selectedTokensOnly = useMemo(() =>
    selectedTokenIds.filter((id) =>
      tokens.some((t) => t.id === id)
    ),
    [selectedTokenIds, tokens]
  );

  // Load library index on startup (Architect View only)
  useEffect(() => {
    if (!isArchitectView || !window.ipcRenderer) return;

    const loadLibrary = async () => {
      try {
        // @ts-ignore
        const libraryItems = await window.ipcRenderer.invoke('LOAD_LIBRARY_INDEX');

        // Update store with loaded library items
        if (libraryItems && Array.isArray(libraryItems)) {
          useGameStore.setState((state) => {
            const currentLibrary = state.campaign.tokenLibrary;

            // Merge with existing library (avoid duplicates by ID)
            const existingIds = new Set(currentLibrary.map((item) => item.id));
            const newItems = (libraryItems as TokenLibraryItem[]).filter((item) => !existingIds.has(item.id));

            if (newItems.length === 0) {
              return state;
            }

            return {
              campaign: {
                ...state.campaign,
                tokenLibrary: [...currentLibrary, ...newItems],
              },
            };
          });
        }
      } catch (error) {
        console.error('[App] Failed to load library index:', error);
        // Don't show toast - this is a non-critical error on startup
      }
    };

    loadLibrary();
  }, [isArchitectView]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Prevent tool switching in World View (player mode)
      if (!isArchitectView) return;

      switch (e.key.toLowerCase()) {
        case 'v':
          setTool('select');
          break;
        case 'm':
          setTool('marker');
          break;
        case 'e':
          setTool('eraser');
          break;
        case 'w':
          setTool('wall');
          break;
        case 'i':
          colorInputRef.current?.click();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isArchitectView]);

  // Handle Menu Commands (IPC)
  useEffect(() => {
    if (!window.ipcRenderer) return;

    const handleSave = async () => {
        try {
            const store = useGameStore.getState();
            store.syncActiveMapToCampaign();
            const campaignToSave = useGameStore.getState().campaign;
            // @ts-ignore
            const result = await window.ipcRenderer.invoke('SAVE_CAMPAIGN', campaignToSave);
            if (result) store.showToast('Campaign Saved Successfully!', 'success');
        } catch (e) {
            console.error(e);
            useGameStore.getState().showToast('Failed to save: ' + e, 'error');
        }
    };

    const handleLoad = async () => {
        try {
            // @ts-ignore
            const campaign = await window.ipcRenderer.invoke('LOAD_CAMPAIGN');
            if (campaign) {
                useGameStore.getState().loadCampaign(campaign);
                useGameStore.getState().showToast('Campaign Loaded!', 'success');
            }
        } catch (e) {
            console.error(e);
            useGameStore.getState().showToast('Failed to load: ' + e, 'error');
        }
    };

    const handleToggleMonitor = () => {
        useGameStore.getState().setShowResourceMonitor(!useGameStore.getState().showResourceMonitor);
    };

    window.ipcRenderer.on('MENU_SAVE_CAMPAIGN', handleSave);
    window.ipcRenderer.on('MENU_LOAD_CAMPAIGN', handleLoad);
    window.ipcRenderer.on('MENU_TOGGLE_RESOURCE_MONITOR', handleToggleMonitor);

    return () => {
        window.ipcRenderer.off('MENU_SAVE_CAMPAIGN', handleSave);
        window.ipcRenderer.off('MENU_LOAD_CAMPAIGN', handleLoad);
        window.ipcRenderer.off('MENU_TOGGLE_RESOURCE_MONITOR', handleToggleMonitor);
    };
  }, []); // Empty dependency array as handlers use getState()

  return (
    <div className="app-root w-full h-screen flex overflow-hidden">
      {/* Global components (rendered in both Architect and World View) */}
      <ThemeManager />
      <SyncManager />
      <PauseManager />
      <Toast />
      <ConfirmDialog />
      <DungeonGeneratorDialog />

      {/* Loading Overlay: Only render in World View to block players' view */}
      {isWorldView && <LoadingOverlay />}

      {/* Auto-save (Architect View only) */}
      {isArchitectView && <AutoSaveManager />}

      {/* Sidebar: Only render in Architect View (DM's token library) */}
      {isArchitectView && <Sidebar />}


      <div className="flex-1 relative h-full">
        {/* CanvasManager: Rendered in both views, but with different interaction modes */}
        <CanvasManager
          tool={tool}
          color={color}
          isWorldView={isWorldView}
          onSelectionChange={setSelectedTokenIds}
        />

        {/* Toolbar: Only render in Architect View (DM controls) */}
        {isArchitectView && (
        <div className="toolbar fixed top-4 right-4 p-2 rounded shadow flex gap-2 z-50">
           {/* Play/Pause Button */}
           <button
             className={`btn btn-tool flex items-center gap-2 font-semibold ${
               isGamePaused
                 ? 'bg-red-500 hover:bg-red-600 text-white'
                 : 'bg-green-500 hover:bg-green-600 text-white'
             }`}
             onClick={handlePauseToggle}
             title={isGamePaused ? 'Click to resume - Players will see the updated map' : 'Click to pause - Players will see a loading screen'}
           >
             {isGamePaused ? (
               <>
                 <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                   <path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5z" />
                 </svg>
                 <span>PAUSED</span>
               </>
             ) : (
               <>
                 <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                   <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                 </svg>
                 <span>PLAYING</span>
               </>
             )}
           </button>
           <div className="toolbar-divider w-px mx-1"></div>
           <button
             className={`btn btn-tool ${tool === 'select' ? 'active' : ''}`}
             onClick={() => setTool('select')}>Select (V)</button>
           <button
             className={`btn btn-tool ${tool === 'marker' ? 'active' : ''}`}
             onClick={() => setTool('marker')}>Marker (M)</button>
           <button
             className={`btn btn-tool ${tool === 'eraser' ? 'active' : ''}`}
             onClick={() => setTool('eraser')}>Eraser (E)</button>
           <button
             className={`btn btn-tool ${tool === 'wall' ? 'active' : ''}`}
             onClick={() => setTool('wall')}>Wall (W)</button>
           <div className="toolbar-divider w-px mx-1"></div>
           <button
             className="btn btn-tool"
             onClick={() => useGameStore.getState().showDungeonDialog()}
             title="Generate a random dungeon">Dungeon Gen</button>
           <div className="toolbar-divider w-px mx-1"></div>
           <label className="flex items-center gap-2 cursor-pointer">
             <span className="text-sm font-medium">Color (I)</span>
             <input
               ref={colorInputRef}
               type="color"
               value={color}
               onChange={(e) => setColor(e.target.value)}
               className="w-8 h-8 rounded cursor-pointer border-none p-0 bg-transparent"
             />
           </label>
        </div>
        )}

        {/* Resource Monitor: Performance diagnostics overlay (Architect View only) */}
        {isArchitectView && showResourceMonitor && <ResourceMonitor />}

        {/* Token Inspector (only show in Architect View when tokens selected) */}
        {isArchitectView && selectedTokensOnly.length > 0 && (
          <TokenInspector selectedTokenIds={selectedTokensOnly} />
        )}

        {/* Command Palette: Quick asset search (Cmd+P, Architect View only) */}
        {isArchitectView && (
          <CommandPalette
            isOpen={isPaletteOpen}
            onClose={() => setPaletteOpen(false)}
          />
        )}
      </div>
    </div>
  )
}

export default App
