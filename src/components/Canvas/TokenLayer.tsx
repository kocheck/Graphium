/**
 * TokenLayer — PixiJS Sprite-based token rendering
 *
 * Renders each token as a PixiJS Sprite loaded via TextureCache (deduplication).
 * Returns null — all rendering is imperative via PixiJS, not React DOM.
 *
 * Token images use the `src` field from the Token domain type (file:// or https:// URL).
 * Scale is resolved via resolveTokenData to merge instance overrides with library defaults.
 */

import { useEffect, useRef } from 'react';

// @pixi-essentials/transformer v3 targets PixiJS v6 types; `as any` casts bridge v8 compat
import { Transformer } from '@pixi-essentials/transformer';
import { Container, Sprite } from 'pixi.js';
import { useShallow } from 'zustand/shallow';

import { getOrLoadTexture } from './TextureCache';
import { resolveTokenData } from '../../hooks/useTokenData';
import { useGameStore } from '../../store/gameStore';

import type { Container as PixiContainer, Texture } from 'pixi.js';

interface TokenLayerProps {
  worldContainer: PixiContainer | null;
  gridSize: number;
  selectedIds?: string[];
}

export function TokenLayer({ worldContainer, gridSize, selectedIds = [] }: TokenLayerProps): null {
  const tokens = useGameStore((s) => s.tokens);
  const tokenLibrary = useGameStore(useShallow((s) => s.campaign.tokenLibrary));

  const containerRef = useRef<PixiContainer | null>(null);
  const spritesRef = useRef<Map<string, Sprite>>(new Map());
  const pendingRef = useRef<Set<string>>(new Set());
  const transformerRef = useRef<Transformer | null>(null);

  // Mount / unmount the token container alongside worldContainer
  useEffect(() => {
    if (!worldContainer) {
      return;
    }
    const c = new Container();
    c.zIndex = 50;
    worldContainer.addChild(c);
    containerRef.current = c;
    // Capture the sprites map at effect time so cleanup uses the stable reference
    const sprites = spritesRef.current;
    return () => {
      // Clean up transformer before destroying the container
      if (transformerRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        c.removeChild(transformerRef.current as any);
        transformerRef.current.destroy();
        transformerRef.current = null;
      }
      worldContainer.removeChild(c);
      c.destroy({ children: true });
      containerRef.current = null;
      sprites.clear();
    };
  }, [worldContainer]);

  // Sync sprites with token state changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // Resolve each token (merges instance overrides with library defaults)
    const resolved = tokens.map((t) => resolveTokenData(t, tokenLibrary));
    const currentIds = new Set(resolved.map((t) => t.id));

    // Remove sprites for deleted tokens
    for (const [id, sprite] of spritesRef.current) {
      if (!currentIds.has(id)) {
        container.removeChild(sprite);
        sprite.destroy();
        spritesRef.current.delete(id);
        pendingRef.current.delete(id);
      }
    }

    // Add / update sprites
    resolved.forEach((token) => {
      const existing = spritesRef.current.get(token.id);
      const size = gridSize * token.scale;

      if (!existing && token.src) {
        // Capture the target container before the async call to detect stale closures
        const targetContainer = container;
        pendingRef.current.add(token.id);
        void getOrLoadTexture(token.src).then((texture: Texture) => {
          // Guard: bail out if the token was deleted while loading
          if (!pendingRef.current.has(token.id)) {
            return;
          }
          // Guard: bail out if a different container has since been mounted (stale closure)
          if (containerRef.current !== targetContainer) {
            return;
          }
          const sprite = new Sprite(texture);
          sprite.width = size;
          sprite.height = size;
          sprite.position.set(token.x, token.y);
          sprite.eventMode = 'static';
          sprite.cursor = 'pointer';
          targetContainer.addChild(sprite);
          spritesRef.current.set(token.id, sprite);
          pendingRef.current.delete(token.id);
        });
      } else if (existing) {
        existing.width = size;
        existing.height = size;
        existing.position.set(token.x, token.y);
      }
    });
  }, [tokens, tokenLibrary, gridSize]);

  // Sync transformer handles with the current selection
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // Remove the existing transformer before rebuilding
    if (transformerRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      container.removeChild(transformerRef.current as any);
      transformerRef.current.destroy();
      transformerRef.current = null;
    }

    if (selectedIds.length === 0) {
      return;
    }

    const selectedSprites = selectedIds
      .map((id) => spritesRef.current.get(id))
      .filter((s): s is Sprite => s !== undefined);

    if (selectedSprites.length === 0) {
      return;
    }

    // @pixi-essentials/transformer v3 uses PixiJS v6 DisplayObject type; v8 Sprite is runtime-compatible
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
    const transformer: Transformer = new Transformer({ group: selectedSprites as any });
    container.addChild(transformer as any);
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
    transformerRef.current = transformer;
  }, [selectedIds]);

  return null;
}

export default TokenLayer;
