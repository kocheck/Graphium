import { useState, useEffect, useRef } from 'react';
import { Circle, Group, Text, Line } from 'react-konva';
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
  onPositionChange?: (id: string, x: number, y: number) => void;
  allTokens?: Array<{ id: string; x: number; y: number; size: number }>;
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
 * - Drag trail effect (motion blur while dragging)
 * - Token collision physics (bounce off other tokens)
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
  onPositionChange,
  allTokens = [],
}: PlaygroundTokenProps) {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [idleOffset, setIdleOffset] = useState(0);
  const [hintPulse, setHintPulse] = useState(0.4);
  const [trailPoints, setTrailPoints] = useState<number[]>([]);
  const groupRef = useRef<Konva.Group>(null);
  const lastPositionRef = useRef({ x: initialX, y: initialY });
  const animationFrameRef = useRef<number | null>(null);
  const hintAnimationFrameRef = useRef<number | null>(null);

  // Idle breathing animation
  useEffect(() => {
    const amplitude = 3; // pixels
    const frequency = 2000; // milliseconds
    const startTime = Date.now();

    const animate = () => {
      if (!isDragging) {
        const elapsed = Date.now() - startTime;
        const offset = Math.sin((elapsed / frequency) * Math.PI * 2) * amplitude;
        setIdleOffset(offset);
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isDragging]);

  // Hint pulse animation (only when showHint is true)
  useEffect(() => {
    if (!showHint) return;

    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const pulse = 0.4 + Math.sin(elapsed / 500) * 0.2;
      setHintPulse(pulse);
      hintAnimationFrameRef.current = requestAnimationFrame(animate);
    };

    hintAnimationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (hintAnimationFrameRef.current !== null) {
        cancelAnimationFrame(hintAnimationFrameRef.current);
      }
    };
  }, [showHint]);

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

  // Clear trail when not dragging
  useEffect(() => {
    if (!isDragging) {
      setTrailPoints([]);
    }
  }, [isDragging]);

  const handleDragStart = () => {
    setIsDragging(true);
    lastPositionRef.current = position;
  };

  const handleDragMove = (e: any) => {
    const node = e.target;
    const newX = node.x();
    const newY = node.y();

    // Update trail (keep last 10 positions for smooth trail)
    const centerX = newX;
    const centerY = newY;

    setTrailPoints(prev => {
      const newPoints = [...prev, centerX, centerY];
      // Keep only last 10 positions (20 values: x,y pairs)
      return newPoints.slice(-20);
    });

    // Collision detection with other tokens
    // Note: Applied during drag for smooth, real-time physics feedback
    // Konva's drag system naturally throttles these events, preventing performance issues
    if (allTokens.length > 1) { // Optimize: skip if only self exists
      const radius = size / 2;

      allTokens.forEach(other => {
        if (other.id === id) return; // Skip self

        const dx = newX - other.x;
        const dy = newY - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = radius + (other.size / 2);

        // If colliding, gently push this token away
        if (distance < minDistance && distance > 0) {
          const pushDistance = (minDistance - distance) * 0.5; // Damping factor to reduce jitter
          const angle = Math.atan2(dy, dx);
          const pushX = Math.cos(angle) * pushDistance;
          const pushY = Math.sin(angle) * pushDistance;

          node.x(newX + pushX);
          node.y(newY + pushY);
        }
      });
    }

    lastPositionRef.current = { x: node.x(), y: node.y() };
  };

  const handleDragEnd = (e: any) => {
    setIsDragging(false);
    const finalX = e.target.x();
    const finalY = e.target.y();

    setPosition({
      x: finalX,
      y: finalY,
    });

    // Notify parent of position change for collision tracking
    if (onPositionChange) {
      onPositionChange(id, finalX, finalY);
    }
  };

  const scale = isDragging ? 1.15 : isHovered ? 1.05 : 1;
  const shadowBlur = isDragging ? 20 : isHovered ? 10 : showHint ? 15 : 5;

  return (
    <>
      {/* Drag trail effect - rendered separately so it doesn't move with the group */}
      {isDragging && trailPoints.length > 2 && (
        <Line
          points={trailPoints}
          stroke={color}
          strokeWidth={size / 3}
          tension={0.5}
          lineCap="round"
          lineJoin="round"
          opacity={0.3}
          listening={false}
          globalCompositeOperation="lighter"
        />
      )}

      <Group
        ref={groupRef}
        id={id}
        x={position.x}
        y={position.y + idleOffset}
        draggable
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
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
            opacity={hintPulse}
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
    </>
  );
}
