# Utilities

Pure utility functions for Graphium. All functions in this directory are side-effect free and can be used anywhere in the application.

## Purpose

This directory contains:
- **Image processing** - Resize, convert, optimize uploaded assets
- **Grid math** - Coordinate snapping calculations
- **File operations** - Path manipulation, format conversion (future)
- **Validation** - Type guards, data validation (future)

## Contents

### `AssetProcessor.ts` (48 lines)
**Image optimization pipeline for uploaded assets**

#### Purpose

Optimizes user-uploaded images for performance and file size:
- Resize to maximum dimensions (prevent memory issues)
- Convert to WebP format (30-50% smaller than PNG/JPG)
- Save to Electron temp storage via IPC
- Return file:// URL for store

#### Exports

```typescript
export type AssetType = 'MAP' | 'TOKEN';

export const processImage = async (
  file: File,
  type: AssetType
): Promise<string>
```

#### Implementation

```typescript
const MAX_MAP_DIMENSION = 4096;   // 4K display support
const MAX_TOKEN_DIMENSION = 512;  // Performance optimization

export const processImage = async (file: File, type: AssetType): Promise<string> => {
  // 1. Create image bitmap from file
  const bitmap = await createImageBitmap(file);
  const maxDim = type === 'MAP' ? MAX_MAP_DIMENSION : MAX_TOKEN_DIMENSION;

  // 2. Calculate new dimensions (maintain aspect ratio)
  let width = bitmap.width;
  let height = bitmap.height;

  if (width > maxDim || height > maxDim) {
    const ratio = width / height;
    if (width > height) {
      width = maxDim;
      height = Math.round(maxDim / ratio);
    } else {
      height = maxDim;
      width = Math.round(maxDim * ratio);
    }
  }

  // 3. Draw to OffscreenCanvas (faster than DOM canvas)
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get 2D context from OffscreenCanvas');
  }

  ctx.drawImage(bitmap, 0, 0, width, height);

  // 4. Clean up bitmap
  bitmap.close();

  // 5. Convert to WebP blob (85% quality)
  const blob = await canvas.convertToBlob({
    type: 'image/webp',
    quality: 0.85,
  });

  // 6. Send to main process for file storage
  const buffer = await blob.arrayBuffer();
  const filePath = await window.ipcRenderer.invoke(
    'SAVE_ASSET_TEMP',
    buffer,
    file.name.replace(/\.[^/.]+$/, "") + ".webp"
  );

  return filePath as string;  // file:// URL
};
```

#### Key Details

**Why OffscreenCanvas?**
- Faster than DOM canvas (no reflow/repaint)
- Works in workers (future: offload processing)
- Modern API (supported in Electron)

**Why WebP?**
- 30-50% smaller than PNG/JPG
- Supports transparency (needed for tokens)
- Lossy + lossless modes (85% quality balances both)
- Wide browser support in Electron (Chromium)

**Why resize?**
- Large images cause memory issues (8K map = 32MB+ RAM)
- Slow rendering (60fps requires fast texture uploads)
- Bloated campaign files (10MB+ per map)

**Dimension limits:**
- Maps: 4096px (4K display full screen)
- Tokens: 512px (plenty for grid cells, even at 200px/cell)

#### Usage

```typescript
// In CanvasManager.tsx (after cropping)
const handleCropConfirm = async (blob: Blob) => {
  const file = new File([blob], "token.webp", { type: 'image/webp' });

  // Process image (resize, convert, save) - Returns cancellable handle
  const handle = processImage(file, 'TOKEN');
  const src = await handle.promise;
  // Returns: file:///Users/.../Graphium/temp_assets/1234567890-token.webp

  addToken({
    id: crypto.randomUUID(),
    x: pendingCrop.x,
    y: pendingCrop.y,
    src,  // file:// URL
    scale: 1,
  });
};
```

#### Error Handling

```typescript
try {
  const handle = processImage(file, 'TOKEN');
  const src = await handle.promise;
  addToken({ id, x, y, src, scale: 1 });
} catch (error) {
  console.error('[AssetProcessor] Failed to process image:', error);
  alert(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
```

**Possible errors:**
- File not a valid image (createImageBitmap fails)
- Canvas context unavailable (rare, browser issue)
- IPC invoke fails (Electron main process error)
- Out of memory (extremely large image)

#### Performance

