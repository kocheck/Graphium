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

### TokenLayer.tsx
Placeholder component - currently unused.

**Location**: `/src/components/Canvas/TokenLayer.tsx`

Can be repurposed for token z-order management or grouping.

## Related Documentation
- [Architecture Overview](../architecture/ARCHITECTURE.md)
- [Code Conventions](../guides/CONVENTIONS.md)
- [Grid Utilities](../architecture/ARCHITECTURE.md#utility-functions)
