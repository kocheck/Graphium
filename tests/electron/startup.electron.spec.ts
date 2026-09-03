/**
 * Electron startup smoke tests against the real packaged main process.
 */

import { test, expect } from '@playwright/test';

import { launchElectron } from '../helpers/launchElectron';

test.describe('Electron App Startup', () => {
  test('should launch Electron app successfully', async () => {
    const app = await launchElectron();
    const window = await app.firstWindow();

    await expect(window, 'Electron window should be created').toBeTruthy();

    const title = await window.title();
    expect(title, 'Window title should include Graphium').toContain('Graphium');

    await app.close();
  });

  test('should create window with correct dimensions', async () => {
    const app = await launchElectron();
    const window = await app.firstWindow();

    const size = await window.evaluate(() => ({
      width: window.outerWidth,
      height: window.outerHeight,
    }));

    expect(size.width, 'Window width should be at least 800px').toBeGreaterThanOrEqual(800);
    expect(size.height, 'Window height should be at least 600px').toBeGreaterThanOrEqual(600);

    await app.close();
  });
});

test.describe('Electron App Environment', () => {
  test('should have Electron APIs available', async () => {
    const app = await launchElectron();
    const window = await app.firstWindow();

    const hasElectronAPIs = await window.evaluate(() => ({
      hasIpcRenderer: typeof window.ipcRenderer !== 'undefined',
      hasThemeAPI: typeof window.themeAPI !== 'undefined',
      hasErrorReporting: typeof window.errorReporting !== 'undefined',
    }));

    expect(hasElectronAPIs.hasIpcRenderer, 'IPC renderer should be available').toBeTruthy();
    expect(hasElectronAPIs.hasThemeAPI, 'Theme API should be exposed').toBeTruthy();
    expect(hasElectronAPIs.hasErrorReporting, 'Error reporting API should be exposed').toBeTruthy();

    await app.close();
  });

  test('should detect Electron platform', async () => {
    const app = await launchElectron();
    const window = await app.firstWindow();

    const platform = await window.evaluate(() => window.navigator.userAgent.includes('Electron'));
    expect(platform, 'Should detect running in Electron').toBeTruthy();

    await app.close();
  });
});

test.describe('Electron Menu Bar', () => {
  test('should initialize application menu', async () => {
    const app = await launchElectron();

    const hasMenu = await app.evaluate(async ({ Menu }) => Menu.getApplicationMenu() !== null);
    expect(hasMenu, 'Application menu should be initialized').toBeTruthy();

    await app.close();
  });

  test('should have File menu with expected items', async () => {
    const app = await launchElectron();
    // Menu is built in whenReady; wait for first window so app init finished.
    await app.firstWindow();

    const menuItems = await app.evaluate(async ({ Menu }) => {
      const appMenu = Menu.getApplicationMenu();
      if (!appMenu) {
        return [];
      }
      const fileMenu = appMenu.items.find((item) => item.label === 'File');
      if (!fileMenu?.submenu) {
        return [];
      }
      return fileMenu.submenu.items.map((item) => item.label);
    });

    expect(menuItems, 'File menu should include New Campaign').toContain('New Campaign');
    expect(menuItems, 'File menu should include Open Campaign...').toContain('Open Campaign...');
    expect(menuItems, 'File menu should include Save Campaign').toContain('Save Campaign');

    await app.close();
  });
});

test.describe('Electron Dev Tools', () => {
  test('should launch in development without crashing', async () => {
    const app = await launchElectron({
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    const window = await app.firstWindow();
    await expect(window).toBeTruthy();
    await app.close();
  });
});

test.describe('Electron Auto-Updater', () => {
  test('should expose autoUpdater module in main process', async () => {
    const app = await launchElectron();

    const autoUpdaterReady = await app.evaluate(async ({ autoUpdater }) => {
      return typeof autoUpdater !== 'undefined';
    });

    expect(autoUpdaterReady).toBeTruthy();
    await app.close();
  });
});

test.describe('Electron Protocol Handlers', () => {
  test('should register media protocol', async () => {
    const app = await launchElectron();

    const hasMediaProtocol = await app.evaluate(async ({ protocol }) => {
      return protocol.isProtocolHandled('media');
    });

    expect(hasMediaProtocol, 'media:// protocol should be registered').toBeTruthy();
    await app.close();
  });
});

test.describe('Electron App Lifecycle', () => {
  test('should handle app quit', async () => {
    const app = await launchElectron();
    await app.firstWindow();
    await app.close();
  });
});

test.describe('Electron Performance', () => {
  test('should launch within reasonable time', async () => {
    const startTime = Date.now();
    const app = await launchElectron();
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    const launchTime = Date.now() - startTime;

    expect(launchTime, 'App should launch in under 15 seconds').toBeLessThan(15000);
    await app.close();
  });
});
