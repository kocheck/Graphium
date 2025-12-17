import { Shape, Group } from 'react-konva';
import { Token, Drawing, MapConfig } from '../../store/gameStore';
import URLImage from './URLImage';

interface FogOfWarLayerProps {
  tokens: Token[];
  drawings: Drawing[];
  gridSize: number;
  visibleBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  map: MapConfig | null;
}

// ... helper interfaces ...
interface Point {
  x: number;
  y: number;
}

interface WallSegment {
  start: Point;
  end: Point;
}

// ... logic ...

import { BLUR_FILTERS } from './CanvasManager';

const FogOfWarLayer = ({ tokens, drawings, gridSize, map }: FogOfWarLayerProps) => {
  // Extract PC tokens with vision
  const pcTokens = tokens.filter(
    (t) => t.type === 'PC' && (t.visionRadius ?? 0) > 0
  );

  // Extract walls from drawings
  const walls: WallSegment[] = [];
  drawings
    .filter((d) => d.tool === 'wall')
    .forEach((wall) => {
      // Convert points array [x1, y1, x2, y2, x3, y3, ...] to segments
      const points = wall.points;
      for (let i = 0; i < points.length - 2; i += 2) {
        walls.push({
          start: { x: points[i], y: points[i + 1] },
          end: { x: points[i + 2], y: points[i + 3] },
        });
      }
    });

  if (!map) return null;

  return (
    <Group listening={false}>
      {/*
        Destination-Out Strategy:
        1. Render the Blurred Map (The "Fog") as the base of this group.
        2. Render Vision Polygons with destination-out.
        3. This "erases" the Fog where vision exists, revealing the Sharp Map underneath.
        4. Since it uses "erase" (Cutout), multiple vision polygons effectively UNION (A U B).
      */}
      <Group>
        {/* The Blurred Map (Fog) */}
        <URLImage
            key="bg-map-blurred"
            name="map-image-blurred"
            id="map-blurred"
            src={map.src}
            x={map.x}
            y={map.y}
            width={map.width}
            height={map.height}
            scaleX={map.scale}
            scaleY={map.scale}
            draggable={false}
            listening={false}
            filters={BLUR_FILTERS}
            blurRadius={60}
            brightness={-0.94}
        />

        {/* The Vision "Holes" (Composite: Destination Out) */}
        {pcTokens.map((token) => {
            const tokenCenterX = token.x + (gridSize * token.scale) / 2;
            const tokenCenterY = token.y + (gridSize * token.scale) / 2;
            const visionRadiusPx = ((token.visionRadius ?? 0) / 5) * gridSize;

            const visibilityPolygon = calculateVisibilityPolygon(
              tokenCenterX,
              tokenCenterY,
              visionRadiusPx,
              walls
            );

            return (
              <Shape
                key={`vision-poly-${token.id}`}
                sceneFunc={(ctx) => {
                  if (visibilityPolygon.length === 0) return;
                  ctx.beginPath();
                  ctx.moveTo(visibilityPolygon[0].x, visibilityPolygon[0].y);
                  for (let i = 1; i < visibilityPolygon.length; i++) {
                    ctx.lineTo(visibilityPolygon[i].x, visibilityPolygon[i].y);
                  }
                  ctx.closePath();

                  // Radial Gradient for Soft Fog Edge interaction
                  // Since we are DESTINATION-OUT:
                  // 1.0 Alpha (Opaque) = Fully Erased = Fully Visible Sharp Map
                  // 0.0 Alpha (Transparent) = Not Erased = Fog Remains

                  const gradient = ctx.createRadialGradient(
                    tokenCenterX,
                    tokenCenterY,
                    0,
                    tokenCenterX,
                    tokenCenterY,
                    visionRadiusPx
                  );

                  // Center: Fully Visible (Erase Fog)
                  gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
                  gradient.addColorStop(0.6, 'rgba(0, 0, 0, 1)'); // Keep sharp center

                  // Edge: Fog Starts to Return (Alpha goes to 0, so we stop erasing)
                  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

                  ctx.fillStyle = gradient;
                  ctx.fill();
                }}
                globalCompositeOperation="destination-out"
              />
            );
        })}
      </Group>
    </Group>
  );
};


/**
 * Calculates visibility polygon using 360-degree raycasting
 *
 * @param originX - Token center X
 * @param originY - Token center Y
 * @param maxRange - Vision radius in pixels
 * @param walls - Wall segments that block vision
 * @returns Array of points forming visibility polygon
 */
function calculateVisibilityPolygon(
  originX: number,
  originY: number,
  maxRange: number,
  walls: WallSegment[]
): Point[] {
  const polygon: Point[] = [];
  const rayCount = 360; // 1-degree resolution
  const angleStep = (Math.PI * 2) / rayCount;

  for (let i = 0; i < rayCount; i++) {
    const angle = i * angleStep;
    const rayEndpoint = castRay(originX, originY, angle, maxRange, walls);
    polygon.push(rayEndpoint);
  }

  return polygon;
}

/**
 * Casts a single ray and finds the closest intersection
 *
 * @param originX - Ray origin X
 * @param originY - Ray origin Y
 * @param angle - Ray angle in radians
 * @param maxRange - Maximum ray length
 * @param walls - Wall segments to test
 * @returns Endpoint of ray (either maxRange or wall intersection)
 */
function castRay(
  originX: number,
  originY: number,
  angle: number,
  maxRange: number,
  walls: WallSegment[]
): Point {
  const rayDirX = Math.cos(angle);
  const rayDirY = Math.sin(angle);
  const rayEndX = originX + rayDirX * maxRange;
  const rayEndY = originY + rayDirY * maxRange;

  let closestDistance = maxRange;
  let closestPoint: Point = { x: rayEndX, y: rayEndY };

  // Test intersection with each wall segment
  for (const wall of walls) {
    const intersection = lineSegmentIntersection(
      originX,
      originY,
      rayEndX,
      rayEndY,
      wall.start.x,
      wall.start.y,
      wall.end.x,
      wall.end.y
    );

    if (intersection) {
      const distance = Math.hypot(
        intersection.x - originX,
        intersection.y - originY
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPoint = intersection;
      }
    }
  }

  return closestPoint;
}

/**
 * Line segment intersection algorithm
 *
 * Tests if line segment (x1,y1)-(x2,y2) intersects (x3,y3)-(x4,y4)
 * Returns intersection point or null if no intersection.
 *
 * @returns Intersection point or null
 */
function lineSegmentIntersection(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number
): Point | null {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  // Lines are parallel
  if (Math.abs(denom) < 1e-10) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  // Check if intersection is within both segments
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
    };
  }

  return null;
}

export default FogOfWarLayer;
