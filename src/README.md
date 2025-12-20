# Renderer Process (React Application)

This directory contains the React application that runs in Electron's renderer process. This is the UI layer that users interact with, rendered in Chromium browser windows.

## Purpose

The renderer process provides:
- **Architect View** - DM control interface (toolbar, sidebar, canvas, save/load)
- **World View** - Player-facing display (canvas only, no controls)
- Real-time canvas rendering (maps, tokens, drawings)
- State management (Zustand store)
- Asset processing (image optimization, cropping)
- IPC communication with main process

## Architecture Overview

```
src/
├── components/          # React UI components
│   ├── Canvas/         # Canvas rendering components
│   ├── ImageCropper.tsx
│   ├── Sidebar.tsx
│   └── SyncManager.tsx
├── store/              # Zustand state management
│   └── gameStore.ts
├── utils/              # Pure utility functions
│   ├── AssetProcessor.ts
│   └── grid.ts
├── App.tsx             # Root component
├── main.tsx            # React entry point
├── index.css           # Global styles (Tailwind)
└── vite-env.d.ts       # Type declarations
```

## Component Hierarchy

```
App.tsx (root component)
│
├─── SyncManager (no UI, IPC side effects)
│     └─── useEffect
│           ├─── [MAIN WINDOW] Subscribe to store → IPC send
│           └─── [WORLD WINDOW] Listen to IPC → update store
│
├─── Sidebar (Architect View only)
│     └─── Library token grid
│           └─── Draggable divs with JSON data
│
└─── CanvasManager (both windows)
      │
      ├─── Stage (react-konva root)
      │     │
      │     └─── Layer
      │           ├─── GridOverlay (background grid)
      │           ├─── Line[] (drawings: marker/eraser strokes)
      │           ├─── Line (temp drawing, during drag)
      │           └─── URLImage[] (tokens, draggable)
      │
      └─── ImageCropper (modal overlay, conditional)
            └─── Cropper (react-easy-crop)
```

## Data Flow

### One-Way Data Flow Pattern

```
User Action (click, drag, drop)
    ↓
Event Handler (handleClick, handleDrop)
    ↓
Store Action (addToken, addDrawing)
    ↓
Zustand Store Update
    ↓
    ├─→ React Re-render (local window)
    │
    └─→ SyncManager Subscription
         ↓
         IPC Send to Main Process
         ↓
         Main Process Broadcast
         ↓
         World Window IPC Receive
         ↓
         World Window Store Update
         ↓
         World Window Re-render
```

**Critical rule:** State flows ONE WAY. World Window never modifies store (read-only).

## Contents

### `App.tsx` (70 lines)
**Root component and layout**

**Responsibilities:**
- Application layout (Sidebar + Canvas)
- Toolbar rendering (Select, Marker, Eraser tools)
- Save/Load button handlers
- Tool selection state management

**Window detection:**
```typescript
const params = new URLSearchParams(window.location.search);
const isWorldView = params.get('type') === 'world';

// Architect View: Shows toolbar + sidebar
// World View: Shows canvas only
```

**Key patterns:**
- Tool state managed locally (useState)
- Store accessed via `useGameStore.getState()` in handlers
- IPC invoke for save/load operations
- Alert-based user feedback (TODO: replace with toast notifications)

### `main.tsx` (16 lines)
**React entry point**

**Responsibilities:**
- React root creation
- App component mounting
- Initial IPC listener setup (example message)

**Standard Vite + React pattern:** `ReactDOM.createRoot(...).render(<App />)`

### `index.css` (minimal)
**Global Tailwind styles**

Contains:
- Tailwind directives (`@tailwind base`, `@tailwind components`, `@tailwind utilities`)
- CSS reset
- Base styles

**Note:** All component styling uses Tailwind utility classes (no custom CSS)

### `vite-env.d.ts`
**Type declarations**

Contains:
- Vite client type references
- Custom window.ipcRenderer types (TODO: move to separate file)

**Current structure:**
```typescript
/// <reference types="vite/client" />

// TODO: Define proper ipcRenderer types
interface Window {
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => void;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, listener: (...args: any[]) => void) => void;
  }
}
```

## Subdirectories

### `components/`
React UI components organized by feature.

**See:** [components/README.md](./components/README.md)

**Key components:**
- `CanvasManager.tsx` - Main canvas logic (245 lines)
- `SyncManager.tsx` - IPC state sync (49 lines)
- `Sidebar.tsx` - Asset library (37 lines)
- `ImageCropper.tsx` - Token cropping UI (118 lines)
- `Canvas/GridOverlay.tsx` - Grid rendering (51 lines)
- `Canvas/TokenLayer.tsx` - Placeholder (11 lines, unused)

