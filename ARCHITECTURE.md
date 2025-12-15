# Hyle Architecture

## System Overview

Hyle is a local-first desktop application built with Electron that provides a dual-window digital battlemap system for tabletop RPG Dungeon Masters. The architecture prioritizes real-time synchronization, performance, and data ownership.

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        OPERATING SYSTEM                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              ELECTRON RUNTIME (Chromium + Node.js)          │ │
│  │                                                              │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │           MAIN PROCESS (Node.js)                     │  │ │
│  │  │           electron/main.ts                           │  │ │
│  │  │                                                       │  │ │
│  │  │  ├─ BrowserWindow Management                         │  │ │
│  │  │  │   ├─ Main Window (Architect View)                 │  │ │
│  │  │  │   └─ World Window (Player View)                   │  │ │
│  │  │  │                                                    │  │ │
│  │  │  ├─ IPC Message Router                               │  │ │
│  │  │  │   ├─ Bidirectional communication                  │  │ │
│  │  │  │   └─ State broadcast                              │  │ │
│  │  │  │                                                    │  │ │
│  │  │  ├─ File System Operations                           │  │ │
│  │  │  │   ├─ Campaign save/load (.hyle ZIP files)         │  │ │
│  │  │  │   ├─ Temp asset storage                           │  │ │
│  │  │  │   └─ Asset extraction/archival                    │  │ │
│  │  │  │                                                    │  │ │
│  │  │  └─ Custom Protocol Handler                          │  │ │
│  │  │      └─ media:// → file:// translation               │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │                          ▲                                  │ │
│  │                          │ IPC Bridge (preload.ts)          │ │
│  │                          │ contextBridge API                │ │
│  │                          ▼                                  │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │     RENDERER PROCESSES (Chromium/React)              │  │ │
│  │  │                                                       │  │ │
│  │  │  ┌─────────────────────┐  ┌─────────────────────┐   │  │ │
│  │  │  │  MAIN WINDOW        │  │  WORLD WINDOW       │   │  │ │
│  │  │  │  (DM Control)       │  │  (Projector)        │   │  │ │
│  │  │  │                     │  │                     │   │  │ │
│  │  │  │  React App          │  │  React App          │   │  │ │
│  │  │  │  ├─ Toolbar         │  │  └─ Canvas Only     │   │  │ │
│  │  │  │  ├─ Sidebar         │  │                     │   │  │ │
│  │  │  │  ├─ Canvas          │  │  Zustand Store      │   │  │ │
│  │  │  │  └─ Save/Load UI    │  │  (Read-only)        │   │  │ │
│  │  │  │                     │  │                     │   │  │ │
│  │  │  │  Zustand Store      │  │  SyncManager        │   │  │ │
│  │  │  │  (Source of Truth)  │  │  (Consumer)         │   │  │ │
│  │  │  │                     │  │                     │   │  │ │
│  │  │  │  SyncManager        │  │                     │   │  │ │
│  │  │  │  (Producer) ────────┼──┼─────────────────────┤   │  │ │
│  │  │  │                     │  │     IPC Channel     │   │  │ │
│  │  │  └─────────────────────┘  └─────────────────────┘   │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
              │                                    │
              ▼                                    ▼
    ┌──────────────────┐              ┌──────────────────┐
    │  File System     │              │  Display 1       │
    │  - userData/     │              │  (DM Monitor)    │
    │  - temp_assets/  │              └──────────────────┘
    │  - sessions/     │
    │  - *.hyle files  │              ┌──────────────────┐
    └──────────────────┘              │  Display 2       │
                                      │  (Projector)     │
                                      └──────────────────┘
```

## Component Architecture

### Main Process Components

#### Window Manager (`electron/main.ts`)
**Responsibilities:**
- Create and manage BrowserWindow instances
- Handle window lifecycle (close, focus, minimize)
- Route between Architect View and World View

**Key Functions:**
- `createMainWindow()` - Initialize DM control window
- `createWorldWindow()` - Initialize player projector window (singleton pattern)
- Window state management (prevent duplicate World Windows)

**Window Configuration:**
```typescript
Main Window:
- Preload: electron/preload.mjs
- URL: http://localhost:5173 (dev) or dist/index.html (prod)
- No query params

