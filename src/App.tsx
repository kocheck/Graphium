import { useState, useEffect, useRef } from 'react'
import CanvasManager from './components/Canvas/CanvasManager'
import SyncManager from './components/SyncManager'
import { ThemeManager } from './components/ThemeManager'
import Sidebar from './components/Sidebar'
import Toast from './components/Toast'
import TokenInspector from './components/TokenInspector'
import { useGameStore } from './store/gameStore'
import { useWindowType } from './utils/useWindowType'

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

  // Filter selected IDs to only include tokens (not drawings)
  const tokens = useGameStore((s) => s.tokens);
  const selectedTokensOnly = selectedTokenIds.filter((id) =>
    tokens.some((t) => t.id === id)
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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
        case 'i':
          colorInputRef.current?.click();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="app-root w-full h-screen flex overflow-hidden">
      {/* Global components (rendered in both Architect and World View) */}
      <ThemeManager />
      <SyncManager />
      <Toast />

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
           <div className="toolbar-divider w-px mx-1"></div>
           {/* Save button: Serialize campaign to .hyle ZIP file */}
           <button className="btn btn-default" onClick={async () => {
              if (!window.ipcRenderer) {
                alert('IPC not available');
                return;
              }
              try {
                  // Extract campaign data from store (exclude actions)
                  const state = useGameStore.getState();
                  const dataToSave = {
                      tokens: state.tokens,
                      drawings: state.drawings,
                      gridSize: state.gridSize
                  };

                  // IPC invoke to main process (shows save dialog, creates ZIP)
                  // See electron/main.ts:116-143 for handler implementation
                  // @ts-ignore
                  const result = await window.ipcRenderer.invoke('SAVE_CAMPAIGN', dataToSave);
                  if (result) alert('Campaign Saved Successfully!');
              } catch (e) {
                  console.error(e);
                  alert('Failed to save: ' + e);
              }
           }} disabled={!window.ipcRenderer}>Save</button>

           {/* Load button: Deserialize .hyle file and restore state */}
           <button className="btn btn-default" onClick={async () => {
              if (!window.ipcRenderer) {
                alert('IPC not available');
                return;
              }
              try {
                // IPC invoke to main process (shows open dialog, extracts ZIP)
                // See electron/main.ts:145-181 for handler implementation
                // @ts-ignore
                const state = await window.ipcRenderer.invoke('LOAD_CAMPAIGN');
                if (state) {
                    // Bulk update store with loaded state
                    useGameStore.getState().setState(state);
                    alert('Campaign Loaded!');
                }
              } catch (e) {
                  console.error(e);
                  alert('Failed to load: ' + e);
              }
           }} disabled={!window.ipcRenderer}>Load</button>

           <div className="toolbar-divider w-px mx-1"></div>

           {/* World View button: Create projector window for players */}
           {/* See electron/main.ts:55-73 for createWorldWindow() implementation */}
           <button className="btn btn-default" onClick={() => {
             if (!window.ipcRenderer) {
               alert('IPC not available');
               return;
             }
             window.ipcRenderer.send('create-world-window');
           }} disabled={!window.ipcRenderer}>
             World View
           </button>
        </div>
        )}

        {/* Token Inspector (only show when tokens selected) */}
        {selectedTokensOnly.length > 0 && (
          <TokenInspector selectedTokenIds={selectedTokensOnly} />
        )}
      </div>
    </div>
  )
}

export default App
