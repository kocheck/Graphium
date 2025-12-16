# Components

React UI components for Hyle. Components are organized by feature, with canvas-specific rendering logic in the `Canvas/` subdirectory.

## Purpose

This directory contains all React components that make up the Hyle user interface:
- **Layout components** - Application structure (Sidebar, Toolbar)
- **Canvas components** - Rendering logic (CanvasManager, GridOverlay)
- **Modal components** - Overlays and dialogs (ImageCropper)
- **System components** - No UI, side effects only (SyncManager)

## Directory Structure

```
components/
├── Canvas/
│   ├── CanvasManager.tsx       # Main canvas logic (245 lines)
│   ├── GridOverlay.tsx         # Grid rendering (51 lines)
│   └── TokenLayer.tsx          # Placeholder (11 lines, unused)
├── ImageCropper.tsx            # Token cropping UI (118 lines)
├── Sidebar.tsx                 # Asset library (37 lines)
└── SyncManager.tsx             # IPC state sync (49 lines)
```

## Component Overview

### CanvasManager.tsx (Canvas/)
**Primary canvas rendering and interaction logic**

**Responsibilities:**
- Konva Stage/Layer setup and sizing
- Drag-and-drop handling (file uploads, library tokens)
- Drawing tool implementation (marker, eraser)
- Token rendering with grid snapping
- Cropping UI trigger and confirmation
- Real-time drawing preview (temp line pattern)

**Props:**
```typescript
interface CanvasManagerProps {
  tool?: 'select' | 'marker' | 'eraser';
}
```

**Key features:**
- Auto-resize canvas on window resize
- Two drag-and-drop modes: JSON (library) vs Files (uploads)
- Local state for drawing preview (performance optimization)
- Grid snapping for all token placements

**See:** [Canvas/README.md](./Canvas/README.md) for detailed documentation

### SyncManager.tsx
**IPC state synchronization (no visual output)**

**Responsibilities:**
- Detect window type (Architect vs World View)
- Subscribe to store changes in Architect View → send IPC
- Listen to IPC in World View → update store

**Props:** None (zero-config component)

**Usage:**
```typescript
// In App.tsx
<SyncManager />  // Just render it, handles everything internally
```

**Critical pattern:**
```typescript
useEffect(() => {
  const isWorldView = new URLSearchParams(window.location.search).get('type') === 'world';

  if (isWorldView) {
    // CONSUMER: Listen to IPC, update store
    window.ipcRenderer.on('SYNC_WORLD_STATE', (_event, state) => {
      useGameStore.setState(state);
    });
  } else {
    // PRODUCER: Subscribe to store, send IPC
    const unsub = useGameStore.subscribe((state) => {
      window.ipcRenderer.send('SYNC_WORLD_STATE', {
        tokens: state.tokens,
        drawings: state.drawings,
        gridSize: state.gridSize
      });
    });
    return unsub;
  }
}, []);
```

**Important notes:**
- Must be rendered in both windows
- NO UI rendering (returns null)
- Runs entirely in useEffect
- Cleanup handled via unsubscribe

### Sidebar.tsx
**Asset library with draggable tokens**

**Responsibilities:**
- Display library tokens (currently 2 hardcoded examples)
- Drag-and-drop initiation with JSON data transfer
- Future: Token search, categories, bulk import

**Props:** None

**Current state:** Minimal implementation (proof of concept)

**Drag-and-drop pattern:**
```typescript
const handleDragStart = (e: React.DragEvent, type: string, src: string) => {
  e.dataTransfer.setData('application/json', JSON.stringify({
    type: 'LIBRARY_TOKEN',
    src: src
  }));
};

<div draggable onDragStart={(e) => handleDragStart(e, 'LIBRARY_TOKEN', tokenUrl)}>
  🦁
</div>
```

**Layout:**
```
┌─────────────┐
│  Library    │
├─────────────┤
│  Tokens     │
│  ┌───┬───┐  │
│  │🦁 │👽 │  │
│  └───┴───┘  │
└─────────────┘
```

**Future enhancements:**
- Persistent library (saved separately from campaigns)
- Search/filter by name or tags
- Categories (Monsters, Heroes, Terrain)
- Custom token upload to library
- Drag folder for bulk import

### ImageCropper.tsx
**Modal overlay for cropping uploaded tokens**

**Responsibilities:**
- Display cropping UI (react-easy-crop)
- Zoom control (1x to 3x)
- Crop area selection (enforced 1:1 aspect ratio)
- Return cropped image as Blob

