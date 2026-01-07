import type { Drawing, Door } from '../store/gameStore';

/**
 * Room represents a rectangular bounding box for dungeon pieces
 *
 * @property x - Left edge X coordinate (pixels, grid-aligned)
 * @property y - Top edge Y coordinate (pixels, grid-aligned)
 * @property width - Width in pixels (multiple of gridSize)
 * @property height - Height in pixels (multiple of gridSize)
 */
interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Point represents a 2D coordinate in canvas space
 *
 * @property x - X coordinate in pixels
 * @property y - Y coordinate in pixels
 */
interface Point {
  x: number;
  y: number;
}

/**
 * Direction for corridor connections and doorway placement
 * Maps to cardinal directions for intuitive room growth
 */
type Direction = 'north' | 'south' | 'east' | 'west';

/**
 * DungeonPiece represents a prefabricated layout component with known wall configurations
 *
 * Pieces are the building blocks of dungeons. Each piece has:
 * - Defined bounds (position and size)
 * - Wall segments for each cardinal direction
 * - Doorway positions (converted to Door objects after generation)
 * - Type identifier for different generation rules
 *
 * **Wall Segment Format:**
 * - undefined = no wall (open connection)
 * - 2 points = solid wall [start, end]
 * - 4 points = wall with doorway [leftStart, leftEnd, rightStart, rightEnd] (legacy - prefer doorways field)
 *
 * **Doorways Field:**
 * - Maps direction to door center position
 * - Used to create explicit Door objects in the final dungeon
 *
 * @example
 * // Room with solid north wall
 * { north: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }
 *
 * @example
 * // Room with doorway in south wall
 * {
 *   south: [{ x: 0, y: 100 }, { x: 100, y: 100 }],
 *   doorways: { south: { x: 50, y: 100 } }
 * }
 *
 * @property type - 'room' or 'corridor' for generation rules
 * @property bounds - Bounding box defining piece position and size
 * @property wallSegments - Wall definitions for each cardinal direction
 * @property doorways - Door positions for each direction (optional)
 */
interface DungeonPiece {
  type: 'room' | 'corridor';
  bounds: Room;
  wallSegments: {
    north?: Point[];
    south?: Point[];
    east?: Point[];
    west?: Point[];
  };
  doorways?: {
    north?: Point;
    south?: Point;
    east?: Point;
    west?: Point;
  };
}

/**
 * RoomTemplate defines a reusable room type that can be instantiated
 *
 * The template system allows easy extension of room types. Each template:
 * - Defines valid size constraints
 * - Provides a factory function to create instances
 * - Handles its own wall segment generation
 *
 * **Extension Point:** Add new templates in initializeRoomTemplates()
 *
 * @example
 * // Rectangular room template
 * {
 *   type: 'rectangular',
 *   minSize: 3,
 *   maxSize: 8,
 *   createPiece: (x, y, widthCells, heightCells, gridSize) =>
 *     this.createRectangularRoom(x, y, widthCells, heightCells, gridSize)
 * }
 *
 * @property type - Unique identifier for this room type
 * @property minSize - Minimum room size in grid cells
 * @property maxSize - Maximum room size in grid cells
 * @property createPiece - Factory function that creates a DungeonPiece instance
 */
interface RoomTemplate {
  type: string;
  minSize: number;
  maxSize: number;
  createPiece: (
    x: number,
    y: number,
    widthCells: number,
    heightCells: number,
    gridSize: number,
  ) => DungeonPiece;
}

/**
 * CorridorTemplate defines corridor specifications
 *
 * Corridors connect rooms and must be long enough to show visible walls
 * after doorway creation (minimum 4 grid cells to have 2 cells per side).
 *
 * @property lengthInCells - How many grid cells long (default: 4)
 * @property widthInCells - How many grid cells wide (default: 1)
 */
interface CorridorTemplate {
  lengthInCells: number;
  widthInCells: number;
}

