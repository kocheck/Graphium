import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockIpcRenderer } from '../../test/setup';
import { fadeToLevel, sendWorldEvent } from './worldAudioYoutube';

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

describe('fadeToLevel', () => {
  it('fades YouTube and local audio together', () => {
    const player = { setVolume: vi.fn(), getVolume: vi.fn(() => 80) };
    const audio = { volume: 0.5 } as HTMLAudioElement;
    fadeToLevel({
      player: player as never,
      audio,
      usingYoutube: true,
      target: 0,
      durationMs: 0,
      clearFade: vi.fn(),
      setTimer: vi.fn(),
    });
    expect(player.setVolume).toHaveBeenCalledWith(0);
    expect(audio.volume).toBe(0);
  });
});
