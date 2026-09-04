/**
 * Electron main process for Graphium
 *
 * This is the main process entry point for the Electron application. It handles:
 * - Window creation (Architect View and World View)
 * - IPC communication between renderer processes
 * - File I/O operations (save/load campaigns, asset storage)
 * - Custom protocol registration (media:// for assets, graphium:// for production renderer)
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
 * - 'SYNC_FROM_WORLD_VIEW': Relays scoped token-position updates to Architect
 * - 'SESSION_CONSOLE_WORLD_EVENT': Relays World Session Console status to Architect
 * - 'SAVE_ASSET_TEMP': Saves processed asset to temp directory
 * - 'SAVE_CAMPAIGN': Serializes campaign to .graphium ZIP file
 * - 'LOAD_CAMPAIGN': Deserializes .graphium file and restores assets
 * - 'SELECT_LIBRARY_PATH': Opens directory picker for library location
 * - 'SAVE_ASSET_TO_LIBRARY': Saves asset to persistent library
 * - 'LOAD_LIBRARY_INDEX': Loads library metadata index
 * - 'DELETE_LIBRARY_ASSET': Removes asset from library
 * - 'UPDATE_LIBRARY_METADATA': Updates library asset metadata
 *
 * See ARCHITECTURE.md for complete IPC documentation.
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu, session, shell } from 'electron';
import Store from 'electron-store';
import JSZip from 'jszip';

import { initializeAutoUpdater, registerAutoUpdaterHandlers } from './autoUpdater.js';
import {
  beginQuitCleanup,
  waitForCampaignWritesIdle,
  withCampaignWrite,
} from './campaignWriteGate.js';
import {
  contentTypeForMediaPath,
  contentTypeForRendererPath,
  productionRendererUrl,
  resolveGraphiumRendererPath,
  withYouTubeReferer,
  YOUTUBE_EMBED_URL_FILTER,
} from './graphiumProtocol.js';
import {
  allocateUniqueZipBasename,
  isRealPathInsideAllowedRoots,
  isValidUuid,
  mediaUrlToFilePath,
} from './pathSecurity.js';
import { registerSessionConsolePackHandlers } from './sessionConsolePackIngest.js';
import {
  initializeThemeManager,
  getThemeState,
  setThemeMode,
  type ThemeMode,
} from './themeManager.js';
import { emptySessionConsoleCatalog } from '../src/types/sessionConsole.js';
import { rewriteCampaignAssetSrcs } from '../src/utils/campaignAssets.js';
import { rewriteSafeAssetFileName } from '../src/utils/safeAssetFileName.js';
import { parseSessionConsoleWorldEvent } from '../src/utils/syncUtils.js';
import { sanitizeWorldToArchitectAction } from '../src/utils/worldViewTokenSync.js';

import type { SessionConsoleCatalog } from '../src/types/sessionConsole.js';
import type { SessionConsoleWorldEvent } from '../src/utils/syncUtils.js';
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron';

interface StoreSchema {
  windowBounds: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
}

const store = new Store<StoreSchema>();

// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Register custom protocol BEFORE app.whenReady()
// This allows media:// URLs to work in renderer process
// See app.whenReady() handler for protocol.handle() implementation
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
    },
  },
  {
    scheme: 'graphium',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..');

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

// Window references (null when closed)
let mainWindow: BrowserWindow | null;
let worldWindow: BrowserWindow | null;

// Global pause state - persists across map changes
let isGamePaused = false;
let activeSessionDir: string | null = null;
let pendingOpenFile: string | undefined;

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
function buildApplicationMenu(): void {
  const currentTheme = getThemeState().mode;

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
          label: 'New Campaign',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send('MENU_NEW_CAMPAIGN');
            }
          },
        },
        {
          label: 'Open Campaign...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send('MENU_LOAD_CAMPAIGN');
            }
          },
        },
        {
          label: 'Save Campaign',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send('MENU_SAVE_CAMPAIGN');
            }
          },
        },
        { type: 'separator' },
        process.platform === 'darwin' ? ({ role: 'close' } as const) : ({ role: 'quit' } as const),
      ],
    },

    // Insert menu
    {
      label: 'Insert',
      submenu: [
        {
          label: 'Generate Dungeon...',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send('MENU_GENERATE_DUNGEON');
            }
          },
        },
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
          click: () => createWorldWindow(),
        },
        {
          label: 'Performance Monitor',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send('MENU_TOGGLE_RESOURCE_MONITOR');
            }
          },
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
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
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
 * **Production:** `graphium://app/index.html` (privileged scheme; not `file://`).
 * **Development:** Vite `VITE_DEV_SERVER_URL` when set.
 */
