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

## Primitive Types

Reused from the existing codebase. Defined in `src/types/primitives.ts` in the rewrite.

```ts
// A validated CSS hex color string (#rgb, #rrggbb, #rrggbbaa)
type HexColor = string & { readonly __brand: 'HexColor' };

// A positive integer pixel dimension
type PixelSize = number & { readonly __brand: 'PixelSize' };

// Grid display mode
type GridType = 'LINES' | 'DOTS' | 'HIDDEN' | 'HEXAGONAL' | 'ISOMETRIC';
```

---

## Branded ID Types

Entity IDs use the same branded primitive pattern to prevent mixing IDs of different entity types at compile time.

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

## Core Store Shape

The top-level store is a flat bag of entity tables. Every entity type has its own `Record<BrandedId, Entity>`. Maps hold only the IDs of their contained entities — no nested entity objects.

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
  version: number; // schema version — see Schema Versioning section
}
```

---

## Entity Designs

### MapData

Lean map descriptor. Entity membership is arrays of IDs, not nested objects.

`mapLinkIds` indexes links where this map is the **origin** (`fromMapId`). A link is stored once, owned by its origin map. Navigation from `toMapId` back to `fromMapId` is handled by the traversal layer — not by duplicating the link in both maps.

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
  mapLinkIds: MapLinkId[]; // links originating from this map (fromMapId === this.id)
  exploredRegions: ExploredRegion[]; // kept inline; GM-state, stripped from player snapshot
}

interface MapConfig {
  src: string; // file:// URL
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

interface ExploredRegion {
  points: Array<{ x: number; y: number }>;
  timestamp: number;
}
```

### Token

Gains `hidden` for GM visibility and `conditions` slot for future status effects (empty array in v1).
Prototype/instance pattern preserved: optional fields fall back to the referenced `TokenLibraryItem`.

```ts
interface Token {
  id: TokenId;
  mapId: MapId;
  x: number;
  y: number;
  src: string;
  libraryItemId?: LibraryItemId; // reference to library prototype; orphaned refs are tolerated
  name?: string;
  type?: 'PC' | 'NPC';
  scale?: number;
  visionRadius?: number; // grid cells; 0 = relies on ambient light only
  movementSpeed?: number; // feet
  hidden: boolean; // GM-only; stripped before player sync
  conditions: Condition[]; // status effects — always [] in v1
}

// Placeholder — populated in a future spec
type Condition = never;
```

**Library item deletion:** deleting a `TokenLibraryItem` does not cascade to tokens. Tokens with an orphaned `libraryItemId` fall back to their own overridden fields (name, src, etc.). Dangling references are tolerated — not an error.

### LightSource (new)

First-class entity. Can stand alone at a fixed world position or attach to a token (torch, lantern).

`x` and `y` are the **authoritative position when detached** (`attachedToTokenId` is absent). When attached, `x`/`y` are stale convenience values — `derivePlayerView` overwrites them with the token's current position before the snapshot is sent.

```ts
interface LightSource {
  id: LightId;
  mapId: MapId;
  x: number; // world position (authoritative when detached)
  y: number;
  radius: number; // illumination radius in grid cells
  color: HexColor;
  intensity: number; // 0.0–1.0
  hidden: boolean; // GM-only
  attachedToTokenId?: TokenId; // position resolves from token at sync time
}
```

**Hidden token + attached light:** if a token is hidden (`token.hidden === true`), any light attached to it is also suppressed in the player snapshot — even if `light.hidden === false`. `derivePlayerView` skips lights whose attached token is hidden.

### MapLink (replaces Stairs)

Bidirectional connection between two points on two maps. One entity owns both ends — no paired entities to keep in sync. `type` is **display-only** and does not affect traversal direction; the renderer chooses which icon to draw, but a player can always traverse the link in either direction.

```ts
interface MapLink {
  id: MapLinkId;
  fromMapId: MapId;
  fromX: number;
  fromY: number;
  toMapId: MapId;
  toX: number;
  toY: number;
  type: 'stairs-up' | 'stairs-down' | 'portal' | 'ladder'; // display-only
  label?: string; // e.g. "To the Catacombs"
  hidden: boolean;
}
```

### Door

Updated from current definition: gains `hidden`, adopts branded `DoorId`. All previously-optional fields are given explicit defaults.

```ts
interface Door {
  id: DoorId;
  mapId: MapId;
  x: number;
  y: number;
  orientation: 'horizontal' | 'vertical';
  isOpen: boolean;
  isLocked: boolean;
  size: number; // pixels, typically gridSize
  thickness: number; // default: 12
  swingDirection: 'left' | 'right' | 'up' | 'down'; // default: 'right'
  hidden: boolean;
}
```

### Drawing

Updated from current definition: gains `hidden`, adopts branded `DrawingId`. Position fields (`x`, `y`, `scale`) are required with defaults rather than optional.

```ts
interface Drawing {
  id: DrawingId;
  mapId: MapId;
  tool: 'marker' | 'eraser' | 'wall';
  points: number[]; // [x1, y1, x2, y2, ...]
  color: HexColor;
  size: PixelSize;
  pressures: number[]; // pressure per point pair (0.0–1.0); empty [] for mouse input
  x: number; // default: 0
  y: number; // default: 0
  scale: number; // default: 1
  hidden: boolean;
}
```

### TokenLibraryItem

Structurally unchanged. Adopts branded `LibraryItemId`.