### `store/`
Zustand state management.

**See:** [store/README.md](./store/README.md)

**Key file:**
- `gameStore.ts` - Single global store (tokens, drawings, gridSize)

### `utils/`
Pure utility functions (no side effects).

**See:** [utils/README.md](./utils/README.md)

**Key files:**
- `AssetProcessor.ts` - Image optimization pipeline
- `grid.ts` - Grid snapping math

## State Management

### Zustand Store Pattern

**Single store:** `gameStore.ts`

**State shape:**
```typescript
interface GameState {
  // Data
  tokens: Token[];
  drawings: Drawing[];
  gridSize: number;

  // Actions
  addToken: (token: Token) => void;
  removeToken: (id: string) => void;
  updateToken: (id: string, updates: Partial<Token>) => void;
  addDrawing: (drawing: Drawing) => void;
  setGridSize: (size: number) => void;
  setState: (partial: Partial<GameState>) => void;
}
```

**Access patterns:**

1. **Component rendering (subscribe):**
```typescript
const Component = () => {
  const { tokens } = useGameStore();  // Re-renders when tokens change
  return <div>{tokens.length} tokens</div>;
};
```

2. **Event handlers (no subscription):**
```typescript
const handleClick = () => {
  const { addToken } = useGameStore.getState();  // No re-render
  addToken(newToken);
};
```

3. **Bulk updates (load/sync):**
```typescript
useGameStore.setState({
  tokens: loadedTokens,
  drawings: loadedDrawings,
  gridSize: 50
});
```

4. **Side effects (subscriptions):**
```typescript
useEffect(() => {
  const unsub = useGameStore.subscribe((state) => {
    // Called on every state change
    window.ipcRenderer.send('SYNC_WORLD_STATE', state);
  });
  return unsub;  // Cleanup
}, []);
```

**See CONVENTIONS.md for detailed state management rules.**

## Key Patterns

### Pattern 1: Window Type Detection

Every component can determine which window it's in:

```typescript
const isWorldView = new URLSearchParams(window.location.search).get('type') === 'world';

return (
  <div>
    {isWorldView ? (
      <Canvas />  // World View: canvas only
    ) : (
      <>
        <Sidebar />
        <Canvas />
        <Toolbar />  // Architect View: full UI
      </>
    )}
  </div>
);
```

### Pattern 2: Drag-and-Drop Data Transfer

**Library items (JSON data):**
```typescript
// Sidebar.tsx - drag start
const handleDragStart = (e: React.DragEvent) => {
  e.dataTransfer.setData('application/json', JSON.stringify({
    type: 'LIBRARY_TOKEN',
    src: 'https://example.com/token.png'
  }));
};

// CanvasManager.tsx - drop
const handleDrop = (e: React.DragEvent) => {
  const jsonData = e.dataTransfer.getData('application/json');
  if (jsonData) {
    const data = JSON.parse(jsonData);
    if (data.type === 'LIBRARY_TOKEN') {
      addToken({ ...token, src: data.src });
    }
  }
};
```

**File uploads:**
```typescript
const handleDrop = (e: React.DragEvent) => {
  if (e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    // Trigger cropping UI
    setPendingCrop({ src: URL.createObjectURL(file), x, y });
  }
};
```

### Pattern 3: Drawing with Local State

**Avoid store updates during drag (performance):**

```typescript
const isDrawing = useRef(false);
const currentLine = useRef<Drawing | null>(null);
const [tempLine, setTempLine] = useState<Drawing | null>(null);

const handleMouseDown = (e: any) => {
  isDrawing.current = true;
  currentLine.current = { id: crypto.randomUUID(), points: [x, y], ... };
};

const handleMouseMove = (e: any) => {
  if (!isDrawing.current) return;
  currentLine.current.points.push(x, y);
  setTempLine({ ...currentLine.current });  // Local state only
};

const handleMouseUp = () => {
  if (tempLine) {
    addDrawing(tempLine);  // Commit to store (triggers IPC sync)
    setTempLine(null);
  }
  isDrawing.current = false;
};
```

**Why:** Updating store 60 times/sec during drag would spam IPC messages and lag World Window.

### Pattern 4: Asset Processing Pipeline

```typescript
// 1. User drops file
const handleDrop = async (e: React.DragEvent) => {
  const file = e.dataTransfer.files[0];
  const objectUrl = URL.createObjectURL(file);
  setPendingCrop({ src: objectUrl, x, y });
};

// 2. User crops
const handleCropConfirm = async (blob: Blob) => {
  // 3. Process image (resize, convert to WebP) - Returns cancellable handle
  const file = new File([blob], "token.webp", { type: 'image/webp' });
  const handle = processImage(file, 'TOKEN');
  const src = await handle.promise;  // Get file:// URL from promise

  // 4. Add to store
  addToken({ id: crypto.randomUUID(), x, y, src, scale: 1 });
  setPendingCrop(null);
};
```

