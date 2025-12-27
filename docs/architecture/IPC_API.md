# IPC API Reference

This document provides a comprehensive reference for all Inter-Process Communication (IPC) channels in Hyle. IPC enables communication between the Electron main process and renderer processes (Architect Window and World Window).

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Communication Patterns](#communication-patterns)
3. [Channel Reference](#channel-reference)
4. [Type Definitions](#type-definitions)
5. [Error Handling](#error-handling)
6. [Best Practices](#best-practices)

---

## Architecture Overview

### Process Structure

```
Main Process (Node.js)
  ├── Architect Window (React renderer)
  │   └── PRODUCER: Sends state updates
  │
  └── World Window (React renderer)
      └── CONSUMER: Receives state updates
```

### IPC Flow Patterns

**Pattern 1: State Synchronization (Publish-Subscribe)**
```
Architect Window → Main Process → World Window
   (send)              (relay)         (receive)
```

**Pattern 2: Request-Response (Invoke-Handle)**
```
Renderer ←→ Main Process
 (invoke)    (handle + return)
```

**Pattern 3: One-Way Commands (Send-On)**
```
Renderer → Main Process
  (send)      (on + execute)
```

---

## Communication Patterns

### Pattern 1: Send (Fire-and-Forget)

**Use case:** Triggering actions without needing a response

**Renderer side:**
```typescript
window.ipcRenderer.send('channel-name', arg1, arg2)
```

**Main process side:**
```typescript
ipcMain.on('channel-name', (event, arg1, arg2) => {
  // Handle event
})
```

### Pattern 2: Invoke/Handle (Request-Response)

**Use case:** Performing operations that return data or results

**Renderer side:**
```typescript
const result = await window.ipcRenderer.invoke('channel-name', arg1, arg2)
```

**Main process side:**
```typescript
ipcMain.handle('channel-name', async (event, arg1, arg2) => {
  // Perform async operation
  return result
})
```

### Pattern 3: Broadcast (Main to Renderer)

**Use case:** Main process pushing updates to specific renderer

**Main process side:**
```typescript
if (targetWindow && !targetWindow.isDestroyed()) {
  targetWindow.webContents.send('channel-name', data)
}
```

**Renderer side:**
```typescript
window.ipcRenderer.on('channel-name', (event, data) => {
  // Handle received data
})
```

---

## Channel Reference

### 1. create-world-window

**Pattern:** Send (One-way command)
**Direction:** Architect Window → Main Process
**Purpose:** Creates the World View window for player display

#### Usage

**Caller:** `src/App.tsx:119`

**Renderer (Architect):**
```typescript
// User clicks "World View" button
window.ipcRenderer.send('create-world-window')
```

**Main Process:** `electron/main.ts:209`
```typescript
ipcMain.on('create-world-window', createWorldWindow)
```

#### Behavior

- **If no World Window exists:** Creates new BrowserWindow with `?type=world` query parameter
- **If World Window exists:** Focuses existing window (singleton pattern)
- **No response:** Fire-and-forget operation

#### Related Files

- Trigger: `src/App.tsx` (World View button)
- Handler: `electron/main.ts` (createWorldWindow function)
- Consumer: `src/components/SyncManager.tsx` (detects `?type=world` param)

---

### 2. SYNC_WORLD_STATE

**Pattern:** Send + Broadcast (Publish-Subscribe relay)
**Direction:** Architect Window → Main Process → World Window
**Purpose:** Synchronizes battlemap state changes to World View in real-time

#### Usage

**Caller:** `src/components/SyncManager.tsx:111`

**Renderer (Architect - Publisher):**
```typescript
// Triggered on every Zustand store update
window.ipcRenderer.send('SYNC_WORLD_STATE', {
  tokens: [...],
  drawings: [...],
  gridSize: 50
})
```

**Main Process (Relay):** `electron/main.ts:225`
```typescript
ipcMain.on('SYNC_WORLD_STATE', (_event, state) => {
  if (worldWindow && !worldWindow.isDestroyed()) {
    worldWindow.webContents.send('SYNC_WORLD_STATE', state)
  }
})
```

**Renderer (World Window - Subscriber):** `src/components/SyncManager.tsx:85`
```typescript
window.ipcRenderer.on('SYNC_WORLD_STATE', (event, state) => {
  useGameStore.getState().setState(state)
})
```

#### Payload

**Type:** `GameStateSyncPayload`

```typescript
{
  tokens: Token[]
  drawings: Drawing[]
  gridSize: number
}
```

#### Behavior

- **Frequency:** Fires on EVERY store mutation in Architect Window
- **Direction:** Unidirectional (Architect → World only)
- **World Window:** Read-only consumer, never sends state back
- **Performance:** High-frequency channel (potential optimization target)

#### Related Files

- Publisher: `src/components/SyncManager.tsx` (Architect View subscription)
- Relay: `electron/main.ts` (broadcast handler)
- Subscriber: `src/components/SyncManager.tsx` (World View listener)
- State schema: `src/store/gameStore.ts` (GameState interface)

---

### 3. SAVE_ASSET_TEMP

**Pattern:** Invoke/Handle (Request-Response)
**Direction:** Renderer → Main Process
**Purpose:** Saves processed image asset to temporary storage directory

#### Usage

**Caller:** `src/utils/AssetProcessor.ts:112`

**Renderer:**
```typescript
const arrayBuffer = await blob.arrayBuffer()
const filePath = await window.ipcRenderer.invoke(
  'SAVE_ASSET_TEMP',
  arrayBuffer,
  'goblin.webp'
)
// Returns: "file:///Users/.../Hyle/temp_assets/1234567890-goblin.webp"
```

**Main Process:** `electron/main.ts:259`
```typescript
ipcMain.handle('SAVE_ASSET_TEMP', async (_event, buffer: ArrayBuffer, name: string) => {
  const tempDir = path.join(app.getPath('userData'), 'temp_assets')
  await fs.mkdir(tempDir, { recursive: true })
  const fileName = `${Date.now()}-${name}`
  const filePath = path.join(tempDir, fileName)
  await fs.writeFile(filePath, Buffer.from(buffer))
  return `file://${filePath}`
})
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `buffer` | `ArrayBuffer` | WebP image data (already resized and optimized) |
| `name` | `string` | Original filename with .webp extension |

#### Returns

`string` - Absolute file:// URL pointing to saved asset

**Example:** `file:///Users/alice/Library/Application Support/Hyle/temp_assets/1702834567890-goblin.webp`

#### Storage Details

- **Location:** `app.getPath('userData')/temp_assets/`
- **Filename format:** `{timestamp}-{originalName}.webp`
- **Lifecycle:** Persists until app restart (temp directory)
- **Migration:** Copied into .hyle ZIP on campaign save

#### Error Cases

- **Directory creation fails:** Throws error if userData path is inaccessible
- **Write permission denied:** Throws error if filesystem is read-only
- **Disk full:** Throws error if insufficient storage space

#### Related Files

- Caller: `src/utils/AssetProcessor.ts` (processImage function)
- Handler: `electron/main.ts` (SAVE_ASSET_TEMP handler)
- Usage: `src/components/Canvas/CanvasManager.tsx` (URLImage protocol conversion)

---

### 4. SAVE_CAMPAIGN

**Pattern:** Invoke/Handle (Request-Response)
**Direction:** Renderer → Main Process
**Purpose:** Serializes campaign state to a .hyle ZIP file

#### Usage

**Caller:** `src/App.tsx:89`

**Renderer:**
```typescript
const gameState = {
  tokens: useGameStore.getState().tokens,
  drawings: useGameStore.getState().drawings,
  gridSize: useGameStore.getState().gridSize
}

const success = await window.ipcRenderer.invoke('SAVE_CAMPAIGN', gameState)
if (success) {
  alert('Campaign Saved Successfully!')
}
```

**Main Process:** `electron/main.ts:309`
```typescript
ipcMain.handle('SAVE_CAMPAIGN', async (_event, gameState: any) => {
  const { filePath } = await dialog.showSaveDialog({
    filters: [{ name: 'Hyle Campaign', extensions: ['hyle'] }]
  })
  if (!filePath) return false

  const zip = new JSZip()
  const assetsFolder = zip.folder("assets")
  const stateToSave = JSON.parse(JSON.stringify(gameState))

  // Copy token assets into ZIP and rewrite paths
  for (const token of stateToSave.tokens) {
    if (token.src.startsWith('file://')) {
      const absolutePath = fileURLToPath(token.src)
      const basename = path.basename(absolutePath)
      const content = await fs.readFile(absolutePath)
      assetsFolder?.file(basename, content)
      token.src = `assets/${basename}`
    }
  }

  zip.file("manifest.json", JSON.stringify(stateToSave))
  const content = await zip.generateAsync({ type: "nodebuffer" })
  await fs.writeFile(filePath, content)
  return true
})
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `gameState` | `GameStateSavePayload` | Campaign data (tokens, drawings, gridSize) |

**GameStateSavePayload:**
```typescript
{
  tokens: Array<{
    id: string
    x: number
    y: number
    src: string  // file:// URL
    scale: number
  }>
  drawings: Array<{
    id: string
    tool: 'marker' | 'eraser'
    points: number[]  // [x1, y1, x2, y2, ...]
    color: string
    size: number
  }>
  gridSize: number
}
```

#### Returns

`boolean` - `true` if saved successfully, `false` if user cancelled save dialog

#### .hyle File Structure

```
campaign.hyle (ZIP archive)
├── manifest.json          # Serialized game state
└── assets/
    ├── 1234567890-goblin.webp
    ├── 1234567891-dragon.webp
    └── ...
```

**manifest.json format:**
```json
{
  "tokens": [
    {
      "id": "uuid-123",
      "x": 100,
      "y": 150,
      "src": "assets/1234567890-goblin.webp",  // Rewritten to relative path
      "scale": 1
    }
  ],
  "drawings": [...],
  "gridSize": 50
}
```

#### Algorithm

1. Show native save dialog (user chooses file path)
2. Return `false` if user cancels
3. Create ZIP archive with JSZip
4. Deep clone gameState to avoid mutations
5. For each token with `file://` URL:
   - Read image file from disk
   - Add to ZIP as `assets/{basename}`
   - Rewrite `token.src` to relative path `assets/{basename}`
6. Add modified state as `manifest.json`
7. Generate ZIP as NodeBuffer
8. Write to disk
9. Return `true`

#### Path Rewriting

**Before save (machine-specific):**
```
token.src = "file:///Users/alice/Library/Application Support/Hyle/temp_assets/1234567890-goblin.webp"
```

**After save (portable):**
```
token.src = "assets/1234567890-goblin.webp"
```

This makes .hyle files portable across machines and operating systems.

#### Error Cases

- **User cancels dialog:** Returns `false` (not an error)
- **File read error:** Throws if asset file doesn't exist
- **Write permission denied:** Throws if save location is read-only
- **Disk full:** Throws if insufficient storage space

#### Related Files

- Trigger: `src/App.tsx` (Save button)
- Handler: `electron/main.ts` (SAVE_CAMPAIGN handler)
- State schema: `src/store/gameStore.ts` (GameState interface)

---

### 5. LOAD_CAMPAIGN

**Pattern:** Invoke/Handle (Request-Response)
**Direction:** Renderer → Main Process
**Purpose:** Deserializes a .hyle ZIP file and restores campaign state

#### Usage

**Caller:** `src/App.tsx:103`

**Renderer:**
```typescript
const state = await window.ipcRenderer.invoke('LOAD_CAMPAIGN')
if (state) {
  useGameStore.getState().setState(state)
  alert('Campaign Loaded!')
}
```

**Main Process:** `electron/main.ts:378`
```typescript
ipcMain.handle('LOAD_CAMPAIGN', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Hyle Campaign', extensions: ['hyle'] }]
  })
  if (filePaths.length === 0) return null

  const zipContent = await fs.readFile(filePaths[0])
  const zip = await JSZip.loadAsync(zipContent)

  const sessionDir = path.join(app.getPath('userData'), 'sessions', Date.now().toString())
  await fs.mkdir(sessionDir, { recursive: true })

  const manifestStr = await zip.file("manifest.json")?.async("string")
  if (!manifestStr) throw new Error("Invalid Hyle file")

  const state = JSON.parse(manifestStr)

  const assets = zip.folder("assets")
  if (assets) {
    const assetsDir = path.join(sessionDir, 'assets')
    await fs.mkdir(assetsDir, { recursive: true })

    for (const token of state.tokens) {
      if (token.src.startsWith('assets/')) {
        const fileName = path.basename(token.src)
        const fileData = await assets.file(fileName)?.async("nodebuffer")
        if (fileData) {
          const destPath = path.join(assetsDir, fileName)
          await fs.writeFile(destPath, fileData)
          token.src = `file://${destPath}`
        }
      }
    }
  }

  return state
})
```

#### Parameters

None - Uses native file picker dialog

#### Returns

`GameState | null` - Campaign state with file:// URLs, or `null` if user cancelled

**GameState:**
```typescript
{
  tokens: Token[]
  drawings: Drawing[]
  gridSize: number
}
```

#### Algorithm

1. Show native open dialog (user selects .hyle file)
2. Return `null` if user cancels
3. Read ZIP file from disk
4. Load ZIP with JSZip
5. Create unique session directory: `userData/sessions/{timestamp}/`
6. Extract and parse `manifest.json`
7. Throw error if manifest missing or invalid
8. For each token with `assets/` path:
   - Extract image from ZIP
   - Write to session directory
   - Rewrite `token.src` to absolute `file://` URL
