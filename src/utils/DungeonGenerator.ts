import type { Drawing } from '../store/gameStore';

/**
 * Room represents a rectangular room in the dungeon
 */
interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Point represents a 2D coordinate
 */
interface Point {
  x: number;
  y: number;
}

/**
 * DungeonGeneratorOptions configures dungeon generation parameters
 */
export interface DungeonGeneratorOptions {
  numRooms: number;
  minRoomSize?: number;
  maxRoomSize?: number;
  gridSize?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  wallColor?: string;
  wallSize?: number;
}

/**
 * DungeonGenerator creates procedural dungeon layouts using a simple
 * room-and-corridor algorithm. Generated dungeons are returned as Drawing
 * objects that can be added to the gameStore.
 */
export class DungeonGenerator {
  private options: Required<DungeonGeneratorOptions>;
  private rooms: Room[] = [];

  constructor(options: DungeonGeneratorOptions) {
    // Set defaults
    this.options = {
      numRooms: options.numRooms,
      minRoomSize: options.minRoomSize ?? 3,
      maxRoomSize: options.maxRoomSize ?? 8,
      gridSize: options.gridSize ?? 50,
      canvasWidth: options.canvasWidth ?? 1920,
      canvasHeight: options.canvasHeight ?? 1080,
      wallColor: options.wallColor ?? '#ff0000',
      wallSize: options.wallSize ?? 8,
    };
  }

  /**
   * Generates a dungeon and returns wall drawings
   */
  public generate(): Drawing[] {
    this.rooms = [];
    const drawings: Drawing[] = [];

    // Generate rooms using simple random placement with overlap checking
    for (let i = 0; i < this.options.numRooms; i++) {
      let attempts = 0;
      const maxAttempts = 50;

      while (attempts < maxAttempts) {
        const room = this.generateRandomRoom();

        if (this.rooms.length === 0 || !this.hasOverlap(room)) {
          this.rooms.push(room);
          break;
        }

        attempts++;
      }
    }

    // Sort rooms by center position for better corridor connections
    this.rooms.sort((a, b) => {
      const centerA = a.x + a.width / 2;
      const centerB = b.x + b.width / 2;
      return centerA - centerB;
    });

    // Track doorways for each room
    const roomDoorways = new Map<Room, Point[]>();
    for (const room of this.rooms) {
      roomDoorways.set(room, []);
    }

    // Connect rooms with corridors and collect doorway positions
    for (let i = 0; i < this.rooms.length - 1; i++) {
      const { drawings: corridorDrawings, doorways } = this.createCorridor(
        this.rooms[i],
        this.rooms[i + 1]
      );

      // Add corridor walls
      drawings.push(...corridorDrawings);

      // Record doorway positions for each room
      for (const { room, point } of doorways) {
        const roomDoors = roomDoorways.get(room) || [];
        roomDoors.push(point);
        roomDoorways.set(room, roomDoors);
      }
    }

    // Draw room walls with doorways
    for (const room of this.rooms) {
      const doorways = roomDoorways.get(room) || [];
      const roomWalls = this.createRoomWalls(room, doorways);
      drawings.push(...roomWalls);
    }

    return drawings;
  }

