/**
 * Electron startup smoke tests against the real packaged main process.
 */

import { test, expect } from '../helpers/electronFixtures';

test.describe('Electron startup', () => {
  test('should launch a Graphium window', async ({ electronWindow }) => {
    await expect(electronWindow.title()).resolves.toContain('Graphium');

    const size = await electronWindow.evaluate(() => ({
      width: window.outerWidth,
      height: window.outerHeight,
    }));
    expect(size.width).toBeGreaterThanOrEqual(800);
    expect(size.height).toBeGreaterThanOrEqual(600);

    const isElectron = await electronWindow.evaluate(() =>
      window.navigator.userAgent.includes('Electron'),
    );
    expect(isElectron).toBe(true);
  });

  test('should expose File menu campaign actions', async ({ electronApp, electronWindow }) => {
    await electronWindow.waitForLoadState('domcontentloaded');

    const menuItems = await electronApp.evaluate(async ({ Menu }) => {
      const appMenu = Menu.getApplicationMenu();
      const fileMenu = appMenu?.items.find((item) => item.label === 'File');
      return fileMenu?.submenu?.items.map((item) => item.label) ?? null;
    });

    expect(menuItems, 'File menu should be initialized').not.toBeNull();
    expect(menuItems).toEqual(
      expect.arrayContaining(['New Campaign', 'Open Campaign...', 'Save Campaign']),
    );
  });

  test('should register the media protocol', async ({ electronApp }) => {
    const hasMediaProtocol = await electronApp.evaluate(({ protocol }) =>
      protocol.isProtocolHandled('media'),
    );
    expect(hasMediaProtocol).toBe(true);
  });
});
