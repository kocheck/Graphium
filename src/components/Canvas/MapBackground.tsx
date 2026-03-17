import { useEffect, useRef } from 'react';

import { Assets, BlurFilter, ColorMatrixFilter, Sprite } from 'pixi.js';

import type { Container, Texture } from 'pixi.js';

interface MapBackgroundProps {
  imageUrl: string | null;
  worldContainer: Container | null;
  brightness?: number;
  blur?: number;
}

/**
 * MapBackground — renders the map background image as a PixiJS Sprite.
 *
 * Returns null (no JSX) — all rendering is imperative PixiJS.
 * Loads the texture via Assets.load, adds a Sprite at zIndex 0 to worldContainer,
 * and applies GPU filters for brightness/blur adjustments.
 *
 * Replaces the Konva-based URLImage for the map background layer.
 */
export function MapBackground({
  imageUrl,
  worldContainer,
  brightness = 1,
  blur = 0,
}: MapBackgroundProps): null {
  const spriteRef = useRef<Sprite | null>(null);

  useEffect(() => {
    if (!worldContainer || !imageUrl) {
      return;
    }

    let cancelled = false;

    void Assets.load<Texture>(imageUrl).then((texture) => {
      if (cancelled) {
        return;
      }

      const sprite = new Sprite(texture);
      sprite.zIndex = 0;

      const filters: Array<ColorMatrixFilter | BlurFilter> = [];
      if (brightness !== 1) {
        const cm = new ColorMatrixFilter();
        cm.brightness(brightness, false);
        filters.push(cm);
      }
      if (blur > 0) {
        filters.push(new BlurFilter({ strength: blur }));
      }
      if (filters.length > 0) {
        sprite.filters = filters;
      }

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
  }, [imageUrl, worldContainer, brightness, blur]);

  return null;
}