/**
 * DungeonGeneratorOptions configures dungeon generation parameters
 *
 * @property numRooms - Target number of rooms to generate
 * @property minRoomSize - Minimum room size in grid cells (default: 3)
 * @property maxRoomSize - Maximum room size in grid cells (default: 8)
 * @property gridSize - Size of one grid cell in pixels (default: 50)
 * @property canvasWidth - Canvas width in pixels (default: 1920)
 * @property canvasHeight - Canvas height in pixels (default: 1080)
 * @property wallColor - Wall color hex code (default: '#ff0000')
 * @property wallSize - Wall thickness in pixels (default: 8)
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
 * DungeonGenerator creates procedural dungeon layouts using an organic growth algorithm
 *
 * **Architecture:**
 * - Template-based room system for extensibility
 * - Organic growth algorithm (not random placement + pathfinding)
 * - Grid-aligned positioning for precision
 * - Prefab pieces with known wall configurations
 * - Modular design for easy feature additions
 *
 * **Algorithm:**
 * 1. Place first room at canvas center
 * 2. Iteratively grow dungeon:
 *    - Pick random existing room
 *    - Try adding corridor + new room in unused direction
 *    - Check collisions and retry if needed
 * 3. Convert all pieces to Drawing objects
 *
 * **Key Features:**
 * - All rooms are connected (no isolated rooms)
 * - Walls are fully interactive (can be edited after generation)
 * - Fog of War compatible (proper wall raycasting)
 * - NPC pathfinding compatible (no walls inside rooms)
 * - Performance optimized (prefabs, minimal points)
 *
 * **Extension Points:**
 * - Add room templates in initializeRoomTemplates()
 * - Modify corridor template for different corridor styles
 * - Add parameters to DungeonGeneratorOptions
 * - Customize wall colors, themes, or special room types
 *
 * @example
 * // Basic usage
 * const generator = new DungeonGenerator({
 *   numRooms: 10,
 *   minRoomSize: 3,
 *   maxRoomSize: 8,
 *   gridSize: 50,
 *   wallColor: '#ff0000',
 * });
 * const drawings = generator.generate();
 * drawings.forEach(drawing => addDrawing(drawing));
 *
 * @example
 * // Advanced usage with theme
 * const generator = new DungeonGenerator({
 *   numRooms: 15,
 *   minRoomSize: 4,
 *   maxRoomSize: 12,
 *   wallColor: '#8b4513', // Brown for cavern theme
 *   wallSize: 10,
 * });
 *
 * @see {@link docs/DUNGEON_GENERATOR.md} for detailed documentation
 */
export class DungeonGenerator {
  private options: Required<DungeonGeneratorOptions>;
  private rooms: Room[] = [];
  private roomTemplates: RoomTemplate[];
  private corridorTemplate: CorridorTemplate;

  // Named constants for magic numbers
  private static readonly RETRIES_PER_ROOM = 10; // Retry limit multiplier
  private static readonly RETRY_THRESHOLD_FRACTION = 0.5; // Give up after half the retries
  private static readonly ROOM_SPACING_CELLS = 1; // Padding between pieces (in grid cells)
  private static readonly MIN_WALL_SEGMENT_FRACTION = 0.25; // Minimum wall segment size (1/4 grid cell)

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

    // Initialize room templates
    this.roomTemplates = this.initializeRoomTemplates();

