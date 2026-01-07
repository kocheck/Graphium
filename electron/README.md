# Electron Main Process

This directory contains the Electron main process code, which handles the Node.js side of the application including window management, file I/O, and IPC (inter-process communication) routing.

## Purpose

The main process is responsible for:

- Creating and managing application windows (Architect View and World View)
- Handling file system operations (save/load campaigns, asset storage)
- Routing IPC messages between renderer processes
- Implementing custom protocol handlers (media:// for local file access)
- Managing application lifecycle (startup, quit, focus)

## Contents

### `main.ts` (183 lines)

**Main application entry point**

Key responsibilities:

- Window creation and management
- IPC channel handlers
- File I/O for campaign save/load
- Asset storage and retrieval
- Custom protocol registration

**Important functions:**

- `createMainWindow()` - Creates the Architect View (DM control panel)
- `createWorldWindow()` - Creates the World View (player projector window)
- IPC handlers:
  - `'SAVE_CAMPAIGN'` - Saves game state to .graphium ZIP file
  - `'LOAD_CAMPAIGN'` - Loads game state from .graphium ZIP file
  - `'SAVE_ASSET_TEMP'` - Saves uploaded asset to temp storage
  - `'SYNC_WORLD_STATE'` - Broadcasts state updates to World Window

**Critical patterns:**

```typescript
// Singleton World Window pattern
function createWorldWindow() {
  if (worldWindow && !worldWindow.isDestroyed()) {
    worldWindow.focus(); // Don't create duplicate
    return;
  }
  // Create new window...
}

// State broadcast pattern
ipcMain.on('SYNC_WORLD_STATE', (_event, state) => {
  if (worldWindow && !worldWindow.isDestroyed()) {
    worldWindow.webContents.send('SYNC_WORLD_STATE', state);
  }
});
```

**File paths used:**

- `app.getPath('userData')` - Base directory for app data
- `userData/temp_assets/` - Temporary uploaded assets
- `userData/sessions/{timestamp}/` - Extracted campaign assets

### `preload.ts` (24 lines)

**IPC bridge between main and renderer processes**

**Purpose:** Safely exposes IPC methods to renderer process via `contextBridge`

**Security context:**

- Renderer processes run in sandboxed environment (no direct Node.js access)
- Preload script has access to both Node.js and DOM APIs
- `contextBridge` creates secure API surface for renderer

**Exposed API:**

```typescript
window.ipcRenderer = {
  send: (channel, ...args) => void
  invoke: (channel, ...args) => Promise<any>
  on: (channel, listener) => IpcRenderer
  off: (channel, listener) => IpcRenderer
}
```

**Current security issue:**

- ALL channels are accessible (no whitelist)
- Renderer can invoke arbitrary channel names
- **Recommendation:** Implement channel whitelist (see ARCHITECTURE.md)

**Used by:**

- `src/App.tsx` - Save/Load buttons
- `src/components/CanvasManager.tsx` - Asset upload
- `src/components/SyncManager.tsx` - State sync
- `src/main.tsx` - Process messages

### `electron-env.d.ts` (8 lines)

**TypeScript type declarations for Electron**

Contains ambient type declarations for Node.js built-in modules when using ES modules in Electron.

**Why needed:**
Electron uses ES modules (`import` syntax) but needs Node.js types. This file provides the necessary type definitions.

## Dependencies

### External

- `electron` - Desktop app framework (main, renderer, IPC)
- `jszip` - ZIP file creation/parsing for .graphium campaign files
- `fs/promises` - Node.js file system (async API)
- `path` - Node.js path utilities
- `url` - Node.js URL utilities (fileURLToPath)

### Internal

None (main process is independent of renderer)

## Responsibilities

### Window Management

**Dual-window architecture:**

```
Main Process
├─ Main Window (Architect View)
│  └─ URL: index.html (no query params)
└─ World Window (Player View)
   └─ URL: index.html?type=world
```

**Window lifecycle:**

1. App starts → `createMainWindow()` called
2. User clicks "World View" → `createWorldWindow()` called
3. User closes windows → app quits (except macOS)
4. macOS dock click → recreate Main Window if all closed

**Window configuration:**

- Both windows use same preload script
- Both load same HTML file (renderer detects type via URL params)
- World Window is singleton (prevent duplicates)

### File System Operations

#### Campaign Save Algorithm

```
1. Show save dialog (.graphium extension)
2. Create JSZip instance
3. Deep clone game state (avoid mutation)
4. For each token:
   a. Read file from file:// URL
   b. Add to ZIP as assets/{basename}
   c. Rewrite token.src to assets/{basename}
5. Write manifest.json (JSON.stringify(state))
6. Generate ZIP buffer
7. Write to selected file path
8. Return success boolean
```

**File transformations:**

- In memory: `file:///Users/.../temp_assets/token.webp`
- In .graphium: `assets/token.webp`

#### Campaign Load Algorithm

```
1. Show open dialog (.graphium extension)
2. Read .graphium file as Buffer
3. Parse ZIP with JSZip.loadAsync()
4. Extract manifest.json → parse to GameState
5. Create session directory: sessions/{timestamp}/
6. For each token:
   a. Extract file from ZIP
   b. Write to session/assets/{basename}
   c. Rewrite token.src to file://{sessionPath}
7. Return modified GameState
```

**File transformations:**

- In .graphium: `assets/token.webp`
- After load: `file:///Users/.../sessions/{timestamp}/assets/token.webp`

#### Asset Upload

```
1. Renderer sends ArrayBuffer via 'SAVE_ASSET_TEMP'
2. Generate filename: {timestamp}-{name}.webp
3. Write to userData/temp_assets/
4. Return file:// URL
```

**Cleanup note:** Temp assets are never deleted (TODO: clear on quit)

### IPC Message Routing

**Channel types:**

| Channel               | Direction | Type   | Payload             | Response          |
| --------------------- | --------- | ------ | ------------------- | ----------------- |
| `create-world-window` | R→M       | send   | none                | none              |
| `SYNC_WORLD_STATE`    | R→M       | send   | GameState           | none              |
| `SYNC_WORLD_STATE`    | M→R       | send   | GameState           | none              |
| `SAVE_ASSET_TEMP`     | R→M       | invoke | ArrayBuffer, string | file:// URL       |
| `SAVE_CAMPAIGN`       | R→M       | invoke | GameState           | boolean           |
| `LOAD_CAMPAIGN`       | R→M       | invoke | none                | GameState \| null |

**Broadcast pattern:**

```
Main Window renderer
  ↓ send 'SYNC_WORLD_STATE'
Main Process
  ↓ send 'SYNC_WORLD_STATE'
World Window renderer
```

**Important:** World Window is passive (never sends state updates)

### Custom Protocol Handler

**Purpose:** Allow Konva to load local files without CORS errors

**Implementation:**

```typescript
protocol.handle('media', (request) => {
  // Convert media://path → file://path
  return net.fetch('file://' + request.url.slice('media://'.length'))
})
```

**Usage flow:**

1. GameStore stores: `file:///path/to/token.webp`
2. Renderer converts: `media:///path/to/token.webp`
3. Konva requests: `media://...`
4. Protocol handler fetches: `file://...`
5. Returns image data

**Why needed:** Browsers block `file://` requests due to security (CORS). Custom protocol bypasses this.

## Key Patterns

### Pattern 1: Window Detection

```typescript
// Renderer detects which window it's in
const params = new URLSearchParams(window.location.search);
const isWorldView = params.get('type') === 'world';

if (isWorldView) {
  // World View behavior (read-only)
} else {
  // Architect View behavior (interactive)
}
```

### Pattern 2: Safe IPC Invoke

```typescript
// Always handle errors and null returns
const state = await window.ipcRenderer.invoke('LOAD_CAMPAIGN');
if (!state) {
  // User cancelled dialog
  return;
}
// Use state...
```

### Pattern 3: File Path Safety

```typescript
// Always use Node.js path utilities
const tempDir = path.join(app.getPath('userData'), 'temp_assets');
await fs.mkdir(tempDir, { recursive: true });
const filePath = path.join(tempDir, fileName);
```

### Pattern 4: Window Existence Check

```typescript
// Always check window exists and not destroyed
if (worldWindow && !worldWindow.isDestroyed()) {
  worldWindow.webContents.send('SYNC_WORLD_STATE', state);
}
```

## Usage Examples

### Creating a New IPC Handler

```typescript
// 1. Register handler in main.ts (app.whenReady())
ipcMain.handle('DELETE_TOKEN', async (_event, tokenId: string) => {
  try {
    // Find and delete temp file
    const tempDir = path.join(app.getPath('userData'), 'temp_assets');
    // ... deletion logic
    return true;
  } catch (error) {
    console.error('[MAIN] Delete token failed:', error);
    return false;
  }
});

// 2. Call from renderer (components)
const handleDelete = async (tokenId: string) => {
  const success = await window.ipcRenderer.invoke('DELETE_TOKEN', tokenId);
  if (success) {
    // Update store
  }
};
```

### Broadcasting State Update

```typescript
// 1. Main Window sends update
window.ipcRenderer.send('SYNC_WORLD_STATE', {
  tokens: [...],
  drawings: [...],
  gridSize: 50
});

// 2. Main process receives and broadcasts
ipcMain.on('SYNC_WORLD_STATE', (_event, state) => {
  if (worldWindow && !worldWindow.isDestroyed()) {
    worldWindow.webContents.send('SYNC_WORLD_STATE', state);
  }
});

// 3. World Window receives and updates
window.ipcRenderer.on('SYNC_WORLD_STATE', (_event, state) => {
  useGameStore.setState(state);
});
```

## Common Issues

### Issue: World Window not receiving updates

**Symptoms:** Architect View updates but World View doesn't change

**Diagnosis:**

1. Check World Window is open (not closed)
2. Verify IPC send in Main Window (console.log)
3. Check main process broadcast (console.log in main.ts)
4. Verify World Window listener (console.log in SyncManager)

**Solution:**

```typescript
// Add logging to trace message flow
console.log('[ARCHITECT] Sending sync:', state);
console.log('[MAIN] Broadcasting to world:', state);
console.log('[WORLD] Received sync:', state);
```

### Issue: File paths break on load

**Symptoms:** Tokens don't render after loading campaign

**Diagnosis:**

1. Check token.src paths (should be file://)
2. Verify session directory exists
3. Confirm assets extracted from ZIP

**Solution:**

```typescript
// Verify paths after load
const state = await window.ipcRenderer.invoke('LOAD_CAMPAIGN');
console.log(
  'Loaded tokens:',
  state.tokens.map((t) => t.src),
);
// Should be: file:///Users/.../sessions/{timestamp}/assets/...
```

### Issue: Temp assets accumulate

**Symptoms:** userData/temp_assets/ grows indefinitely

**Current status:** Known issue (no cleanup implemented)

**Workaround:** Manually delete old temp files

**Proper solution:** Implement cleanup on app quit:

```typescript
app.on('will-quit', async () => {
  const tempDir = path.join(app.getPath('userData'), 'temp_assets');
  await fs.rm(tempDir, { recursive: true, force: true });
});
```

## Testing

### Manual Testing Checklist

**Window management:**

- [ ] App launches with Main Window
- [ ] World Window opens on button click
- [ ] World Window focuses if already open (no duplicate)
- [ ] Closing World Window doesn't quit app
- [ ] Closing Main Window quits app (Windows/Linux)

**File operations:**

- [ ] Save campaign creates .graphium file
- [ ] .graphium file is valid ZIP (can open with unzip tool)
- [ ] manifest.json is valid JSON
- [ ] Assets copied to ZIP correctly
- [ ] Load campaign extracts to sessions/ directory
- [ ] Loaded tokens reference correct file paths

**IPC communication:**

- [ ] State syncs from Main to World Window
- [ ] Asset upload returns file:// URL
- [ ] Save/load return expected values
- [ ] Error handling works (try with invalid files)

## Security Considerations

### Current Issues

1. **No channel whitelist in preload.ts**
   - Renderer can invoke ANY channel
   - Malicious code could call dangerous operations

2. **No input validation**
   - IPC handlers trust payload structure
   - Could crash on malformed data

3. **File path injection possible**
   - File paths not sanitized
   - Could write outside userData directory (though OS permissions help)

### Recommendations

1. **Whitelist IPC channels:**

```typescript
// preload.ts
const ALLOWED_CHANNELS = [
  'SAVE_CAMPAIGN',
  'LOAD_CAMPAIGN',
  'SAVE_ASSET_TEMP',
  'SYNC_WORLD_STATE',
  'create-world-window',
];

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => {
    if (!ALLOWED_CHANNELS.includes(channel)) {
      throw new Error(`Channel ${channel} not allowed`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },
  // ... other methods
});
```

2. **Validate payloads:**

```typescript
// main.ts
ipcMain.handle('SAVE_CAMPAIGN', async (_event, gameState) => {
  if (!isValidGameState(gameState)) {
    throw new Error('Invalid game state structure');
  }
  // ... save logic
});
```

3. **Sanitize file paths:**

```typescript
// Ensure paths stay within userData
const safePath = path.resolve(app.getPath('userData'), relativePath);
if (!safePath.startsWith(app.getPath('userData'))) {
  throw new Error('Path traversal detected');
}
```

## Future Enhancements

### Planned

1. **Cleanup temp assets on quit** - Delete userData/temp_assets/ on app close
2. **Session expiry** - Delete old sessions/ directories (> 30 days)
3. **Better error handling** - User-friendly error messages for file I/O failures
4. **Progress indicators** - Emit progress events during save/load for large campaigns

### Under Consideration

1. **Auto-save** - Periodic campaign save to recovery file
2. **Crash recovery** - Restore state from auto-save on unexpected quit
3. **Multiple World Windows** - Support multiple projectors (different views)
4. **Network sync** - Broadcast state over local network for remote players

## Related Documentation

- **[Electron Documentation](../docs/components/electron.md)** - Main process overview
- **[IPC API Reference](../docs/architecture/IPC_API.md)** - Complete IPC channel documentation
- **[Architecture Overview](../docs/architecture/ARCHITECTURE.md)** - Overall system architecture
- **[Domain Context](../docs/context/CONTEXT.md)** - Business rules and file format details
