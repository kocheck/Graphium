/**
 * Mock Electron APIs for Playwright tests
 * 
 * This file provides mock implementations of the Electron APIs that are normally
 * exposed via the preload script. These mocks allow the app to run in a browser
 * environment during accessibility testing.
 */

export function injectMockElectronAPIs() {
  // Mock ipcRenderer API
  (window as any).ipcRenderer = {
    on: () => {},
    off: () => {},
    send: () => {},
    invoke: async () => ({}),
  }

  // Mock themeAPI with functional implementations
  (window as any).themeAPI = {
    getThemeState: async () => ({
      mode: 'system',
      effectiveTheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    }),
    setThemeMode: async (mode: string) => {
      // Apply theme to DOM
      const effectiveTheme = mode === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : mode
      document.documentElement.setAttribute('data-theme', effectiveTheme)
    },
    onThemeChanged: (callback: any) => {
      // Return cleanup function
      return () => {}
    },
  }

  // Mock errorReporting API
  (window as any).errorReporting = {
    getUsername: async () => 'test-user',
    openExternal: async () => true,
    saveToFile: async () => ({ success: true }),
  }
}
