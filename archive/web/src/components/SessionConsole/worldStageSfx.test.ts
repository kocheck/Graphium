import { afterEach, describe, expect, it, vi } from 'vitest';

import { playLocalSfx } from './worldStageSfx';

function mockAudioContext(): AudioContext {
  return {
    decodeAudioData: vi.fn(async (buffer: ArrayBuffer) => ({ byteLength: buffer.byteLength })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
    })),
    destination: {},
  } as unknown as AudioContext;
}

describe('playLocalSfx', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches and decodes a local clip once when the same src is replayed', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    }));
    vi.stubGlobal('fetch', fetchImpl);

    const context = mockAudioContext();
    await playLocalSfx(context, 'file:///tmp/sting.mp3');
    await playLocalSfx(context, 'file:///tmp/sting.mp3');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(context.createBufferSource).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight fetch when the same src is fired twice at once', async () => {
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchImpl = vi.fn(async () => {
      await blocked;
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      };
    });
    vi.stubGlobal('fetch', fetchImpl);

    const context = mockAudioContext();
    const first = playLocalSfx(context, 'file:///tmp/horn.mp3');
    const second = playLocalSfx(context, 'file:///tmp/horn.mp3');
    release?.();
    await Promise.all([first, second]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
  });
});
