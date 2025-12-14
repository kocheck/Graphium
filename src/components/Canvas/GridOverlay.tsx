import React from 'react';
import { Group, Line, Circle } from 'react-konva';

interface GridOverlayProps {
  visibleBounds: { x: number; y: number; width: number; height: number };
  gridSize: number;
  stroke?: string;
  opacity?: number;
  type?: 'LINES' | 'DOTS' | 'HIDDEN';
}

const GridOverlay: React.FC<GridOverlayProps> = ({
  visibleBounds,
  gridSize,
  stroke = '#222',
  opacity = 0.5,
  type = 'LINES'
}) => {
  if (type === 'HIDDEN') return null;

  const elements = [];
  const { x, y, width, height } = visibleBounds || { x: 0, y: 0, width: 0, height: 0 };

  // Calculate start and end grid numbers based on visible bounds
  // We want to draw lines covering the visible area.
  // Start X = first multiple of gridSize <= x
  const startX = Math.floor(x / gridSize) * gridSize;
  const endX = Math.ceil((x + width) / gridSize) * gridSize;

  const startY = Math.floor(y / gridSize) * gridSize;
  const endY = Math.ceil((y + height) / gridSize) * gridSize;

  if (type === 'LINES') {
    // Vertical lines
    for (let ix = startX; ix <= endX; ix += gridSize) {
      elements.push(
        <Line
          key={`v-${ix}`}
          points={[ix, y, ix, y + height]} // Draw from top of view to bottom
          stroke={stroke}
          strokeWidth={1}
          opacity={opacity}
        />
      );
    }

    // Horizontal lines
    for (let iy = startY; iy <= endY; iy += gridSize) {
      elements.push(
        <Line
          key={`h-${iy}`}
          points={[x, iy, x + width, iy]}
          stroke={stroke}
          strokeWidth={1}
          opacity={opacity}
        />
      );
    }
  } else if (type === 'DOTS') {
    // Render dots at intersections
    for (let ix = startX; ix <= endX; ix += gridSize) {
      for (let iy = startY; iy <= endY; iy += gridSize) {
        elements.push(
          <Circle
            key={`dot-${ix}-${iy}`}
            x={ix}
            y={iy}
            radius={2}
            fill={stroke}
            opacity={opacity}
          />
        );
      }
    }
  }

  return <Group listening={false}>{elements}</Group>;
};

export default GridOverlay;