9. Return modified state to renderer

#### Path Rewriting

**In .hyle file (relative):**
```
token.src = "assets/goblin.webp"
```

**After load (machine-specific):**
```
token.src = "file:///Users/alice/Library/Application Support/Hyle/sessions/1702834567890/assets/goblin.webp"
```

#### Session Directories

**Why unique session directories:**
- Avoid conflicts when loading multiple campaigns in succession
- No cleanup needed between loads
- Clean separation between temp uploads and loaded campaigns

**Location:** `app.getPath('userData')/sessions/{timestamp}/assets/`

**Example:** `/Users/alice/Library/Application Support/Hyle/sessions/1702834567890/assets/goblin.webp`

#### Error Cases

- **User cancels dialog:** Returns `null` (not an error)
- **Invalid .hyle file:** Throws if not a valid ZIP
- **Missing manifest.json:** Throws with "Invalid Hyle file" message
- **Corrupted ZIP:** Throws JSZip parsing error
- **Write permission denied:** Throws if can't create session directory

#### Related Files

- Trigger: `src/App.tsx` (Load button)
- Handler: `electron/main.ts` (LOAD_CAMPAIGN handler)
- State application: `src/store/gameStore.ts` (setState action)

---

## Type Definitions

### Token

```typescript
interface Token {
  id: string           // UUID generated with crypto.randomUUID()
  x: number            // Grid-snapped X position in pixels
  y: number            // Grid-snapped Y position in pixels
  src: string          // Image URL (file:// or https://)
  scale: number        // Size multiplier (1 = 1x1 cell, 2 = 2x2 cells)
}
```

