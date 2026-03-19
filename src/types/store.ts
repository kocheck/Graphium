// src/types/store.ts
//
// GameStore describes the normalized data shape — a plain TypeScript interface.
// It is NOT the Zustand store slice (which is currently called GameState in
// src/store/gameStore.ts). The Zustand store will be migrated to match this
// shape in the App Shell spec.

import type {
  MapData,
  Token,
  Drawing,
  Door,
  LightSource,
  MapLink,
  TokenLibraryItem,
} from './entities';
import type {
  MapId,
  TokenId,
  DoorId,
  LightId,
  DrawingId,
  MapLinkId,
  LibraryItemId,
} from './primitives';

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
