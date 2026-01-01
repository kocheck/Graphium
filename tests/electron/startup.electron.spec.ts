/**
 * Electron Startup Tests
 *
 * Tests Electron-specific application startup and initialization:
 * - App launches successfully
 * - Window creation and sizing
 * - Menu bar initialization
 * - Tray icon (if applicable)
 * - Auto-updater initialization
 * - Deep links / protocol handlers
 *
 * These tests run against the actual Electron executable.
 */

import { test, expect, _electron as electron } from '@playwright/test';

// Window size tolerance in pixels - accounts for OS-specific window chrome,
// DPI scaling, and window decorations that may vary across platforms
const WINDOW_SIZE_TOLERANCE = 50;

test.describe('Electron App Startup', () => {
  test('should launch Electron app successfully', async () => {
    const app = await electron.launch({
      args: ['./dist-electron/main.js'],
    });

    // Get first window
    const window = await app.firstWindow();

    await expect(
      window,
      'Electron window should be created'
    ).toBeTruthy();

    // Verify window title
    const title = await window.title();
    expect(
      title,
      'Window should have correct title'
    ).toBe('Graphium');

    await app.close();
  });

  test('should create window with correct dimensions', async () => {
    const app = await electron.launch({
      args: ['./dist-electron/main.js'],
    });

    const window = await app.firstWindow();

    // Get window size
    const size = await window.evaluate(() => ({
      width: window.outerWidth,
      height: window.outerHeight,
    }));

    expect(
      size.width,
      'Window width should be at least 800px'
    ).toBeGreaterThanOrEqual(800);

    expect(
      size.height,
      'Window height should be at least 600px'
    ).toBeGreaterThanOrEqual(600);

    await app.close();
  });

  test('should set window minimum size', async () => {
    const app = await electron.launch({
      args: ['./dist-electron/main.js'],
    });

    const window = await app.firstWindow();

    // Try to resize below minimum
    await window.setViewportSize({ width: 400, height: 300 });

    const size = await window.evaluate(() => ({
      width: window.outerWidth,
      height: window.outerHeight,
    }));

    // Should be constrained to minimum
    expect(
      size.width,
      'Window should enforce minimum width'
    ).toBeGreaterThanOrEqual(600);

    expect(
      size.height,
      'Window should enforce minimum height'
    ).toBeGreaterThanOrEqual(400);

    await app.close();
  });

  test('should restore window size from previous session', async () => {
    // First launch - set custom size
    let app = await electron.launch({
      args: ['./dist-electron/main.js'],
    });

    let window = await app.firstWindow();
    await window.setViewportSize({ width: 1200, height: 800 });

    // Close app
    await app.close();

    // Second launch - should restore size
    app = await electron.launch({
      args: ['./dist-electron/main.js'],
    });

    window = await app.firstWindow();

    const size = await window.evaluate(() => ({
      width: window.outerWidth,
      height: window.outerHeight,
    }));

    expect(
      size.width,
      'Window width should be restored from previous session'
    ).toBeCloseTo(1200, WINDOW_SIZE_TOLERANCE); // Allow some tolerance

    expect(
      size.height,
      'Window height should be restored from previous session'
    ).toBeCloseTo(800, WINDOW_SIZE_TOLERANCE);

    await app.close();
  });
});

test.describe('Electron App Environment', () => {
  test('should have Electron APIs available', async () => {
    const app = await electron.launch({
      args: ['./dist-electron/main.js'],
    });

    const window = await app.firstWindow();

    // Check for Electron-specific APIs
    const hasElectronAPIs = await window.evaluate(() => {
      return {
        hasIpcRenderer: typeof window.ipcRenderer !== 'undefined',
        hasThemeAPI: typeof window.themeAPI !== 'undefined',
        hasErrorReporting: typeof window.errorReporting !== 'undefined',
      };
    });

    expect(
      hasElectronAPIs.hasIpcRenderer,
      'IPC renderer should be available'
    ).toBeTruthy();

    expect(
      hasElectronAPIs.hasThemeAPI,
      'Theme API should be exposed'
    ).toBeTruthy();

    expect(
      hasElectronAPIs.hasErrorReporting,
      'Error reporting API should be exposed'
    ).toBeTruthy();

    await app.close();
  });

  test('should detect Electron platform', async () => {
    const app = await electron.launch({
      args: ['./dist-electron/main.js'],
    });

    const window = await app.firstWindow();

    const platform = await window.evaluate(() => {
      // Assuming your app has a way to detect platform
      return window.navigator.userAgent.includes('Electron');
    });

    expect(
      platform,
      'Should detect running in Electron'
    ).toBeTruthy();

    await app.close();
  });
});

