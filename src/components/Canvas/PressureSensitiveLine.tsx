import { useRef, memo } from 'react';
import { Shape } from 'react-konva';
import Konva from 'konva';

// Import the globalCompositeOperationType from Konva
type GlobalCompositeOperationType = '' | 'source-over' | 'source-in' | 'source-out' | 'source-atop' | 'destination-over' | 'destination-in' | 'destination-out' | 'destination-atop' | 'lighter' | 'copy' | 'xor' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';

interface PressureSensitiveLineProps {
  id?: string;
  name?: string;
  points: number[]; // [x1, y1, x2, y2, ...]
  pressures?: number[]; // [p1, p2, p3, ...] Optional pressure values (0.0-1.0)
  stroke: string;
  strokeWidth: number; // Base stroke width (multiplied by pressure)
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  globalCompositeOperation?: GlobalCompositeOperationType;
  opacity?: number;
  listening?: boolean;
  scale?: { x: number; y: number }; // Legacy support (use scaleX/scaleY instead)
  scaleX?: number;
  scaleY?: number;
  x?: number;
  y?: number;
  pressureRange?: { min: number; max: number }; // Pressure multiplier range from settings
}

/**
 * Validate pressure data matches point count
 * Returns null if invalid, otherwise returns validated pressures
 */
function validatePressureData(points: number[], pressures?: number[]): number[] | null {
  if (!pressures || pressures.length === 0) {
    return null; // No pressure data - use regular line
  }

  const expectedLength = points.length / 2;

  if (pressures.length !== expectedLength) {
    if (import.meta.env.DEV) {
      console.warn(
        `[PressureSensitiveLine] Pressure array length mismatch. ` +
        `Expected ${expectedLength} pressure values for ${points.length / 2} points, ` +
        `but got ${pressures.length}. Falling back to regular line.`
      );
    }
    return null;
  }

  // Validate pressure values are in 0-1 range
  const hasInvalidPressure = pressures.some(p => p < 0 || p > 1 || !Number.isFinite(p));
  if (hasInvalidPressure) {
    if (import.meta.env.DEV) {
      console.warn(
        `[PressureSensitiveLine] Invalid pressure values detected. ` +
        `All pressures must be between 0.0 and 1.0. Falling back to regular line.`
      );
    }
    return null;
  }

  return pressures;
}

/**
 * PressureSensitiveLine Component
 *
 * Renders a line with variable stroke width based on pointer pressure.
 * Automatically falls back to regular line rendering if pressure data is
 * invalid or not provided.
 *
 * Performance optimizations:
 * - Memoized to prevent unnecessary re-renders
 * - Validates pressure data once per render
 * - Uses Konva's Shape sceneFunc for efficient custom rendering
 *
 * @param props - PressureSensitiveLineProps
 * @returns Konva Shape component
 */
const PressureSensitiveLineComponent = ({
  id,
  name,
  points,
  pressures,
  stroke,
  strokeWidth,
  lineCap = 'round',
  lineJoin = 'round',
  globalCompositeOperation,
  opacity,
  listening = false,
  scale,
  scaleX,
  scaleY,
  x,
  y,
  pressureRange = { min: 0.3, max: 1.5 }, // Default to 'normal' curve
}: PressureSensitiveLineProps) => {
  const shapeRef = useRef<Konva.Shape>(null);

  // Validate pressure data
  const validatedPressures = validatePressureData(points, pressures);

  // Custom rendering function for variable-width strokes
  const sceneFunc = (context: Konva.Context, shape: Konva.Shape) => {
    if (points.length < 4) return; // Need at least 2 points

    context.beginPath();
    context.moveTo(points[0], points[1]);

    // Explicitly apply styles since we are using custom drawing
    context.strokeStyle = shape.stroke();
    context.lineCap = shape.lineCap();
    context.lineJoin = shape.lineJoin();

    // If no valid pressure data, render as regular line
    if (!validatedPressures) {
      for (let i = 2; i < points.length; i += 2) {
        context.lineTo(points[i], points[i + 1]);
      }
      context.strokeShape(shape);
      return;
    }

    // Render pressure-sensitive line with variable width
    // We'll draw multiple segments with different stroke widths
    const numPoints = points.length / 2;

    for (let i = 1; i < numPoints; i++) {
      const x1 = points[(i - 1) * 2];
      const y1 = points[(i - 1) * 2 + 1];
      const x2 = points[i * 2];
      const y2 = points[i * 2 + 1];

      const pressure1 = validatedPressures[i - 1] || 0.5;
      const pressure2 = validatedPressures[i] || 0.5;

      // Calculate average pressure for this segment
      const avgPressure = (pressure1 + pressure2) / 2;

      // Vary stroke width based on pressure using configured range
      // Map pressure (0.0-1.0) to multiplier (min-max)
      const pressureMultiplier = pressureRange.min + avgPressure * (pressureRange.max - pressureRange.min);
      const segmentWidth = strokeWidth * pressureMultiplier;

      // Draw line segment with calculated width
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.lineWidth = segmentWidth;
      context.stroke();
    }
  };

  return (
    <Shape
      ref={shapeRef}
      id={id}
      name={name}
      sceneFunc={sceneFunc}
      stroke={stroke}
      strokeWidth={strokeWidth}
      lineCap={lineCap}
      lineJoin={lineJoin}
      globalCompositeOperation={globalCompositeOperation}
      opacity={opacity}
      listening={listening}
      scale={scale}
      scaleX={scaleX}
      scaleY={scaleY}
      x={x}
      y={y}
    />
  );
};

/**
 * Memoized export to prevent unnecessary re-renders when parent components update.
 * Only re-renders if props actually change (points, pressures, stroke, etc.)
 */
const PressureSensitiveLine = memo(PressureSensitiveLineComponent);

PressureSensitiveLine.displayName = 'PressureSensitiveLine';

export default PressureSensitiveLine;
