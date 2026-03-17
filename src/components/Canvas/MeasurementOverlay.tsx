/**
 * Measurement Overlay Component
 *
 * Renders temporary measurement shapes on the canvas for distance and AoE calculations.
 * Supports three modes: Ruler (line), Blast (circle), and Cone (triangle).
 *
 * **Features:**
 * - Semi-transparent shapes with solid borders
 * - Real-time distance/radius display
 * - Grid-based measurements (1 square = 5ft)
 * - D&D 5e diagonal distance rules (optional)
 * - Broadcast to World View (DM only)
 *
 * **Usage:**
 * ```tsx
 * <MeasurementOverlay
 *   worldContainer={worldContainer}
 *   measurement={activeMeasurement}
 *   gridSize={50}
 * />
 * ```
 */

import { useEffect, useRef } from 'react';

import { Container, Graphics, Text, TextStyle } from 'pixi.js';

import { formatDistance, formatRadius, formatCone } from '../../utils/measurement';
import { parseRgba } from '../../utils/pixiColor';

import type { Measurement } from '../../types/measurement';
import type { Container as PixiContainer } from 'pixi.js';

const MEASUREMENT_COLORS = {
  fill: 'rgba(140, 105, 20, 0.25)', // --app-measurement-fill
  stroke: 'rgba(140, 105, 20, 1)', // --app-measurement-stroke
  text: '#f7edda', // --app-measurement-text
  textBg: 'rgba(28, 16, 7, 0.75)', // --app-measurement-text-bg
} as const;

interface MeasurementOverlayProps {
  /** PixiJS world container to attach graphics to */
  worldContainer: PixiContainer | null;

  /** Active measurement to display (null = no measurement) */
  measurement: Measurement | null;

  /** Grid size in pixels (for positioning text) */
  gridSize: number;

  /** Fill color (default: semi-transparent brass) */
  fillColor?: string;

  /** Stroke color (default: solid brass) */
  strokeColor?: string;

  /** Stroke width (default: 2) */
  strokeWidth?: number;

  /** Text color (default: parchment) */
  textColor?: string;

  /** Text background color (kept in interface for API compatibility; not used in PixiJS Text) */
  textBgColor?: string;
}

/**
 * Adds a PixiJS Text label to a container at the given position.
 */
function addLabel(c: PixiContainer, text: string, x: number, y: number, textColor: string): void {
  const label = new Text({
    text,
    style: new TextStyle({ fontSize: 16, fontWeight: 'bold', fill: textColor }),
  });
  label.x = x;
  label.y = y;
  c.addChild(label);
}

/**
 * Draws a ruler (line) shape + distance label.
 */
function drawRuler(
  c: PixiContainer,
  measurement: Extract<Measurement, { type: 'ruler' }>,
  gridSize: number,
  strokeColor: string,
  strokeWidth: number,
  textColor: string,
): void {
  const { origin, end, distanceFeet } = measurement;
  const stroke = parseRgba(strokeColor);

  const gfx = new Graphics();
  gfx.moveTo(origin.x, origin.y);
  gfx.lineTo(end.x, end.y);
  gfx.stroke({ color: stroke.color, alpha: stroke.alpha, width: strokeWidth, cap: 'round' });
  c.addChild(gfx);

  const midX = (origin.x + end.x) / 2;
  const midY = (origin.y + end.y) / 2;
  addLabel(c, formatDistance(distanceFeet), midX - gridSize, midY - 20, textColor);
}

/**
 * Draws a blast (circle) shape + center dot + radius label.
 */
