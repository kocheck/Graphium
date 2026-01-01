# Dungeon Generator Feature Documentation

## Overview

The Dungeon Generator is a procedural content generation tool that creates interactive dungeon layouts for tabletop RPG sessions. It uses a modular, template-based architecture designed for extensibility and performance.

**Key Features:**
- Organic growth algorithm for natural-looking layouts
- Grid-aligned positioning for precision
- Interactive wall objects (fully editable after generation)
- Fog of War compatible (NPCs can pathfind, vision works correctly)
- Template-based room system for easy extension
- Error handling with user-friendly feedback

---

## Architecture

### Component Structure

```
DungeonGenerator (TypeScript Class)
├── Room Templates (Extensible)
│   ├── Rectangular rooms (default)
│   └── [Future: L-shaped, T-shaped, circular, etc.]
├── Corridor Templates
│   └── Straight corridors (4 grid cells long, 1 cell wide)
├── Organic Growth Algorithm
│   ├── Start with central room
│   ├── Iteratively add corridor + room
│   └── Collision detection with retry logic
└── Drawing Conversion
    └── Converts pieces to interactive wall objects

DungeonGeneratorDialog (React Component)
├── User input controls (sliders)
├── Generation parameters
└── Canvas clearing option

DungeonGeneratorErrorBoundary (React Error Boundary)
└── Graceful error handling with retry
```

### Data Flow

```
User Input (Dialog)
  ↓
DungeonGenerator.generate()
  ↓
1. Create central room
  ↓
2. Organic growth loop:
   - Pick random existing room
   - Try adding corridor + new room
   - Check collisions
   - Retry if failed
  ↓
3. Convert pieces to Drawing objects
  ↓
4. Add to gameStore
  ↓
Canvas renders interactive walls
```

---

## Core Concepts

### 1. Dungeon Pieces

A **DungeonPiece** is a prefabricated layout component with known dimensions and wall configurations.

```typescript
interface DungeonPiece {
  type: 'room' | 'corridor';
  bounds: Room; // x, y, width, height
  wallSegments: {
    north?: Point[];
    south?: Point[];
    east?: Point[];
    west?: Point[];
  };
}
```

**Wall Segments:**
- Each direction can have 0, 2, or 4 points
- 2 points = solid wall (no doorway)
- 4 points = wall with doorway gap (left segment + right segment)
- undefined = no wall (open connection)

### 2. Grid Alignment

All positions are grid-aligned to ensure precise connections:

```typescript
// Connection points are snapped to grid
connX = Math.round((bounds.x + bounds.width / 2) / gridSize) * gridSize;

// Rooms are positioned on grid boundaries
newRoom.bounds.x = Math.round(newRoom.bounds.x / gridSize) * gridSize;
```

**Why Grid Alignment Matters:**
- Prevents sub-pixel misalignment
- Ensures doorways line up perfectly
- Makes wall removal calculations exact
- Allows fog of war raycasting to work correctly

### 3. Doorway Creation

Doorways are created by splitting wall segments:

```
Original wall: [0, 100] (100px wide)
Doorway at center (50px), size 50px

Left segment:  [0, 25]   (25px)
Gap:          [25, 75]  (50px doorway)
Right segment: [75, 100] (25px)

Result: [0, 25, 75, 100] (4-point array)
```

**Minimum Segment Threshold:**
- Segments < gridSize/4 (12.5px) are discarded
- Prevents tiny wall fragments
- If entire wall is doorway-sized, remove completely

### 4. Organic Growth Algorithm

Instead of placing all rooms randomly and connecting them, the dungeon grows organically:

```typescript
1. Place first room at canvas center
2. While (roomsAdded < numRooms && retries < maxRetries):
   a. Pick random existing room
   b. Pick random unused direction (north/south/east/west)
   c. Try to place corridor + new room
   d. Check for collisions
   e. If successful: add pieces, mark direction used, reset retries
   f. If failed: try next direction or pick different room
3. Convert all pieces to drawings
```

**Benefits:**
- Natural-looking connected dungeons
- No disconnected rooms
- Efficient (no need to calculate paths between random rooms)
- Controlled growth patterns

---

## Extending the System

### Adding New Room Types

The template system makes adding new room shapes straightforward:

#### 1. Create Room Template

```typescript
// In initializeRoomTemplates()
{
  type: 'l-shaped',
  minSize: 4,
  maxSize: 8,
  createPiece: (x, y, widthCells, heightCells, gridSize) =>
    this.createLShapedRoom(x, y, widthCells, heightCells, gridSize),
}
```

#### 2. Implement Creation Method

