# Graphium Tutorial Guides

This document provides step-by-step tutorials for common development tasks in Graphium. Each tutorial includes complete code examples and explanations.

## Table of Contents

1. [Getting Started](#tutorial-1-getting-started)
2. [Adding a New IPC Channel](#tutorial-2-adding-a-new-ipc-channel)
3. [Creating a New Component](#tutorial-3-creating-a-new-component)
4. [Adding a New State Property](#tutorial-4-adding-a-new-state-property)
5. [Implementing a New Drawing Tool](#tutorial-5-implementing-a-new-drawing-tool)
6. [Adding a New Toolbar Button](#tutorial-6-adding-a-new-toolbar-button)
7. [Understanding the Asset Pipeline](#tutorial-7-understanding-the-asset-pipeline)
8. [Debugging IPC Communication](#tutorial-8-debugging-ipc-communication)
9. [Testing State Synchronization](#tutorial-9-testing-state-synchronization)
10. [Creating Custom Protocol Handlers](#tutorial-10-creating-custom-protocol-handlers)

---

## Tutorial 1: Getting Started

**Goal:** Set up development environment and run Graphium locally.

### Prerequisites

- Node.js 18.x or 20.x
- npm or yarn
- Git

### Steps

**1. Clone the repository:**

```bash
git clone https://github.com/username/Graphium.git
cd Graphium
```

**2. Install dependencies:**

```bash
npm install
```

**3. Start development server:**

```bash
npm run dev
```

This starts:
- Vite dev server (React app) on http://localhost:5173
- Electron main process (launches desktop app)

**4. Verify setup:**

- Architect Window should open automatically
- Click "World View" button → World Window should open
- Drag token from sidebar onto canvas
- Drawing tools should work (Marker, Eraser)

**5. Enable DevTools:**

- Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Opt+I` (Mac)
- Check Console for errors
- Check Network tab for media:// protocol requests

### Expected Result

You should see:
- Architect Window with Sidebar, Canvas, and Toolbar
- Grid overlay on canvas
- Ability to drag tokens and draw with marker

### Troubleshooting

**Issue: "Cannot find module"**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Issue: Blank white screen**
```bash
# Clear Vite cache
rm -rf .vite dist dist-electron
npm run dev
```

---

## Tutorial 2: Adding a New IPC Channel

**Goal:** Add a new IPC channel to clear all drawings from the canvas.

### Use Case

DM wants to clear all marker/eraser strokes without clearing tokens.

### Steps

**1. Add IPC handler in main process** (`electron/main.ts`):

```typescript
// Add inside app.whenReady().then(() => { ... })

/**
 * IPC handler: CLEAR_DRAWINGS
 *
 * Sends command to clear all drawings in both windows.
 * This is a broadcast command that doesn't modify state in main process.
 */
ipcMain.on('CLEAR_DRAWINGS', () => {
  // Broadcast to all windows
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('CLEAR_DRAWINGS_CONFIRMED')
  }
  if (worldWindow && !worldWindow.isDestroyed()) {
    worldWindow.webContents.send('CLEAR_DRAWINGS_CONFIRMED')
  }
})
```

**2. Add store action** (`src/store/gameStore.ts`):

```typescript
interface GameState {
  // ... existing properties
  clearDrawings: () => void  // Add this line
}

export const useGameStore = create<GameState>((set) => ({
  // ... existing state
  clearDrawings: () => set({ drawings: [] }),
}))
```

**3. Add listener in renderer** (`src/components/SyncManager.tsx`):

```typescript
useEffect(() => {
  // Listen for clear command from main process
  window.ipcRenderer.on('CLEAR_DRAWINGS_CONFIRMED', () => {
    useGameStore.getState().clearDrawings()
  })

  return () => {
    window.ipcRenderer.off('CLEAR_DRAWINGS_CONFIRMED', () => {})
  }
}, [])
```

**4. Add button in toolbar** (`src/App.tsx`):

```typescript
<button
  className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm font-medium"
  onClick={() => {
    if (confirm('Clear all drawings?')) {
      // @ts-ignore
      window.ipcRenderer.send('CLEAR_DRAWINGS')
    }
  }}
>
  Clear Drawings
</button>
```

**5. Update IPC documentation** (`IPC_API.md`):

Add new section documenting the CLEAR_DRAWINGS channel.

### Testing

1. Draw some marker strokes
2. Click "Clear Drawings" button
3. Confirm dialog appears
4. After confirming, all drawings should disappear
5. Tokens should remain (not cleared)
6. Check World Window also cleared drawings

### Expected Result

- New button in toolbar
- Clicking button clears all drawings in both windows
- Tokens remain unchanged
- State synchronizes correctly

---

## Tutorial 3: Creating a New Component

**Goal:** Create a new StatusBar component to show token count.

### Steps

**1. Create component file** (`src/components/StatusBar.tsx`):

```typescript
import { useGameStore } from '../store/gameStore'

/**
 * StatusBar displays campaign statistics
 *
 * Shows real-time counts of tokens and drawings on the battlemap.
 * Appears as a footer bar at the bottom of the Architect View.
 */
const StatusBar = () => {
  const { tokens, drawings } = useGameStore()

  return (
    <div className="w-full bg-neutral-800 border-t border-neutral-700 px-4 py-2 flex gap-6 text-sm text-neutral-400">
      <div>
        <span className="font-medium text-white">{tokens.length}</span> tokens
      </div>
      <div>
        <span className="font-medium text-white">{drawings.length}</span> drawings
      </div>
    </div>
  )
}

export default StatusBar
```

**2. Import in App.tsx** (`src/App.tsx`):

```typescript
import StatusBar from './components/StatusBar'

function App() {
  // ... existing code

  return (
    <div className="w-full h-screen bg-neutral-900 text-white flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        <SyncManager />
        <Sidebar />
        <div className="flex-1 relative h-full">
          <CanvasManager tool={tool} />
          {/* ... toolbar ... */}
        </div>
      </div>
      <StatusBar />  {/* Add this line */}
    </div>
  )
}
```

**3. Add JSDoc documentation** (already included above).

**4. Test reactivity:**

- Add token → count should increment
- Add drawing → count should increment
- Load campaign → counts should update
- Clear all → counts should reset to 0

### Expected Result

- StatusBar appears at bottom of Architect View
- Shows live token and drawing counts
- Updates automatically when state changes
- Does NOT appear in World View (only in App component)

---

## Tutorial 4: Adding a New State Property

**Goal:** Add a `backgroundColor` property to allow customizable canvas background.

### Steps

**1. Update store interface** (`src/store/gameStore.ts`):

```typescript
interface GameState {
  tokens: Token[]
  drawings: Drawing[]
  gridSize: number
  backgroundColor: string  // Add this

  addToken: (token: Token) => void
  addDrawing: (drawing: Drawing) => void
  setState: (state: Partial<GameState>) => void
  setBackgroundColor: (color: string) => void  // Add this
}
```

**2. Add default value and action**:

```typescript
export const useGameStore = create<GameState>((set) => ({
  tokens: [],
  drawings: [],
  gridSize: 50,
  backgroundColor: '#171717',  // Default: neutral-900

  addToken: (token) => set((state) => ({
    tokens: [...state.tokens, token]
  })),

  addDrawing: (drawing) => set((state) => ({
    drawings: [...state.drawings, drawing]
  })),

  setState: (newState) => set(newState),

  setBackgroundColor: (color) => set({ backgroundColor: color }),
}))
```

**3. Use in CanvasManager** (`src/components/Canvas/CanvasManager.tsx`):

```typescript
const CanvasManager = ({ tool = 'select' }: CanvasManagerProps) => {
  const { tokens, drawings, gridSize, backgroundColor, addToken, addDrawing } = useGameStore()

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden relative"
      style={{ backgroundColor }}  // Apply dynamic background
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* ... rest of component */}
    </div>
  )
}
```

**4. Add color picker in toolbar** (`src/App.tsx`):

```typescript
<input
  type="color"
  value={useGameStore(state => state.backgroundColor)}
  onChange={(e) => useGameStore.getState().setBackgroundColor(e.target.value)}
  className="w-10 h-8 rounded cursor-pointer"
  title="Background Color"
/>
```

**5. Update save/load to persist color** (`electron/main.ts`):

```typescript
// In SAVE_CAMPAIGN handler:
const dataToSave = {
  tokens: state.tokens,
  drawings: state.drawings,
  gridSize: state.gridSize,
  backgroundColor: state.backgroundColor,  // Add this
}

// LOAD_CAMPAIGN already handles it via setState()
```

**6. Update SyncManager to sync color** (`src/components/SyncManager.tsx`):

```typescript
// Already handled automatically by full state sync
// backgroundColor is included in state object sent via SYNC_WORLD_STATE
```

### Testing

1. Change background color in Architect View
2. Verify World View updates to same color
3. Save campaign
4. Load campaign → color should persist
5. Try different colors (dark, light, custom)

### Expected Result

- Color picker appears in toolbar
- Changing color updates canvas immediately
- Color syncs to World Window
- Color persists in saved campaigns

---

## Tutorial 5: Implementing a New Drawing Tool

**Goal:** Add a "Rectangle" drawing tool.

### Steps

**1. Update tool type** (`src/App.tsx` and `CanvasManager.tsx`):

```typescript
// Before:
type Tool = 'select' | 'marker' | 'eraser'

// After:
type Tool = 'select' | 'marker' | 'eraser' | 'rectangle'
```

**2. Update Drawing interface** (`src/store/gameStore.ts`):

```typescript
interface Drawing {
  id: string
  tool: 'marker' | 'eraser' | 'rectangle'  // Add rectangle
  points: number[]  // For rectangle: [x, y, width, height]
  color: string
  size: number
}
```

**3. Add rectangle drawing logic** (`src/components/Canvas/CanvasManager.tsx`):

```typescript
import { Rect } from 'react-konva'  // Add import

// In handleMouseDown:
const handleMouseDown = (e: any) => {
  if (tool === 'select') return

  isDrawing.current = true
  const pos = e.target.getStage().getPointerPosition()

  currentLine.current = {
    id: crypto.randomUUID(),
    tool: tool,
    points: tool === 'rectangle'
      ? [pos.x, pos.y, 0, 0]  // [x, y, width, height]
      : [pos.x, pos.y],       // For marker/eraser
    color: tool === 'eraser' ? '#000000' : '#df4b26',
    size: tool === 'eraser' ? 20 : 5,
  }
}

// In handleMouseMove:
const handleMouseMove = (e: any) => {
  if (!isDrawing.current || tool === 'select') return

  const stage = e.target.getStage()
  const point = stage.getPointerPosition()
  const cur = currentLine.current

  if (tool === 'rectangle') {
    // Update width and height
    const [startX, startY] = cur.points
    cur.points = [startX, startY, point.x - startX, point.y - startY]
  } else {
    // Append point for marker/eraser
    cur.points = cur.points.concat([point.x, point.y])
  }

  setTempLine({...cur})
}
```

**4. Render rectangles** (`src/components/Canvas/CanvasManager.tsx`):

```typescript
// In JSX, add rectangle rendering:
{drawings.map((drawing) => {
  if (drawing.tool === 'rectangle') {
    const [x, y, width, height] = drawing.points
    return (
      <Rect
        key={drawing.id}
        x={x}
        y={y}
        width={width}
        height={height}
        stroke={drawing.color}
        strokeWidth={drawing.size}
        fill="transparent"
      />
    )
  }

  // Existing line rendering for marker/eraser
  return (
    <Line
      key={drawing.id}
      points={drawing.points}
      stroke={drawing.color}
      strokeWidth={drawing.size}
      tension={0.5}
      lineCap="round"
      globalCompositeOperation={
        drawing.tool === 'eraser' ? 'destination-out' : 'source-over'
      }
    />
  )
})}
```

**5. Add toolbar button** (`src/App.tsx`):

```typescript
<button
  className={`px-3 py-1 rounded text-sm font-medium ${
    tool === 'rectangle' ? 'bg-blue-600' : 'bg-neutral-600 hover:bg-neutral-500'
  }`}
  onClick={() => setTool('rectangle')}
>
  Rectangle
</button>
```

### Testing

1. Click "Rectangle" button
2. Click and drag on canvas
3. Should draw rectangle outline
4. Release mouse → rectangle should commit to store
5. Check World Window shows rectangle
6. Save and reload → rectangle should persist

### Expected Result

- New "Rectangle" tool in toolbar
- Click-drag creates rectangle
- Rectangle syncs to World Window
- Rectangle persists in saved campaigns

---

## Tutorial 6: Adding a New Toolbar Button

**Goal:** Add a "Zoom In" button that increases grid size.

### Steps

**1. Add store action** (`src/store/gameStore.ts`):

```typescript
interface GameState {
  // ... existing
  setGridSize: (size: number) => void
}

export const useGameStore = create<GameState>((set) => ({
  // ... existing
  setGridSize: (size) => set({ gridSize: size }),
}))
```

**2. Add button in toolbar** (`src/App.tsx`):

```typescript
<button
  className="px-3 py-1 bg-neutral-600 hover:bg-neutral-500 rounded text-sm font-medium"
  onClick={() => {
    const currentSize = useGameStore.getState().gridSize
    const newSize = Math.min(currentSize + 10, 200)  // Max 200px
    useGameStore.getState().setGridSize(newSize)
  }}
>
  Zoom In
</button>

<button
  className="px-3 py-1 bg-neutral-600 hover:bg-neutral-500 rounded text-sm font-medium"
  onClick={() => {
    const currentSize = useGameStore.getState().gridSize
    const newSize = Math.max(currentSize - 10, 20)  // Min 20px
    useGameStore.getState().setGridSize(newSize)
  }}
>
  Zoom Out
</button>
```

**3. Verify grid updates:**

CanvasManager already uses `gridSize` from store:
```typescript
const { gridSize } = useGameStore()
// Used in: GridOverlay, snapToGrid, token scaling
```

### Testing

1. Click "Zoom In" → grid cells should grow
2. Click "Zoom Out" → grid cells should shrink
3. Verify World Window updates (state sync)
4. Verify tokens scale with grid
5. Save and reload → grid size should persist

### Expected Result

- Zoom buttons adjust grid size
- Grid, tokens, and snapping all update
- Changes sync to World Window
- Grid size persists in campaigns

---

## Tutorial 7: Understanding the Asset Pipeline

**Goal:** Trace an image from file upload to rendered token.

### Pipeline Overview

```
User drops image file
  ↓
CanvasManager.handleDrop()
  ↓
ImageCropper modal (user adjusts crop)
  ↓
handleCropConfirm() receives WebP blob
  ↓
processImage() resizes and optimizes
  ↓
IPC invoke 'SAVE_ASSET_TEMP'
  ↓
Main process saves to userData/temp_assets/
  ↓
Returns file:// URL
  ↓
addToken() with file:// URL
  ↓
URLImage converts file:// → media://
  ↓
use-image hook loads image
  ↓
Konva renders on canvas
```

### Step-by-Step Walkthrough

**Step 1: File Drop**

```typescript
// src/components/Canvas/CanvasManager.tsx:100
const handleDrop = async (e: React.DragEvent) => {
  const file = e.dataTransfer.files[0]
  const objectUrl = URL.createObjectURL(file)  // Temp browser URL
  setPendingCrop({ src: objectUrl, x, y })     // Show cropper
}
```

**Step 2: User Crops Image**

```typescript
// src/components/ImageCropper.tsx:99
const handleSave = async () => {
  const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels)
  // croppedImage is WebP blob (quality=1)
  onConfirm(croppedImage)  // → handleCropConfirm
}
```

**Step 3: Process and Resize**

```typescript
// src/utils/AssetProcessor.ts:79
export async function processImage(file: File, assetType: AssetType) {
  // 1. Load image to canvas
  const img = new Image()
  img.src = URL.createObjectURL(file)

  // 2. Resize to max dimensions
  const MAX_SIZE = assetType === 'MAP' ? 4096 : 512
  const scale = Math.min(1, MAX_SIZE / Math.max(img.width, img.height))

  // 3. Draw to canvas and convert to WebP
  canvas.toBlob(async (blob) => {
    const arrayBuffer = await blob.arrayBuffer()

    // 4. Save via IPC
    const filePath = await window.ipcRenderer.invoke(
      'SAVE_ASSET_TEMP',
      arrayBuffer,
      'token.webp'
    )

    return filePath  // "file:///Users/.../temp_assets/123-token.webp"
  }, 'image/webp', 1)
}
```

**Step 4: Main Process Saves File**

```typescript
// electron/main.ts:184
ipcMain.handle('SAVE_ASSET_TEMP', async (_event, buffer, name) => {
  const tempDir = path.join(app.getPath('userData'), 'temp_assets')
  await fs.mkdir(tempDir, { recursive: true })
  const fileName = `${Date.now()}-${name}`
  const filePath = path.join(tempDir, fileName)
  await fs.writeFile(filePath, Buffer.from(buffer))
  return `file://${filePath}`
})
```

**Step 5: Add Token to Store**

```typescript
// src/components/Canvas/CanvasManager.tsx:182
addToken({
  id: crypto.randomUUID(),
  x: pendingCrop.x,
  y: pendingCrop.y,
  src: 'file:///Users/.../temp_assets/123-token.webp',
  scale: 1,
})
```

**Step 6: Render with Protocol Conversion**

```typescript
// src/components/Canvas/CanvasManager.tsx:47
const URLImage = ({ src }) => {
  // Convert file:// → media:// for Electron security
  const safeSrc = src.startsWith('file:')
    ? src.replace('file:', 'media:')
    : src

  const [img] = useImage(safeSrc)  // Loads via media:// protocol

  return <KonvaImage image={img} />
}
```

**Step 7: Protocol Handler**

```typescript
// electron/main.ts:122
protocol.handle('media', (request) => {
  return net.fetch('file://' + request.url.slice('media://'.length))
})
// Translates: media:///Users/.../token.webp → file:///Users/.../token.webp
```

### Key Optimizations

1. **Resize:** Tokens max 512px (maps max 4096px)
2. **WebP:** 30-50% smaller than PNG
3. **Quality=1:** Lossless compression
4. **Temp storage:** Files persist until app restart
5. **Campaign save:** Copies temp files into ZIP

### Debugging Tips

```typescript
// Log each step:
console.log('1. File dropped:', file.name, file.size)
console.log('2. Crop completed:', blob.size)
console.log('3. Processed, saved at:', filePath)
console.log('4. Token added with src:', token.src)
console.log('5. URLImage converting:', src, '→', safeSrc)
console.log('6. Image loaded:', img)
```

---

## Tutorial 8: Debugging IPC Communication

**Goal:** Debug state sync issues between Architect and World windows.

### Common Issues

1. State not syncing to World Window
2. IPC messages not being received
3. State syncing too slowly

### Debugging Steps

**1. Enable IPC Logging in Main Process** (`electron/main.ts`):

```typescript
app.whenReady().then(() => {
  // Log all IPC events
  ipcMain.on('SYNC_WORLD_STATE', (event, state) => {
    console.log('[Main] Received SYNC_WORLD_STATE')
    console.log('[Main] Tokens:', state.tokens.length)
    console.log('[Main] Drawings:', state.drawings.length)

    if (worldWindow && !worldWindow.isDestroyed()) {
      console.log('[Main] Broadcasting to World Window')
      worldWindow.webContents.send('SYNC_WORLD_STATE', state)
    } else {
      console.log('[Main] World Window not available!')
    }
  })
})
```

**2. Enable Logging in Architect Window** (`src/components/SyncManager.tsx`):

```typescript
useEffect(() => {
  if (windowType === 'world') return

  // Subscribe to store changes (PRODUCER mode)
  const unsubscribe = useGameStore.subscribe((state) => {
    console.log('[Architect] State changed, syncing...')
    console.log('[Architect] Tokens:', state.tokens.length)
    console.log('[Architect] Drawings:', state.drawings.length)

    // @ts-ignore
    window.ipcRenderer.send('SYNC_WORLD_STATE', {
      tokens: state.tokens,
      drawings: state.drawings,
      gridSize: state.gridSize,
    })

    console.log('[Architect] Sync sent via IPC')
  })

  return unsubscribe
}, [windowType])
```

**3. Enable Logging in World Window** (`src/components/SyncManager.tsx`):

```typescript
useEffect(() => {
  if (windowType !== 'world') return

  console.log('[World] Setting up IPC listener...')

  // @ts-ignore
  window.ipcRenderer.on('SYNC_WORLD_STATE', (event, state) => {
    console.log('[World] Received state update via IPC')
    console.log('[World] Tokens:', state.tokens.length)
    console.log('[World] Drawings:', state.drawings.length)

    useGameStore.getState().setState(state)
    console.log('[World] State applied to store')
  })

  return () => {
    // @ts-ignore
    window.ipcRenderer.off('SYNC_WORLD_STATE', () => {})
    console.log('[World] IPC listener removed')
  }
}, [windowType])
```

**4. Test Flow:**

```
1. Add token in Architect View
   → Console should show:
     [Architect] State changed, syncing...
     [Architect] Tokens: 1
     [Architect] Sync sent via IPC

2. Main process receives:
     [Main] Received SYNC_WORLD_STATE
     [Main] Tokens: 1
     [Main] Broadcasting to World Window

3. World Window receives:
     [World] Received state update via IPC
     [World] Tokens: 1
     [World] State applied to store
```

### Troubleshooting Scenarios

**Scenario 1: World Window not receiving updates**

Check console output:
- If "[Main] World Window not available!" → Window was closed or destroyed
- If no "[World] Received..." logs → Listener not set up correctly

Fix:
```typescript
// Verify World Window query param
const params = new URLSearchParams(window.location.search)
console.log('Window type:', params.get('type'))  // Should be 'world'
```

**Scenario 2: High CPU usage during drawing**

Check console:
- If hundreds of "[Architect] State changed" per second → Too many syncs

Fix: Throttle updates (see Tutorial 2 in this document)

**Scenario 3: State out of sync after load**

Check if SYNC_WORLD_STATE sent after load:
```typescript
const state = await window.ipcRenderer.invoke('LOAD_CAMPAIGN')
if (state) {
  useGameStore.getState().setState(state)

  // Manually trigger sync after load
  window.ipcRenderer.send('SYNC_WORLD_STATE', state)
}
```

---

## Tutorial 9: Testing State Synchronization

**Goal:** Verify state syncs correctly between windows.

### Manual Testing Checklist

**1. Token Synchronization:**

```
✓ Add token in Architect → Appears in World
✓ Drag token in Architect → Position updates in World
✓ Delete token in Architect → Disappears in World
✓ Load campaign → Tokens appear in both windows
```

**2. Drawing Synchronization:**

```
✓ Draw with marker → Stroke appears in World
✓ Draw with eraser → Erases in World
✓ Multiple strokes → All appear in World
✓ Clear drawings → Clears in World
```

**3. Grid Synchronization:**

```
✓ Change grid size → Updates in World
✓ Grid overlay renders at correct size
✓ Tokens scale with grid
```

**4. Edge Cases:**

```
✓ Close World Window, add token, reopen World → Token appears
✓ Add 100 tokens rapidly → All sync correctly
✓ Draw complex stroke (500+ points) → Entire stroke syncs
✓ Load large campaign (50MB) → All assets load in both windows
```

### Automated Test Script

Create `test-sync.js`:

```javascript
// Run with: node test-sync.js

const assert = require('assert')

// Mock store for testing
const testStore = {
  tokens: [],
  drawings: [],

  addToken(token) {
    this.tokens.push(token)
    this.notifyListeners()
  },

  listeners: [],
  subscribe(fn) {
    this.listeners.push(fn)
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn)
    }
  },

  notifyListeners() {
    this.listeners.forEach(fn => fn(this))
  }
}

// Test subscription
let syncCount = 0
const unsubscribe = testStore.subscribe((state) => {
  syncCount++
  console.log(`Sync #${syncCount}: ${state.tokens.length} tokens`)
})

// Add tokens
testStore.addToken({ id: '1', x: 0, y: 0, src: 'test.png', scale: 1 })
testStore.addToken({ id: '2', x: 50, y: 50, src: 'test2.png', scale: 1 })

// Verify
assert.equal(syncCount, 2, 'Should trigger sync twice')
assert.equal(testStore.tokens.length, 2, 'Should have 2 tokens')

unsubscribe()
testStore.addToken({ id: '3', x: 100, y: 100, src: 'test3.png', scale: 1 })
assert.equal(syncCount, 2, 'Should not trigger after unsubscribe')

console.log('✓ All tests passed')
```

Run: `node test-sync.js`

---

## Tutorial 10: Creating Custom Protocol Handlers

**Goal:** Add a new `assets://` protocol for library assets.

### Use Case

Separate library assets (permanent) from temp assets (session-only).

### Steps

**1. Register protocol** (`electron/main.ts`):

```typescript
// Before app.whenReady()
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { secure: true, supportFetchAPI: true, bypassCSP: true } },
  { scheme: 'assets', privileges: { secure: true, supportFetchAPI: true, bypassCSP: true } }  // Add
])
```

**2. Implement handler** (`electron/main.ts`):

```typescript
app.whenReady().then(() => {
  // Existing media:// handler
  protocol.handle('media', (request) => {
    return net.fetch('file://' + request.url.slice('media://'.length))
  })

  // New assets:// handler
  protocol.handle('assets', (request) => {
    const assetPath = request.url.slice('assets://'.length)
    const fullPath = path.join(app.getPath('userData'), 'library', assetPath)
    return net.fetch('file://' + fullPath)
  })
})
```

**3. Add helper function** (`src/utils/AssetProcessor.ts`):

```typescript
/**
 * Save asset to permanent library storage
 *
 * Unlike SAVE_ASSET_TEMP, these persist across sessions
 */
export async function saveLibraryAsset(file: File, category: string) {
  const blob = await file.arrayBuffer()
  const fileName = `${Date.now()}-${file.name}`

  // @ts-ignore
  const assetPath = await window.ipcRenderer.invoke(
    'SAVE_LIBRARY_ASSET',
    blob,
    category,
    fileName
  )

  return assetPath  // Returns "assets://monsters/123-goblin.webp"
}
```

**4. Add IPC handler** (`electron/main.ts`):

```typescript
ipcMain.handle('SAVE_LIBRARY_ASSET', async (_event, buffer, category, fileName) => {
  const libraryDir = path.join(app.getPath('userData'), 'library', category)
  await fs.mkdir(libraryDir, { recursive: true })

  const filePath = path.join(libraryDir, fileName)
  await fs.writeFile(filePath, Buffer.from(buffer))

  return `assets://${category}/${fileName}`
})
```

**5. Update URLImage** (`src/components/Canvas/CanvasManager.tsx`):

```typescript
const URLImage = ({ src, x, y, width, height }: any) => {
  // Handle both protocols
  let safeSrc = src
  if (src.startsWith('file:')) {
    safeSrc = src.replace('file:', 'media:')
  }
  // assets:// URLs work directly (no conversion needed)

  const [img] = useImage(safeSrc)
  return <KonvaImage image={img} x={x} y={y} width={width} height={height} draggable />
}
```

### Testing

1. Save asset using `saveLibraryAsset()`
2. Verify returns `assets://category/filename.webp`
3. Use in token: `{ src: 'assets://monsters/goblin.webp' }`
4. Verify image loads and displays
5. Restart app → Asset should still be accessible
6. Check file exists: `~/Library/Application Support/Graphium/library/monsters/goblin.webp`

### Use Cases

- **Temp assets** (`media://`): Session-only tokens from file uploads
- **Library assets** (`assets://`): Permanent tokens in reusable library
- **Remote assets** (`https://`): Online token libraries (no protocol conversion)

---

## Best Practices Summary

### When Adding Features

1. ✅ Start with store (add state/actions)
2. ✅ Add IPC if cross-process communication needed
3. ✅ Update UI components
4. ✅ Add JSDoc documentation
5. ✅ Test in both Architect and World windows
6. ✅ Test save/load persistence
7. ✅ Update relevant docs (IPC_API.md, ARCHITECTURE.md)

### Code Quality

- Use TypeScript strict mode
- Add JSDoc to all functions
- Follow existing patterns (see CONVENTIONS.md)
- Test edge cases (empty state, large datasets)
- Check performance (avoid unnecessary re-renders)

### Debugging

- Use console.log() liberally
- Enable DevTools in both windows
- Test with World Window open
- Monitor IPC traffic
- Check file system (userData directory)

### Documentation

- Update IPC_API.md for new channels
- Update ARCHITECTURE.md for structural changes
- Add examples to JSDoc
- Document WHY, not just WHAT

---

**Last updated:** 2025-01-XX
**Document version:** 1.0
