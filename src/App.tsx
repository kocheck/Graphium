import { useState, useEffect, useRef, useMemo } from 'react';
import {
  RiPlayFill,
  RiPauseFill,
  RiCursorLine,
  RiPencilLine,
  RiEraserLine,
  RiLayoutMasonryLine,
  RiDoorOpenLine,
  RiRulerLine,
} from '@remixicon/react';
import CanvasManager from './components/Canvas/CanvasManager';
import SyncManager from './components/SyncManager';
import { ThemeManager } from './components/ThemeManager';
import { PauseManager } from './components/PauseManager';
import { LoadingOverlay } from './components/LoadingOverlay';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import ConfirmDialog from './components/ConfirmDialog';
import { DungeonGeneratorDialog } from './components/DungeonGeneratorDialog';
import TokenInspector from './components/TokenInspector';
import ResourceMonitor from './components/ResourceMonitor';
import { HomeScreen } from './components/HomeScreen';
import { useGameStore } from './store/gameStore';
import { useWindowType } from './utils/useWindowType';
import AutoSaveManager from './components/AutoSaveManager';
import CommandPalette from './components/AssetLibrary/CommandPalette';
import { useCommandPalette } from './hooks/useCommandPalette';
import { getStorage } from './services/storage';
import { useIsMobile } from './hooks/useMediaQuery';
import MobileToolbar from './components/MobileToolbar';
import { rollForMessage } from './utils/systemMessages';
import { addRecentCampaignWithPlatform } from './utils/recentCampaigns';
import Tooltip from './components/Tooltip';
import { AboutModal } from './components/AboutModal';
import { DesignSystemPlayground } from './components/DesignSystemPlayground/DesignSystemPlayground';
import UpdateManager from './components/UpdateManager';
import UpdateManagerErrorBoundary from './components/UpdateManagerErrorBoundary';

