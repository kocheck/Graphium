/**
 * Token utility functions
 *
 * Shared helpers for token operations across components.
 */

import type { Token, TokenLibraryItem, MapConfig } from '../store/gameStore';

/**
 * Add a library token to the map at the center position
 *
 * Creates a token instance that references the library item as its prototype.
 * The instance only stores position and libraryItemId - all other properties
 * (scale, type, visionRadius, name) are inherited from the library item.
 *
 * @param libraryItem - Token library item to add (the prototype)
 * @param addToken - Store action to add token
 * @param map - Current map state
 * @returns The newly created token instance
 */
export function addLibraryTokenToMap(
  libraryItem: TokenLibraryItem,
  addToken: (token: Token) => void,
  map: MapConfig | null,
): Token {
  // Calculate center of current viewport or map
  // Default to (500, 500) if no map loaded
  const centerX = map ? map.x + (map.width * map.scale) / 2 : 500;
  const centerY = map ? map.y + (map.height * map.scale) / 2 : 500;

  // Create token instance with reference to library item (prototype)
  // Only store instance-specific properties (id, position, src, libraryItemId)
  // Metadata (scale, type, visionRadius, name) will be inherited from library item
  const newToken: Token = {
    id: crypto.randomUUID(),
    x: centerX,
    y: centerY,
    src: libraryItem.src, // Store src for faster access (could be made inherited later)
    libraryItemId: libraryItem.id, // Reference to prototype
    // scale, type, visionRadius, name are NOT set - they inherit from library item
  };

  addToken(newToken);
  return newToken;
}
