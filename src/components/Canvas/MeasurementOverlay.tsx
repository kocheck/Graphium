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
 *   measurement={activeMeasurement}
 *   gridSize={50}
 * />
 * ```
 */

import React from 'react';
import { Group, Line, Circle, Text } from 'react-konva';
import { Measurement } from '../../types/measurement';
import { formatDistance, formatRadius, formatCone } from '../../utils/measurement';

interface MeasurementOverlayProps {
  /** Active measurement to display (null = no measurement) */
  measurement: Measurement | null;

  /** Grid size in pixels (for positioning text) */
  gridSize: number;

  /** Fill color (default: semi-transparent blue) */
  fillColor?: string;

  /** Stroke color (default: solid blue) */
  strokeColor?: string;

  /** Stroke width (default: 2) */
  strokeWidth?: number;

  /** Text color (default: white) */
  textColor?: string;

  /** Text background color (default: semi-transparent black) */
  textBgColor?: string;
}

/**
 * MeasurementOverlay Component
 *
 * Renders the active measurement shape on the canvas
 */
export const MeasurementOverlay: React.FC<MeasurementOverlayProps> = ({
  measurement,
  gridSize,
  fillColor = 'rgba(0, 100, 255, 0.3)',
  strokeColor = 'rgba(0, 100, 255, 1)',
  strokeWidth = 2,
  textColor = '#ffffff',
  textBgColor = 'rgba(0, 0, 0, 0.7)',
}) => {
  if (!measurement) {
    return null;
  }

  /**
   * Renders a ruler (line) measurement
   */
  const renderRuler = (ruler: Extract<Measurement, { type: 'ruler' }>) => {
    const points = [ruler.origin.x, ruler.origin.y, ruler.end.x, ruler.end.y];
    const midX = (ruler.origin.x + ruler.end.x) / 2;
    const midY = (ruler.origin.y + ruler.end.y) / 2;
    const text = formatDistance(ruler.distanceFeet);

    return (
      <Group>
        {/* Line */}
        <Line
          points={points}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          lineCap="round"
        />

        {/* Distance label */}
        <Text
          x={midX - gridSize}
          y={midY - 20}
          width={gridSize * 2}
          text={text}
          fontSize={16}
          fontStyle="bold"
          fill={textColor}
          padding={4}
          align="center"
          shadowColor={textBgColor}
          shadowBlur={4}
          shadowOffset={{ x: 0, y: 0 }}
          shadowOpacity={0.8}
        />
      </Group>
    );
  };

  /**
   * Renders a blast (circle) measurement
   */
  const renderBlast = (blast: Extract<Measurement, { type: 'blast' }>) => {
    const text = formatRadius(blast.radiusFeet);
    const textX = blast.origin.x;
    const textY = blast.origin.y - blast.radius - 20;

    return (
      <Group>
        {/* Circle */}
        <Circle
          x={blast.origin.x}
          y={blast.origin.y}
          radius={blast.radius}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />

        {/* Center point */}
        <Circle
          x={blast.origin.x}
          y={blast.origin.y}
          radius={4}
          fill={strokeColor}
        />

        {/* Radius label */}
        <Text
          x={textX - gridSize}
          y={textY}
          width={gridSize * 2}
          text={text}
          fontSize={16}
          fontStyle="bold"
          fill={textColor}
          padding={6}
          align="center"
          shadowColor={textBgColor}
          shadowBlur={4}
          shadowOffset={{ x: 0, y: 0 }}
          shadowOpacity={0.8}
        />
      </Group>
    );
  };

  /**
   * Renders a cone measurement
   */
  const renderCone = (cone: Extract<Measurement, { type: 'cone' }>) => {
    const [origin, left, right] = cone.vertices;

    // Convert vertices to flat points array for Konva Line
    const points = [
      origin.x, origin.y,
      left.x, left.y,
      right.x, right.y,
    ];

    const text = formatCone(cone.lengthFeet, cone.angleDegrees);
    const textX = (left.x + right.x) / 2;
    const textY = (left.y + right.y) / 2;

    return (
      <Group>
        {/* Cone triangle */}
        <Line
          points={points}
          closed
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          lineJoin="round"
        />

        {/* Origin point */}
        <Circle
          x={origin.x}
          y={origin.y}
          radius={4}
          fill={strokeColor}
        />

        {/* Cone label */}
        <Text
          x={textX - gridSize}
          y={textY}
          width={gridSize * 2}
          text={text}
          fontSize={16}
          fontStyle="bold"
          fill={textColor}
          padding={6}
          align="center"
          shadowColor={textBgColor}
          shadowBlur={4}
          shadowOffset={{ x: 0, y: 0 }}
          shadowOpacity={0.8}
        />
      </Group>
    );
  };

  // Render the appropriate measurement type
  switch (measurement.type) {
    case 'ruler':
      return renderRuler(measurement);
    case 'blast':
      return renderBlast(measurement);
    case 'cone':
      return renderCone(measurement);
    default:
      return null;
  }
};

export default MeasurementOverlay;
