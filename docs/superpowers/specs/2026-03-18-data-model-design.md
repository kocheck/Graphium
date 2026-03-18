# Data Model Design — Graphium Clean Slate Rewrite

**Date:** 2026-03-18
**Status:** Approved
**Scope:** Core domain data model (v1 of clean-slate rewrite)

---

## Context

Graphium is being rewritten from scratch with three primary goals:

1. **Deep modules** — simple interfaces hiding complex implementations
2. **Feature modularity** — features can be enabled/disabled without scattered conditionals
3. **Performance** — predictable performance on low-end hardware

This spec covers the data model layer — the foundation everything else builds on. The UI design system, rendering engine, and app shell are separate specs.

---

## Goals

- Normalize all entity types into flat tables for O(1) access and incremental rendering
- Support first-class lighting sources, multi-floor map linking, and player view
- Encode visibility (`hidden`) on entities; filter at the IPC sync boundary
- Version-stamp the schema for safe migration of existing save files
- Gate subsystems behind feature flags to allow safe incremental development

---

## Non-Goals (v1)

- Initiative tracker / turn order
- Conditions and status effects (slot is modeled, not populated)
- Encounter / session history
- Multiple simultaneous player views

---

## Core Store Shape

The top-level store is a flat bag of entity tables. Every entity type has its own `Record<BrandedId, Entity>`. Maps hold only the IDs of their contained entities.

```ts
interface GameStore {
  campaign: CampaignMeta;
  maps: Record<MapId, MapData>;
  tokens: Record<TokenId, Token>;
  drawings: Record<DrawingId, Drawing>;
  doors: Record<DoorId, Door>;
  lights: Record<LightId, LightSource>;
  mapLinks: Record<MapLinkId, MapLink>;
  tokenLibrary: Record<LibraryItemId, TokenLibraryItem>;
}

interface CampaignMeta {
  id: string;
  name: string;
  activeMapId: MapId;
  version: number; // schema version for migration
}
```

---

## Branded ID Types

Entity IDs use the existing branded primitive pattern to prevent mixing IDs of different types at compile time.

```ts
type MapId = string & { readonly __brand: 'MapId' };
type TokenId = string & { readonly __brand: 'TokenId' };
type DoorId = string & { readonly __brand: 'DoorId' };
type LightId = string & { readonly __brand: 'LightId' };
type DrawingId = string & { readonly __brand: 'DrawingId' };
type MapLinkId = string & { readonly __brand: 'MapLinkId' };
type LibraryItemId = string & { readonly __brand: 'LibraryItemId' };
```

---

## Entity Designs

### MapData

Lean map descriptor. Entity membership is arrays of IDs — no nested entity objects.

```ts
interface MapData {
  id: MapId;
  name: string;
  mapConfig: MapConfig | null;
  gridSize: PixelSize;
  gridType: GridType;
  gridColor: HexColor;
  isDaylightMode: boolean;
  tokenIds: TokenId[];
  doorIds: DoorId[];
  lightIds: LightId[];
  drawingIds: DrawingId[];
  exploredRegions: ExploredRegion[]; // kept inline; map-specific, not cross-referenced
}
```

### Token

Gains `hidden` for GM visibility control and `conditions` slot for future status effects.

```ts
interface Token {
  id: TokenId;
  mapId: MapId;
  x: number;
  y: number;
  src: string;
  libraryItemId?: LibraryItemId;
  name?: string;
  type?: 'PC' | 'NPC';
  scale?: number;
  visionRadius?: number; // grid cells; 0 = relies on ambient light only
  movementSpeed?: number; // feet
  hidden: boolean; // GM-only; stripped before player sync
  conditions: Condition[]; // status effects — empty array in v1
}
```

### LightSource (new)

First-class entity. Can stand alone at a fixed position or attach to a token (torch carried by a character).

```ts
interface LightSource {
  id: LightId;
  mapId: MapId;
  x: number;
  y: number;
  radius: number; // in grid cells
  color: HexColor;
  intensity: number; // 0.0–1.0
  hidden: boolean; // GM-only
  attachedToTokenId?: TokenId; // if set, position resolves from token at sync time
}
```

### MapLink (replaces Stairs)

Bidirectional connection between two points on two maps. One entity owns both ends — no paired entities to keep in sync.

