import type React from 'react';
import { useState, useEffect, useMemo, lazy, Suspense } from 'react';

import { Agentation } from 'agentation';

import CanvasManager from './components/Canvas/CanvasManager';
import ConfirmDialog from './components/Dialogs/ConfirmDialog';
import UpdateManagerErrorBoundary from './components/ErrorBoundaries/UpdateManagerErrorBoundary';
import { HomeScreen } from './components/HomeScreen';
import { LoadingOverlay } from './components/LoadingOverlay';
import AutoSaveManager from './components/Managers/AutoSaveManager';
import { PauseManager } from './components/Managers/PauseManager';
import SyncManager from './components/Managers/SyncManager';
import { ThemeManager } from './components/Managers/ThemeManager';
import MobileToolbar from './components/Mobile/MobileToolbar';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import TokenInspector from './components/TokenInspector';
import Toolbar from './components/Toolbar';
import { useCommandPalette } from './hooks/useCommandPalette';
import { useLibraryLoader } from './hooks/useLibraryLoader';
import { useIsMobile } from './hooks/useMediaQuery';
import { useMenuCommands } from './hooks/useMenuCommands';
import { useToolState } from './hooks/useToolState';
import { useGameStore } from './store/gameStore';
import { useUiStore } from './store/uiStore';
import { rollForMessage } from './utils/systemMessages';
import { useWindowType } from './utils/useWindowType';

// Lazy-loaded components — infrequently used modals/panels (Session 11 code splitting)
const DesignSystemPlayground = lazy(() =>
  import('./components/DesignSystemPlayground/DesignSystemPlayground').then((m) => ({
    default: m.DesignSystemPlayground,
  })),
);
const AboutModal = lazy(() =>
  import('./components/Dialogs/AboutModal').then((m) => ({ default: m.AboutModal })),
);
const DungeonGeneratorDialog = lazy(() =>
  import('./components/Dialogs/DungeonGeneratorDialog').then((m) => ({
    default: m.DungeonGeneratorDialog,
  })),
);
const CommandPalette = lazy(() => import('./components/AssetLibrary/CommandPalette'));
const ResourceMonitor = lazy(() => import('./components/ResourceMonitor'));
const UpdateManager = lazy(() => import('./components/Managers/UpdateManager'));

/**
 * App — Root component with dual-window architecture
 *
 * Renders differently based on window type:
 * - **Architect View**: Full DM control panel with editing tools
 * - **World View**: Sanitized canvas-only display for projection
 * - **Design System**: Component playground (dev only)
 *
 * @see src/utils/useWindowType.ts for window detection
 * @see src/components/Canvas/CanvasManager.tsx for canvas rendering
 */
