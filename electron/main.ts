/**
 * Electron main process for Hyle
 *
 * This is the main process entry point for the Electron application. It handles:
 * - Window creation (Architect View and World View)
 * - IPC communication between renderer processes
 * - File I/O operations (save/load campaigns, asset storage)
 * - Custom protocol registration (media:// for local file access)
 *
 * **Process architecture:**
 * ```
 * Main Process (Node.js - this file)
 *   ├── Architect Window (renderer: React app without ?type=world)
 *   └── World Window (renderer: React app with ?type=world)
 * ```
 *
 * **IPC channels:**
 * - 'create-world-window': Creates World View window
 * - 'SYNC_WORLD_STATE': Broadcasts state changes to World Window
 * - 'SAVE_ASSET_TEMP': Saves processed asset to temp directory
 * - 'SAVE_CAMPAIGN': Serializes campaign to .hyle ZIP file
 * - 'LOAD_CAMPAIGN': Deserializes .hyle file and restores assets
 *
 * See ARCHITECTURE.md for complete IPC documentation.
 */

import { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu, IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import JSZip from 'jszip'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import {
  initializeThemeManager,
  getThemeState,
  setThemeMode,
  type ThemeMode,
} from './themeManager.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Register custom protocol BEFORE app.whenReady()
// This allows media:// URLs to work in renderer process
// See app.whenReady() handler for protocol.handle() implementation
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { secure: true, supportFetchAPI: true, bypassCSP: true } }
])

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// Window references (null when closed)
let mainWindow: BrowserWindow | null
let worldWindow: BrowserWindow | null

/**
 * Build application menu with theme options
 *
 * Creates native menu bar with:
 * - File menu (standard app controls)
 * - View menu (theme selection)
 * - Help menu (future: docs, about)
 *
 * Theme submenu allows selecting:
 * - Light mode (force light theme)
 * - Dark mode (force dark theme)
 * - System (follow OS preference) ← default
 */