```ts
interface MapLink {
  id: MapLinkId;
  fromMapId: MapId;
  fromX: number;
  fromY: number;
  toMapId: MapId;
  toX: number;
  toY: number;
  type: 'stairs-up' | 'stairs-down' | 'portal' | 'ladder';
  label?: string; // e.g. "To the Catacombs"
  hidden: boolean;
}
```

### Door, Drawing

Structurally close to current definitions. Gain `hidden: boolean` and adopt branded ID types.

---

## Player View Sync Layer

The player window (World View) receives a derived snapshot — never raw store state.

### `derivePlayerView`

Pure function. Single place where visibility filtering occurs. Called by `SyncManager` on store change.

```ts
function derivePlayerView(store: GameStore, activeMapId: MapId): PlayerViewSnapshot {
  const map = store.maps[activeMapId];

  const visibleTokens = filterVisible(store.tokens, map.tokenIds);
  const visibleDoors = filterVisible(store.doors, map.doorIds);
  const visibleMapLinks = filterVisible(store.mapLinks, map.mapLinkIds);

  // Resolve attached light positions before sending
  const visibleLights = filterVisible(store.lights, map.lightIds).map((light) => {
    if (!light.attachedToTokenId) return light;
    const token = store.tokens[light.attachedToTokenId];
    return token ? { ...light, x: token.x, y: token.y } : light;
  });

  return {
    map,
    tokens: visibleTokens,
    doors: visibleDoors,
    lights: visibleLights,
    mapLinks: visibleMapLinks,
  };
}

function filterVisible<T extends { hidden: boolean }>(
  table: Record<string, T>,
  ids: string[],
): T[] {
  return ids.map((id) => table[id]).filter((e): e is T => !!e && !e.hidden);
}
```

### `PlayerViewSnapshot`

Plain serializable object — no branded types, no functions. Safe for Electron IPC.

```ts
interface PlayerViewSnapshot {
  map: MapData;
  tokens: Token[];
  doors: Door[];
  lights: LightSource[];
  mapLinks: MapLink[];
}
```

### Performance

- **Memoize** `derivePlayerView` with shallow reference checks on relevant store tables. If `store.tokens`, `store.lights`, and the active map haven't changed reference, return the cached snapshot.
- **Debounce** IPC sync to one frame (~16ms). Token drags produce many store updates per second; the player view needs at most one snapshot per frame.

---

## Schema Versioning

`CampaignMeta.version` is incremented with each breaking schema change. On file load, a migration pipeline upgrades old saves before populating the store.

```ts
const MIGRATIONS: Record<number, (data: unknown) => unknown> = {
  1: migrateV0toV1, // nested arrays → normalized flat tables
  2: migrateV1toV2, // add LightSource table
};

function migrateCampaign(raw: unknown): GameStore {
  let data = raw;
  const version = (data as any).campaign?.version ?? 0;
  for (let v = version; v < CURRENT_VERSION; v++) {
    data = MIGRATIONS[v + 1](data);
  }
  return data as GameStore;
}
```

Each migration is a pure function with no side effects.

---

## Feature Flags

A feature registry gates entire subsystems. Checked in two places only: the renderer (skip the layer) and the UI (hide the controls).

```ts
interface FeatureFlags {
  lighting: boolean; // LightSource entities + light pass in renderer
  mapLinks: boolean; // MapLink entities + floor navigation UI
  fogOfWar: boolean; // FogOfWarFilter + explored regions
  playerSync: boolean; // IPC sync to World View window
}
```

Disabled features leave their entity tables empty. No conditionals scattered through business logic.

---

## Architecture Summary

```
CampaignMeta  (version, activeMapId)
     ↓
Flat entity tables  (maps, tokens, doors, lights, mapLinks, drawings)
     ↓
derivePlayerView()  (filter hidden, resolve attachments, memoized + debounced)
     ↓
PlayerViewSnapshot  → IPC → World View renderer
     ↓
FeatureFlags  (gate renderer layers and UI independently)
     ↓
Migration pipeline  (pure functions, version-stamped)
```

---

## What Comes Next

This spec covers the data model only. Subsequent specs:

1. **UI Design System** — design tokens, primitive components, atomic component library
2. **Rendering Engine** — PixiJS layer architecture, incremental redraw, light pass
3. **App Shell** — Electron integration, IPC architecture, campaign I/O
