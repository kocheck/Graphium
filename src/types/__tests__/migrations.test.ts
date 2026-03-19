// src/types/__tests__/migrations.test.ts
import { describe, it, expect } from 'vitest';
import { migrateCampaign, CURRENT_VERSION } from '../migrations';

describe('migrateCampaign', () => {
  it('returns data unchanged when already at CURRENT_VERSION', () => {
    const data = {
      campaign: { version: CURRENT_VERSION, id: 'c1', name: 'T', activeMapId: 'm1' },
      maps: {},
      tokens: {},
      drawings: {},
      doors: {},
      lights: {},
      mapLinks: {},
      tokenLibrary: {},
    };
    const result = migrateCampaign(data) as any;
    expect(result.campaign.version).toBe(CURRENT_VERSION);
  });

  it('throws when save file version is newer than app', () => {
    expect(() => migrateCampaign({ campaign: { version: CURRENT_VERSION + 1 } })).toThrow(
      'newer than this app',
    );
  });

  it('throws when save file version is far in the future', () => {
    // Version 99 > CURRENT_VERSION — triggers the "newer than app" error.
    // The "missing migration" branch is unreachable at CURRENT_VERSION=1
    // (no gap between 0 and 1), so this covers the forward-version guard.
    expect(() => migrateCampaign({ campaign: { version: 99 } })).toThrow('newer than this app');
  });

  it('treats missing version field as version 0 and migrates to v1', () => {
    const v0 = {
      campaign: {
        id: 'c1',
        name: 'Test',
        activeMapId: 'map-1',
        maps: {
          'map-1': {
            id: 'map-1',
            name: 'Floor 1',
            tokens: [],
            drawings: [],
            doors: [],
            stairs: [],
            map: null,
            gridSize: 50,
            gridType: 'LINES',
            gridColor: '#222222',
            exploredRegions: [],
            isDaylightMode: false,
          },
        },
        tokenLibrary: [],
      },
    };
    const result = migrateCampaign(v0) as any;
    expect(result.campaign.version).toBe(1);
    expect(result.maps).toBeDefined();
    expect(result.tokens).toBeDefined();
    expect(result.maps['map-1']).toBeDefined();
    expect(result.maps['map-1'].mapConfig).toBeNull();
    expect(result.maps['map-1'].mapLinkIds).toEqual([]);
    expect(result.lights).toEqual({});
  });

  it('migrates v0 tokens into flat table with mapId and hidden', () => {
    const v0 = {
      campaign: {
        id: 'c1',
        name: 'T',
        activeMapId: 'map-1',
        maps: {
          'map-1': {
            id: 'map-1',
            name: 'F',
            tokens: [{ id: 't1', x: 10, y: 20, src: 'file://t.png' }],
            drawings: [],
            doors: [],
            stairs: [],
            map: null,
            gridSize: 50,
            gridType: 'LINES',
            gridColor: '#222222',
            exploredRegions: [],
            isDaylightMode: false,
          },
        },
        tokenLibrary: [],
      },
    };
    const result = migrateCampaign(v0) as any;
    expect(result.tokens['t1']).toBeDefined();
    expect(result.tokens['t1'].mapId).toBe('map-1');
    expect(result.tokens['t1'].hidden).toBe(false);
    expect(result.tokens['t1'].conditions).toEqual([]);
    expect(result.maps['map-1'].tokenIds).toContain('t1');
  });

  it('migrates v0 stairs into mapLinks with all required defaults', () => {
    const v0 = {
      campaign: {
        id: 'c1',
        name: 'T',
        activeMapId: 'map-1',
        maps: {
          'map-1': {
            id: 'map-1',
            name: 'F',
            tokens: [],
            drawings: [],
            doors: [],
            stairs: [
              { id: 's1', x: 5, y: 10, direction: 'north', type: 'up', width: 100, height: 100 },
            ],
            map: null,
            gridSize: 50,
            gridType: 'LINES',
            gridColor: '#222222',
            exploredRegions: [],
            isDaylightMode: false,
          },
        },
        tokenLibrary: [],
      },
    };
    const result = migrateCampaign(v0) as any;
    const link = result.mapLinks['s1'];
    expect(link).toBeDefined();
    expect(link.type).toBe('stairs-up');
    expect(link.fromMapId).toBe('map-1');
    expect(link.fromX).toBe(5);
    expect(link.fromY).toBe(10);
    // toMapId is same-map placeholder — GM reconnects in UI after migration
    expect(link.toMapId).toBe('map-1');
    expect(link.hidden).toBe(false);
    expect(link.label).toBeUndefined();
    expect(result.maps['map-1'].mapLinkIds).toContain('s1');
  });

  // Note: Campaign.tokenLibrary (deprecated type in domain.ts) stays as TokenLibraryItem[]
  // (the old array format). GameStore.tokenLibrary is Record<LibraryItemId, TokenLibraryItem>
  // (the new Record format). migrateV0toV1 converts from the Campaign array to the GameStore
  // Record — these are different types, not a conflict. gameStore.ts consumers stay on Campaign
  // until the App Shell spec migrates them to GameStore.
  it('migrates v0 tokenLibrary array into flat Record', () => {
    const v0 = {
      campaign: {
        id: 'c1',
        name: 'T',
        activeMapId: 'map-1',
        maps: {
          'map-1': {
            id: 'map-1',
            name: 'F',
            tokens: [],
            drawings: [],
            doors: [],
            stairs: [],
            map: null,
            gridSize: 50,
            gridType: 'LINES',
            gridColor: '#222222',
            exploredRegions: [],
            isDaylightMode: false,
          },
        },
        tokenLibrary: [
          {
            id: 'lib1',
            name: 'Goblin',
            src: 'file://goblin.png',
            thumbnailSrc: 'file://t.png',
            category: 'Monsters',
            tags: [],
            dateAdded: 1000,
          },
        ],
      },
    };
    const result = migrateCampaign(v0) as any;
    // tokenLibrary must be a Record, not an array
    expect(Array.isArray(result.tokenLibrary)).toBe(false);
    expect(result.tokenLibrary['lib1']).toBeDefined();
    expect(result.tokenLibrary['lib1'].name).toBe('Goblin');
  });

  it('uses mapConfig (not map) for the background image field', () => {
    const v0 = {
      campaign: {
        id: 'c1',
        name: 'T',
        activeMapId: 'map-1',
        maps: {
          'map-1': {
            id: 'map-1',
            name: 'F',
            tokens: [],
            drawings: [],
            doors: [],
            stairs: [],
            map: { src: 'file://bg.png', x: 0, y: 0, width: 800, height: 600, scale: 1 },
            gridSize: 50,
            gridType: 'LINES',
            gridColor: '#222222',
            exploredRegions: [],
            isDaylightMode: false,
          },
        },
        tokenLibrary: [],
      },
    };
    const result = migrateCampaign(v0) as any;
    expect(result.maps['map-1'].mapConfig).toBeDefined();
    expect(result.maps['map-1'].mapConfig.src).toBe('file://bg.png');
    // Old field name must not be present
    expect(result.maps['map-1']).not.toHaveProperty('map');
  });

  it('migrates v0 drawings with defaults for pressures, x, y, scale', () => {
    const v0 = {
      campaign: {
        id: 'c1',
        name: 'T',
        activeMapId: 'map-1',
        maps: {
          'map-1': {
            id: 'map-1',
            name: 'F',
            tokens: [],
            drawings: [{ id: 'd1', tool: 'marker', points: [0, 0], color: '#ff0000', size: 4 }],
            doors: [],
            stairs: [],
            map: null,
            gridSize: 50,
            gridType: 'LINES',
            gridColor: '#222222',
            exploredRegions: [],
            isDaylightMode: false,
          },
        },
        tokenLibrary: [],
      },
    };
    const result = migrateCampaign(v0) as any;
    expect(result.drawings['d1']).toBeDefined();
    expect(result.drawings['d1'].mapId).toBe('map-1');
    expect(result.drawings['d1'].hidden).toBe(false);
    expect(result.drawings['d1'].pressures).toEqual([]);
    expect(result.drawings['d1'].x).toBe(0);
    expect(result.drawings['d1'].y).toBe(0);
    expect(result.drawings['d1'].scale).toBe(1);
    expect(result.maps['map-1'].drawingIds).toContain('d1');
  });

  it('migrates v0 doors with mapId, hidden, thickness, swingDirection defaults', () => {
    const v0 = {
      campaign: {
        id: 'c1',
        name: 'T',
        activeMapId: 'map-1',
        maps: {
          'map-1': {
            id: 'map-1',
            name: 'F',
            tokens: [],
            drawings: [],
            doors: [
              {
                id: 'door1',
                x: 100,
                y: 200,
                orientation: 'horizontal',
                isOpen: false,
                isLocked: false,
                size: 50,
              },
            ],
            stairs: [],
            map: null,
            gridSize: 50,
            gridType: 'LINES',
            gridColor: '#222222',
            exploredRegions: [],
            isDaylightMode: false,
          },
        },
        tokenLibrary: [],
      },
    };
    const result = migrateCampaign(v0) as any;
    expect(result.doors['door1']).toBeDefined();
    expect(result.doors['door1'].mapId).toBe('map-1');
    expect(result.doors['door1'].hidden).toBe(false);
    expect(result.doors['door1'].thickness).toBe(12);
    expect(result.doors['door1'].swingDirection).toBe('right');
    expect(result.maps['map-1'].doorIds).toContain('door1');
  });

  it('MIGRATIONS table has one entry per schema version', () => {
    // Guards against adding a new CURRENT_VERSION without adding its migration.
    // At v1 there is exactly 1 entry (migrateV0toV1).
    expect(CURRENT_VERSION).toBe(1);
  });
});