**Benchmarks (rough estimates):**
- 1920×1080 PNG (2MB) → 512×288 WebP (50KB) in ~100ms
- 4096×4096 PNG (8MB) → 4096×4096 WebP (500KB) in ~300ms
- 8192×8192 PNG (32MB) → 4096×4096 WebP (500KB) in ~800ms

**Optimization opportunities:**
1. Use Web Worker (offload processing from main thread)
2. Show progress indicator (for large files)
3. Batch processing (multiple files at once)

---

### `grid.ts` (6 lines)
**Grid snapping math utilities**

#### Purpose

Snap pixel coordinates to nearest grid intersection for token placement.

#### Exports

```typescript
export const snapToGrid = (
  x: number,
  y: number,
  gridSize: number
): { x: number, y: number }
```

#### Implementation

```typescript
export const snapToGrid = (x: number, y: number, gridSize: number): { x: number, y: number } => {
  const snappedX = Math.round(x / gridSize) * gridSize;
  const snappedY = Math.round(y / gridSize) * gridSize;
  return { x: snappedX, y: snappedY };
};
```

#### Math Explanation

**Formula:** `snapped = Math.round(raw / gridSize) * gridSize`

**Example (gridSize = 50):**
```
Raw: 127 → 127 / 50 = 2.54 → round(2.54) = 3 → 3 * 50 = 150
Raw: 124 → 124 / 50 = 2.48 → round(2.48) = 2 → 2 * 50 = 100
Raw: 125 → 125 / 50 = 2.50 → round(2.50) = 3 → 3 * 50 = 150 (rounds up on .5)
```

**Visual:**
```
Grid cells (50px):
    0   50  100  150  200
    |---|---|---|---|---|
        ^
        |
Raw: 127 → Snaps to 150 (closer to 150 than 100)
Raw: 124 → Snaps to 100 (closer to 100 than 150)
```

#### Usage

```typescript
// In CanvasManager.tsx (drag-and-drop)
const handleDrop = (e: React.DragEvent) => {
  const stageRect = containerRef.current?.getBoundingClientRect();
  const rawX = e.clientX - stageRect.left;
  const rawY = e.clientY - stageRect.top;

  // Snap to grid
  const { x, y } = snapToGrid(rawX, rawY, gridSize);

  addToken({
    id: crypto.randomUUID(),
    x,  // Grid-aligned coordinate
    y,  // Grid-aligned coordinate
    src: tokenUrl,
    scale: 1,
  });
};
```

#### Edge Cases

**Zero coordinates:**
```typescript
snapToGrid(0, 0, 50)  // { x: 0, y: 0 }
```

**Negative coordinates (future: scrollable canvas):**
```typescript
snapToGrid(-75, -75, 50)  // { x: -100, y: -100 }
snapToGrid(-24, -24, 50)  // { x: 0, y: 0 }
```

**Non-standard grid sizes:**
```typescript
snapToGrid(127, 83, 25)   // { x: 125, y: 75 }
snapToGrid(127, 83, 100)  // { x: 100, y: 100 }
```

#### Testing

```typescript
// grid.test.ts
import { snapToGrid } from './grid';

describe('snapToGrid', () => {
  test('snaps to nearest grid intersection', () => {
    expect(snapToGrid(127, 83, 50)).toEqual({ x: 150, y: 100 });
  });

  test('handles exact grid positions', () => {
    expect(snapToGrid(100, 50, 50)).toEqual({ x: 100, y: 50 });
  });

  test('rounds down when closer to lower intersection', () => {
    expect(snapToGrid(124, 74, 50)).toEqual({ x: 100, y: 50 });
  });

  test('rounds up on .5 boundary', () => {
    expect(snapToGrid(125, 75, 50)).toEqual({ x: 150, y: 100 });
  });

  test('handles zero coordinates', () => {
    expect(snapToGrid(0, 0, 50)).toEqual({ x: 0, y: 0 });
  });

  test('handles negative coordinates', () => {
    expect(snapToGrid(-75, -75, 50)).toEqual({ x: -100, y: -100 });
  });

  test('works with non-50px grid sizes', () => {
    expect(snapToGrid(127, 83, 25)).toEqual({ x: 125, y: 75 });
    expect(snapToGrid(127, 83, 100)).toEqual({ x: 100, y: 100 });
  });
});
```

---

## Utility Function Guidelines

### Rules for Utilities

1. **Pure functions only**
   - No side effects (no API calls, file I/O, DOM manipulation)
   - Same input = same output (deterministic)
   - No global state access

