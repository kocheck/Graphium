# Data Model Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing `src/types/domain.ts` monolith with a normalized, flat-store data model that supports first-class lighting, multi-floor map linking, and a safe player view sync layer.

**Architecture:** Create focused type files under `src/types/`, each with one responsibility. Update `domain.ts` to a backward-compat shim so the 45 existing consumers continue to compile during the transition. Breaking changes (new required fields on entity interfaces) are acknowledged explicitly — fixing the construction sites is out of scope here and will be addressed in the App Shell and Rendering Engine specs. New runtime logic (player view sync, migration pipeline) is fully tested as pure functions.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), Vitest, Electron + React + Zustand

**Naming note:** `GameStore` (defined here) is the normalized data shape — a plain TypeScript interface describing what the store holds. It is distinct from the Zustand store slice, which is currently called `GameState` in `src/store/gameStore.ts`. `GameState` will be migrated to match `GameStore` in the App Shell spec.

---

## Migration boundary

This chunk creates new type definitions and a backward-compat shim. It will **not** update the 45+ existing consumers of `domain.ts`. Some new required fields (`Token.mapId`, `Door.mapId`, `Door.hidden`, `Drawing.pressures/x/y/scale`) will cause compile errors at existing construction sites. These are expected and explicitly deferred:

| Breaking change                         | Affected files (approximate)                        | Resolved in spec |
| --------------------------------------- | --------------------------------------------------- | ---------------- |
| `Token.mapId` required                  | `gameStore.ts`, `DungeonGenerator.ts`, tests        | App Shell        |
| `Door.mapId`, `Door.hidden` required    | `gameStore.ts`, tests                               | App Shell        |
| `Drawing.pressures/x/y/scale` required  | `useCanvasDrawing.ts`, `gameStore.ts`, tests        | Rendering Engine |
| `MapData.mapConfig` (was `MapData.map`) | `CanvasManager.tsx`, `syncUtils.ts`, `gameStore.ts` | Rendering Engine |
| `MapData.mapLinkIds` (new field)        | `gameStore.ts`, `MapSettingsSheet.tsx`              | App Shell        |
| `MapData.lightIds` (new field)          | `gameStore.ts`                                      | App Shell        |

**`Stairs` and `Campaign`** — these legacy types are used by ~28 files. They are preserved as deprecated interfaces in `domain.ts` during the transition. They are not added to `entities.ts` (they no longer exist in the new schema). They will be removed when `StairsLayer` and the campaign services are rewritten.

After completing this chunk, run `npm run type-check` — errors at construction sites are expected and listed above. Errors in `primitives.ts`, `entities.ts`, `store.ts`, `player-view.ts`, `features.ts`, or `migrations.ts` are not expected and should be fixed before proceeding.

---

## Chunk 1: Type Foundations

### Task 1: Primitive types

**Files:**

- Create: `src/types/primitives.ts`
- Create: `src/types/__tests__/primitives.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/types/__tests__/primitives.test.ts
import { describe, it, expect } from 'vitest';
import { toHexColor, toPixelSize } from '../primitives';

describe('toHexColor', () => {
  it('accepts #rgb', () => {
    expect(toHexColor('#abc')).toBe('#abc');
  });
  it('accepts #rrggbb', () => {
    expect(toHexColor('#ff0000')).toBe('#ff0000');
  });
  it('accepts #rrggbb mixed case', () => {
    expect(toHexColor('#FF0000')).toBe('#FF0000');
  });
  it('accepts #rrggbbaa', () => {
    expect(toHexColor('#ff000080')).toBe('#ff000080');
  });
  it('rejects named colors', () => {
    expect(() => toHexColor('red')).toThrow('Invalid hex color');
  });
  it('rejects empty string', () => {
    expect(() => toHexColor('')).toThrow('Invalid hex color');
  });
});

describe('toPixelSize', () => {
  it('accepts positive integers', () => {
    expect(toPixelSize(50)).toBe(50);
  });
  it('rounds fractional values', () => {
    expect(toPixelSize(50.7)).toBe(51);
  });
  it('rejects zero', () => {
    expect(() => toPixelSize(0)).toThrow('Invalid pixel size');
  });
  it('rejects negative', () => {
    expect(() => toPixelSize(-1)).toThrow('Invalid pixel size');
  });
  it('rejects Infinity', () => {
    expect(() => toPixelSize(Infinity)).toThrow('Invalid pixel size');
  });
  it('rejects NaN', () => {
    expect(() => toPixelSize(NaN)).toThrow('Invalid pixel size');
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm run test:run -- src/types/__tests__/primitives.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create primitives.ts**

```ts
// src/types/primitives.ts