### Drawing

```typescript
interface Drawing {
  id: string                    // UUID
  tool: 'marker' | 'eraser'     // Drawing tool used
  points: number[]              // Flat array [x1, y1, x2, y2, ...]
  color: string                 // Stroke color (hex)
  size: number                  // Stroke width in pixels
}
```

### GameState

```typescript
interface GameState {
  tokens: Token[]
  drawings: Drawing[]
  gridSize: number      // Grid cell size in pixels (typically 50)
}
```

### GameStateSyncPayload

Same as `GameState` - sent via SYNC_WORLD_STATE channel

```typescript
type GameStateSyncPayload = GameState
```

### GameStateSavePayload

Same as `GameState` - passed to SAVE_CAMPAIGN handler

```typescript
type GameStateSavePayload = GameState
```

---

## Error Handling

### General Pattern

**Renderer side:**
```typescript
try {
  const result = await window.ipcRenderer.invoke('CHANNEL_NAME', args)
  // Handle success
} catch (error) {
  console.error('IPC error:', error)
  alert('Operation failed: ' + error.message)
}
```

**Main process side:**
```typescript
ipcMain.handle('CHANNEL_NAME', async (event, args) => {
  try {
    // Perform operation
    return result
  } catch (error) {
    console.error('Handler error:', error)
    throw error  // Propagates to renderer
  }
})
```