```ts
interface TokenLibraryItem {
  id: LibraryItemId;
  name: string;
  src: string; // file:// URL to full-size image
  thumbnailSrc: string; // file:// URL to 128×128 thumbnail
  category: string;
  tags: string[];
  dateAdded: number; // Date.now()
  defaultScale?: number;
  defaultVisionRadius?: number;
  defaultType?: 'PC' | 'NPC';
  defaultMovementSpeed?: number;
}
```

---

## Player View Sync Layer

The player window (World View) receives a derived snapshot — never raw store state.

### `derivePlayerView`

Pure function. The single place where visibility filtering and attachment resolution happen. Called by `SyncManager` on store change.

```ts
const CURRENT_VERSION = 1;

function derivePlayerView(store: GameStore, activeMapId: MapId): PlayerViewSnapshot {
  const map = store.maps[activeMapId];

  const visibleTokens = filterVisible(store.tokens, map.tokenIds);
  const visibleDoors = filterVisible(store.doors, map.doorIds);
  const visibleMapLinks = filterVisible(store.mapLinks, map.mapLinkIds);

  // Suppress lights whose attached token is hidden, then resolve position
  const visibleLights = filterVisible(store.lights, map.lightIds)
    .filter((light) => {
      if (!light.attachedToTokenId) return true;
      const token = store.tokens[light.attachedToTokenId];
      return token !== undefined && !token.hidden;
    })
    .map((light) => {
      if (!light.attachedToTokenId) return light;
      const token = store.tokens[light.attachedToTokenId];
      return token ? { ...light, x: token.x, y: token.y } : light;
    });

  // Strip explored regions — GM knowledge, not sent to players
  const playerMap: PlayerMapView = {
    ...map,
    exploredRegions: [],
  };

  return {
    map: playerMap,
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
  if (import.meta.env.DEV) {
    for (const id of ids) {
      if (!(id in table)) {
        console.warn(`[derivePlayerView] ID "${id}" in index but missing from table`);
      }
    }
  }
  return ids.map((id) => table[id]).filter((e): e is T => e !== undefined && !e.hidden);
}
```

### `PlayerViewSnapshot` and `PlayerMapView`

Plain serializable objects — no branded types, no functions. Safe for Electron IPC.

```ts
// MapData with exploredRegions stripped — players don't receive GM explored state
type PlayerMapView = Omit<MapData, 'exploredRegions'> & { exploredRegions: [] };

interface PlayerViewSnapshot {
  map: PlayerMapView;
  tokens: Token[];
  doors: Door[];
  lights: LightSource[];
  mapLinks: MapLink[];
}
```

### Performance

- **Memoize** `derivePlayerView` with shallow reference checks on relevant store tables. If `store.tokens`, `store.lights`, `store.doors`, `store.mapLinks`, and the active map haven't changed reference since the last call, return the cached snapshot.
- **Debounce** IPC sync to one frame (~16ms). Token drags produce many store updates per second; the player view needs at most one snapshot per frame.

---

## Schema Versioning

`CampaignMeta.version` is incremented with each breaking schema change. The current schema is **version 1**. Legacy files with no version field are treated as version 0.

On file load, the migration pipeline upgrades saves sequentially before populating the store.

```ts
const CURRENT_VERSION = 1;

const MIGRATIONS: { [version: number]: (data: unknown) => unknown } = {
  1: migrateV0toV1, // nested arrays → normalized flat tables
};

function migrateCampaign(raw: unknown): GameStore {
  let data = raw;
  const version = (data as any)?.campaign?.version ?? 0;

  if (version > CURRENT_VERSION) {
    throw new Error(
      `Save file version ${version} is newer than this app (${CURRENT_VERSION}). Please update Graphium.`,
    );
  }

  for (let v = version; v < CURRENT_VERSION; v++) {
    const migrate = MIGRATIONS[v + 1];
    if (!migrate) {
      throw new Error(`No migration found for version ${v} → ${v + 1}`);
    }
    data = migrate(data);
  }

  return data as GameStore;
}
```

Each migration is a pure function with no side effects. New migrations are added alongside each breaking schema change.

---

## Feature Flags

`FeatureFlags` lives in `uiStore` (runtime-only, not persisted with the campaign). Default values are defined at app startup. New flags default to `false` — features ship disabled until ready.

```ts
interface FeatureFlags {
  lighting: boolean; // LightSource entities + light pass in renderer
  mapLinks: boolean; // MapLink entities + floor navigation UI
  fogOfWar: boolean; // FogOfWarFilter + explored regions
  playerSync: boolean; // IPC sync to World View window
}

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  lighting: false,
  mapLinks: false,
  fogOfWar: true,
  playerSync: true,
};
```

Flags are checked in exactly two places:

1. **Renderer** — skips the entire layer if the feature is disabled
2. **UI** — hides controls for disabled features

No feature-flag conditionals elsewhere. Disabled features leave their entity tables empty.

---

## Architecture Summary

```
CampaignMeta  (version, activeMapId)
     ↓
Flat entity tables  (maps, tokens, doors, lights, mapLinks, drawings)
     ↓
derivePlayerView()  (filter hidden, suppress hidden-token lights,
                     strip exploredRegions, resolve attachments,
                     memoized + debounced)
     ↓
PlayerViewSnapshot  → IPC → World View renderer
     ↓
FeatureFlags  (runtime-only in uiStore; gate renderer layers and UI)
     ↓
Migration pipeline  (pure functions, version-stamped, fails loudly)
```

---

## What Comes Next

This spec covers the data model only. Subsequent specs:

1. **UI Design System** — design tokens, primitive components, atomic component library
2. **Rendering Engine** — PixiJS layer architecture, incremental redraw, light pass
3. **App Shell** — Electron integration, IPC architecture, campaign I/O