**Props:**
```typescript
interface ImageCropperProps {
  imageSrc: string;      // Object URL (blob://)
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}
```

**Usage flow:**
```typescript
// 1. User drops file → create Object URL
const objectUrl = URL.createObjectURL(file);
setPendingCrop({ src: objectUrl, x, y });

// 2. ImageCropper renders
{pendingCrop && (
  <ImageCropper
    imageSrc={pendingCrop.src}
    onConfirm={handleCropConfirm}
    onCancel={() => setPendingCrop(null)}
  />
)}

// 3. User confirms → receive Blob
const handleCropConfirm = async (blob: Blob) => {
  const file = new File([blob], "token.webp", { type: 'image/webp' });
  const src = await processImage(file, 'TOKEN');
  addToken({ id: crypto.randomUUID(), x, y, src, scale: 1 });
  setPendingCrop(null);
};
```

**Key features:**
- 1:1 aspect ratio (square tokens for grid alignment)
- Zoom slider (1x to 3x)
- Full-screen modal overlay (blocks interaction with canvas)
- Converts to WebP on confirm (via canvas.toBlob)

**Helper functions:**
```typescript
// getCroppedImg() - Crops image to selected area, returns Blob
async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<Blob | null>

// createImage() - Loads image for cropping (returns HTMLImageElement)
const createImage = (url: string): Promise<HTMLImageElement>
```

### GridOverlay.tsx (Canvas/)
**Renders grid lines on canvas**

**See:** [Canvas/README.md](./Canvas/README.md) for detailed documentation

**Summary:**
- Renders vertical and horizontal lines
- Grid size configurable (default 50px)
- Non-interactive (`listening={false}`)
- Memoization opportunity for large grids

### TokenLayer.tsx (Canvas/)
**Placeholder component (unused)**

**Current status:** Empty Group component (11 lines)

**Original intent:** Separate layer for token rendering

**Actual implementation:** Tokens rendered directly in CanvasManager Layer

**Can be deleted** or repurposed for future features (e.g., token z-order management)

## Component Patterns

### Pattern 1: Tool-Based Rendering

Many components change behavior based on selected tool:

```typescript
const CanvasManager = ({ tool }: { tool: 'select' | 'marker' | 'eraser' }) => {
  const handleMouseDown = (e: any) => {
    if (tool === 'select') return;  // No-op
    if (tool === 'marker') {
      // Start marker stroke
    }
    if (tool === 'eraser') {
      // Start eraser stroke
    }
  };

  return (
    <Stage draggable={tool === 'select'}>  // Only draggable in select mode
      {/* ... */}
    </Stage>
  );
};
```

### Pattern 2: Conditional Rendering (Window Type)

```typescript
const isWorldView = new URLSearchParams(window.location.search).get('type') === 'world';

return (
  <div>
    {!isWorldView && <Sidebar />}  // Only in Architect View
    <CanvasManager tool={tool} />  // In both views
  </div>
);
```

### Pattern 3: Modal State Management

```typescript
const [pendingCrop, setPendingCrop] = useState<CropData | null>(null);

// Trigger modal
const handleDrop = (file: File) => {
  setPendingCrop({ src: URL.createObjectURL(file), x, y });
};

// Render modal
{pendingCrop && (
  <ImageCropper
    imageSrc={pendingCrop.src}
    onConfirm={handleConfirm}
    onCancel={() => setPendingCrop(null)}
  />
)}

// Close modal
const handleConfirm = (blob: Blob) => {
  // Process blob...
  setPendingCrop(null);  // Close
};
```

### Pattern 4: Event Handler Naming

All event handlers use `handle` prefix:

```typescript
const handleDrop = (e: React.DragEvent) => { ... };
const handleMouseDown = (e: any) => { ... };
const handleResize = () => { ... };
const handleCropConfirm = (blob: Blob) => { ... };
```

### Pattern 5: Ref-Based Mutable State

For values that change frequently but shouldn't trigger re-renders:

```typescript
const isDrawing = useRef(false);
const currentLine = useRef<Drawing | null>(null);

const handleMouseDown = () => {
  isDrawing.current = true;  // No re-render
  currentLine.current = { ... };
};

const handleMouseMove = () => {
  if (!isDrawing.current) return;
  currentLine.current.points.push(x, y);  // Mutate ref (OK)
  setTempLine({ ...currentLine.current });  // Render preview
};
```