function createMainWindow(): void {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width: bounds?.width || 1200,
    height: bounds?.height || 800,
    x: bounds?.x,
    y: bounds?.y,
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  });

  const saveBounds = (): void => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      store.set('windowBounds', mainWindow.getBounds());
    }
  };

  let boundsTimer: ReturnType<typeof setTimeout> | undefined;
  const debouncedSaveBounds = (): void => {
    if (boundsTimer) {
      clearTimeout(boundsTimer);
    }
    boundsTimer = setTimeout(saveBounds, 400);
  };

  mainWindow.on('resize', debouncedSaveBounds);
  mainWindow.on('move', debouncedSaveBounds);
  mainWindow.on('close', saveBounds);

  // Legacy template diagnostic event; keep it development-only to reduce noise.
  if (process.env['NODE_ENV'] === 'development') {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow?.webContents.send('main-process-message', new Date().toLocaleString());
    });
  }

  // Load renderer (Vite in development, graphium:// so YouTube embeds are not file://)
  if (VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadURL(productionRendererUrl());
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
 * IPC channel and can emit scoped token-position updates via SYNC_FROM_WORLD_VIEW,
 * while Architect View remains the source of truth.
 * See docs/architecture/IPC_API.md for canonical sync contract details.
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
function createWorldWindow(): void {
  // Singleton pattern: reuse existing window if it exists
  if (worldWindow && !worldWindow.isDestroyed()) {
    worldWindow.focus();
    return;
  }

  worldWindow = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  });

  // Load same app with ?type=world query parameter
  if (VITE_DEV_SERVER_URL) {
    void worldWindow.loadURL(`${VITE_DEV_SERVER_URL}?type=world`);
  } else {
    void worldWindow.loadURL(productionRendererUrl('type=world'));
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    mainWindow = null;
    worldWindow = null;
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Handle file association (macOS)
app.on('open-file', (_event, path) => {
  // If app is already ready, open the file
  if (app.isReady()) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Focus window and send load command
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
      // We'll need to implement a way to send this file path to the renderer
      // For now, let's store it and the renderer can poll or we send an event
      // But typically we send an IPC message if the window is ready
      mainWindow.webContents.send('OPEN_FILE_FROM_OS', path);
    }
  } else {
    // If not ready, we need to handle it on startup (process.argv handling usually covers this on other OSs)
    // But for macOS open-file event, we might need to cache it
    // For simplicity, we'll let the standard startup flow handle it if it captures it,
    // or just rely on the user re-opening if it was a cold start from file
    // Actually, capturing it here for cold start:
    pendingOpenFile = path;
  }
});

