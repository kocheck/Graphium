/**
 * Electron preload script for Graphium
 *
 * This script runs in a privileged context BEFORE the renderer process loads.
 * It uses Electron's Context Bridge to safely expose IPC APIs to the renderer
 * (React app) without giving full access to Node.js APIs.
 *
 * **Security pattern:**
 * - Renderer process is sandboxed (no direct Node.js access)
 * - Preload script has Node.js access (can use ipcRenderer)
 * - Context Bridge creates a controlled API surface (window.ipcRenderer)
 * - Renderer can only call whitelisted IPC methods
 *
 * **Exposed API:**
 * ```typescript
 * window.ipcRenderer.on(channel, listener)     // Subscribe to IPC events
 * window.ipcRenderer.off(channel, listener)    // Unsubscribe from IPC events
 * window.ipcRenderer.removeAllListeners(channel) // Remove all listeners for channel
 * window.ipcRenderer.send(channel, ...args)    // Send one-way IPC message
 * window.ipcRenderer.invoke(channel, ...args)  // Send IPC request, await response
 * ```
 *
 * **Why this is secure:**
 * - No eval() or arbitrary code execution
 * - No access to require() or Node.js modules
 * - IPC channels are validated by main process handlers
 * - No file system access (must use IPC handlers in main process)
 *
 * See electron/main.ts for IPC handler implementations.
 */

import { ipcRenderer, contextBridge, IpcRendererEvent } from 'electron'

// Map to store original listeners -> wrapper listeners
// This is needed because we wrap listeners in on(), so we need the wrapper reference for off()
// Using Map instead of WeakMap since function references may be created inline
type IpcRendererListener = Parameters<typeof ipcRenderer.on>[1];
const listenerMap = new Map<
  IpcRendererListener,
  (event: IpcRendererEvent, ...args: unknown[]) => void
>();

/**
 * Expose IPC APIs to renderer process via Context Bridge
 *
 * Creates a global window.ipcRenderer object that React components can use
 * to communicate with the main process. This API surface is intentionally
 * limited to prevent security vulnerabilities.
 */
contextBridge.exposeInMainWorld('ipcRenderer', {
  /**
   * Subscribe to IPC events from main process
   *
   * Used by World Window to receive state updates (see SyncManager.tsx:85).
   *
   * @param channel - IPC channel name (e.g., 'SYNC_WORLD_STATE')
   * @param listener - Callback fired when event is received
   * @returns IPC listener reference (for cleanup via off())
   */
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args

    // Create a wrapper that we can look up later
    const wrapper = (event: IpcRendererEvent, ...args: unknown[]) => listener(event, ...args)
    listenerMap.set(listener, wrapper)

    return ipcRenderer.on(channel, wrapper)
  },

  /**
   * Unsubscribe from IPC events
   *
   * Removes event listener to prevent memory leaks.
   *
   * @param channel - IPC channel name
   * @param listener - Listener to remove (must be same reference as passed to on())
   */
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, listener] = args
    const wrapper = listenerMap.get(listener)

    if (wrapper) {
      listenerMap.delete(listener)
      return ipcRenderer.off(channel, wrapper)
    }

    // Fallback: try removing listener directly (unlikely to work if wrapped, but safe)
    return ipcRenderer.off(channel, listener)
  },

  /**
   * Remove all listeners for a channel
   *
   * Useful for cleanup when unmounting components.
   *
   * @param channel - IPC channel name
   */
  removeAllListeners(channel: string) {
    return ipcRenderer.removeAllListeners(channel)
  },

  /**
   * Send one-way IPC message to main process
   *
   * Fire-and-forget pattern (no response expected).
   *
   * @param channel - IPC channel name (e.g., 'create-world-window', 'SYNC_WORLD_STATE')
   * @param args - Arguments to pass to main process handler
   */
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },

  /**
   * Send IPC request and await response from main process
   *
   * Request-response pattern (Promise-based).
   *
   * @param channel - IPC channel name (e.g., 'SAVE_CAMPAIGN', 'LOAD_CAMPAIGN', 'SAVE_ASSET_TEMP')
   * @param args - Arguments to pass to main process handler
   * @returns Promise resolving to handler's return value
   */
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