## Common Component Tasks

### Task 1: Add a New Tool Button

```typescript
// 1. Update tool type in App.tsx
const [tool, setTool] = useState<'select' | 'marker' | 'eraser' | 'ruler'>('select');

// 2. Add button to toolbar
<button
  className={`px-3 py-1 rounded ${tool === 'ruler' ? 'bg-blue-600' : 'bg-neutral-600'}`}
  onClick={() => setTool('ruler')}
>
  Ruler
</button>

// 3. Implement in CanvasManager
const handleMouseDown = (e: any) => {
  if (tool === 'ruler') {
    // Ruler logic (measure distance)
  }
};
```

### Task 2: Add a New Modal Component

```typescript
// 1. Create component: components/SettingsDialog.tsx
const SettingsDialog = ({ onClose }: { onClose: () => void }) => {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-neutral-800 rounded-lg p-4 w-96">
        <h2>Settings</h2>
        {/* Settings controls */}
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

// 2. Add state in App.tsx
const [showSettings, setShowSettings] = useState(false);

// 3. Render conditionally
{showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}

// 4. Trigger from button
<button onClick={() => setShowSettings(true)}>Settings</button>
```

### Task 3: Add a Component to Sidebar

```typescript
// In Sidebar.tsx

// 1. Add section
<div className="mb-4">
  <h3 className="text-sm text-neutral-400 mb-2 uppercase font-bold">
    Maps
  </h3>
  <div className="flex flex-col gap-2">
    {/* Map thumbnails */}
  </div>
</div>

// 2. Add drag handler for maps
const handleDragStart = (e: React.DragEvent, type: string, src: string) => {
  e.dataTransfer.setData('application/json', JSON.stringify({
    type: type,  // 'MAP' instead of 'LIBRARY_TOKEN'
    src: src
  }));
};

// 3. Handle in CanvasManager drop
if (data.type === 'MAP') {
  // Place map (no grid snapping, no cropping)
}
```

### Task 4: Extract Component from CanvasManager

If CanvasManager grows too large (> 300 lines), extract subcomponents:

```typescript
// 1. Create components/Canvas/DrawingLayer.tsx
const DrawingLayer = ({ drawings, tempLine }: {
  drawings: Drawing[];
  tempLine: Drawing | null;
}) => {
  return (
    <>
      {drawings.map((line) => (
        <Line key={line.id} points={line.points} stroke={line.color} {...} />
      ))}
      {tempLine && <Line points={tempLine.points} stroke={tempLine.color} {...} />}
    </>
  );
};

// 2. Use in CanvasManager
<Layer>
  <GridOverlay {...} />
  <DrawingLayer drawings={drawings} tempLine={tempLine} />
  {/* Tokens */}
</Layer>
```

## Performance Optimization

### Memoization for Expensive Renders

```typescript
// Memoize grid overlay (only re-render when size/gridSize changes)
const MemoizedGridOverlay = React.memo(GridOverlay, (prev, next) => {
  return (
    prev.width === next.width &&
    prev.height === next.height &&
    prev.gridSize === next.gridSize
  );
});
```

### Virtualization for Long Lists

When Sidebar has many tokens:

```typescript
import { FixedSizeGrid } from 'react-window';

<FixedSizeGrid
  columnCount={2}
  columnWidth={100}
  height={600}
  rowCount={Math.ceil(tokens.length / 2)}
  rowHeight={100}
  width={250}
>
  {({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * 2 + columnIndex;
    const token = tokens[index];
    return <div style={style}>{/* Token */}</div>;
  }}
</FixedSizeGrid>
```

### Lazy Loading

For heavy components (ImageCropper):

```typescript
const ImageCropper = React.lazy(() => import('./ImageCropper'));

{pendingCrop && (
  <React.Suspense fallback={<div>Loading...</div>}>
    <ImageCropper {...} />
  </React.Suspense>
)}
```

## Testing

### Component Testing Checklist

**SyncManager:**
- [ ] Detects window type correctly
- [ ] Architect View: subscription active
- [ ] World View: IPC listener active
- [ ] State updates trigger IPC send
- [ ] IPC receives update store

**Sidebar:**
- [ ] Library tokens render
- [ ] Drag-and-drop initiates correctly
- [ ] JSON data transferred

**CanvasManager:**
- [ ] Canvas resizes on window resize
- [ ] File drop triggers cropping UI
- [ ] Library drop adds token directly
- [ ] Drawing tools create strokes
- [ ] Grid snapping works
- [ ] Token dragging works