World Window:
- Preload: electron/preload.mjs
- URL: http://localhost:5173?type=world (dev) or dist/index.html?type=world (prod)
- Query param 'type=world' determines rendering mode
```

#### IPC Message Router (`electron/main.ts`)
**Responsibilities:**
- Route messages between renderer processes
- Handle file I/O requests
- Broadcast state updates

**Channel Definitions:**

| Channel | Direction | Type | Purpose |
|---------|-----------|------|---------|
| `create-world-window` | Renderer→Main | send | Open World Window |
| `SYNC_WORLD_STATE` | Main→World | send | Broadcast state updates |
| `SYNC_WORLD_STATE` | Main→Main | on | Receive state from Main Window |
| `SAVE_ASSET_TEMP` | Renderer→Main | invoke | Save uploaded asset, return file path |
| `SAVE_CAMPAIGN` | Renderer→Main | invoke | Save .hyle file, return success bool |
| `LOAD_CAMPAIGN` | Renderer→Main | invoke | Load .hyle file, return GameState |

**State Broadcast Flow:**
```
Main Window updates store
    ↓
SyncManager detects change (Zustand subscription)
    ↓
IPC send 'SYNC_WORLD_STATE' to Main Process
    ↓
Main Process receives on listener
    ↓
Main Process checks worldWindow exists and !isDestroyed()
    ↓
worldWindow.webContents.send('SYNC_WORLD_STATE', state)
    ↓
World Window SyncManager receives event
    ↓
World Window updates local store via setState()
    ↓
React re-renders World Window canvas
```

#### File System Manager (`electron/main.ts`)
**Responsibilities:**
- Save/load campaign files
- Manage temporary asset storage
- Extract and archive assets

**Directory Structure:**
```
{app.getPath('userData')}/
├── temp_assets/
│   └── {timestamp}-{filename}.webp    # Uploaded assets (session-scoped)
└── sessions/
    └── {timestamp}/
        └── assets/
            └── {filename}.webp         # Loaded campaign assets
```

**Campaign File Format (`.hyle`):**
```
campaign.hyle (ZIP archive)
├── manifest.json          # Serialized GameState
└── assets/
    ├── map-dungeon.webp
    ├── token-goblin.webp
    └── token-hero.webp
```

**Save Algorithm:**
```typescript
1. Show save dialog (filter: .hyle extension)
2. Create JSZip instance
3. Deep clone gameState (avoid mutation)
4. For each token:
   a. If src starts with 'file://'
   b. Read file from filesystem
   c. Add to zip as 'assets/{basename}'
   d. Rewrite token.src to 'assets/{basename}' (relative path)
5. Write manifest.json to zip (JSON.stringify(state))
6. Generate zip as Buffer
7. Write to selected file path
```

**Load Algorithm:**
```typescript
1. Show open dialog (filter: .hyle extension)
2. Read zip file as Buffer
3. Parse zip with JSZip.loadAsync()
4. Extract manifest.json → parse as GameState
5. Create new session directory: sessions/{timestamp}/
6. For each token:
   a. If src starts with 'assets/'
   b. Extract file from zip
   c. Write to session directory
   d. Rewrite token.src to 'file://{sessionPath}/{filename}'
7. Return modified GameState
```

#### Custom Protocol Handler (`electron/main.ts`)
**Purpose:** Enable Konva to load local files without CORS/security errors

**Implementation:**
```typescript
app.whenReady().then(() => {
  protocol.handle('media', (request) => {
    // Convert media://path → file://path
    return net.fetch('file://' + request.url.slice('media://'.length))
  })
})
```

**Usage Flow:**
```
gameStore stores: file:///Users/dm/Hyle/temp_assets/token.webp
    ↓
Renderer converts: media:///Users/dm/Hyle/temp_assets/token.webp
    ↓
Konva requests: media://...
    ↓
Protocol handler intercepts
    ↓
Fetches from: file://...
    ↓
Returns image data
```

### Renderer Process Architecture

#### React Component Tree

```
App.tsx (root component)
│
├─── SyncManager (no visual output)
│     └─── useEffect
│           ├─── [MAIN WINDOW] Subscribe to store → IPC send
│           └─── [WORLD WINDOW] Listen to IPC → update store
│
├─── Sidebar (Main Window only)
│     └─── Library token grid
│           └─── Draggable divs with JSON data
│
└─── CanvasManager (both windows)
      │
      ├─── Stage (react-konva root)
      │     │
      │     └─── Layer (rendering container)
      │           │
      │           ├─── GridOverlay
      │           │     └─── Line[] (vertical + horizontal grid lines)
      │           │
      │           ├─── Line[] (drawing strokes)
      │           │     ├─── Marker strokes (red, composite: source-over)
      │           │     └─── Eraser strokes (black, composite: destination-out)
      │           │
      │           ├─── Line (temp drawing preview, during drag)
      │           │
      │           └─── URLImage[] (tokens)
      │                 └─── KonvaImage (draggable)
      │
      └─── ImageCropper (modal overlay)
            └─── Cropper (react-easy-crop)
                  └─── Confirm/Cancel buttons
