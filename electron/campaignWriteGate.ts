/**
 * Serializes campaign ZIP writes against quit cleanup so temp_assets is not
 * deleted while SAVE_CAMPAIGN / AUTO_SAVE is still reading files.
 */

let pendingCampaignWrites = 0;
let quitCleanupStarted = false;
const writeIdleWaiters: Array<() => void> = [];

const notifyIfIdle = (): void => {
  if (pendingCampaignWrites > 0) {
    return;
  }
  const waiters = writeIdleWaiters.splice(0, writeIdleWaiters.length);
  for (const resolve of waiters) {
    resolve();
  }
};

/** Marks quit cleanup as started so new saves are rejected. */
export const beginQuitCleanup = (): void => {
  quitCleanupStarted = true;
};

/** Runs `fn` while holding a campaign-write lock. Rejects if quit has started. */
export async function withCampaignWrite<T>(fn: () => Promise<T>): Promise<T> {
  if (quitCleanupStarted) {
    throw new Error('Cannot save campaign while the application is quitting');
  }
  pendingCampaignWrites += 1;
  try {
    return await fn();
  } finally {
    pendingCampaignWrites -= 1;
    notifyIfIdle();
  }
}

/** Resolves when no campaign ZIP writes are in flight. */
export function waitForCampaignWritesIdle(): Promise<void> {
  if (pendingCampaignWrites === 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    writeIdleWaiters.push(resolve);
  });
}

/** Test helper: reset gate state between unit tests. */
// eslint-disable-next-line import/no-unused-modules -- used by campaignWriteGate unit tests
export const resetCampaignWriteGateForTests = (): void => {
  pendingCampaignWrites = 0;
  quitCleanupStarted = false;
  writeIdleWaiters.length = 0;
};
