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
 * Direction for corridor connections
 */
type Direction = 'north' | 'south' | 'east' | 'west';

/**
 * DungeonPiece represents a prefab room or corridor with its walls
 */
interface DungeonPiece {
  bounds: Room;
  wallSegments: {
    north?: Point[];
    south?: Point[];
    east?: Point[];
    west?: Point[];
  };
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
   * Generates a dungeon using prefab pieces for perfect alignment
   */
  public generate(): Drawing[] {
    this.rooms = [];
    const drawings: Drawing[] = [];
    const pieces: DungeonPiece[] = [];
    const usedDirections = new Map<DungeonPiece, Set<Direction>>();

    // Start with the first room at canvas center
    const { canvasWidth, canvasHeight, gridSize } = this.options;
    const startX = Math.round((canvasWidth / 2) / gridSize) * gridSize;
    const startY = Math.round((canvasHeight / 2) / gridSize) * gridSize;

    const firstRoom = this.createRoomPiece(startX, startY);
    pieces.push(firstRoom);
    this.rooms.push(firstRoom.bounds);
    usedDirections.set(firstRoom, new Set());

    // Grow the dungeon organically
    const maxRetries = this.options.numRooms * 10; // Prevent infinite loops
    let retries = 0;
    let roomsAdded = 1; // We already have the first room

    while (roomsAdded < this.options.numRooms && retries < maxRetries) {
      retries++;

      // Pick a random existing room piece to grow from
      // Filter to only room pieces (rooms are at even indices after the first room)
      const roomPieces = pieces.filter((_, idx) => idx === 0 || idx % 2 === 0);
      if (roomPieces.length === 0) break;

      const sourcePiece = roomPieces[Math.floor(Math.random() * roomPieces.length)];
      const usedDirs = usedDirections.get(sourcePiece) || new Set();

      // Try all available directions
      const availableDirs: Direction[] = ['north', 'south', 'east', 'west']
        .filter(dir => !usedDirs.has(dir as Direction))
        .sort(() => Math.random() - 0.5) as Direction[];

      let added = false;
      for (const direction of availableDirs) {
        const result = this.tryAddPieceInDirection(sourcePiece, direction, pieces, sourcePiece);

        if (result) {
          const { corridor, newRoom } = result;

          // Add pieces
          pieces.push(corridor, newRoom);
          this.rooms.push(newRoom.bounds);

          // Mark directions as used
          usedDirs.add(direction);
          usedDirections.set(newRoom, new Set([this.getOppositeDirection(direction)]));

          added = true;
          roomsAdded++;
          retries = 0; // Reset retry counter on success
          break;
        }
      }

      // If we've tried many times without success, give up
      if (!added && retries >= maxRetries / 2) {
        break;
      }
    }

    // Convert all pieces to drawings
    for (const piece of pieces) {
      drawings.push(...this.pieceToDrawings(piece));
    }

    return drawings;
  }