2. **Type safety**
   - Explicit parameter types
   - Explicit return types
   - No `any` types (use `unknown` if necessary)

3. **Documentation**
   - JSDoc for all exported functions
   - Include @param and @returns
   - Provide @example

4. **Error handling**
   - Throw on invalid input (don't return null/undefined)
   - Use Error subclasses for specific errors
   - Document errors in JSDoc (@throws)

5. **Testing**
   - Write unit tests for all utilities
   - Cover edge cases (zero, negative, boundary values)
   - Test error conditions

### Template for New Utility

```typescript
/**
 * Brief description of what this function does
 *
 * Longer explanation of how it works and why it exists.
 *
 * @param paramName - Description and constraints
 * @param anotherParam - Description and constraints
 * @returns Description of return value
 * @throws {ErrorType} When this error occurs
 *
 * @example
 * const result = utilityFunction(param1, param2);
 * // Returns: expected value
 */
export const utilityFunction = (
  paramName: Type,
  anotherParam: Type
): ReturnType => {
  // Input validation
  if (invalidInput) {
    throw new Error('Descriptive error message');
  }

  // Implementation
  const result = doSomething(paramName, anotherParam);

  return result;
};
```

## Future Utilities

### Planned

1. **File utilities (fileUtils.ts)**
```typescript
// Extract filename from path
export const getFilename = (path: string): string => {
  return path.split('/').pop() || '';
};

// Get file extension
export const getExtension = (filename: string): string => {
  return filename.split('.').pop() || '';
};

// Convert file:// to media://
export const toMediaProtocol = (filePath: string): string => {
  return filePath.replace('file:', 'media:');
};
```

2. **Validation utilities (validation.ts)**
```typescript
// Type guard for Token
export const isValidToken = (data: unknown): data is Token => {
  if (typeof data !== 'object' || data === null) return false;
  const token = data as any;
  return (
    typeof token.id === 'string' &&
    typeof token.x === 'number' &&
    typeof token.y === 'number' &&
    typeof token.src === 'string' &&
    typeof token.scale === 'number'
  );
};

// Type guard for GameState
export const isValidGameState = (data: unknown): data is GameState => {
  if (typeof data !== 'object' || data === null) return false;
  const state = data as any;
  return (
    Array.isArray(state.tokens) &&
    Array.isArray(state.drawings) &&
    typeof state.gridSize === 'number' &&
    state.tokens.every(isValidToken) &&
    state.drawings.every(isValidDrawing)
  );
};
```

3. **Color utilities (colorUtils.ts)**
```typescript
// Hex to RGB
export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

// RGB to Hex
export const rgbToHex = (r: number, g: number, b: number): string => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};
```

4. **Coordinate utilities (coordinateUtils.ts)**
```typescript
// Distance between two points
export const distance = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number => {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
};

// Convert pixels to grid cells
export const pixelsToGrid = (
  pixels: number,
  gridSize: number
): number => {
  return Math.floor(pixels / gridSize);
};

// Convert grid cells to pixels
export const gridToPixels = (
  cells: number,
  gridSize: number
): number => {
  return cells * gridSize;
};
```

5. **Array utilities (arrayUtils.ts)**
```typescript
// Move item in array
export const moveItem = <T>(
  array: T[],
  fromIndex: number,
  toIndex: number
): T[] => {
  const result = [...array];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
};

// Swap items in array
export const swapItems = <T>(
  array: T[],
  index1: number,
  index2: number
): T[] => {
  const result = [...array];
  [result[index1], result[index2]] = [result[index2], result[index1]];
  return result;
};
```

## Common Utility Patterns

### Pattern 1: Input Validation

```typescript
export const utilityFunction = (param: number): number => {
  // Validate input
  if (param < 0) {
    throw new Error('Parameter must be non-negative');
  }
  if (!Number.isFinite(param)) {
    throw new Error('Parameter must be a finite number');
  }

  // Implementation
  return param * 2;
};
```

### Pattern 2: Early Returns

```typescript
export const utilityFunction = (param: string | null): string => {
  // Handle null early
  if (param === null) {
    return '';
  }

  // Handle empty string
  if (param.length === 0) {
    return '';
  }

  // Main logic
  return param.toUpperCase();
};
```

### Pattern 3: Type Guards

```typescript
export const isToken = (data: unknown): data is Token => {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const token = data as Token;
  return (
    typeof token.id === 'string' &&
    typeof token.x === 'number' &&
    typeof token.y === 'number' &&
    typeof token.src === 'string' &&
    typeof token.scale === 'number'
  );
};

// Usage
if (isToken(data)) {
  // TypeScript knows data is Token
  console.log(data.id);
}
```

### Pattern 4: Currying (Partial Application)

```typescript
// Create specialized versions of functions
export const createGridSnapper = (gridSize: number) => {
  return (x: number, y: number) => snapToGrid(x, y, gridSize);
};

// Usage
const snapTo50 = createGridSnapper(50);
const pos1 = snapTo50(127, 83);  // { x: 150, y: 100 }
const pos2 = snapTo50(234, 156); // { x: 250, y: 150 }
```

## Testing Utilities

### Unit Test Template

```typescript
// utils/grid.test.ts
import { snapToGrid } from './grid';

describe('snapToGrid', () => {
  describe('normal cases', () => {
    test('snaps to nearest grid intersection', () => {
      expect(snapToGrid(127, 83, 50)).toEqual({ x: 150, y: 100 });
    });

    test('handles exact grid positions', () => {
      expect(snapToGrid(100, 50, 50)).toEqual({ x: 100, y: 50 });
    });
  });

  describe('edge cases', () => {
    test('handles zero coordinates', () => {
      expect(snapToGrid(0, 0, 50)).toEqual({ x: 0, y: 0 });
    });

    test('handles negative coordinates', () => {
      expect(snapToGrid(-75, -75, 50)).toEqual({ x: -100, y: -100 });
    });
  });

  describe('boundary cases', () => {
    test('rounds up on .5 boundary', () => {
      expect(snapToGrid(125, 75, 50)).toEqual({ x: 150, y: 100 });
    });
  });

  describe('different grid sizes', () => {
    test('works with 25px grid', () => {
      expect(snapToGrid(127, 83, 25)).toEqual({ x: 125, y: 75 });
    });

    test('works with 100px grid', () => {
      expect(snapToGrid(127, 83, 100)).toEqual({ x: 100, y: 100 });
    });
  });
});
```

## Common Issues

### Issue: Utility modifying input parameters
**Symptoms:** Array/object passed to utility is mutated

**Solution:**
```typescript
// ❌ WRONG - mutates input
export const addToArray = <T>(array: T[], item: T): T[] => {
  array.push(item);  // Mutates input!
  return array;
};

// ✅ CORRECT - creates new array
export const addToArray = <T>(array: T[], item: T): T[] => {
  return [...array, item];  // New array
};
```

### Issue: Utility returning inconsistent types
**Symptoms:** Sometimes returns null, sometimes returns value

**Solution:**
```typescript
// ❌ WRONG - inconsistent return type
export const getFilename = (path: string | null): string | null => {
  if (!path) return null;
  return path.split('/').pop() || null;
};

// ✅ CORRECT - consistent return type
export const getFilename = (path: string): string => {
  return path.split('/').pop() || '';  // Always returns string
};

// Or throw on invalid input
export const getFilename = (path: string | null): string => {
  if (!path) {
    throw new Error('Path cannot be null');
  }
  const filename = path.split('/').pop();
  if (!filename) {
    throw new Error('Invalid path format');
  }
  return filename;
};
```

### Issue: Utility doing too much
**Symptoms:** Function has many responsibilities, hard to test

**Solution:**
```typescript
// ❌ WRONG - too many responsibilities
export const processAndSaveImage = async (
  file: File,
  type: AssetType
): Promise<void> => {
  const resized = await resizeImage(file, type);
  const converted = await convertToWebP(resized);
  await saveToFile(converted);
  await updateStore(converted);  // Side effect!
};

// ✅ CORRECT - split into smaller utilities
export const resizeImage = async (file: File, maxDim: number): Promise<Blob> => {
  // Pure function
};

export const convertToWebP = async (blob: Blob, quality: number): Promise<Blob> => {
  // Pure function
};

// Component handles side effects
const handleUpload = async (file: File) => {
  const resized = await resizeImage(file, 512);
  const converted = await convertToWebP(resized, 0.85);
  const url = await saveToFile(converted);
  addToken({ src: url, ... });
};
```

## Related Documentation

- **[Code Conventions](../../docs/guides/CONVENTIONS.md)** - Code style guidelines
- **[Renderer Process](../README.md)** - Renderer process overview
- **[Canvas System](../../docs/components/canvas.md)** - Asset processing usage
- **[Architecture Overview](../../docs/architecture/ARCHITECTURE.md)** - Utility role in architecture
