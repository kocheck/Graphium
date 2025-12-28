# Center on Party Fix & Minimap Implementation

## Summary

Fixed the "Center on Party" functionality and added a minimap for improved navigation in World View mode.

## Changes Made

### 1. New Minimap Component (`src/components/Canvas/Minimap.tsx`)

Added a new minimap component that provides:
- Bird's-eye view of the entire game world
- Visual representation of map boundaries (when a map is uploaded)
- PC token positions shown as green dots
- Current viewport rectangle shown in blue
- Click-to-navigate functionality
- Auto-scales to show relevant area (map bounds or token positions)

**Key Features:**
- 200x200 pixel canvas in bottom-left corner (World View only)
- Semi-transparent dark background with border
- Updates in real-time as viewport moves or tokens are repositioned
- Supports both map-based and token-based bounds calculation

### 2. Enhanced CanvasManager (`src/components/Canvas/CanvasManager.tsx`)

#### Fixed `centerOnPCTokens` Function:
- Now properly uses `clampPosition` to respect viewport constraints
- Ensures scale is within MIN_SCALE and MAX_SCALE bounds
- Calculates optimal zoom level to fit all PC tokens in view
- Maintains 2-grid-cell padding around tokens for better framing

#### Improved `clampPosition` Function:
- **Critical Fix:** Now expands viewport bounds to include PC token positions
- Prevents viewport from being constrained away from party tokens
- Still respects map boundaries when present
- Uses VIEWPORT_CLAMP_PADDING (1000px) for generous navigation area
- Dynamically calculates bounds from:
  - Map boundaries (if map is uploaded)
  - PC token positions (always included)
  - Default 10000x10000 bounds (fallback)

#### Added `navigateToWorldPosition` Function:
- Handles minimap click navigation
- Converts minimap click coordinates to world coordinates
- Centers viewport on clicked location
- Properly clamps to valid bounds

#### Integrated Minimap in World View:
- Minimap only appears in World View mode (isWorldView={true})
- Positioned in bottom-left corner
- "Center on Party" button remains in bottom-right
- Both components work together for comprehensive navigation

## Problem Solved

**Original Issue:** "Center on Party" button didn't work reliably because:
1. The function didn't use `clampPosition`, causing inconsistent behavior
2. The viewport was constrained only to map bounds, not token positions
3. If party tokens were outside the map bounds, viewport would be clamped away from them

**Solution:**
1. Updated `clampPosition` to include PC tokens in bounds calculation
2. Modified `centerOnPCTokens` to use proper clamping
3. Added minimap for visual feedback and alternative navigation method

## Technical Details

### Viewport Constraint Algorithm

```typescript
// Old behavior: Only map bounds considered
bounds = map ? mapBounds : defaultBounds

// New behavior: Map AND token positions considered
bounds = map ? mapBounds : defaultBounds
pcTokens.forEach(token => {
  bounds.minX = Math.min(bounds.minX, token.x)
  bounds.maxX = Math.max(bounds.maxX, token.x + tokenSize)
  // ... same for Y
})
```

### Coordinate Systems

The minimap uses three coordinate systems:
1. **World Coordinates:** Actual game positions (tokens, map)
2. **Stage Coordinates:** Transformed by scale and position
3. **Minimap Coordinates:** Scaled to fit 200x200 canvas

Conversion formula:
```typescript
minimapX = (worldX - worldBounds.minX) * minimapScale
```

## User Experience Improvements

1. **Reliable "Center on Party":** Always works, even when party is far from map
2. **Visual Navigation:** Minimap shows where you are and where tokens are
3. **Quick Navigation:** Click anywhere on minimap to jump to that location
4. **Constrained to Content:** Viewport stays within reasonable bounds of map/tokens
5. **World View Only:** Minimap only appears in player-facing World View window

## Testing Recommendations

1. Upload a map
2. Place PC tokens both on and off the map
3. Open World View window
4. Test "Center on Party" button - should frame all PC tokens
5. Test minimap navigation - click should move viewport
6. Verify viewport stays within reasonable bounds
7. Test with no map (tokens only)
8. Test with map but no PC tokens

## Future Enhancements

Potential improvements:
- Minimap drag to pan (instead of click to jump)
- Toggle minimap visibility
- Show NPC/Enemy tokens (different colors)
- Minimap zoom controls
- Configurable minimap size
- Animated transitions for centering/navigation
