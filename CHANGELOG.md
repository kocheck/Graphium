# Changelog

All notable changes to Graphium will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Hexagonal and Isometric Grid Support
- **New Grid Types**: Added support for Hexagonal (flat-top) and Isometric grids alongside existing Square grids
  - Hexagonal grid uses axial coordinate system for efficient hex addressing
  - Isometric grid uses diamond-shaped cells with 45° rotation
  - All grid types maintain full backward compatibility

- **Grid Geometry Abstraction**: New modular architecture for grid types
  - `GridGeometry` interface for geometry-agnostic operations
  - `SquareGridGeometry`, `HexagonalGridGeometry`, `IsometricGridGeometry` implementations
  - Factory pattern via `createGridGeometry(gridType)` for extensibility

- **Smart Grid-Aware Snapping**:
  - Square grids: Odd-sized tokens snap to cell centers, even-sized snap to intersections
  - Hex/Iso grids: All tokens snap to cell centers (hex center or diamond center)
  - Updated `snapToGrid()` function with `gridType` parameter

- **UI Enhancements**:
  - Map Settings now shows "Square - Lines", "Square - Dots", "Hexagonal", "Isometric", "Hidden"
  - Grid calibration button disabled for non-square grids (with tooltip explanation)

- **Performance Optimizations**:
  - Pre-computed math constants (SQRT3) to avoid repeated calculations
  - Efficient viewport culling for all grid types
  - Minimal object allocations in hot paths (drag/snap operations)
  - DOTS mode remains square-grid only for optimal performance

- **Comprehensive Testing**:
  - 50+ unit tests for grid geometries
  - Coordinate conversion roundtrip tests
  - Performance tests for large viewports
  - Updated existing grid tests with explicit `gridType` parameter

#### Grid and Gameplay Polish Features

- **Grid Cell Hover Highlight**: Visual feedback when hovering over grid cells
  - Semi-transparent overlay on hovered cell
  - Works with all grid types (square, hex, iso)
  - Disabled for DOTS mode (performance)
  - Uses grid geometry for accurate cell detection

- **Customizable Grid Color**: Per-map grid color picker
  - Grid color property persisted per map
  - Color picker UI in Map Settings
  - Default: #222222 (dark gray)
  - Removed theme-based grid color

- **Grid-Aware Snap Preview**: Visual indicator during token dragging
  - Shows where tokens will snap when released
  - Dashed blue circle at snap destination
  - Works with all grid types
  - Multi-token drag support
  - Performance optimized using refs

- **Movement Range Overlay**: Tactical movement planning
  - BFS flood-fill algorithm for reachable cells
  - Activate with M key (DM only)
  - Default 30ft movement speed (D&D standard)
  - Updates in real-time during drag
  - Grid-aware neighbor calculation
  - Semi-transparent blue overlay

- **Enhanced Measurement Display**: Grid cell counts in measurements
  - Ruler: "30ft (6 cells)"
  - Blast: "20ft radius (4 cells)"
  - Cone: "30ft 53° cone (6 cells)"
  - Proper singular/plural handling
  - Helps DMs with tactical planning

- **Grid Type Keyboard Shortcuts**: Quick grid switching (DM only)
  - 1: Square - Lines
  - 2: Square - Dots
  - 3: Hexagonal
  - 4: Isometric
  - 5: Hidden
  - Toast notifications for feedback
  - No repeat events

### Changed

- **Grid Type Definition**: Extended `GridType` from `'LINES' | 'DOTS' | 'HIDDEN'` to include `'HEXAGONAL' | 'ISOMETRIC'`
- **snapToGrid() Function**: Added optional `gridType` parameter (defaults to 'LINES' for backward compatibility)
- **GridOverlay Component**: Refactored to support hex/iso rendering using geometry abstraction

### Fixed

- Grid calibration now properly disabled for non-square grids to prevent incorrect results

### Technical Details

**New Files**:
- `src/types/grid.ts` - Grid type definitions and interfaces
- `src/utils/gridGeometry.ts` - Grid geometry implementations
- `src/utils/gridGeometry.test.ts` - Comprehensive grid geometry tests
- `src/components/Canvas/MovementRangeOverlay.tsx` - Movement range visualization

**Modified Files**:
- `src/store/gameStore.ts` - Extended GridType enum, added gridColor
- `src/utils/grid.ts` - Updated snapToGrid with gridType support
- `src/utils/measurement.ts` - Enhanced formatters with cell counts
- `src/utils/measurement.test.ts` - Updated tests for new format
- `src/components/Canvas/GridOverlay.tsx` - Hex/iso rendering, hover highlight
- `src/components/Canvas/CanvasManager.tsx` - Snap preview, movement range, keyboard shortcuts, grid color
- `src/components/MapSettingsSheet.tsx` - Grid type options, color picker, calibration fix
- `src/utils/grid.test.ts` - Updated tests with explicit gridType parameter
- `CHANGELOG.md` - Comprehensive documentation of all changes

**Grid Size Semantics**:
- Square: `gridSize` = cell width/height in pixels
- Hexagonal: `gridSize` = circumradius (center to vertex)
- Isometric: `gridSize` = half of diamond width

**Breaking Changes**: None - fully backward compatible with existing square grids

---

## [0.5.3] - 2024-XX-XX

### Fixed
- Logo not appearing in Mac production builds (#223)
- E2E test failures caused by preventDefault() on synthetic events (#219)

### Changed
- Mobile enhancements (#220)

---

_For older changes, see git history._
