/**
 * Token utility functions
 */

export interface Token {
  id: string;
  x: number;
  y: number;
  src: string;
  libraryItemId?: string;
  scale?: number;
  type?: 'PC' | 'NPC';
  visionRadius?: number;
  name?: string;
}

export interface LibraryItem {
  id: string;
  name: string;
  src: string;
  thumbnailSrc: string;
  category: string;
  tags: string[];
  dateAdded: number;
  defaultScale?: number;
  defaultVisionRadius?: number;
  defaultType?: 'PC' | 'NPC';
}

/**
 * Gets unique recent tokens from the current map's token list
 * based on matching source images in the library.
 *
 * @param tokens - List of tokens currently on the map
 * @param library - The token library to look up metadata
 * @param limit - Max number of recent tokens to return (default 3)
 */
export function getRecentTokens(
  tokens: Token[],
  library: LibraryItem[],
  limit: number = 3,
): LibraryItem[] {
  const uniqueSrcs = new Set<string>();
  const recent: LibraryItem[] = [];

  // Iterate tokens in reverse (most recent first)
  // Assuming the tokens array order roughly correlates to addition order
  // or at least presence.
  for (let i = tokens.length - 1; i >= 0 && recent.length < limit; i--) {
    const token = tokens[i];
    if (!uniqueSrcs.has(token.src)) {
      uniqueSrcs.add(token.src);
      // Find corresponding library item
      const libraryItem = library.find((item) => item.src === token.src);
      if (libraryItem) {
        recent.push(libraryItem);
      }
    }
  }
  return recent;
}

/**
 * Gets player/PC tokens from the library (tokens marked with type 'PC')
 * sorted by date added (most recent first).
 *
 * @param library - The token library
 * @param limit - Max number of player tokens to return (default 5)
 * @returns Array of player tokens
 */
export function getPlayerTokens(library: LibraryItem[], limit: number = 5): LibraryItem[] {
  return library
    .filter((item) => item.defaultType === 'PC' || item.category === 'PC')
    .sort((a, b) => b.dateAdded - a.dateAdded) // Most recent first
    .slice(0, limit);
}

/**
 * Deduplicates player tokens by removing any that appear in the recent tokens list.
 * This prevents the same token from showing up twice in the Quick Access sidebar.
 *
 * @param playerTokens - Array of player tokens from library
 * @param recentTokens - Array of recently used tokens
 * @returns Deduplicated player tokens
 */
export function deduplicatePlayerTokens(
  playerTokens: LibraryItem[],
  recentTokens: LibraryItem[],
): LibraryItem[] {
  const recentSrcs = new Set(recentTokens.map((token) => token.src));
  return playerTokens.filter((token) => !recentSrcs.has(token.src));
}