### Error Types

#### File System Errors

```typescript
// ENOENT - File/directory not found
Error: ENOENT: no such file or directory

// EACCES - Permission denied
Error: EACCES: permission denied

// ENOSPC - No space left on device
Error: ENOSPC: no space left on device
```

#### ZIP Errors

```typescript
// Invalid ZIP format
Error: Can't find end of central directory

// Missing file in ZIP
Error: File not found in ZIP archive

// Corrupted data
Error: Invalid or unsupported zip format
```

#### Custom Errors

```typescript
// Invalid .hyle file (missing manifest.json)
throw new Error("Invalid Hyle file")
```

---

### 6. TOGGLE_PAUSE

**Pattern:** Invoke/Handle (Request-Response)
**Direction:** Architect Window → Main Process
**Purpose:** Toggles game pause state and broadcasts to both windows

#### Usage

**Caller:** `src/App.tsx:107` (handlePauseToggle function)

**Renderer (Architect):**
```typescript
// DM clicks pause/play button in toolbar
const newState = await window.ipcRenderer.invoke('TOGGLE_PAUSE')
```

**Main Process:** `electron/main.ts:780`
```typescript
ipcMain.handle('TOGGLE_PAUSE', () => {
  isGamePaused = !isGamePaused

  // Broadcast to both windows
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('PAUSE_STATE_CHANGED', isGamePaused)
  }
  if (worldWindow && !worldWindow.isDestroyed()) {
    worldWindow.webContents.send('PAUSE_STATE_CHANGED', isGamePaused)
  }

  return isGamePaused
})
```