// ===== SCALAR BRANDED TYPES =====

export type HexColor = string & { readonly __brand: 'HexColor' };
export type PixelSize = number & { readonly __brand: 'PixelSize' };
export type GridType = 'LINES' | 'DOTS' | 'HIDDEN' | 'HEXAGONAL' | 'ISOMETRIC';

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function toHexColor(value: string): HexColor {
  if (!HEX_COLOR_RE.test(value)) {
    throw new Error(`Invalid hex color: "${value}"`);
  }
  return value as HexColor;
}

export function toPixelSize(value: number): PixelSize {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid pixel size: ${value}`);
  }
  return Math.round(value) as PixelSize;
}

// ===== BRANDED ID TYPES =====
// These are compile-time-only brands — no runtime validation.
// Callers are responsible for passing valid string IDs.
// IDs arriving over IPC or from disk should be validated at the boundary,
// not inside these constructors.

export type MapId = string & { readonly __brand: 'MapId' };
export type TokenId = string & { readonly __brand: 'TokenId' };
export type DoorId = string & { readonly __brand: 'DoorId' };
export type LightId = string & { readonly __brand: 'LightId' };
export type DrawingId = string & { readonly __brand: 'DrawingId' };
export type MapLinkId = string & { readonly __brand: 'MapLinkId' };
export type LibraryItemId = string & { readonly __brand: 'LibraryItemId' };

export function toMapId(s: string): MapId {
  return s as MapId;
}
export function toTokenId(s: string): TokenId {
  return s as TokenId;
}
export function toDoorId(s: string): DoorId {
  return s as DoorId;
}
export function toLightId(s: string): LightId {
  return s as LightId;
}
export function toDrawingId(s: string): DrawingId {
  return s as DrawingId;
}
export function toMapLinkId(s: string): MapLinkId {
  return s as MapLinkId;
}
export function toLibraryItemId(s: string): LibraryItemId {
  return s as LibraryItemId;
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm run test:run -- src/types/__tests__/primitives.test.ts
```

Expected: all 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/primitives.ts src/types/__tests__/primitives.test.ts
git commit -m "feat(types): add primitives.ts with branded scalars and entity ID types"
```

---

### Task 2: Entity interfaces

**Files:**

- Create: `src/types/entities.ts`

No tests needed — these are pure TypeScript interface declarations. Type correctness is enforced by the compiler.

- [ ] **Step 1: Create entities.ts**

```ts
// src/types/entities.ts
import type {
  HexColor,
  PixelSize,
  GridType,
  MapId,
  TokenId,
  DoorId,
  LightId,
  DrawingId,
  MapLinkId,
  LibraryItemId,
} from './primitives';

// ===== MAP =====

export interface MapConfig {
  src: string; // file:// URL to background image
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface ExploredRegion {
  points: Array<{ x: number; y: number }>;
  timestamp: number;
}

/**
 * MapData holds grid/background config and ID lists for entities on this map.
 *
 * mapLinkIds: links where fromMapId === this map's id (stored once, not duplicated).
 * exploredRegions: GM-only state — stripped from PlayerViewSnapshot before IPC.
 * mapConfig: renamed from the legacy `map` field (see domain.ts shim for compat alias).
 */
export interface MapData {
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
  mapLinkIds: MapLinkId[]; // links originating from this map
  exploredRegions: ExploredRegion[];
}

// ===== TOKEN =====

// Placeholder — Condition type will be defined in a future spec.
export type Condition = never;

/**
 * Token is a character or object placed on the map.
 *
 * mapId: which map this token belongs to (BREAKING: required, was absent in v0).
 * Optional fields fall back to the referenced TokenLibraryItem prototype.
 * Orphaned libraryItemId (item deleted from library) is tolerated — not an error.
 * hidden: GM-only; stripped from player snapshot at the IPC boundary.
 * conditions: always [] in v1 (slot reserved for future status effects).
 *
 * MIGRATION: Adding mapId breaks all existing Token construction sites.
 * Fix those in the App Shell spec.
 */
export interface Token {
  id: TokenId;
  mapId: MapId;
  x: number;
  y: number;
  src: string;
  libraryItemId?: LibraryItemId;
  name?: string;
  type?: 'PC' | 'NPC';
  scale?: number;
  visionRadius?: number; // grid cells; 0 = rely on ambient light only
  movementSpeed?: number; // feet
  hidden: boolean; // GM-only; stripped before player sync
  conditions: Condition[]; // always [] in v1
}

// ===== DRAWING =====

/**
 * Drawing is a freehand stroke.
 *
 * tool='eraser' strokes are stored as entities and composited with
 * destination-out blending in the renderer — non-destructive, undo-friendly.
 *
 * pressures: one value per (x,y) point pair (0.0–1.0); empty [] for mouse input.
 * x, y, scale: always required; default to 0, 0, 1.
 *
 * MIGRATION: pressures/x/y/scale were optional in v0. Fix construction sites
 * in the Rendering Engine spec.
 */
export interface Drawing {
  id: DrawingId;
  mapId: MapId;
  tool: 'marker' | 'eraser' | 'wall';
  points: number[]; // [x1, y1, x2, y2, ...]
  color: HexColor;
  size: PixelSize;
  pressures: number[];
  x: number;
  y: number;
  scale: number;
  hidden: boolean;
}

// ===== DOOR =====

/**
 * MIGRATION: mapId and hidden are new required fields. Fix construction sites
 * in the App Shell spec. thickness and swingDirection are now required (were optional).
 */
export interface Door {
  id: DoorId;
  mapId: MapId;
  x: number;
  y: number;
  orientation: 'horizontal' | 'vertical';
  isOpen: boolean;
  isLocked: boolean;
  size: number; // pixels — typically gridSize
  thickness: number; // default: 12
  swingDirection: 'left' | 'right' | 'up' | 'down'; // default: 'right'
  hidden: boolean;
}

// ===== LIGHT SOURCE =====

/**
 * LightSource is a first-class entity.
 *
 * x/y are authoritative when detached (no attachedToTokenId).
 * When attached, x/y are stale — derivePlayerView resolves position from the token.
 * If the attached token is hidden, this light is also suppressed in the player snapshot.
 */
export interface LightSource {
  id: LightId;
  mapId: MapId;
  x: number;
  y: number;
  radius: number; // illumination radius in grid cells
  color: HexColor;
  intensity: number; // 0.0–1.0
  hidden: boolean;
  attachedToTokenId?: TokenId;
}

// ===== MAP LINK =====

/**
 * MapLink is a bidirectional connection between two points on two maps.
 * One entity owns both ends — no paired entities to keep in sync.
 * Stored in the origin map's mapLinkIds (fromMapId). Traversal layer handles
 * reverse navigation without duplicating the link.
 *
 * type is display-only; traversal is always bidirectional regardless of type.
 * Replaces the legacy Stairs entity (see domain.ts for deprecated Stairs shim).
 */
export interface MapLink {
  id: MapLinkId;
  fromMapId: MapId;
  fromX: number;
  fromY: number;
  toMapId: MapId;
  toX: number;
  toY: number;
  type: 'stairs-up' | 'stairs-down' | 'portal' | 'ladder'; // display-only
  label?: string;
  hidden: boolean;
}

// ===== TOKEN LIBRARY =====

export interface TokenLibraryItem {
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

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: no errors in `entities.ts`. Errors at construction sites in existing files are expected (see migration boundary table above).

- [ ] **Step 3: Commit**

```bash
git add src/types/entities.ts
git commit -m "feat(types): add entities.ts with normalized entity interfaces"
```

---

### Task 3: Store shape

**Files:**

- Create: `src/types/store.ts`

- [ ] **Step 1: Create store.ts**

```ts
// src/types/store.ts
//
// GameStore describes the normalized data shape — a plain TypeScript interface.
// It is NOT the Zustand store slice (which is currently called GameState in
// src/store/gameStore.ts). The Zustand store will be migrated to match this
// shape in the App Shell spec.

import type {
  MapId,
  TokenId,
  DoorId,
  LightId,
  DrawingId,
  MapLinkId,
  LibraryItemId,
} from './primitives';
import type {
  MapData,
  Token,
  Drawing,
  Door,
  LightSource,
  MapLink,
  TokenLibraryItem,
} from './entities';

export interface CampaignMeta {
  id: string;
  name: string;
  activeMapId: MapId;
  version: number; // schema version — see migrations.ts
}

/**
 * GameStore is the top-level normalized data shape.
 * All entity types live in flat Record tables keyed by branded ID.
 * Maps hold only arrays of entity IDs — no nested entity objects.
 *
 * Compare to the legacy Campaign type (preserved in domain.ts for compat):
 * - Campaign had maps as Record<string, MapData> with tokens/doors/drawings nested inside
 * - GameStore lifts all entities to top-level tables for O(1) access and incremental rendering
 */
export interface GameStore {
  campaign: CampaignMeta;
  maps: Record<MapId, MapData>;
  tokens: Record<TokenId, Token>;
  drawings: Record<DrawingId, Drawing>;
  doors: Record<DoorId, Door>;
  lights: Record<LightId, LightSource>;
  mapLinks: Record<MapLinkId, MapLink>;
  tokenLibrary: Record<LibraryItemId, TokenLibraryItem>;
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: no errors in `store.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/types/store.ts
git commit -m "feat(types): add store.ts with normalized GameStore shape"
```

---

### Task 4: Update domain.ts backward-compat shim

45 files import from `domain.ts`. This task converts it to a shim that re-exports new types while preserving legacy types (`Stairs`, `Campaign`) and acknowledging construction-site breakage.

**Files:**

- Modify: `src/types/domain.ts`

- [ ] **Step 1: Replace domain.ts contents**

```ts
// src/types/domain.ts
//
// BACKWARD-COMPAT SHIM — do not add new types here.
// New code imports directly from: primitives.ts, entities.ts, store.ts,
// player-view.ts, features.ts, migrations.ts.
//
// This file re-exports the new canonical types so existing consumers
// continue to compile during the transition. It is removed once all
// imports are migrated.
//
// KNOWN BREAKING CHANGES (fix in subsequent specs):
//   - Token now requires `mapId: MapId`           → App Shell spec
//   - Door now requires `mapId`, `hidden`         → App Shell spec
//   - Drawing now requires `pressures`, `x`, `y`, `scale` → Rendering Engine spec
//   - MapData renamed `.map` → `.mapConfig`       → Rendering Engine spec
//   - MapData has new required fields: `mapLinkIds`, `lightIds` → App Shell spec

// ===== SCALAR BRANDED TYPES =====

export type { HexColor, PixelSize, GridType } from './primitives';

export {
  toHexColor,
  toPixelSize,
  toMapId,
  toTokenId,
  toDoorId,
  toLightId,
  toDrawingId,
  toMapLinkId,
  toLibraryItemId,
} from './primitives';

// ===== ENTITY TYPES =====

export type {
  MapConfig,
  ExploredRegion,
  MapData,
  Condition,
  Token,
  Drawing,
  Door,
  LightSource,
  MapLink,
  TokenLibraryItem,
} from './entities';

// ===== STORE TYPES =====

export type { CampaignMeta, GameStore } from './store';

// ===== CONSTANTS =====

export const MAX_EXPLORED_REGIONS = 2000;

// Branded so Konva rendering code doesn't need an extra cast.
import { toHexColor as _toHexColor } from './primitives';
export const DEFAULT_GRID_COLOR = _toHexColor('#222222');

// ===== UI STATE TYPES =====
// These move to uiStore in the UI Design System spec.

export interface ToastMessage {
  message: string;
  type: 'error' | 'success' | 'info';
}

export interface ConfirmDialog {
  message: string;
  onConfirm: () => void;
  confirmText?: string;
}

// ===== DEPRECATED LEGACY TYPES =====
// Used by ~28 files. Preserved during transition — removed in App Shell /
// Rendering Engine specs when consumers are rewritten.

/**
 * @deprecated Use MapLink instead.
 * Stairs connected floors with visual rendering but no inter-map linking.
 * In the new schema, MapLink replaces Stairs and owns both ends of the connection.
 * StairsLayer.tsx will be updated in the Rendering Engine spec.
 */
export interface Stairs {
  id: string;
  x: number;
  y: number;
  direction: 'north' | 'south' | 'east' | 'west';
  type: 'up' | 'down';
  width: number;
  height: number;
}

/**
 * @deprecated Use GameStore instead.
 * Campaign was the old nested save format with maps containing entity arrays.
 * In the new schema, GameStore uses flat entity tables.
 * campaignService.ts and storage services will be updated in the App Shell spec.
 */
export interface Campaign {
  id: string;
  name: string;
  maps: Record<string, LegacyCampaignMap>;
  activeMapId: string;
  tokenLibrary: TokenLibraryItem[];
}

/**
 * @deprecated Internal shape of Campaign.maps — used only by the Campaign type above.
 */
export interface LegacyCampaignMap {
  id: string;
  name: string;
  tokens: Token[];
  drawings: Drawing[];
  doors: Door[];
  stairs: Stairs[];
  map: MapConfig | null;
  gridSize: number;
  gridType: GridType;
  gridColor: string;
  exploredRegions: ExploredRegion[];
  isDaylightMode: boolean;
}

// Legacy alias — kept for files that import TokenMetadata from domain.ts.
/** @deprecated No replacement — fields are optional directly on Token. */
export interface TokenMetadata {
  name?: string;
  type?: 'PC' | 'NPC';
  visionRadius?: number;
  scale?: number;
  movementSpeed?: number;
}
```

- [ ] **Step 2: Run full type-check**

```bash
npm run type-check 2>&1 | head -60
```

**Expected errors** (from construction sites listed in the migration boundary table above — do not fix here):

- `gameStore.ts` — `Token`, `Door`, `MapData` construction missing new required fields
- `useCanvasDrawing.ts` — `Drawing` construction missing `pressures`/`x`/`y`/`scale`
- `CanvasManager.tsx`, `syncUtils.ts` — accessing `.map` instead of `.mapConfig` on `MapData`

**Unexpected errors** (fix before proceeding):

- Any error inside `primitives.ts`, `entities.ts`, `store.ts`, `player-view.ts`, `features.ts`, or `migrations.ts`

- [ ] **Step 3: Run full test suite**

```bash
npm run test:run
```

Expected: all existing tests pass (the shim preserves exported names). New type errors at construction sites do not break tests — tests use the types, they don't construct objects that would fail the new required-field checks.

- [ ] **Step 4: Commit**

```bash
git add src/types/domain.ts
git commit -m "refactor(types): convert domain.ts to backward-compat shim; add deprecated Stairs/Campaign"
```

---

## Chunk 2: Player View Sync Layer

### Task 5: derivePlayerView

**Files:**

- Create: `src/types/player-view.ts`
- Create: `src/types/__tests__/player-view.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm run test:run -- src/types/__tests__/player-view.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create player-view.ts**

```ts
// src/types/player-view.ts
import type { GameStore } from './store';
import type { MapId } from './primitives';
import type { MapData, Token, Door, LightSource, MapLink } from './entities';

/**
 * MapData sent to the player window — exploredRegions stripped (GM-only state).
 *
 * `exploredRegions: []` is typed as the empty tuple — intentional, not a mistake.
 * It enforces that the player window never receives explored region data.
 * Do not widen to ExploredRegion[] — that would allow populated arrays.
 */
export type PlayerMapView = Omit<MapData, 'exploredRegions'> & { exploredRegions: [] };

/**
 * Plain serializable snapshot safe for Electron IPC.
 * Never contains branded types or functions.
 */
export interface PlayerViewSnapshot {
  map: PlayerMapView;
  tokens: Token[];
  doors: Door[];
  lights: LightSource[];
  mapLinks: MapLink[];
}

/**
 * filterVisible returns entities from `table` for the given `ids`, excluding hidden ones.
 * In dev mode, emits a console.warn for any ID that has no entry in the table.
 *
 * The table parameter accepts `{ [key: string]: T | undefined }` to be compatible
 * with both plain `Record<string, T>` and branded-key records like `Record<MapId, T>`.
 * Under noUncheckedIndexedAccess, branded-key records are not assignable to
 * `Record<string, T>` — the wider index signature avoids that mismatch.
 */
export function filterVisible<T extends { hidden: boolean }>(
  table: { readonly [key: string]: T | undefined },
  ids: readonly string[],
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

/**
 * derivePlayerView produces a PlayerViewSnapshot from the current store state.
 *
 * Rules applied here and nowhere else:
 * - hidden entities are stripped
 * - lights attached to hidden tokens are suppressed
 * - attached light positions are resolved from their token's current position
 * - exploredRegions are stripped (GM knowledge only)
 *
 * Pure function — memoize in SyncManager with shallow reference checks on:
 * store.tokens, store.lights, store.doors, store.mapLinks, and the active map.
 * Debounce IPC sends to ~16ms (one frame) to avoid flooding on token drags.
 *
 * Throws if activeMapId is not found in store.maps — caller must guarantee validity.
 */
export function derivePlayerView(store: GameStore, activeMapId: MapId): PlayerViewSnapshot {
  const map = store.maps[activeMapId];
  if (!map) {
    throw new Error(`[derivePlayerView] Map "${activeMapId}" not found in store`);
  }

  const visibleTokens = filterVisible(store.tokens, map.tokenIds);
  const visibleDoors = filterVisible(store.doors, map.doorIds);
  const visibleMapLinks = filterVisible(store.mapLinks, map.mapLinkIds);

  const visibleLights = filterVisible(store.lights, map.lightIds)
    .filter((light) => {
      if (!light.attachedToTokenId) return true;
      const token = store.tokens[light.attachedToTokenId];
      return token !== undefined && !token.hidden;
    })
    .map((light) => {
      if (!light.attachedToTokenId) return light;
      const token = store.tokens[light.attachedToTokenId];
      // token is guaranteed non-undefined here (filter above), but the second
      // lookup returns T|undefined under noUncheckedIndexedAccess — fallback is dead code
      return token ? { ...light, x: token.x, y: token.y } : light;
    });

  const playerMap: PlayerMapView = { ...map, exploredRegions: [] };

  return {
    map: playerMap,
    tokens: visibleTokens,
    doors: visibleDoors,
    lights: visibleLights,
    mapLinks: visibleMapLinks,
  };
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm run test:run -- src/types/__tests__/player-view.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Full type-check**

```bash
npm run type-check
```

Expected: no new errors in `player-view.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/types/player-view.ts src/types/__tests__/player-view.test.ts
git commit -m "feat(types): add player-view.ts with derivePlayerView and filterVisible"
```

---

## Chunk 3: Feature Flags and Migration Pipeline

### Task 6: Feature flags

**Files:**

- Create: `src/types/features.ts`

- [ ] **Step 1: Create features.ts**

```ts
// src/types/features.ts
//
// This file declares the FeatureFlags interface and default values.
// The RUNTIME flag state lives in uiStore (not here) — uiStore initializes
// its flag field from DEFAULT_FEATURE_FLAGS and allows toggling at runtime.
// Do not put flag-reading logic in this file.

/**
 * FeatureFlags gates entire subsystems. Lives in uiStore (runtime-only, not persisted).
 *
 * Checked in exactly two places:
 * 1. Renderer — skips the entire layer if the feature is disabled
 * 2. UI — hides controls for disabled features
 *
 * New flags default to false — features ship disabled until ready.
 * Disabled features leave their entity tables empty.
 */
export interface FeatureFlags {
  lighting: boolean; // LightSource entities + light pass in renderer
  mapLinks: boolean; // MapLink entities + floor navigation UI
  fogOfWar: boolean; // FogOfWarFilter + explored regions
  playerSync: boolean; // IPC sync to World View window
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  lighting: false,
  mapLinks: false,
  fogOfWar: true,
  playerSync: true,
};
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/features.ts
git commit -m "feat(types): add features.ts with FeatureFlags and defaults"
```

---

### Task 7: Migration pipeline

**Files:**

- Create: `src/types/migrations.ts`
- Create: `src/types/__tests__/migrations.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm run test:run -- src/types/__tests__/migrations.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create migrations.ts**

```ts
// src/types/migrations.ts
import type { GameStore } from './store';

export const CURRENT_VERSION = 1;

type MigrationFn = (data: unknown) => unknown;

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
  const data = raw as any;
  const old = data.campaign;

  const maps: Record<string, unknown> = {};
  const tokens: Record<string, unknown> = {};
  const drawings: Record<string, unknown> = {};
  const doors: Record<string, unknown> = {};
  const mapLinks: Record<string, unknown> = {};
  const tokenLibrary: Record<string, unknown> = {};

  for (const [mapId, m_] of Object.entries(old.maps ?? {})) {
    const m = m_ as any;
    const tokenIds: string[] = [];
    const drawingIds: string[] = [];
    const doorIds: string[] = [];
    const mapLinkIds: string[] = [];

    for (const token of m.tokens ?? []) {
      tokenIds.push(token.id);
      tokens[token.id] = {
        ...token,
        mapId,
        hidden: token.hidden ?? false,
        conditions: token.conditions ?? [],
      };
    }

    for (const drawing of m.drawings ?? []) {
      drawingIds.push(drawing.id);
      drawings[drawing.id] = {
        ...drawing,
        mapId,
        hidden: drawing.hidden ?? false,
        pressures: drawing.pressures ?? [],
        x: drawing.x ?? 0,
        y: drawing.y ?? 0,
        scale: drawing.scale ?? 1,
      };
    }

    for (const door of m.doors ?? []) {
      doorIds.push(door.id);
      doors[door.id] = {
        ...door,
        mapId,
        hidden: door.hidden ?? false,
        thickness: door.thickness ?? 12,
        swingDirection: door.swingDirection ?? 'right',
      };
    }

    // Stairs become MapLinks. toMapId defaults to same map — GMs reconnect
    // inter-floor links via the UI after migration.
    for (const stair of m.stairs ?? []) {
      mapLinkIds.push(stair.id);
      mapLinks[stair.id] = {
        id: stair.id,
        fromMapId: mapId,
        fromX: stair.x,
        fromY: stair.y,
        toMapId: mapId, // placeholder
        toX: stair.x,
        toY: stair.y,
        type: stair.type === 'up' ? 'stairs-up' : 'stairs-down',
        label: undefined,
        hidden: false,
      };
    }

    maps[mapId] = {
      id: mapId,
      name: m.name,
      mapConfig: m.map ?? null,
      gridSize: m.gridSize,
      gridType: m.gridType,
      gridColor: m.gridColor,
      isDaylightMode: m.isDaylightMode ?? false,
      tokenIds,
      drawingIds,
      doorIds,
      mapLinkIds,
      lightIds: [],
      exploredRegions: m.exploredRegions ?? [],
    };
  }

  for (const item of old.tokenLibrary ?? []) {
    tokenLibrary[item.id] = item;
  }

  return {
    campaign: {
      id: old.id,
      name: old.name,
      activeMapId: old.activeMapId,
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
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm run test:run -- src/types/__tests__/migrations.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm run test:run
```

Expected: all existing tests pass.

- [ ] **Step 6: Full type-check and lint**

```bash
npm run type-check && npm run lint
```

Expected: no errors in new files. Construction-site errors in existing files are expected (see migration boundary table).

- [ ] **Step 7: Commit**

```bash
git add src/types/migrations.ts src/types/__tests__/migrations.test.ts
git commit -m "feat(types): add migrations.ts with migrateCampaign and v0→v1 migration"
```

---

## Final Verification

- [ ] **Confirm all new files exist**

```
src/types/primitives.ts
src/types/entities.ts
src/types/store.ts
src/types/player-view.ts
src/types/features.ts
src/types/migrations.ts
src/types/__tests__/primitives.test.ts
src/types/__tests__/player-view.test.ts
src/types/__tests__/migrations.test.ts
```

- [ ] **Confirm domain.ts is a shim** — no original type definitions except the deprecated `Stairs`, `Campaign`, `LegacyCampaignMap`, `TokenMetadata`, `ToastMessage`, `ConfirmDialog`

- [ ] **Run all tests**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Lint**

```bash
npm run lint
```

Expected: no errors in new files.
