/**
 * Mock Electron APIs for Playwright tests
 * 
 * This file provides mock implementations of the Electron APIs that are normally
 * exposed via the preload script. These mocks allow the app to run in a browser
 * environment during accessibility testing.
 */

export function injectMockElectronAPIs() {
  // Mock ipcRenderer API
  window.ipcRenderer = {
    on: function() {},
    off: function() {},
    send: function() {},
    invoke: function() { return Promise.resolve({}) },
  };

  // Mock themeAPI with functional implementations
  window.themeAPI = {
    getThemeState: function() {
      return Promise.resolve({
        mode: 'system',
        effectiveTheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      });
    },
    setThemeMode: function(mode) {
      // Apply theme to DOM
      const effectiveTheme = mode === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : mode;
      document.documentElement.setAttribute('data-theme', effectiveTheme);
      return Promise.resolve();
    },
    onThemeChanged: function(callback) {
      // Return cleanup function
      return function() {};
    },
  };

  // Mock errorReporting API
  window.errorReporting = {
    getUsername: function() { return Promise.resolve('test-user') },
    openExternal: function() { return Promise.resolve(true) },
    saveToFile: function() { return Promise.resolve({ success: true }) },
  };
}