**ImageCropper:**
- [ ] Cropping UI renders
- [ ] Zoom control works (1x to 3x)
- [ ] Crop area adjustable
- [ ] Confirm returns Blob
- [ ] Cancel closes modal

**GridOverlay:**
- [ ] Grid lines render
- [ ] Grid size respected
- [ ] Non-interactive (can't click grid)

## Common Issues

### Issue: SyncManager not syncing
**Symptoms:** Changes in Architect View don't appear in World View

**Diagnosis:**
1. Check window type detection (log `isWorldView`)
2. Verify subscription active (log in subscribe callback)
3. Check IPC send (log before send)
4. Verify main process broadcast (log in electron/main.ts)
5. Check World View listener (log on receive)

**Solution:** Add comprehensive logging:
```typescript
useEffect(() => {
  const isWorldView = new URLSearchParams(window.location.search).get('type') === 'world';
  console.log('[SYNC] Window type:', isWorldView);

  if (isWorldView) {
    console.log('[SYNC] Setting up listener');
    window.ipcRenderer.on('SYNC_WORLD_STATE', (_event, state) => {
      console.log('[SYNC] Received:', state);
      useGameStore.setState(state);
    });
  } else {
    console.log('[SYNC] Setting up subscription');
    const unsub = useGameStore.subscribe((state) => {
      console.log('[SYNC] Sending:', state);
      window.ipcRenderer.send('SYNC_WORLD_STATE', state);
    });
    return unsub;
  }
}, []);
```

### Issue: ImageCropper not closing
**Symptoms:** Cropper modal stuck on screen

**Diagnosis:** `pendingCrop` state not being cleared

**Solution:**
```typescript
// Ensure onConfirm and onCancel both clear state
const handleCropConfirm = async (blob: Blob) => {
  try {
    // Process blob...
  } finally {
    setPendingCrop(null);  // Always clear, even on error
  }
};
```

### Issue: Canvas not resizing
**Symptoms:** Canvas stays at initial size when window resized

**Diagnosis:** Resize listener not set up or containerRef not assigned

**Solution:**
```typescript
const containerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const handleResize = () => {
    if (containerRef.current) {
      setSize({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
      });
    }
  };

  window.addEventListener('resize', handleResize);
  handleResize();  // Initial size

  return () => window.removeEventListener('resize', handleResize);
}, []);

return <div ref={containerRef}>{/* Canvas */}</div>;
```

### Issue: Drag-and-drop not working
**Symptoms:** Dropped files/tokens don't appear

**Diagnosis:**
1. Missing `onDragOver={e => e.preventDefault()}`
2. Wrong data key in dataTransfer
3. File not being processed

**Solution:**
```typescript
// MUST prevent default on dragover
const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();  // Critical!
};

const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();

  // Check JSON first
  const jsonData = e.dataTransfer.getData('application/json');
  if (jsonData) {
    console.log('[DROP] JSON data:', jsonData);
    // Handle library token
  }

  // Then check files
  if (e.dataTransfer.files.length > 0) {
    console.log('[DROP] Files:', e.dataTransfer.files);
    // Handle file upload
  }
};

<div onDragOver={handleDragOver} onDrop={handleDrop}>
  Drop zone
</div>
```

## Future Components

### Planned
1. **TokenContextMenu** - Right-click menu for tokens (delete, rotate, scale)
2. **FogOfWarLayer** - Render fog overlay with reveal areas
3. **ToolSettings** - Panel for tool-specific settings (marker color, stroke width)
4. **AssetLibraryManager** - Full library UI with search, categories, upload
5. **SettingsDialog** - Application settings (grid size, colors, shortcuts)
6. **ErrorBoundary** - Catch component errors, show fallback UI

### Under Consideration
1. **TokenAuras** - Circular radius indicators around tokens
2. **RulerOverlay** - Measure distances between points
3. **TextLabel** - Add text annotations to map
4. **ShapeTools** - Rectangle, circle, line drawing tools
5. **MiniMap** - Thumbnail overview for large maps

## Related Documentation

- **[Canvas System](../../docs/components/canvas.md)** - Canvas-specific component docs
- **[Architecture Overview](../../docs/architecture/ARCHITECTURE.md)** - Overall component architecture
- **[Code Conventions](../../docs/guides/CONVENTIONS.md)** - Component structure standards
- **[Renderer Process](../README.md)** - Renderer process overview
