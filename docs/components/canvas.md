# Canvas System

Canvas-specific React components that handle rendering and interaction with the Konva-based battlemap canvas.

## Components

### CanvasManager.tsx

Primary canvas component - handles all canvas interactions and rendering.

**Location**: `/src/components/Canvas/CanvasManager.tsx`

#### Responsibilities

1. Canvas setup and sizing (Konva Stage/Layer initialization)
2. Drag-and-drop handling (file uploads, library token drops)
3. Drawing tools (marker, eraser)
4. Token rendering with URLImage components
5. Asset cropping integration

See [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) for detailed implementation.

### GridOverlay.tsx

Renders grid lines on canvas.

**Location**: `/src/components/Canvas/GridOverlay.tsx`

Generates vertical and horizontal grid lines as non-interactive Konva Line components.

### FogOfWarLayer.tsx

Renders fog of war overlay with vision-based reveals.

**Location**: `/src/components/Canvas/FogOfWarLayer.tsx`

**Features:**

- Three-state fog: Unexplored (dark), Explored (dimmed), Current Vision (clear)
- Raycasting-based vision calculation (360-degree with wall occlusion)
- Works with or without map (supports hand-drawn maps)
- Only renders in World View when Daylight Mode is disabled

**Props:**

- `tokens: Token[]` - All tokens (filters to PC tokens with vision internally)
- `drawings: Drawing[]` - All drawings (filters to walls for occlusion)
- `gridSize: number` - Grid size for feet-to-pixels conversion
- `visibleBounds: { x, y, width, height }` - Canvas viewport bounds
- `map: MapConfig | null` - Optional map background

### TokenLayer.tsx

Placeholder component - currently unused.

**Location**: `/src/components/Canvas/TokenLayer.tsx`

Can be repurposed for token z-order management or grouping.

## Related Documentation

- [Architecture Overview](../architecture/ARCHITECTURE.md)
- [Code Conventions](../guides/CONVENTIONS.md)
- [Grid Utilities](../architecture/ARCHITECTURE.md#utility-functions)