#### Returns

**Type:** `boolean`

New pause state (`true` = paused, `false` = playing)

#### Behavior

- **Global State:** Main process maintains `isGamePaused` variable that persists across map changes
- **Defaults to false:** Game starts in playing state on app launch
- **Broadcasts:** After toggling, sends `PAUSE_STATE_CHANGED` event to both windows
- **Immediate Effect:** World View shows/hides LoadingOverlay based on new state
- **DM View:** Never shows overlay, DM can always see and edit the map

#### Related Files

- Trigger: `src/App.tsx` (Pause/Play button in toolbar)
- Handler: `electron/main.ts` (TOGGLE_PAUSE handler)
- State Consumer: `src/components/PauseManager.tsx` (receives broadcast)
- UI Effect: `src/components/LoadingOverlay.tsx` (shows/hides in World View)

---

### 7. GET_PAUSE_STATE

**Pattern:** Invoke/Handle (Request-Response)
**Direction:** Renderer → Main Process
**Purpose:** Fetches current pause state when window opens

#### Usage

**Caller:** `src/components/PauseManager.tsx:69`

**Renderer (Both Windows):**
```typescript
// PauseManager fetches initial state on mount
const isPaused = await window.ipcRenderer.invoke('GET_PAUSE_STATE')
setIsGamePaused(isPaused)
```

