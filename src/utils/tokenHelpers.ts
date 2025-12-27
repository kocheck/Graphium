/**
 * Token utility functions
 *
 * Shared helpers for token operations across components.
 */

import type { Token, TokenLibraryItem, MapConfig } from '../store/gameStore';

/**
 * Add a library token to the map at the center position
 *
 * @param libraryItem - Token library item to add
 * @param addToken - Store action to add token
 * @param map - Current map state
 * @returns The newly created token object
 */
export function addLibraryTokenToMap(
  libraryItem: TokenLibraryItem,
  addToken: (token: Token) => void,
  map: MapConfig | null
): Token {
  // Calculate center of current viewport or map
  // Default to (500, 500) if no map loaded
  const centerX = map ? map.x + (map.width * map.scale) / 2 : 500;
  const centerY = map ? map.y + (map.height * map.scale) / 2 : 500;

  // Create token from library item
  const newToken: Token = {
    id: crypto.randomUUID(),
    x: centerX,
    y: centerY,
    src: libraryItem.src,
    scale: libraryItem.defaultScale || 1,
    type: libraryItem.defaultType,
    visionRadius: libraryItem.defaultVisionRadius,
    name: libraryItem.name,
  };

  addToken(newToken);
  return newToken;
}
