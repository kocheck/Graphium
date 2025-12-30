import { useState, useEffect, useRef } from 'react';
import { Circle, Group, Text } from 'react-konva';
import Konva from 'konva';

interface PlaygroundTokenProps {
  id: string;
  x: number;
  y: number;
  color: string;
  label: string;
  size?: number;
  flavorText?: string;
  easterEggTrigger?: number;
  showHint?: boolean;
}

/**
 * PlaygroundToken - Enhanced draggable token for the HomeScreen demo
 *
 * Features:
 * - Draggable with hover effects
 * - Subtle idle breathing animation
 * - Easter egg celebration animation
 * - Optional pulsing hint for discoverability
 * - Flavor text on hover (via HTML tooltip)
 */
export function PlaygroundToken({
  id,
  x: initialX,
  y: initialY,
  color,
  label,
  size = 40,
  flavorText,
  easterEggTrigger = 0,
  showHint = false,
}: PlaygroundTokenProps) {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [idleOffset, setIdleOffset] = useState(0);
  const groupRef = useRef<Konva.Group>(null);

  // Idle breathing animation
  useEffect(() => {
    const amplitude = 3; // pixels
    const frequency = 2000; // milliseconds
    let startTime = Date.now();

    const animate = () => {
      if (!isDragging) {
        const elapsed = Date.now() - startTime;
        const offset = Math.sin((elapsed / frequency) * Math.PI * 2) * amplitude;
        setIdleOffset(offset);
      }
      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isDragging]);

  // Easter egg celebration animation
  useEffect(() => {
    if (easterEggTrigger > 0 && groupRef.current) {
      const group = groupRef.current;

      // Jump animation
      const jumpTween = new Konva.Tween({
        node: group,
        duration: 0.3,
        y: group.y() - 40,
        easing: Konva.Easings.EaseOut,
        onFinish: () => {
          // Land animation
          new Konva.Tween({
            node: group,
            duration: 0.2,
            y: position.y,
            easing: Konva.Easings.BounceEaseOut,
          }).play();
        },
      });

      jumpTween.play();
    }
  }, [easterEggTrigger, position.y]);

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
  const shadowBlur = isDragging ? 20 : isHovered ? 10 : showHint ? 15 : 5;

  return (
    <Group
      ref={groupRef}
      id={id}
      x={position.x}
      y={position.y + idleOffset}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hint pulsing outer glow */}
      {showHint && (
        <Circle
          radius={size / 2 + 8}
          stroke={color}
          strokeWidth={3}
          opacity={0.4 + Math.sin(Date.now() / 500) * 0.2}
          listening={false}
        />
      )}

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

      {/* Flavor text on hover */}
      {isHovered && flavorText && (
        <Text
          text={flavorText}
          fontSize={10}
          fontFamily="IBM Plex Sans, sans-serif"
          fill="#fff"
          fontStyle="italic"
          align="center"
          width={size * 4}
          x={-size * 2}
          y={-size - 30}
          listening={false}
          padding={6}
          shadowColor="rgba(0, 0, 0, 0.9)"
          shadowBlur={8}
          opacity={0.95}
        />
      )}
    </Group>
  );
}