**Main Process:** `electron/main.ts:801`
```typescript
ipcMain.handle('GET_PAUSE_STATE', () => {
  return isGamePaused
})
```

#### Returns

**Type:** `boolean`

Current pause state (`true` = paused, `false` = playing)

#### Behavior

- **Called on mount:** PauseManager fetches state when component initializes
- **Ensures sync:** Handles case where window opens after pause was toggled
- **No side effects:** Read-only operation, doesn't modify state
- **Fast response:** Simple boolean return, no async operations

#### Use Cases

1. **World View opens while paused:** Immediately shows LoadingOverlay
2. **Architect View reopens:** Displays correct button state (PAUSED/PLAYING)
3. **State recovery:** Ensures UI matches main process state after window reload

#### Error Handling

```typescript
window.ipcRenderer.invoke('GET_PAUSE_STATE')
  .catch((error) => {
    console.error('[PauseManager] Failed to fetch pause state:', error)
    showToast('Failed to sync pause state', 'error')
  })
```

---

### 8. PAUSE_STATE_CHANGED

**Pattern:** Broadcast (Main → Renderer event)
**Direction:** Main Process → Both Windows
**Purpose:** Notifies renderers when pause state changes

#### Usage

**Sender:** `electron/main.ts:784-789` (TOGGLE_PAUSE handler)

**Main Process (Broadcaster):**
```typescript
// After toggling pause state
if (mainWindow && !mainWindow.isDestroyed()) {
  mainWindow.webContents.send('PAUSE_STATE_CHANGED', isGamePaused)
}
if (worldWindow && !worldWindow.isDestroyed()) {
  worldWindow.webContents.send('PAUSE_STATE_CHANGED', isGamePaused)
}
```

**Renderer (Subscriber):** `src/components/PauseManager.tsx:85`
```typescript
window.ipcRenderer.on('PAUSE_STATE_CHANGED', (_event, isPaused: boolean) => {
  setIsGamePaused(isPaused)
})
```

#### Payload

**Type:** `boolean`

New pause state (`true` = paused, `false` = playing)

#### Behavior

- **Broadcast to all:** Both Architect and World windows receive update
- **Triggers re-render:** Zustand store update causes React components to re-render
- **Immediate UI update:**
  - **Architect View:** Pause button changes color/text (GREEN "PLAYING" ↔ RED "PAUSED")
  - **World View:** LoadingOverlay appears/disappears
- **State sync:** Keeps all windows synchronized with main process

#### Data Flow

```
DM clicks button → App.tsx invokes TOGGLE_PAUSE
  → Main toggles isGamePaused
  → Main broadcasts PAUSE_STATE_CHANGED
  → PauseManager receives event (both windows)
  → Updates gameStore.isGamePaused
  → React components re-render:
    - App.tsx: Button updates
    - LoadingOverlay: Shows/hides (World View only)
```

#### Cleanup

**Important:** Always remove listener in useEffect cleanup to prevent memory leaks

```typescript
useEffect(() => {
  const handler = (_event, isPaused) => setIsGamePaused(isPaused)
  window.ipcRenderer.on('PAUSE_STATE_CHANGED', handler)

  return () => {
    window.ipcRenderer.off('PAUSE_STATE_CHANGED', handler)
  }
}, [])
```

---

### 9. get-username

**Pattern:** Invoke/Handle (Request-Response)
**Direction:** Renderer → Main Process
**Purpose:** Returns the system username for PII sanitization in error reports

#### Usage

**Caller:** `src/utils/errorSanitizer.ts`, `src/components/PrivacyErrorBoundary.tsx`

**Renderer:**
```typescript
const username = await window.errorReporting.getUsername()
// Returns: "johnsmith" (or current system username)
```

**Main Process:** `electron/main.ts`
```typescript
ipcMain.handle('get-username', () => {
  return os.userInfo().username
})
```

#### Returns

