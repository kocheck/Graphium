# Canvas Components

Canvas-specific React components that handle rendering and interaction with the Konva-based battlemap canvas.

## Purpose

This subdirectory contains components responsible for:
- Main canvas logic (drag-drop, drawing, token rendering)
- Grid overlay rendering
- Fog of War rendering with raycasting
- Layer management (background, drawings, fog, tokens)

## Contents

### CanvasManager.tsx (245 lines)
**Primary canvas component - handles all canvas interactions and rendering**

#### Responsibilities

1. **Canvas Setup and Sizing**
   - Konva Stage/Layer initialization
   - Auto-resize on window resize
   - Container ref management

2. **Drag-and-Drop Handling**
   - File uploads (triggers cropping UI)
   - Library token drops (JSON data transfer)
   - Grid-snapped positioning

3. **Drawing Tools**
   - Marker tool (freehand strokes with configurable color)
   - Eraser tool (destination-out composite)
   - Wall tool (vision-blocking lines for fog of war)
   - Shift-key axis locking (horizontal/vertical straight lines)
   - Real-time preview during drag (temp line pattern)

4. **Token Rendering**
   - URLImage components for each token
   - file:// → media:// path conversion
   - Grid-snapped placement

5. **Asset Cropping**
   - ImageCropper modal trigger
   - Blob processing after crop
   - Asset optimization pipeline integration

#### Props

```typescript
interface CanvasManagerProps {
  tool?: 'select' | 'marker' | 'eraser' | 'wall';
  color?: string;
  onSelectionChange?: (selectedIds: string[]) => void;
}
```

**Default:** `tool='select'`

#### Key State

```typescript
// Sizing
const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

// Cropping
const [pendingCrop, setPendingCrop] = useState<{ src: string, x: number, y: number } | null>(null);

// Drawing preview
const [tempLine, setTempLine] = useState<Drawing | null>(null);

// Refs (mutable, no re-render)
const containerRef = useRef<HTMLDivElement>(null);
const isDrawing = useRef(false);
const currentLine = useRef<any>(null);

// Store (global state)
const { tokens, drawings, gridSize, addToken, addDrawing } = useGameStore();
```

#### Component Structure

```typescript
CanvasManager
├─ Container div (ref, drag handlers)
│  ├─ ImageCropper (conditional, modal overlay)
│  └─ Stage (react-konva root)
│     └─ Layer
│        ├─ GridOverlay
│        ├─ Line[] (drawings)
│        ├─ Line (temp line preview)
│        └─ URLImage[] (tokens)
```

#### Event Handlers

**Drag-and-Drop:**
```typescript
const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();  // Required for drop to work
};

const handleDrop = async (e: React.DragEvent) => {
  e.preventDefault();

  // Calculate grid-snapped position
  const stageRect = containerRef.current?.getBoundingClientRect();
  const rawX = e.clientX - stageRect.left;
  const rawY = e.clientY - stageRect.top;
  const { x, y } = snapToGrid(rawX, rawY, gridSize);

  // Check for library token (JSON data)
  const jsonData = e.dataTransfer.getData('application/json');
  if (jsonData) {
    const data = JSON.parse(jsonData);
    if (data.type === 'LIBRARY_TOKEN') {
      addToken({
        id: crypto.randomUUID(),
        x, y,
        src: data.src,
        scale: 1,
      });
      return;
    }
  }

  // Check for file upload
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    const objectUrl = URL.createObjectURL(file);
    setPendingCrop({ src: objectUrl, x, y });  // Trigger cropping UI
  }
};
```

**Drawing Tools:**
```typescript
const handleMouseDown = (e: any) => {
  if (tool === 'select') return;  // No-op

  isDrawing.current = true;
  const pos = e.target.getStage().getPointerPosition();

  currentLine.current = {
    id: crypto.randomUUID(),
    tool: tool,
    points: [pos.x, pos.y],
    color: tool === 'eraser' ? '#000000' : '#df4b26',
    size: tool === 'eraser' ? 20 : 5,
  };
};

const handleMouseMove = (e: any) => {
  if (!isDrawing.current || tool === 'select') return;

  const stage = e.target.getStage();
  const point = stage.getPointerPosition();

  // Mutate ref (no re-render)
  currentLine.current.points = currentLine.current.points.concat([point.x, point.y]);

  // Update local state (triggers re-render of preview only)
  setTempLine({ ...currentLine.current });
};

const handleMouseUp = () => {
  if (!isDrawing.current || tool === 'select') return;

  isDrawing.current = false;
  if (tempLine) {
    addDrawing(tempLine);  // Commit to store (triggers IPC sync)
    setTempLine(null);
  }
};
```