// eslint-disable-next-line max-lines-per-function, complexity
function App(): React.JSX.Element {
  // Detect window type for UI sanitization
  const { isArchitectView, isWorldView } = useWindowType();
  const isDesignSystemPlayground = window.location.pathname === '/design-system';

  // View state: HOME (splash screen) or EDITOR (main app)
  const [viewState, setViewState] = useState<'HOME' | 'EDITOR'>(isWorldView ? 'EDITOR' : 'HOME');

  // Mobile responsiveness
  const isMobile = useIsMobile();
  const setMobileSidebarOpen = useUiStore((state) => state.setMobileSidebarOpen);

  // Tool state (tool selection, colors, door orientation, measurement mode, keyboard shortcuts)
  const toolState = useToolState({ isArchitectView });

  // Selected tokens state (for TokenInspector)
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [isPaletteOpen, setPaletteOpen] = useCommandPalette();
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isUpdateManagerOpen, setIsUpdateManagerOpen] = useState(false);

  // Store state
  const showResourceMonitor = useUiStore((state) => state.showResourceMonitor);
  const isGamePaused = useUiStore((state) => state.isGamePaused);
  const showToast = useUiStore((state) => state.showToast);

  // Pause toggle (used by desktop toolbar, mobile toolbar, and command palette)
  const handlePauseToggle = (): void => {
    if (!window.ipcRenderer) {
      return;
    }
    void (async () => {
      try {
        await window.ipcRenderer?.invoke('TOGGLE_PAUSE');
      } catch (e) {
        console.error('[App] Failed to toggle pause:', e);
        showToast(rollForMessage('PAUSE_TOGGLE_FAILED'), 'error');
      }
    })();
  };

  // Filter selected IDs to only include tokens (not drawings)
  const tokens = useGameStore((s) => s.tokens);
  const selectedTokensOnly = useMemo(
    () => selectedTokenIds.filter((id) => tokens.some((t) => t.id === id)),
    [selectedTokenIds, tokens],
  );

  // Load library index on startup (Architect View only)
  useLibraryLoader(isArchitectView);

  // Modal keyboard shortcuts (About: ?, Escape; UpdateManager: Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.key === '?' || (e.shiftKey && e.key === '/')) && !isAboutOpen) {
        e.preventDefault();
        setIsAboutOpen(true);
        return;
      }

      if (e.key === 'Escape' && isAboutOpen) {
        setIsAboutOpen(false);
        return;
      }

      if (e.key === 'Escape' && isUpdateManagerOpen) {
        setIsUpdateManagerOpen(false);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAboutOpen, isUpdateManagerOpen]);

  // Electron IPC menu command handlers (save, load, new, about, etc.)
  useMenuCommands({ onShowAbout: () => setIsAboutOpen(true) });

  // Design System Playground route (dev only)
  if (isDesignSystemPlayground) {
    return (
      <>
        <Suspense fallback={<div style={{ padding: '2rem' }}>Loading playground...</div>}>
          <DesignSystemPlayground />
        </Suspense>
        {import.meta.env.DEV && <Agentation />}
      </>
    );
  }

  // Home screen (Architect View only)
  if (isArchitectView && viewState === 'HOME') {
    return (
      <>
        <ThemeManager />
        <Toast />
        <ConfirmDialog />
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
        <UpdateManagerErrorBoundary>
          <Suspense fallback={null}>
            <UpdateManager
              isOpen={isUpdateManagerOpen}
              onClose={() => setIsUpdateManagerOpen(false)}
            />
          </Suspense>
        </UpdateManagerErrorBoundary>
        <HomeScreen onStartEditor={() => setViewState('EDITOR')} />
        {import.meta.env.DEV && <Agentation />}
      </>
    );
  }

  // Editor view (both Architect and World View)
  return (
    <div className="app-root w-full h-screen flex overflow-hidden" data-testid="editor-view">
      {/* Skip-to-content link for keyboard users (WCAG 2.4.1) */}
      <a href="#canvas-main" className="skip-to-content">
        Skip to canvas
      </a>

      {/* Global components */}
      <ThemeManager />
      <SyncManager />
      <PauseManager />
      <Toast />
      <ConfirmDialog />
      <Suspense fallback={null}>
        <DungeonGeneratorDialog wallColor={toolState.wallColor} wallSize={toolState.wallSize} />
      </Suspense>
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
      <UpdateManagerErrorBoundary>
        <Suspense fallback={null}>
          <UpdateManager
            isOpen={isUpdateManagerOpen}
            onClose={() => setIsUpdateManagerOpen(false)}
          />
        </Suspense>
      </UpdateManagerErrorBoundary>

      {isWorldView && <LoadingOverlay />}
      {isArchitectView && <AutoSaveManager />}
      {isArchitectView && (
        <nav aria-label="Campaign tools">
          <Sidebar />
        </nav>
      )}

      <main id="canvas-main" className="flex-1 relative h-full transition-all duration-300">
        {/* Mobile Hamburger Menu Button */}
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

        <CanvasManager
          tool={toolState.tool}
          color={toolState.color}
          doorOrientation={toolState.doorOrientation}
          wallColor={toolState.wallColor}
          wallSize={toolState.wallSize}
          isWorldView={isWorldView}
          onSelectionChange={setSelectedTokenIds}
          measurementMode={toolState.measurementMode}
        />

        {/* Desktop Toolbar (Architect View only) */}
        {isArchitectView && !isMobile && (
          <Toolbar
            toolState={toolState}
            isGamePaused={isGamePaused}
            onPauseToggle={handlePauseToggle}
          />
        )}

        {isArchitectView && showResourceMonitor && (
          <Suspense fallback={null}>
            <ResourceMonitor />
          </Suspense>
        )}

        {isArchitectView && selectedTokensOnly.length > 0 && (
          <TokenInspector
            selectedTokenIds={selectedTokensOnly}
            onClose={() => setSelectedTokenIds([])}
          />
        )}

        {isArchitectView && (
          <Suspense fallback={null}>
            <CommandPalette
              isOpen={isPaletteOpen}
              onClose={() => setPaletteOpen(false)}
              onSetTool={toolState.setTool}
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
              onOpenDungeonGenerator={() => useUiStore.getState().showDungeonDialog()}
              isGamePaused={isGamePaused}
            />
          </Suspense>
        )}

        {isArchitectView && isMobile && (
          <MobileToolbar
            tool={toolState.tool}
            setTool={toolState.setTool}
            color={toolState.color}
            setColor={toolState.setColor}
            doorOrientation={toolState.doorOrientation}
            setDoorOrientation={toolState.setDoorOrientation}
            isGamePaused={isGamePaused}
            onPauseToggle={handlePauseToggle}
          />
        )}
      </main>
      {import.meta.env.DEV && <Agentation />}
    </div>
  );
}

export default App;
