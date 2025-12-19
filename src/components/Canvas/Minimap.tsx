import { useEffect, useRef } from 'react';

interface MinimapProps {
  /** Current viewport position (stage x, y) */
  position: { x: number; y: number };
  /** Current zoom scale */
  scale: number;
  /** Viewport size (window dimensions) */
  viewportSize: { width: number; height: number };
  /** Map data (if available) */
  map: {
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
    src: string;
  } | null;
  /** All tokens */
  tokens: Array<{
    id: string;
    x: number;
    y: number;
    scale: number;
    type?: 'PC' | 'NPC' | 'ENEMY';
  }>;
  /** Callback when minimap is clicked to navigate */
  onNavigate: (worldX: number, worldY: number) => void;
}

const MINIMAP_SIZE = 200; // px
const MINIMAP_PADDING = 16; // px from edges

/**
 * Minimap component for World View navigation
 *
 * Shows a bird's-eye view of the map with:
 * - Map boundaries (if map is uploaded)
 * - Current viewport rectangle
 * - PC token positions (green dots)
 * - Click to navigate
 */
const Minimap = ({ position, scale, viewportSize, map, tokens, onNavigate }: MinimapProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // Calculate world bounds (what area to show on minimap)
    let worldBounds = {
      minX: 0,
      minY: 0,
      maxX: 2000,
      maxY: 2000,
    };

    if (map) {
      // If map exists, use map bounds as the minimap bounds
      worldBounds = {
        minX: map.x,
        minY: map.y,
        maxX: map.x + map.width * map.scale,
        maxY: map.y + map.height * map.scale,
      };
    } else {
      // No map: calculate bounds from tokens
      const pcTokens = tokens.filter(t => t.type === 'PC');
      if (pcTokens.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        pcTokens.forEach(t => {
          minX = Math.min(minX, t.x);
          minY = Math.min(minY, t.y);
          maxX = Math.max(maxX, t.x + 100 * t.scale);
          maxY = Math.max(maxY, t.y + 100 * t.scale);
        });

        // Add padding
        const padding = 500;
        worldBounds = {
          minX: minX - padding,
          minY: minY - padding,
          maxX: maxX + padding,
          maxY: maxY + padding,
        };
      }
    }

    const worldWidth = worldBounds.maxX - worldBounds.minX;
    const worldHeight = worldBounds.maxY - worldBounds.minY;

    // Calculate minimap scale to fit world bounds in minimap canvas
    const minimapScale = Math.min(
      MINIMAP_SIZE / worldWidth,
      MINIMAP_SIZE / worldHeight
    );

    // Helper to convert world coordinates to minimap coordinates
    const worldToMinimap = (worldX: number, worldY: number) => ({
      x: (worldX - worldBounds.minX) * minimapScale,
      y: (worldY - worldBounds.minY) * minimapScale,
    });

    // Draw map boundary (if map exists)
    if (map) {
      const topLeft = worldToMinimap(worldBounds.minX, worldBounds.minY);
      const bottomRight = worldToMinimap(worldBounds.maxX, worldBounds.maxY);

      ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
      ctx.fillRect(
        topLeft.x,
        topLeft.y,
        bottomRight.x - topLeft.x,
        bottomRight.y - topLeft.y
      );

      ctx.strokeStyle = 'rgba(200, 200, 200, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        topLeft.x,
        topLeft.y,
        bottomRight.x - topLeft.x,
        bottomRight.y - topLeft.y
      );
    }

    // Draw PC tokens (green dots)
    const pcTokens = tokens.filter(t => t.type === 'PC');
    pcTokens.forEach(token => {
      const pos = worldToMinimap(token.x, token.y);
      ctx.fillStyle = '#22c55e'; // green-500
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw current viewport rectangle
    // Viewport top-left in world coords: (-position.x / scale, -position.y / scale)
    const viewportWorldX = -position.x / scale;
    const viewportWorldY = -position.y / scale;
    const viewportWorldWidth = viewportSize.width / scale;
    const viewportWorldHeight = viewportSize.height / scale;

    const viewportTopLeft = worldToMinimap(viewportWorldX, viewportWorldY);
    const viewportBottomRight = worldToMinimap(
      viewportWorldX + viewportWorldWidth,
      viewportWorldY + viewportWorldHeight
    );

    ctx.strokeStyle = '#3b82f6'; // blue-500
    ctx.lineWidth = 2;
    ctx.strokeRect(
      viewportTopLeft.x,
      viewportTopLeft.y,
      viewportBottomRight.x - viewportTopLeft.x,
      viewportBottomRight.y - viewportTopLeft.y
    );

    ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'; // blue-500 with alpha
    ctx.fillRect(
      viewportTopLeft.x,
      viewportTopLeft.y,
      viewportBottomRight.x - viewportTopLeft.x,
      viewportBottomRight.y - viewportTopLeft.y
    );

  }, [position, scale, viewportSize, map, tokens]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Calculate world bounds (same as in useEffect)
    let worldBounds = {
      minX: 0,
      minY: 0,
      maxX: 2000,
      maxY: 2000,
    };

    if (map) {
      worldBounds = {
        minX: map.x,
        minY: map.y,
        maxX: map.x + map.width * map.scale,
        maxY: map.y + map.height * map.scale,
      };
    } else {
      const pcTokens = tokens.filter(t => t.type === 'PC');
      if (pcTokens.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        pcTokens.forEach(t => {
          minX = Math.min(minX, t.x);
          minY = Math.min(minY, t.y);
          maxX = Math.max(maxX, t.x + 100 * t.scale);
          maxY = Math.max(maxY, t.y + 100 * t.scale);
        });

        const padding = 500;
        worldBounds = {
          minX: minX - padding,
          minY: minY - padding,
          maxX: maxX + padding,
          maxY: maxY + padding,
        };
      }
    }

    const worldWidth = worldBounds.maxX - worldBounds.minX;
    const worldHeight = worldBounds.maxY - worldBounds.minY;
    const minimapScale = Math.min(
      MINIMAP_SIZE / worldWidth,
      MINIMAP_SIZE / worldHeight
    );

    // Convert minimap click to world coordinates
    const worldX = clickX / minimapScale + worldBounds.minX;
    const worldY = clickY / minimapScale + worldBounds.minY;

    onNavigate(worldX, worldY);
  };

  return (
    <div
      className="absolute bottom-4 left-4 z-50"
      style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE }}
    >
      <div className="bg-neutral-900/90 border border-neutral-600 rounded shadow-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={MINIMAP_SIZE}
          height={MINIMAP_SIZE}
          onClick={handleClick}
          className="cursor-pointer"
          style={{ display: 'block' }}
        />
        <div className="px-2 py-1 text-xs text-neutral-400 bg-neutral-800/90 border-t border-neutral-700">
          Minimap
        </div>
      </div>
    </div>
  );
};

export default Minimap;