### Pattern 5: File Path Conversion for Rendering

```typescript
// GameStore stores: file:///path/to/token.webp
// Konva needs: media:///path/to/token.webp (custom protocol)

const URLImage = ({ src, ...props }: any) => {
  const safeSrc = src.startsWith('file:')
    ? src.replace('file:', 'media:')
    : src;  // External URLs (https://) pass through

  const [img] = useImage(safeSrc);
  return <KonvaImage image={img} {...props} />;
};
```

**Why:** Browsers block file:// URLs due to CORS. Custom media:// protocol (defined in electron/main.ts) bypasses this.

## Common Tasks

### Task 1: Add a New Component

```typescript
// 1. Create file: src/components/TokenContextMenu.tsx
import React from 'react';

interface TokenContextMenuProps {
  tokenId: string;
  x: number;
  y: number;
  onClose: () => void;
}

const TokenContextMenu = ({ tokenId, x, y, onClose }: TokenContextMenuProps) => {
  const { removeToken } = useGameStore();

  const handleDelete = () => {
    removeToken(tokenId);
    onClose();
  };

  return (
    <div
      className="fixed bg-neutral-800 border border-neutral-700 rounded shadow-lg p-2"
      style={{ left: x, top: y }}
    >
      <button onClick={handleDelete} className="px-3 py-1 hover:bg-neutral-700 w-full text-left">
        Delete Token
      </button>
    </div>
  );
};

export default TokenContextMenu;

// 2. Import in parent (CanvasManager.tsx)
import TokenContextMenu from '../TokenContextMenu';

// 3. Add state and render
const [contextMenu, setContextMenu] = useState<{ tokenId: string; x: number; y: number } | null>(null);

return (
  <div>
    {/* Canvas */}
    {contextMenu && (
      <TokenContextMenu
        {...contextMenu}
        onClose={() => setContextMenu(null)}
      />
    )}
  </div>
);
```

### Task 2: Add Store Action

```typescript
// 1. Update interface (store/gameStore.ts)
export interface GameState {
  // ... existing
  removeToken: (id: string) => void;  // Add this
}

// 2. Implement action
export const useGameStore = create<GameState>((set) => ({
  // ... existing
  removeToken: (id) => set((state) => ({
    tokens: state.tokens.filter(t => t.id !== id)
  })),
}));

// 3. Use in component
const Component = () => {
  const { removeToken } = useGameStore();

  const handleDelete = (tokenId: string) => {
    removeToken(tokenId);
  };

  return <button onClick={() => handleDelete('token-id')}>Delete</button>;
};
```

### Task 3: Add IPC Handler Call

```typescript
// 1. Call from component
const handleSave = async () => {
  try {
    const state = useGameStore.getState();
    const dataToSave = {
      tokens: state.tokens,
      drawings: state.drawings,
      gridSize: state.gridSize
    };

    const result = await window.ipcRenderer.invoke('SAVE_CAMPAIGN', dataToSave);
    if (result) {
      alert('Campaign saved!');
    }
  } catch (error) {
    console.error('[APP] Save failed:', error);
    alert(`Failed to save: ${error}`);
  }
};

// 2. Ensure handler exists in electron/main.ts
ipcMain.handle('SAVE_CAMPAIGN', async (_event, gameState) => {
  // Implementation...
});
```

### Task 4: Add Drawing Tool

```typescript
// 1. Add tool type (App.tsx)
const [tool, setTool] = useState<'select' | 'marker' | 'eraser' | 'fog'>('select');

// 2. Add toolbar button
<button
  className={`px-3 py-1 rounded ${tool === 'fog' ? 'bg-blue-600' : 'bg-neutral-600'}`}
  onClick={() => setTool('fog')}
>
  Fog
</button>

// 3. Update Drawing interface (store/gameStore.ts)
export interface Drawing {
  tool: 'marker' | 'eraser' | 'fog';  // Add 'fog'
  // ...
}

// 4. Implement in CanvasManager.tsx
const handleMouseDown = (e: any) => {
  if (tool === 'fog') {
    currentLine.current = {
      id: crypto.randomUUID(),
      tool: 'fog',
      points: [x, y],
      color: '#000000',  // Black for fog
      size: 30,  // Larger brush
    };
  }
  // ... existing logic
};

// 5. Render with appropriate style
{drawings.map((line) => (
  <Line
    key={line.id}
    points={line.points}
    stroke={line.color}
    strokeWidth={line.size}
    opacity={line.tool === 'fog' ? 0.8 : 1}  // Semi-transparent
    globalCompositeOperation={
      line.tool === 'eraser' ? 'destination-out' : 'source-over'
    }
  />
))}
```

