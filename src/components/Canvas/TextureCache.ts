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

export function evictTexture(url: string): void {
  inFlight.delete(url);
  void Assets.unload(url);
}