```typescript
private createLShapedRoom(
  x: number,
  y: number,
  widthCells: number,
  heightCells: number,
  gridSize: number
): DungeonPiece {
  const width = widthCells * gridSize;
  const height = heightCells * gridSize;

  // L-shape: Full width on top, half width on bottom
  const bottomWidth = width / 2;

  return {
    type: 'room',
    bounds: { x, y, width, height },
    wallSegments: {
      // Define wall segments for L-shape outline
      north: [{ x, y }, { x: x + width, y }],
      east: [
        { x: x + width, y },
        { x: x + width, y: y + height / 2 },
        { x: x + bottomWidth, y: y + height / 2 },
        { x: x + bottomWidth, y: y + height },
      ],
      south: [{ x: x + bottomWidth, y: y + height }, { x, y: y + height }],
      west: [{ x, y: y + height }, { x, y }],
    },
  };
}
```

#### 3. Room Types to Consider

- **L-shaped rooms**: Two rectangles joined at corner
- **T-shaped rooms**: Three rectangles in T formation
- **Circular rooms**: Approximate with octagon (8-sided polygon)
- **Irregular rooms**: Use complex point arrays for unique shapes
- **Cavern rooms**: Organic, non-rectangular shapes
- **Special rooms**: Boss rooms, treasure rooms, puzzle rooms

### Adding New Corridor Types

```typescript
// In constructor
this.corridorTemplate = {
  lengthInCells: 6,  // Longer corridors
  widthInCells: 2,   // Wider corridors (2 cells)
};
```

Or create multiple corridor templates:

```typescript
interface CorridorTemplate {
  lengthInCells: number;
  widthInCells: number;
  type?: 'straight' | 'curved' | 'zigzag';
}

private selectCorridorTemplate(): CorridorTemplate {
  // Randomly choose corridor style
  return this.corridorTemplates[Math.floor(Math.random() * this.corridorTemplates.length)];
}
```

### Adding Generation Parameters

#### In DungeonGeneratorOptions:

```typescript
export interface DungeonGeneratorOptions {
  numRooms: number;
  minRoomSize?: number;
  maxRoomSize?: number;
  gridSize?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  wallColor?: string;
  wallSize?: number;

  // New parameters
  theme?: 'dungeon' | 'cavern' | 'fortress' | 'ruins';
  density?: 'sparse' | 'normal' | 'dense';
  roomVariety?: number; // 0-1, how often to use non-rectangular rooms
  corridorStyle?: 'straight' | 'winding' | 'mixed';
}
```

#### In DungeonGeneratorDialog:

```tsx
const [theme, setTheme] = useState<'dungeon' | 'cavern' | 'fortress'>('dungeon');

<select value={theme} onChange={(e) => setTheme(e.target.value)}>
  <option value="dungeon">Classic Dungeon</option>
  <option value="cavern">Natural Cavern</option>
  <option value="fortress">Fortress</option>
</select>
```

---

## Performance Considerations

### Current Optimizations

1. **Prefab System**: Pre-calculated wall segments
   - No runtime geometry calculations
   - Walls defined once, reused

2. **Minimal Point Arrays**:
   - Solid walls: 2 points (start, end)
   - Split walls: 4 points (left segment + right segment)
   - Reduces memory and rendering overhead

3. **Grid-Aligned Positions**:
   - Integer pixel values
   - No floating-point precision issues
   - Faster collision detection

4. **Early Termination**:
   - Retry limit prevents infinite loops
   - Collision checks use bounding boxes first

### Scaling Recommendations

For large dungeons (50+ rooms):

```typescript
// Increase retry limit
const maxRetries = this.options.numRooms * 20;

// Add spatial partitioning for collision checks
private buildSpatialGrid(): Map<string, DungeonPiece[]> {
  // Divide canvas into grid cells
  // Only check collisions within same cell + neighbors
}

// Consider async generation for non-blocking UI
public async generateAsync(): Promise<Drawing[]> {
  // Yield to main thread periodically
  await new Promise(resolve => setTimeout(resolve, 0));
}
```

---

## Common Issues & Solutions

### Issue: Entire walls being removed

**Cause**: Doorway positioned in center of small wall, leaving segments < minSegmentSize

**Solution**:
```typescript
// Check if entire wall is doorway before splitting
if (wallWidth <= doorwaySize + minSegmentSize) {
  wallSegments[direction] = undefined;
  return;
}
```

### Issue: Corridor misalignment with doorways

**Cause**: Grid-snapping corridor position shifts it away from connection point

**Solution**: Don't grid-snap corridors - they're already positioned correctly
```typescript
// WRONG: Grid-snapping shifts corridor
corridor.bounds.x = Math.round(corridor.bounds.x / gridSize) * gridSize;

// RIGHT: Corridor already positioned from grid-aligned connection point
const corridor = this.createCorridorPiece(connX, connY, direction);
```

### Issue: Only generating 1 room

**Cause**: Collision detection excludes wrong piece (checking corridor against source room)

**Solution**: Exclude source piece from collision checks
```typescript
const piecesToCheck = excludeFromCollision
  ? existingPieces.filter(p => p !== excludeFromCollision)
  : existingPieces;
```

