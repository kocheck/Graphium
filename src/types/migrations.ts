// src/types/migrations.ts
import type { GameStore } from './store';

export const CURRENT_VERSION = 1;

type MigrationFn = (data: unknown) => unknown;

// ---------------------------------------------------------------------------
// v0 → v1 helpers
// Processing structurally unknown legacy data — `any` is intentional here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

function migrateTokens(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawTokens: any[],
  mapId: string,
  tokens: AnyRecord,
  tokenIds: string[],
): void {
  for (const token of rawTokens) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const id = token.id as string;
    tokenIds.push(id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    tokens[id] = {
      ...token,
      mapId,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      hidden: (token.hidden as boolean | undefined) ?? false,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      conditions: (token.conditions as unknown[] | undefined) ?? [],
    };
  }
}

function migrateDrawings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawDrawings: any[],
  mapId: string,
  drawings: AnyRecord,
  drawingIds: string[],
): void {
  for (const drawing of rawDrawings) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const id = drawing.id as string;
    drawingIds.push(id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    drawings[id] = {
      ...drawing,
      mapId,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      hidden: (drawing.hidden as boolean | undefined) ?? false,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      pressures: (drawing.pressures as unknown[] | undefined) ?? [],
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      x: (drawing.x as number | undefined) ?? 0,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      y: (drawing.y as number | undefined) ?? 0,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      scale: (drawing.scale as number | undefined) ?? 1,
    };
  }
}

function migrateDoors(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawDoors: any[],
  mapId: string,
  doors: AnyRecord,
  doorIds: string[],
): void {
  for (const door of rawDoors) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const id = door.id as string;
    doorIds.push(id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    doors[id] = {
      ...door,
      mapId,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      hidden: (door.hidden as boolean | undefined) ?? false,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      thickness: (door.thickness as number | undefined) ?? 12,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      swingDirection: (door.swingDirection as string | undefined) ?? 'right',
    };
  }
}

function migrateStairs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawStairs: any[],
  mapId: string,
  mapLinks: AnyRecord,
  mapLinkIds: string[],
): void {
  // Stairs become MapLinks. toMapId defaults to same map — GMs reconnect
  // inter-floor links via the UI after migration.
  for (const stair of rawStairs) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const id = stair.id as string;
    mapLinkIds.push(id);
    mapLinks[id] = {
      id,
      fromMapId: mapId,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      fromX: stair.x as number,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      fromY: stair.y as number,
      toMapId: mapId, // placeholder
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      toX: stair.x as number,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      toY: stair.y as number,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      type: stair.type === 'up' ? 'stairs-up' : 'stairs-down',
      label: undefined,
      hidden: false,
    };
  }
}

/**
 * migrateV0toV1: convert the old nested-array Campaign format to GameStore.
 *
 * v0 shape: { campaign: { maps: Record<id, OldMapData>, tokenLibrary: [] } }
 * v1 shape: GameStore with flat entity tables
 *
 * Stairs → MapLinks with placeholder toMapId (same map). GMs must
 * reconnect inter-floor links via the UI after migration.
 */
function migrateV0toV1(raw: unknown): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  const old = (raw as any).campaign as AnyRecord;

  const maps: AnyRecord = {};
  const tokens: AnyRecord = {};
  const drawings: AnyRecord = {};
  const doors: AnyRecord = {};
  const mapLinks: AnyRecord = {};
  const tokenLibrary: AnyRecord = {};

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  for (const [mapId, mapRaw] of Object.entries(old['maps'] ?? {})) {
    const m = mapRaw as AnyRecord;
    const tokenIds: string[] = [];
    const drawingIds: string[] = [];
    const doorIds: string[] = [];
    const mapLinkIds: string[] = [];

    migrateTokens((m['tokens'] as AnyRecord[] | undefined) ?? [], mapId, tokens, tokenIds);
    migrateDrawings((m['drawings'] as AnyRecord[] | undefined) ?? [], mapId, drawings, drawingIds);
    migrateDoors((m['doors'] as AnyRecord[] | undefined) ?? [], mapId, doors, doorIds);
    migrateStairs((m['stairs'] as AnyRecord[] | undefined) ?? [], mapId, mapLinks, mapLinkIds);

    maps[mapId] = {
      id: mapId,
      name: m['name'] as string,
      mapConfig: (m['map'] as unknown) ?? null,
      gridSize: m['gridSize'] as number,
      gridType: m['gridType'] as string,
      gridColor: m['gridColor'] as string,
      isDaylightMode: (m['isDaylightMode'] as boolean | undefined) ?? false,
      tokenIds,
      drawingIds,
      doorIds,
      mapLinkIds,
      lightIds: [],
      exploredRegions: (m['exploredRegions'] as unknown[]) ?? [],
    };
  }

  for (const item of (old['tokenLibrary'] as AnyRecord[] | undefined) ?? []) {
    tokenLibrary[item['id'] as string] = item;
  }

  return {
    campaign: {
      id: old['id'] as string,
      name: old['name'] as string,
      activeMapId: old['activeMapId'] as string,
      version: 1,
    },
    maps,
    tokens,
    drawings,
    doors,
    lights: {},
    mapLinks,
    tokenLibrary,
  };
}

const MIGRATIONS: { [version: number]: MigrationFn } = {
  1: migrateV0toV1,
};

/**
 * migrateCampaign upgrades a raw save file to CURRENT_VERSION.
 *
 * Throws with a user-facing message if the file is from a newer app version.
 * Throws if a required migration step is missing (programming error).
 * Files with no version field are treated as version 0.
 */
export function migrateCampaign(raw: unknown): GameStore {
  let data = raw;
  const rawRecord = raw as Record<string, unknown>;
  const campaign = rawRecord?.['campaign'] as Record<string, unknown> | undefined;
  const version: number = typeof campaign?.['version'] === 'number' ? campaign['version'] : 0;

  if (version > CURRENT_VERSION) {
    throw new Error(
      `Save file version ${version} is newer than this app (${CURRENT_VERSION}). ` +
        `Please update Graphium.`,
    );
  }

  for (let v = version; v < CURRENT_VERSION; v++) {
    const migrate = MIGRATIONS[v + 1];
    if (!migrate) {
      throw new Error(
        `No migration found for schema version ${v} → ${v + 1}. ` +
          `This is a bug — please report it.`,
      );
    }
    data = migrate(data);
  }

  return data as GameStore;
}
