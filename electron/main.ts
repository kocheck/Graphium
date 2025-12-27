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
 * - 'SELECT_LIBRARY_PATH': Opens directory picker for library location
 * - 'SAVE_ASSET_TO_LIBRARY': Saves asset to persistent library
 * - 'LOAD_LIBRARY_INDEX': Loads library metadata index
 * - 'DELETE_LIBRARY_ASSET': Removes asset from library
 * - 'UPDATE_LIBRARY_METADATA': Updates library asset metadata
 *
 * See ARCHITECTURE.md for complete IPC documentation.
 */

import { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu, IpcMainEvent, IpcMainInvokeEvent, shell } from 'electron'
import JSZip from 'jszip'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
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

// Global pause state - persists across map changes
let isGamePaused = false

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
        {
          label: 'Open Campaign...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
             const win = BrowserWindow.getFocusedWindow();
             if (win) win.webContents.send('MENU_LOAD_CAMPAIGN');
          }
        },
        {
          label: 'Save Campaign',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
             const win = BrowserWindow.getFocusedWindow();
             if (win) win.webContents.send('MENU_SAVE_CAMPAIGN');
          }
        },
        { type: 'separator' },
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
        {
            label: 'World View (Projector)',
            accelerator: 'CmdOrCtrl+Shift+W',
            click: () => createWorldWindow()
        },
        {
            label: 'Performance Monitor',
            accelerator: 'CmdOrCtrl+Shift+M',
            click: () => {
                const win = BrowserWindow.getFocusedWindow();
                if (win) win.webContents.send('MENU_TOGGLE_RESOURCE_MONITOR');
            }
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
  ipcMain.on('REQUEST_INITIAL_STATE', () => {
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

// Track the currently open campaign file path for auto-save
let currentCampaignPath: string | null = null;

  /**
   * Helper function to serialize campaign assets to a ZIP file.
   * Processes all map backgrounds, tokens, and library assets.
   *
   * @param campaign - Campaign data to serialize
   * @param zip - JSZip instance to add files to
   * @returns Modified campaign object with relative asset paths
   */
  async function serializeCampaignToZip(campaign: unknown, zip: JSZip): Promise<unknown> {
      const assetsFolder = zip.folder("assets");

      // Deep clone to avoid mutating original state
      const campaignToSave = JSON.parse(JSON.stringify(campaign));

      // Track processed files to avoid duplication
      // Key: Absolute source path, Value: Relative destination path in zip
      const processedAssets = new Map<string, string>();

      // Helper to process an image asset
      const processAsset = async (src: string): Promise<string> => {
          if (!src || !src.startsWith('file://')) return src;

          const absolutePath = fileURLToPath(src);

          // If already processed, return the existing relative path
          if (processedAssets.has(absolutePath)) {
              return processedAssets.get(absolutePath)!;
          }

          const basename = path.basename(absolutePath);
          const content = await fs.readFile(absolutePath).catch(() => null);
          if (content) {
              assetsFolder?.file(basename, content);
              const relativePath = `assets/${basename}`;
              processedAssets.set(absolutePath, relativePath);
              return relativePath;
          }
          return src; // Keep original if read fails
      };

      // Iterate all maps and process assets
      if (campaignToSave.maps) {
          for (const mapId in campaignToSave.maps) {
              const map = campaignToSave.maps[mapId];

              // 1. Process Map Background
              if (map.map && map.map.src) {
                  map.map.src = await processAsset(map.map.src);
              }

              // 2. Process Tokens
              if (map.tokens) {
                  for (const token of map.tokens) {
                      token.src = await processAsset(token.src);
                  }
              }
          }
      }

      // 3. Process Campaign Token Library
      if (campaignToSave.tokenLibrary) {
          for (const item of campaignToSave.tokenLibrary) {
              item.src = await processAsset(item.src);
          }
      }

      return campaignToSave;
  }

  /**
   * IPC handler: SAVE_CAMPAIGN
   *
   * Serializes campaign state to a .hyle ZIP file.
   * Handles multi-map campaigns by iterating through all maps and collecting assets.
   *
   * @param campaign - Campaign data from useGameStore.campaign
   */
  ipcMain.handle('SAVE_CAMPAIGN', async (_event: IpcMainInvokeEvent, campaign: unknown) => {
    const { filePath } = await dialog.showSaveDialog({
      filters: [{ name: 'Hyle Campaign', extensions: ['hyle'] }]
    });
    if (!filePath) return false;

    // Update current path for auto-save
    currentCampaignPath = filePath;

    const zip = new JSZip();

    // Use shared helper to process campaign assets
    const campaignToSave = await serializeCampaignToZip(campaign, zip);

    // Add manifest.json with modified state
    zip.file("manifest.json", JSON.stringify(campaignToSave));

    // Write ZIP to disk
    const content = await zip.generateAsync({ type: "nodebuffer" });
    await fs.writeFile(filePath, content);
    return true;
 });

  /**
   * IPC handler: AUTO_SAVE
   *
   * Saves the campaign to the last known path without user interaction.
   * Uses atomic write (write to temp + rename) to prevent corruption.
   */
  ipcMain.handle('AUTO_SAVE', async (_event: IpcMainInvokeEvent, campaign: unknown) => {
      if (!currentCampaignPath) return false; // No file open, cannot auto-save

      try {
          const zip = new JSZip();

          // Use shared helper to process campaign assets
          const campaignToSave = await serializeCampaignToZip(campaign, zip);

          zip.file("manifest.json", JSON.stringify(campaignToSave));
          const content = await zip.generateAsync({ type: "nodebuffer" });

          // Atomic write: write to .tmp file then rename
          const tempPath = currentCampaignPath + '.tmp';
          await fs.writeFile(tempPath, content);
          await fs.rename(tempPath, currentCampaignPath);

          return true;
      } catch (err) {
          console.error("Auto-save failed:", err);
          return false;
      }
  });

 /**
  * IPC handler: LOAD_CAMPAIGN
  *
  * Deserializes a .hyle ZIP file and restores campaign state.
  * Handles migration from legacy single-map files to new Campaign format.
  */
 ipcMain.handle('LOAD_CAMPAIGN', async () => {
    const { filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'Hyle Campaign', extensions: ['hyle'] }]
    });
    if (filePaths.length === 0) return null;

    currentCampaignPath = filePaths[0]; // Set path for auto-save

    // Read and parse ZIP file
    const zipContent = await fs.readFile(filePaths[0]);
    const zip = await JSZip.loadAsync(zipContent);

    // Create unique session directory
    const sessionDir = path.join(app.getPath('userData'), 'sessions', Date.now().toString());
    await fs.mkdir(sessionDir, { recursive: true });

    // Extract manifest
    const manifestStr = await zip.file("manifest.json")?.async("string");
    if (!manifestStr) throw new Error("Invalid Hyle file");

    type TokenWithSrc = {
      src: string;
      [key: string]: unknown;
    };

    type MapData = {
      id: string;
      name: string;
      tokens?: TokenWithSrc[];
      drawings?: unknown[];
      map?: {
        src?: string | null;
        [key: string]: unknown;
      } | null;
      gridSize?: number;
      gridType?: string;
      exploredRegions?: unknown[];
      isDaylightMode?: boolean;
      [key: string]: unknown;
    };

    type LegacyGameState = {
      maps?: undefined;
      tokens?: TokenWithSrc[];
      drawings?: unknown[];
      map?: {
        src?: string | null;
        [key: string]: unknown;
      } | null;
      gridSize?: number;
      gridType?: string;
      exploredRegions?: unknown[];
      isDaylightMode?: boolean;
      [key: string]: unknown;
    };

    type CampaignManifest = {
      id: string;
      name: string;
      maps: Record<string, MapData>;
      activeMapId: string;
      tokenLibrary?: TokenWithSrc[];
      [key: string]: unknown;
    };

    const loadedData: CampaignManifest | LegacyGameState = JSON.parse(manifestStr);
    let campaign: CampaignManifest;

    // --- MIGRATION: Check if Legacy File ---
    if (!loadedData.maps) {
        // Legacy format: loadedData is a GameState object (tokens, map, etc.)
        // Convert to Campaign structure
        const mapId = randomUUID();
        const mapData: MapData = {
            id: mapId,
            name: 'Imported Map',
            tokens: loadedData.tokens || [],
            drawings: loadedData.drawings || [],
            map: loadedData.map || null,
            gridSize: loadedData.gridSize || 50,
            gridType: loadedData.gridType || 'LINES',
            exploredRegions: loadedData.exploredRegions || [],
            isDaylightMode: loadedData.isDaylightMode || false
        };

        campaign = {
            id: randomUUID(),
            name: 'Imported Campaign',
            maps: { [mapId]: mapData },
            activeMapId: mapId,
            tokenLibrary: [] // Initialize empty library for legacy
        };
    } else {
        // New format
        campaign = loadedData;
    }

    // Extract assets and restore paths
    const assets = zip.folder("assets");
    if (assets) {
        const assetsDir = path.join(sessionDir, 'assets');
        await fs.mkdir(assetsDir, { recursive: true });

        const restoreAsset = async (src: string): Promise<string> => {
            if (src && src.startsWith('assets/')) {
                const fileName = path.basename(src);
                const fileData = await assets.file(fileName)?.async("nodebuffer");
                if (fileData) {
                    const destPath = path.join(assetsDir, fileName);
                    await fs.writeFile(destPath, fileData);
                    return `file://${destPath}`;
                }
            }
            return src;
        };

        // Restore assets for ALL maps
        for (const mapId in campaign.maps) {
            const map = campaign.maps[mapId];

            // 1. Restore Map Background
            if (map.map && map.map.src) {
                map.map.src = await restoreAsset(map.map.src);
            }

            // 2. Restore Tokens
            if (map.tokens) {
                for (const token of map.tokens) {
                    token.src = await restoreAsset(token.src);
                }
            }
        }

        // 3. Restore Campaign Token Library assets
        if (campaign.tokenLibrary) {
            for (const item of campaign.tokenLibrary) {
                item.src = await restoreAsset(item.src);
            }
        }
    }

    return campaign;
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

 /**
  * IPC handler: TOGGLE_PAUSE
  *
  * Toggles the game pause state and broadcasts the new state to both windows.
  * When paused, the World View displays a loading overlay to hide DM actions.
  *
  * @returns New pause state
  */
 ipcMain.handle('TOGGLE_PAUSE', () => {
   isGamePaused = !isGamePaused

   // Broadcast new pause state to all windows
   if (mainWindow && !mainWindow.isDestroyed()) {
     mainWindow.webContents.send('PAUSE_STATE_CHANGED', isGamePaused)
   }
   if (worldWindow && !worldWindow.isDestroyed()) {
     worldWindow.webContents.send('PAUSE_STATE_CHANGED', isGamePaused)
   }

   return isGamePaused
 })

 /**
  * IPC handler: GET_PAUSE_STATE
  *
  * Returns the current pause state. Used when windows first load to sync state.
  *
  * @returns Current pause state
  */
 ipcMain.handle('GET_PAUSE_STATE', () => {
   return isGamePaused
 })

 /**
  * IPC handler: SELECT_LIBRARY_PATH
  *
  * Opens a native directory picker dialog for user to select their token library location.
  * This allows users to choose where their persistent token library will be stored.
  *
  * @returns Selected directory path, or null if user cancelled
  */
 ipcMain.handle('SELECT_LIBRARY_PATH', async () => {
   const result = await dialog.showOpenDialog({
     properties: ['openDirectory', 'createDirectory'],
     title: 'Select Token Library Location'
   });
   if (result.canceled) return null;
   return result.filePaths[0];
 })

 /**
  * IPC handler: SAVE_ASSET_TO_LIBRARY
  *
  * Saves a token asset to the persistent library directory.
  * Creates both full-size and thumbnail versions of the image.
  *
  * **Note on concurrency:**
  * This handler uses a read-modify-write pattern for index.json which could
  * result in lost updates if multiple saves happen simultaneously. Since this
  * application is designed for single-user local use, concurrent access is not
  * expected. If concurrent operations become a requirement, consider implementing
  * a file locking mechanism or atomic update pattern.
  *
  * @param fullSizeBuffer - Full-resolution WebP image as ArrayBuffer
  * @param thumbnailBuffer - 128x128 thumbnail WebP image as ArrayBuffer
  * @param metadata - Asset metadata (id, name, category, tags)
  * @returns Complete TokenLibraryItem with file:// URLs
  */
 ipcMain.handle('SAVE_ASSET_TO_LIBRARY', async (
   _event: IpcMainInvokeEvent,
   {
     fullSizeBuffer,
     thumbnailBuffer,
     metadata
   }: {
     fullSizeBuffer: ArrayBuffer;
     thumbnailBuffer: ArrayBuffer;
     metadata: {
       id: string;
       name: string;
       category: string;
       tags: string[];
     };
   }
 ) => {
   const libraryPath = path.join(app.getPath('userData'), 'library', 'assets');
   await fs.mkdir(libraryPath, { recursive: true });

   // Save full-size image
   const filename = `${metadata.id}.webp`;
   const fullPath = path.join(libraryPath, filename);
   await fs.writeFile(fullPath, Buffer.from(fullSizeBuffer));

   // Save thumbnail
   const thumbFilename = `thumb-${metadata.id}.webp`;
   const thumbPath = path.join(libraryPath, thumbFilename);
   await fs.writeFile(thumbPath, Buffer.from(thumbnailBuffer));

   // Update index.json
   const indexPath = path.join(app.getPath('userData'), 'library', 'index.json');
   let index: { items: unknown[] } = { items: [] };

   try {
     const indexData = await fs.readFile(indexPath, 'utf-8');
     index = JSON.parse(indexData);
     
     // Validate index structure to prevent runtime errors on corruption
     if (!index.items || !Array.isArray(index.items)) {
       console.warn('[MAIN] Invalid index.json structure, resetting to empty array');
       index.items = [];
     }
   } catch {
     // Index doesn't exist yet, use empty array
   }

   const newItem = {
     ...metadata,
     src: `file://${fullPath}`,
     thumbnailSrc: `file://${thumbPath}`,
     dateAdded: Date.now()
   };

   index.items.push(newItem);
   await fs.writeFile(indexPath, JSON.stringify(index, null, 2));

   return newItem;
 })

 /**
  * IPC handler: LOAD_LIBRARY_INDEX
  *
  * Loads the library metadata index from disk.
  * Returns empty array if index doesn't exist yet.
  *
  * @returns Array of TokenLibraryItem objects
  */
 ipcMain.handle('LOAD_LIBRARY_INDEX', async () => {
   const indexPath = path.join(app.getPath('userData'), 'library', 'index.json');

   try {
     const data = await fs.readFile(indexPath, 'utf-8');
     const index = JSON.parse(data);
     return index.items || [];
   } catch {
     // Index doesn't exist or is corrupted
     return [];
   }
 })

 /**
  * IPC handler: DELETE_LIBRARY_ASSET
  *
  * Removes an asset from the library (both files and metadata).
  * Deletes full-size image, thumbnail, and updates index.json.
  *
  * **Note on concurrency:**
  * This handler uses a read-modify-write pattern for index.json which could
  * result in lost updates if multiple operations happen simultaneously. Since
  * this application is designed for single-user local use, concurrent access
  * is not expected. If concurrent operations become a requirement, consider
  * implementing a file locking mechanism or atomic update pattern.
  *
  * @param assetId - UUID of the asset to delete
  * @returns true if successful
  */
 ipcMain.handle('DELETE_LIBRARY_ASSET', async (_event: IpcMainInvokeEvent, assetId: string) => {
   const libraryPath = path.join(app.getPath('userData'), 'library', 'assets');

   try {
     // Delete full-size image
     await fs.unlink(path.join(libraryPath, `${assetId}.webp`));

     // Delete thumbnail
     await fs.unlink(path.join(libraryPath, `thumb-${assetId}.webp`));
   } catch (err) {
     console.error('[MAIN] Failed to delete library asset files:', err);
     // Continue to update index even if files don't exist
   }

   // Update index.json
   const indexPath = path.join(app.getPath('userData'), 'library', 'index.json');

   try {
     const data = await fs.readFile(indexPath, 'utf-8');
     const index = JSON.parse(data);

     // Validate index structure before modifying
     if (!index.items || !Array.isArray(index.items)) {
       console.warn('[MAIN] Invalid index.json structure during delete');
       index.items = [];
     }

     index.items = index.items.filter((item: { id: string }) => item.id !== assetId);
     await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
   } catch (err) {
     console.error('[MAIN] Failed to update library index:', err);
     throw err;
   }

   return true;
 })

 /**
  * IPC handler: UPDATE_LIBRARY_METADATA
  *
  * Updates metadata for a library asset (name, category, tags).
  * Does not modify the asset files themselves.
  *
  * @param assetId - UUID of the asset to update
  * @param updates - Partial metadata updates
  * @returns Updated TokenLibraryItem
  */
 ipcMain.handle('UPDATE_LIBRARY_METADATA', async (
   _event: IpcMainInvokeEvent,
   assetId: string,
   updates: { name?: string; category?: string; tags?: string[] }
 ) => {
   const indexPath = path.join(app.getPath('userData'), 'library', 'index.json');

   const data = await fs.readFile(indexPath, 'utf-8');
   const index = JSON.parse(data);

   if (!index.items) {
     throw new Error('Library index is corrupted');
   }

   const itemIndex = index.items.findIndex((item: { id: string }) => item.id === assetId);

   if (itemIndex === -1) {
     throw new Error(`Asset ${assetId} not found in library`);
   }

   // Apply updates
   index.items[itemIndex] = {
     ...index.items[itemIndex],
     ...updates
   };

   await fs.writeFile(indexPath, JSON.stringify(index, null, 2));

   return index.items[itemIndex];
 })

  /**
   * IPC handler: get-username
   *
   * Returns the system username for PII sanitization in error reports.
   * Used by error boundaries and global error handlers to remove usernames
   * from file paths in stack traces.
   *
   * @returns System username (e.g., 'johnsmith' on macOS/Linux)
   */
  ipcMain.handle('get-username', () => {
    return os.userInfo().username
  })

  /**
   * IPC handler: open-external
   *
   * Opens an external URL (mailto: or https:) in the default application.
   * Used by error reporting UI to open email clients or documentation.
   *
   * @param url - URL to open (must be mailto: or https:)
   * @returns Success status
   */
  ipcMain.handle('open-external', async (_event: IpcMainInvokeEvent, url: string) => {
    // Security: Only allow mailto: and https: URLs
    if (url.startsWith('mailto:') || url.startsWith('https:')) {
      await shell.openExternal(url)
      return true
    }
    return false
  })

  /**
   * IPC handler: save-error-report
   *
   * Saves an error report to a file using the native save dialog.
   * Used by error reporting UI to let users save error reports locally.
   *
   * @param reportContent - The error report content to save
   * @returns Success status and optional file path
   */
  ipcMain.handle('save-error-report', async (_event: IpcMainInvokeEvent, reportContent: string) => {
    try {
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
    } catch (error) {
      return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' }
    }
  })
})