## Performance Considerations

### Critical Performance Patterns

1. **Grid rendering optimization**
   - Current: O(n*m) Line components (can be slow for large canvases)
   - TODO: Use single Path or memoize grid

2. **Drawing preview with local state**
   - ALWAYS use local state during drag
   - NEVER update store on mousemove (would spam IPC)

3. **Konva layer management**
   - Grid layer has `listening={false}` (saves CPU)
   - Minimize layer count (all elements in single Layer currently)

4. **Image loading**
   - useImage hook caches loaded images
   - Convert file:// to media:// (one protocol handler, no duplication)

5. **IPC throttling**
   - Currently: every store update triggers sync
   - TODO: Throttle to max 10 updates/sec if performance issues

### Performance Monitoring

```typescript
// Add to components for debugging
useEffect(() => {
  console.log('[RENDER] Component rendered', { tokens: tokens.length });
});

// Use React DevTools Profiler to identify re-render issues
```

## Testing

### Manual Testing Checklist

**Rendering:**
- [ ] Architect View shows toolbar + sidebar + canvas
- [ ] World View shows canvas only
- [ ] Grid renders correctly (50px cells)
- [ ] Tokens render at correct positions
- [ ] Drawings render correctly (marker/eraser)

**Interactions:**
- [ ] Drag-and-drop file uploads work
- [ ] Cropping UI appears and functions
- [ ] Drawing tools create strokes
- [ ] Token dragging works (snaps to grid)
- [ ] Save button saves campaign
- [ ] Load button loads campaign

**State sync:**
- [ ] Changes in Architect View appear in World View
- [ ] No lag (< 100ms latency)
- [ ] World View updates smoothly (60fps)

**Error handling:**
- [ ] Invalid file upload shows error
- [ ] Save/load failures show user-friendly message
- [ ] No unhandled promise rejections in console

## Common Issues

### Issue: World View not updating
**Diagnosis:** SyncManager subscription not active

**Check:**
1. Is World View window open?
2. Is SyncManager component rendered?
3. Are there console errors in World View DevTools?

**Solution:**
```typescript
// Add logging to SyncManager.tsx
useEffect(() => {
  const isWorldView = new URLSearchParams(window.location.search).get('type') === 'world';
  console.log('[SYNC] Window type:', isWorldView ? 'WORLD' : 'ARCHITECT');

  if (isWorldView) {
    console.log('[SYNC] Setting up World View listener');
    window.ipcRenderer.on('SYNC_WORLD_STATE', (_event, state) => {
      console.log('[SYNC] Received state:', state);
      useGameStore.setState(state);
    });
  }
}, []);
```

### Issue: Tokens not rendering after load
**Diagnosis:** File paths incorrect

**Check:** Console log token.src values (should be file:// or media://)

**Solution:**
```typescript
// After load, verify paths
const state = await window.ipcRenderer.invoke('LOAD_CAMPAIGN');
console.log('[LOAD] Token paths:', state.tokens.map(t => t.src));
// Should be: file:///Users/.../sessions/{timestamp}/assets/token.webp
```

### Issue: Drawing lag
**Diagnosis:** Updating store on mousemove (wrong pattern)

**Check:** Is setTempLine or addDrawing called in handleMouseMove?

**Solution:** Use local state pattern (see Pattern 3 above)

### Issue: Save/Load buttons not working
**Diagnosis:** IPC types missing or handler error

**Check:**
1. Does window.ipcRenderer exist? (log it)
2. Are there errors in main process console?
3. Is electron/main.ts handler registered?

**Solution:**
```typescript
// Add error logging
try {
  const result = await window.ipcRenderer.invoke('SAVE_CAMPAIGN', data);
  console.log('[SAVE] Result:', result);
} catch (error) {
  console.error('[SAVE] Error:', error);
  alert(`Save failed: ${error}`);
}
```

## Related Documentation

- **[Architecture Overview](../docs/architecture/ARCHITECTURE.md)** - Overall system design
- **[Code Conventions](../docs/guides/CONVENTIONS.md)** - Code style and patterns
- **[Domain Context](../docs/context/CONTEXT.md)** - Business rules and workflows
- **[Component Documentation](../docs/components/)** - Component-specific guides
- **[State Management](../docs/components/state-management.md)** - State management details
- **[Tutorials](../docs/guides/TUTORIALS.md)** - Step-by-step development guides