`string` - System username (e.g., `"johnsmith"` on macOS/Linux)

#### Purpose

Used by error reporting system to sanitize file paths in stack traces:
- `/Users/johnsmith/project/file.ts` → `/Users/<USER>/project/file.ts`

#### Related Files

- Handler: `electron/main.ts` (get-username handler)
- Preload: `electron/preload.ts` (exposed as `window.errorReporting.getUsername()`)
- Usage: `src/utils/errorSanitizer.ts`, `src/components/PrivacyErrorBoundary.tsx`

---

### 10. open-external

**Pattern:** Invoke/Handle (Request-Response)
**Direction:** Renderer → Main Process
**Purpose:** Opens external URLs (mailto: or https:) in the default application

#### Usage

**Caller:** `src/components/PrivacyErrorBoundary.tsx`

**Renderer:**
```typescript
const success = await window.errorReporting.openExternal('mailto:support@example.com')
// Opens email client with mailto link
```

**Main Process:** `electron/main.ts`
```typescript
ipcMain.handle('open-external', async (_event, url: string) => {
  if (url.startsWith('mailto:') || url.startsWith('https:')) {
    await shell.openExternal(url)
    return true
  }
  return false
})
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` | URL to open (must start with `mailto:` or `https:`) |

#### Returns

`boolean` - `true` if URL was opened successfully, `false` if URL format is invalid

#### Security

Only allows `mailto:` and `https:` URLs to prevent security issues. Other protocols are rejected.

#### Related Files

- Handler: `electron/main.ts` (open-external handler)
- Preload: `electron/preload.ts` (exposed as `window.errorReporting.openExternal()`)
- Usage: `src/components/PrivacyErrorBoundary.tsx` (error report email links)

---

### 11. save-error-report

**Pattern:** Invoke/Handle (Request-Response)
**Direction:** Renderer → Main Process
**Purpose:** Saves an error report to a file using the native save dialog

#### Usage

**Caller:** `src/components/PrivacyErrorBoundary.tsx`

**Renderer:**
```typescript
const result = await window.errorReporting.saveToFile(reportContent)
if (result.success) {
  console.log('Saved to:', result.filePath)
} else {
  console.error('Failed:', result.reason)
}
```

**Main Process:** `electron/main.ts`
```typescript
ipcMain.handle('save-error-report', async (_event, reportContent: string) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Save Error Report',
    defaultPath: `hyle-error-report-${Date.now()}.txt`,
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })

  if (canceled || !filePath) {
    return { success: false, reason: 'User canceled' }
  }

  await fs.writeFile(filePath, reportContent, 'utf-8')
  return { success: true, filePath }
})
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `reportContent` | `string` | The error report content to save (sanitized) |

#### Returns

`{ success: boolean; filePath?: string; reason?: string }`

- `success`: `true` if file was saved, `false` if user canceled or error occurred
- `filePath`: Absolute path to saved file (only present if `success === true`)
- `reason`: Error message or "User canceled" (only present if `success === false`)

#### Related Files

- Handler: `electron/main.ts` (save-error-report handler)
- Preload: `electron/preload.ts` (exposed as `window.errorReporting.saveToFile()`)
- Usage: `src/components/PrivacyErrorBoundary.tsx` (save error report button)

---

## Best Practices

### 1. Type Safety

**Use TypeScript interfaces for IPC payloads:**

```typescript
// Define payload interface
interface SaveCampaignPayload {
  tokens: Token[]
  drawings: Drawing[]
  gridSize: number
}