**Cropping Confirmation:**
```typescript
const handleCropConfirm = async (blob: Blob) => {
  if (!pendingCrop) return;

  try {
    const file = new File([blob], "token.webp", { type: 'image/webp' });

    // Process image (resize, convert to WebP, save to temp)
    const src = await processImage(file, 'TOKEN');

    addToken({
      id: crypto.randomUUID(),
      x: pendingCrop.x,
      y: pendingCrop.y,
      src,  // file:// URL
      scale: 1,
    });
  } catch (err) {
    console.error("Crop save failed", err);
  } finally {
    setPendingCrop(null);  // Close modal
  }
};
```

#### Critical Patterns

**Pattern 1: Temp Line for Drawing Preview**
```typescript
// WHY: Avoid store updates during drag (60 updates/sec would spam IPC)

// REF for mutable state (no re-render)
const isDrawing = useRef(false);
const currentLine = useRef<Drawing | null>(null);

// LOCAL STATE for preview rendering (re-renders this component only)
const [tempLine, setTempLine] = useState<Drawing | null>(null);

// On mousedown: Initialize ref
currentLine.current = { id, tool, points: [x, y], color, size };

// On mousemove: Mutate ref, update local state
currentLine.current.points.push(x, y);
setTempLine({ ...currentLine.current });

// On mouseup: Commit to store
addDrawing(tempLine);  // Store update → IPC sync
setTempLine(null);  // Clear preview
```

**Pattern 2: Grid Snapping**
```typescript
// ALWAYS snap token positions to grid
const { x, y } = snapToGrid(rawX, rawY, gridSize);
addToken({ id: crypto.randomUUID(), x, y, src, scale: 1 });

// Grid coordinates are top-left corner of cell
// Token renders centered in cell (Konva Image x/y is top-left)
```

**Pattern 3: Two Drag-Drop Modes**
```typescript
// Check JSON first (library tokens)
const jsonData = e.dataTransfer.getData('application/json');
if (jsonData) {
  // Handle library token (no cropping)
  const data = JSON.parse(jsonData);
  addToken({ ...token, src: data.src });
  return;  // Early return
}

// Then check files (uploads)
if (e.dataTransfer.files.length > 0) {
  // Handle file upload (with cropping)
  const file = e.dataTransfer.files[0];
  setPendingCrop({ src: URL.createObjectURL(file), x, y });
}
```

#### URLImage Subcomponent

**Purpose:** Renders token images with file:// → media:// conversion

```typescript
const URLImage = ({ src, x, y, width, height }: any) => {
  // Convert file:// to media:// (custom protocol handler)
  const safeSrc = src.startsWith('file:') ? src.replace('file:', 'media:') : src;

  // useImage hook from 'use-image' library
  // Caches loaded images, returns [image, status]
  const [img] = useImage(safeSrc);

  return (
    <KonvaImage
      image={img}
      x={x}
      y={y}
      width={width}
      height={height}
      draggable  // Konva built-in drag
    />
  );
};
```

**Why media:// protocol?**
Browsers block file:// URLs due to CORS security policy. Custom media:// protocol (registered in electron/main.ts) bypasses this by fetching file:// on main process side.

#### Rendering Layer Order

```
Layer (bottom to top):
├─ Layer 1: GridOverlay (background, non-interactive)
├─ Layer 2: Drawings (marker/eraser/wall strokes)
│  └─ Temp Line (active drawing preview)
├─ FogOfWarLayer (World View only, masks visible areas)
└─ Layer 3: Tokens (top layer, interactive)
```

**Important:** Order matters in Konva. Later children render on top.

#### Performance Considerations

1. **Drawing Preview with Local State**
   - Avoids 60 store updates/sec during drag
   - Only final stroke triggers IPC sync

2. **Container Ref for Size**
   - Avoids layout thrashing
   - Uses ResizeObserver pattern (via useEffect)

3. **Konva Drag Optimization**
   - Stage draggable only when tool='select'
   - Avoids conflicting drag handlers

4. **Image Caching**
   - useImage hook caches loaded images
   - Re-renders don't re-fetch

#### Usage Example

```typescript
// In App.tsx
const [tool, setTool] = useState<'select' | 'marker' | 'eraser'>('select');

return (
  <div className="flex">
    <Sidebar />
    <div className="flex-1">
      <CanvasManager tool={tool} />
      {/* Toolbar */}
      <div className="fixed top-4 right-4">
        <button onClick={() => setTool('select')}>Select</button>
        <button onClick={() => setTool('marker')}>Marker</button>
        <button onClick={() => setTool('eraser')}>Eraser</button>
      </div>
    </div>
  </div>
);
```

