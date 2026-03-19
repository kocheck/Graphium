// src/types/player-view.ts
import type { MapData, Token, Door, LightSource, MapLink } from './entities';
import type { MapId } from './primitives';
import type { GameStore } from './store';

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
      if (!light.attachedToTokenId) {
        return true;
      }
      const token = store.tokens[light.attachedToTokenId];
      return token !== undefined && !token.hidden;
    })
    .map((light) => {
      if (!light.attachedToTokenId) {
        return light;
      }
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
