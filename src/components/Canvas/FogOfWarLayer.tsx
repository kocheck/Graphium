/**
 * FogOfWarLayer — PixiJS GPU-accelerated fog of war
 *
 * Renders a full-map Sprite with FogOfWarFilter applied.  The filter's GLSL
 * shader darkens every pixel except those within a token's vision radius,
 * computing radial light contributions entirely on the GPU.
 *
 * Lifecycle: the Sprite + Filter are added to `worldContainer` imperatively
 * inside a useEffect (same pattern as GridOverlay / MapBackground).  This
 * component renders null JSX — all output is PixiJS scene-graph nodes.
 *
 * Props mirror GridOverlay for consistency:
 *   worldContainer — the PixiJS Container that owns world-space children
 *   gridSize       — px per grid cell (used to convert visionRadius feet → UV)
 *   mapWidth/Height — map pixel dimensions (used for UV normalisation)
 *   isDMView       — when true, filter is set to reveal-all (no fog)
 */

import { useEffect, useRef } from 'react';

import { Sprite, Texture } from 'pixi.js';

import { FogOfWarFilter } from './FogOfWarFilter';
import { useGameStore } from '../../store/gameStore';

import type { Container } from 'pixi.js';

// zIndex layering — above TokenLayer (50) but below any HUD overlays
const FOG_Z_INDEX = 100;

interface FogOfWarLayerProps {
  worldContainer: Container | null;
  gridSize: number;
  mapWidth: number;
  mapHeight: number;
  /** When true (DM / Architect view) the fog is fully transparent. */
  isDMView?: boolean;
}

/**
 * FogOfWarLayer renders GPU fog-of-war via a PixiJS Sprite + custom GLSL Filter.
 * Returns null — all rendering is imperative PixiJS scene-graph manipulation.
 */
export function FogOfWarLayer({
  worldContainer,
  gridSize,
  mapWidth,
  mapHeight,
  isDMView = false,
}: FogOfWarLayerProps): null {
  // Only PC tokens with visionRadius > 0 contribute light.
  const tokens = useGameStore((s) => s.tokens);

  const filterRef = useRef<FogOfWarFilter | null>(null);
  const fogSpriteRef = useRef<Sprite | null>(null);

  // --- Mount: create Sprite + Filter and add to worldContainer ---
  useEffect(() => {
    if (!worldContainer) {
      return;
    }

    const filter = new FogOfWarFilter();
    const fogSprite = new Sprite(Texture.WHITE);
    fogSprite.width = mapWidth;
    fogSprite.height = mapHeight;
    fogSprite.zIndex = FOG_Z_INDEX;
    fogSprite.filters = [filter];
    worldContainer.addChild(fogSprite);

    filterRef.current = filter;
    fogSpriteRef.current = fogSprite;

    return () => {
      worldContainer.removeChild(fogSprite);
      fogSprite.destroy();
      filter.destroy();
      filterRef.current = null;
      fogSpriteRef.current = null;
    };
  }, [worldContainer, mapWidth, mapHeight]);

  // --- Update: push light data whenever tokens / map dims / DM mode change ---
  useEffect(() => {
    const filter = filterRef.current;
    if (!filter) {
      return;
    }

    filter.revealAll = isDMView;

    if (isDMView) {
      // No need to compute lights — shader will skip fog entirely.
      return;
    }

    // Token.visionRadius is in feet (5 ft = 1 grid cell).
    // Only PC tokens with vision > 0 cast light.
    const lightTokens = tokens
      .filter((t) => t.type === 'PC' && (t.visionRadius ?? 0) > 0)
      .map((token) => ({
        id: token.id,
        x: token.x,
        y: token.y,
        visionRadius: token.visionRadius ?? 5,
        lightColor: [1.0, 0.85, 0.6] as [number, number, number], // warm torch
      }));

    filter.updateLights(lightTokens, { mapWidth, mapHeight, gridSize });
  }, [tokens, gridSize, mapWidth, mapHeight, isDMView]);

  return null;
}

export default FogOfWarLayer;