// Handle second instance (Windows/Linux)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();

      // Extract file path from command line
      const filePath = commandLine.find((arg) => arg.endsWith('.graphium'));
      if (filePath) {
        mainWindow.webContents.send('OPEN_FILE_FROM_OS', filePath);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Local types for campaign serialization (mirrors src/store/gameStore.ts
// but kept here to avoid importing from the renderer process)
// ---------------------------------------------------------------------------

interface SerializableTokenWithSrc {
  src: string;
  [key: string]: unknown;
}

interface SerializableMapBackground {
  src?: string | null;
  [key: string]: unknown;
}

interface SerializableMapData {
  id: string;
  name: string;
  tokens?: SerializableTokenWithSrc[];
  drawings?: unknown[];
  map?: SerializableMapBackground | null;
  gridSize?: number;
  gridType?: string;
  exploredRegions?: unknown[];
  isDaylightMode?: boolean;
  [key: string]: unknown;
}

interface SerializableCampaign {
  id: string;
  name: string;
  maps?: Record<string, SerializableMapData>;
  activeMapId?: string;
  tokenLibrary?: SerializableTokenWithSrc[];
  sessionConsole?: SessionConsoleCatalog;
  [key: string]: unknown;
}

interface LibraryIndex {
  items: LibraryItem[];
}

interface LibraryItem {
  id: string;
  name: string;
  category: string;
  tags: string[];
  src: string;
  thumbnailSrc: string;
  dateAdded: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// App context shared across IPC handlers
// ---------------------------------------------------------------------------

interface AppContext {
  userDataPath: string;
  tempAssetsDir: string;
  sessionsRootDir: string;
  libraryDir: string;
  libraryAssetsDir: string;
  allowedMediaRoots: string[];
}

// ---------------------------------------------------------------------------
// IPC handler implementations (extracted for function-length compliance)
// ---------------------------------------------------------------------------

function responseWithContentType(response: Response, contentType: string | undefined): Response {
  if (!contentType) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set('Content-Type', contentType);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function fetchSandboxedFile(
  filePath: string,
  allowedRoots: string[],
  contentType: string | undefined,
): Promise<Response> {
  const isWithinAllowedRoots = await isRealPathInsideAllowedRoots(filePath, allowedRoots);
  if (!isWithinAllowedRoots) {
    return new Response('Forbidden', { status: 403 });
  }
  const realTargetPath = await fs.realpath(filePath);
  const response = await net.fetch(pathToFileURL(realTargetPath).toString());
  return responseWithContentType(response, contentType);
}

/**
 * Custom media:// and graphium:// protocol handlers.
 *
 * media:// — sandboxed local assets (temp_assets, sessions, library).
 * graphium:// — production renderer origin (non-file) so YouTube embeds work.
 */
function registerCustomProtocols(allowedMediaRoots: string[]): void {
  protocol.handle('media', async (request: Request) => {
    try {
      const resolvedTargetPath = mediaUrlToFilePath(request.url);
      return await fetchSandboxedFile(
        resolvedTargetPath,
        allowedMediaRoots,
        contentTypeForMediaPath(resolvedTargetPath),
      );
    } catch {
      return new Response('Invalid media path', { status: 400 });
    }
  });

  protocol.handle('graphium', async (request: Request) => {
    const resolved = resolveGraphiumRendererPath(request.url, RENDERER_DIST);
    if (!resolved.ok) {
      const message = resolved.status === 403 ? 'Forbidden graphium path' : 'Invalid graphium path';
      return new Response(message, { status: resolved.status });
    }
    try {
      return await fetchSandboxedFile(
        resolved.filePath,
        [RENDERER_DIST],
        contentTypeForRendererPath(resolved.filePath),
      );
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });
}

// ---------------------------------------------------------------------------
// Campaign serialization helpers (module-level to avoid closure complexity)
// ---------------------------------------------------------------------------

/** Processes a single file:// asset src, copying it into the ZIP and returning relative path. */
async function processAssetForZip(
  src: string,
  allowedAssetRoots: string[],
  processedAssets: Map<string, string>,
  usedBasenames: Set<string>,
  assetsFolder: JSZip | null,
): Promise<string> {
  if (!src.startsWith('file://')) {
    return src;
  }
  const absolutePath = fileURLToPath(src);
  const resolvedAssetPath = path.resolve(absolutePath);

  let realAssetPath: string;
  try {
    realAssetPath = await fs.realpath(resolvedAssetPath);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (code === 'ENOENT') {
      throw new Error(`Campaign asset file not found: ${path.basename(resolvedAssetPath)}`);
    }
    throw error;
  }

  const isWithinAllowedRoots = await isRealPathInsideAllowedRoots(realAssetPath, allowedAssetRoots);
  if (!isWithinAllowedRoots) {
    throw new Error(
      `Campaign asset is outside allowed directories: ${path.basename(resolvedAssetPath)}`,
    );
  }

  const cached = processedAssets.get(realAssetPath);
  if (cached !== undefined) {
    return cached;
  }

  const zipBasename = allocateUniqueZipBasename(realAssetPath, usedBasenames);
  const content = await fs.readFile(realAssetPath);
  assetsFolder?.file(zipBasename, content);
  const relativePath = `assets/${zipBasename}`;
  processedAssets.set(realAssetPath, relativePath);
  return relativePath;
}

/** Serializes all campaign assets into a ZIP, replacing file:// srcs with relative paths. */
async function serializeCampaignToZip(
  campaign: SerializableCampaign,
  zip: JSZip,
  allowedAssetRoots: string[],
): Promise<SerializableCampaign> {
  const assetsFolder = zip.folder('assets');
  const campaignToSave = JSON.parse(JSON.stringify(campaign)) as SerializableCampaign;
  const processedAssets = new Map<string, string>();
  const usedBasenames = new Set<string>();

  const processAsset = async (src: string): Promise<string> =>
    processAssetForZip(src, allowedAssetRoots, processedAssets, usedBasenames, assetsFolder);

  await rewriteCampaignAssetSrcs(campaignToSave, processAsset, { includeThumbnails: true });
  return campaignToSave;
}

async function writeCampaignZip(
  filePath: string,
  campaign: SerializableCampaign,
  allowedAssetRoots: string[],
  options: { atomic: boolean },
): Promise<void> {
  const zip = new JSZip();
  const campaignToSave = await serializeCampaignToZip(campaign, zip, allowedAssetRoots);
  zip.file('manifest.json', JSON.stringify(campaignToSave));
  const content = await zip.generateAsync({ type: 'nodebuffer' });
  if (options.atomic) {
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, content);
    await fs.rename(tempPath, filePath);
    return;
  }
  await fs.writeFile(filePath, content);
}

/** Migrates a legacy single-map GameState to the modern Campaign structure. */
function migrateLegacyCampaign(legacy: {
  tokens?: SerializableTokenWithSrc[];
  drawings?: unknown[];
  map?: SerializableMapBackground | null;
  gridSize?: number;
  gridType?: string;
  exploredRegions?: unknown[];
  isDaylightMode?: boolean;
  [key: string]: unknown;
}): SerializableCampaign {
  const mapId = randomUUID();
  const mapData: SerializableMapData = {
    id: mapId,
    name: 'Imported Map',
    tokens: legacy.tokens ?? [],
    drawings: legacy.drawings ?? [],
    map: legacy.map ?? null,
    gridSize: legacy.gridSize ?? 50,
    gridType: legacy.gridType ?? 'LINES',
    exploredRegions: legacy.exploredRegions ?? [],
    isDaylightMode: legacy.isDaylightMode ?? false,
  };
  return {
    id: randomUUID(),
    name: 'Imported Campaign',
    maps: { [mapId]: mapData },
    activeMapId: mapId,
    tokenLibrary: [],
    sessionConsole: emptySessionConsoleCatalog('Imported Campaign'),
  };
}

/** Restores relative asset paths in a campaign to absolute file:// URLs. */
async function restoreCampaignAssets(
  campaign: SerializableCampaign,
  assetsZipFolder: JSZip,
  assetsDir: string,
): Promise<void> {
  await fs.mkdir(assetsDir, { recursive: true });

  const restoreAsset = async (src: string): Promise<string> => {
    if (src?.startsWith('assets/')) {
      const fileName = path.basename(src);
      const fileData = await assetsZipFolder.file(fileName)?.async('nodebuffer');
      if (fileData) {
        const destPath = path.join(assetsDir, fileName);
        await fs.writeFile(destPath, fileData);
        return `file://${destPath}`;
      }
    }
    return src;
  };

  await rewriteCampaignAssetSrcs(campaign, restoreAsset, { includeThumbnails: true });
}

// ---------------------------------------------------------------------------
// Library index helpers
// ---------------------------------------------------------------------------

/** Parses a raw unknown value as a LibraryIndex, or returns a fresh empty index. */
function parseLibraryIndex(raw: unknown, warnOnBadStructure = false): LibraryIndex {
  if (
    raw !== null &&
    typeof raw === 'object' &&
    'items' in raw &&
    Array.isArray((raw as LibraryIndex).items)
  ) {
    return raw as LibraryIndex;
  }
  if (warnOnBadStructure) {
    console.warn('[MAIN] Invalid index.json structure, resetting');
  }
  return { items: [] };
}

// ---------------------------------------------------------------------------
// IPC handler registration (split into focused helpers for line-count compliance)
// ---------------------------------------------------------------------------

/** Registers campaign-related IPC handlers (SAVE_ASSET_TEMP, SAVE/AUTO_SAVE/LOAD_CAMPAIGN). */
function registerCampaignHandlers(ctx: AppContext): void {
  const { tempAssetsDir, sessionsRootDir, allowedMediaRoots } = ctx;
  let currentCampaignPath: string | null = null;

  ipcMain.handle(
    'SAVE_ASSET_TEMP',
    async (_event: IpcMainInvokeEvent, buffer: ArrayBuffer, name: string) => {
      await fs.mkdir(tempAssetsDir, { recursive: true });
      const safeName = rewriteSafeAssetFileName(name);
      const fileName = `${Date.now()}-${safeName}`;
      const filePath = path.join(tempAssetsDir, fileName);
      await fs.writeFile(filePath, Buffer.from(buffer));
      return `file://${filePath}`;
    },
  );

  ipcMain.handle(
    'SAVE_CAMPAIGN',
    async (_event: IpcMainInvokeEvent, campaign: SerializableCampaign) => {
      const { canceled, filePath } = await dialog.showSaveDialog({
        filters: [{ name: 'Graphium Campaign', extensions: ['graphium'] }],
      });
      if (canceled || !filePath) {
        return false;
      }
      return withCampaignWrite(async () => {
        currentCampaignPath = filePath;
        await writeCampaignZip(filePath, campaign, allowedMediaRoots, { atomic: false });
        return true;
      });
    },
  );

  ipcMain.handle(
    'AUTO_SAVE',
    async (_event: IpcMainInvokeEvent, campaign: SerializableCampaign) => {
      const targetPath = currentCampaignPath;
      if (!targetPath) {
        return false;
      }
      try {
        return await withCampaignWrite(async () => {
          await writeCampaignZip(targetPath, campaign, allowedMediaRoots, { atomic: true });
          return true;
        });
      } catch (err) {
        console.error('Auto-save failed:', err);
        return false;
      }
    },
  );

  ipcMain.handle('LOAD_CAMPAIGN', async () => {
    const { filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'Graphium Campaign', extensions: ['graphium'] }],
    });
    if (filePaths.length === 0) {
      return null;
    }
    const selectedPath = filePaths[0];
    if (!selectedPath) {
      return null;
    }
    currentCampaignPath = selectedPath;

    const zipContent = await fs.readFile(selectedPath);
    const zip = await JSZip.loadAsync(zipContent);

    const sessionDir = path.join(sessionsRootDir, Date.now().toString());
    activeSessionDir = sessionDir;
    await fs.mkdir(sessionDir, { recursive: true });

    const manifestStr = await zip.file('manifest.json')?.async('string');
    if (!manifestStr) {
      throw new Error('Invalid Graphium file');
    }

    type LegacyGameState = {
      maps?: undefined;
      tokens?: SerializableTokenWithSrc[];
      drawings?: unknown[];
      map?: SerializableMapBackground | null;
      gridSize?: number;
      gridType?: string;
      exploredRegions?: unknown[];
      isDaylightMode?: boolean;
      [key: string]: unknown;
    };

    const loadedData = JSON.parse(manifestStr) as SerializableCampaign | LegacyGameState;
    const campaign: SerializableCampaign = loadedData.maps
      ? loadedData
      : migrateLegacyCampaign(loadedData);

    const assets = zip.folder('assets');
    if (assets) {
      await restoreCampaignAssets(campaign, assets, path.join(sessionDir, 'assets'));
    }

    return campaign;
  });
}

/** Registers library-related IPC handlers (SAVE/LOAD/DELETE/UPDATE library assets). */
function registerLibraryHandlers(ctx: AppContext): void {
  const { libraryDir, libraryAssetsDir } = ctx;

  ipcMain.handle(
    'SAVE_ASSET_TO_LIBRARY',
    async (
      _event: IpcMainInvokeEvent,
      {
        fullSizeBuffer,
        thumbnailBuffer,
        metadata,
      }: {
        fullSizeBuffer: ArrayBuffer;
        thumbnailBuffer: ArrayBuffer;
        metadata: { id: string; name: string; category: string; tags: string[] };
      },
    ) => {
      if (!isValidUuid(metadata.id)) {
        throw new Error('Invalid asset ID');
      }
      await fs.mkdir(libraryAssetsDir, { recursive: true });
      const fullPath = path.join(libraryAssetsDir, `${metadata.id}.webp`);
      await fs.writeFile(fullPath, Buffer.from(fullSizeBuffer));
      const thumbPath = path.join(libraryAssetsDir, `thumb-${metadata.id}.webp`);
      await fs.writeFile(thumbPath, Buffer.from(thumbnailBuffer));

      const indexPath = path.join(libraryDir, 'index.json');
      let index: LibraryIndex = { items: [] };
      try {
        const raw: unknown = JSON.parse(await fs.readFile(indexPath, 'utf-8'));
        index = parseLibraryIndex(raw, true);
      } catch {
        // index does not exist yet
      }

      const newItem: LibraryItem = {
        ...metadata,
        src: `file://${fullPath}`,
        thumbnailSrc: `file://${thumbPath}`,
        dateAdded: Date.now(),
      };
      index.items.push(newItem);
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
      return newItem;
    },
  );

  ipcMain.handle('LOAD_LIBRARY_INDEX', async (): Promise<LibraryItem[]> => {
    const indexPath = path.join(libraryDir, 'index.json');
    try {
      const raw: unknown = JSON.parse(await fs.readFile(indexPath, 'utf-8'));
      return parseLibraryIndex(raw).items;
    } catch {
      return [];
    }
  });

  ipcMain.handle('DELETE_LIBRARY_ASSET', async (_event: IpcMainInvokeEvent, assetId: string) => {
    if (!isValidUuid(assetId)) {
      throw new Error('Invalid asset ID');
    }
    try {
      await fs.unlink(path.join(libraryAssetsDir, `${assetId}.webp`));
      await fs.unlink(path.join(libraryAssetsDir, `thumb-${assetId}.webp`));
    } catch (err) {
      console.error('[MAIN] Failed to delete library asset files:', err);
    }
    const indexPath = path.join(libraryDir, 'index.json');
    try {
      const raw: unknown = JSON.parse(await fs.readFile(indexPath, 'utf-8'));
      const index = parseLibraryIndex(raw, true);
      index.items = index.items.filter((item) => item.id !== assetId);
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    } catch (err) {
      console.error('[MAIN] Failed to update library index:', err);
      throw err;
    }
    return true;
  });

  ipcMain.handle(
    'UPDATE_LIBRARY_METADATA',
    async (
      _event: IpcMainInvokeEvent,
      assetId: string,
      updates: { name?: string; category?: string; tags?: string[] },
    ) => {
      if (!isValidUuid(assetId)) {
        throw new Error('Invalid asset ID');
      }
      const indexPath = path.join(libraryDir, 'index.json');
      const raw: unknown = JSON.parse(await fs.readFile(indexPath, 'utf-8'));
      if (
        raw === null ||
        typeof raw !== 'object' ||
        !('items' in raw) ||
        !Array.isArray((raw as LibraryIndex).items)
      ) {
        throw new Error('Library index is corrupted');
      }
      const index = raw as LibraryIndex;
      const itemIndex = index.items.findIndex((item) => item.id === assetId);
      if (itemIndex === -1) {
        throw new Error(`Asset ${assetId} not found in library`);
      }
      const existing = index.items[itemIndex];
      if (!existing) {
        throw new Error(`Asset ${assetId} not found in library`);
      }
      const updated: LibraryItem = {
        ...existing,
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.category !== undefined && { category: updates.category }),
        ...(updates.tags !== undefined && { tags: updates.tags }),
      };
      index.items[itemIndex] = updated;
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
      return updated;
    },
  );
}

