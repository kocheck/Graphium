import { test as base, expect, type ElectronApplication, type Page } from '@playwright/test';

import { launchElectron } from './launchElectron';

export const test = base.extend<{
  electronApp: ElectronApplication;
  electronWindow: Page;
}>({
  electronApp: async ({}, use) => {
    const app = await launchElectron();
    await use(app);
    await app.close();
  },
  electronWindow: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow();
    await use(window);
  },
});

export { expect };
