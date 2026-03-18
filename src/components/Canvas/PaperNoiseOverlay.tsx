import { useEffect, useRef } from 'react';

import { Assets, TilingSprite } from 'pixi.js';

import type { Container, Texture } from 'pixi.js';

interface PaperNoiseOverlayProps {
  worldContainer: Container | null;
  mapWidth: number;
  mapHeight: number;
  opacity?: number;
  noiseUrl?: string;
}

/**
 * PaperNoiseOverlay - Adds a subtle paper texture over the map background
 *
 * Creates a tiling noise pattern using a PixiJS TilingSprite. When a noiseUrl
 * is provided the texture is loaded via Assets.load and tiled across the full
 * map area. The sprite is non-interactive by default and sits at zIndex 5 so
 * it renders above the map background but beneath tokens and drawings.
 *
 * Any change to mapWidth, mapHeight, opacity, or noiseUrl triggers a full
 * sprite remount so the TilingSprite always reflects the current props.
 *
 * If no noiseUrl is supplied the component renders nothing — the caller is
 * responsible for providing the texture asset.
 */
export function PaperNoiseOverlay({
  worldContainer,
  mapWidth,
  mapHeight,
  opacity = 0.25,
  noiseUrl,
}: PaperNoiseOverlayProps): null {
  const spriteRef = useRef<TilingSprite | null>(null);

  useEffect(() => {
    if (!worldContainer || !noiseUrl) {
      return;
    }

    let cancelled = false;

    void Assets.load<Texture>(noiseUrl).then((texture) => {
      if (cancelled) {
        return;
      }

      const sprite = new TilingSprite({ texture, width: mapWidth, height: mapHeight });
      sprite.zIndex = 5;
      sprite.alpha = opacity;
      sprite.eventMode = 'none';
      worldContainer.addChild(sprite);
      spriteRef.current = sprite;
    });

    return () => {
      cancelled = true;
      const sprite = spriteRef.current;
      if (sprite) {
        worldContainer.removeChild(sprite);
        sprite.destroy();
        spriteRef.current = null;
      }
    };
  }, [worldContainer, mapWidth, mapHeight, opacity, noiseUrl]);

  return null;
}

// eslint-disable-next-line import/no-unused-modules
export default PaperNoiseOverlay;
