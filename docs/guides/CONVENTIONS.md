# Graphium Code Conventions

This document defines the coding standards, style guidelines, and best practices for the Graphium project. Following these conventions ensures consistency, maintainability, and effective AI-assisted development.

## Table of Contents

- [File Naming](#file-naming)
- [Directory Structure](#directory-structure)
- [TypeScript Standards](#typescript-standards)
- [Component Structure](#component-structure)
- [Import Organization](#import-organization)
- [State Management](#state-management)
- [Event Handlers](#event-handlers)
- [Styling (Tailwind CSS)](#styling-tailwind-css)
- [Error Handling](#error-handling)
- [Comments and Documentation](#comments-and-documentation)
- [Git Workflow](#git-workflow)
- [Testing](#testing)

---

## File Naming

### Components (React)

**Format:** PascalCase

```
CanvasManager.tsx
ImageCropper.tsx
GridOverlay.tsx
TokenLibrary.tsx
```

**Rules:**

- Must end with `.tsx` (if contains JSX)
- Must end with `.ts` (if pure TypeScript, no JSX)
- Component name MUST match filename

✅ **Correct:**

```typescript
// File: CanvasManager.tsx
export default CanvasManager;
```

❌ **Incorrect:**

```typescript
// File: canvas-manager.tsx
export default CanvasManager; // Mismatch in casing
```

### Utilities and Stores

**Format:** camelCase

```
grid.ts
gameStore.ts
assetProcessor.ts
imageUtils.ts
```

**Rules:**

- Must end with `.ts`
- Descriptive, single-responsibility names
- Avoid generic names (e.g., `utils.ts` is too vague)

### Configuration Files

**Format:** kebab-case

```
vite.config.ts
electron-builder.json5
tsconfig.json
tailwind.config.js
```

**Rules:**

- Follow tool-specific conventions
- Use lowercase with hyphens

### Type Definition Files

**Format:** kebab-case + `.d.ts`

```
electron-env.d.ts
vite-env.d.ts
global.d.ts
```

---

## Directory Structure

### Organizing Components

**By Feature (Preferred):**

```
src/components/
├── Canvas/
│   ├── CanvasManager.tsx
│   ├── GridOverlay.tsx
│   ├── TokenLayer.tsx
│   └── FogOfWar.tsx
├── Sidebar/
│   ├── Sidebar.tsx
│   ├── TokenLibrary.tsx
│   └── AssetUpload.tsx
└── Modals/
    ├── ImageCropper.tsx
    ├── SettingsDialog.tsx
    └── SaveConfirmation.tsx
```

**Rules:**

- Group related components in subdirectories
- Keep maximum 10 files per directory
- Use `index.tsx` for barrel exports if needed (but prefer explicit imports)

### Utilities

```
src/utils/
├── grid.ts           # Grid snapping, coordinate math
├── imageUtils.ts     # Image processing helpers
├── fileUtils.ts      # File path manipulation
└── validation.ts     # Type guards, schema validation
```

**Rules:**

- One concern per file
- Export pure functions only (no side effects)
- Provide comprehensive JSDoc

### Stores

```
src/store/
├── gameStore.ts      # Main game state (tokens, drawings, grid)
├── uiStore.ts        # UI state (modals, tool selection)
└── libraryStore.ts   # Asset library state
```

**Rules:**

- One Zustand store per file
- Export store hook (e.g., `useGameStore`)
- Export types (e.g., `export interface GameState`)

---

## TypeScript Standards

### Strict Mode

**Always enabled** (tsconfig.json):

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Type Annotations

**Interfaces over Types** (for object shapes):

```typescript
// ✅ Correct
interface Token {
  id: string;
  x: number;
  y: number;
  src: string;
  scale: number;
}

// ❌ Avoid
type Token = {
  id: string;
  x: number;
  // ...
};
```

**Use `type` for:**

- Union types: `type Tool = 'select' | 'marker' | 'eraser'`
- Primitive aliases: `type UUID = string`
- Function signatures: `type Handler = (e: Event) => void`

**Explicit Return Types** (exported functions):

```typescript
// ✅ Correct
export const snapToGrid = (x: number, y: number, gridSize: number): { x: number; y: number } => {
  return { x: snappedX, y: snappedY };
};

// ❌ Avoid (inferred return type)
export const snapToGrid = (x: number, y: number, gridSize: number) => {
  return { x: snappedX, y: snappedY };
};
```

### Avoiding `any`

**Never use `any`** without explicit justification:

```typescript
// ❌ Wrong
const data: any = fetchData();

// ✅ Correct (use unknown and type guard)
const data: unknown = fetchData();
if (isValidData(data)) {
  // TypeScript now knows data is ValidData
}

// ✅ Correct (if truly unknown type)
const data: unknown = fetchData();

// ⚠️ Acceptable (temporary, with TODO)
// TODO: Add proper types for Konva event
const handleDrag = (e: any) => {
  const pos = e.target.getStage().getPointerPosition();
};
```

### `@ts-ignore` Usage

**Only use with comment explaining why:**

```typescript
// @ts-ignore - ipcRenderer types not available, will be fixed with proper type declarations
window.ipcRenderer.invoke('SAVE_CAMPAIGN', data);
```

**Preferred alternative:**

```typescript
// Create type declaration file (src/global.d.ts)
interface Window {
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    send: (channel: string, ...args: any[]) => void;
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  };
}
```

---

## Component Structure

### Standard Component Template

```typescript
// 1. External imports
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Stage, Layer } from 'react-konva';

// 2. Internal imports (utilities)
import { snapToGrid } from '../../utils/grid';
import { processImage } from '../../utils/AssetProcessor';

// 3. Internal imports (stores)
import { useGameStore } from '../../store/gameStore';

// 4. Internal imports (components)
import GridOverlay from './GridOverlay';
import ImageCropper from '../ImageCropper';

// 5. Type definitions
interface CanvasManagerProps {
  tool: 'select' | 'marker' | 'eraser';
  onToolChange?: (tool: string) => void;
}

interface LocalState {
  isDragging: boolean;
  cropData: CropData | null;
}

// 6. Component definition
const CanvasManager = ({ tool, onToolChange }: CanvasManagerProps) => {
  // 7. Refs (DOM and mutable values)
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);

  // 8. State hooks (local component state)
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [tempLine, setTempLine] = useState<Drawing | null>(null);

  // 9. Store hooks (global state)
  const { tokens, drawings, addToken, addDrawing } = useGameStore();

  // 10. Derived values (memoized computations)
  const visibleTokens = useMemo(() => {
    return tokens.filter(t => isInViewport(t, size));
  }, [tokens, size]);

  // 11. Callbacks (memoized event handlers)
  const handleResize = useCallback(() => {
    if (containerRef.current) {
      setSize({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
      });
    }
  }, []);

  // 12. Event handlers (non-memoized, simple handlers)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    // Handler logic
  };

  const handleMouseDown = (e: any) => {
    // Handler logic
  };

  // 13. Effects (side effects, subscriptions)
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial size

    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  useEffect(() => {
    // Effect logic
  }, [dependencies]);

  // 14. Render helpers (optional, for complex JSX)
  const renderTokens = () => {
    return tokens.map(token => (
      <TokenImage key={token.id} {...token} />
    ));
  };

  // 15. JSX return
  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-neutral-900"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <Stage width={size.width} height={size.height}>
        <Layer>
          <GridOverlay {...size} />
          {renderTokens()}
        </Layer>
      </Stage>
    </div>
  );
};

// 16. Export
export default CanvasManager;
```

### Component Rules

1. **Order matters** - Always follow template structure
2. **Group hooks by type** - refs, state, store, derived, callbacks
3. **Separate concerns** - Complex logic in utils, not in components
4. **Limit component size** - Max ~300 lines; extract subcomponents if larger
5. **No inline styles** - Use Tailwind classes only

---

## Import Organization

### Order

```typescript
// 1. React and core libraries
import React, { useState, useEffect } from 'react';

// 2. Third-party UI libraries (specific order not critical)
import { Stage, Layer, Line } from 'react-konva';
import Cropper from 'react-easy-crop';

// 3. Utilities (relative paths, closest to furthest)
import { snapToGrid } from './grid';
import { processImage } from '../utils/AssetProcessor';
import { formatDate } from '../../utils/dateUtils';

// 4. Stores
import { useGameStore } from '../store/gameStore';

// 5. Components (relative paths, closest to furthest)
import GridOverlay from './GridOverlay';
import Sidebar from '../Sidebar';

// 6. Types (if importing separately)
import type { Token, Drawing } from '../types';

// 7. Styles (if not using Tailwind)
import './ComponentName.css';
```

### Path Aliases

**Avoid excessive `../../..`** - Use TypeScript path aliases:

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@components/*": ["src/components/*"],
      "@utils/*": ["src/utils/*"],
      "@store/*": ["src/store/*"],
      "@types/*": ["src/types/*"]
    }
  }
}
```

**Then import as:**

```typescript
import { snapToGrid } from '@utils/grid';
import { useGameStore } from '@store/gameStore';
import GridOverlay from '@components/Canvas/GridOverlay';
```

---

## State Management

### Zustand Store Pattern

**Store Definition:**

```typescript
// src/store/gameStore.ts
import { create } from 'zustand';

// 1. Define state interface
export interface GameState {
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

// 2. Define related types
export interface Token {
  id: string;
  x: number;
  y: number;
  src: string;
  scale: number;
}

export interface Drawing {
  id: string;
  tool: 'marker' | 'eraser';
  points: number[];
  color: string;
  size: number;
}

// 3. Create store
export const useGameStore = create<GameState>((set) => ({
  // Initial state
  tokens: [],
  drawings: [],
  gridSize: 50,

  // Actions
  addToken: (token) =>
    set((state) => ({
      tokens: [...state.tokens, token],
    })),

  removeToken: (id) =>
    set((state) => ({
      tokens: state.tokens.filter((t) => t.id !== id),
    })),

  updateToken: (id, updates) =>
    set((state) => ({
      tokens: state.tokens.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  addDrawing: (drawing) =>
    set((state) => ({
      drawings: [...state.drawings, drawing],
    })),

  setGridSize: (size) => set({ gridSize: size }),

  setState: (partial) => set(partial),
}));
```

### Store Access Patterns

**Pattern 1: Component Rendering (Subscribe to changes)**

```typescript
const Component = () => {
  // Only re-renders when tokens change
  const tokens = useGameStore((state) => state.tokens);

  return <div>{tokens.length} tokens</div>;
};
```

**Pattern 2: Multiple Values**

```typescript
const Component = () => {
  // Re-renders when ANY of these change
  const { tokens, drawings, addToken } = useGameStore();

  return <div>...</div>;
};
```

**Pattern 3: Event Handlers (No subscription)**

```typescript
const Component = () => {
  const handleClick = () => {
    // Doesn't subscribe, doesn't cause re-render
    const { addToken } = useGameStore.getState();
    addToken(newToken);
  };

  return <button onClick={handleClick}>Add</button>;
};
```

**Pattern 4: Computed Selectors**

```typescript
const Component = () => {
  // Only re-renders when token count changes (not when tokens mutate)
  const tokenCount = useGameStore((state) => state.tokens.length);

  return <div>{tokenCount}</div>;
};
```

**Pattern 5: Subscriptions (Side effects)**

```typescript
useEffect(() => {
  // Subscribe to ALL state changes
  const unsub = useGameStore.subscribe((state) => {
    console.log('State changed:', state);
    // IPC sync, logging, etc.
  });

  return unsub; // Cleanup
}, []);
```

### Store Mutation Rules

❌ **NEVER mutate state directly:**

```typescript
const { tokens } = useGameStore.getState();
tokens.push(newToken); // WRONG - mutates array
```

✅ **ALWAYS create new references:**

```typescript
const { addToken } = useGameStore.getState();
addToken(newToken); // CORRECT - uses action
```

✅ **Or use setState with new array:**

```typescript
useGameStore.setState((state) => ({
  tokens: [...state.tokens, newToken],
}));
```

---

## Event Handlers

### Naming Convention

**Always prefix with `handle`:**

```typescript
const handleClick = () => { ... };
const handleDrop = (e: React.DragEvent) => { ... };
const handleMouseMove = (e: React.MouseEvent) => { ... };
const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... };
```

### Event Type Annotations

**Always type event parameters:**

```typescript
// ✅ Correct
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();
};

// ❌ Wrong
const handleClick = (e) => {
  // No type
  e.preventDefault();
};
```

**Common event types:**

```typescript
React.MouseEvent<HTMLButtonElement>;
React.DragEvent<HTMLDivElement>;
React.ChangeEvent<HTMLInputElement>;
React.FormEvent<HTMLFormElement>;
React.KeyboardEvent<HTMLInputElement>;
```

**Konva events (use `any` temporarily):**

```typescript
// TODO: Import proper Konva types
const handleDragEnd = (e: any) => {
  const node = e.target;
  const pos = node.position();
};
```

### Inline vs Named Handlers

**Inline for simple logic:**

```typescript
<button onClick={() => setTool('marker')}>
  Marker
</button>

<div onDragOver={(e) => e.preventDefault()}>
  Drop zone
</div>
```

**Named for complex logic:**

```typescript
const handleDrop = async (e: React.DragEvent) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  const handle = processImage(file, 'TOKEN');
  const src = await handle.promise;
  addToken({ id: crypto.randomUUID(), x, y, src, scale: 1 });
};

<div onDrop={handleDrop}>Drop zone</div>
```

### Callback Dependencies

**Use `useCallback` for callbacks passed as props:**

```typescript
const Component = () => {
  // Without useCallback, handleClick recreates on every render
  // Child component will re-render unnecessarily
  const handleClick = useCallback(() => {
    console.log('Clicked');
  }, []); // No dependencies

  return <ChildComponent onClick={handleClick} />;
};
```

**Don't use `useCallback` for handlers not passed as props:**

```typescript
const Component = () => {
  // Not passed to child, no need for useCallback
  const handleClick = () => {
    console.log('Clicked');
  };

  return <button onClick={handleClick}>Click</button>;
};
```

---

## Styling (Tailwind CSS)

### Color Palette

**Always use the established palette:**

```
Background Layers:
- bg-neutral-900   (darkest, main background)
- bg-neutral-800   (panels, sidebars)
- bg-neutral-700   (hover states, elevated elements)

Text:
- text-white       (primary text)
- text-neutral-400 (secondary text, labels)
- text-neutral-500 (disabled text)

Borders:
- border-neutral-700  (default)
- border-neutral-600  (subtle)

Primary Actions:
- bg-blue-600      (buttons, highlights)
- hover:bg-blue-500
- bg-blue-700      (active state)

Interactive Elements:
- bg-neutral-600   (default state)
- hover:bg-neutral-500

Danger/Delete:
- bg-red-600
- hover:bg-red-500

Success:
- bg-green-600
- hover:bg-green-500
```

### Spacing

**Standard spacing scale:**

```
px-1 py-1    (4px)    - Very tight, icon buttons
px-2 py-1    (8x 4px) - Compact buttons
px-3 py-1    (12x4px) - Standard buttons
px-4 py-2    (16x8px) - Large buttons

p-2          (8px)    - Compact containers
p-4          (16px)   - Standard containers
p-6          (24px)   - Spacious containers

gap-2        (8px)    - Default gap between elements
gap-4        (16px)   - Gap between sections
gap-6        (24px)   - Large gaps
```

### Layout Patterns

**Full-screen container:**

```typescript
<div className="w-full h-screen bg-neutral-900 overflow-hidden">
```

**Flex row with gap:**

```typescript
<div className="flex gap-2 items-center">
```

**Flex column:**

```typescript
<div className="flex flex-col gap-4">
```

**Sidebar:**

```typescript
<div className="w-64 shrink-0 bg-neutral-800 border-r border-neutral-700 p-4">
```

**Fixed overlay (toolbar, modal):**

```typescript
<div className="fixed top-4 right-4 bg-neutral-800 p-2 rounded shadow z-50">
```

**Grid layout:**

```typescript
<div className="grid grid-cols-2 gap-2">
<div className="grid grid-cols-3 gap-4">
```

### Button Styles

**Standard button pattern:**

```typescript
<button
  className={`
    px-3 py-1 rounded text-sm font-medium transition
    ${isActive
      ? 'bg-blue-600 text-white'
      : 'bg-neutral-600 text-white hover:bg-neutral-500'
    }
  `}
  onClick={handleClick}
>
  Button Text
</button>
```

**Danger button:**

```typescript
<button className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm font-medium text-white">
  Delete
</button>
```

### Responsive Design

**Mobile-first approach:**

```typescript
<div className="
  w-full          // Mobile: full width
  md:w-1/2        // Tablet: half width
  lg:w-1/3        // Desktop: third width
">
```

**Hide/show based on screen size:**

```typescript
<div className="hidden md:block">  // Hidden on mobile, visible on tablet+
<div className="block md:hidden">  // Visible on mobile, hidden on tablet+
```

### Icons (Remix Icon)

**Always use Remix Icon components** from `@remixicon/react`:

```typescript
// ✅ Correct - Import from @remixicon/react
import { RiAddLine, RiCloseLine, RiSearchLine } from '@remixicon/react';

// Component usage
<button>
  <RiAddLine className="w-5 h-5" />
  Add Item
</button>
```

**Rules:**

1. **Use Line style variants** (`*Line`) for consistency (e.g., `RiAddLine`, not `RiAddFill`)
2. **Exception**: Use Fill variants (`*Fill`) only for play/pause or when fill is semantically needed
3. **Standard sizing**: `w-4 h-4` (small), `w-5 h-5` (default), `w-6 h-6` (large), `w-8 h-8` (extra large)
4. **Never use inline SVG** or emoji for UI icons
5. **Color inheritance**: Icons inherit color from parent via `currentColor`

**Common icon mappings:**

```typescript
// Navigation
RiArrowLeftSLine, RiArrowRightSLine, RiArrowUpSLine, RiArrowDownSLine

// Actions
RiAddLine, RiCloseLine, RiDeleteBinLine, RiEditLine, RiSaveLine, RiUploadLine

// UI Controls
RiSearchLine, RiSettings4Line, RiMenuLine, RiMoreLine

// Content
RiFileTextLine, RiFolderOpenLine, RiImageLine, RiMap2Line

// Status
RiCheckLine, RiErrorWarningLine, RiLockLine, RiLockUnlockLine

// Tools
RiCursorLine, RiPencilLine, RiEraserLine, RiRulerLine

// Media
RiPlayFill, RiPauseFill (use Fill for media controls)

// Other
RiBookLine, RiDoorOpenLine, RiGlobalLine, RiPushpinLine
```

**Styling icons:**

```typescript
// ✅ Good - Use Tailwind classes
<RiSearchLine className="w-5 h-5 text-neutral-400" />

// ✅ Good - Inherit color from parent
<button className="text-blue-600 hover:text-blue-500">
  <RiAddLine className="w-5 h-5" /> {/* Inherits blue */}
  Add
</button>

// ❌ Bad - Inline styles
<RiSearchLine style={{ width: 20, height: 20, color: '#999' }} />

// ❌ Bad - Using emoji or raw SVG
<button>➕ Add</button>
<button>
  <svg>...</svg>
</button>
```

**Finding icons:**

- Browse icons at: https://remixicon.com/
- Search for functionality (e.g., "search", "close", "edit")
- Always use the Line variant unless Fill is specifically needed
- Import only the icons you use to keep bundle size small

---

## Error Handling

### Pattern 1: User-Facing Errors (File I/O, IPC)

```typescript
try {
  const result = await window.ipcRenderer.invoke('SAVE_CAMPAIGN', data);
  if (!result) {
    // User cancelled dialog
    console.log('Save cancelled by user');
    return;
  }
  alert('Campaign saved successfully!');
} catch (error) {
  console.error('Save error:', error);
  const message = error instanceof Error ? error.message : 'Unknown error occurred';
  alert(`Failed to save campaign: ${message}`);
}
```

### Pattern 2: Developer Errors (Should not happen in production)

```typescript
const ctx = canvas.getContext('2d');
if (!ctx) {
  throw new Error('Failed to get 2D context from canvas');
}

// Continue with ctx (TypeScript knows it's defined)
```

### Pattern 3: Silent Failures (Non-critical UI)

```typescript
try {
  const img = await loadImage(src);
  return img;
} catch (err) {
  console.warn('Image load failed, using fallback:', err);
  return fallbackImage;
}
```

### Pattern 4: Type Validation

```typescript
/**
 * Type guard to validate loaded campaign data
 */
function isValidGameState(data: unknown): data is GameState {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const state = data as any;
  return (
    Array.isArray(state.tokens) &&
    Array.isArray(state.drawings) &&
    typeof state.gridSize === 'number'
  );
}

// Usage
const loadCampaign = async () => {
  const data = await window.ipcRenderer.invoke('LOAD_CAMPAIGN');

  if (!isValidGameState(data)) {
    throw new Error('Invalid campaign file format');
  }

  // TypeScript now knows data is GameState
  useGameStore.setState(data);
};
```

### Error Logging

**Always log errors with context:**

```typescript
// ✅ Good
console.error('[CanvasManager] Failed to process image:', error, {
  file: file.name,
  size: file.size,
});

// ❌ Bad
console.error(error); // No context
```

**Use prefixes for different areas:**

```
[MAIN] - Main process (Electron)
[ARCHITECT] - Main window (DM view)
[WORLD] - World window (player view)
[IPC] - IPC communication
[STORE] - State management
[CANVAS] - Canvas rendering
```

---

## Comments and Documentation

### JSDoc for Exported Functions

**Always document exported functions:**

```typescript
/**
 * Snaps coordinates to the nearest grid intersection
 *
 * @param x - Raw X coordinate in pixels
 * @param y - Raw Y coordinate in pixels
 * @param gridSize - Size of each grid cell in pixels (e.g., 50)
 * @returns Object with snapped x and y coordinates
 *
 * @example
 * const { x, y } = snapToGrid(127, 83, 50);
 * // Returns: { x: 150, y: 100 }
 */
export const snapToGrid = (x: number, y: number, gridSize: number): { x: number; y: number } => {
  const snappedX = Math.round(x / gridSize) * gridSize;
  const snappedY = Math.round(y / gridSize) * gridSize;
  return { x: snappedX, y: snappedY };
};
```

### Inline Comments

**Explain WHY, not WHAT:**

```typescript
// ❌ Bad - states the obvious
// Loop through tokens
tokens.forEach(token => { ... });

// ✅ Good - explains rationale
// Tokens must be sorted by Y position to render correctly
// (back-to-front layering for isometric feel)
const sortedTokens = tokens.sort((a, b) => a.y - b.y);
```

**Document non-obvious patterns:**

```typescript
// Use ref instead of state to avoid re-renders during drag
// State update would trigger IPC sync 60 times/second
const isDrawing = useRef(false);
```

**Explain business logic:**

```typescript
// DMs can always see through fog, but players cannot
// This is controlled by the isWorldView flag
const showFog = isWorldView && fogEnabled;
```

### TODOs and FIXMEs

**Format:**

```typescript
// TODO: Add undo/redo support for drawings
// FIXME: Memory leak when loading large campaigns (tokens not cleaned up)
// HACK: Temporary workaround for Konva drag bug, remove when fixed upstream
// NOTE: This must run before window creation due to Electron protocol registration timing
```

### Component Documentation

**Document complex components:**

```typescript
/**
 * CanvasManager
 *
 * Main canvas component that handles:
 * - Rendering tokens, drawings, and grid overlay
 * - Drag-and-drop for uploading new assets
 * - Drawing tools (marker, eraser) with real-time preview
 * - Grid snapping for token placement
 *
 * This component is used in both Main Window (interactive) and
 * World Window (display-only). It detects window type via URL params.
 *
 * @example
 * <CanvasManager tool="marker" />
 */
const CanvasManager = ({ tool }: CanvasManagerProps) => {
  // ...
};
```

---

## Git Workflow

### Branch Naming

**Format:** `feature/description` or `fix/description`

```
feature/fog-of-war
feature/token-library
fix/sync-lag
fix/image-cropper-zoom
refactor/canvas-performance
docs/api-documentation
```

### Commit Messages

**Format:** Conventional Commits

```
type(scope): brief description

Optional longer description explaining why this change was made,
any breaking changes, or migration notes.

Fixes #123
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring (no functionality change)
- `docs`: Documentation changes
- `style`: Formatting, missing semicolons (no code change)
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, tooling

**Examples:**

```
feat(canvas): add fog of war layer

Implements fog of war system with reveal tool.
Players in World View see fog, DMs can toggle visibility.

Fixes #45

---

fix(sync): prevent IPC spam during token drag

Moved to mouseUp commit pattern instead of live sync.
Reduces IPC messages from ~60/sec to 1/action.

Fixes #67

---

refactor(grid): extract grid logic to utils

Moved grid snapping math to utils/grid.ts for reusability.
No functional changes.

---

docs(architecture): add IPC communication flow diagram
```

### Pull Request Standards

**Title:** Same format as commit messages

```
feat(sidebar): add token search and filtering
```

**Description template:**

```markdown
## What does this PR do?

Brief summary of changes

## Why is this needed?

Problem being solved or feature being added

## How to test?

1. Step by step testing instructions
2. Expected behavior
3. Edge cases to check

## Screenshots (if UI changes)

[Attach images]

## Checklist

- [ ] Code follows conventions
- [ ] JSDoc added for new functions
- [ ] No console.logs left in code
- [ ] Tested in both Main and World windows
- [ ] Save/load still works
```

---

## Testing

### Manual Testing Checklist

**Before every commit:**

- [ ] No TypeScript errors (`npm run lint`)
- [ ] App launches without errors (`npm run dev`)
- [ ] Main Window renders correctly
- [ ] World Window opens and syncs state
- [ ] Save campaign works
- [ ] Load campaign works
- [ ] No console errors in DevTools

**For UI changes:**

- [ ] Tested in both Main and World windows
- [ ] Responsive design works (resize window)
- [ ] Hover states function correctly
- [ ] Keyboard shortcuts work (if applicable)

**For state changes:**

- [ ] State syncs to World Window
- [ ] Save/load preserves new state fields
- [ ] No performance degradation (check FPS during drag)

### Unit Testing (Future)

**When unit tests are added, follow these patterns:**

```typescript
// utils/grid.test.ts
import { snapToGrid } from './grid';

describe('snapToGrid', () => {
  it('should snap to nearest grid intersection', () => {
    expect(snapToGrid(127, 83, 50)).toEqual({ x: 150, y: 100 });
  });

  it('should handle exact grid positions', () => {
    expect(snapToGrid(100, 50, 50)).toEqual({ x: 100, y: 50 });
  });

  it('should round down when closer to lower intersection', () => {
    expect(snapToGrid(124, 74, 50)).toEqual({ x: 100, y: 50 });
  });
});
```

---

## Code Review Guidelines

### For Reviewers

**Check for:**

- [ ] Follows file naming conventions
- [ ] Component structure matches template
- [ ] Imports organized correctly
- [ ] JSDoc present for exported functions
- [ ] No `any` types without justification
- [ ] Error handling appropriate for error type
- [ ] Tailwind color palette used consistently
- [ ] No direct state mutation
- [ ] Commit messages follow convention

**Ask questions:**

- Does this need to sync to World Window?
- Should this be saved in campaign files?
- Will this work with fog of war (planned feature)?
- Are there edge cases not handled?

### For Authors

**Before requesting review:**

- [ ] Self-review code for obvious issues
- [ ] Test manually in both windows
- [ ] Check for console.log statements (remove or justify)
- [ ] Verify no TypeScript errors
- [ ] Update documentation if needed (.cursorrules, ARCHITECTURE.md)

---

## Summary

Following these conventions ensures:

- **Consistency** across the codebase
- **Maintainability** for future changes
- **AI-friendly** code that assistants can understand and extend
- **Collaboration** without style conflicts

When in doubt, refer to existing code for examples, or ask in PR comments.
