/**
 * Electron IPC smoke tests — keep these aligned with real preload APIs.
 * Native dialog / OS-handler flows are omitted (they hang headless CI).
 */

import { test, expect } from '@playwright/test';

import { launchElectron } from '../helpers/launchElectron';

test.describe('Theme IPC Communication', () => {
  test('should get theme state via IPC', async () => {
    const app = await launchElectron();
    const window = await app.firstWindow();

    const themeState = await window.evaluate(() => window.themeAPI?.getThemeState());

    expect(themeState, 'Theme state should be returned from IPC call').toBeTruthy();
    expect(themeState?.mode, 'Theme mode should be light, dark, or system').toMatch(
      /^(light|dark|system)$/,
    );
    expect(themeState?.effectiveTheme, 'Effective theme should be light or dark').toMatch(
      /^(light|dark)$/,
    );

    await app.close();
  });

  test('should set theme mode via IPC', async () => {
    const app = await launchElectron();
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await window.evaluate(() => window.themeAPI?.setThemeMode('dark'));

    await window.waitForFunction(() => {
      return document.documentElement.getAttribute('data-theme') === 'dark';
    });

    const themeState = await window.evaluate(() => window.themeAPI?.getThemeState());
    expect(themeState?.mode, 'Theme mode should be persisted').toBe('dark');
    expect(themeState?.effectiveTheme).toBe('dark');

    await app.close();
  });

  test('should listen to theme changes via IPC', async () => {
    const app = await launchElectron();
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    const themeChanged = await window.evaluate(() => {
      return new Promise<{ mode: string; effectiveTheme: string }>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('theme-changed timeout')), 10000);
        const cleanup = window.themeAPI?.onThemeChanged((newTheme) => {
          window.clearTimeout(timeout);
          cleanup?.();
          resolve(newTheme);
        });
        void window.themeAPI?.setThemeMode('light');
      });
    });

    expect(themeChanged.mode).toBe('light');
    expect(themeChanged.effectiveTheme).toBe('light');

    await app.close();
  });
});

test.describe('Error Reporting IPC', () => {
  test('should get username via IPC', async () => {
    const app = await launchElectron();
    const window = await app.firstWindow();

    const username = await window.evaluate(() => window.errorReporting?.getUsername());

    expect(username, 'Should get username from main process').toBeTruthy();
    expect(typeof username, 'Username should be a string').toBe('string');

    await app.close();
  });
});

test.describe('IPC Security', () => {
  test('should not expose Node.js APIs directly to renderer', async () => {
    const app = await launchElectron();
    const window = await app.firstWindow();

    const hasDirectNodeAccess = await window.evaluate(() => ({
      hasRequire: typeof (window as unknown as { require?: unknown }).require !== 'undefined',
    }));

    expect(
      hasDirectNodeAccess.hasRequire,
      'require should not be directly accessible (security)',
    ).toBeFalsy();

    await app.close();
  });

  test('should only expose whitelisted IPC channels', async () => {
    const app = await launchElectron();
    const window = await app.firstWindow();

    const exposedAPIs = await window.evaluate(() => ({
      hasThemeAPI: typeof window.themeAPI !== 'undefined',
      hasErrorReporting: typeof window.errorReporting !== 'undefined',
      hasIpcRenderer: typeof window.ipcRenderer !== 'undefined',
    }));

    expect(exposedAPIs.hasThemeAPI, 'Theme API should be exposed').toBeTruthy();
    expect(exposedAPIs.hasErrorReporting, 'Error reporting API should be exposed').toBeTruthy();
    expect(exposedAPIs.hasIpcRenderer, 'IPC renderer should be exposed').toBeTruthy();

    await app.close();
  });
});

test.describe('IPC Performance', () => {
  test('should handle rapid IPC calls without blocking', async () => {
    const app = await launchElectron();
    const window = await app.firstWindow();

    const startTime = Date.now();
    await window.evaluate(async () => {
      await Promise.all(Array.from({ length: 100 }, () => window.themeAPI?.getThemeState()));
    });
    const duration = Date.now() - startTime;

    expect(duration, '100 IPC calls should complete in under 1 second').toBeLessThan(1000);

    await app.close();
  });
});
