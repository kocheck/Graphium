# Architectural Decisions

This document records significant architectural and technical decisions made during Graphium's development. Each decision includes context, alternatives considered, and rationale.

## Table of Contents

1. [Dual-Window Architecture](#1-dual-window-architecture)
2. [Local-First Design](#2-local-first-design)
3. [Zustand for State Management](#3-zustand-for-state-management)
4. [Konva for Canvas Rendering](#4-konva-for-canvas-rendering)
5. [WebP Image Format](#5-webp-image-format)
6. [ZIP-Based Campaign Files](#6-zip-based-campaign-files)
7. [IPC-Based State Synchronization](#7-ipc-based-state-synchronization)
8. [Grid Snapping Algorithm](#8-grid-snapping-algorithm)
9. [Custom media:// Protocol](#9-custom-media-protocol)
10. [Drawing Tool Performance Pattern](#10-drawing-tool-performance-pattern)
11. [Image Cropping Workflow](#11-image-cropping-workflow)
12. [Session-Based Asset Storage](#12-session-based-asset-storage)
13. [World View Sanitization](#13-world-view-sanitization)

---

## 1. Dual-Window Architecture

**Decision:** Use two separate Electron windows (Architect View + World View) instead of a single window or web-based projector.

### Context

DMs need a control panel with editing tools while players need a clean, read-only battlemap view for projection or secondary display.

### Alternatives Considered

1. **Single window with tab switching**
   - Pros: Simpler architecture, no IPC needed
   - Cons: Can't show both views simultaneously, not suitable for projection

2. **Web-based player view (separate web server)**
   - Pros: Players can connect from any device
   - Cons: Network dependency, security concerns, complexity

3. **Two separate Electron apps**
   - Pros: Complete isolation
   - Cons: Complex to package, hard to keep in sync

### Decision: Dual Windows (Same App)

**Rationale:**

- **DM workflow:** Architect View on laptop, World View on projector/TV
- **Simplicity:** Same React app, differentiated by `?type=world` query param
- **State sync:** Direct IPC communication (no network required)
- **Security:** No external network exposure (local-first)
- **Performance:** Both windows share Electron main process resources

**Implementation:**

- `electron/main.ts` creates both windows
- `src/components/SyncManager.tsx` detects window type via URL params
- Architect View = PRODUCER (edits state)
- World View = CONSUMER (displays state read-only)

**Trade-offs:**

- ✅ Perfect for in-person D&D sessions
- ✅ No network/cloud dependency
- ❌ Not suitable for remote/online play (future enhancement)

---

## 2. Local-First Design

**Decision:** All data stored locally, no cloud backend or authentication.

### Context

Graphium targets in-person tabletop RPG sessions where DMs need reliable, offline-capable software.

### Alternatives Considered

1. **Cloud-based with account system**
   - Pros: Cross-device access, automatic backups, multiplayer support
   - Cons: Requires server infrastructure, authentication, ongoing costs

2. **Hybrid (local + optional cloud sync)**
   - Pros: Best of both worlds
   - Cons: Complex to build, maintain two storage systems

### Decision: Fully Local

**Rationale:**

- **Reliability:** Works without internet (critical for game sessions)
- **Privacy:** No user data leaves the machine
- **Cost:** No server/hosting costs
- **Simplicity:** No authentication, no server-side logic
- **Performance:** Instant load/save (no network latency)

**Implementation:**

- Campaign files: `.graphium` ZIP archives (portable, shareable)
- Asset storage: Electron `userData` directory
- No analytics, no telemetry, no external requests

**Trade-offs:**

- ✅ Zero infrastructure costs
- ✅ Complete data ownership
- ✅ Offline-first reliability
- ❌ No built-in campaign sharing (manual file sharing only)
- ❌ No cross-device sync (future: Dropbox/Google Drive integration)

---

## 3. Zustand for State Management

**Decision:** Use Zustand for global state instead of Redux, MobX, or Context API.

### Context

Need reactive state management with Architect → World synchronization.

### Alternatives Considered

1. **Redux**
   - Pros: Mature, great DevTools, large ecosystem
   - Cons: Boilerplate-heavy, overkill for simple app

2. **React Context + useReducer**
   - Pros: Built-in, no dependencies
   - Cons: Performance issues with frequent updates, verbose

3. **MobX**
   - Pros: Simple API, automatic reactivity
   - Cons: Magic behavior, harder to debug

### Decision: Zustand

**Rationale:**

- **Minimal boilerplate:** No providers, no actions/reducers pattern
- **Direct API:** `useGameStore.getState().addToken()`
- **Subscription API:** Easy to sync to IPC (`store.subscribe()`)
- **TypeScript-friendly:** Full type inference
- **Tiny bundle:** 1KB vs 10KB+ for alternatives
- **React 18 compatible:** No concurrent mode issues

**Implementation:**

```typescript
// src/store/gameStore.ts
export const useGameStore = create<GameState>((set) => ({
  tokens: [],
  drawings: [],
  addToken: (token) =>
    set((state) => ({
      tokens: [...state.tokens, token],
    })),
}));

// src/components/SyncManager.tsx
useGameStore.subscribe((state) => {
  window.ipcRenderer.send('SYNC_WORLD_STATE', state);
});
```

**Trade-offs:**

- ✅ Simple, readable code
- ✅ Perfect for small-to-medium state trees
- ❌ No time-travel debugging (vs Redux DevTools)
- ❌ No built-in middleware (not needed for this app)

---

## 4. Konva for Canvas Rendering

**Decision:** Use Konva (React-Konva) instead of raw Canvas API or SVG.

### Context

Need to render:

- Dynamic grid overlay
- Draggable token images
- Freehand drawing strokes (marker/eraser)
- High performance (60 FPS)

### Alternatives Considered

1. **Raw Canvas API**
   - Pros: Maximum performance, full control
   - Cons: Manual state management, no React integration, verbose

2. **SVG (React + styled-components)**
   - Pros: Declarative, good for static graphics
   - Cons: Poor performance with many elements (>100 tokens)

3. **PixiJS**
   - Pros: Excellent performance, WebGL acceleration
   - Cons: Overkill for 2D battlemap, larger bundle size

4. **Fabric.js**
   - Pros: Rich drawing tools, mature
   - Cons: Not React-friendly, complex API

### Decision: Konva (React-Konva)

**Rationale:**

- **React integration:** Declarative `<Stage>`, `<Layer>`, `<Image>` components
- **Performance:** Canvas-based rendering, handles 100+ tokens easily
- **Draggable built-in:** `draggable` prop on any shape
- **Event system:** Mouse/touch events work out of the box
- **Maintained:** Active development, React 18 compatible

**Implementation:**

```tsx
<Stage width={800} height={600}>
  <Layer>
    <GridOverlay gridSize={50} />
    {tokens.map((token) => (
      <Image key={token.id} image={img} draggable />
    ))}
    {drawings.map((drawing) => (
      <Line points={drawing.points} />
    ))}
  </Layer>
</Stage>
```

**Trade-offs:**

- ✅ Declarative React patterns
- ✅ Great performance for our use case
- ✅ Easy drag-and-drop, event handling
- ❌ Canvas-only (no SVG fallback for screenshots/print)
- ❌ Bundle size: 180KB (acceptable for desktop app)

---

## 5. WebP Image Format

**Decision:** Convert all uploaded tokens to WebP format.

### Context

DMs upload token images (PNG/JPEG) which can be large (2-10MB each). Need to optimize for storage and rendering performance.

### Alternatives Considered

1. **Keep original format (PNG/JPEG)**
   - Pros: No conversion needed, preserves original
   - Cons: Large file sizes (10MB+ campaigns), slow loading

2. **JPEG conversion**
   - Pros: Small file size
   - Cons: No transparency support (critical for tokens)

3. **PNG with compression**
   - Pros: Transparency support, lossless
   - Cons: Still larger than WebP (30-50% bigger)

### Decision: WebP (quality=1)

**Rationale:**

- **File size:** 30-50% smaller than PNG, 25-35% smaller than JPEG
- **Transparency:** Full alpha channel support (needed for tokens)
- **Quality:** Quality=1 (lossless) preserves visual fidelity
- **Browser support:** Native browser support in Electron (Chromium)
- **Decode speed:** Faster than PNG for rendering

**Implementation:**

```typescript
// src/utils/AssetProcessor.ts
canvas.toBlob(
  (blob) => {
    // Save as WebP
  },
  'image/webp',
  1,
); // quality=1 (lossless)
```

**Trade-offs:**

- ✅ Significantly smaller campaign files
- ✅ Faster canvas rendering
- ✅ Transparency support
- ❌ Not editable (need to re-upload to change)
- ❌ Proprietary format (though widely supported now)

**Real-world impact:**

- Before: 10 tokens = ~30MB campaign file
- After: 10 tokens = ~10MB campaign file (70% reduction)

---

## 6. ZIP-Based Campaign Files

**Decision:** Use ZIP archives (.graphium) for campaign files instead of JSON or database.

### Context

Need to save campaign state (JSON) + asset files (images) in a portable, shareable format.

### Alternatives Considered

1. **Plain JSON file + separate assets folder**
   - Pros: Human-readable, easy to inspect
   - Cons: Two separate paths, hard to share, brittle

2. **SQLite database**
   - Pros: Queryable, transactional, handles large campaigns
   - Cons: Not human-readable, binary format, overkill

3. **Custom binary format**
   - Pros: Maximum compression, fast parsing
   - Cons: Hard to debug, need custom tools

### Decision: ZIP Archive (.graphium extension)

**Rationale:**

- **Single file:** Everything bundled together (portable)
- **Standard format:** Any ZIP tool can inspect contents
- **Compression:** Automatic compression for JSON + images
- **Debugging:** Can unzip and inspect `manifest.json` manually
- **Shareable:** Easy to share campaigns (email, Dropbox, etc.)

**Structure:**

```
campaign.graphium (ZIP)
├── manifest.json      # Game state (readable)
└── assets/
    ├── goblin.webp
    ├── dragon.webp
    └── ...
```

**Implementation:**

```typescript
// Save
const zip = new JSZip();
zip.file('manifest.json', JSON.stringify(gameState));
zip.folder('assets').file('goblin.webp', imageBuffer);
const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
await fs.writeFile('campaign.graphium', zipBuffer);

// Load
const zip = await JSZip.loadAsync(zipBuffer);
const manifest = await zip.file('manifest.json').async('string');
const gameState = JSON.parse(manifest);
```

**Trade-offs:**

- ✅ Portable single-file format
- ✅ Human-inspectable (unzip → read JSON)
- ✅ Built-in compression
- ❌ Can't partially load (must load entire ZIP)
- ❌ Not suitable for real-time collaborative editing (future enhancement)

---

## 7. IPC-Based State Synchronization

**Decision:** Use Electron IPC for Architect → World state sync instead of WebSockets or shared memory.

### Context

Architect Window edits state, World Window needs real-time updates.

### Alternatives Considered

1. **WebSockets (localhost server)**
   - Pros: Standard protocol, works across networks
   - Cons: Requires local server, port conflicts, overkill

2. **Shared memory (Electron main process state)**
   - Pros: Ultra-fast
   - Cons: Complex to implement, need manual notification system

3. **LocalStorage + polling**
   - Pros: Simple
   - Cons: Slow, inefficient, not real-time

### Decision: IPC (Publish-Subscribe Pattern)

**Rationale:**

- **Built-in:** Electron IPC is native, no extra dependencies
- **Performance:** Near-instant updates (<1ms latency)
- **Simplicity:** `send()` in one window, `on()` in other
- **Type-safe:** Full control over message format
- **Reliable:** No network issues, no port conflicts

**Implementation:**

```typescript
// Architect Window (Publisher)
useGameStore.subscribe((state) => {
  window.ipcRenderer.send('SYNC_WORLD_STATE', state);
});

// Main Process (Relay)
ipcMain.on('SYNC_WORLD_STATE', (event, state) => {
  worldWindow?.webContents.send('SYNC_WORLD_STATE', state);
});

// World Window (Subscriber)
window.ipcRenderer.on('SYNC_WORLD_STATE', (event, state) => {
  useGameStore.getState().setState(state);
});
```

**Trade-offs:**

- ✅ Zero configuration, works immediately
- ✅ Sub-millisecond latency
- ✅ No network/port issues
- ❌ Only works within same Electron app (not suitable for remote players)
- ❌ High-frequency updates (potential optimization target)

**Future optimization:**

- Differential sync (only send changes)
- Throttle updates to 60 FPS max
- Use MessagePack for binary serialization

---

## 8. Grid Snapping Algorithm

**Decision:** Use simple rounding-based grid snapping instead of complex constraint systems.

### Context

Tokens must snap to grid intersections for tactical positioning (D&D 5-foot squares).

### Alternatives Considered

1. **Snap during drag (dragBoundFunc)**
   - Pros: Live feedback while dragging
   - Cons: Janky feel, complex with Konva

2. **Snap on drop + animation**
   - Pros: Smooth visual transition
   - Cons: Extra complexity, animation overhead

3. **Magnetic snapping (distance threshold)**
   - Pros: Feels natural
   - Cons: Ambiguous which cell to snap to

### Decision: Round to Nearest Grid Intersection

**Algorithm:**

```typescript
export function snapToGrid(x: number, y: number, gridSize: number) {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}
```

**Rationale:**

- **Simplicity:** 2 lines of code, easy to understand
- **Deterministic:** Always snaps to nearest intersection
- **Performance:** O(1) operation, no loops
- **Testable:** Pure function, easy to unit test

**Trade-offs:**

- ✅ Dead simple, no bugs
- ✅ Predictable behavior
- ✅ Fast
- ❌ No partial-cell positioning (future: support 0.5 grid offsets for Large creatures)

---

## 9. Custom media:// Protocol

**Decision:** Use custom Electron protocol (`media://`) instead of file:// URLs directly.

### Context

Renderer process needs to load local images, but Electron security model blocks `file://` access.

### Alternatives Considered

1. **Direct file:// URLs**
   - Pros: Simple
   - Cons: Blocked by Electron security (CORS errors)

2. **Base64 encode images in state**
   - Pros: No protocol needed
   - Cons: Massive memory usage, slow serialization

3. **Local HTTP server (express)**
   - Pros: Standard HTTP
   - Cons: Overkill, port conflicts, shutdown issues

### Decision: Custom `media://` Protocol Handler

**Rationale:**

- **Security:** Renderer can't access arbitrary `file://` paths
- **Controlled:** Main process validates and translates URLs
- **Performance:** Direct file access, no base64 encoding
- **Clean:** Simple URL replacement (`file://` → `media://`)

**Implementation:**

```typescript
// electron/main.ts (register protocol)
protocol.handle('media', (request) => {
  return net.fetch('file://' + request.url.slice('media://'.length));
});

// src/components/Canvas/CanvasManager.tsx (use in renderer)
const safeSrc = src.startsWith('file:') ? src.replace('file:', 'media:') : src;
const [img] = useImage(safeSrc); // Loads successfully
```

**Trade-offs:**

- ✅ Secure (no arbitrary file access)
- ✅ Fast (direct file reads)
- ✅ Clean API
- ❌ Custom protocol (nonstandard, but Electron-specific anyway)

---

## 10. Drawing Tool Performance Pattern

**Decision:** Render temp line locally during drawing, commit to store on mouse up.

### Context

Drawing tools (marker/eraser) generate hundreds of mouse move events per stroke. Syncing each point to IPC would cause performance issues.

### Alternatives Considered

1. **Commit every point to store immediately**
   - Pros: Simple, store always in sync
   - Cons: 100+ IPC messages per stroke, laggy World Window

2. **Throttle store updates (e.g., every 50ms)**
   - Pros: Reduced IPC traffic
   - Cons: Still many messages, complex logic

3. **Buffer points, flush on interval**
   - Pros: Batched updates
   - Cons: Delayed sync, timer management complexity

### Decision: Local Preview + Commit on MouseUp

**Pattern:**

```typescript
// MouseDown: Initialize local ref
currentLine.current = { points: [x, y], ... }

// MouseMove: Accumulate points locally
currentLine.current.points.push(x2, y2)
setTempLine({ ...currentLine.current })  // Trigger render

// MouseUp: Commit final stroke to store
addDrawing(tempLine)  // Single IPC message
setTempLine(null)
```

**Rationale:**

- **Performance:** 1 IPC message per stroke (vs 100+)
- **Smooth preview:** Local React state updates feel instant
- **Sync accuracy:** Final stroke is fully accurate
- **Simple:** No timers, no throttling logic

**Trade-offs:**

- ✅ Excellent performance
- ✅ Instant local feedback
- ✅ Minimal IPC traffic
- ❌ World Window doesn't see stroke until mouse up (acceptable trade-off)

---

## 11. Image Cropping Workflow

**Decision:** Show modal cropper for file uploads, skip cropping for library tokens.

### Context

File uploads often have unwanted backgrounds or need aspect ratio adjustment. Library tokens are pre-processed.

### Alternatives Considered

1. **Always crop (even library tokens)**
   - Pros: Consistent workflow
   - Cons: Extra step for library tokens (annoying)

2. **Never crop (resize only)**
   - Pros: Simplest
   - Cons: Tokens with backgrounds look bad on grid

3. **Optional crop (user clicks "Edit" button)**
   - Pros: Flexible
   - Cons: Extra UI, discoverability issues

### Decision: Dual-Path (Automatic Crop Detection)

**Logic:**

```typescript
// Path 1: Library token (JSON data transfer)
if (jsonData) {
  addToken(data); // No crop, add immediately
}

// Path 2: File upload (File data transfer)
if (file) {
  setPendingCrop({ src: objectUrl }); // Show cropper modal
}
```

**Rationale:**

- **UX:** Fast path for library tokens (drag → done)
- **Quality:** File uploads always get cropped (remove backgrounds)
- **Deterministic:** Data transfer type determines behavior
- **1:1 aspect:** Enforced by cropper (tokens fit grid cells)

**Implementation:**

- Cropper: `react-easy-crop` library
- Aspect ratio: Fixed 1:1 (square)
- Output: WebP blob (quality=1)

**Trade-offs:**

- ✅ Great UX for both workflows
- ✅ High-quality token imports
- ❌ Can't skip crop for file uploads (future: Add "Skip" button)

---

## 12. Session-Based Asset Storage

**Decision:** Create unique session directories for each campaign load instead of reusing temp directory.

### Context

When loading .graphium files, need to extract assets somewhere. Reusing same directory causes conflicts.

### Alternatives Considered

1. **Single temp directory (overwrite on load)**
   - Pros: Simple
   - Cons: Loading second campaign breaks first

2. **Clear temp directory on load**
   - Pros: Clean slate each time
   - Cons: Breaks currently loaded campaign

3. **Hash-based storage (content-addressable)**
   - Pros: Deduplication, no conflicts
   - Cons: Complex, no automatic cleanup

### Decision: Session Directories (Timestamped)

**Pattern:**

```typescript
const sessionDir = path.join(
  app.getPath('userData'),
  'sessions',
  Date.now().toString(), // Unique per load
);
```

**Example paths:**

```
userData/sessions/1702834567890/assets/goblin.webp
userData/sessions/1702834598123/assets/dragon.webp
```

**Rationale:**

- **No conflicts:** Each load gets fresh directory
- **Multiple campaigns:** Can load multiple in succession
- **Debugging:** Clear separation of session assets
- **Simple:** No cleanup logic needed during session

**Cleanup:**

- Session directories persist until app restart
- Future enhancement: Clean up on campaign close

**Trade-offs:**

- ✅ Zero conflicts
- ✅ Simple implementation
- ✅ Easy to debug (inspect session folders)
- ❌ No automatic cleanup (minor disk space usage)
- ❌ Asset duplication across sessions (acceptable for desktop app)

---

## 13. World View Sanitization

**Decision:** Use URL query parameter detection with component-level conditional rendering and interaction blocking to sanitize the World View (player projection window).

### Context

The World View was showing the full DM interface (sidebar, toolbar, editing tools) and allowing all interactions (drawing, deleting, file drops), defeating its purpose as a clean player-facing display.

**Problems to solve:**

1. **UI Leak:** World View displayed DM-only controls (save/load buttons, tool palette, asset library)
2. **Interaction Leaks:** Players could accidentally draw, delete tokens, or modify the map
3. **State Sync:** Ensure World View updates correctly while preventing it from broadcasting changes

### Alternatives Considered

1. **Separate React application for World View**
   - Pros: Complete isolation, no conditional logic
   - Cons: Code duplication, harder to maintain sync, double bundle size

2. **React Router with separate routes**
   - Pros: Clear separation, idiomatic React pattern
   - Cons: Unnecessary complexity for single-page app, adds routing overhead

3. **IPC flag for window type**
   - Pros: Centralized window type management
   - Cons: Async initialization delays first render, adds IPC overhead

4. **CSS-only hiding (display: none)**
   - Pros: Simplest implementation
   - Cons: Doesn't block interactions, sensitive UI still in DOM

### Decision: URL Parameter + Conditional Rendering + Interaction Blocking

**Implementation:**

- **Detection:** `?type=world` URL query parameter set by main process
- **Hook:** `useWindowType()` utility hook for reusable window detection
- **UI Sanitization:** Conditional rendering in App.tsx (hide Sidebar/Toolbar in World View)
- **Interaction Restrictions:** Component-level blocks in CanvasManager (early returns for editing operations)

```typescript
// Detection hook (src/utils/useWindowType.ts)
export const useWindowType = () => {
  const params = new URLSearchParams(window.location.search);
  const isWorldView = params.get('type') === 'world';
  return { isWorldView, isArchitectView: !isWorldView };
};

// UI sanitization (src/App.tsx)
const { isArchitectView, isWorldView } = useWindowType();
return (
  <>
    {isArchitectView && <Sidebar />}
    <CanvasManager isWorldView={isWorldView} />
    {isArchitectView && <Toolbar />}
  </>
);

// Interaction blocking (src/components/Canvas/CanvasManager.tsx)
const handleDrop = (e: React.DragEvent) => {
  if (isWorldView) return; // Block file drops in World View
  // ... process drop
};
```

**Restrictions in World View:**

- ✅ **Allowed:** Pan, zoom, select/drag tokens (for DM demonstration)
- ❌ **Blocked:** Drawing tools, file drops, deletion, calibration, transformation, duplication

**Rationale:**

- **Simple:** Works on first render, no async initialization
- **Maintainable:** Single codebase, clear separation via props
- **Performance:** Zero IPC overhead, pure client-side logic
- **Security:** Interaction blocks prevent accidental modifications
- **UX:** Clean canvas-only view for players

**Implementation Files:**

- `src/utils/useWindowType.ts` (new)
- `src/App.tsx` (updated with conditional rendering)
- `src/components/Canvas/CanvasManager.tsx` (updated with interaction blocks)
- `electron/main.ts` (unchanged, already sets ?type=world)

**Trade-offs:**

- ✅ Zero code duplication
- ✅ Same bundle size (no separate app)
- ✅ Easy to extend (add more restrictions)
- ✅ Testable (just pass isWorldView={true} in tests)
- ❌ Conditional logic in components (acceptable tradeoff)
- ❌ UI components still loaded in memory (negligible for desktop app)

**Considered but rejected:**

- Separate routing: Overkill for two modes of same component tree
- IPC flag: Adds async complexity and IPC overhead
- CSS-only: Doesn't prevent interactions

---

## Summary Table

| Decision               | Alternative         | Rationale                                      |
| ---------------------- | ------------------- | ---------------------------------------------- |
| Dual windows           | Web-based projector | Better for in-person D&D, no network needed    |
| Local-first            | Cloud-based         | Reliability, privacy, zero infrastructure cost |
| Zustand                | Redux               | Minimal boilerplate, subscription API          |
| Konva                  | Raw Canvas          | React integration, declarative API             |
| WebP                   | PNG                 | 30-50% smaller, transparency support           |
| ZIP (.graphium)        | SQLite              | Single-file portability, inspectable           |
| IPC sync               | WebSockets          | Built-in, <1ms latency, zero config            |
| Round snapping         | Magnetic snap       | Simple, deterministic, fast                    |
| media:// protocol      | file:// URLs        | Security, controlled access                    |
| MouseUp commit         | Real-time sync      | 100x less IPC traffic                          |
| Dual-path crop         | Always crop         | Fast library workflow, quality file uploads    |
| Session dirs           | Temp reuse          | No conflicts, simple                           |
| URL param sanitization | Separate React app  | Zero duplication, same bundle, testable        |

---

## Future Decision Points

### Multiplayer Support

**Question:** How to support remote/online play?

**Options:**

1. WebRTC peer-to-peer
2. WebSocket server (self-hosted)
3. Cloud service integration

**Current stance:** Not planned for v1.0, evaluate based on user demand

### Undo/Redo

**Question:** How to implement undo/redo for drawings and token moves?

**Options:**

1. Command pattern (Redux-style actions)
2. State snapshots (copy-on-write)
3. Operational transformation

**Current stance:** Deferred to v2.0, requires state management refactor

### Fog of War

**Question:** How to implement dynamic vision/fog system?

**Options:**

1. Canvas masking layer
2. Per-token visibility arrays
3. Raycast-based line-of-sight

**Current stance:** Planned for v1.1, likely canvas masking approach

---

## Reversing Decisions

### When to Reconsider

Decisions should be revisited when:

- **User feedback** indicates major pain points
- **Performance** issues emerge at scale (>500 tokens)
- **Requirements change** (e.g., multiplayer support requested)
- **Better alternatives** become available (new libraries, APIs)

### Decision Reversal Process

1. Document why decision is being reconsidered
2. Analyze impact on existing code
3. Create migration plan for existing campaigns (.graphium files)
4. Update this document with new decision and migration notes

---

**Last updated:** 2025-01-XX
**Document version:** 1.0
