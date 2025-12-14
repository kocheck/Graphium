import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
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
