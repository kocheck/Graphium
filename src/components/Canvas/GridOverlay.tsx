import React from 'react';
import { Group, Line, Circle } from 'react-konva';

interface GridOverlayProps {
  width: number;
  height: number;
  gridSize: number;
  stroke?: string;
  opacity?: number;
  type?: 'LINES' | 'DOTS' | 'HIDDEN';
}

const GridOverlay: React.FC<GridOverlayProps> = ({
  width,
  height,
  gridSize,
  stroke = '#222',
  opacity = 0.5,
  type = 'LINES'
}) => {
  if (type === 'HIDDEN') return null;

  const elements = [];

  if (type === 'LINES') {
    // Vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      elements.push(
        <Line
          key={`v-${x}`}
          points={[x, 0, x, height]}
          stroke={stroke}
          strokeWidth={1}
          opacity={opacity}
        />
      );
    }

    // Horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      elements.push(
        <Line
          key={`h-${y}`}
          points={[0, y, width, y]}
          stroke={stroke}
          strokeWidth={1}
          opacity={opacity}
        />
      );
    }
  } else if (type === 'DOTS') {
    // Render dots at intersections
    for (let x = 0; x <= width; x += gridSize) {
      for (let y = 0; y <= height; y += gridSize) {
        elements.push(
          <Circle
            key={`dot-${x}-${y}`}
            x={x}
            y={y}
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
