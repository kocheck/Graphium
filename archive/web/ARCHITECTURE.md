# Graphium Architecture - Quick Reference for AI Agents

> **AI Agent Onboarding**: This file provides a high-level map of the Graphium codebase. Read this first before making changes to understand the system architecture, data flow, and key patterns.

## 📋 Table of Contents

- [System Overview](#system-overview)
- [Technology Stack](#technology-stack)
- [Directory Structure](#directory-structure)
- [Data Flow & State Management](#data-flow--state-management)
- [Key Architectural Patterns](#key-architectural-patterns)
- [Critical Paths & Workflows](#critical-paths--workflows)
- [Testing Strategy](#testing-strategy)
- [Error Handling](#error-handling)
- [Further Reading](#further-reading)

---

## System Overview

**Graphium** is a dual-target (Electron + Web) React/TypeScript application serving as a digital battlemap for tabletop RPG Dungeon Masters.

### Core Concept: Dual-Window Architecture

```
┌─────────────────────┐         ┌─────────────────────┐
│  ARCHITECT VIEW     │         │    WORLD VIEW       │
│  (DM Control Panel) │ ──IPC─→ │  (Player Display)   │
│                     │         │                     │
│  • Full Controls    │         │  • Canvas Only      │
│  • Token Library    │         │  • No DM Tools      │
│  • Save/Load        │         │  • Read-only        │
│  • Fog of War       │         │  • For Projection   │
└─────────────────────┘         └─────────────────────┘
        ↓                                ↓
    Single Source                   Synced State
    of Truth (Zustand)             (via IPC/SyncManager)
```

### Platform Support

- **Electron Desktop App**: Full-featured with file system access
- **Web App**: Browser-based with IndexedDB storage (limited file ops)

---

## Technology Stack

### Core Framework & Build Tools

- **React 18.2** - UI framework
- **TypeScript 5.2** - Type safety (strict mode)
- **Vite 5.1** - Build tool & dev server
- **Electron 30** - Desktop wrapper (optional)

### State & Data

- **Zustand 5.0** - Global state management (single store)
- **IndexedDB** (idb) - Web storage
- **Electron IPC** - Inter-process communication
- **JSZip** - Campaign file (.graphium) compression

### Canvas & Rendering

- **Konva 10** / **React-Konva 18** - Canvas rendering engine
- **HTML5 Canvas** - Low-level drawing API

### Styling & UI

- **Tailwind CSS 4.1** - Utility-first styling
- **CSS Custom Properties** - Theming system

### Testing

- **Vitest 1.3** - Unit tests (22 test files)
- **Playwright 1.57** - E2E tests (13 spec files)
- **@testing-library/react** - Component testing utilities
- **axe-core** - Accessibility testing

---

## Directory Structure

```
/home/user/Graphium/
│
├── src/                          # React application source
│   ├── components/               # React UI components
│   │   ├── AssetLibrary/        # Token library & command palette
│   │   ├── Canvas/              # Canvas rendering (Konva-based)
│   │   ├── ErrorBoundaries      # Privacy-aware error handling
│   │   └── [Other components]   # UI components (Sidebar, Toast, etc.)
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useCommandPalette.ts # Keyboard shortcuts (Cmd+P)
│   │   ├── useMediaQuery.ts     # Responsive breakpoints
│   │   └── useTokenData.ts      # Token metadata resolution
│   │
│   ├── services/                # Service layer (platform abstraction)
│   │   ├── IStorageService.ts   # Storage interface
│   │   ├── ElectronStorageService.ts  # Electron IPC + fs
│   │   ├── WebStorageService.ts       # IndexedDB
│   │   └── storage.ts           # Runtime detection & initialization
│   │
│   ├── store/                   # State management (Zustand)
│   │   ├── gameStore.ts         # Main game state (26KB - core)
│   │   └── preferencesStore.ts  # User preferences
│   │
│   ├── types/                   # TypeScript type definitions
│   ├── utils/                   # Utility functions
│   │   ├── AssetProcessor.ts    # Image optimization
│   │   ├── DungeonGenerator.ts  # Procedural generation
│   │   ├── errorSanitizer.ts    # Privacy-safe error reporting
│   │   ├── fuzzySearch.ts       # Library search
│   │   ├── grid.ts              # Grid snapping logic
│   │   └── [Other utils]
│   │
│   ├── workers/                 # Web Workers
│   │   └── image-processor.worker.ts
│   │
│   ├── App.tsx                  # Root component (22KB)
│   ├── main.tsx                 # React entry point
│   └── index.css                # Tailwind imports
│
├── electron/                    # Electron main process
│   ├── main.ts                  # Main process logic (38KB)
│   ├── preload.ts               # IPC bridge (contextBridge)
│   └── themeManager.ts          # Theme persistence
│
├── tests/                       # E2E and integration tests
│   ├── functional/              # Functional E2E tests (8 files)
│   ├── electron/                # Electron-specific tests (2 files)
│   ├── performance/             # Performance tests (1 file)
│   ├── helpers/                 # Test utilities
│   └── accessibility.spec.ts    # WCAG AA compliance
│
├── docs/                        # Comprehensive documentation
│   ├── architecture/            # Architecture deep-dives
│   ├── components/              # Component documentation
│   ├── features/                # Feature implementation notes
│   ├── guides/                  # Developer guides
│   └── context/                 # Domain context
│
└── public/                      # Static assets
```

### Key Files to Know

| File                                      | Purpose                                                | Size   | Critical? |
| ----------------------------------------- | ------------------------------------------------------ | ------ | --------- |
| `src/store/gameStore.ts`                  | **Single source of truth** for all game state          | 26KB   | ⚠️ YES    |
| `src/components/Canvas/CanvasManager.tsx` | **Main canvas logic** - rendering, tools, interactions | 84KB   | ⚠️ YES    |
| `src/App.tsx`                             | Root component - window type detection, tool state     | 22KB   | ⚠️ YES    |
| `src/components/SyncManager.tsx`          | **IPC synchronization** between windows                | Medium | ⚠️ YES    |
| `electron/main.ts`                        | Electron main process - IPC, file I/O, windows         | 38KB   | ⚠️ YES    |
| `src/services/storage.ts`                 | **Platform abstraction** - Electron vs Web             | Small  | ⚠️ YES    |

---

## Data Flow & State Management

### State Management: Zustand (Single Store)

**Why Zustand over Redux?**

- Minimal boilerplate
- No context provider hell
- Excellent TypeScript support
- Built-in subscriptions (perfect for IPC sync)

**Store Location**: `/home/user/Graphium/src/store/gameStore.ts`

**Store Structure**:

```typescript
interface GameState {
  // ===== Data =====
  currentCampaignId: string | null;
  campaigns: Campaign[];
  currentMapId: string | null;
  tokens: Token[]; // Instances on current map
  drawings: Drawing[]; // Freehand strokes (marker/eraser/wall)
  doors: Door[]; // Interactive doors
  stairs: Stairs[]; // Staircase markers
  tokenLibrary: TokenLibraryItem[]; // Reusable token prototypes
  map: MapConfig | null; // Background map image

  // ===== Actions =====
  // Token management
  addToken(token: Token): void;
  updateToken(id: string, changes: Partial<Token>): void;
  removeToken(id: string): void;

  // Drawing management
  addDrawing(drawing: Drawing): void;
  removeDrawing(id: string): void;

  // Map management
  setMap(mapConfig: MapConfig): void;
  updateMapPosition(x: number, y: number): void;

  // Campaign management
  saveCampaign(): void;
  loadCampaign(campaign: Campaign): void;

  // ... 50+ actions total
}
```

### Data Flow Patterns

#### 1. Campaign Save/Load Flow

```
User clicks "Save"
    ↓
App.tsx handles click
    ↓
Calls storage.saveCampaign(gameStore.getState())
    ↓
Storage service detects platform
    ↓
ElectronStorageService (Desktop)        WebStorageService (Browser)
    ↓                                       ↓
IPC to main process                     IndexedDB write
    ↓                                       ↓
electron/main.ts                        Download .graphium file
    ↓
fs.writeFile() to .graphium ZIP
```

#### 2. IPC State Synchronization (Dual-Window Sync)

```
User drags token in Architect View
    ↓
CanvasManager updates local state
    ↓
gameStore.updateToken(id, {x, y})  ← Zustand action
    ↓
SyncManager.tsx (Architect View)
    - Subscribes to gameStore changes
    - Detects state change
    ↓
window.ipcRenderer.send('SYNC_WORLD_STATE', state)
    ↓
electron/main.ts routes IPC message
    ↓
World Window receives IPC message
    ↓
SyncManager.tsx (World View)
    - Listens to IPC
    - Calls gameStore.setState(newState)
    ↓
World View re-renders with updated token position
```

#### 3. Asset Processing Flow

```
User drags PNG onto canvas
    ↓
CanvasManager.handleDrop()
    ↓
AssetProcessor.processImage(file, 'MAP')
    ↓
Web Worker: image-processor.worker.ts
    - Resize if > 4096px (maps) or > 512px (tokens)
    - Convert to WebP
    - Compress
    ↓
storage.saveAsset(blob) → Returns file:// URL
    ↓
gameStore.setMap({src: fileUrl, ...})
    ↓
Canvas re-renders with new map
```

---

## Key Architectural Patterns

### 1. Platform Abstraction (Service Pattern)

**Problem**: App runs on both Electron (file system) and Web (IndexedDB)

**Solution**: Service interface + runtime detection

```typescript
// Interface (IStorageService.ts)
interface IStorageService {
  saveCampaign(campaign: Campaign): Promise<void>;
  loadCampaign(): Promise<Campaign>;
  saveAsset(blob: Blob): Promise<string>;
  getPlatform(): 'electron' | 'web';
}

// Implementations
class ElectronStorageService implements IStorageService {
  // Uses window.ipcRenderer.invoke() → main process → fs
}

class WebStorageService implements IStorageService {
  // Uses IndexedDB + File System Access API
}

// Runtime detection (storage.ts)
const storage = window.ipcRenderer ? new ElectronStorageService() : new WebStorageService();
```

**Location**: `/home/user/Graphium/src/services/`

### 2. Prototype/Instance Pattern (Token Library)

**Problem**: Users want reusable tokens without duplicating data

**Solution**: Library items as prototypes, map tokens as instances

```typescript
// Prototype (in tokenLibrary[])
interface TokenLibraryItem {
  id: string;
  name: string;
  src: string;
  defaultScale: number;
  defaultType: 'PC' | 'NPC';
  defaultVisionRadius: number;
  tags: string[];
}

// Instance (in tokens[])
interface Token {
  id: string;
  x: number; // Instance-specific
  y: number; // Instance-specific
  src: string; // Inherited from library
  libraryItemId?: string; // Reference to prototype
  scale?: number; // Override (falls back to defaultScale)
  type?: 'PC' | 'NPC'; // Override (falls back to defaultType)
  visionRadius?: number; // Override (falls back to defaultVisionRadius)
  name?: string; // Override (falls back to library name)
}
```

**Resolution Logic**: `src/hooks/useTokenData.ts`

### 3. Error Boundary Granularity

**Problem**: Single component crash shouldn't take down entire app

**Solution**: Layered error boundaries with privacy-aware sanitization

```
<PrivacyErrorBoundary>  ← Root-level (catches catastrophic errors)
  <App />
    <AssetProcessingErrorBoundary>  ← Image cropping
      <ImageCropper />
    </AssetProcessingErrorBoundary>

    <CanvasManager>
      <TokenErrorBoundary tokenId="abc">  ← Per-token
        <URLImage />
      </TokenErrorBoundary>

      <CanvasOverlayErrorBoundary overlayName="FogOfWar">  ← Per-overlay
        <FogOfWarLayer />
      </CanvasOverlayErrorBoundary>

      <MinimapErrorBoundary>  ← Minimap
        <Minimap />
      </MinimapErrorBoundary>
    </CanvasManager>

    <LibraryModalErrorBoundary>  ← Library modal
      <LibraryManager />
    </LibraryModalErrorBoundary>
</PrivacyErrorBoundary>
```

**Error Sanitization**: All errors are sanitized to remove PII (usernames, file paths) before reporting. See `src/utils/errorSanitizer.ts`.

### 4. Grid Snapping Logic

**Problem**: Different token sizes need different snap behavior

**Solution**: Size-aware snapping

```typescript
// Large tokens (2x2) snap to grid intersections
// Medium tokens (1x1) snap to cell centers

function snapToGrid(x: number, y: number, tokenScale: number, gridSize: number) {
  if (tokenScale >= 2) {
    // Large token: snap to intersection
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize,
    };
  } else {
    // Medium/small token: snap to cell center
    const halfGrid = gridSize / 2;
    return {
      x: Math.round((x - halfGrid) / gridSize) * gridSize + halfGrid,
      y: Math.round((y - halfGrid) / gridSize) * gridSize + halfGrid,
    };
  }
}
```

**Location**: `/home/user/Graphium/src/utils/grid.ts`

### 5. Fog of War Raycasting

**Algorithm**: Real-time line-of-sight calculation with wall occlusion

```
For each PC token:
  1. Get token position and visionRadius
  2. Cast rays in a circle (360 degrees, configurable step)
  3. For each ray:
     - Check intersection with wall drawings
     - If intersects: truncate ray at wall
     - If no intersection: extend to visionRadius
  4. Merge all PC vision polygons
  5. Render blurred overlay for unseen areas
```

**Location**: `/home/user/Graphium/src/components/Canvas/FogOfWarLayer.tsx`

---

## Critical Paths & Workflows

### Campaign Workflow

1. **New Campaign**: `HomeScreen` → Create campaign → Set name → Start Editor
2. **Load Campaign**: `HomeScreen` → Load .graphium → Extract assets → Populate store → Start Editor
3. **Save Campaign**: Toolbar → Save → Serialize store → Embed assets → Write .graphium ZIP
4. **Auto-Save**: `AutoSaveManager` polls store every 30s → IndexedDB write

### Token Workflow

1. **Add to Library**: Drag image → Crop → Set metadata → Add to `tokenLibrary[]`
2. **Place on Map**: Drag from library → `addLibraryTokenToMap()` → Creates instance with `libraryItemId`
3. **Edit Token**: Click token → `TokenInspector` → Edit properties → `updateToken()`
4. **Delete Token**: Select → Delete key → `removeToken()`

### Drawing Workflow

1. **Select Tool**: Toolbar → Click Marker/Eraser/Wall → `setTool()`
2. **Draw**: Mouse down → Capture points → Mouse up → `addDrawing()`
3. **Erase**: Eraser tool → Draw over existing → Remove intersecting drawings
4. **Walls**: Wall tool → Draw → Tagged as `tool: 'wall'` → Blocks vision

### Fog of War Workflow

1. **Enable**: Preferences → Turn on Fog of War
2. **Set Vision**: Select PC token → TokenInspector → Set visionRadius
3. **Reveal**: FogOfWarLayer calculates vision → Blurs unseen areas
4. **Wall Occlusion**: Walls block vision automatically

---

## Testing Strategy

### Unit Tests (Vitest)

**Location**: Co-located with source files (`*.test.ts`, `*.test.tsx`)

**Coverage**: 22 test files

- Utils: `grid.test.ts`, `measurement.test.ts`, `errorSanitizer.test.ts`, `fuzzySearch.test.ts` (⚠️ **MISSING**)
- Hooks: `useTokenData.test.ts`
- Components: `HomeScreen.test.tsx`, `Sidebar.test.tsx`, `Toast.test.tsx`
- Error Boundaries: `PrivacyErrorBoundary.test.tsx`, `CanvasOverlayErrorBoundary.test.tsx`

**Run**: `npm run test` or `npm run test:coverage`

### E2E Tests (Playwright)

**Location**: `/home/user/Graphium/tests/`

**Coverage**: 13 spec files

- **Functional**: `campaign-workflow.spec.ts`, `token-management.spec.ts`, `door-sync.spec.ts`, etc.
- **Electron**: `ipc.electron.spec.ts`, `startup.electron.spec.ts`
- **Performance**: `drawing-performance.spec.ts`
- **Accessibility**: `accessibility.spec.ts` (WCAG AA with axe-core)

**Run**:

- `npm run test:e2e` (all tests)
- `npm run test:e2e:web` (web only)
- `npm run test:e2e:electron` (Electron only)

### Testing Philosophy

- **Behavior over implementation**: Test user-facing behavior, not internal state
- **Functional over visual**: No screenshot tests (too brittle)
- **Privacy-aware**: All error tests verify PII sanitization
- **Platform coverage**: Both Electron and Web tested

**Further Reading**: `/home/user/Graphium/TESTING_STRATEGY.md`

---

## Error Handling

### 3-Layer Error Handling Architecture

#### Layer 1: React Error Boundaries

- **PrivacyErrorBoundary** (root level)
- **TokenErrorBoundary** (per-token granularity)
- **CanvasOverlayErrorBoundary** (per-overlay granularity)
- **MinimapErrorBoundary** (minimap component)
- **LibraryModalErrorBoundary** (library modal)
- **AssetProcessingErrorBoundary** (image cropping)
- **DungeonGeneratorErrorBoundary** (dungeon generator)

**Location**: `/home/user/Graphium/src/components/`

#### Layer 2: Global Error Handlers

- `window.onerror` - Catches uncaught JS errors
- `window.onunhandledrejection` - Catches unhandled promise rejections
- Both sanitize errors and expose to `window.errorReporting` API

**Location**: `/home/user/Graphium/src/utils/globalErrorHandler.ts`

#### Layer 3: Main Process Error Handling

- Electron main process error handlers
- IPC error handling
- File I/O error handling

**Location**: `/home/user/Graphium/electron/main.ts`

### Privacy Guarantees

All errors are sanitized before reporting:

- Usernames → `<USER>`
- File paths → Relative paths
- System info → Redacted

**Implementation**: `/home/user/Graphium/src/utils/errorSanitizer.ts`

**Further Reading**: `/home/user/Graphium/docs/features/error-boundaries.md`

---

## Further Reading

### Essential Docs (Read These First)

1. **[docs/context/CONTEXT.md](docs/context/CONTEXT.md)** - Domain knowledge, business rules, user workflows
2. **[docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)** - Deep-dive architecture with diagrams
3. **[docs/components/state-management.md](docs/components/state-management.md)** - Zustand store patterns
4. **[TESTING_STRATEGY.md](TESTING_STRATEGY.md)** - Testing philosophy and guidelines

### Component-Specific Docs

- **[docs/components/canvas.md](docs/components/canvas.md)** - CanvasManager deep-dive
- **[docs/components/electron.md](docs/components/electron.md)** - Electron/IPC patterns
- **[docs/features/error-boundaries.md](docs/features/error-boundaries.md)** - Error boundary strategy
- **[docs/features/theming.md](docs/features/theming.md)** - Theme system

### Developer Guides

- **[docs/guides/CONVENTIONS.md](docs/guides/CONVENTIONS.md)** - Code style, naming conventions
- **[docs/guides/TUTORIALS.md](docs/guides/TUTORIALS.md)** - How to add features
- **[docs/guides/TROUBLESHOOTING.md](docs/guides/TROUBLESHOOTING.md)** - Common issues

### Architecture Deep-Dives

- **[docs/architecture/IPC_API.md](docs/architecture/IPC_API.md)** - IPC message reference
- **[docs/architecture/PERFORMANCE_OPTIMIZATIONS.md](docs/architecture/PERFORMANCE_OPTIMIZATIONS.md)** - Performance patterns
- **[docs/architecture/DECISIONS.md](docs/architecture/DECISIONS.md)** - Architectural decision records (ADRs)

### Full Documentation Index

See **[docs/index.md](docs/index.md)** for complete documentation catalog.

---

## Quick Start for AI Agents

### When Making Changes:

1. **Read this file first** ✅ (You're here!)
2. **Check `docs/context/CONTEXT.md`** for domain knowledge
3. **Find the relevant component** in `src/components/`
4. **Check if tests exist** in co-located `.test.tsx` files
5. **Write tests first** (TDD approach preferred)
6. **Make changes** following patterns in this doc
7. **Run tests**: `npm run test` + `npm run test:e2e`
8. **Update docs** if you change architecture

### Common Pitfalls to Avoid:

❌ **Don't** bypass the storage service abstraction
✅ **Do** use `getStorage()` for all file operations

❌ **Don't** mutate Zustand state directly
✅ **Do** use store actions (`gameStore.updateToken()`)

❌ **Don't** forget to sync World View via IPC
✅ **Do** ensure `SyncManager.tsx` handles your state changes

❌ **Don't** expose PII in errors
✅ **Do** use error sanitization utilities

❌ **Don't** create global CSS
✅ **Do** use Tailwind utilities or scoped styles

❌ **Don't** assume Electron environment
✅ **Do** check `window.ipcRenderer` existence

### Need Help?

- **Architecture questions**: Read `docs/architecture/ARCHITECTURE.md`
- **Business logic questions**: Read `docs/context/CONTEXT.md`
- **Testing questions**: Read `TESTING_STRATEGY.md`
- **Component questions**: Read `docs/components/<component-name>.md`
- **Error handling**: Read `docs/features/error-boundaries.md`

---

**Last Updated**: 2025-12-30
**Maintainer**: AI Agents + Human Developers
**Status**: Living Document (Update as architecture evolves)
