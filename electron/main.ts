import { app, BrowserWindow, ipcMain, dialog, protocol, net, shell } from 'electron'
import os from 'node:os'
import JSZip from 'jszip'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { secure: true, supportFetchAPI: true, bypassCSP: true } }
])

// ==================== Main Process Error Handling ====================

/**
 * Sanitizes main process errors by removing the username from paths
 */
function sanitizeMainProcessError(error: Error): { name: string; message: string; stack: string } {
  const username = os.userInfo().username
  const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Patterns to sanitize username from paths
  const unixPathPattern = new RegExp(`(/(?:Users|home)/)${escapedUsername}(/|$)`, 'gi')
  const windowsPathPattern = new RegExp(
    `([A-Za-z]:[/\\\\](?:Users|Documents and Settings)[/\\\\])${escapedUsername}([/\\\\]|$)`,
    'gi'
  )
  const genericPattern = new RegExp(`([\\\\/])${escapedUsername}([\\\\/])`, 'gi')

  const sanitize = (text: string): string => {
    return text
      .replace(unixPathPattern, '$1<USER>$2')
      .replace(windowsPathPattern, '$1<USER>$2')
      .replace(genericPattern, '$1<USER>$2')
  }

  return {
    name: error.name || 'Error',
    message: sanitize(error.message || 'Unknown error'),
    stack: sanitize(error.stack || ''),
  }
}

/**
 * Sends sanitized error to renderer process
 */
function sendErrorToRenderer(error: Error, source: string): void {
  const sanitizedError = sanitizeMainProcessError(error)
  const allWindows = BrowserWindow.getAllWindows()

  allWindows.forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('main-process-error', {
        ...sanitizedError,
        source,
        timestamp: new Date().toISOString(),
      })
    }
  })
}

// Handle uncaught exceptions in main process
process.on('uncaughtException', (error) => {
  console.error('Main process uncaught exception:', error)
  sendErrorToRenderer(error, 'main-uncaught')
})

// Handle unhandled promise rejections in main process
process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason))
  console.error('Main process unhandled rejection:', error)
  sendErrorToRenderer(error, 'main-promise')
})

// ==================================================================

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

let mainWindow: BrowserWindow | null
let worldWindow: BrowserWindow | null

function createMainWindow() {
  mainWindow = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function createWorldWindow() {
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

app.whenReady().then(() => {
  protocol.handle('media', (request) => {
    return net.fetch('file://' + request.url.slice('media://'.length))
  })

  createMainWindow()
  ipcMain.on('create-world-window', createWorldWindow)

  // Error reporting IPC handlers
  ipcMain.handle('get-username', () => {
    return os.userInfo().username
  })

  ipcMain.handle('open-external', async (_event, url: string) => {
    // Only allow mailto: and https: URLs for security
    if (url.startsWith('mailto:') || url.startsWith('https:')) {
      await shell.openExternal(url)
      return true
    }
    return false
  })

  ipcMain.handle('save-error-report', async (_event, reportContent: string) => {
    try {
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Save Error Report',
        defaultPath: `hyle-error-report-${Date.now()}.txt`,
        filters: [{ name: 'Text Files', extensions: ['txt'] }],
      })

      if (canceled || !filePath) {
        return { success: false, reason: 'canceled' }
      }

      await fs.writeFile(filePath, reportContent, 'utf-8')
      return { success: true, filePath }
    } catch (error) {
      console.error('Failed to save error report:', error)
      return { success: false, reason: 'write-failed' }
    }
  })
  ipcMain.on('SYNC_WORLD_STATE', (_event, state) => {
    if (worldWindow && !worldWindow.isDestroyed()) {
        worldWindow.webContents.send('SYNC_WORLD_STATE', state)
    }
  })

  ipcMain.handle('SAVE_ASSET_TEMP', async (_event, buffer: ArrayBuffer, name: string) => {
    const tempDir = path.join(app.getPath('userData'), 'temp_assets');
    await fs.mkdir(tempDir, { recursive: true });
    const fileName = `${Date.now()}-${name}`;
    const filePath = path.join(tempDir, fileName);
    await fs.writeFile(filePath, Buffer.from(buffer));
    return `file://${filePath}`;
  })

  ipcMain.handle('SAVE_CAMPAIGN', async (_event, gameState: any) => {
    const { filePath } = await dialog.showSaveDialog({ filters: [{ name: 'Hyle Campaign', extensions: ['hyle'] }] });
    if (!filePath) return false;

    const zip = new JSZip();
    const assetsFolder = zip.folder("assets");

    const stateToSave = JSON.parse(JSON.stringify(gameState));

    // Save tokens assets
    for (const token of stateToSave.tokens) {
       if (token.src.startsWith('file://')) {
           const absolutePath = fileURLToPath(token.src);
           const basename = path.basename(absolutePath);
           const content = await fs.readFile(absolutePath);
           assetsFolder?.file(basename, content);
           token.src = `assets/${basename}`;
       }
    }

    // Save library assets if implemented later

    zip.file("manifest.json", JSON.stringify(stateToSave));

    const content = await zip.generateAsync({ type: "nodebuffer" });
    await fs.writeFile(filePath, content);
    return true;
 });

 ipcMain.handle('LOAD_CAMPAIGN', async () => {
    const { filePaths } = await dialog.showOpenDialog({ filters: [{ name: 'Hyle Campaign', extensions: ['hyle'] }] });
    if (filePaths.length === 0) return null;

    const zipContent = await fs.readFile(filePaths[0]);
    const zip = await JSZip.loadAsync(zipContent);

    const sessionDir = path.join(app.getPath('userData'), 'sessions', Date.now().toString());
    await fs.mkdir(sessionDir, { recursive: true });

    const manifestStr = await zip.file("manifest.json")?.async("string");
    if (!manifestStr) throw new Error("Invalid Hyle file");

    const state = JSON.parse(manifestStr);

    const assets = zip.folder("assets");
    if (assets) {
        const assetsDir = path.join(sessionDir, 'assets');
        await fs.mkdir(assetsDir, { recursive: true });

        // Restore token assets
        for (const token of state.tokens) {
            if (token.src.startsWith('assets/')) {
                const relativePath = token.src;
                const fileName = path.basename(relativePath);
                const fileData = await assets.file(fileName)?.async("nodebuffer");
                if (fileData) {
                    const destPath = path.join(assetsDir, fileName);
                    await fs.writeFile(destPath, fileData);
                    token.src = `file://${destPath}`;
                }
            }
        }
    }

    return state;
 });
})