### Issue: App freezes during generation

**Cause**: Infinite retry loop when constraints are too restrictive

**Solution**: Add retry limit with early exit
```typescript
const maxRetries = this.options.numRooms * 10;
let retries = 0;

while (roomsAdded < this.options.numRooms && retries < maxRetries) {
  // ... attempt to add room ...

  if (!added) {
    retries++;
  } else {
    retries = 0; // Reset on success
  }
}
```

---

## Testing Recommendations

### Unit Tests

```typescript
describe('DungeonGenerator', () => {
  it('should generate requested number of rooms', () => {
    const generator = new DungeonGenerator({ numRooms: 5 });
    const drawings = generator.generate();
    const rooms = generator.getRooms();
    expect(rooms.length).toBeLessThanOrEqual(5);
  });

  it('should not overlap rooms', () => {
    const generator = new DungeonGenerator({ numRooms: 10 });
    generator.generate();
    const rooms = generator.getRooms();

    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        expect(boundsOverlap(rooms[i], rooms[j])).toBe(false);
      }
    }
  });

  it('should create grid-aligned positions', () => {
    const gridSize = 50;
    const generator = new DungeonGenerator({ numRooms: 5, gridSize });
    generator.generate();
    const rooms = generator.getRooms();

    rooms.forEach(room => {
      expect(room.x % gridSize).toBe(0);
      expect(room.y % gridSize).toBe(0);
    });
  });
});
```

### Integration Tests

```typescript
describe('Dungeon Generator Dialog', () => {
  it('should open and close dialog', () => {
    const { showDungeonDialog, clearDungeonDialog } = useGameStore.getState();

    showDungeonDialog();
    expect(useGameStore.getState().dungeonDialog).toBeTruthy();

    clearDungeonDialog();
    expect(useGameStore.getState().dungeonDialog).toBeNull();
  });

  it('should add drawings to store on generate', () => {
    const { showDungeonDialog } = useGameStore.getState();
    const initialDrawings = useGameStore.getState().drawings.length;

    // Generate dungeon (simulate button click)
    // ...

    const finalDrawings = useGameStore.getState().drawings.length;
    expect(finalDrawings).toBeGreaterThan(initialDrawings);
  });
});
```

---

## AI Assistant Guidance

When helping developers extend this feature:

1. **Understand the Template System**: All new room types should follow the RoomTemplate interface
2. **Maintain Grid Alignment**: Always grid-snap final positions
3. **Preserve Wall Segment Format**: Use 2-point or 4-point arrays consistently
4. **Consider Performance**: Large point arrays hurt rendering performance
5. **Test Edge Cases**: Small rooms, large rooms, odd dimensions
6. **Follow Error Handling**: Use the error boundary, log useful debug info

### Example Prompts

"Add a circular room template to the dungeon generator"
- Implement createCircularRoom() method
- Use octagon approximation (8 wall segments)
- Add to initializeRoomTemplates()
- Test with various sizes

"Make corridors sometimes be wider (2 cells)"
- Modify corridorTemplate.widthInCells
- Update createCorridorPiece() to handle variable widths
- Adjust doorway positioning logic

"Add a 'theme' parameter that changes wall colors"
- Add theme to DungeonGeneratorOptions
- Create theme color mappings
- Update wallColor based on selected theme
- Add theme selector to dialog UI

---

## File Reference

### Core Files

- `src/utils/DungeonGenerator.ts` - Core generation algorithm
- `src/components/DungeonGeneratorDialog.tsx` - User interface
- `src/components/DungeonGeneratorErrorBoundary.tsx` - Error handling
- `src/store/gameStore.ts` - State management (dungeonDialog)

### Related Systems

- `src/components/Canvas/Wall.tsx` - Wall rendering component
- `src/utils/fogOfWar.ts` - Fog of War raycasting (interacts with walls)
- `src/components/Sidebar.tsx` - Contains "Dungeon Gen" button

---

## Future Enhancements

### Short-term
- [ ] Add preset room templates (L-shaped, T-shaped, circular)
- [ ] Theme system (dungeon, cavern, fortress)
- [ ] Export/import dungeon layouts
- [ ] Undo/redo for generation

### Medium-term
- [ ] Multi-floor dungeons (stairs, elevators)
- [ ] Special room types (boss, treasure, puzzle)
- [ ] Door objects (not just wall gaps)
- [ ] Furniture and decoration placement

### Long-term
- [ ] Procedural texture generation
- [ ] Lighting system integration
- [ ] Trap placement algorithm
- [ ] NPC patrol route generation
- [ ] Quest objective placement

---

## Credits

**Initial Implementation**: Claude (AI Assistant)
**Architecture**: Modular template-based organic growth
**Error Handling**: React Error Boundary pattern
**Grid System**: Based on existing Graphium grid (50px cells)
