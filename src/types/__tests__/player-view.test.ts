// src/types/__tests__/player-view.test.ts
import { describe, it, expect, vi } from 'vitest';
import { derivePlayerView, filterVisible } from '../player-view';
import type { GameStore } from '../store';
import type { MapId, TokenId, LightId, DoorId, MapLinkId } from '../primitives';
import type { MapData, Token, LightSource, Door, MapLink } from '../entities';

// ===== ID HELPERS =====

const toMapId = (s: string): MapId => s as MapId;
const toTokenId = (s: string): TokenId => s as TokenId;
const toLightId = (s: string): LightId => s as LightId;
const toDoorId = (s: string): DoorId => s as DoorId;
const toMapLinkId = (s: string): MapLinkId => s as MapLinkId;

const MAP_ID = toMapId('map-1');

function baseMap(): MapData {
  return {
    id: MAP_ID,
    name: 'Test Map',
    mapConfig: null,
    gridSize: 50 as any,
    gridType: 'LINES',
    gridColor: '#222222' as any,
    isDaylightMode: false,
    tokenIds: [],
    doorIds: [],
    lightIds: [],
    drawingIds: [],
    mapLinkIds: [],
    exploredRegions: [{ points: [{ x: 0, y: 0 }], timestamp: 1 }],
  };
}

function makeStore(
  mapOverride: Partial<MapData> = {},
  storeOverride: Partial<GameStore> = {},
): GameStore {
  return {
    campaign: { id: 'c1', name: 'Test', activeMapId: MAP_ID, version: 1 },
    maps: { [MAP_ID]: { ...baseMap(), ...mapOverride } },
    tokens: {},
    drawings: {},
    doors: {},
    lights: {},
    mapLinks: {},
    tokenLibrary: {},
    ...storeOverride,
  };
}

function makeToken(id: string, hidden = false, x = 0, y = 0): Token {
  return {
    id: toTokenId(id),
    mapId: MAP_ID,
    x,
    y,
    src: 'file://token.png',
    hidden,
    conditions: [],
  };
}

function makeLight(
  id: string,
  hidden = false,
  attachedToTokenId?: TokenId,
  x = 10,
  y = 20,
): LightSource {
  return {
    id: toLightId(id),
    mapId: MAP_ID,
    x,
    y,
    radius: 5,
    color: '#ffffff' as any,
    intensity: 1,
    hidden,
    attachedToTokenId,
  };
}

// ===== filterVisible =====