// Type the invoke call
const payload: SaveCampaignPayload = {
  tokens: store.tokens,
  drawings: store.drawings,
  gridSize: store.gridSize
}
const result = await window.ipcRenderer.invoke('SAVE_CAMPAIGN', payload)
```

### 2. Error Handling

**Always wrap IPC calls in try-catch:**

```typescript
try {
  const result = await window.ipcRenderer.invoke('CHANNEL', data)
  // Success path
} catch (error) {
  // Error path - always handle gracefully
  console.error('IPC failed:', error)
  // Show user-friendly error message
  alert('Operation failed. Please try again.')
}
```

### 3. Performance

**For high-frequency channels (like SYNC_WORLD_STATE):**

- Consider throttling or debouncing updates
- Only send necessary data (not entire store)
- Use shallow equality checks to prevent unnecessary syncs

```typescript
// Example: Throttle state sync to max 60 FPS
import { throttle } from 'lodash'

const syncState = throttle((state) => {
  window.ipcRenderer.send('SYNC_WORLD_STATE', state)
}, 16) // ~60 FPS
```

### 4. Cleanup

**Remove IPC listeners when components unmount:**

```typescript
useEffect(() => {
  const handler = (event, data) => {
    // Handle data
  }

  window.ipcRenderer.on('CHANNEL', handler)

  return () => {
    window.ipcRenderer.off('CHANNEL', handler)
  }
}, [])
```

### 5. Security

**Never expose privileged APIs directly:**

```typescript
// ❌ BAD - Exposes entire fs module
contextBridge.exposeInMainWorld('fs', fs)

// ✅ GOOD - Exposes controlled API
contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args)
})
```

**Validate IPC inputs in main process:**

```typescript
ipcMain.handle('SAVE_CAMPAIGN', async (event, gameState) => {
  // Validate input
  if (!gameState.tokens || !Array.isArray(gameState.tokens)) {
    throw new Error('Invalid gameState: tokens must be an array')
  }

  // Continue with validated data
})
```

### 6. Documentation

**Document IPC usage at call sites:**

```typescript
// IPC invoke to main process (shows save dialog, creates ZIP)
// See electron/main.ts:309 for handler implementation
// Returns: boolean (true if saved, false if cancelled)
const result = await window.ipcRenderer.invoke('SAVE_CAMPAIGN', dataToSave)
```

---

## Debugging IPC

### Enable IPC Logging

**Main process:**
```typescript
ipcMain.on('*', (event, ...args) => {
  console.log('IPC event:', event.sender.getURL(), ...args)
})
```

**Renderer process:**
```typescript
// Log all IPC sends
const originalSend = window.ipcRenderer.send
window.ipcRenderer.send = function(channel, ...args) {
  console.log('IPC send:', channel, args)
  return originalSend.call(this, channel, ...args)
}
```

### Common Issues

**Issue: "window.ipcRenderer is undefined"**
- **Cause:** Preload script not loaded or context bridge not set up
- **Fix:** Check `webPreferences.preload` path in BrowserWindow config

**Issue: IPC call hangs forever**
- **Cause:** Handler not registered in main process
- **Fix:** Verify `ipcMain.handle()` or `ipcMain.on()` is called before window loads

**Issue: State not syncing to World Window**
- **Cause:** World Window not created or destroyed
- **Fix:** Check `worldWindow && !worldWindow.isDestroyed()` before sending

---

## Future Enhancements

### Potential New Channels

1. **EXPORT_IMAGE** - Export canvas as PNG/JPEG
2. **IMPORT_MAP** - Load background map image
3. **CLEAR_DRAWINGS** - Clear all drawings (with undo support)
4. **UPDATE_TOKEN_POSITION** - Real-time token drag updates
5. **CHAT_MESSAGE** - DM notes/announcements to World Window

### Performance Optimizations

1. **Differential sync:** Only send changed tokens/drawings
2. **Compression:** Use MessagePack for binary serialization
3. **Batching:** Batch multiple drawing strokes before sync
4. **WebSockets:** Alternative to IPC for future multiplayer support

---

## See Also

- **Architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- **State Management:** [src/store/README.md](./src/store/README.md) - Zustand store patterns
- **Main Process:** [electron/README.md](./electron/README.md) - Electron main process
- **Preload Script:** [electron/preload.ts](./electron/preload.ts) - Context bridge setup