---

### GridOverlay.tsx (51 lines)
**Renders grid lines on canvas**

#### Responsibilities
- Generate vertical and horizontal grid lines
- Render as Konva Line components
- Non-interactive (listening={false})

#### Props

```typescript
interface GridOverlayProps {
  width: number;      // Canvas width in pixels
  height: number;     // Canvas height in pixels
  gridSize: number;   // Grid cell size in pixels (default: 50)
  stroke?: string;    // Line color (default: '#222')
  opacity?: number;   // Line opacity (default: 0.5)
}
```

#### Implementation

```typescript
const GridOverlay: React.FC<GridOverlayProps> = ({
  width,
  height,
  gridSize,
  stroke = '#222',
  opacity = 0.5
}) => {
  const lines = [];

  // Vertical lines (every gridSize pixels)
  for (let x = 0; x <= width; x += gridSize) {
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, 0, x, height]}  // Top to bottom
        stroke={stroke}
        strokeWidth={1}
        opacity={opacity}
      />
    );
  }

  // Horizontal lines (every gridSize pixels)
  for (let y = 0; y <= height; y += gridSize) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[0, y, width, y]}  // Left to right
        stroke={stroke}
        strokeWidth={1}
        opacity={opacity}
      />
    );
  }

  return <Group listening={false}>{lines}</Group>;
};
```

#### Performance Optimization

**Current implementation:** O(n*m) Line components
- 4096×4096px canvas at 50px grid = 81×81 = **6561 lines**
- May cause performance issues on large canvases

**Optimization opportunities:**

1. **Use single Path instead:**
```typescript
const GridOverlay = ({ width, height, gridSize, stroke = '#222', opacity = 0.5 }) => {
  const pathData = useMemo(() => {
    let d = '';
    // Vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      d += `M${x},0 L${x},${height} `;
    }
    // Horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      d += `M0,${y} L${width},${y} `;
    }
    return d;
  }, [width, height, gridSize]);

  return (
    <Path
      data={pathData}
      stroke={stroke}
      strokeWidth={1}
      opacity={opacity}
      listening={false}
    />
  );
};
```

2. **Memoize component:**
```typescript
export default React.memo(GridOverlay, (prev, next) => {
  return (
    prev.width === next.width &&
    prev.height === next.height &&
    prev.gridSize === next.gridSize &&
    prev.stroke === next.stroke &&
    prev.opacity === next.opacity
  );
});
```

3. **Viewport culling (future):**
```typescript
// Only render grid lines in visible viewport
const visibleLines = lines.filter(line => {
  return isInViewport(line, viewport);
});
```

#### Usage

```typescript
<Layer>
  <GridOverlay
    width={size.width}
    height={size.height}
    gridSize={gridSize}
  />
  {/* Other canvas elements */}
</Layer>
```

---

### FogOfWarLayer.tsx (254 lines)
**Renders dynamic fog of war with raycasting-based visibility calculation**

#### Responsibilities
- Calculate visibility polygons for PC tokens based on visionRadius
- Implement 360-degree raycasting with wall occlusion
- Render opaque fog layer with cut-out visible areas
- Only render in World View (Player window)

#### Props

```typescript
interface FogOfWarLayerProps {
  tokens: Token[];              // All tokens (filters to PC tokens internally)
  drawings: Drawing[];          // All drawings (filters to walls internally)
  gridSize: number;             // For feet-to-pixels conversion
  visibleBounds: {              // Canvas viewport for fog rendering
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

#### Algorithm: 360-Degree Raycasting

**Step 1: Filter PC Tokens**
```typescript
const pcTokens = tokens.filter(
  (t) => t.type === 'PC' && (t.visionRadius ?? 0) > 0
);
```

**Step 2: Extract Wall Segments**
```typescript
const walls: WallSegment[] = [];
drawings
  .filter((d) => d.tool === 'wall')
  .forEach((wall) => {
    // Convert points array to line segments
    for (let i = 0; i < wall.points.length - 2; i += 2) {
      walls.push({
        start: { x: wall.points[i], y: wall.points[i + 1] },
        end: { x: wall.points[i + 2], y: wall.points[i + 3] },
      });
    }
  });
