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

// Branded so Konva rendering code doesn't need an extra cast.
import { toHexColor as _toHexColor } from './primitives';

import type {
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
import type { HexColor, PixelSize, GridType } from './primitives';

// ===== SCALAR BRANDED TYPES =====

export type { HexColor, PixelSize, GridType };

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
};

// ===== STORE TYPES =====

export type { CampaignMeta, GameStore } from './store';

// ===== CONSTANTS =====

export const MAX_EXPLORED_REGIONS = 2000;

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
