import { peekTokenScale, peekTokenType } from '../hooks/useTokenData';
import { isRectInAnyPolygon } from '../types/geometry';

import type { MapConfig, Token, TokenLibraryItem } from '../store/gameStore';
import type { Point } from '../types/geometry';

/** Stable world AABB when no map is uploaded so panning does not restamp explored fog. */
const NO_MAP_FOG_BOUNDS = { x: -500, y: -500, width: 3500, height: 3500 };

export function getFogBounds(map: MapConfig | null): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (map) {
    return {
      x: map.x,
      y: map.y,
      width: map.width * map.scale,
      height: map.height * map.scale,
    };
  }
  return NO_MAP_FOG_BOUNDS;
}

export function computeHiddenNpcIds(
  tokens: Token[],
  libraryById: Map<string, TokenLibraryItem>,
  polygons: Point[][],
  gridSize: number,
): Set<string> {
  const hidden = new Set<string>();
  for (const token of tokens) {
    if (peekTokenType(token, libraryById) !== 'NPC') {
      continue;
    }
    const size = gridSize * peekTokenScale(token, libraryById);
    if (!isRectInAnyPolygon(token.x, token.y, size, size, polygons)) {
      hidden.add(token.id);
    }
  }
  return hidden;
}