describe('filterVisible', () => {
  it('returns visible entities', () => {
    const token = makeToken('t1', false);
    const result = filterVisible({ [token.id]: token }, [token.id]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(token);
  });

  it('excludes hidden entities', () => {
    const token = makeToken('t1', true);
    const result = filterVisible({ [token.id]: token }, [token.id]);
    expect(result).toHaveLength(0);
  });

  it('silently skips missing IDs in production', () => {
    const result = filterVisible({}, [toTokenId('ghost')]);
    expect(result).toHaveLength(0);
  });

  it('emits console.warn for missing IDs in dev', () => {
    // import.meta.env is a mutable object in Vite/Vitest — direct mutation works.
    // Cast to Record<string, unknown> (not `any`) to satisfy strict type-check.
    // Use try/finally to guarantee cleanup even if the assertion throws.
    const env = import.meta.env as Record<string, unknown>;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    env['DEV'] = true;
    try {
      filterVisible({}, [toTokenId('ghost')]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('ghost'));
    } finally {
      env['DEV'] = false;
      warn.mockRestore();
    }
  });
});

// ===== derivePlayerView =====

describe('derivePlayerView', () => {
  it('strips exploredRegions from the player map', () => {
    const store = makeStore();
    const snapshot = derivePlayerView(store, MAP_ID);
    expect(snapshot.map.exploredRegions).toEqual([]);
  });

  it('excludes hidden tokens', () => {
    const visible = makeToken('t1', false);
    const hidden = makeToken('t2', true);
    const store = makeStore(
      { tokenIds: [visible.id, hidden.id] },
      { tokens: { [visible.id]: visible, [hidden.id]: hidden } },
    );
    const snapshot = derivePlayerView(store, MAP_ID);
    expect(snapshot.tokens.map((t) => t.id)).toEqual([visible.id]);
  });

  it('excludes lights whose attached token is hidden', () => {
    const hiddenToken = makeToken('t1', true);
    const light = makeLight('l1', false, hiddenToken.id);
    const store = makeStore(
      { tokenIds: [hiddenToken.id], lightIds: [light.id] },
      { tokens: { [hiddenToken.id]: hiddenToken }, lights: { [light.id]: light } },
    );
    const snapshot = derivePlayerView(store, MAP_ID);
    expect(snapshot.lights).toHaveLength(0);
  });

  it('includes lights whose attached token is visible', () => {
    const token = makeToken('t1', false);
    const light = makeLight('l1', false, token.id);
    const store = makeStore(
      { tokenIds: [token.id], lightIds: [light.id] },
      { tokens: { [token.id]: token }, lights: { [light.id]: light } },
    );
    const snapshot = derivePlayerView(store, MAP_ID);
    expect(snapshot.lights).toHaveLength(1);
  });

  it('resolves attached light position from token', () => {
    const token = makeToken('t1', false, 100, 200);
    const light = makeLight('l1', false, token.id, 10, 20);
    const store = makeStore(
      { tokenIds: [token.id], lightIds: [light.id] },
      { tokens: { [token.id]: token }, lights: { [light.id]: light } },
    );
    const snapshot = derivePlayerView(store, MAP_ID);
    expect(snapshot.lights[0]?.x).toBe(100);
    expect(snapshot.lights[0]?.y).toBe(200);
  });

  it('keeps detached light position unchanged', () => {
    const light = makeLight('l1', false, undefined, 10, 20);
    const store = makeStore({ lightIds: [light.id] }, { lights: { [light.id]: light } });
    const snapshot = derivePlayerView(store, MAP_ID);
    expect(snapshot.lights[0]?.x).toBe(10);
    expect(snapshot.lights[0]?.y).toBe(20);
  });

  it('excludes hidden doors', () => {
    const door: Door = {
      id: toDoorId('d1'),
      mapId: MAP_ID,
      x: 0,
      y: 0,
      orientation: 'horizontal',
      isOpen: false,
      isLocked: false,
      size: 50,
      thickness: 12,
      swingDirection: 'right',
      hidden: true,
    };
    const store = makeStore({ doorIds: [door.id] }, { doors: { [door.id]: door } });
    const snapshot = derivePlayerView(store, MAP_ID);
    expect(snapshot.doors).toHaveLength(0);
  });

  it('excludes hidden map links', () => {
    const link: MapLink = {
      id: toMapLinkId('ml1'),
      fromMapId: MAP_ID,
      fromX: 0,
      fromY: 0,
      toMapId: toMapId('map-2'),
      toX: 0,
      toY: 0,
      type: 'stairs-up',
      hidden: true,
    };
    const store = makeStore({ mapLinkIds: [link.id] }, { mapLinks: { [link.id]: link } });
    const snapshot = derivePlayerView(store, MAP_ID);
    expect(snapshot.mapLinks).toHaveLength(0);
  });

  it('excludes light with hidden=true even when attached to a visible token', () => {
    const token = makeToken('t1', false);
    // Light itself is hidden — should be excluded regardless of token visibility
    const light = makeLight('l1', true, token.id);
    const store = makeStore(
      { tokenIds: [token.id], lightIds: [light.id] },
      { tokens: { [token.id]: token }, lights: { [light.id]: light } },
    );
    const snapshot = derivePlayerView(store, MAP_ID);
    expect(snapshot.lights).toHaveLength(0);
  });

  it('throws when the active map is not found in store', () => {
    const store = makeStore();
    const missingId = toMapId('no-such-map');
    expect(() => derivePlayerView(store, missingId)).toThrow('not found in store');
  });
});