function drawBlast(
  c: PixiContainer,
  measurement: Extract<Measurement, { type: 'blast' }>,
  gridSize: number,
  fillColor: string,
  strokeColor: string,
  strokeWidth: number,
  textColor: string,
): void {
  const { origin, radius, radiusFeet } = measurement;
  const fill = parseRgba(fillColor);
  const stroke = parseRgba(strokeColor);

  // Main circle
  const gfx = new Graphics();
  gfx.circle(origin.x, origin.y, radius);
  gfx.fill({ color: fill.color, alpha: fill.alpha });
  gfx.stroke({ color: stroke.color, alpha: stroke.alpha, width: strokeWidth });
  c.addChild(gfx);

  // Center dot
  const dot = new Graphics();
  dot.circle(origin.x, origin.y, 4);
  dot.fill({ color: stroke.color, alpha: stroke.alpha });
  c.addChild(dot);

  const textX = origin.x - gridSize;
  const textY = origin.y - radius - 20;
  addLabel(c, formatRadius(radiusFeet), textX, textY, textColor);
}

/**
 * Draws a cone (triangle) shape + origin dot + cone label.
 */
function drawCone(
  c: PixiContainer,
  measurement: Extract<Measurement, { type: 'cone' }>,
  gridSize: number,
  fillColor: string,
  strokeColor: string,
  strokeWidth: number,
  textColor: string,
): void {
  const [origin, left, right] = measurement.vertices;
  const { lengthFeet, angleDegrees } = measurement;
  const fill = parseRgba(fillColor);
  const stroke = parseRgba(strokeColor);

  // Cone polygon
  const gfx = new Graphics();
  gfx.poly([origin, left, right], true);
  gfx.fill({ color: fill.color, alpha: fill.alpha });
  gfx.stroke({ color: stroke.color, alpha: stroke.alpha, width: strokeWidth });
  c.addChild(gfx);

  // Origin dot
  const dot = new Graphics();
  dot.circle(origin.x, origin.y, 4);
  dot.fill({ color: stroke.color, alpha: stroke.alpha });
  c.addChild(dot);

  const textX = (left.x + right.x) / 2 - gridSize;
  const textY = (left.y + right.y) / 2;
  addLabel(c, formatCone(lengthFeet, angleDegrees), textX, textY, textColor);
}

/**
 * MeasurementOverlay — PixiJS imperative measurement rendering.
 *
 * Returns null (imperative pattern): all drawing happens via PixiJS
 * Graphics objects added/removed from worldContainer.
 */
export function MeasurementOverlay({
  worldContainer,
  measurement,
  gridSize,
  fillColor = MEASUREMENT_COLORS.fill,
  strokeColor = MEASUREMENT_COLORS.stroke,
  strokeWidth = 2,
  textColor = MEASUREMENT_COLORS.text,
  textBgColor: _textBgColor = MEASUREMENT_COLORS.textBg, // kept for API compatibility
}: MeasurementOverlayProps): null {
  const containerRef = useRef<PixiContainer | null>(null);

  // Mount/unmount layer container alongside worldContainer
  useEffect(() => {
    if (!worldContainer) {
      return;
    }

    const c = new Container();
    c.zIndex = 150;
    worldContainer.addChild(c);
    containerRef.current = c;

    return () => {
      worldContainer.removeChild(c);
      c.destroy({ children: true });
      containerRef.current = null;
    };
  }, [worldContainer]);

  // Redraw whenever measurement or display props change
  useEffect(() => {
    const c = containerRef.current;
    if (!c) {
      return;
    }

    // Clear previous frame
    c.removeChildren().forEach((child) => child.destroy({ children: true }));

    if (!measurement) {
      return;
    }

    switch (measurement.type) {
      case 'ruler':
        drawRuler(c, measurement, gridSize, strokeColor, strokeWidth, textColor);
        break;
      case 'blast':
        drawBlast(c, measurement, gridSize, fillColor, strokeColor, strokeWidth, textColor);
        break;
      case 'cone':
        drawCone(c, measurement, gridSize, fillColor, strokeColor, strokeWidth, textColor);
        break;
      default:
        // Unknown measurement type — render nothing
        break;
    }
  }, [measurement, gridSize, fillColor, strokeColor, strokeWidth, textColor]);

  return null;
}

export default MeasurementOverlay;
