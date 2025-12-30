import { useEffect, useState, useRef } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import PaperNoiseOverlay from '../Canvas/PaperNoiseOverlay';
import GridOverlay from '../Canvas/GridOverlay';
import { PlaygroundDrawings } from './PlaygroundDrawings';

interface BackgroundCanvasProps {
  width: number;
  height: number;
  children?: React.ReactNode;
}

/**
 * BackgroundCanvas - Renders the textured paper background with grid
 *
 * This component provides the same visual aesthetic as the main editor canvas
 * but simplified for use in the HomeScreen. It renders:
 * - Paper noise texture overlay
 * - Dot grid pattern
 * - Optional children (e.g., draggable tokens)
 */
export function BackgroundCanvas({ width, height, children }: BackgroundCanvasProps) {
  const [dimensions, setDimensions] = useState({ width, height });
  const containerRef = useRef<HTMLDivElement>(null);

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

  const gridSize = 50;
  const backgroundColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--app-bg-base')
    .trim() || '#1a1a1a';

  // Calculate visible bounds for the grid (full viewport)
  const visibleBounds = {
    x: -dimensions.width / 2,
    y: -dimensions.height / 2,
    width: dimensions.width * 2,
    height: dimensions.height * 2,
  };

  // Guard clause: Don't render if dimensions are invalid (prevents Konva InvalidStateError)
  if (dimensions.width === 0 || dimensions.height === 0) {
    return null;
  }

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

          {/* Grid overlay */}
          <GridOverlay
            visibleBounds={visibleBounds}
            gridSize={gridSize}
            stroke="#444"
            opacity={0.3}
            type="DOTS"
          />
        </Layer>

        {/* Drawings Layer - tactical markers and annotations */}
        <Layer listening={false}>
          <PlaygroundDrawings />
        </Layer>

        {/* Content Layer - for draggable tokens */}
        {children && <Layer>{children}</Layer>}
      </Stage>
    </div>
  );
}
