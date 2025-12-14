import { useState } from 'react'
import CanvasManager from './components/Canvas/CanvasManager'
import SyncManager from './components/SyncManager'
import Sidebar from './components/Sidebar'
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

  return (
    <div className="w-full h-screen bg-neutral-900 text-white flex overflow-hidden">
      <SyncManager />

      <Sidebar />

      <div className="flex-1 relative h-full">
        <CanvasManager tool={tool} />
        {/* Toolbar */}
        <div className="fixed top-4 right-4 bg-neutral-800 p-2 rounded shadow flex gap-2 z-50">
           <button
             className={`px-3 py-1 rounded text-sm font-medium ${tool === 'select' ? 'bg-blue-600' : 'bg-neutral-600 hover:bg-neutral-500'}`}
             onClick={() => setTool('select')}>Select</button>
           <button
             className={`px-3 py-1 rounded text-sm font-medium ${tool === 'marker' ? 'bg-blue-600' : 'bg-neutral-600 hover:bg-neutral-500'}`}
             onClick={() => setTool('marker')}>Marker</button>
           <button
             className={`px-3 py-1 rounded text-sm font-medium ${tool === 'eraser' ? 'bg-blue-600' : 'bg-neutral-600 hover:bg-neutral-500'}`}
             onClick={() => setTool('eraser')}>Eraser</button>
           <div className="w-px bg-neutral-600 mx-1"></div>
           {/* Save button: Serialize campaign to .hyle ZIP file */}
           <button className="px-3 py-1 bg-neutral-600 hover:bg-neutral-500 rounded text-sm font-medium" onClick={async () => {
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
           }}>Save</button>

           {/* Load button: Deserialize .hyle file and restore state */}
           <button className="px-3 py-1 bg-neutral-600 hover:bg-neutral-500 rounded text-sm font-medium" onClick={async () => {
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
           }}>Load</button>

           <div className="w-px bg-neutral-600 mx-1"></div>

           {/* World View button: Create projector window for players */}
           {/* See electron/main.ts:55-73 for createWorldWindow() implementation */}
           <button className="px-3 py-1 bg-neutral-600 hover:bg-neutral-500 rounded text-sm font-medium" onClick={() => window.ipcRenderer.send('create-world-window')}>
             World View
           </button>
        </div>
      </div>
    </div>
  )
}

export default App
