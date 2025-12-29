import { useMemo } from 'react';
import { Token, TokenLibraryItem } from '../store/gameStore';
import { useGameStore } from '../store/gameStore';

/**
 * ResolvedTokenData represents the fully resolved token data after merging
 * instance overrides with library prototype defaults.
 *
 * All optional properties from Token are now required, as they've been resolved
 * to either the instance value, library default, or system default.
 */
export interface ResolvedTokenData {
  id: string;
  x: number;
  y: number;
  src: string;
  scale: number;
  type: 'PC' | 'NPC' | undefined;
  visionRadius: number | undefined;
  name: string;
  libraryItemId?: string;
  // Metadata for tracking if values are inherited vs overridden (useful for UI)
  _isInherited: {
    scale: boolean;
    type: boolean;
    visionRadius: boolean;
    name: boolean;
  };
}

/**
 * useTokenData - Hook to resolve token data by merging instance with library defaults
 *
 * Implements the Prototype/Instance pattern:
 * 1. If token has libraryItemId, lookup the library item
 * 2. For each property (scale, type, visionRadius, name):
 *    - Use instance value if explicitly set (not undefined)
 *    - Otherwise fall back to library default
 *    - Otherwise fall back to system default
 * 3. Return fully resolved token data
 *
 * @param token - The token instance from the map
 * @returns Fully resolved token data with all properties populated
 *
 * @example
 * const resolvedToken = useTokenData(token);
 * // resolvedToken.scale is either token.scale or libraryItem.defaultScale or 1
 * // resolvedToken.name is either token.name or libraryItem.name
 */
export function useTokenData(token: Token): ResolvedTokenData {
  const tokenLibrary = useGameStore((state) => state.campaign.tokenLibrary);

  return useMemo(() => {
    // Find the library item if this token references one
    const libraryItem: TokenLibraryItem | undefined = token.libraryItemId
      ? tokenLibrary.find((item) => item.id === token.libraryItemId)
      : undefined;

    // System defaults (fallback when both instance and library don't specify)
    const DEFAULT_SCALE = 1;
    const DEFAULT_NAME = 'Token';

    // Resolve each property using instance override > library default > system default
    const resolvedScale = token.scale ?? libraryItem?.defaultScale ?? DEFAULT_SCALE;
    const resolvedType = token.type ?? libraryItem?.defaultType;
    const resolvedVisionRadius = token.visionRadius ?? libraryItem?.defaultVisionRadius;
    const resolvedName = token.name ?? libraryItem?.name ?? DEFAULT_NAME;

    return {
      id: token.id,
      x: token.x,
      y: token.y,
      src: token.src,
      scale: resolvedScale,
      type: resolvedType,
      visionRadius: resolvedVisionRadius,
      name: resolvedName,
      libraryItemId: token.libraryItemId,
      _isInherited: {
        scale: token.scale === undefined && libraryItem?.defaultScale !== undefined,
        type: token.type === undefined && libraryItem?.defaultType !== undefined,
        visionRadius: token.visionRadius === undefined && libraryItem?.defaultVisionRadius !== undefined,
        name: token.name === undefined && libraryItem?.name !== undefined,
      },
    };
  }, [token, tokenLibrary]);
}

/**
 * Utility function (non-hook version) for resolving token data
 * Use this when you can't use hooks (e.g., in store actions or utilities)
 *
 * @param token - The token instance
 * @param tokenLibrary - The array of library items
 * @returns Fully resolved token data
 */
export function resolveTokenData(token: Token, tokenLibrary: TokenLibraryItem[]): ResolvedTokenData {
  const libraryItem = token.libraryItemId
    ? tokenLibrary.find((item) => item.id === token.libraryItemId)
    : undefined;

  const DEFAULT_SCALE = 1;
  const DEFAULT_NAME = 'Token';

  const resolvedScale = token.scale ?? libraryItem?.defaultScale ?? DEFAULT_SCALE;
  const resolvedType = token.type ?? libraryItem?.defaultType;
  const resolvedVisionRadius = token.visionRadius ?? libraryItem?.defaultVisionRadius;
  const resolvedName = token.name ?? libraryItem?.name ?? DEFAULT_NAME;

  return {
    id: token.id,
    x: token.x,
    y: token.y,
    src: token.src,
    scale: resolvedScale,
    type: resolvedType,
    visionRadius: resolvedVisionRadius,
    name: resolvedName,
    libraryItemId: token.libraryItemId,
    _isInherited: {
      scale: token.scale === undefined && libraryItem?.defaultScale !== undefined,
      type: token.type === undefined && libraryItem?.defaultType !== undefined,
      visionRadius: token.visionRadius === undefined && libraryItem?.defaultVisionRadius !== undefined,
      name: token.name === undefined && libraryItem?.name !== undefined,
    },
  };
}