    // Initialize corridor template (4 grid cells long for visible walls)
    this.corridorTemplate = {
      lengthInCells: 4,
      widthInCells: 2, // 2 cells wide allows both walls AND doors to align to grid
    };
  }

  /**
   * Initialize available room templates
   * Currently only includes rectangular rooms for reliable generation and collision detection.
   */
  private initializeRoomTemplates(): RoomTemplate[] {
    return [
      {
        type: 'rectangular',
        minSize: this.options.minRoomSize,
        maxSize: this.options.maxRoomSize,
        createPiece: (x, y, widthCells, heightCells, gridSize) =>
          this.createRectangularRoom(x, y, widthCells, heightCells, gridSize),
      },
      // TODO: Complex room shapes disabled - need proper collision detection for non-rectangular shapes
      // {
      //   type: 'l-shaped',
      //   minSize: 4,
      //   maxSize: this.options.maxRoomSize,
      //   createPiece: (x, y, widthCells, heightCells, gridSize) =>
      //     this.createLShapedRoom(x, y, widthCells, heightCells, gridSize),
      // },
      // {
      //   type: 't-shaped',
      //   minSize: 5,
      //   maxSize: this.options.maxRoomSize,
      //   createPiece: (x, y, widthCells, heightCells, gridSize) =>
      //     this.createTShapedRoom(x, y, widthCells, heightCells, gridSize),
      // },
      // {
      //   type: 'cross-shaped',
      //   minSize: 5,
      //   maxSize: this.options.maxRoomSize,
      //   createPiece: (x, y, widthCells, heightCells, gridSize) =>
      //     this.createCrossShapedRoom(x, y, widthCells, heightCells, gridSize),
      // },
    ];
  }

  /**
   * Generates a dungeon using prefab pieces for perfect alignment
   *
   * @returns Object containing both wall drawings and door objects
   */
  public generate(): { drawings: Drawing[]; doors: Door[] } {
    this.rooms = [];
    const drawings: Drawing[] = [];
    const doors: Door[] = [];
    const pieces: DungeonPiece[] = [];
    const usedDirections = new Map<DungeonPiece, Set<Direction>>();

    // Start with the first room at canvas center
    const { canvasWidth, canvasHeight, gridSize } = this.options;
    const startX = Math.round(canvasWidth / 2 / gridSize) * gridSize;
    const startY = Math.round(canvasHeight / 2 / gridSize) * gridSize;

    const firstRoom = this.createRoom(startX, startY);
    pieces.push(firstRoom);
    this.rooms.push(firstRoom.bounds);
    usedDirections.set(firstRoom, new Set());

    // Grow the dungeon organically
    const maxRetries = this.options.numRooms * DungeonGenerator.RETRIES_PER_ROOM; // Prevent infinite loops
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
        .filter((dir) => !usedDirs.has(dir as Direction))
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
      if (!added && retries >= maxRetries * DungeonGenerator.RETRY_THRESHOLD_FRACTION) {
        break;
      }
    }

    // Convert all pieces to drawings and doors
    for (const piece of pieces) {
      drawings.push(...this.pieceToDrawings(piece));

      // Extract doors from doorways field
      if (piece.doorways) {
        for (const direction of ['north', 'south', 'east', 'west'] as Direction[]) {
          const doorPosition = piece.doorways[direction];
          if (doorPosition) {
            doors.push(this.createDoorFromPosition(doorPosition, direction));
          }
        }
      }
    }

    return { drawings, doors };
  }

  /**
   * Creates a room using a random template from the available room types
   */
  private createRoom(x: number, y: number): DungeonPiece {
    // Randomly select a room template
    const template = this.roomTemplates[Math.floor(Math.random() * this.roomTemplates.length)];

    // Generate random size within template bounds
    const widthCells =
      Math.floor(Math.random() * (template.maxSize - template.minSize + 1)) + template.minSize;
    const heightCells =
      Math.floor(Math.random() * (template.maxSize - template.minSize + 1)) + template.minSize;

    // Use template's creation function
    return template.createPiece(x, y, widthCells, heightCells, this.options.gridSize);
  }

  /**
   * Creates a rectangular room piece (the default room type)
   */
  private createRectangularRoom(
    x: number,
    y: number,
    widthCells: number,
    heightCells: number,
    gridSize: number,
  ): DungeonPiece {
    const width = widthCells * gridSize;
    const height = heightCells * gridSize;

    return {
      type: 'room',
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
  private createCorridorPiece(fromX: number, fromY: number, direction: Direction): DungeonPiece {
    const { gridSize } = this.options;
    const corridorWidth = this.corridorTemplate.widthInCells * gridSize;
    const corridorLength = this.corridorTemplate.lengthInCells * gridSize;

    let bounds: Room;
    let wallSegments: DungeonPiece['wallSegments'];

    switch (direction) {
      case 'north':
        // Grid-snap corridor CENTER (works because width=2 cells, so center is grid-aligned)
        const northCenterX = Math.round(fromX / gridSize) * gridSize;
        bounds = {
          x: northCenterX - corridorWidth / 2,
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
        // Grid-snap corridor CENTER (works because width=2 cells, so center is grid-aligned)
        const southCenterX = Math.round(fromX / gridSize) * gridSize;
        bounds = {
          x: southCenterX - corridorWidth / 2,
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
        // Grid-snap corridor CENTER (works because width=2 cells, so center is grid-aligned)
        const eastCenterY = Math.round(fromY / gridSize) * gridSize;
        bounds = {
          x: fromX,
          y: eastCenterY - corridorWidth / 2,
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
        // Grid-snap corridor CENTER (works because width=2 cells, so center is grid-aligned)
        const westCenterY = Math.round(fromY / gridSize) * gridSize;
        bounds = {
          x: fromX - corridorLength,
          y: westCenterY - corridorWidth / 2,
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

    return { type: 'corridor', bounds, wallSegments };
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
    excludeFromCollision?: DungeonPiece,
  ): { corridor: DungeonPiece; newRoom: DungeonPiece } | null {
    const { bounds } = sourcePiece;
    const { gridSize } = this.options;

    // Calculate connection point on source piece and snap to grid
    let connX: number, connY: number;

    switch (direction) {
      case 'north':
        connX = Math.round((bounds.x + bounds.width / 2) / gridSize) * gridSize;
        connY = bounds.y;
        break;
      case 'south':
        connX = Math.round((bounds.x + bounds.width / 2) / gridSize) * gridSize;
        connY = bounds.y + bounds.height;
        break;
      case 'east':
        connX = bounds.x + bounds.width;
        connY = Math.round((bounds.y + bounds.height / 2) / gridSize) * gridSize;
        break;
      case 'west':
        connX = bounds.x;
        connY = Math.round((bounds.y + bounds.height / 2) / gridSize) * gridSize;
        break;
    }

    // Create corridor (already positioned correctly from grid-aligned connection point)
    const corridor = this.createCorridorPiece(connX, connY, direction);

    // Create new room with random size
    const newRoom = this.createRoom(0, 0);

    // Calculate and grid-snap room position to align with corridor endpoint
    const { bounds: corrBounds } = corridor;

    switch (direction) {
      case 'north':
        // Room's bottom edge should align with corridor's top edge
        newRoom.bounds.y = corrBounds.y - newRoom.bounds.height;
        newRoom.bounds.x = connX - newRoom.bounds.width / 2;
        break;
      case 'south':
        // Room's top edge should align with corridor's bottom edge
        newRoom.bounds.y = corrBounds.y + corrBounds.height;
        newRoom.bounds.x = connX - newRoom.bounds.width / 2;
        break;
      case 'east':
        // Room's left edge should align with corridor's right edge
        newRoom.bounds.x = corrBounds.x + corrBounds.width;
        newRoom.bounds.y = connY - newRoom.bounds.height / 2;
        break;
      case 'west':
        // Room's right edge should align with corridor's left edge
        newRoom.bounds.x = corrBounds.x - newRoom.bounds.width;
        newRoom.bounds.y = connY - newRoom.bounds.height / 2;
        break;
    }

    // Grid-snap room position
    newRoom.bounds.x = Math.round(newRoom.bounds.x / gridSize) * gridSize;
    newRoom.bounds.y = Math.round(newRoom.bounds.y / gridSize) * gridSize;

    // Realign wall segments after position adjustment
    this.updateWallSegments(newRoom);

    // CRITICAL FIX: Recalculate corridor position to align with snapped room
    // The room may have shifted during grid-snapping, so we need to adjust the corridor
    const snappedRoomCenter = {
      x: newRoom.bounds.x + newRoom.bounds.width / 2,
      y: newRoom.bounds.y + newRoom.bounds.height / 2,
    };

    // Adjust corridor endpoint to match snapped room edge
    switch (direction) {
      case 'north':
        // Corridor connects source room (south end) to new room (north end)
        // Adjust corridor X to align with new room center
        const northOffsetX = Math.round(snappedRoomCenter.x / gridSize) * gridSize - connX;
        corridor.bounds.x += northOffsetX;
        this.updateWallSegments(corridor);
        break;
      case 'south':
        const southOffsetX = Math.round(snappedRoomCenter.x / gridSize) * gridSize - connX;
        corridor.bounds.x += southOffsetX;
        this.updateWallSegments(corridor);
        break;
      case 'east':
        const eastOffsetY = Math.round(snappedRoomCenter.y / gridSize) * gridSize - connY;
        corridor.bounds.y += eastOffsetY;
        this.updateWallSegments(corridor);
        break;
      case 'west':
        const westOffsetY = Math.round(snappedRoomCenter.y / gridSize) * gridSize - connY;
        corridor.bounds.y += westOffsetY;
        this.updateWallSegments(corridor);
        break;
    }

    // Check for collisions (exclude source piece since corridor connects to it)
    const piecesToCheck = excludeFromCollision
      ? existingPieces.filter((p) => p !== excludeFromCollision)
      : existingPieces;

    if (this.piecesOverlap(corridor, piecesToCheck) || this.piecesOverlap(newRoom, piecesToCheck)) {
      return null;
    }

    // Calculate exact doorway positions AFTER grid snapping AND corridor adjustment
    // Doorways must align with the corridor's actual connection points
    let sourceRoomDoorwayX: number, sourceRoomDoorwayY: number;
    let newRoomDoorwayX: number, newRoomDoorwayY: number;

    // Use corridor's adjusted bounds to determine exact door positions
    const adjustedCorridor = corridor.bounds;

    switch (direction) {
      case 'north':
        // Source room door at bottom, new room door at top
        // Use corridor's X position (center) for alignment
        const northCorrCenterX = adjustedCorridor.x + adjustedCorridor.width / 2;
        sourceRoomDoorwayX = Math.round(northCorrCenterX / gridSize) * gridSize;
        sourceRoomDoorwayY = bounds.y; // Source room's top edge
        newRoomDoorwayX = Math.round(northCorrCenterX / gridSize) * gridSize;
        newRoomDoorwayY = newRoom.bounds.y + newRoom.bounds.height; // New room's bottom edge
        break;
      case 'south':
        // Source room door at bottom, new room door at top
        const southCorrCenterX = adjustedCorridor.x + adjustedCorridor.width / 2;
        sourceRoomDoorwayX = Math.round(southCorrCenterX / gridSize) * gridSize;
        sourceRoomDoorwayY = bounds.y + bounds.height; // Source room's bottom edge
        newRoomDoorwayX = Math.round(southCorrCenterX / gridSize) * gridSize;
        newRoomDoorwayY = newRoom.bounds.y; // New room's top edge
        break;
      case 'east':
        // Use corridor's Y position (center) for alignment
        const eastCorrCenterY = adjustedCorridor.y + adjustedCorridor.height / 2;
        sourceRoomDoorwayX = bounds.x + bounds.width; // Source room's right edge
        sourceRoomDoorwayY = Math.round(eastCorrCenterY / gridSize) * gridSize;
        newRoomDoorwayX = newRoom.bounds.x; // New room's left edge
        newRoomDoorwayY = Math.round(eastCorrCenterY / gridSize) * gridSize;
        break;
      case 'west':
        // Use corridor's Y position (center) for alignment
        const westCorrCenterY = adjustedCorridor.y + adjustedCorridor.height / 2;
        sourceRoomDoorwayX = bounds.x; // Source room's left edge
        sourceRoomDoorwayY = Math.round(westCorrCenterY / gridSize) * gridSize;
        newRoomDoorwayX = newRoom.bounds.x + newRoom.bounds.width; // New room's right edge
        newRoomDoorwayY = Math.round(westCorrCenterY / gridSize) * gridSize;
        break;
    }

    const sourceRoomDoorway = { x: sourceRoomDoorwayX, y: sourceRoomDoorwayY };
    const newRoomDoorway = { x: newRoomDoorwayX, y: newRoomDoorwayY };

    // Remove wall segments where pieces connect using exact positions
    this.removeConnectingWalls(sourcePiece, direction, sourceRoomDoorway);
    this.removeConnectingWalls(newRoom, this.getOppositeDirection(direction), newRoomDoorway);

    return { corridor, newRoom };
  }

  /**
   * Updates wall segments after position adjustment
   */
  private updateWallSegments(piece: DungeonPiece): void {
    const { x, y, width, height } = piece.bounds;

    piece.wallSegments = {
      north: piece.wallSegments.north
        ? [
            { x, y },
            { x: x + width, y },
          ]
        : undefined,
      east: piece.wallSegments.east
        ? [
            { x: x + width, y },
            { x: x + width, y: y + height },
          ]
        : undefined,
      south: piece.wallSegments.south
        ? [
            { x: x + width, y: y + height },
            { x, y: y + height },
          ]
        : undefined,
      west: piece.wallSegments.west
        ? [
            { x, y: y + height },
            { x, y },
          ]
        : undefined,
    };
  }

  /**
   * Splits a wall segment to create a doorway opening and stores door position
   *
   * Creates a gap in the wall where the door will be placed, allowing vision
   * through when the door is open. The door position is stored for later
   * conversion to a Door object.
   *
   * @param piece - The dungeon piece to modify
   * @param direction - Which wall direction to place the door
   * @param doorwayPosition - Exact center position of the door
   */
  private removeConnectingWalls(
    piece: DungeonPiece,
    direction: Direction,
    doorwayPosition?: Point,
  ): void {
    const { bounds, wallSegments } = piece;
    const { gridSize } = this.options;
    const doorwaySize = gridSize; // Door opening size (1 grid cell)
    const minSegmentSize = gridSize * DungeonGenerator.MIN_WALL_SEGMENT_FRACTION;

    // Calculate doorway position if not provided
    let centerX: number, centerY: number;

    if (doorwayPosition) {
      centerX = doorwayPosition.x;
      centerY = doorwayPosition.y;
    } else {
      // Fallback: calculate grid-aligned center point where the doorway should be
      switch (direction) {
        case 'north':
        case 'south':
          centerX = Math.round((bounds.x + bounds.width / 2) / gridSize) * gridSize;
          centerY = direction === 'north' ? bounds.y : bounds.y + bounds.height;
          break;
        case 'east':
        case 'west':
          centerX = direction === 'east' ? bounds.x + bounds.width : bounds.x;
          centerY = Math.round((bounds.y + bounds.height / 2) / gridSize) * gridSize;
          break;
      }
    }

    // Initialize doorways object if it doesn't exist
    if (!piece.doorways) {
      piece.doorways = {};
    }

    // Store the doorway position for Door object creation
    piece.doorways[direction] = { x: centerX, y: centerY };

    // Split the wall to create a gap for the door
    const segment = wallSegments[direction];
    if (!segment || segment.length < 2) return;

    const start = segment[0];
    const end = segment[1];

    if (direction === 'north' || direction === 'south') {
      // Horizontal wall - split left and right of doorway
      const doorwayLeft = centerX - doorwaySize / 2;
      const doorwayRight = centerX + doorwaySize / 2;

      // Ensure we're working with correct wall orientation (left to right)
      const wallLeft = Math.min(start.x, end.x);
      const wallRight = Math.max(start.x, end.x);
      const wallWidth = wallRight - wallLeft;
      const wallY = start.y;

      // Only remove wall if it's entirely a doorway
      if (wallWidth <= doorwaySize + minSegmentSize) {
        wallSegments[direction] = undefined;
        return;
      }

      const leftSegment: Point[] = [];
      const rightSegment: Point[] = [];

      // Keep left segment ONLY if doorway doesn't start before/at wall start
      // AND there's enough space for a meaningful segment
      if (doorwayLeft > wallLeft) {
        const leftLength = doorwayLeft - wallLeft;
        if (leftLength > minSegmentSize) {
          leftSegment.push({ x: wallLeft, y: wallY }, { x: doorwayLeft, y: wallY });
        }
      }

      // Keep right segment ONLY if doorway doesn't extend beyond/to wall end
      // AND there's enough space for a meaningful segment
      if (doorwayRight < wallRight) {
        const rightLength = wallRight - doorwayRight;
        if (rightLength > minSegmentSize) {
          rightSegment.push({ x: doorwayRight, y: wallY }, { x: wallRight, y: wallY });
        }
      }

      // Combine segments
      if (leftSegment.length > 0 && rightSegment.length > 0) {
        wallSegments[direction] = [...leftSegment, ...rightSegment];
      } else if (leftSegment.length > 0) {
        wallSegments[direction] = leftSegment;
      } else if (rightSegment.length > 0) {
        wallSegments[direction] = rightSegment;
      } else {
        wallSegments[direction] = undefined;
      }
    } else {
      // Vertical wall - split top and bottom of doorway
      const doorwayTop = centerY - doorwaySize / 2;
      const doorwayBottom = centerY + doorwaySize / 2;

      // Ensure we're working with correct wall orientation (top to bottom)
      const wallTop = Math.min(start.y, end.y);
      const wallBottom = Math.max(start.y, end.y);
      const wallHeight = wallBottom - wallTop;
      const wallX = start.x;

      // Only remove wall if it's entirely a doorway
      if (wallHeight <= doorwaySize + minSegmentSize) {
        wallSegments[direction] = undefined;
        return;
      }

      const topSegment: Point[] = [];
      const bottomSegment: Point[] = [];

      // Keep top segment ONLY if doorway doesn't start before/at wall top
      // AND there's enough space for a meaningful segment
      if (doorwayTop > wallTop) {
        const topLength = doorwayTop - wallTop;
        if (topLength > minSegmentSize) {
          topSegment.push({ x: wallX, y: wallTop }, { x: wallX, y: doorwayTop });
        }
      }

      // Keep bottom segment ONLY if doorway doesn't extend beyond/to wall bottom
      // AND there's enough space for a meaningful segment
      if (doorwayBottom < wallBottom) {
        const bottomLength = wallBottom - doorwayBottom;
        if (bottomLength > minSegmentSize) {
          bottomSegment.push({ x: wallX, y: doorwayBottom }, { x: wallX, y: wallBottom });
        }
      }

      // Combine segments
      if (topSegment.length > 0 && bottomSegment.length > 0) {
        wallSegments[direction] = [...topSegment, ...bottomSegment];
      } else if (topSegment.length > 0) {
        wallSegments[direction] = topSegment;
      } else if (bottomSegment.length > 0) {
        wallSegments[direction] = bottomSegment;
      } else {
        wallSegments[direction] = undefined;
      }
    }
  }

  /**
   * Checks if a piece overlaps with any existing pieces
   */
  private piecesOverlap(newPiece: DungeonPiece, existingPieces: DungeonPiece[]): boolean {
    const { gridSize } = this.options;
    const padding = gridSize * DungeonGenerator.ROOM_SPACING_CELLS; // Padding between pieces

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
   * Creates a Door object from a doorway position and direction
   *
   * @param position - Center position of the door
   * @param direction - Direction the door faces (determines orientation and swing)
   * @returns Door object ready to be added to gameStore
   */
  private createDoorFromPosition(position: Point, direction: Direction): Door {
    const { gridSize } = this.options;

    // Determine orientation based on direction
    // North/South walls have horizontal doors (door swings east-west)
    // East/West walls have vertical doors (door swings north-south)
    const orientation = direction === 'north' || direction === 'south' ? 'horizontal' : 'vertical';

    // Determine swing direction (doors swing into rooms, away from corridors)
    // For now, default to standard directions
    let swingDirection: 'left' | 'right' | 'up' | 'down';
    switch (direction) {
      case 'north':
        swingDirection = 'left'; // Door swings to the left (west)
        break;
      case 'south':
        swingDirection = 'right'; // Door swings to the right (east)
        break;
      case 'east':
        swingDirection = 'down'; // Door swings downward (south)
        break;
      case 'west':
        swingDirection = 'up'; // Door swings upward (north)
        break;
    }

    return {
      id: crypto.randomUUID(),
      x: position.x,
      y: position.y,
      orientation,
      isOpen: false, // Doors start closed
      isLocked: false, // Doors start unlocked
      size: gridSize, // Door size matches grid
      thickness: 12, // Thicker for better visibility (especially in fog of war)
      swingDirection,
    };
  }

  /**
   * Gets the generated rooms (useful for debugging or adding floor tiles)
   */
  public getRooms(): Room[] {
    return this.rooms;
  }
}