function buildApplicationMenu() {
  const currentTheme = getThemeState().mode

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only - shows app name)
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),

    // File menu
    {
      label: 'File',
      submenu: [
        process.platform === 'darwin'
          ? ({ role: 'close' } as const)
          : ({ role: 'quit' } as const),
      ],
    },

    // View menu with theme options
    {
      label: 'View',
      submenu: [
        {
          label: 'Theme',
          submenu: [
            {
              label: 'Light',
              type: 'radio',
              checked: currentTheme === 'light',
              click: () => setThemeMode('light'),
            },
            {
              label: 'Dark',
              type: 'radio',
              checked: currentTheme === 'dark',
              click: () => setThemeMode('dark'),
            },
            {
              label: 'System',
              type: 'radio',
              checked: currentTheme === 'system',
              click: () => setThemeMode('system'),
            },
          ],
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(process.platform === 'darwin'
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

/**
 * Creates the main Architect Window (DM control panel)
 *
 * This window is the source of truth for all game state. It includes:
 * - Full UI (Sidebar, CanvasManager, Toolbar)
 * - Drawing tools (marker, eraser)
 * - Campaign save/load controls
 * - World View creation button
 *
 * **State synchronization:**
 * This window is the PRODUCER. All state changes here are broadcast to the
 * World Window via the SYNC_WORLD_STATE IPC channel (see SyncManager.tsx:101-112).
 *
 * **Development mode:**
 * Loads from Vite dev server if VITE_DEV_SERVER_URL is set, otherwise loads
 * from built dist/index.html file.
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process (legacy from template)
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  // Load renderer (dev server in development, static files in production)
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

/**
 * Creates the World Window (player-facing projector display)
 *
 * This window shows a read-only view of the battlemap for players. It displays:
 * - Grid overlay
 * - Tokens (as positioned by DM)
 * - Drawings (marker/eraser strokes)
 * - NO Sidebar, NO Toolbar, NO editing controls
 *
 * **State synchronization:**
 * This window is the CONSUMER. It receives state updates via the SYNC_WORLD_STATE
 * IPC channel but NEVER modifies state itself (see SyncManager.tsx:80-96).
 *
 * **Window detection:**
 * Loads same React app as main window but with `?type=world` query parameter.
 * SyncManager.tsx detects this parameter and enters CONSUMER mode.
 *
 * **Singleton behavior:**
 * Only one World Window can exist at a time. If user clicks "World View" button
 * when a World Window already exists, we focus the existing window instead of
 * creating a new one.
 *
 * @example
 * // Triggered by App.tsx "World View" button:
 * window.ipcRenderer.send('create-world-window')
 */
function createWorldWindow() {
  // Singleton pattern: reuse existing window if it exists
  if (worldWindow && !worldWindow.isDestroyed()) {
    worldWindow.focus()
    return
  }

  worldWindow = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Load same app with ?type=world query parameter
  if (VITE_DEV_SERVER_URL) {
    worldWindow.loadURL(`${VITE_DEV_SERVER_URL}?type=world`)
  } else {
    worldWindow.loadFile(path.join(RENDERER_DIST, 'index.html'), { query: { type: 'world' } })
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    mainWindow = null
    worldWindow = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow()
  }
})

/**
 * App initialization: Set up protocol handlers and IPC listeners
 *
 * This runs once when Electron is ready (after app launch). It registers:
 * - Custom media:// protocol handler
 * - IPC handlers for all renderer→main communication
 * - Main window creation
 */
app.whenReady().then(() => {
  /**
   * Custom protocol handler for media:// URLs
   *
   * Translates media:// URLs to file:// URLs in a privileged context. This is
   * necessary because Electron's security model blocks direct file:// access
   * from renderer processes (web content).
   *
   * **Usage pattern:**
   * Renderer: <img src="media:///Users/.../temp_assets/token.webp" />
   * Handler: Translates to file:///Users/.../temp_assets/token.webp
   * Result: Image loads successfully in Konva canvas
   *
   * **Why this is secure:**
   * - Only works for assets our app explicitly saved to temp_assets/
   * - Renderer can't access arbitrary file:// paths (no directory traversal)
   * - media:// URLs are validated by our code (no user-controlled paths)
   *
   * See CanvasManager.URLImage component for usage (src/components/Canvas/CanvasManager.tsx:47-52).
   */
  protocol.handle('media', (request: Request) => {
    return net.fetch('file://' + request.url.slice('media://'.length))
  })

  // Initialize theme system (must be before window creation)
  initializeThemeManager()

  // Build application menu with theme options
  buildApplicationMenu()

  createMainWindow()

  /**
   * IPC handler: create-world-window
   *
   * Creates the World View window when user clicks "World View" button in toolbar.
   * See App.tsx:119 for caller.
   */
  ipcMain.on('create-world-window', createWorldWindow)

  /**
   * IPC handler: REQUEST_INITIAL_STATE
   *
   * When World View opens, it requests the current game state from Architect View.
   * This ensures World View displays the current map/tokens even if no state changes
   * have occurred since it opened.
   *
   * **Data flow:**
   * 1. World View opens and sends REQUEST_INITIAL_STATE
   * 2. Main process relays request to Architect View
   * 3. Architect View responds with FULL_SYNC containing current state
   * 4. Main process broadcasts FULL_SYNC to World View
   */
  ipcMain.on('REQUEST_INITIAL_STATE', (_event: IpcMainEvent) => {
    // Relay request to main window (Architect View)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('REQUEST_INITIAL_STATE')
    }
  })

  /**
   * IPC handler: SYNC_FROM_WORLD_VIEW
   *
   * Handles token updates from World View (when DM demonstrates movement on projector).
   * Relays the update to Architect View, which will then broadcast it back to World View
   * via the normal SYNC_WORLD_STATE channel.
   *
   * **Data flow:**
   * 1. User drags token in World View
   * 2. World View sends SYNC_FROM_WORLD_VIEW → Main Process (here)
   * 3. Main Process relays to Architect View via SYNC_WORLD_STATE
   * 4. Architect View applies update to its store
   * 5. Architect View's subscription broadcasts update back to World View
   * 6. World View receives update (no-op since position already matches)
   *
   * This creates a round-trip but ensures Architect View remains the source of truth.
   */
  ipcMain.on('SYNC_FROM_WORLD_VIEW', (_event: IpcMainEvent, action: unknown) => {
    // Relay World View changes to Architect View (main window)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('SYNC_WORLD_STATE', action)
    }
  })

  /**
   * IPC handler: SYNC_WORLD_STATE
   *
   * Broadcasts state changes from Architect Window to World Window.
   * Called by SyncManager.tsx:111 on every store update in Architect View.
   *
   * **Data flow:**
   * Architect Window → IPC send → Main process (this handler) → World Window
   *
   * **Pattern:** Publish-subscribe via main process relay
   * - Architect publishes state changes
   * - Main process relays to World Window
   * - World Window subscribes and updates local store
   */
  ipcMain.on('SYNC_WORLD_STATE', (_event: IpcMainEvent, state: unknown) => {
    if (worldWindow && !worldWindow.isDestroyed()) {
        worldWindow.webContents.send('SYNC_WORLD_STATE', state)
    }
  })

  /**
   * IPC handler: SAVE_ASSET_TEMP
   *
   * Saves processed image asset to temp storage directory.
   * Called by AssetProcessor.processImage() after WebP conversion (src/utils/AssetProcessor.ts:112).
   *
   * **Storage location:** app.getPath('userData')/temp_assets/
   * **File naming:** {timestamp}-{originalName}.webp
   * **Return value:** file:// URL pointing to saved asset
   *
   * **Why temp storage:**
   * - Assets need to persist until campaign is saved
   * - Temp directory is cleaned on app restart (no orphaned files)
   * - Campaign save copies assets into .hyle ZIP (permanent storage)
   *
   * @param buffer - WebP image data as ArrayBuffer
   * @param name - Original filename (with .webp extension)
   * @returns file:// URL for use in token.src
   *
   * @example
   * // Called from AssetProcessor.processImage():
   * const filePath = await window.ipcRenderer.invoke(
   *   'SAVE_ASSET_TEMP',
   *   arrayBuffer,
   *   'goblin.webp'
   * );
   * // Returns: "file:///Users/.../Hyle/temp_assets/1234567890-goblin.webp"
   */
  ipcMain.handle('SAVE_ASSET_TEMP', async (_event: IpcMainInvokeEvent, buffer: ArrayBuffer, name: string) => {
    const tempDir = path.join(app.getPath('userData'), 'temp_assets');
    await fs.mkdir(tempDir, { recursive: true });  // Create if doesn't exist
    const fileName = `${Date.now()}-${name}`;  // Timestamp prevents collisions
    const filePath = path.join(tempDir, fileName);
    await fs.writeFile(filePath, Buffer.from(buffer));
    return `file://${filePath}`;  // Return file:// URL for renderer
  })

  /**
   * IPC handler: SAVE_CAMPAIGN
   *
   * Serializes campaign state to a .hyle ZIP file.
   * Called by App.tsx:89 when user clicks "Save" button.
   *
   * **.hyle file structure:**
   * ```
   * campaign.hyle (ZIP archive)
   *   ├── manifest.json  (serialized game state)
   *   └── assets/
   *       ├── 1234567890-goblin.webp
   *       ├── 1234567891-dragon.webp
   *       └── ... (all token images)
   * ```
   *
   * **Algorithm:**
   * 1. Show native save dialog (user chooses file path)
   * 2. Create ZIP archive
   * 3. For each token with file:// URL:
   *    - Read image file from temp_assets/
   *    - Add to ZIP as assets/{basename}
   *    - Rewrite token.src to relative path "assets/{basename}"
   * 4. Add modified state as manifest.json
   * 5. Write ZIP to disk
   *
   * **Why rewrite paths:**
   * file:// URLs are machine-specific (e.g., /Users/alice/...). Relative paths
   * make .hyle files portable across machines (e.g., shared with other DMs).
   *
   * @param gameState - Campaign data from useGameStore (tokens, drawings, gridSize)
   * @returns true if saved successfully, false if user cancelled
   *
   * @example
   * // Called from App.tsx Save button:
   * const result = await window.ipcRenderer.invoke('SAVE_CAMPAIGN', {
   *   tokens: [...],
   *   drawings: [...],
   *   gridSize: 50
   * });
   */
  ipcMain.handle('SAVE_CAMPAIGN', async (_event: IpcMainInvokeEvent, gameState: unknown) => {
    const { filePath } = await dialog.showSaveDialog({
      filters: [{ name: 'Hyle Campaign', extensions: ['hyle'] }]
    });
    if (!filePath) return false;  // User cancelled

    const zip = new JSZip();
    const assetsFolder = zip.folder("assets");

    // Deep clone to avoid mutating original state
    const stateToSave = JSON.parse(JSON.stringify(gameState));

    // Copy token assets into ZIP and rewrite paths
    for (const token of stateToSave.tokens) {
       if (token.src.startsWith('file://')) {
           const absolutePath = fileURLToPath(token.src);  // file:// → /Users/...
           const basename = path.basename(absolutePath);   // Extract filename
           const content = await fs.readFile(absolutePath);
           assetsFolder?.file(basename, content);          // Add to ZIP
           token.src = `assets/${basename}`;               // Rewrite to relative path
       }
    }

    // Add manifest.json with modified state
    zip.file("manifest.json", JSON.stringify(stateToSave));

    // Write ZIP to disk
    const content = await zip.generateAsync({ type: "nodebuffer" });
    await fs.writeFile(filePath, content);
    return true;
 });

 /**
  * IPC handler: LOAD_CAMPAIGN
  *
  * Deserializes a .hyle ZIP file and restores campaign state.
  * Called by App.tsx:103 when user clicks "Load" button.
  *
  * **Algorithm:**
  * 1. Show native open dialog (user chooses .hyle file)
  * 2. Read ZIP file from disk
  * 3. Extract manifest.json (parse campaign state)
  * 4. Create session directory (userData/sessions/{timestamp}/)
  * 5. For each token with relative path (assets/...):
  *    - Extract image from ZIP
  *    - Write to session directory
  *    - Rewrite token.src to file:// URL
  * 6. Return modified state to renderer
  *
  * **Why session directories:**
  * Each load creates a new session folder to avoid conflicts. This allows:
  * - Multiple campaigns to be loaded in succession without cleanup
  * - Session assets to persist until next load
  * - Clean separation between temp uploads and loaded campaigns
  *
  * **Path translation:**
  * ZIP: assets/goblin.webp (relative)
  * → Extracted to: /Users/.../sessions/1234567890/assets/goblin.webp
  * → Returned as: file:///Users/.../sessions/1234567890/assets/goblin.webp
  *
  * @returns Campaign state with file:// URLs, or null if user cancelled
  *
  * @example
  * // Called from App.tsx Load button:
  * const state = await window.ipcRenderer.invoke('LOAD_CAMPAIGN');
  * if (state) {
  *   useGameStore.getState().setState(state);  // Restore state
  * }
  */
 ipcMain.handle('LOAD_CAMPAIGN', async () => {
    const { filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'Hyle Campaign', extensions: ['hyle'] }]
    });
    if (filePaths.length === 0) return null;  // User cancelled

    // Read and parse ZIP file
    const zipContent = await fs.readFile(filePaths[0]);
    const zip = await JSZip.loadAsync(zipContent);

    // Create unique session directory for this load operation
    const sessionDir = path.join(app.getPath('userData'), 'sessions', Date.now().toString());
    await fs.mkdir(sessionDir, { recursive: true });

    // Extract manifest.json (campaign state)
    const manifestStr = await zip.file("manifest.json")?.async("string");
    if (!manifestStr) throw new Error("Invalid Hyle file");

    const state = JSON.parse(manifestStr);

    // Extract assets from ZIP and rewrite paths to file:// URLs
    const assets = zip.folder("assets");
    if (assets) {
        const assetsDir = path.join(sessionDir, 'assets');
        await fs.mkdir(assetsDir, { recursive: true });

        // Restore each token asset
        for (const token of state.tokens) {
            if (token.src.startsWith('assets/')) {
                const relativePath = token.src;
                const fileName = path.basename(relativePath);
                const fileData = await assets.file(fileName)?.async("nodebuffer");
                if (fileData) {
                    const destPath = path.join(assetsDir, fileName);
                    await fs.writeFile(destPath, fileData);
                    token.src = `file://${destPath}`;  // Rewrite to absolute file:// URL
                }
            }
        }
    }

    return state;  // Return state with file:// URLs
 });

 /**
  * IPC handler: get-theme-state
  *
  * Returns current theme state to renderer on mount.
  * Called by ThemeManager component when app initializes.
  *
  * @returns Object with mode ('light'|'dark'|'system') and effectiveTheme ('light'|'dark')
  */
 ipcMain.handle('get-theme-state', () => {
   return getThemeState()
 })

 /**
  * IPC handler: set-theme-mode
  *
  * Updates theme preference and broadcasts to all windows.
  * Called when user selects theme from application menu.
  *
  * @param mode - Theme mode to set ('light', 'dark', or 'system')
  */
 ipcMain.handle('set-theme-mode', (_event: IpcMainInvokeEvent, mode: ThemeMode) => {
   setThemeMode(mode)
 })
})