// --------- Theme API ---------
contextBridge.exposeInMainWorld('themeAPI', {
  /**
   * Get current theme state
   * @returns {mode: 'light'|'dark'|'system', effectiveTheme: 'light'|'dark'}
   */
  getThemeState: (): Promise<{ mode: string; effectiveTheme: string }> =>
    ipcRenderer.invoke('get-theme-state'),

  /**
   * Set theme mode
   * @param mode - 'light', 'dark', or 'system'
   */
  setThemeMode: (mode: string): Promise<void> =>
    ipcRenderer.invoke('set-theme-mode', mode),

  /**
   * Listen for theme changes from main process
   * @param callback - Called when theme changes
   * @returns Cleanup function
   */
  onThemeChanged: (callback: (data: { mode: string; effectiveTheme: string }) => void) => {
    const listener = (_event: IpcRendererEvent, data: { mode: string; effectiveTheme: string }) => callback(data)
    ipcRenderer.on('theme-changed', listener)

    // Return cleanup function
    return () => {
      ipcRenderer.off('theme-changed', listener)
    }
  },
})

// --------- Error Reporting API ---------
contextBridge.exposeInMainWorld('errorReporting', {
  /**
   * Get the system username for PII sanitization
   */
  getUsername: (): Promise<string> => ipcRenderer.invoke('get-username'),

  /**
   * Open an external URL (mailto: or https:) in the default application
   */
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('open-external', url),

  /**
   * Save error report to a file using native save dialog
   */
  saveToFile: (reportContent: string): Promise<{ success: boolean; filePath?: string; reason?: string }> =>
    ipcRenderer.invoke('save-error-report', reportContent),
})

// --------- Auto-updater API ---------
contextBridge.exposeInMainWorld('autoUpdater', {
  /**
   * Check for available updates from GitHub Releases
   * @returns {available: boolean, updateInfo?: object, reason?: string}
   */
  checkForUpdates: (): Promise<{ available: boolean; updateInfo?: unknown; reason?: string }> =>
    ipcRenderer.invoke('check-for-updates'),

  /**
   * Start downloading the available update
   * @returns true if download started successfully
   */
  downloadUpdate: (): Promise<boolean> => ipcRenderer.invoke('download-update'),

  /**
   * Quit the application and install the downloaded update
   * @returns true if install process started
   */
  quitAndInstall: (): Promise<boolean> => ipcRenderer.invoke('quit-and-install'),

  /**
   * Get the current application version
   * @returns Version string (e.g., "0.5.3")
   */
  getCurrentVersion: (): Promise<string> => ipcRenderer.invoke('get-current-version'),

  /**
   * Listen for update status events
   * @param callback - Called when update status changes
   * @returns Cleanup function
   */
  onCheckingForUpdate: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('auto-updater:checking-for-update', listener)
    return () => ipcRenderer.off('auto-updater:checking-for-update', listener)
  },

  onUpdateAvailable: (callback: (info: { version: string; releaseNotes?: string; releaseDate?: string }) => void) => {
    const listener = (_event: IpcRendererEvent, info: { version: string; releaseNotes?: string; releaseDate?: string }) => callback(info)
    ipcRenderer.on('auto-updater:update-available', listener)
    return () => ipcRenderer.off('auto-updater:update-available', listener)
  },

  onUpdateNotAvailable: (callback: (info: { version: string }) => void) => {
    const listener = (_event: IpcRendererEvent, info: { version: string }) => callback(info)
    ipcRenderer.on('auto-updater:update-not-available', listener)
    return () => ipcRenderer.off('auto-updater:update-not-available', listener)
  },

  onDownloadProgress: (callback: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => {
    const listener = (_event: IpcRendererEvent, progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => callback(progress)
    ipcRenderer.on('auto-updater:download-progress', listener)
    return () => ipcRenderer.off('auto-updater:download-progress', listener)
  },

  onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
    const listener = (_event: IpcRendererEvent, info: { version: string }) => callback(info)
    ipcRenderer.on('auto-updater:update-downloaded', listener)
    return () => ipcRenderer.off('auto-updater:update-downloaded', listener)
  },

  onError: (callback: (error: { message: string }) => void) => {
    const listener = (_event: IpcRendererEvent, error: { message: string }) => callback(error)
    ipcRenderer.on('auto-updater:error', listener)
    return () => ipcRenderer.off('auto-updater:error', listener)
  },
})