```

#### State Management Architecture

**Store:** `src/store/gameStore.ts` (Zustand)

**State Shape:**
```typescript
interface GameState {
  // Data
  tokens: Token[]       // Draggable character/creature markers
  drawings: Drawing[]   // Freehand marker/eraser strokes
  gridSize: number      // Pixels per grid cell (default: 50)

  // Actions
  addToken: (token: Token) => void
  updateTokenPosition: (id: string, x: number, y: number) => void
  addDrawing: (drawing: Drawing) => void
  setGridSize: (size: number) => void
  setState: (partial: Partial<GameState>) => void  // Bulk updates
  setTokens: (tokens: Token[]) => void
}

interface Token {
  id: string        // crypto.randomUUID()
  x: number         // Grid-snapped X coordinate
  y: number         // Grid-snapped Y coordinate
  src: string       // file:// URL or https:// URL
  scale: number     // Multiplier for grid size (1 = 1x1, 2 = 2x2)
}

interface Drawing {
  id: string              // crypto.randomUUID()
  tool: 'marker' | 'eraser'
  points: number[]        // [x1, y1, x2, y2, x3, y3, ...]
  color: string           // Hex color (#df4b26 for marker, #000000 for eraser)
  size: number            // Stroke width (5 for marker, 20 for eraser)
}
```

**Access Patterns:**

```typescript
// Pattern 1: Component rendering (subscribe to changes)
const Component = () => {
  const { tokens, addToken } = useGameStore();
  // Re-renders when tokens array changes
};

// Pattern 2: Event handlers (no subscription)
const handleClick = () => {
  const { addToken } = useGameStore.getState();
  addToken(newToken); // Triggers subscribers but doesn't re-render this component
};

// Pattern 3: Bulk updates (load/sync)
useGameStore.setState({
  tokens: loadedTokens,
  drawings: loadedDrawings,
  gridSize: loadedGridSize,
});

// Pattern 4: Side effects (IPC sync)
useEffect(() => {
  const unsub = useGameStore.subscribe((state) => {
    // Called on EVERY state change
    window.ipcRenderer.send('SYNC_WORLD_STATE', state);
  });
  return unsub;
}, []);
```

**Store Mutation Rules:**
1. NEVER mutate state directly: `state.tokens.push()` ❌
2. ALWAYS use actions: `addToken(token)` ✅
3. Actions use `set()` with new references: `set({ tokens: [...prev, new] })` ✅
4. Subscribe returns unsubscribe function (cleanup in useEffect)

#### Rendering Engine

**Technology:** Konva.js (HTML5 Canvas wrapper)

**Why Konva?**
- Declarative React API (react-konva)
- High performance (60fps with 100+ tokens)
- Built-in drag-and-drop, transformations
- Layer-based rendering (like Photoshop)

**Rendering Pipeline:**

```
React State Update (gameStore)
    ↓
React reconciliation (virtual DOM diff)
    ↓
react-konva updates Konva nodes (canvas objects)
    ↓
Konva.Layer.batchDraw() (canvas drawing operations)
    ↓
Browser composites layers
    ↓
Display on screen (60fps)
```

**Layer Order (bottom to top):**
1. **GridOverlay** - Background grid lines (non-interactive, `listening={false}`)
2. **Drawings** - Marker/eraser strokes (below tokens so markers don't obscure pieces)
3. **Temp Line** - Active drawing preview (rendered during drag)
4. **Tokens** - Draggable images (top layer, interactive)

**Performance Optimization:**
- GridOverlay has `listening={false}` (no event handlers, saves CPU)
- Temp line uses local state (avoids store updates during drag)
- Images pre-optimized to WebP (smaller file size = faster load)
- useImage hook caches loaded images (no re-fetch on re-render)

### Asset Processing Pipeline

**Purpose:** Optimize user-uploaded images for performance and storage

**Flow Diagram:**

```
User drops file onto canvas
    ↓