  /**
   * Creates a prefab room piece at the specified position
   */
  private createRoomPiece(x: number, y: number): DungeonPiece {
    const { minRoomSize, maxRoomSize, gridSize } = this.options;

    const widthCells = Math.floor(Math.random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
    const heightCells = Math.floor(Math.random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;

    const width = widthCells * gridSize;
    const height = heightCells * gridSize;

    // Create wall segments for each side (without doorways initially)
    // Each segment is stored as points that can be drawn as a line
    return {
      bounds: { x, y, width, height },
      wallSegments: {
        north: [
          { x, y },
          { x: x + width, y },
        ],
        east: [
          { x: x + width, y },
          { x: x + width, y: y + height },
        ],
        south: [
          { x: x + width, y: y + height },
          { x, y: y + height },
        ],
        west: [
          { x, y: y + height },
          { x, y },
        ],
      },
    };
  }

  /**
   * Creates a corridor piece connecting in the specified direction
   */
  private createCorridorPiece(
    fromX: number,
    fromY: number,
    direction: Direction,
    length: number = 2
  ): DungeonPiece {
    const { gridSize } = this.options;
    const corridorWidth = gridSize;
    const corridorLength = length * gridSize;

    let bounds: Room;
    let wallSegments: DungeonPiece['wallSegments'];

    switch (direction) {
      case 'north':
        bounds = {
          x: fromX - corridorWidth / 2,
          y: fromY - corridorLength,
          width: corridorWidth,
          height: corridorLength,
        };
        wallSegments = {
          north: undefined, // Open end (connects to next room)
          south: undefined, // Open end (connects to previous room)
          east: [
            { x: bounds.x + bounds.width, y: bounds.y },
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
          ],
          west: [
            { x: bounds.x, y: bounds.y + bounds.height },
            { x: bounds.x, y: bounds.y },
          ],
        };
        break;

      case 'south':
        bounds = {
          x: fromX - corridorWidth / 2,
          y: fromY,
          width: corridorWidth,
          height: corridorLength,
        };
        wallSegments = {
          north: undefined,
          south: undefined,
          east: [
            { x: bounds.x + bounds.width, y: bounds.y },
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
          ],
          west: [
            { x: bounds.x, y: bounds.y + bounds.height },
            { x: bounds.x, y: bounds.y },
          ],
        };
        break;

      case 'east':
        bounds = {
          x: fromX,
          y: fromY - corridorWidth / 2,
          width: corridorLength,
          height: corridorWidth,
        };
        wallSegments = {
          north: [
            { x: bounds.x, y: bounds.y },
            { x: bounds.x + bounds.width, y: bounds.y },
          ],
          south: [
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
            { x: bounds.x, y: bounds.y + bounds.height },
          ],
          east: undefined,
          west: undefined,
        };
        break;

      case 'west':
        bounds = {
          x: fromX - corridorLength,
          y: fromY - corridorWidth / 2,
          width: corridorLength,
          height: corridorWidth,
        };
        wallSegments = {
          north: [
            { x: bounds.x, y: bounds.y },
            { x: bounds.x + bounds.width, y: bounds.y },
          ],
          south: [
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
            { x: bounds.x, y: bounds.y + bounds.height },
          ],
          east: undefined,
          west: undefined,
        };
        break;
    }

    return { bounds, wallSegments };
  }

  /**
   * Gets the opposite direction
   */
  private getOppositeDirection(dir: Direction): Direction {
    const opposites: Record<Direction, Direction> = {
      north: 'south',
      south: 'north',
      east: 'west',
      west: 'east',
    };
    return opposites[dir];
  }

  /**
   * Tries to add a corridor and room in the specified direction
   */
  private tryAddPieceInDirection(
    sourcePiece: DungeonPiece,
    direction: Direction,
    existingPieces: DungeonPiece[],
    excludeFromCollision?: DungeonPiece
  ): { corridor: DungeonPiece; newRoom: DungeonPiece } | null {
    const { bounds } = sourcePiece;
    const { gridSize } = this.options;

    // Calculate connection point on source piece
    let connX: number, connY: number;

    switch (direction) {
      case 'north':
        connX = bounds.x + bounds.width / 2;
        connY = bounds.y;
        break;
      case 'south':
        connX = bounds.x + bounds.width / 2;
        connY = bounds.y + bounds.height;
        break;
      case 'east':
        connX = bounds.x + bounds.width;
        connY = bounds.y + bounds.height / 2;
        break;
      case 'west':
        connX = bounds.x;
        connY = bounds.y + bounds.height / 2;
        break;
    }

    // Create corridor
    const corridor = this.createCorridorPiece(connX, connY, direction);

    // Calculate new room position at end of corridor
    const { bounds: corrBounds } = corridor;
    let roomX: number, roomY: number;

    switch (direction) {
      case 'north':
        roomX = corrBounds.x + corrBounds.width / 2;
        roomY = corrBounds.y;
        break;
      case 'south':
        roomX = corrBounds.x + corrBounds.width / 2;
        roomY = corrBounds.y + corrBounds.height;
        break;
      case 'east':
        roomX = corrBounds.x + corrBounds.width;
        roomY = corrBounds.y + corrBounds.height / 2;
        break;
      case 'west':
        roomX = corrBounds.x;
        roomY = corrBounds.y + corrBounds.height / 2;
        break;
    }

    // Create new room (adjust position to align with corridor)
    const newRoom = this.createRoomPiece(roomX, roomY);

    // Adjust room position based on direction to align properly
    switch (direction) {
      case 'north':
        newRoom.bounds.x -= newRoom.bounds.width / 2;
        newRoom.bounds.y -= newRoom.bounds.height;
        break;
      case 'south':
        newRoom.bounds.x -= newRoom.bounds.width / 2;
        break;
      case 'east':
        newRoom.bounds.y -= newRoom.bounds.height / 2;
        break;
      case 'west':
        newRoom.bounds.x -= newRoom.bounds.width;
        newRoom.bounds.y -= newRoom.bounds.height / 2;
        break;
    }

    // Snap room position to grid for proper alignment
    newRoom.bounds.x = Math.round(newRoom.bounds.x / gridSize) * gridSize;
    newRoom.bounds.y = Math.round(newRoom.bounds.y / gridSize) * gridSize;

    // Realign wall segments after position adjustment
    this.updateWallSegments(newRoom);

    // Check for collisions (exclude source piece since corridor connects to it)
    const piecesToCheck = excludeFromCollision
      ? existingPieces.filter(p => p !== excludeFromCollision)
      : existingPieces;

    if (this.piecesOverlap(corridor, piecesToCheck) || this.piecesOverlap(newRoom, piecesToCheck)) {
      return null;
    }

    // Calculate exact doorway positions AFTER grid snapping
    // Source room doorway remains at corridor connection point
    const sourceRoomDoorway = { x: connX, y: connY };

    // Recalculate new room doorway position based on grid-aligned position
    let newRoomDoorwayX: number, newRoomDoorwayY: number;
    switch (direction) {
      case 'north':
        newRoomDoorwayX = newRoom.bounds.x + newRoom.bounds.width / 2;
        newRoomDoorwayY = newRoom.bounds.y + newRoom.bounds.height;
        break;
      case 'south':
        newRoomDoorwayX = newRoom.bounds.x + newRoom.bounds.width / 2;
        newRoomDoorwayY = newRoom.bounds.y;
        break;
      case 'east':
        newRoomDoorwayX = newRoom.bounds.x;
        newRoomDoorwayY = newRoom.bounds.y + newRoom.bounds.height / 2;
        break;
      case 'west':
        newRoomDoorwayX = newRoom.bounds.x + newRoom.bounds.width;
        newRoomDoorwayY = newRoom.bounds.y + newRoom.bounds.height / 2;
        break;
    }
    const newRoomDoorway = { x: newRoomDoorwayX, y: newRoomDoorwayY };

    // Remove wall segments where pieces connect using exact positions
    this.removeConnectingWalls(sourcePiece, direction, sourceRoomDoorway);
    this.removeConnectingWalls(newRoom, this.getOppositeDirection(direction), newRoomDoorway);

    // Trim corridor walls where they meet the rooms
    this.trimCorridorWalls(corridor, direction, gridSize);

    return { corridor, newRoom };
  }

  /**
   * Trims corridor side walls so they don't extend into connecting room walls
   */
  private trimCorridorWalls(corridor: DungeonPiece, direction: Direction, gridSize: number): void {
    // For north-south corridors, trim the east and west walls
    // For east-west corridors, trim the north and south walls
    if (direction === 'north' || direction === 'south') {
      // Trim east wall (shorten by gridSize at each end)
      if (corridor.wallSegments.east && corridor.wallSegments.east.length === 2) {
        const [start, end] = corridor.wallSegments.east;
        const trimmedStart = { x: start.x, y: start.y + gridSize };
        const trimmedEnd = { x: end.x, y: end.y - gridSize };

        // Only keep wall if there's still length after trimming
        if (trimmedEnd.y - trimmedStart.y >= gridSize) {
          corridor.wallSegments.east = [trimmedStart, trimmedEnd];
        } else {
          corridor.wallSegments.east = undefined;
        }
      }

      // Trim west wall (shorten by gridSize at each end)
      if (corridor.wallSegments.west && corridor.wallSegments.west.length === 2) {
        const [start, end] = corridor.wallSegments.west;
        const trimmedStart = { x: start.x, y: start.y - gridSize };
        const trimmedEnd = { x: end.x, y: end.y + gridSize };

        // Only keep wall if there's still length after trimming
        if (trimmedStart.y - trimmedEnd.y >= gridSize) {
          corridor.wallSegments.west = [trimmedStart, trimmedEnd];
        } else {
          corridor.wallSegments.west = undefined;
        }
      }
    } else {
      // Trim north wall (shorten by gridSize at each end)
      if (corridor.wallSegments.north && corridor.wallSegments.north.length === 2) {
        const [start, end] = corridor.wallSegments.north;
        const trimmedStart = { x: start.x + gridSize, y: start.y };
        const trimmedEnd = { x: end.x - gridSize, y: end.y };

        // Only keep wall if there's still length after trimming
        if (trimmedEnd.x - trimmedStart.x >= gridSize) {
          corridor.wallSegments.north = [trimmedStart, trimmedEnd];
        } else {
          corridor.wallSegments.north = undefined;
        }
      }

      // Trim south wall (shorten by gridSize at each end)
      if (corridor.wallSegments.south && corridor.wallSegments.south.length === 2) {
        const [start, end] = corridor.wallSegments.south;
        const trimmedStart = { x: start.x - gridSize, y: start.y };
        const trimmedEnd = { x: end.x + gridSize, y: end.y };

        // Only keep wall if there's still length after trimming
        if (trimmedStart.x - trimmedEnd.x >= gridSize) {
          corridor.wallSegments.south = [trimmedStart, trimmedEnd];
        } else {
          corridor.wallSegments.south = undefined;
        }
      }
    }
  }

  /**
   * Updates wall segments after position adjustment
   */
  private updateWallSegments(piece: DungeonPiece): void {
    const { x, y, width, height } = piece.bounds;

    piece.wallSegments = {
      north: piece.wallSegments.north ? [{ x, y }, { x: x + width, y }] : undefined,
      east: piece.wallSegments.east ? [{ x: x + width, y }, { x: x + width, y: y + height }] : undefined,
      south: piece.wallSegments.south ? [{ x: x + width, y: y + height }, { x, y: y + height }] : undefined,
      west: piece.wallSegments.west ? [{ x, y: y + height }, { x, y }] : undefined,
    };
  }

  /**
   * Splits a wall segment to create a doorway opening
   * Instead of removing the entire wall, we keep the parts on either side of the opening
   */
  private removeConnectingWalls(piece: DungeonPiece, direction: Direction, doorwayPosition?: Point): void {
    const { bounds, wallSegments } = piece;
    const { gridSize } = this.options;
    const doorwaySize = gridSize; // Opening size (1 grid cell)

    // Use exact doorway position if provided, otherwise calculate from bounds
    let centerX: number, centerY: number;

    if (doorwayPosition) {
      centerX = doorwayPosition.x;
      centerY = doorwayPosition.y;
    } else {
      // Fallback: calculate the center point where the doorway should be
      switch (direction) {
        case 'north':
          centerX = bounds.x + bounds.width / 2;
          centerY = bounds.y;
          break;
        case 'south':
          centerX = bounds.x + bounds.width / 2;
          centerY = bounds.y + bounds.height;
          break;
        case 'east':
          centerX = bounds.x + bounds.width;
          centerY = bounds.y + bounds.height / 2;
          break;
        case 'west':
          centerX = bounds.x;
          centerY = bounds.y + bounds.height / 2;
          break;
      }
    }

    // Get the current wall segment
    const segment = wallSegments[direction];
    if (!segment || segment.length < 2) return;

    const start = segment[0];
    const end = segment[1];

    // Split the wall around the doorway - only remove the 1-grid-cell doorway
    // Keep wall segments that are at least 1 grid cell long
    if (direction === 'north' || direction === 'south') {
      // Horizontal wall - split left and right of doorway
      const doorwayLeft = centerX - doorwaySize / 2;
      const doorwayRight = centerX + doorwaySize / 2;

      const leftSegment: Point[] = [];
      const rightSegment: Point[] = [];

      // Keep left segment only if it's at least 1 grid cell long
      const leftLength = doorwayLeft - start.x;
      if (leftLength >= gridSize) {
        leftSegment.push(start, { x: doorwayLeft, y: start.y });
      }

      // Keep right segment only if it's at least 1 grid cell long
      const rightLength = end.x - doorwayRight;
      if (rightLength >= gridSize) {
        rightSegment.push({ x: doorwayRight, y: end.y }, end);
      }

      // Combine segments
      if (leftSegment.length > 0 && rightSegment.length > 0) {
        // Both segments exist - store as 4-point array
        wallSegments[direction] = [...leftSegment, ...rightSegment];
      } else if (leftSegment.length > 0) {
        wallSegments[direction] = leftSegment;
      } else if (rightSegment.length > 0) {
        wallSegments[direction] = rightSegment;
      } else {
        // Entire wall is doorway
        wallSegments[direction] = undefined;
      }
    } else {
      // Vertical wall - split top and bottom of doorway
      const doorwayTop = centerY - doorwaySize / 2;
      const doorwayBottom = centerY + doorwaySize / 2;

      const topSegment: Point[] = [];
      const bottomSegment: Point[] = [];

      // Keep top segment only if it's at least 1 grid cell long
      const topLength = doorwayTop - start.y;
      if (topLength >= gridSize) {
        topSegment.push(start, { x: start.x, y: doorwayTop });
      }

      // Keep bottom segment only if it's at least 1 grid cell long
      const bottomLength = end.y - doorwayBottom;
      if (bottomLength >= gridSize) {
        bottomSegment.push({ x: end.x, y: doorwayBottom }, end);
      }

      // Combine segments
      if (topSegment.length > 0 && bottomSegment.length > 0) {
        // Both segments exist - store as 4-point array
        wallSegments[direction] = [...topSegment, ...bottomSegment];
      } else if (topSegment.length > 0) {
        wallSegments[direction] = topSegment;
      } else if (bottomSegment.length > 0) {
        wallSegments[direction] = bottomSegment;
      } else {
        // Entire wall is doorway
        wallSegments[direction] = undefined;
      }
    }
  }

  /**
   * Checks if a piece overlaps with any existing pieces
   */
  private piecesOverlap(newPiece: DungeonPiece, existingPieces: DungeonPiece[]): boolean {
    const { gridSize } = this.options;
    const padding = gridSize; // 1 grid cell padding

    for (const existing of existingPieces) {
      if (this.boundsOverlap(newPiece.bounds, existing.bounds, padding)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Checks if two bounding boxes overlap with padding
   */
  private boundsOverlap(a: Room, b: Room, padding: number = 0): boolean {
    return !(
      a.x + a.width + padding < b.x ||
      a.x > b.x + b.width + padding ||
      a.y + a.height + padding < b.y ||
      a.y > b.y + b.height + padding
    );
  }

  /**
   * Converts a dungeon piece to Drawing objects
   * Handles both simple walls (2 points) and split walls (4 points with doorway gap)
   */
  private pieceToDrawings(piece: DungeonPiece): Drawing[] {
    const { wallColor, wallSize } = this.options;
    const drawings: Drawing[] = [];

    // Draw each wall segment that exists
    for (const direction of ['north', 'south', 'east', 'west'] as Direction[]) {
      const segment = piece.wallSegments[direction];

      if (segment && segment.length >= 2) {
        // Check if this is a split wall (4 points) or simple wall (2 points)
        if (segment.length === 2) {
          // Simple wall - draw as single line
          drawings.push({
            id: crypto.randomUUID(),
            tool: 'wall',
            points: [segment[0].x, segment[0].y, segment[1].x, segment[1].y],
            color: wallColor,
            size: wallSize,
          });
        } else if (segment.length === 4) {
          // Split wall with doorway - draw as two separate lines
          // First segment (e.g., left side or top side)
          drawings.push({
            id: crypto.randomUUID(),
            tool: 'wall',
            points: [segment[0].x, segment[0].y, segment[1].x, segment[1].y],
            color: wallColor,
            size: wallSize,
          });

          // Second segment (e.g., right side or bottom side)
          drawings.push({
            id: crypto.randomUUID(),
            tool: 'wall',
            points: [segment[2].x, segment[2].y, segment[3].x, segment[3].y],
            color: wallColor,
            size: wallSize,
          });
        }
      }
    }

    return drawings;
  }

  /**
   * Tries to add a new room adjacent to an existing room
   * Returns the new room, corridor, and doorway info if successful
   */
  private tryAddAdjacentRoom(
    sourceRoom: Room,
    roomDoorways: Map<Room, Point[]>
  ): { newRoom: Room; corridor: Drawing[]; doorways: { room: Room; point: Point }[] } | null {
    const { gridSize } = this.options;
    const corridorLength = gridSize * 2; // 2 grid cells for corridor

    // Try all 4 directions: right, left, bottom, top
    const directions = ['right', 'left', 'bottom', 'top'].sort(() => Math.random() - 0.5);

    for (const direction of directions) {
      let newRoom: Room;
      let doorwaySource: Point;
      let doorwayNew: Point;

      // Calculate new room position based on direction
      switch (direction) {
        case 'right':
          doorwaySource = {
            x: sourceRoom.x + sourceRoom.width,
            y: sourceRoom.y + sourceRoom.height / 2,
          };
          newRoom = this.createRoomAtPosition(
            sourceRoom.x + sourceRoom.width + corridorLength,
            sourceRoom.y + sourceRoom.height / 2 - gridSize * 2
          );
          doorwayNew = {
            x: newRoom.x,
            y: newRoom.y + newRoom.height / 2,
          };
          break;

        case 'left':
          doorwaySource = {
            x: sourceRoom.x,
            y: sourceRoom.y + sourceRoom.height / 2,
          };
          newRoom = this.createRoomAtPosition(
            sourceRoom.x - corridorLength,
            sourceRoom.y + sourceRoom.height / 2 - gridSize * 2
          );
          doorwayNew = {
            x: newRoom.x + newRoom.width,
            y: newRoom.y + newRoom.height / 2,
          };
          newRoom.x -= newRoom.width; // Adjust to be on the left
          break;

        case 'bottom':
          doorwaySource = {
            x: sourceRoom.x + sourceRoom.width / 2,
            y: sourceRoom.y + sourceRoom.height,
          };
          newRoom = this.createRoomAtPosition(
            sourceRoom.x + sourceRoom.width / 2 - gridSize * 2,
            sourceRoom.y + sourceRoom.height + corridorLength
          );
          doorwayNew = {
            x: newRoom.x + newRoom.width / 2,
            y: newRoom.y,
          };
          break;

        case 'top':
          doorwaySource = {
            x: sourceRoom.x + sourceRoom.width / 2,
            y: sourceRoom.y,
          };
          newRoom = this.createRoomAtPosition(
            sourceRoom.x + sourceRoom.width / 2 - gridSize * 2,
            sourceRoom.y - corridorLength
          );
          doorwayNew = {
            x: newRoom.x + newRoom.width / 2,
            y: newRoom.y + newRoom.height,
          };
          newRoom.y -= newRoom.height; // Adjust to be on top
          break;

        default:
          continue;
      }

      // Check if new room overlaps with existing rooms
      if (!this.hasOverlap(newRoom)) {
        // Create straight corridor between the rooms
        const corridor = this.createStraightCorridor(doorwaySource, doorwayNew, direction);

        return {
          newRoom,
          corridor,
          doorways: [
            { room: sourceRoom, point: doorwaySource },
            { room: newRoom, point: doorwayNew },
          ],
        };
      }
    }

    return null; // Couldn't find a valid position
  }

  /**
   * Creates a straight corridor between two points
   */
  private createStraightCorridor(
    start: Point,
    end: Point,
    direction: 'right' | 'left' | 'bottom' | 'top'
  ): Drawing[] {
    const { wallColor, wallSize, gridSize } = this.options;
    const corridorWidth = gridSize;
    const drawings: Drawing[] = [];

    if (direction === 'right' || direction === 'left') {
      // Horizontal corridor
      const x1 = Math.min(start.x, end.x);
      const x2 = Math.max(start.x, end.x);
      const y = (start.y + end.y) / 2;

      // Top wall
      drawings.push({
        id: crypto.randomUUID(),
        tool: 'wall',
        points: [x1, y - corridorWidth / 2, x2, y - corridorWidth / 2],
        color: wallColor,
        size: wallSize,
      });

      // Bottom wall
      drawings.push({
        id: crypto.randomUUID(),
        tool: 'wall',
        points: [x1, y + corridorWidth / 2, x2, y + corridorWidth / 2],
        color: wallColor,
        size: wallSize,
      });
    } else {
      // Vertical corridor
      const y1 = Math.min(start.y, end.y);
      const y2 = Math.max(start.y, end.y);
      const x = (start.x + end.x) / 2;

      // Left wall
      drawings.push({
        id: crypto.randomUUID(),
        tool: 'wall',
        points: [x - corridorWidth / 2, y1, x - corridorWidth / 2, y2],
        color: wallColor,
        size: wallSize,
      });

      // Right wall
      drawings.push({
        id: crypto.randomUUID(),
        tool: 'wall',
        points: [x + corridorWidth / 2, y1, x + corridorWidth / 2, y2],
        color: wallColor,
        size: wallSize,
      });
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
