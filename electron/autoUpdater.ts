/**
 * Auto-updater module for Graphium
 *
 * Handles automatic application updates via GitHub Releases using electron-updater.
 * Provides IPC communication bridge for renderer process to check, download, and install updates.
 *
 * **Update workflow:**
 * 1. Renderer requests update check → checkForUpdates()
 * 2. If update available → autoUpdater emits 'update-available'
 * 3. Renderer can start download → downloadUpdate()
 * 4. Download progress → autoUpdater emits 'download-progress'
 * 5. Download complete → autoUpdater emits 'update-downloaded'
 * 6. Renderer requests restart → quitAndInstall()
 *
 * **Security notes:**
 * - Updates are downloaded from GitHub Releases only
 * - Signature verification is automatic (requires code signing in production)
 * - autoDownload is disabled to give user control over when to download
 *
 * **Development mode:**
 * - Updates are disabled when running from source (isDev check)
 * - Use dev-app-update.yml for local testing if needed
 */

import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { app, BrowserWindow, ipcMain } from 'electron';

// Configure logging for production debugging
// Logs are written to ~/Library/Logs/Graphium/main.log (macOS)
// or %USERPROFILE%\AppData\Roaming\Graphium\logs\main.log (Windows)
log.transports.file.level = 'info';
autoUpdater.logger = log;

// Disable auto-download to give user control
autoUpdater.autoDownload = false;

// Auto-install on app quit (when user chooses to restart)
autoUpdater.autoInstallOnAppQuit = true;

// Check if running in development mode
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

/**
 * Initialize auto-updater system
 *
 * Sets up event listeners and IPC handlers for update workflow.
 * Call this once from main.ts after app.whenReady().
 *
 * @param mainWindow - Reference to main application window for sending IPC events
 */
export function initializeAutoUpdater(mainWindow: BrowserWindow | null) {
  // Skip auto-updater in development mode
  if (isDev) {
    log.info('[AutoUpdater] Running in development mode, updates disabled');
    return;
  }

  /**
   * Safely send IPC message to main window
   * Checks if window exists and webContents is not destroyed before sending
   */
  const safeSend = (channel: string, ...args: unknown[]) => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send(channel, ...args);
    } else {
      log.warn(`[AutoUpdater] Cannot send IPC event '${channel}': window is destroyed or unavailable`);
    }
  };

  // ============================================
  // Auto-updater event listeners
  // ============================================

  /**
   * Event: checking-for-update
   * Fired when update check starts
   */
  autoUpdater.on('checking-for-update', () => {
    log.info('[AutoUpdater] Checking for updates...');
    safeSend('auto-updater:checking-for-update');
  });

  /**
   * Event: update-available
   * Fired when a new version is available
   */
  autoUpdater.on('update-available', (info) => {
    log.info('[AutoUpdater] Update available:', info.version);
    safeSend('auto-updater:update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
      releaseDate: info.releaseDate,
    });
  });

  /**
   * Event: update-not-available
   * Fired when no new version is available
   */
  autoUpdater.on('update-not-available', (info) => {
    log.info('[AutoUpdater] No update available. Current version:', info.version);
    safeSend('auto-updater:update-not-available', {
      version: info.version,
    });
  });

  /**
   * Event: download-progress
   * Fired during download with progress information
   */
  autoUpdater.on('download-progress', (progress) => {
    log.info(
      `[AutoUpdater] Download progress: ${progress.percent.toFixed(2)}% (${progress.transferred}/${progress.total})`
    );
    safeSend('auto-updater:download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  /**
   * Event: update-downloaded
   * Fired when update is fully downloaded and ready to install
   */
  autoUpdater.on('update-downloaded', (info) => {
    log.info('[AutoUpdater] Update downloaded:', info.version);
    safeSend('auto-updater:update-downloaded', {
      version: info.version,
    });
  });

  /**
   * Event: error
   * Fired when an error occurs during update process
   */
  autoUpdater.on('error', (error) => {
    log.error('[AutoUpdater] Error:', error);
    safeSend('auto-updater:error', {
      message: error.message,
    });
  });

  log.info('[AutoUpdater] Initialized successfully');
}

/**
 * Register IPC handlers for renderer to control updates
 *
 * Exposes methods for checking, downloading, and installing updates.
 * Call this once from main.ts after app.whenReady().
 */
export function registerAutoUpdaterHandlers() {
  /**
   * IPC handler: check-for-updates
   * Initiates update check against GitHub Releases
   */
  ipcMain.handle('check-for-updates', async () => {
    if (isDev) {
      log.info('[AutoUpdater] Skipping update check in development mode');
      return {
        available: false,
        reason: 'Development mode',
      };
    }

    try {
      const result = await autoUpdater.checkForUpdates();
      return {
        available: result?.updateInfo ? true : false,
        updateInfo: result?.updateInfo,
      };
    } catch (error) {
      log.error('[AutoUpdater] Failed to check for updates:', error);
      throw error;
    }
  });

  /**
   * IPC handler: download-update
   * Starts downloading the available update
   */
  ipcMain.handle('download-update', async () => {
    if (isDev) {
      log.info('[AutoUpdater] Skipping download in development mode');
      return false;
    }

    try {
      await autoUpdater.downloadUpdate();
      return true;
    } catch (error) {
      log.error('[AutoUpdater] Failed to download update:', error);
      throw error;
    }
  });

  /**
   * IPC handler: quit-and-install
   * Quits app and installs the downloaded update
   */
  ipcMain.handle('quit-and-install', () => {
    if (isDev) {
      log.info('[AutoUpdater] Skipping install in development mode');
      return false;
    }

    // This will quit the app and install the update
    autoUpdater.quitAndInstall(false, true);
    return true;
  });

  /**
   * IPC handler: get-current-version
   * Returns the current application version
   */
  ipcMain.handle('get-current-version', () => {
    return app.getVersion();
  });

  log.info('[AutoUpdater] IPC handlers registered');
}

/**
 * Unregister IPC handlers for auto-updater
 *
 * Useful during development or hot-reload to prevent duplicate handlers
 * and potential memory leaks. Call this during app shutdown or before re-registration.
 * 
 * Note: Currently exported for future hot-reload support. Not yet implemented in the
 * main application lifecycle, but available for development/testing scenarios.
 */
export function unregisterAutoUpdaterHandlers() {
  ipcMain.removeHandler('check-for-updates');
  ipcMain.removeHandler('download-update');
  ipcMain.removeHandler('quit-and-install');
  ipcMain.removeHandler('get-current-version');

  log.info('[AutoUpdater] IPC handlers unregistered');
}
