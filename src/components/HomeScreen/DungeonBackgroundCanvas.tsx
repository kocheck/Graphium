import { useEffect, useState, useRef, useMemo } from 'react';
import { Stage, Layer, Rect, Line } from 'react-konva';
import { DungeonGenerator } from '../../utils/DungeonGenerator';
import { Drawing, Door } from '../../store/gameStore';
import PaperNoiseOverlay from '../Canvas/PaperNoiseOverlay';
import FogOfWarLayer from '../Canvas/FogOfWarLayer';
import { ResolvedTokenData } from '../../hooks/useTokenData';
import { isNearDoor } from '../../utils/collisionDetection';

interface DungeonBackgroundCanvasProps {
  width: number;
  height: number;
  tokens: ResolvedTokenData[];
  children?: React.ReactNode;
  onDungeonGenerated?: (drawings: Drawing[], doors: Door[]) => void;
  onDoorStatesChange?: (doors: Door[]) => void;
}

/**
 * DungeonBackgroundCanvas - Renders dynamic dungeon with fog of war for landing page
 *
 * This component generates a randomized dungeon layout and applies fog of war
 * that reveals as demo tokens move around, showcasing Graphium's core features.
 *
 * Features:
 * - Random dungeon generation using DungeonGenerator
 * - Dynamic fog of war with exploration trail
 * - Performance optimized for smooth 60fps scrolling
 * - Fallback to simple layout if generation fails
 */
