import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockIpcRenderer } from '../../test/setup';
import { sendWorldEvent } from './worldAudioYoutube';

describe('sendWorldEvent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.ipcRenderer = mockIpcRenderer;
  });

  it('posts SESSION_CONSOLE_WORLD_EVENT on graphium-sync when ipcRenderer is missing', () => {
    const postMessage = vi.fn();
    const close = vi.fn();
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        postMessage = postMessage;
        close = close;
      },
    );
    window.ipcRenderer = undefined;

    sendWorldEvent('error', 'Local audio failed to play.');

    expect(postMessage).toHaveBeenCalledWith({
      type: 'SESSION_CONSOLE_WORLD_EVENT',
      payload: { type: 'error', message: 'Local audio failed to play.' },
    });
    expect(close).toHaveBeenCalled();
  });
});
