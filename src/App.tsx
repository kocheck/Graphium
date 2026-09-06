import { lazy, Suspense, useState, useEffect, useRef } from 'react';

import CommandPalette from './components/AssetLibrary/CommandPalette';
import AutoSaveManager from './components/AutoSaveManager';
import CanvasHost from './components/CanvasHost';
import ConfirmDialog from './components/ConfirmDialog';
import DungeonGeneratorDialogGate from './components/DungeonGeneratorDialogGate';
import { LoadingOverlay } from './components/LoadingOverlay';
import MobileToolbar from './components/MobileToolbar';
import { PauseManager } from './components/PauseManager';
import ResourceMonitor from './components/ResourceMonitor';
import { SessionConsoleEscapeStop } from './components/SessionConsole/SessionConsoleEscapeStop';
import SyncManager from './components/SyncManager';
import { ThemeManager } from './components/ThemeManager';
import Toast from './components/Toast';
import TokenInspectorGate from './components/TokenInspectorGate';
import Toolbar from './components/Toolbar';
import UpdateManager from './components/UpdateManager';
import UpdateManagerErrorBoundary from './components/UpdateManagerErrorBoundary';
import { useCommandPalette } from './hooks/useCommandPalette';
import { useIsMobile } from './hooks/useMediaQuery';
import { ProfiledBoundary, ProfiledSidebar } from './perf/profiler';
import { getStorage } from './services/storage';
import { useGameStore } from './store/gameStore';
import { useUiStore } from './store/uiStore';
import { addRecentCampaignWithPlatform } from './utils/recentCampaigns';
import { loadStressFixture, shouldAutoloadStressFixture } from './utils/stressFixture';
import { rollForMessage } from './utils/systemMessages';
import { useWindowType } from './utils/useWindowType';

const WorldStage = lazy(async () => {
  const module = await import('./components/SessionConsole/WorldStage');
  return { default: module.WorldStage };
});

const DesignSystemPlayground = lazy(async () => {
  const module = await import('./components/DesignSystemPlayground/DesignSystemPlayground');
  return { default: module.DesignSystemPlayground };
});

const HomeScreen = lazy(async () => {
  const module = await import('./components/HomeScreen');
  return { default: module.HomeScreen };
});

const AboutModal = lazy(async () => {
  const module = await import('./components/AboutModal');
  return { default: module.AboutModal };
});

