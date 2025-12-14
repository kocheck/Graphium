import { useState, useEffect, useRef } from 'react'
import CanvasManager from './components/Canvas/CanvasManager'
import SyncManager from './components/SyncManager'
import Sidebar from './components/Sidebar'
import Toast from './components/Toast'
import { useGameStore } from './store/gameStore'

function App() {
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
    <div className="w-full h-screen bg-neutral-900 text-white flex overflow-hidden">
      <SyncManager />
      <Toast />

      <Sidebar />

      <div className="flex-1 relative h-full">
        <CanvasManager tool={tool} color={color} />
        {/* Toolbar */}
        <div className="fixed top-4 right-4 bg-neutral-800 p-2 rounded shadow flex gap-2 z-50">
           <button
             className={`px-3 py-1 rounded text-sm font-medium ${tool === 'select' ? 'bg-blue-600' : 'bg-neutral-600 hover:bg-neutral-500'}`}
             onClick={() => setTool('select')}>Select (V)</button>
           <button
             className={`px-3 py-1 rounded text-sm font-medium ${tool === 'marker' ? 'bg-blue-600' : 'bg-neutral-600 hover:bg-neutral-500'}`}
             onClick={() => setTool('marker')}>Marker (M)</button>
           <button
             className={`px-3 py-1 rounded text-sm font-medium ${tool === 'eraser' ? 'bg-blue-600' : 'bg-neutral-600 hover:bg-neutral-500'}`}
             onClick={() => setTool('eraser')}>Eraser (E)</button>
           <div className="w-px bg-neutral-600 mx-1"></div>
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
           <div className="w-px bg-neutral-600 mx-1"></div>
           <button className="px-3 py-1 bg-neutral-600 hover:bg-neutral-500 rounded text-sm font-medium" onClick={async () => {
              try {
                  const state = useGameStore.getState();
                  const dataToSave = {
                      tokens: state.tokens,
                      drawings: state.drawings,
                      gridSize: state.gridSize
                  };
                  // @ts-ignore
                  const result = await window.ipcRenderer.invoke('SAVE_CAMPAIGN', dataToSave);
                  if (result) alert('Campaign Saved Successfully!');
              } catch (e) {
                  console.error(e);
                  alert('Failed to save: ' + e);
              }
           }}>Save</button>
           <button className="px-3 py-1 bg-neutral-600 hover:bg-neutral-500 rounded text-sm font-medium" onClick={async () => {
              try {
                // @ts-ignore
                const state = await window.ipcRenderer.invoke('LOAD_CAMPAIGN');
                if (state) {
                    useGameStore.getState().setState(state);
                    alert('Campaign Loaded!');
                }
              } catch (e) {
                  console.error(e);
                  alert('Failed to load: ' + e);
              }
           }}>Load</button>
           <div className="w-px bg-neutral-600 mx-1"></div>
           <button className="px-3 py-1 bg-neutral-600 hover:bg-neutral-500 rounded text-sm font-medium" onClick={() => window.ipcRenderer.send('create-world-window')}>
             World View
           </button>
        </div>
      </div>
    </div>
  )
}

export default App
