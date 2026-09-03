import { afterEach, describe, expect, it } from 'vitest';

import {
  beginQuitCleanup,
  resetCampaignWriteGateForTests,
  waitForCampaignWritesIdle,
  withCampaignWrite,
} from '../../electron/campaignWriteGate';

describe('campaignWriteGate', () => {
  afterEach(() => {
    resetCampaignWriteGateForTests();
  });

  it('waits for in-flight writes before reporting idle', async () => {
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });

    const writePromise = withCampaignWrite(async () => {
      await hold;
      return 'done';
    });

    let idleResolved = false;
    const idlePromise = waitForCampaignWritesIdle().then(() => {
      idleResolved = true;
    });

    await Promise.resolve();
    expect(idleResolved).toBe(false);

    release();
    await expect(writePromise).resolves.toBe('done');
    await idlePromise;
    expect(idleResolved).toBe(true);
  });

  it('rejects new writes after quit cleanup begins', async () => {
    beginQuitCleanup();
    await expect(withCampaignWrite(async () => true)).rejects.toThrow(/quitting/i);
  });
});