/**
 * App is the root component for Graphium's dual-window architecture
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
 * - Save button: Serializes store state to .graphium ZIP file via IPC
 * - Load button: Deserializes .graphium file and updates store via IPC
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

  // Detect Design System Playground route
  const isDesignSystemPlayground = window.location.pathname === '/design-system';

  // View state management: HOME (splash screen) or EDITOR (main app)
  // World View always starts in EDITOR mode (bypasses home screen)
  const [viewState, setViewState] = useState<'HOME' | 'EDITOR'>(isWorldView ? 'EDITOR' : 'HOME');

  // Mobile responsiveness
  const isMobile = useIsMobile();
  const setMobileSidebarOpen = useGameStore((state) => state.setMobileSidebarOpen);

  // Active tool state (controls CanvasManager behavior)
  // Only used in Architect View; World View always uses 'select' with restricted interactions
  const [tool, setTool] = useState<'select' | 'marker' | 'eraser' | 'wall' | 'door' | 'measure'>(
    'select',
  );
  const [color, setColor] = useState('#df4b26');
  const [recentColors, setRecentColors] = useState<string[]>(['#df4b26', '#3b82f6', '#22c55e']);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Update recent colors when color changes
  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    setRecentColors((prev) => {
      // Remove duplicates and add new color at the start
      const filtered = prev.filter((c) => c.toLowerCase() !== newColor.toLowerCase());
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

  // About Modal state
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // Update Manager state
  const [isUpdateManagerOpen, setIsUpdateManagerOpen] = useState(false);

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
  const selectedTokensOnly = useMemo(
    () => selectedTokenIds.filter((id) => tokens.some((t) => t.id === id)),
    [selectedTokenIds, tokens],
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

      // Global keyboard shortcuts (work in both views)
      // '?' to open About modal (Shift+/)
      if ((e.key === '?' || (e.shiftKey && e.key === '/')) && !isAboutOpen) {
        e.preventDefault();
        setIsAboutOpen(true);
        return;
      }

      // Escape to close About modal
      if (e.key === 'Escape' && isAboutOpen) {
        setIsAboutOpen(false);
        return;
      }

      // Escape to close Update Manager
      if (e.key === 'Escape' && isUpdateManagerOpen) {
        setIsUpdateManagerOpen(false);
        return;
      }

      // Prevent tool switching in World View (player mode)
      if (!isArchitectView) return;

      // Handle arrow keys separately (they don't need toLowerCase)
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (tool === 'door') {
          e.preventDefault(); // Prevent page scrolling
          setDoorOrientation((prev) => {
            const newOrientation = prev === 'horizontal' ? 'vertical' : 'horizontal';
            console.log(
              '[App] Arrow key pressed - door orientation changed from',
              prev,
              'to',
              newOrientation,
            );
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
            setDoorOrientation((prev) => {
              const newOrientation = prev === 'horizontal' ? 'vertical' : 'horizontal';
              console.log(
                '[App] R key pressed - door orientation changed from',
                prev,
                'to',
                newOrientation,
              );
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
  }, [isArchitectView, tool, isAboutOpen, isUpdateManagerOpen]);

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
          addRecentCampaignWithPlatform(campaignToSave.id, campaignToSave.name);
          store.showToast(rollForMessage('CAMPAIGN_SAVE_SUCCESS'), 'success');
        }
      } catch (e) {
        console.error(e);
        useGameStore
          .getState()
          .showToast(rollForMessage('CAMPAIGN_SAVE_FAILED', { error: String(e) }), 'error');
      }
    };

    const handleLoad = async () => {
      try {
        const storage = getStorage();
        const campaign = await storage.loadCampaign();
        if (campaign) {
          useGameStore.getState().loadCampaign(campaign);
          // Add to recent campaigns
          addRecentCampaignWithPlatform(campaign.id, campaign.name);
          useGameStore.getState().showToast(rollForMessage('CAMPAIGN_LOAD_SUCCESS'), 'success');
        }
      } catch (e) {
        console.error(e);
        useGameStore
          .getState()
          .showToast(rollForMessage('CAMPAIGN_LOAD_FAILED', { error: String(e) }), 'error');
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
        'Create New Campaign',
      );
    };

    const handleShowAbout = () => {
      setIsAboutOpen(true);
    };

    ipcRenderer.on('MENU_SAVE_CAMPAIGN', handleSave);
    ipcRenderer.on('MENU_LOAD_CAMPAIGN', handleLoad);
    ipcRenderer.on('MENU_TOGGLE_RESOURCE_MONITOR', handleToggleMonitor);
    ipcRenderer.on('MENU_GENERATE_DUNGEON', handleGenerateDungeon);
    ipcRenderer.on('MENU_NEW_CAMPAIGN', handleNewCampaign);
    ipcRenderer.on('MENU_SHOW_ABOUT', handleShowAbout);

    return () => {
      ipcRenderer.off('MENU_SAVE_CAMPAIGN', handleSave);
      ipcRenderer.off('MENU_LOAD_CAMPAIGN', handleLoad);
      ipcRenderer.off('MENU_TOGGLE_RESOURCE_MONITOR', handleToggleMonitor);
      ipcRenderer.off('MENU_GENERATE_DUNGEON', handleGenerateDungeon);
      ipcRenderer.off('MENU_NEW_CAMPAIGN', handleNewCampaign);
      ipcRenderer.off('MENU_SHOW_ABOUT', handleShowAbout);
    };
  }, []); // Empty dependency array as handlers use getState()

  // Handler to transition from HOME to EDITOR
  const handleStartEditor = () => {
    setViewState('EDITOR');
  };

  // If accessing Design System Playground route, show it exclusively
  if (isDesignSystemPlayground) {
    return <DesignSystemPlayground />;
  }

  // If in Architect View and on HOME screen, show the HomeScreen component
  if (isArchitectView && viewState === 'HOME') {
    return (
      <>
        {/* Global components */}
        <ThemeManager />
        <Toast />
        <ConfirmDialog />
        <AboutModal
          isOpen={isAboutOpen}
          onClose={() => setIsAboutOpen(false)}
          onCheckForUpdates={() => {
            setIsAboutOpen(false);
            setIsUpdateManagerOpen(true);
          }}
        />
        <UpdateManagerErrorBoundary>
          <UpdateManager isOpen={isUpdateManagerOpen} onClose={() => setIsUpdateManagerOpen(false)} />
        </UpdateManagerErrorBoundary>

        {/* Home/Splash Screen */}
        <HomeScreen onStartEditor={handleStartEditor} />
      </>
    );
  }

  // Otherwise, render the full editor (both Architect and World View)
  return (
    <div className="app-root w-full h-screen flex overflow-hidden" data-testid="editor-view">
      {/* Global components (rendered in both Architect and World View) */}
      <ThemeManager />
      <SyncManager />
      <PauseManager />
      <Toast />
      <ConfirmDialog />
      <DungeonGeneratorDialog />
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        onCheckForUpdates={() => {
          setIsAboutOpen(false);
          setIsUpdateManagerOpen(true);
        }}
      />
      <UpdateManagerErrorBoundary>
        <UpdateManager isOpen={isUpdateManagerOpen} onClose={() => setIsUpdateManagerOpen(false)} />
      </UpdateManagerErrorBoundary>

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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
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
            <Tooltip
              content={
                isGamePaused ? 'Resume - Players will see the map' : 'Pause - Hide map from players'
              }
            >
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
                  <RiPlayFill className="w-5 h-5" />
                ) : (
                  <RiPauseFill className="w-5 h-5" />
                )}
              </button>
            </Tooltip>
            <div className="toolbar-divider w-px mx-1"></div>
            {/* Select Tool */}
            <Tooltip content="Select (V)">
              <button
                className={`btn btn-tool p-2 ${tool === 'select' ? 'active' : ''}`}
                onClick={() => setTool('select')}
                aria-label="Select tool"
              >
                <RiCursorLine className="w-5 h-5" />
              </button>
            </Tooltip>
            {/* Marker Tool */}
            <Tooltip content="Marker (M)">
              <button
                className={`btn btn-tool p-2 ${tool === 'marker' ? 'active' : ''}`}
                onClick={() => setTool('marker')}
                aria-label="Marker tool"
              >
                <RiPencilLine className="w-5 h-5" />
              </button>
            </Tooltip>
            {/* Eraser Tool */}
            <Tooltip content="Eraser (E)">
              <button
                className={`btn btn-tool p-2 ${tool === 'eraser' ? 'active' : ''}`}
                onClick={() => setTool('eraser')}
                aria-label="Eraser tool"
              >
                <RiEraserLine className="w-5 h-5" />
              </button>
            </Tooltip>
            {/* Wall Tool */}
            <Tooltip content="Wall (W)">
              <button
                className={`btn btn-tool p-2 ${tool === 'wall' ? 'active' : ''}`}
                onClick={() => setTool('wall')}
                aria-label="Wall tool"
              >
                <RiLayoutMasonryLine className="w-5 h-5" />
              </button>
            </Tooltip>
            {/* Door Tool */}
            <Tooltip content="Door (D) - Arrow keys or R to rotate">
              <button
                className={`btn btn-tool p-2 ${tool === 'door' ? 'active' : ''}`}
                onClick={() => setTool('door')}
                aria-label="Door tool"
              >
                <RiDoorOpenLine className="w-5 h-5" />
              </button>
            </Tooltip>
            {/* Door Orientation Toggle (only visible when door tool active) */}
            {tool === 'door' && (
              <Tooltip content="Toggle orientation (R)">
                <button
                  className="btn btn-tool text-lg px-2"
                  onClick={() =>
                    setDoorOrientation((prev) =>
                      prev === 'horizontal' ? 'vertical' : 'horizontal',
                    )
                  }
                  aria-label="Toggle door orientation"
                >
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
                  aria-label="Measure tool"
                >
                  <RiRulerLine className="w-5 h-5" />
                </button>
              </Tooltip>
              {tool === 'measure' && (
                <div className="flex gap-1 ml-1 items-center">
                  <button
                    className={`btn btn-mode ${measurementMode === 'ruler' ? 'active' : ''}`}
                    onClick={() => setMeasurementMode('ruler')}
                    title="Ruler: Measure distance between two points"
                  >
                    Ruler
                  </button>
                  <button
                    className={`btn btn-mode ${measurementMode === 'blast' ? 'active' : ''}`}
                    onClick={() => setMeasurementMode('blast')}
                    title="Blast: Circular AoE (e.g., Fireball)"
                  >
                    Blast
                  </button>
                  <button
                    className={`btn btn-mode ${measurementMode === 'cone' ? 'active' : ''}`}
                    onClick={() => setMeasurementMode('cone')}
                    title="Cone: 53° cone AoE (e.g., Burning Hands)"
                  >
                    Cone
                  </button>
                  <div className="toolbar-divider w-px mx-1 h-6"></div>
                  <button
                    className={`btn btn-broadcast ${broadcastMeasurement ? 'active' : ''}`}
                    onClick={() => setBroadcastMeasurement(!broadcastMeasurement)}
                    title="Broadcast measurements to players in World View"
                  >
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
  );
}

export default App;