┌──────────────────────────────────────┐
│ CanvasManager.handleDrop()           │
│ - Create Object URL (blob://)        │
│ - Set pendingCrop state              │
└──────────────────────────────────────┘
    ↓
┌──────────────────────────────────────┐
│ ImageCropper Modal Opens             │
│ - react-easy-crop component          │
│ - User adjusts crop/zoom             │
│ - Confirm → getCroppedImg()          │
└──────────────────────────────────────┘
    ↓
┌──────────────────────────────────────┐
│ getCroppedImg()                      │
│ - Load image to HTMLImageElement     │
│ - Draw to canvas (cropped region)    │
│ - canvas.toBlob('image/webp', 1)     │
│ - Return Blob                        │
└──────────────────────────────────────┘
    ↓
┌──────────────────────────────────────┐
│ AssetProcessor.processImage()        │
│ - createImageBitmap(blob)            │
│ - Calculate resize (maintain aspect) │
│   - TOKEN: max 512px                 │
│   - MAP: max 4096px                  │
│ - Draw to OffscreenCanvas            │
│ - convertToBlob({ type: 'webp',     │
│                   quality: 0.85 })   │
└──────────────────────────────────────┘
    ↓
┌──────────────────────────────────────┐
│ IPC invoke 'SAVE_ASSET_TEMP'         │
│ - Main process receives ArrayBuffer  │
│ - Generate filename: {timestamp}-    │
│   {name}.webp                        │
│ - Write to userData/temp_assets/     │
│ - Return file:// URL                 │
└──────────────────────────────────────┘
    ↓
┌──────────────────────────────────────┐
│ gameStore.addToken()                 │
│ - id: crypto.randomUUID()            │
│ - x, y: grid-snapped coordinates     │
│ - src: file:// URL                   │
│ - scale: 1 (default)                 │
└──────────────────────────────────────┘
    ↓
┌──────────────────────────────────────┐
│ SyncManager broadcasts to World      │
│ Window (if open)                     │
└──────────────────────────────────────┘
    ↓
┌──────────────────────────────────────┐
│ URLImage renders token               │
│ - Convert file:// → media://         │
│ - useImage() loads and caches        │
│ - KonvaImage displays on canvas      │
└──────────────────────────────────────┘
```

**Optimization Details:**

| Aspect | Approach | Rationale |
|--------|----------|-----------|
| **Format** | WebP (quality 0.85) | 30-50% smaller than PNG/JPG, wide browser support |
| **Resize** | Max dimensions (512px/4096px) | Prevents memory issues, maintains 60fps |
| **Aspect Ratio** | Preserved during resize | Avoids distortion |
| **Cropping** | Before resize | User removes unwanted areas first |
| **Canvas** | OffscreenCanvas | Faster than DOM canvas (no reflow/repaint) |
| **Storage** | Temp files, not in-memory | Avoid RAM bloat with many assets |

## Data Flow Patterns

### Pattern 1: User Uploads Token

```
┌─────────────────┐
│ User Action:    │
│ Drag PNG file   │
│ onto canvas     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ CanvasManager.handleDrop()      │
│ - e.dataTransfer.files[0]       │
│ - Create Object URL             │
│ - setPendingCrop({ src, x, y }) │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ ImageCropper Modal              │
│ - User crops/zooms              │
│ - Confirm → onConfirm(blob)     │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ handleCropConfirm()             │
│ - Convert Blob to File          │
│ - processImage(file, 'TOKEN')   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ AssetProcessor                  │
│ - Resize to 512px max           │
│ - Convert to WebP               │
│ - IPC invoke 'SAVE_ASSET_TEMP'  │
│ - Returns file:// URL           │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ addToken()                      │
│ - Store file:// URL in state    │
└────────┬────────────────────────┘
         │
         ├───────────────────────┐
         │                       │
         ▼                       ▼
┌──────────────────┐  ┌──────────────────┐
│ Main Window      │  │ World Window     │
│ Renders token    │  │ Receives IPC     │
│                  │  │ Renders token    │
└──────────────────┘  └──────────────────┘
```

### Pattern 2: User Draws with Marker

```
┌─────────────────┐
│ User Action:    │
│ Select "Marker" │
│ tool, drag      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ CanvasManager.handleMouseDown() │
│ - isDrawing.current = true      │
│ - currentLine.current = {       │
│     id, tool: 'marker',         │
│     points: [x, y],             │
│     color: '#df4b26', size: 5   │
│   }                             │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ CanvasManager.handleMouseMove() │
│ (called ~60 times/second)       │
│ - Append points to currentLine  │
│ - setTempLine({...currentLine}) │
│ - (Local state, no store update)│
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ React renders temp Line         │
│ - Visible feedback as user drags│
│ - Not yet in gameStore          │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ CanvasManager.handleMouseUp()   │
│ - isDrawing.current = false     │
│ - addDrawing(tempLine)          │
│ - setTempLine(null)             │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ gameStore.addDrawing()          │
│ - Adds to drawings[] array      │
│ - Triggers Zustand subscribers  │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ SyncManager (Main Window)       │
│ - Subscription fires            │
│ - IPC send 'SYNC_WORLD_STATE'   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Main Process                    │
│ - Broadcast to worldWindow      │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ SyncManager (World Window)      │
│ - IPC on 'SYNC_WORLD_STATE'     │
│ - useGameStore.setState(state)  │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ World Window Renders            │
│ - Drawing appears on projector  │
└─────────────────────────────────┘
```

**Why temp line pattern?**
- **Performance:** Avoid IPC spam (60 updates/sec would overwhelm World Window)
- **Consistency:** Drawing appears smooth in Main Window during drag
- **Sync:** World Window receives final drawing in one update (on mouse up)

### Pattern 3: Save Campaign

```
┌─────────────────┐
│ User Action:    │
│ Click "Save"    │
│ button          │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ App.tsx onClick handler         │
│ - Get state: useGameStore       │
│   .getState()                   │
│ - Extract data: { tokens,       │
│   drawings, gridSize }          │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ IPC invoke 'SAVE_CAMPAIGN'      │
│ - Sends GameState object        │
│ - Awaits boolean response       │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Main Process Handler            │
│ ipcMain.handle('SAVE_CAMPAIGN') │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ dialog.showSaveDialog()         │
│ - Filter: .hyle extension       │
│ - Returns: { filePath }         │
│ - User can cancel (filePath='') │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Create JSZip instance           │
│ - Add folder: "assets"          │
│ - Deep clone state (avoid mut.) │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ For each token:                 │
│ - If src starts with 'file://'  │
│   → Read file from filesystem   │
│   → Add to zip 'assets/{name}'  │
│   → Rewrite token.src to        │
│     'assets/{name}'             │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Write manifest.json             │
│ - JSON.stringify(modifiedState) │
│ - Add to zip root               │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Generate ZIP                    │
│ - zip.generateAsync({ type:    │
│   "nodebuffer" })               │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Write to disk                   │
│ - fs.writeFile(filePath, buffer)│
│ - Return true (success)         │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ App.tsx receives response       │
│ - if (result) alert('Saved!')   │
└─────────────────────────────────┘
```

**Key Transformations:**

| Stage | Token.src Value | Location |
|-------|----------------|----------|
| In-memory (gameStore) | `file:///Users/.../temp_assets/token.webp` | RAM |
| Being saved (cloned state) | `assets/token.webp` | ZIP archive |
| On disk (.hyle file) | `assets/token.webp` | Compressed file |

### Pattern 4: Load Campaign

```
┌─────────────────┐
│ User Action:    │
│ Click "Load"    │
│ button          │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ App.tsx onClick handler         │
│ - IPC invoke 'LOAD_CAMPAIGN'    │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Main Process Handler            │
│ ipcMain.handle('LOAD_CAMPAIGN') │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ dialog.showOpenDialog()         │
│ - Filter: .hyle extension       │
│ - Returns: { filePaths: [...] } │
│ - User can cancel (empty array) │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Read .hyle file                 │
│ - fs.readFile(filePaths[0])     │
│ - Returns Buffer                │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Parse ZIP                       │
│ - JSZip.loadAsync(buffer)       │
│ - Returns zip object            │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Extract manifest.json           │
│ - zip.file('manifest.json')     │
│   .async('string')              │
│ - JSON.parse() → state object   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Create session directory        │
│ - Path: userData/sessions/      │
│   {Date.now()}/                 │
│ - fs.mkdir (recursive)          │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Extract assets from ZIP         │
│ - For each token:               │
│   - If src is 'assets/{name}'   │
│   - Extract file from ZIP       │
│   - Write to session/assets/    │
│   - Rewrite token.src to        │
│     'file://{sessionPath}'      │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Return modified GameState       │
│ - All file paths now point to   │
│   extracted session directory   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ App.tsx receives state          │
│ - useGameStore.getState()       │
│   .setState(state)              │
│ - alert('Campaign Loaded!')     │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ React re-renders                │
│ - Canvas shows loaded map/tokens│
│ - SyncManager sends to World    │
└─────────────────────────────────┘
```

**Key Transformations:**

| Stage | Token.src Value | Location |
|-------|----------------|----------|
| On disk (.hyle file) | `assets/token.webp` | ZIP archive |
| Extracted (session dir) | `file:///.../sessions/{timestamp}/assets/token.webp` | Filesystem |
| In-memory (gameStore) | `file:///.../sessions/{timestamp}/assets/token.webp` | RAM |
| Rendered (Konva) | `media:///.../sessions/{timestamp}/assets/token.webp` | Canvas |

## Security Architecture

### Electron Security Model

**Context Isolation:** Enabled via `contextBridge`
- Renderer process does NOT have direct Node.js access
- All main process communication goes through whitelisted IPC channels
- Prevents arbitrary code execution from renderer

**Preload Script Pattern:**
```typescript
// electron/preload.ts
contextBridge.exposeInMainWorld('ipcRenderer', {
  // Whitelist specific methods (NOT full ipcRenderer object)
  send: (...args) => ipcRenderer.send(...args),
  invoke: (...args) => ipcRenderer.invoke(...args),
  on: (...args) => ipcRenderer.on(...args),
  off: (...args) => ipcRenderer.off(...args),
})
```

**⚠️ Current Security Issue:**
- Preload exposes ALL IPC channels (no channel whitelist)
- Renderer can invoke arbitrary channel names
- **Recommendation:** Restrict to specific channels only

**Recommended Fix:**
```typescript
// Better: Whitelist specific channels
contextBridge.exposeInMainWorld('electronAPI', {
  saveCampaign: (data) => ipcRenderer.invoke('SAVE_CAMPAIGN', data),
  loadCampaign: () => ipcRenderer.invoke('LOAD_CAMPAIGN'),
  saveAsset: (buffer, name) => ipcRenderer.invoke('SAVE_ASSET_TEMP', buffer, name),
  openWorldWindow: () => ipcRenderer.send('create-world-window'),
  onStateSync: (callback) => {
    const subscription = (_event, state) => callback(state)
    ipcRenderer.on('SYNC_WORLD_STATE', subscription)
    return () => ipcRenderer.off('SYNC_WORLD_STATE', subscription)
  },
})
```

### File System Sandboxing

**Restricted Paths:**
- Main process only accesses `app.getPath('userData')` directory
- No arbitrary file system writes (except user-selected save paths)
- Temp files scoped to app data directory

**User Data Directory:**
```
macOS:    ~/Library/Application Support/Hyle/
Windows:  C:\Users\{user}\AppData\Roaming\Hyle\
Linux:    ~/.config/Hyle/
```

### Data Validation

**Current State:** Minimal validation
- Campaign loads trust manifest.json structure
- No schema validation on loaded data
- Missing type guards for IPC payloads

**Recommended Validation:**
```typescript
// Validate loaded campaign data
function isValidGameState(data: unknown): data is GameState {
  if (typeof data !== 'object' || data === null) return false
  const state = data as any
  return (
    Array.isArray(state.tokens) &&
    Array.isArray(state.drawings) &&
    typeof state.gridSize === 'number' &&
    state.tokens.every(isValidToken) &&
    state.drawings.every(isValidDrawing)
  )
}
```

## Scalability Considerations

### Current Limitations

**Performance Bottlenecks:**
1. **Grid Overlay:** Creates `O(n*m)` Line components
   - 4096×4096px canvas at 50px grid = 81×81 = 6561 lines
   - Could optimize with single Path or memoization

2. **IPC Frequency:** Every store update triggers IPC send
   - High-frequency updates (e.g., token dragging) could overwhelm World Window
   - Potential fix: Throttle/debounce sync updates

3. **Image Loading:** Each token uses separate `useImage()` hook
   - Re-renders cause re-fetch (mitigated by browser cache)
   - Large canvases (100+ tokens) may see load delays

**Storage Limitations:**
1. **Temp Assets:** Never cleaned up (accumulate in userData)
   - Potential fix: Clear on app quit or implement LRU cache

2. **Session Directories:** Each load creates new session folder
   - Disk usage grows with repeated loads
   - Potential fix: Implement session expiry (delete after N days)

### Scalability Recommendations

**For Large Campaigns (100+ tokens):**
1. Implement viewport culling (only render visible tokens)
2. Use Konva.Group for batch transformations
3. Lazy-load images (load only when in viewport)
4. Implement token paging (load/unload in chunks)

**For Multiplayer (Future Feature):**
1. Replace IPC with WebSocket server
2. Implement operational transform for conflict resolution
3. Add state versioning (detect out-of-sync clients)
4. Throttle state broadcasts (e.g., 10 updates/sec max)

**For Fog of War (Planned Feature):**
1. Use separate Layer for fog (avoid re-rendering tokens)
2. Store fog as vector shapes (not raster bitmap)
3. Use `globalCompositeOperation: 'destination-out'` for reveals
4. Consider chunked fog (divide canvas into tiles)

## Technology Choices and Rationale

### Electron
**Chosen for:**
- Native desktop app (no browser chrome)
- Access to file system (save/load campaigns)
- Multi-window support (Architect + World View)
- Cross-platform (macOS, Windows, Linux)

### React + Vite
**Chosen for:**
- Fast development with HMR (hot module replacement)
- Component-based UI (reusable patterns)
- Large ecosystem (react-konva, react-easy-crop, etc.)
- TypeScript support out-of-box

### Zustand
**Chosen for:**
- Minimal boilerplate (vs Redux)
- Built-in subscription API (needed for IPC sync)
- No Context Provider wrapper (simpler setup)
- TypeScript-first design

### Konva
**Chosen for:**
- Declarative canvas API (vs imperative Canvas API)
- React integration (react-konva)
- Built-in drag/drop, transformations
- High performance (layer-based rendering)
- Shape primitives (Line, Rect, Circle for future tools)

### WebP
**Chosen for:**
- Best compression ratio (vs PNG/JPG)
- Supports transparency (needed for tokens)
- Lossy + lossless modes (0.85 quality balances both)
- Browser support mature (Chrome, Firefox, Safari)

### Local-First Architecture
**Chosen for:**
- Data ownership (users control campaign files)
- Privacy (no cloud uploads)
- Offline-first (no internet required)
- Portability (campaigns are self-contained ZIP files)

## Future Architecture Considerations

### Planned: Fog of War System
**Approach:**
1. Add `fogShapes: FogShape[]` to gameStore
2. Render fog as top layer (above tokens, below UI)
3. Use `globalCompositeOperation: 'destination-out'` for reveals
4. Add "Reveal Fog" tool (draws transparent areas in fog)
5. World View always shows fog, Architect View has toggle

**Challenges:**
- Performance with large fog areas (many vector shapes)
- Save/load fog state (increase file size)
- Sync fog updates (same as drawings, commit on mouseUp)

### Planned: Additional Drawing Tools
**Shapes:**
- Rectangle, Circle, Line (for marking zones)
- Text labels (Konva.Text)
- Ruler (measure grid distances, non-persistent overlay)

**Implementation:**
- Extend `Drawing` interface with `shape?: 'line' | 'rect' | 'circle' | 'text'`
- Add shape-specific properties (e.g., `radius`, `text`, `fontSize`)
- Render with appropriate Konva components

### Potential: Undo/Redo System
**Approach:**
1. Implement state history (stack of GameState snapshots)
2. Add actions: `undo()`, `redo()`
3. Keyboard shortcuts: Cmd+Z, Cmd+Shift+Z
4. Limit history depth (e.g., 50 actions)

**Challenges:**
- Large state size (deep cloning on every action)
- File paths in state (can't undo file writes)
- Sync undo/redo to World Window (broadcast history index)

### Potential: Asset Library Management
**Features:**
- Persistent library (separate from campaigns)
- Categories (monsters, heroes, items, terrain)
- Search/filter tokens
- Bulk import (drag folder)

**Data Model:**
```typescript
interface LibraryAsset {
  id: string
  name: string
  category: string
  src: string  // Stored in userData/library/
  tags: string[]
  dateAdded: number
}
```

**Storage:**
- Library metadata: `userData/library.json`
- Asset files: `userData/library/{id}.webp`
- Separate from campaign assets (reusable across campaigns)

## Debugging and Monitoring

### Development Tools

**React DevTools:**
- Install browser extension
- Inspect component tree, props, state
- Profile component re-renders

**Electron DevTools:**
- Open in Main Window: Cmd+Option+I (macOS) or F12 (Windows/Linux)
- Network tab: Inspect IPC messages (not directly shown, use logging)
- Console: View renderer process logs

**Logging Strategy:**
```typescript
// Main Process
console.log('[MAIN]', message)

// Renderer (Main Window)
console.log('[ARCHITECT]', message)

// Renderer (World Window)
console.log('[WORLD]', message)

// IPC
console.log('[IPC → MAIN]', channel, data)
console.log('[IPC → WORLD]', channel, data)
```

### Common Issues and Diagnosis

**Issue: World Window not syncing**
1. Check window is open: `worldWindow && !worldWindow.isDestroyed()`
2. Verify SyncManager subscription is active (Main Window)
3. Add logging to IPC send/receive
4. Confirm World Window detected correctly (`?type=world` in URL)

**Issue: Tokens not rendering**
1. Check src path format (`file://` vs `media://`)
2. Verify protocol handler registered (`app.whenReady()`)
3. Inspect Network tab for failed loads
4. Confirm file exists at path (console.log full path)

**Issue: Save/load fails**
1. Check file dialog returned path (user may have cancelled)
2. Verify userData directory exists (`app.getPath('userData')`)
3. Inspect ZIP contents (unzip .hyle file manually)
4. Check JSON.parse errors (malformed manifest.json)

**Issue: Drawing performance lag**
1. Check number of points in drawings (too many = slow render)
2. Verify tempLine pattern used (not updating store on mousemove)
3. Profile with React DevTools (identify unnecessary re-renders)
4. Consider throttling mousemove events

## File Organization

```
Hyle/
├── electron/                    # Main process code
│   ├── main.ts                 # App lifecycle, windows, IPC handlers
│   ├── preload.ts              # Context bridge (IPC whitelist)
│   └── electron-env.d.ts       # Electron TypeScript definitions
│
├── src/                        # Renderer process code
│   ├── components/             # React components
│   │   ├── Canvas/             # Canvas-specific components
│   │   │   ├── CanvasManager.tsx    # Main canvas logic
│   │   │   ├── GridOverlay.tsx      # Background grid
│   │   │   └── TokenLayer.tsx       # (Unused placeholder)
│   │   ├── ImageCropper.tsx    # Token cropping modal
│   │   ├── Sidebar.tsx         # Asset library
│   │   └── SyncManager.tsx     # IPC state sync
│   │
│   ├── store/                  # State management
│   │   └── gameStore.ts        # Zustand store (tokens, drawings, grid)
│   │
│   ├── utils/                  # Pure functions
│   │   ├── AssetProcessor.ts   # Image optimization pipeline
│   │   └── grid.ts             # Grid snapping math
│   │
│   ├── App.tsx                 # Root component (toolbar, layout)
│   ├── main.tsx                # React entry point
│   ├── index.css               # Global styles (Tailwind)
│   └── vite-env.d.ts           # Vite + custom type declarations
│
├── public/                     # Static assets
│   └── *.svg                   # Icons
│
├── package.json                # Dependencies, scripts
├── tsconfig.json               # TypeScript compiler config
├── vite.config.ts              # Vite bundler + Electron plugin
├── tailwind.config.js          # Tailwind CSS configuration
├── electron-builder.json5      # Production build config
└── README.md                   # Project documentation
```

## Build and Deployment

### Development Build
```bash
npm run dev
```
- Vite dev server on http://localhost:5173
- Electron launches with HMR enabled
- Hot reload on file changes (React components)
- Electron restart on main process changes

### Production Build
```bash
npm run build
```
1. TypeScript compilation (`tsc`)
2. Vite build (bundle React app to `dist/`)
3. Electron build (compile main/preload to `dist-electron/`)
4. electron-builder packages app (create installer/executable)

**Output:**
- macOS: `Hyle.dmg`, `Hyle.app`
- Windows: `Hyle Setup.exe`, `Hyle.exe` (portable)
- Linux: `Hyle.AppImage`, `Hyle.deb`, `Hyle.rpm`

### Distribution
- Self-contained executables (no installer required for portable versions)
- Includes Node.js runtime and Chromium
- File associations: `.hyle` files open with Hyle (configurable in electron-builder.json5)

## Conclusion

Hyle's architecture prioritizes:
1. **Real-time synchronization** between DM and player views
2. **Performance** through optimized rendering and asset processing
3. **Data ownership** via local-first design
4. **Extensibility** for planned features (fog of war, more tools)

The dual-window pattern with IPC state sync is the core architectural pattern that all features must respect. Understanding this flow is critical for adding new functionality.