/** Registers misc IPC handlers (theme, pause, library path, error reporting, username). */
function registerMiscHandlers(): void {
  ipcMain.handle('get-theme-state', () => getThemeState());

  ipcMain.handle('set-theme-mode', (_event: IpcMainInvokeEvent, mode: ThemeMode) => {
    setThemeMode(mode);
  });

  ipcMain.handle('TOGGLE_PAUSE', () => {
    isGamePaused = !isGamePaused;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('PAUSE_STATE_CHANGED', isGamePaused);
    }
    if (worldWindow && !worldWindow.isDestroyed()) {
      worldWindow.webContents.send('PAUSE_STATE_CHANGED', isGamePaused);
    }
    return isGamePaused;
  });

  ipcMain.handle('GET_PAUSE_STATE', () => isGamePaused);

  ipcMain.handle('SELECT_LIBRARY_PATH', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Token Library Location',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('get-username', () => os.userInfo().username);

  ipcMain.handle('open-external', async (_event: IpcMainInvokeEvent, url: string) => {
    if (url.startsWith('mailto:') || url.startsWith('https:')) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });

  ipcMain.handle('save-error-report', async (_event: IpcMainInvokeEvent, reportContent: string) => {
    try {
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Save Error Report',
        defaultPath: `graphium-error-report-${Date.now()}.txt`,
        filters: [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (canceled || !filePath) {
        return { success: false, reason: 'User canceled' };
      }
      await fs.writeFile(filePath, reportContent, 'utf-8');
      return { success: true, filePath };
    } catch (error) {
      return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}

/**
 * App initialization: Set up protocol handlers and IPC listeners
 *
 * This runs once when Electron is ready (after app launch). It registers:
 * - Custom media:// protocol handler
 * - IPC handlers for all renderer→main communication
 * - Main window creation
 */
void app.whenReady().then((): void => {
  const userDataPath = app.getPath('userData');
  const tempAssetsDir = path.join(userDataPath, 'temp_assets');
  const sessionsRootDir = path.join(userDataPath, 'sessions');
  const libraryDir = path.join(userDataPath, 'library');
  const libraryAssetsDir = path.join(libraryDir, 'assets');
  const allowedMediaRoots = [tempAssetsDir, sessionsRootDir, libraryDir];

  const ctx: AppContext = {
    userDataPath,
    tempAssetsDir,
    sessionsRootDir,
    libraryDir,
    libraryAssetsDir,
    allowedMediaRoots,
  };

  /**
   * Custom protocol handlers:
   * - media:// — sandboxed local assets (see registerCustomProtocols)
   * - graphium:// — production renderer files from RENDERER_DIST (non-file origin)
   */
  registerCustomProtocols(allowedMediaRoots);
  session.defaultSession.webRequest.onBeforeSendHeaders(
    YOUTUBE_EMBED_URL_FILTER,
    (details, callback) => {
      callback({ requestHeaders: withYouTubeReferer(details.requestHeaders) });
    },
  );

  // Initialize theme system (must be before window creation)
  initializeThemeManager();

  // Build application menu with theme options
  buildApplicationMenu();

  // Register auto-updater IPC handlers
  registerAutoUpdaterHandlers();

  createMainWindow();

  // Initialize auto-updater after window is created
  initializeAutoUpdater(mainWindow);

  // Check for cold-start file open (macOS)
  if (pendingOpenFile && mainWindow) {
    const fileToOpen = pendingOpenFile;
    pendingOpenFile = undefined;
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow?.webContents.send('OPEN_FILE_FROM_OS', fileToOpen);
    });
  }

  // Check for cold-start file open (Windows/Linux)
  const argvFile = process.argv.find((arg) => arg.endsWith('.graphium'));
  if (argvFile && mainWindow) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow?.webContents.send('OPEN_FILE_FROM_OS', argvFile);
    });
  }

  // IPC: create-world-window
  ipcMain.on('create-world-window', createWorldWindow);

  // IPC: REQUEST_INITIAL_STATE — relay request to Architect View
  ipcMain.on('REQUEST_INITIAL_STATE', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('REQUEST_INITIAL_STATE');
    }
  });

  // IPC: SYNC_FROM_WORLD_VIEW — relay scoped token-position updates to Architect View
  ipcMain.on('SYNC_FROM_WORLD_VIEW', (_event: IpcMainEvent, action: unknown) => {
    const sanitized = sanitizeWorldToArchitectAction(action);
    if (!sanitized || !mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send('SYNC_WORLD_STATE', sanitized);
  });

  // IPC: SESSION_CONSOLE_WORLD_EVENT — World status only (armed/unarmed/ready/error)
  ipcMain.on('SESSION_CONSOLE_WORLD_EVENT', (_event: IpcMainEvent, raw: unknown) => {
    const parsed: SessionConsoleWorldEvent | null = parseSessionConsoleWorldEvent(raw);
    if (!parsed || !mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send('SESSION_CONSOLE_WORLD_EVENT', parsed);
  });

  // IPC: SYNC_WORLD_STATE — broadcast Architect state to World View
  ipcMain.on('SYNC_WORLD_STATE', (_event: IpcMainEvent, state: unknown) => {
    const actionType =
      state && typeof state === 'object' && 'type' in state && typeof state.type === 'string'
        ? state.type
        : 'unknown';
    if (process.env['NODE_ENV'] === 'development') {
      console.log(
        `[Main Process] SYNC_WORLD_STATE received (${actionType}), relaying to World View`,
      );
    }
    if (worldWindow && !worldWindow.isDestroyed()) {
      worldWindow.webContents.send('SYNC_WORLD_STATE', state);
    } else if (process.env['NODE_ENV'] === 'development') {
      console.warn('[Main Process] Cannot send SYNC_WORLD_STATE - World View window not available');
    }
  });

  // Handler for renderer logs — development only
  if (process.env['NODE_ENV'] === 'development') {
    ipcMain.on('LOG_TO_TERMINAL', (_event: IpcMainEvent, message: string) => {
      console.log(message);
    });
  }

  registerCampaignHandlers(ctx);
  registerLibraryHandlers(ctx);
  registerSessionConsolePackHandlers(ctx);
  registerMiscHandlers();

  let didRunQuitCleanup = false;
  app.on('before-quit', (event) => {
    if (didRunQuitCleanup) {
      return;
    }
    event.preventDefault();
    beginQuitCleanup();

    const cleanupEntries = async (
      directory: string,
      keepDirectory: string | null = null,
    ): Promise<void> => {
      const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
      await Promise.all(
        entries.map(async (entry) => {
          const entryPath = path.join(directory, entry.name);
          if (keepDirectory && path.resolve(entryPath) === path.resolve(keepDirectory)) {
            return;
          }
          await fs.rm(entryPath, { recursive: true, force: true });
        }),
      );
    };

    void (async (): Promise<void> => {
      try {
        // Wait for in-flight SAVE_CAMPAIGN / AUTO_SAVE so they finish reading temp_assets.
        await waitForCampaignWritesIdle();
        await cleanupEntries(tempAssetsDir);
        await cleanupEntries(sessionsRootDir, activeSessionDir);
      } finally {
        didRunQuitCleanup = true;
        app.quit();
      }
    })();
  });
});
