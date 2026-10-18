import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

/** Computed colour of a token via a probe element, comparable with getComputedStyle output. */
async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = `var(${name})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return value;
  }, token);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForSelector('#root:visible', { timeout: 60000 });

  // Storage is already the web service. This mock owns the pause state the way
  // electron/main.ts does, so the real path runs: button -> TOGGLE_PAUSE ->
  // PAUSE_STATE_CHANGED -> PauseManager -> store -> className.
  await page.evaluate(() => {
    type Listener = (event: unknown, ...args: unknown[]) => void;
    const listeners = new Map<string, Listener[]>();
    let paused = false;
    window.ipcRenderer = {
      on: (channel: string, listener: Listener) => {
        listeners.set(channel, [...(listeners.get(channel) ?? []), listener]);
      },
      off: (channel: string, listener: Listener) => {
        listeners.set(
          channel,
          (listeners.get(channel) ?? []).filter((l) => l !== listener),
        );
      },
      removeAllListeners: (channel: string) => {
        listeners.delete(channel);
      },
      send: () => {},
      invoke: (channel: string) => {
        if (channel === 'TOGGLE_PAUSE') {
          paused = !paused;
          for (const listener of listeners.get('PAUSE_STATE_CHANGED') ?? []) {
            listener({}, paused);
          }
          return Promise.resolve(paused);
        }
        if (channel === 'GET_PAUSE_STATE') {
          return Promise.resolve(paused);
        }
        // Every other channel resolves to undefined, the same value the web build gets from
        // `window.ipcRenderer?.invoke(...)` when ipcRenderer is absent.
        return Promise.resolve(undefined);
      },
    };
  });

  await page.getByTestId('new-campaign-button').click();
  await expect(page.getByTestId('editor-view')).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  test(`pause button is green when running and red when paused (${theme})`, async ({ page }) => {
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    const button = page.getByRole('button', { name: /^(Pause|Resume) game$/ });

    await expect(button).toHaveAttribute('data-state', 'running');
    await expect(button).toHaveCSS(
      'background-color',
      await tokenColor(page, '--app-success-solid'),
    );

    await button.click();
    await page.mouse.move(0, 0);
    await expect(button).toHaveAttribute('data-state', 'paused');
    await expect(button).toHaveCSS('background-color', await tokenColor(page, '--app-error-solid'));

    await button.click();
    await page.mouse.move(0, 0);
    await expect(button).toHaveAttribute('data-state', 'running');
  });
}
