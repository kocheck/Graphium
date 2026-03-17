/**
 * DrawingLayer — renders all completed freehand strokes from the store.
 *
 * Reads `drawings` from gameStore and renders each non-door drawing as a
 * PressureSensitiveLine. PressureSensitiveLine returns null from JSX but
 * imperatively manages a PixiJS Mesh on worldContainer, so rendering a
 * Fragment of them here is the correct pattern.
 *
 * Door objects are handled by DoorLayer in Phase 5; they live in a separate
 * `doors` array on the store and never appear in `drawings`.
 */

import type React from 'react';

import PressureSensitiveLine from './PressureSensitiveLine';
import { useGameStore } from '../../store/gameStore';

import type { Container } from 'pixi.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DrawingLayerProps {
  /** PixiJS Container that PressureSensitiveLine meshes are added to */
  worldContainer: Container | null;
  /** Grid cell size in pixels (passed through for future per-layer scaling) */
  gridSize: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DrawingLayer({
  worldContainer,
  gridSize: _gridSize,
}: DrawingLayerProps): React.JSX.Element {
  const drawings = useGameStore((s) => s.drawings);

  return (
    <>
      {drawings.map((drawing) => (
        <PressureSensitiveLine
          key={drawing.id}
          id={drawing.id}
          points={drawing.points}
          pressures={drawing.pressures}
          stroke={drawing.color}
          strokeWidth={drawing.size}
          worldContainer={worldContainer}
        />
      ))}
    </>
  );
}

export default DrawingLayer;