```

**Step 3: Cast Rays for Each PC**
```typescript
for (let i = 0; i < 360; i++) {
  const angle = (i * Math.PI * 2) / 360;
  const rayEndpoint = castRay(tokenX, tokenY, angle, visionRadius, walls);
  visibilityPolygon.push(rayEndpoint);
}
```

**Step 4: Line Segment Intersection**
```typescript
// For each ray, test against all walls
for (const wall of walls) {
  const intersection = lineSegmentIntersection(
    rayOriginX, rayOriginY,
    rayEndX, rayEndY,
    wall.start.x, wall.start.y,
    wall.end.x, wall.end.y
  );

  if (intersection && distanceToIntersection < closestDistance) {
    closestDistance = distanceToIntersection;
    rayEndpoint = intersection;
  }
}
```

#### Rendering

```typescript
<Layer listening={false}>
  {/* Full black fog */}
  <Rect
    x={visibleBounds.x}
    y={visibleBounds.y}
    width={visibleBounds.width}
    height={visibleBounds.height}
    fill="black"
    opacity={0.9}
  />

  {/* Cut out visible areas */}
  {pcTokens.map((token) => (
    <Shape
      sceneFunc={(ctx, shape) => {
        const polygon = calculateVisibilityPolygon(...);
        ctx.beginPath();
        ctx.moveTo(polygon[0].x, polygon[0].y);
        polygon.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fillStrokeShape(shape);
      }}
      fill="black"
      globalCompositeOperation="destination-out"  // Erase fog
    />
  ))}
</Layer>
```

#### Performance Characteristics

**Complexity:** O(rayCount × walls.length × pcTokens.length)
- **rayCount:** 360 (fixed)
- **walls.length:** Typically 10-50
- **pcTokens.length:** Typically 3-6

**Typical Performance:**
- 3 PC tokens, 10 walls: ~5ms per frame
- 6 PC tokens, 50 walls: ~15ms per frame

**Optimizations:**
- Only renders in World View (invisible in DM view)
- Uses viewport bounds to cull fog rendering
- Line segment intersection with early-out checks

#### Grid Conversion

```typescript
// Convert vision radius from feet to pixels
const visionRadiusPx = (visionRadius / 5) * gridSize;

// Example: 60ft darkvision with 50px grid
// visionRadiusPx = (60 / 5) * 50 = 600 pixels
```

#### Usage

```typescript
// In CanvasManager.tsx (World View only)
{isWorldView && (
  <FogOfWarLayer
    tokens={tokens}
    drawings={drawings}
    gridSize={gridSize}
    visibleBounds={visibleBounds}
  />
)}
```

---

### TokenLayer.tsx (11 lines)
**Placeholder component - currently unused**

#### Current Implementation

```typescript
import { Group } from 'react-konva';

const TokenLayer = () => {
  return (
    <Group>
      {/* Tokens will be mapped here */}
    </Group>
  );
};

export default TokenLayer;
```

#### Original Intent

Separate layer for token rendering (isolation from other canvas elements).

#### Actual Implementation

Tokens currently rendered directly in CanvasManager's Layer component:

```typescript
{tokens.map((token) => (
  <URLImage
    key={token.id}
    src={token.src}
    x={token.x}
    y={token.y}
    width={gridSize * token.scale}
    height={gridSize * token.scale}
  />
))}
```

#### Status

**Can be deleted** or repurposed for future features:
- Token z-order management (bring to front/send to back)
- Token grouping (select multiple tokens)
- Token layer visibility toggle

#### If Repurposing

```typescript
// Refactor to handle token rendering + z-order
const TokenLayer = ({ tokens, gridSize, onTokenMove }: {
  tokens: Token[];
  gridSize: number;
  onTokenMove: (id: string, x: number, y: number) => void;
}) => {
  return (
    <Group>
      {tokens
        .sort((a, b) => a.zIndex - b.zIndex)  // Sort by z-order
        .map((token) => (
          <URLImage
            key={token.id}
            {...token}
            width={gridSize * token.scale}
            height={gridSize * token.scale}
            draggable
            onDragEnd={(e) => {
              const pos = e.target.position();
              const snapped = snapToGrid(pos.x, pos.y, gridSize);
              onTokenMove(token.id, snapped.x, snapped.y);
            }}
          />
        ))}
    </Group>
  );
};
```

---

## Common Patterns

### Pattern 1: Konva Event Handling

```typescript
// Konva events use 'any' type (no official types available)
const handleKonvaEvent = (e: any) => {
  const stage = e.target.getStage();
  const pos = stage.getPointerPosition();  // { x, y }
  const node = e.target;  // Clicked Konva node
};
```

### Pattern 2: Layer Management

```typescript
<Stage>
  <Layer>
    {/* Background elements (grid) */}
    <GridOverlay />
  </Layer>
  <Layer>
    {/* Interactive elements (tokens, drawings) */}
    {tokens.map(...)}
  </Layer>
  <Layer>
    {/* UI overlays (future: fog of war) */}
  </Layer>