  /**
   * Generates a random room with size constraints
   */
  private generateRandomRoom(): Room {
    const { minRoomSize, maxRoomSize, gridSize, canvasWidth, canvasHeight } = this.options;

    // Room size in grid cells
    const widthCells = Math.floor(Math.random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
    const heightCells = Math.floor(Math.random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;

    // Convert to pixels
    const width = widthCells * gridSize;
    const height = heightCells * gridSize;

    // Random position (snapped to grid)
    const maxX = Math.floor((canvasWidth - width) / gridSize);
    const maxY = Math.floor((canvasHeight - height) / gridSize);

    const x = Math.floor(Math.random() * maxX) * gridSize;
    const y = Math.floor(Math.random() * maxY) * gridSize;

    return { x, y, width, height };
  }

  /**
   * Checks if a room overlaps with existing rooms (with padding)
   */
  private hasOverlap(newRoom: Room): boolean {
    const padding = this.options.gridSize * 2; // 2 grid cells of padding

    for (const room of this.rooms) {
      if (
        newRoom.x < room.x + room.width + padding &&
        newRoom.x + newRoom.width > room.x - padding &&
        newRoom.y < room.y + room.height + padding &&
        newRoom.y + newRoom.height > room.y - padding
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Creates wall drawings for a rectangular room with optional doorways
   * Returns an array of Drawing objects (one per wall segment)
   */
  private createRoomWalls(room: Room, doorways: Point[] = []): Drawing[] {
    const { x, y, width, height } = room;
    const { wallColor, wallSize, gridSize } = this.options;
    const doorSize = gridSize; // Door opening size
    const drawings: Drawing[] = [];

    // If no doorways, create simple closed rectangle
    if (doorways.length === 0) {
      const points = [
        x, y, // Top-left
        x + width, y, // Top-right
        x + width, y + height, // Bottom-right
        x, y + height, // Bottom-left
        x, y, // Back to top-left (close the rectangle)
      ];

      return [{
        id: crypto.randomUUID(),
        tool: 'wall',
        points,
        color: wallColor,
        size: wallSize,
      }];
    }

    // Determine which side each doorway is on (use gridSize/2 as threshold for better tolerance)
    const threshold = gridSize / 2;
    const topDoors = doorways.filter(d => Math.abs(d.y - y) < threshold);
    const bottomDoors = doorways.filter(d => Math.abs(d.y - (y + height)) < threshold);
    const leftDoors = doorways.filter(d => Math.abs(d.x - x) < threshold);
    const rightDoors = doorways.filter(d => Math.abs(d.x - (x + width)) < threshold);

    // Helper to create wall segments with door gaps
    const createWallSegments = (start: Point, end: Point, doors: Point[], isVertical: boolean) => {
      if (doors.length === 0) {
        drawings.push({
          id: crypto.randomUUID(),
          tool: 'wall',
          points: [start.x, start.y, end.x, end.y],
          color: wallColor,
          size: wallSize,
        });
        return;
      }

      // Sort doors by position along the wall
      const sortedDoors = [...doors].sort((a, b) =>
        isVertical ? a.y - b.y : a.x - b.x
      );

      let current = start;
      for (const door of sortedDoors) {
        const doorStart = isVertical
          ? { x: door.x, y: door.y - doorSize / 2 }
          : { x: door.x - doorSize / 2, y: door.y };
        const doorEnd = isVertical
          ? { x: door.x, y: door.y + doorSize / 2 }
          : { x: door.x + doorSize / 2, y: door.y };

        // Add wall segment before door
        const hasSegmentBefore = isVertical
          ? current.y < doorStart.y - 1
          : current.x < doorStart.x - 1;

        if (hasSegmentBefore) {
          drawings.push({
            id: crypto.randomUUID(),
            tool: 'wall',
            points: [current.x, current.y, doorStart.x, doorStart.y],
            color: wallColor,
            size: wallSize,
          });
        }

        // Skip the door opening, continue after it
        current = doorEnd;
      }

      // Add remaining wall segment after last door
      const hasSegmentAfter = isVertical
        ? current.y < end.y - 1
        : current.x < end.x - 1;

      if (hasSegmentAfter) {
        drawings.push({
          id: crypto.randomUUID(),
          tool: 'wall',
          points: [current.x, current.y, end.x, end.y],
          color: wallColor,
          size: wallSize,
        });
      }
    };

    // Top wall (left to right)
    createWallSegments({ x, y }, { x: x + width, y }, topDoors, false);
    // Right wall (top to bottom)
    createWallSegments({ x: x + width, y }, { x: x + width, y: y + height }, rightDoors, true);
    // Bottom wall (right to left)
    createWallSegments({ x: x + width, y: y + height }, { x, y: y + height }, bottomDoors, false);
    // Left wall (bottom to top)
    createWallSegments({ x, y: y + height }, { x, y }, leftDoors, true);

    return drawings;
  }

  /**
   * Gets the center point of a room
   */
  private getRoomCenter(room: Room): Point {
    return {
      x: room.x + room.width / 2,
      y: room.y + room.height / 2,
    };
  }

  /**
   * Finds the best connection point on room1's edge facing room2
   */
  private getConnectionPoint(room1: Room, room2: Room): Point {
    const center1 = this.getRoomCenter(room1);
    const center2 = this.getRoomCenter(room2);

    const dx = center2.x - center1.x;
    const dy = center2.y - center1.y;

    // Determine which side of room1 faces room2
    if (Math.abs(dx) > Math.abs(dy)) {
      // Connect horizontally (left or right side)
      if (dx > 0) {
        // Connect from right side of room1
        return {
          x: room1.x + room1.width,
          y: room1.y + room1.height / 2,
        };
      } else {
        // Connect from left side of room1
        return {
          x: room1.x,
          y: room1.y + room1.height / 2,
        };
      }
    } else {
      // Connect vertically (top or bottom side)
      if (dy > 0) {
        // Connect from bottom side of room1
        return {
          x: room1.x + room1.width / 2,
          y: room1.y + room1.height,
        };
      } else {
        // Connect from top side of room1
        return {
          x: room1.x + room1.width / 2,
          y: room1.y,
        };
      }
    }
  }

  /**
   * Checks if a point is inside a room
   */
  private isPointInRoom(point: Point, room: Room): boolean {
    return (
      point.x >= room.x &&
      point.x <= room.x + room.width &&
      point.y >= room.y &&
      point.y <= room.y + room.height
    );
  }

  /**
   * Checks if a line segment intersects with any room
   */
  private lineIntersectsRoom(start: Point, end: Point, room: Room): boolean {
    // Expand room slightly to ensure corridors don't draw on room boundaries
    const padding = 5;
    const expandedRoom = {
      x: room.x - padding,
      y: room.y - padding,
      width: room.width + padding * 2,
      height: room.height + padding * 2,
    };

    // Check if either endpoint is inside the room
    if (this.isPointInRoom(start, expandedRoom) || this.isPointInRoom(end, expandedRoom)) {
      return true;
    }

    // Check if line intersects room boundaries
    // For simplicity, we'll use a bounding box check
    const lineMinX = Math.min(start.x, end.x);
    const lineMaxX = Math.max(start.x, end.x);
    const lineMinY = Math.min(start.y, end.y);
    const lineMaxY = Math.max(start.y, end.y);

    return !(
      lineMaxX < expandedRoom.x ||
      lineMinX > expandedRoom.x + expandedRoom.width ||
      lineMaxY < expandedRoom.y ||
      lineMinY > expandedRoom.y + expandedRoom.height
    );
  }

  /**
   * Creates corridor walls connecting two rooms using L-shaped path
   * Returns both wall drawings and doorway positions
   */
  private createCorridor(
    room1: Room,
    room2: Room
  ): { drawings: Drawing[]; doorways: { room: Room; point: Point }[] } {
    const { wallColor, wallSize, gridSize } = this.options;
    const corridorWidth = gridSize;

    // Get connection points on room edges
    const start = this.getConnectionPoint(room1, room2);
    const end = this.getConnectionPoint(room2, room1);

    const drawings: Drawing[] = [];
    const doorways: { room: Room; point: Point }[] = [];

    // Add doorways at connection points
    doorways.push({ room: room1, point: start });
    doorways.push({ room: room2, point: end });

    // Choose whether to go horizontal-first or vertical-first randomly
    const horizontalFirst = Math.random() > 0.5;

    // Calculate offset from room edges to avoid overlap with room walls
    // Determine which direction each connection is facing
    const isStartHorizontal = start.x === room1.x || start.x === room1.x + room1.width;
    const isEndHorizontal = end.x === room2.x || end.x === room2.x + room2.width;

    // Offset connection points slightly away from rooms
    const offset = 1; // Small offset to avoid wall overlap
    const adjustedStart = { ...start };
    const adjustedEnd = { ...end };

    if (isStartHorizontal) {
      adjustedStart.x += start.x === room1.x ? -offset : offset;
    } else {
      adjustedStart.y += start.y === room1.y ? -offset : offset;
    }

    if (isEndHorizontal) {
      adjustedEnd.x += end.x === room2.x ? -offset : offset;
    } else {
      adjustedEnd.y += end.y === room2.y ? -offset : offset;
    }

    if (horizontalFirst) {
      // Horizontal segment first, then vertical
      const bendPoint = { x: adjustedEnd.x, y: adjustedStart.y };

      // Top wall of horizontal corridor
      drawings.push({
        id: crypto.randomUUID(),
        tool: 'wall',
        points: [
          adjustedStart.x,
          adjustedStart.y - corridorWidth / 2,
          bendPoint.x,
          bendPoint.y - corridorWidth / 2,
        ],
        color: wallColor,
        size: wallSize,
      });

      // Bottom wall of horizontal corridor
      drawings.push({
        id: crypto.randomUUID(),
        tool: 'wall',
        points: [
          adjustedStart.x,
          adjustedStart.y + corridorWidth / 2,
          bendPoint.x,
          bendPoint.y + corridorWidth / 2,
        ],
        color: wallColor,
        size: wallSize,
      });

      // Left wall of vertical corridor
      drawings.push({
        id: crypto.randomUUID(),
        tool: 'wall',
        points: [
          adjustedEnd.x - corridorWidth / 2,
          bendPoint.y,
          adjustedEnd.x - corridorWidth / 2,
          adjustedEnd.y,
        ],
        color: wallColor,
        size: wallSize,
      });

      // Right wall of vertical corridor
      drawings.push({
        id: crypto.randomUUID(),
        tool: 'wall',
        points: [
          adjustedEnd.x + corridorWidth / 2,
          bendPoint.y,
          adjustedEnd.x + corridorWidth / 2,
          adjustedEnd.y,
        ],
        color: wallColor,
        size: wallSize,
      });
    } else {
      // Vertical segment first, then horizontal
      const bendPoint = { x: adjustedStart.x, y: adjustedEnd.y };

      // Left wall of vertical corridor
      drawings.push({
        id: crypto.randomUUID(),
        tool: 'wall',
        points: [
          adjustedStart.x - corridorWidth / 2,
          adjustedStart.y,
          bendPoint.x - corridorWidth / 2,
          bendPoint.y,
        ],
        color: wallColor,
        size: wallSize,
      });

      // Right wall of vertical corridor
      drawings.push({
        id: crypto.randomUUID(),
        tool: 'wall',
        points: [
          adjustedStart.x + corridorWidth / 2,
          adjustedStart.y,
          bendPoint.x + corridorWidth / 2,
          bendPoint.y,
        ],
        color: wallColor,
        size: wallSize,
      });

      // Top wall of horizontal corridor
      drawings.push({
        id: crypto.randomUUID(),
        tool: 'wall',
        points: [
          bendPoint.x,
          adjustedEnd.y - corridorWidth / 2,
          adjustedEnd.x,
          adjustedEnd.y - corridorWidth / 2,
        ],
        color: wallColor,
        size: wallSize,
      });

      // Bottom wall of horizontal corridor
      drawings.push({
        id: crypto.randomUUID(),
        tool: 'wall',
        points: [
          bendPoint.x,
          adjustedEnd.y + corridorWidth / 2,
          adjustedEnd.x,
          adjustedEnd.y + corridorWidth / 2,
        ],
        color: wallColor,
        size: wallSize,
      });
    }

    return { drawings, doorways };
  }

  /**
   * Gets the generated rooms (useful for debugging or adding floor tiles)
   */
  public getRooms(): Room[] {
    return this.rooms;
  }
}
