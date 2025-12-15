import { useState, useEffect, useRef } from 'react'
import CanvasManager from './components/Canvas/CanvasManager'
import SyncManager from './components/SyncManager'
import { ThemeManager } from './components/ThemeManager'
import Sidebar from './components/Sidebar'
import Toast from './components/Toast'
import { useGameStore } from './store/gameStore'

/**
 * App is the root component for Hyle's Architect View (DM control panel)
 *
 * This component orchestrates the main UI layout and tool state management.
 * It combines the three core components (SyncManager, Sidebar, CanvasManager)
 * and provides the toolbar for tool selection and campaign management.
 *
 * **Component hierarchy:**
 * ```
 * App (root)
 *   ├── SyncManager (invisible, handles IPC sync)
 *   ├── Sidebar (left panel, token library)
 *   └── Main area
 *       ├── CanvasManager (battlemap canvas)
 *       └── Toolbar (floating top-right)
 *           ├── Tool buttons (Select, Marker, Eraser)
 *           ├── Save/Load campaign buttons
 *           └── World View button
 * ```
 *
 * **Tool state:**
 * Manages the active drawing/interaction tool and passes it to CanvasManager.
 * Tool changes affect CanvasManager behavior (pan, draw marker, draw eraser).
 *
 * **Campaign management:**
 * - Save button: Serializes store state to .hyle ZIP file via IPC
 * - Load button: Deserializes .hyle file and updates store via IPC
 * - Both use Electron dialog API (handled by main process)
 *
 * **World View:**
 * - Creates separate projector window via IPC
 * - World Window receives read-only state updates via SyncManager
 * - DM controls from this window, players see World Window
 *
 * @returns Root UI with Sidebar, CanvasManager, and toolbar
 *
 * @example
 * // This is the root component rendered in main.tsx:
 * ReactDOM.createRoot(document.getElementById('root')!).render(
 *   <React.StrictMode>
 *     <App />
 *   </React.StrictMode>
 * )
 */
function App() {
  // Active tool state (controls CanvasManager behavior)
  const [tool, setTool] = useState<'select' | 'marker' | 'eraser'>('select');
  const [color, setColor] = useState('#df4b26');
  const colorInputRef = useRef<HTMLInputElement>(null);

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
      <ThemeManager />
      <SyncManager />
      <Toast />

      <Sidebar />

      <div className="flex-1 relative h-full">
        <CanvasManager tool={tool} color={color} />
        {/* Toolbar */}
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
      </div>
    </div>
  )
}

export default App
