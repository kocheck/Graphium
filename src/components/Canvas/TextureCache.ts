import { Assets } from 'pixi.js';

import type { Texture } from 'pixi.js';

const inFlight = new Map<string, Promise<Texture>>();

export function getOrLoadTexture(url: string): Promise<Texture> {
  const existing = inFlight.get(url);
  if (existing) {
    return existing;
  }
  const promise = Assets.load<Texture>(url);
  inFlight.set(url, promise);
  return promise;
}

// eslint-disable-next-line import/no-unused-modules
export function evictTexture(url: string): void {
  inFlight.delete(url);
  void Assets.unload(url);
}

/** @internal — test-only reset; clears the inFlight deduplication map */
// eslint-disable-next-line import/no-unused-modules
export function resetInFlightForTesting(): void {
  inFlight.clear();
}
