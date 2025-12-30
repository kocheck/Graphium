import { useState } from 'react';
import { Circle, Group, Text } from 'react-konva';

interface PlaygroundTokenProps {
  id: string;
  x: number;
  y: number;
  color: string;
  label: string;
  size?: number;
}

/**
 * PlaygroundToken - A simple draggable token for the HomeScreen demo
 *
 * Provides a delightful interactive element on the landing page
 * to showcase the app's core drag-and-drop functionality.
 * These tokens don't persist or affect actual game state.
 */
export function PlaygroundToken({
  id,
  x: initialX,
  y: initialY,
  color,
  label,
  size = 40,
}: PlaygroundTokenProps) {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (e: any) => {
    setIsDragging(false);
    setPosition({
      x: e.target.x(),
      y: e.target.y(),
    });
  };

  const scale = isDragging ? 1.15 : isHovered ? 1.05 : 1;
  const shadowBlur = isDragging ? 20 : isHovered ? 10 : 5;

  return (
    <Group
      id={id}
      x={position.x}
      y={position.y}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Token circle */}
      <Circle
        radius={size / 2}
        fill={color}
        stroke="#fff"
        strokeWidth={2}
        shadowColor="rgba(0, 0, 0, 0.5)"
        shadowBlur={shadowBlur}
        shadowOffset={{ x: 0, y: 2 }}
        scaleX={scale}
        scaleY={scale}
        opacity={isDragging ? 0.8 : 1}
      />

      {/* Token label */}
      <Text
        text={label}
        fontSize={12}
        fontFamily="IBM Plex Sans, sans-serif"
        fill="#fff"
        fontStyle="bold"
        align="center"
        verticalAlign="middle"
        width={size * 2}
        x={-size}
        y={size / 2 + 8}
        listening={false}
        shadowColor="rgba(0, 0, 0, 0.8)"
        shadowBlur={4}
        scaleX={scale}
        scaleY={scale}
      />
    </Group>
  );
}