export function DungeonBackgroundCanvas({
  width,
  height,
  tokens,
  children,
  onDungeonGenerated,
  onDoorStatesChange
}: DungeonBackgroundCanvasProps) {
  const [dimensions, setDimensions] = useState({ width, height });
  const [dungeonDrawings, setDungeonDrawings] = useState<Drawing[]>([]);
  const [dungeonDoors, setDungeonDoors] = useState<Door[]>([]);
  const [generationFailed, setGenerationFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const generationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Grid configuration
  const gridSize = 50;

  const backgroundColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--app-bg-base')
    .trim() || '#1a1a1a';

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Generate dungeon on mount
  useEffect(() => {
    const generateDungeon = () => {
      try {
        console.log('[DungeonBackgroundCanvas] Generating dungeon...');
        const startTime = performance.now();

        // Create generator with moderate complexity for landing page
        const generator = new DungeonGenerator({
          numRooms: 8, // Moderate number - enough to show off, not cluttered
          minRoomSize: 3,
          maxRoomSize: 6, // Smaller rooms for tighter layout
          gridSize,
          canvasWidth: dimensions.width,
          canvasHeight: dimensions.height,
          wallColor: '#ff0000', // Red walls (classic D&D style)
          wallSize: 8,
        });

        const result = generator.generate();
        const generationTime = performance.now() - startTime;

        console.log('[DungeonBackgroundCanvas] Generation complete:', {
          drawings: result.drawings.length,
          doors: result.doors.length,
          generationTime: `${generationTime.toFixed(2)}ms`,
        });

        // Check if generation took too long (> 500ms)
        if (generationTime > 500) {
          console.warn('[DungeonBackgroundCanvas] Generation took too long, using fallback');
          setGenerationFailed(true);
          return;
        }

        setDungeonDrawings(result.drawings);
        setDungeonDoors(result.doors);
        setGenerationFailed(false);

        // Notify parent component
        onDungeonGenerated?.(result.drawings, result.doors);

      } catch (error) {
        console.error('[DungeonBackgroundCanvas] Generation failed:', error);
        setGenerationFailed(true);
      }
    };

    // Only generate if dimensions are valid
    if (dimensions.width > 0 && dimensions.height > 0) {
      // Timeout fallback - if generation doesn't complete in 500ms, use fallback
      generationTimeoutRef.current = setTimeout(() => {
        console.warn('[DungeonBackgroundCanvas] Generation timeout, using fallback');
        setGenerationFailed(true);
      }, 500);

      generateDungeon();

      // Clear timeout if generation completed
      if (generationTimeoutRef.current) {
        clearTimeout(generationTimeoutRef.current);
      }
    }

    return () => {
      if (generationTimeoutRef.current) {
        clearTimeout(generationTimeoutRef.current);
      }
    };
  }, [dimensions.width, dimensions.height]);

  // Fallback dungeon layout (simple cross pattern)
  const fallbackDrawings = useMemo(() => {
    if (!generationFailed) return [];

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const roomSize = gridSize * 6;

    // Create a simple cross-shaped dungeon
    const drawings: Drawing[] = [
      // Center room
      {
        id: 'fallback-wall-1',
        tool: 'wall',
        points: [centerX - roomSize, centerY - roomSize, centerX + roomSize, centerY - roomSize],
        color: '#ff0000',
        size: 8,
      },
      {
        id: 'fallback-wall-2',
        tool: 'wall',
        points: [centerX + roomSize, centerY - roomSize, centerX + roomSize, centerY + roomSize],
        color: '#ff0000',
        size: 8,
      },
      {
        id: 'fallback-wall-3',
        tool: 'wall',
        points: [centerX + roomSize, centerY + roomSize, centerX - roomSize, centerY + roomSize],
        color: '#ff0000',
        size: 8,
      },
      {
        id: 'fallback-wall-4',
        tool: 'wall',
        points: [centerX - roomSize, centerY + roomSize, centerX - roomSize, centerY - roomSize],
        color: '#ff0000',
        size: 8,
      },
    ];

    return drawings;
  }, [generationFailed, dimensions.width, dimensions.height]);

  // Use fallback if generation failed, otherwise use generated dungeon
  const activeDrawings = generationFailed ? fallbackDrawings : dungeonDrawings;
  const [activeDoors, setActiveDoors] = useState<Door[]>([]);

  // Update active doors when dungeon doors change
  useEffect(() => {
    setActiveDoors(generationFailed ? [] : dungeonDoors);
  }, [generationFailed, dungeonDoors]);

  // Door opening mechanic - open doors when tokens get near
  useEffect(() => {
    if (activeDoors.length === 0 || tokens.length === 0) return;

    const interactionRange = gridSize * 1.5; // 1.5 grid cells
    let doorsChanged = false;
    const updatedDoors = activeDoors.map((door) => {
      // Skip if already open
      if (door.isOpen) return door;

      // Check if any token is near this door
      const nearbyToken = tokens.some((token) => {
        const tokenCenterX = token.x + (gridSize * token.scale) / 2;
        const tokenCenterY = token.y + (gridSize * token.scale) / 2;
        return isNearDoor(tokenCenterX, tokenCenterY, door, interactionRange);
      });

      if (nearbyToken) {
        console.log('[DungeonBackgroundCanvas] Opening door:', door.id);
        doorsChanged = true;
        return { ...door, isOpen: true };
      }

      return door;
    });

    if (doorsChanged) {
      setActiveDoors(updatedDoors);
      onDoorStatesChange?.(updatedDoors);
    }
  }, [tokens, activeDoors, gridSize, onDoorStatesChange]);

  // Calculate visible bounds for fog of war
  const visibleBounds = {
    x: 0,
    y: 0,
    width: dimensions.width,
    height: dimensions.height,
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Only render stage if dimensions are valid to prevent Konva errors */}
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Stage width={dimensions.width} height={dimensions.height}>
          {/* Background Layer */}
          <Layer listening={false}>
            {/* Solid background color */}
            <Rect
              x={0}
              y={0}
              width={dimensions.width}
              height={dimensions.height}
              fill={backgroundColor}
            />

            {/* Paper texture overlay */}
            <PaperNoiseOverlay
              x={0}
              y={0}
              width={dimensions.width}
              height={dimensions.height}
              scaleX={1}
              scaleY={1}
              opacity={0.15}
            />

            {/* Dungeon Walls */}
            {activeDrawings.map((drawing) => {
              if (drawing.tool === 'wall') {
                return (
                  <Line
                    key={drawing.id}
                    points={drawing.points}
                    stroke={drawing.color}
                    strokeWidth={drawing.size}
                    lineCap="round"
                    lineJoin="round"
                  />
                );
              }
              return null;
            })}

            {/* Doors (simple rectangles for now) */}
            {activeDoors.map((door) => (
              <Rect
                key={door.id}
                x={door.x - door.size / 2}
                y={door.y - door.size / 2}
                width={door.size}
                height={door.thickness || 12}
                fill="#8B4513" // Brown door color
                rotation={door.orientation === 'vertical' ? 90 : 0}
              />
            ))}
          </Layer>

          {/* Fog of War Layer */}
          <Layer listening={false}>
            <FogOfWarLayer
              tokens={tokens}
              drawings={activeDrawings}
              doors={activeDoors}
              gridSize={gridSize}
              visibleBounds={visibleBounds}
              map={null} // No map image for landing page
            />
          </Layer>

          {/* Content Layer - for draggable tokens */}
          {children && <Layer>{children}</Layer>}
        </Stage>
      )}
    </div>
  );
}