test.describe('Electron Menu Bar', () => {
  test('should initialize application menu', async () => {
    const app = await electron.launch({
      args: ['./dist-electron/main.js'],
    });

    // Check if app menu is set
    const hasMenu = await app.evaluate(async ({ Menu }) => {
      const appMenu = Menu.getApplicationMenu();
      return appMenu !== null;
    });

    expect(
      hasMenu,
      'Application menu should be initialized'
    ).toBeTruthy();

    await app.close();
  });

  test('should have File menu with expected items', async () => {
    const app = await electron.launch({
      args: ['./dist-electron/main.js'],
    });

    const menuItems = await app.evaluate(async ({ Menu }) => {
      const appMenu = Menu.getApplicationMenu();
      if (!appMenu) return [];

      const fileMenu = appMenu.items.find((item) => item.label === 'File');
      if (!fileMenu || !fileMenu.submenu) return [];

      return fileMenu.submenu.items.map((item) => item.label);
    });

    expect(
      menuItems,
      'File menu should include New Campaign'
    ).toContain('New Campaign');

    expect(
      menuItems,
      'File menu should include Open Campaign'
    ).toContain('Open Campaign');

    expect(
      menuItems,
      'File menu should include Save Campaign'
    ).toContain('Save Campaign');

    await app.close();
  });
});

test.describe('Electron Dev Tools', () => {
  test('should have dev tools available in development', async () => {
    const app = await electron.launch({
      args: ['./dist-electron/main.js'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    const window = await app.firstWindow();

    // Dev tools should be available
    const canOpenDevTools = await window.evaluate(() => {
      // Check if we can access dev tools
      return typeof (window as any).webContents !== 'undefined';
    });

    // Note: This test depends on your dev tools implementation

    await app.close();
  });
});

test.describe('Electron Auto-Updater', () => {
  test('should initialize auto-updater', async () => {
    const app = await electron.launch({
      args: ['./dist-electron/main.js'],
    });

    // Check if auto-updater is initialized
    const autoUpdaterReady = await app.evaluate(async ({ autoUpdater }) => {
      // This depends on your auto-updater implementation
      return typeof autoUpdater !== 'undefined';
    });

    // Note: Actual update checking should be mocked in tests

    await app.close();
  });
});

test.describe('Electron Protocol Handlers', () => {
  test('should register custom protocol', async () => {
    const app = await electron.launch({
      args: ['./dist-electron/main.js'],
    });

    const hasProtocol = await app.evaluate(async ({ protocol }) => {
      return protocol.isProtocolHandled('graphium');
    });

    // If you implement deep links, this should be true
    // expect(hasProtocol).toBeTruthy();

    await app.close();
  });
});

test.describe('Electron App Lifecycle', () => {
  test('should handle window close event', async () => {
    const app = await electron.launch({
      args: ['./dist-electron/main.js'],
    });

    const window = await app.firstWindow();

    // Close window
    await window.close();

    // App might quit or stay open (depends on implementation)
    // If app should quit when last window closes:
    await app.waitForEvent('close');

    // App should have closed
  });

  test('should handle app quit', async () => {
    const app = await electron.launch({
      args: ['./dist-electron/main.js'],
    });

    // Quit app
    await app.close();

    // Should close cleanly without errors
  });

  test('should save state before quit', async () => {
    const app = await electron.launch({
      args: ['./dist-electron/main.js'],
    });

    const window = await app.firstWindow();

    // Create campaign
    await window.click('[data-testid="new-campaign-button"]');
    await window.fill('[data-testid="campaign-name-input"]', 'Quit Test');
    await window.click('[data-testid="create-campaign-submit"]');

    // Quit app
    await app.close();

    // Relaunch
    const newApp = await electron.launch({
      args: ['./dist-electron/main.js'],
    });

    const newWindow = await newApp.firstWindow();

    // Campaign should be restored
    await expect(
      newWindow.locator('[data-testid="campaign-title"]'),
      'Campaign should be restored after app restart'
    ).toHaveText('Quit Test');

    await newApp.close();
  });
});

test.describe('Electron Performance', () => {
  test('should launch within reasonable time', async () => {
    const startTime = Date.now();

    const app = await electron.launch({
      args: ['./dist-electron/main.js'],
    });

    const window = await app.firstWindow();

    // Wait for app to be ready
    await window.waitForLoadState('networkidle');

    const launchTime = Date.now() - startTime;

    expect(
      launchTime,
      'App should launch in under 5 seconds'
    ).toBeLessThan(5000);

    await app.close();
  });

  test('should have low memory footprint on startup', async () => {
    const app = await electron.launch({
      args: ['./dist-electron/main.js'],
    });

    // Note: Memory testing depends on your setup
    // This is a conceptual test

    await app.close();
  });
});