// Dev-only feedback toolbar. The ternary lets the production build drop the import entirely.
const Agentation = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import('agentation');
      return { default: module.Agentation };
    })
  : (): null => null;

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
// eslint-disable-next-line max-lines-per-function, complexity
function App(): React.JSX.Element {
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

  const colorInputRef = useRef<HTMLInputElement>(null);

  const broadcastMeasurement = useGameStore((state) => state.broadcastMeasurement);
  const setBroadcastMeasurement = useGameStore((state) => state.setBroadcastMeasurement);

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
  const handlePauseToggle = async (): Promise<void> => {
    if (!window.ipcRenderer) {
      return;
    }
    try {
      await window.ipcRenderer.invoke('TOGGLE_PAUSE');
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error('[App] Failed to toggle pause:', e);
      }
      showToast(rollForMessage('PAUSE_TOGGLE_FAILED'), 'error');
    }
  };

  // Load library index on startup (Architect View only)
  useEffect(() => {
    if (!isArchitectView) {
      return;
    }

    const loadLibrary = async (): Promise<void> => {
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
        if (import.meta.env.DEV) {
          console.error('[App] Failed to load library index:', error);
        }
        // Don't show toast - this is a non-critical error on startup
      }
    };

    void loadLibrary();
  }, [isArchitectView]);

  useEffect(() => {
    if (shouldAutoloadStressFixture()) {
      loadStressFixture();
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line complexity
    const handleKeyDown = (e: KeyboardEvent): void => {
      const ui = useUiStore.getState();
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

      // Prevent tool switching in World View (player mode)
      if (!isArchitectView) {
        return;
      }

      // Handle arrow keys separately (they don't need toLowerCase)
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (ui.tool === 'door') {
          e.preventDefault(); // Prevent page scrolling
          ui.toggleDoorOrientation();
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          ui.setTool('select');
          break;
        case 'm':
          ui.setTool('marker');
          break;
        case 'e':
          ui.setTool('eraser');
          break;
        case 'w':
          ui.setTool('wall');
          break;
        case 'd':
          ui.setTool('door');
          break;
        case 'r':
          // If door tool is active, rotate door orientation
          // Otherwise, switch to measure tool
          if (ui.tool === 'door') {
            ui.toggleDoorOrientation();
          } else {
            ui.setTool('measure');
          }
          break;
        case 'i':
          colorInputRef.current?.click();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isArchitectView, isAboutOpen, isUpdateManagerOpen]);

  // Handle Menu Commands (Electron IPC)
  useEffect(() => {
    const ipcRenderer = window.ipcRenderer;
    if (!ipcRenderer) {
      return;
    }

    const handleSave = async (): Promise<void> => {
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
        if (import.meta.env.DEV) {
          console.error(e);
        }
        useGameStore
          .getState()
          .showToast(rollForMessage('CAMPAIGN_SAVE_FAILED', { error: String(e) }), 'error');
      }
    };

    const handleLoad = async (): Promise<void> => {
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
        if (import.meta.env.DEV) {
          console.error(e);
        }
        useGameStore
          .getState()
          .showToast(rollForMessage('CAMPAIGN_LOAD_FAILED', { error: String(e) }), 'error');
      }
    };

    const handleToggleMonitor = (): void => {
      useGameStore.getState().setShowResourceMonitor(!useGameStore.getState().showResourceMonitor);
    };

    const handleGenerateDungeon = (): void => {
      useGameStore.getState().showDungeonDialog();
    };

    const handleNewCampaign = (): void => {
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

    const handleShowAbout = (): void => {
      setIsAboutOpen(true);
    };

    const saveWrapper = (): void => {
      void handleSave();
    };
    const loadWrapper = (): void => {
      void handleLoad();
    };

    ipcRenderer.on('MENU_SAVE_CAMPAIGN', saveWrapper);
    ipcRenderer.on('MENU_LOAD_CAMPAIGN', loadWrapper);
    ipcRenderer.on('MENU_TOGGLE_RESOURCE_MONITOR', handleToggleMonitor);
    ipcRenderer.on('MENU_GENERATE_DUNGEON', handleGenerateDungeon);
    ipcRenderer.on('MENU_NEW_CAMPAIGN', handleNewCampaign);
    ipcRenderer.on('MENU_SHOW_ABOUT', handleShowAbout);

    return (): void => {
      ipcRenderer.off('MENU_SAVE_CAMPAIGN', saveWrapper);
      ipcRenderer.off('MENU_LOAD_CAMPAIGN', loadWrapper);
      ipcRenderer.off('MENU_TOGGLE_RESOURCE_MONITOR', handleToggleMonitor);
      ipcRenderer.off('MENU_GENERATE_DUNGEON', handleGenerateDungeon);
      ipcRenderer.off('MENU_NEW_CAMPAIGN', handleNewCampaign);
      ipcRenderer.off('MENU_SHOW_ABOUT', handleShowAbout);
    };
  }, []); // Empty dependency array as handlers use getState()

  // Handler to transition from HOME to EDITOR
  const handleStartEditor = (): void => {
    setViewState('EDITOR');
  };

  // If accessing Design System Playground route, show it exclusively
  if (isDesignSystemPlayground) {
    return (
      <>
        <Suspense fallback={null}>
          <DesignSystemPlayground />
        </Suspense>
        {import.meta.env.DEV && (
          <Suspense fallback={null}>
            <Agentation />
          </Suspense>
        )}
      </>
    );
  }

  // If in Architect View and on HOME screen, show the HomeScreen component
  if (isArchitectView && viewState === 'HOME') {
    return (
      <>
        {/* Global components */}
        <ProfiledBoundary id="ThemeManager">
          <ThemeManager />
        </ProfiledBoundary>
        <ProfiledBoundary id="Toast">
          <Toast />
        </ProfiledBoundary>
        <ProfiledBoundary id="ConfirmDialog">
          <ConfirmDialog />
        </ProfiledBoundary>
        {isAboutOpen && (
          <ProfiledBoundary id="AboutModal">
            <Suspense fallback={null}>
              <AboutModal
                isOpen={isAboutOpen}
                onClose={() => setIsAboutOpen(false)}
                onCheckForUpdates={() => {
                  setIsAboutOpen(false);
                  setIsUpdateManagerOpen(true);
                }}
              />
            </Suspense>
          </ProfiledBoundary>
        )}
        <UpdateManagerErrorBoundary>
          <ProfiledBoundary id="UpdateManager">
            <UpdateManager
              isOpen={isUpdateManagerOpen}
              onClose={() => setIsUpdateManagerOpen(false)}
            />
          </ProfiledBoundary>
        </UpdateManagerErrorBoundary>

        {/* Home/Splash Screen */}
        <Suspense fallback={null}>
          <HomeScreen onStartEditor={handleStartEditor} />
        </Suspense>
        {import.meta.env.DEV && (
          <Suspense fallback={null}>
            <Agentation />
          </Suspense>
        )}
      </>
    );
  }

  // Otherwise, render the full editor (both Architect and World View)
  return (
    <div className="app-root w-full h-screen flex overflow-hidden" data-testid="editor-view">
      {/* Global components (rendered in both Architect and World View) */}
      <ProfiledBoundary id="ThemeManager">
        <ThemeManager />
      </ProfiledBoundary>
      <ProfiledBoundary id="SyncManager">
        <SyncManager />
      </ProfiledBoundary>
      <ProfiledBoundary id="PauseManager">
        <PauseManager />
      </ProfiledBoundary>
      <ProfiledBoundary id="Toast">
        <Toast />
      </ProfiledBoundary>
      <ProfiledBoundary id="ConfirmDialog">
        <ConfirmDialog />
      </ProfiledBoundary>
      <ProfiledBoundary id="DungeonGeneratorDialog">
        <DungeonGeneratorDialogGate />
      </ProfiledBoundary>
      {isAboutOpen && (
        <ProfiledBoundary id="AboutModal">
          <Suspense fallback={null}>
            <AboutModal
              isOpen={isAboutOpen}
              onClose={() => setIsAboutOpen(false)}
              onCheckForUpdates={() => {
                setIsAboutOpen(false);
                setIsUpdateManagerOpen(true);
              }}
            />
          </Suspense>
        </ProfiledBoundary>
      )}
      <UpdateManagerErrorBoundary>
        <ProfiledBoundary id="UpdateManager">
          <UpdateManager
            isOpen={isUpdateManagerOpen}
            onClose={() => setIsUpdateManagerOpen(false)}
          />
        </ProfiledBoundary>
      </UpdateManagerErrorBoundary>

      {/* Loading Overlay: Only render in World View to block players' view */}
      {isWorldView && <LoadingOverlay />}
      {isWorldView && (
        <Suspense fallback={null}>
          <WorldStage />
        </Suspense>
      )}

      {/* Auto-save (Architect View only) */}
      {isArchitectView && (
        <ProfiledBoundary id="SessionConsoleEscapeStop">
          <SessionConsoleEscapeStop defer={isAboutOpen || isUpdateManagerOpen} />
        </ProfiledBoundary>
      )}
      {isArchitectView && (
        <ProfiledBoundary id="AutoSaveManager">
          <AutoSaveManager />
        </ProfiledBoundary>
      )}

      {/* Sidebar: Only render in Architect View (DM's token library) */}
      {isArchitectView && <ProfiledSidebar />}

      <div className="flex-1 relative h-full transition-all duration-base">
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
        <CanvasHost isWorldView={isWorldView} />

        {/* Toolbar: Desktop or Mobile (Architect View only) */}
        {isArchitectView && !isMobile && (
          <ProfiledBoundary id="Toolbar">
            <Toolbar
              colorInputRef={colorInputRef}
              broadcastMeasurement={broadcastMeasurement}
              setBroadcastMeasurement={setBroadcastMeasurement}
              isGamePaused={isGamePaused}
              onPauseToggle={(): void => {
                void handlePauseToggle();
              }}
            />
          </ProfiledBoundary>
        )}

        {/* Resource Monitor: Performance diagnostics overlay (Architect View only) */}
        {isArchitectView && showResourceMonitor && <ResourceMonitor />}

        {/* Token Inspector (only show in Architect View when tokens selected) */}
        {isArchitectView && (
          <ProfiledBoundary id="TokenInspector">
            <TokenInspectorGate />
          </ProfiledBoundary>
        )}

        {/* Command Palette: Quick actions & asset search (Cmd+P, Architect View only) */}
        {isArchitectView && (
          <ProfiledBoundary id="CommandPalette">
            <CommandPalette
              isOpen={isPaletteOpen}
              onClose={() => setPaletteOpen(false)}
              onTogglePause={(): void => {
                void handlePauseToggle();
              }}
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
          </ProfiledBoundary>
        )}

        {/* Mobile Toolbar: Bottom navigation bar (Architect View only, mobile only) */}
        {isArchitectView && isMobile && (
          <MobileToolbar
            isGamePaused={isGamePaused}
            onPauseToggle={(): void => {
              void handlePauseToggle();
            }}
          />
        )}
      </div>
      {import.meta.env.DEV && (
        <Suspense fallback={null}>
          <Agentation />
        </Suspense>
      )}
    </div>
  );
}

export default App;