</Stage>
```

**Note:** Multiple layers can improve performance (Konva re-renders only changed layers).

### Pattern 3: Coordinate Systems

**Konva uses top-left origin:**
```
(0,0) ────────── (width, 0)
  │                    │
  │                    │
  │                    │
(0, height) ─── (width, height)
```

**Grid snapping formula:**
```typescript
const snappedX = Math.round(x / gridSize) * gridSize;
const snappedY = Math.round(y / gridSize) * gridSize;
```

**Example:**
- Raw mouse position: (127, 83)
- Grid size: 50
- Snapped position: (150, 100)

### Pattern 4: Stage Dragging

```typescript
// Enable stage drag only in select mode
<Stage draggable={tool === 'select'}>

// WHY: Prevents conflicts with drawing tools
// If stage is draggable during marker/eraser, mousedown initiates drag instead of drawing
```

## Common Issues

### Issue: Tokens not rendering
**Symptoms:** Tokens in store but not visible on canvas

**Diagnosis:**
1. Check token.src paths (should be file:// or https://)
2. Verify media:// conversion in URLImage
3. Check useImage hook status (may return undefined while loading)

**Solution:**
```typescript
const URLImage = ({ src, ...props }: any) => {
  const safeSrc = src.startsWith('file:') ? src.replace('file:', 'media:') : src;
  const [img, status] = useImage(safeSrc);

  console.log('[URLImage] src:', src, 'status:', status);

  if (status === 'loading') return null;  // Or placeholder
  if (status === 'failed') {
    console.error('[URLImage] Failed to load:', safeSrc);
    return null;
  }

  return <KonvaImage image={img} {...props} />;
};
```

### Issue: Drawing lag
**Symptoms:** Canvas stutters during marker/eraser drag

**Diagnosis:** Updating store on mousemove (wrong pattern)

**Check:**
```typescript
// ❌ WRONG - updates store 60 times/sec
const handleMouseMove = (e: any) => {
  addDrawing({ points: [...currentPoints, x, y] });
};

// ✅ CORRECT - updates local state only
const handleMouseMove = (e: any) => {
  currentLine.current.points.push(x, y);
  setTempLine({ ...currentLine.current });
};
```

### Issue: Grid not resizing
**Symptoms:** Grid size doesn't match canvas size after window resize

**Diagnosis:** GridOverlay not receiving updated width/height

**Solution:**
```typescript
// Ensure CanvasManager updates size state
const [size, setSize] = useState({ width: 0, height: 0 });

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

// Pass to GridOverlay
<GridOverlay width={size.width} height={size.height} gridSize={gridSize} />
```

### Issue: Drag-and-drop not working
**Symptoms:** Dropped tokens don't appear

**Diagnosis:** Missing preventDefault on dragover

**Solution:**
```typescript
// CRITICAL: Must prevent default on dragover
const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();  // Without this, drop won't fire
};

<div onDragOver={handleDragOver} onDrop={handleDrop}>
```

## Future Canvas Features

### Planned
1. **Explored Fog** - Gray areas for previously-seen but not currently visible zones
2. **Token Z-Order** - Bring to front / send to back
3. **Shape Drawing Tools** - Rectangle, circle, line
4. **Text Labels** - Konva.Text for annotations
5. **Ruler Tool** - Measure grid distances (non-persistent overlay)
6. **Door Tool** - Toggleable wall segments (open/closed)
7. **Light Sources** - Token-emitted light (torches, spells) with color support

### Performance Improvements
1. **Grid optimization** - Use single Path instead of 6000+ Lines
2. **Viewport culling** - Only render visible tokens/drawings
3. **Layer separation** - Background, tokens, UI (selective re-rendering)
4. **Image sprites** - Combine token images into sprite sheet

## Related Documentation

- **[Canvas System Documentation](../../../docs/components/canvas.md)** - Complete canvas documentation
- **[Component Overview](../../README.md)** - Parent component directory docs
- **[Architecture Overview](../../../docs/architecture/ARCHITECTURE.md)** - Rendering engine details
- **[Code Conventions](../../../docs/guides/CONVENTIONS.md)** - Component structure standards
