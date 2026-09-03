/**
 * Electron IPC smoke tests — keep these aligned with real preload APIs.
 * Native dialog / OS-handler flows are omitted (they hang headless CI).
 */

import { test, expect } from '../helpers/electronFixtures';

test.describe('Electron IPC', () => {
  test('should expose preload APIs without Node require', async ({ electronWindow }) => {
    const surface = await electronWindow.evaluate(() => ({
      hasIpcRenderer: typeof window.ipcRenderer !== 'undefined',
      hasThemeAPI: typeof window.themeAPI !== 'undefined',
      hasErrorReporting: typeof window.errorReporting !== 'undefined',
      hasRequire: 'require' in window,
    }));

    expect(surface.hasIpcRenderer).toBe(true);
    expect(surface.hasThemeAPI).toBe(true);
    expect(surface.hasErrorReporting).toBe(true);
    expect(surface.hasRequire).toBe(false);
  });

  test('should get, set, and listen for theme changes', async ({ electronWindow }) => {
    await electronWindow.waitForLoadState('domcontentloaded');

    const initial = await electronWindow.evaluate(() => {
      const api = window.themeAPI;
      if (!api) {
        throw new Error('themeAPI is not exposed');
      }
      return api.getThemeState();
    });
    expect(initial.mode).toMatch(/^(light|dark|system)$/);
    expect(initial.effectiveTheme).toMatch(/^(light|dark)$/);

    await electronWindow.evaluate(() => {
      const api = window.themeAPI;
      if (!api) {
        throw new Error('themeAPI is not exposed');
      }
      return api.setThemeMode('dark');
    });
    await electronWindow.waitForFunction(
      () => document.documentElement.getAttribute('data-theme') === 'dark',
      undefined,
      { timeout: 3000 },
    );
    const afterDark = await electronWindow.evaluate(() => {
      const api = window.themeAPI;
      if (!api) {
        throw new Error('themeAPI is not exposed');
      }
      return api.getThemeState();
    });
    expect(afterDark.mode).toBe('dark');
    expect(afterDark.effectiveTheme).toBe('dark');

    const themeChanged = await electronWindow.evaluate(() => {
      const api = window.themeAPI;
      if (!api) {
        throw new Error('themeAPI is not exposed');
      }
      return new Promise<{ mode: string; effectiveTheme: string }>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('theme-changed timeout')), 3000);
        const cleanup = api.onThemeChanged((newTheme) => {
          window.clearTimeout(timeout);
          cleanup();
          resolve(newTheme);
        });
        void api.setThemeMode('light');
      });
    });
    expect(themeChanged).toEqual({ mode: 'light', effectiveTheme: 'light' });
  });

  test('should get username via IPC', async ({ electronWindow }) => {
    const username = await electronWindow.evaluate(() => {
      const api = window.errorReporting;
      if (!api) {
        throw new Error('errorReporting is not exposed');
      }
      return api.getUsername();
    });
    expect(username).toEqual(expect.any(String));
  });
});
