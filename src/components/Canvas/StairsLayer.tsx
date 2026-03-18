/**
 * StairsLayer — PixiJS Graphics-based staircase rendering
 *
 * Renders all staircases imperatively using PixiJS Graphics. Replaces the
 * previous Konva StairsShape + StairsLayer pair (all drawing inline, no
 * StairsShape component needed).
 *
 * Visual design:
 *   - Filled background rectangle (light gray = up, dark gray = down)
 *   - 4 interior tread lines (horizontal for north/south, vertical for east/west)
 *   - Directional arrow (triangle) pointing in stairs.direction
 *
 * Interaction: none — stairs are static architectural elements.
 *
 * zIndex: 55 (below doors at 60, above tokens at 50)
 */

import { useEffect } from 'react';

import { Graphics } from 'pixi.js';

import { usePixiContainer } from './hooks/usePixiContainer';
import { clearContainer } from '../../utils/pixiUtils';

import type { Stairs } from '../../types/domain';
import type { Container as PixiContainer } from 'pixi.js';

// Stairs rendering colors — sourced from theme tokens (see theme.css).
const STAIRS_COLORS = {
  fillUp: 0xc0c0c0, // --app-stairs-fill-up (light gray)
  fillDown: 0x808080, // --app-stairs-fill-down (dark gray)
  stroke: 0x1c1007, // --app-stairs-stroke (warm ink)
  arrowUp: 0x8c6914, // --app-stairs-arrow-up (antique brass)
  arrowDown: 0xe5484d, // --app-stairs-arrow-down (red)
} as const;

interface StairsLayerProps {
  worldContainer: PixiContainer | null;
  stairs: Stairs[];
}

/**
 * Draws the background filled rectangle for a staircase.
 */
function drawStairsBackground(g: Graphics, stairs: Stairs): void {
  const halfWidth = stairs.width / 2;
  const halfHeight = stairs.height / 2;
  const fillColor = stairs.type === 'up' ? STAIRS_COLORS.fillUp : STAIRS_COLORS.fillDown;

  g.setStrokeStyle({ width: 2, color: STAIRS_COLORS.stroke, alpha: 1 });
  g.rect(-halfWidth, -halfHeight, stairs.width, stairs.height);
  g.fill({ color: fillColor, alpha: 1 });
  g.stroke();
}

/**
 * Draws stair tread lines (4 interior lines showing individual steps).
 */
function drawStairTreads(g: Graphics, stairs: Stairs): void {
  const halfWidth = stairs.width / 2;
  const halfHeight = stairs.height / 2;
  const numSteps = 5;

  g.setStrokeStyle({ width: 1, color: STAIRS_COLORS.stroke, alpha: 0.6 });

  if (stairs.direction === 'north' || stairs.direction === 'south') {
    // Horizontal treads
    const stepHeight = stairs.height / numSteps;
    for (let i = 1; i < numSteps; i++) {
      const y = i * stepHeight - halfHeight;
      g.moveTo(-halfWidth, y);
      g.lineTo(halfWidth, y);
    }
  } else {
    // Vertical treads (east/west)
    const stepWidth = stairs.width / numSteps;
    for (let i = 1; i < numSteps; i++) {
      const x = i * stepWidth - halfWidth;
      g.moveTo(x, -halfHeight);
      g.lineTo(x, halfHeight);
    }
  }
  g.stroke();
}

/**
 * Draws a filled directional arrow triangle indicating which way the stairs face.
 */
function drawDirectionalArrow(g: Graphics, stairs: Stairs): void {
  const arrowColor = stairs.type === 'up' ? STAIRS_COLORS.arrowUp : STAIRS_COLORS.arrowDown;
  const arrowSize = Math.min(stairs.width, stairs.height) * 0.3;

  g.setStrokeStyle({ width: 1, color: STAIRS_COLORS.stroke, alpha: 0.8 });

  switch (stairs.direction) {
    case 'north':
      // Triangle pointing up
      g.moveTo(0, -arrowSize);
      g.lineTo(-arrowSize / 2, 0);
      g.lineTo(arrowSize / 2, 0);
      g.closePath();
      break;
    case 'south':
      // Triangle pointing down
      g.moveTo(0, arrowSize);
      g.lineTo(-arrowSize / 2, 0);
      g.lineTo(arrowSize / 2, 0);
      g.closePath();
      break;
    case 'east':
      // Triangle pointing right
      g.moveTo(arrowSize, 0);
      g.lineTo(0, -arrowSize / 2);
      g.lineTo(0, arrowSize / 2);
      g.closePath();
      break;
    case 'west':
      // Triangle pointing left
      g.moveTo(-arrowSize, 0);
      g.lineTo(0, -arrowSize / 2);
      g.lineTo(0, arrowSize / 2);
      g.closePath();
      break;
    default:
      return;
  }

  g.fill({ color: arrowColor, alpha: 0.8 });
  g.stroke();
}

/**
 * Creates a single staircase Graphics object with all visual elements.
 */
function createStairsGraphics(stairs: Stairs): Graphics {
  const g = new Graphics();
  g.x = stairs.x;
  g.y = stairs.y;

  drawStairsBackground(g, stairs);
  drawStairTreads(g, stairs);
  drawDirectionalArrow(g, stairs);

  return g;
}

export function StairsLayer({ worldContainer, stairs }: StairsLayerProps): null {
  const containerRef = usePixiContainer(worldContainer, 55);

  // Redraw all stairs whenever the stairs array changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // Remove and destroy old graphics
    clearContainer(container);

    for (const stair of stairs) {
      const g = createStairsGraphics(stair);
      container.addChild(g);
    }
  }, [containerRef, stairs]);

  return null;
}

// eslint-disable-next-line import/no-unused-modules
export default StairsLayer;
