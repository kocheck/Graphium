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
import { HomeScreen } from './components/HomeScreen'
import { useGameStore } from './store/gameStore'
import { useWindowType } from './utils/useWindowType'
import AutoSaveManager from './components/AutoSaveManager'
import CommandPalette from './components/AssetLibrary/CommandPalette'
import { useCommandPalette } from './hooks/useCommandPalette'
import { getStorage } from './services/storage';
import { useIsMobile } from './hooks/useMediaQuery';
import MobileToolbar from './components/MobileToolbar';
import { rollForMessage } from './utils/systemMessages';
import { addRecentCampaignWithPlatform } from './utils/recentCampaigns';
import Tooltip from './components/Tooltip';

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

  // View state management: HOME (splash screen) or EDITOR (main app)
  // World View always starts in EDITOR mode (bypasses home screen)
  const [viewState, setViewState] = useState<'HOME' | 'EDITOR'>(isWorldView ? 'EDITOR' : 'HOME');

  // Mobile responsiveness
  const isMobile = useIsMobile();
  const setMobileSidebarOpen = useGameStore((state) => state.setMobileSidebarOpen);

  // Active tool state (controls CanvasManager behavior)
  // Only used in Architect View; World View always uses 'select' with restricted interactions
  const [tool, setTool] = useState<'select' | 'marker' | 'eraser' | 'wall' | 'door' | 'measure'>('select');
  const [color, setColor] = useState('#df4b26');
  const [recentColors, setRecentColors] = useState<string[]>(['#df4b26', '#3b82f6', '#22c55e']);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Update recent colors when color changes
  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    setRecentColors(prev => {
      // Remove duplicates and add new color at the start
      const filtered = prev.filter(c => c.toLowerCase() !== newColor.toLowerCase());
      return [newColor, ...filtered].slice(0, 3);
    });
  };

  // Door tool state
  const [doorOrientation, setDoorOrientation] = useState<'horizontal' | 'vertical'>('horizontal');

  // Measurement tool state
  const [measurementMode, setMeasurementMode] = useState<'ruler' | 'blast' | 'cone'>('ruler');
  const broadcastMeasurement = useGameStore((state) => state.broadcastMeasurement);
  const setBroadcastMeasurement = useGameStore((state) => state.setBroadcastMeasurement);
  const setActiveMeasurement = useGameStore((state) => state.setActiveMeasurement);

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
      showToast(rollForMessage('PAUSE_TOGGLE_FAILED'), 'error');
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
    if (!isArchitectView) return;

    const loadLibrary = async () => {
      try {
        const storage = getStorage();
        const libraryItems = await storage.loadLibraryIndex();

        // Update store with loaded library items
        if (libraryItems && Array.isArray(libraryItems)) {
          useGameStore.setState((state) => {
            const currentLibrary = state.campaign.tokenLibrary;

            // Merge with existing library (avoid duplicates by ID)
            const existingIds = new Set(currentLibrary.map((item) => item.id));
            const newItems = libraryItems.filter((item) => !existingIds.has(item.id));

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

  // Clear active measurement when measurement mode changes to prevent confusion
  useEffect(() => {
    setActiveMeasurement(null);
  }, [measurementMode, setActiveMeasurement]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Prevent tool switching in World View (player mode)
      if (!isArchitectView) return;

      // Handle arrow keys separately (they don't need toLowerCase)
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (tool === 'door') {
          e.preventDefault(); // Prevent page scrolling
          setDoorOrientation(prev => {
            const newOrientation = prev === 'horizontal' ? 'vertical' : 'horizontal';
            console.log('[App] Arrow key pressed - door orientation changed from', prev, 'to', newOrientation);
            return newOrientation;
          });
        }
        return;
      }

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
        case 'd':
          setTool('door');
          break;
        case 'r':
          // If door tool is active, rotate door orientation
          // Otherwise, switch to measure tool
          if (tool === 'door') {
            setDoorOrientation(prev => {
              const newOrientation = prev === 'horizontal' ? 'vertical' : 'horizontal';
              console.log('[App] R key pressed - door orientation changed from', prev, 'to', newOrientation);
              return newOrientation;
            });
          } else {
            setTool('measure');
          }
          break;
        case 'i':
          colorInputRef.current?.click();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isArchitectView, tool]);

  // Handle Menu Commands (Electron IPC)
  useEffect(() => {
    const ipcRenderer = window.ipcRenderer;
    if (!ipcRenderer) return;

    const handleSave = async () => {
        try {
            const store = useGameStore.getState();
            store.syncActiveMapToCampaign();
            const campaignToSave = useGameStore.getState().campaign;
            const storage = getStorage();
            const result = await storage.saveCampaign(campaignToSave);
            if (result) {
                // Add to recent campaigns
                addRecentCampaignWithPlatform(
                    campaignToSave.id,
                    campaignToSave.name
                );
                store.showToast(rollForMessage('CAMPAIGN_SAVE_SUCCESS'), 'success');
            }
        } catch (e) {
            console.error(e);
            useGameStore.getState().showToast(rollForMessage('CAMPAIGN_SAVE_FAILED', { error: String(e) }), 'error');
        }
    };

    const handleLoad = async () => {
        try {
            const storage = getStorage();
            const campaign = await storage.loadCampaign();
            if (campaign) {
                useGameStore.getState().loadCampaign(campaign);
                // Add to recent campaigns
                addRecentCampaignWithPlatform(
                    campaign.id,
                    campaign.name
                );
                useGameStore.getState().showToast(rollForMessage('CAMPAIGN_LOAD_SUCCESS'), 'success');
            }
        } catch (e) {
            console.error(e);
            useGameStore.getState().showToast(rollForMessage('CAMPAIGN_LOAD_FAILED', { error: String(e) }), 'error');
        }
    };

    const handleToggleMonitor = () => {
        useGameStore.getState().setShowResourceMonitor(!useGameStore.getState().showResourceMonitor);
    };

    const handleGenerateDungeon = () => {
        useGameStore.getState().showDungeonDialog();
    };

    const handleNewCampaign = () => {
        // Show confirmation dialog before creating new campaign
        useGameStore.getState().showConfirmDialog(
            'Create a new campaign? Any unsaved changes will be lost.',
            () => {
                // Reset to default campaign
                const { resetToNewCampaign } = useGameStore.getState();
                resetToNewCampaign();
            },
            'Create New Campaign'
        );
    };

    ipcRenderer.on('MENU_SAVE_CAMPAIGN', handleSave);
    ipcRenderer.on('MENU_LOAD_CAMPAIGN', handleLoad);
    ipcRenderer.on('MENU_TOGGLE_RESOURCE_MONITOR', handleToggleMonitor);
    ipcRenderer.on('MENU_GENERATE_DUNGEON', handleGenerateDungeon);
    ipcRenderer.on('MENU_NEW_CAMPAIGN', handleNewCampaign);

    return () => {
        ipcRenderer.off('MENU_SAVE_CAMPAIGN', handleSave);
        ipcRenderer.off('MENU_LOAD_CAMPAIGN', handleLoad);
        ipcRenderer.off('MENU_TOGGLE_RESOURCE_MONITOR', handleToggleMonitor);
        ipcRenderer.off('MENU_GENERATE_DUNGEON', handleGenerateDungeon);
        ipcRenderer.off('MENU_NEW_CAMPAIGN', handleNewCampaign);
    };
  }, []); // Empty dependency array as handlers use getState()

  // Handler to transition from HOME to EDITOR
  const handleStartEditor = () => {
    setViewState('EDITOR');
  };

  // If in Architect View and on HOME screen, show the HomeScreen component
  if (isArchitectView && viewState === 'HOME') {
    return (
      <>
        {/* Global components */}
        <ThemeManager />
        <Toast />
        <ConfirmDialog />

        {/* Home/Splash Screen */}
        <HomeScreen onStartEditor={handleStartEditor} />
      </>
    );
  }

  // Otherwise, render the full editor (both Architect and World View)
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


      <div className="flex-1 relative h-full transition-all duration-300">
        {/* Mobile Hamburger Menu Button (top-left, Architect View only) */}
        {isArchitectView && isMobile && (
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="fixed top-4 left-4 z-50 p-3 rounded shadow-lg"
            style={{
              backgroundColor: 'var(--app-bg-surface)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'var(--app-border-default)',
              minWidth: '48px',
              minHeight: '48px',
            }}
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        {/* CanvasManager: Rendered in both views, but with different interaction modes */}
        <CanvasManager
          tool={tool}
          color={color}
          doorOrientation={doorOrientation}
          isWorldView={isWorldView}
          onSelectionChange={setSelectedTokenIds}
          measurementMode={measurementMode}
        />

        {/* Toolbar: Desktop or Mobile (Architect View only) */}
        {isArchitectView && !isMobile && (
        <div className="toolbar fixed bottom-4 left-1/2 -translate-x-1/2 p-3 rounded-lg shadow-2xl flex items-center gap-2 z-50 bg-black border-2 border-neutral-600">
           {/* Play/Pause Button */}
           <Tooltip content={isGamePaused ? 'Resume - Players will see the map' : 'Pause - Hide map from players'}>
             <button
               className={`btn btn-tool flex items-center justify-center font-semibold ${
                 isGamePaused
                   ? 'bg-red-500 hover:bg-red-600 text-white'
                   : 'bg-green-500 hover:bg-green-600 text-white'
               }`}
               onClick={handlePauseToggle}
               aria-label={isGamePaused ? 'Resume game' : 'Pause game'}
             >
               {isGamePaused ? (
                 <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                   <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                 </svg>
               ) : (
                 <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                   <path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5z" />
                 </svg>
               )}
             </button>
           </Tooltip>
           <div className="toolbar-divider w-px mx-1"></div>
           {/* Select Tool */}
           <Tooltip content="Select (V)">
             <button
               className={`btn btn-tool p-2 ${tool === 'select' ? 'active' : ''}`}
               onClick={() => setTool('select')}
               aria-label="Select tool">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
               </svg>
             </button>
           </Tooltip>
           {/* Marker Tool */}
           <Tooltip content="Marker (M)">
             <button
               className={`btn btn-tool p-2 ${tool === 'marker' ? 'active' : ''}`}
               onClick={() => setTool('marker')}
               aria-label="Marker tool">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
               </svg>
             </button>
           </Tooltip>
           {/* Eraser Tool */}
           <Tooltip content="Eraser (E)">
             <button
               className={`btn btn-tool p-2 ${tool === 'eraser' ? 'active' : ''}`}
               onClick={() => setTool('eraser')}
               aria-label="Eraser tool">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
               </svg>
             </button>
           </Tooltip>
           {/* Wall Tool */}
           <Tooltip content="Wall (W)">
             <button
               className={`btn btn-tool p-2 ${tool === 'wall' ? 'active' : ''}`}
               onClick={() => setTool('wall')}
               aria-label="Wall tool">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h7m10 0h-7m-7 5h7m10 0h-7m-7 5h7m10 0h-7m-7 5h7m10 0h-7" />
               </svg>
             </button>
           </Tooltip>
           {/* Door Tool */}
           <Tooltip content="Door (D) - Arrow keys or R to rotate">
             <button
               className={`btn btn-tool p-2 ${tool === 'door' ? 'active' : ''}`}
               onClick={() => setTool('door')}
               aria-label="Door tool">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v10m8-10v10M5 7h14a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2z" />
               </svg>
             </button>
           </Tooltip>
           {/* Door Orientation Toggle (only visible when door tool active) */}
           {tool === 'door' && (
             <Tooltip content="Toggle orientation (R)">
               <button
                 className="btn btn-tool text-lg px-2"
                 onClick={() => setDoorOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal')}
                 aria-label="Toggle door orientation">
                 {doorOrientation === 'horizontal' ? '↔' : '↕'}
               </button>
             </Tooltip>
           )}
           <div className="toolbar-divider w-px mx-1"></div>
           {/* Measurement Tool with Mode Selector */}
           <div className="flex gap-1 items-center">
             <Tooltip content="Measure (R) - Distance, Blast, Cone">
               <button
                 className={`btn btn-tool p-2 ${tool === 'measure' ? 'active' : ''}`}
                 onClick={() => setTool('measure')}
                 aria-label="Measure tool">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                 </svg>
               </button>
             </Tooltip>
             {tool === 'measure' && (
               <div className="flex gap-1 ml-1 items-center">
                 <button
                   className={`btn btn-mode ${measurementMode === 'ruler' ? 'active' : ''}`}
                   onClick={() => setMeasurementMode('ruler')}
                   title="Ruler: Measure distance between two points">
                   Ruler
                 </button>
                 <button
                   className={`btn btn-mode ${measurementMode === 'blast' ? 'active' : ''}`}
                   onClick={() => setMeasurementMode('blast')}
                   title="Blast: Circular AoE (e.g., Fireball)">
                   Blast
                 </button>
                 <button
                   className={`btn btn-mode ${measurementMode === 'cone' ? 'active' : ''}`}
                   onClick={() => setMeasurementMode('cone')}
                   title="Cone: 53° cone AoE (e.g., Burning Hands)">
                   Cone
                 </button>
                 <div className="toolbar-divider w-px mx-1 h-6"></div>
                 <button
                   className={`btn btn-broadcast ${broadcastMeasurement ? 'active' : ''}`}
                   onClick={() => setBroadcastMeasurement(!broadcastMeasurement)}
                   title="Broadcast measurements to players in World View">
                   {broadcastMeasurement ? '📡 Broadcasting' : '📡 Local Only'}
                 </button>
               </div>
             )}
           </div>
           {/* Hidden color picker input (triggered by clicking main color circle) */}
           <input
             ref={colorInputRef}
             type="color"
             value={color}
             onChange={(e) => handleColorChange(e.target.value)}
             className="hidden"
           />
        </div>
        )}

        {/* Floating Color Palette (appears above marker tool when active) */}
        {isArchitectView && !isMobile && tool === 'marker' && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
            {/* Current color - Large circle */}
            <Tooltip content="Change marker color (I)">
              <button
                onClick={() => colorInputRef.current?.click()}
                className="w-12 h-12 rounded-full border-2 border-white shadow-lg hover:scale-110 transition-transform cursor-pointer"
                style={{ backgroundColor: color }}
                aria-label="Change marker color"
              />
            </Tooltip>

            {/* Recent colors - Smaller circles */}
            <div className="flex gap-1.5">
              {recentColors.map((recentColor) => (
                <Tooltip key={recentColor} content={`Use color ${recentColor}`}>
                  <button
                    onClick={() => handleColorChange(recentColor)}
                    className="w-8 h-8 rounded-full border-2 border-neutral-600 shadow-md hover:scale-110 transition-transform cursor-pointer"
                    style={{ backgroundColor: recentColor }}
                    aria-label={`Switch to color ${recentColor}`}
                  />
                </Tooltip>
              ))}
            </div>
          </div>
        )}

        {/* Resource Monitor: Performance diagnostics overlay (Architect View only) */}
        {isArchitectView && showResourceMonitor && <ResourceMonitor />}

        {/* Token Inspector (only show in Architect View when tokens selected) */}
        {isArchitectView && selectedTokensOnly.length > 0 && (
          <TokenInspector 
            selectedTokenIds={selectedTokensOnly} 
            onClose={() => setSelectedTokenIds([])}
          />
        )}

        {/* Command Palette: Quick actions & asset search (Cmd+P, Architect View only) */}
        {isArchitectView && (
          <CommandPalette
            isOpen={isPaletteOpen}
            onClose={() => setPaletteOpen(false)}
            onSetTool={setTool}
            onTogglePause={handlePauseToggle}
            onLaunchWorldView={() => {
              const ipcRenderer = window.ipcRenderer;
              if (ipcRenderer) {
                ipcRenderer.send('create-world-window');
              } else {
                const baseUrl = window.location.origin + window.location.pathname;
                window.open(`${baseUrl}?type=world`, '_blank');
              }
            }}
            onOpenDungeonGenerator={() => useGameStore.getState().showDungeonDialog()}
            isGamePaused={isGamePaused}
          />
        )}

        {/* Mobile Toolbar: Bottom navigation bar (Architect View only, mobile only) */}
        {isArchitectView && isMobile && (
          <MobileToolbar
            tool={tool}
            setTool={setTool}
            color={color}
            setColor={setColor}
            doorOrientation={doorOrientation}
            setDoorOrientation={setDoorOrientation}
            isGamePaused={isGamePaused}
            onPauseToggle={handlePauseToggle}
          />
        )}
      </div>
    </div>
  )
}

export default App
