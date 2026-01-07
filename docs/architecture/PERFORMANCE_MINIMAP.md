# Performance Optimizations: Minimap & Error Boundaries

## Summary

This commit adds critical performance optimizations and error boundary protection for the new Minimap feature and improves CanvasManager rendering performance.

## Changes Made

### 1. Optimized Minimap Component (`src/components/Canvas/Minimap.tsx`)

#### Performance Improvements:

- **React.memo**: Wrapped entire component to prevent re-renders when props haven't changed
- **useMemo for PC tokens**: Memoized token filtering to avoid re-computation
- **useMemo for world bounds**: Expensive calculation (iterating tokens, map bounds) now memoized
- **useMemo for minimap scale**: Derived calculation memoized to prevent recalculation
- **useCallback for click handler**: Prevents function recreation on every render
- **Eliminated duplicate code**: World bounds calculation was duplicated in useEffect and handleClick

#### Before (Performance Issues):

```typescript
const Minimap = ({ position, scale, ... }) => {
  useEffect(() => {
    // Calculate world bounds every time
    let worldBounds = { ... };
    if (map) { worldBounds = { ... }; }
    else {
      const pcTokens = tokens.filter(t => t.type === 'PC'); // Filtering every render
      // ... complex calculation
    }
    const minimapScale = Math.min(...); // Recalculated every time
  }, [position, scale, viewportSize, map, tokens]);

  const handleClick = (e) => {
    // Duplicate world bounds calculation!
    let worldBounds = { ... };
    // ... same logic repeated
  };
}
```

#### After (Optimized):

```typescript
const Minimap = memo(({ position, scale, ... }) => {
  const pcTokens = useMemo(() => tokens.filter(t => t.type === 'PC'), [tokens]);

  const worldBounds = useMemo<WorldBounds>(() => {
    // Calculated once, reused in both rendering and click handling
    if (map) return mapBounds;
    if (pcTokens.length > 0) return tokenBounds;
    return defaultBounds;
  }, [map, pcTokens]);

  const minimapScale = useMemo(() => {
    // Derived from memoized worldBounds
    return Math.min(MINIMAP_SIZE / worldWidth, MINIMAP_SIZE / worldHeight);
  }, [worldBounds]);

  const handleClick = useCallback((e) => {
    // Uses memoized values, no recalculation
    const worldX = clickX / minimapScale + worldBounds.minX;
  }, [worldBounds, minimapScale, onNavigate]);
});

Minimap.displayName = 'Minimap'; // For React DevTools
```

#### Performance Impact:

- **Before**: Minimap re-rendered on every position/scale change (expected), but also recalculated world bounds twice
- **After**: Minimap still re-renders (necessary for canvas updates), but:
  - No duplicate calculations
  - World bounds only recalculated when map or tokens change
  - Click handler function only recreated when dependencies change
  - React.memo prevents re-renders when props are identical

### 2. New Error Boundary (`src/components/Canvas/MinimapErrorBoundary.tsx`)

#### Purpose:

Prevents minimap rendering errors from crashing the entire World View.

#### Behavior:

- **Graceful degradation**: If minimap fails, it simply doesn't render
- **Non-critical feature**: Minimap is nice-to-have, not essential for gameplay
- **Silent failure**: Returns `null` instead of showing error UI
- **Logging**: Errors logged to console for debugging

#### Why This Matters:

1. **Canvas2D operations can fail**: Out of memory, invalid coordinates, browser limits
2. **Minimap complexity**: Multiple coordinate transformations, calculations
3. **User experience**: Better to lose minimap than entire World View
4. **Defensive programming**: Follows established pattern (TokenErrorBoundary)

#### Usage:

```tsx
<MinimapErrorBoundary>
  <Minimap {...props} />
</MinimapErrorBoundary>
```

### 3. Optimized CanvasManager (`src/components/Canvas/CanvasManager.tsx`)

#### Changes:

1. **Added useMemo import**: For performance optimizations
2. **Memoized visibleBounds**: Expensive calculation used by GridOverlay and FogOfWar
3. **Wrapped Minimap in error boundary**: Protection against canvas errors

#### Before:

```typescript
const visibleBounds = {
  x: -position.x / scale,
  y: -position.y / scale,
  width: size.width / scale,
  height: size.height / scale,
}; // Recalculated on EVERY render
```

#### After:

```typescript
const visibleBounds = useMemo(
  () => ({
    x: -position.x / scale,
    y: -position.y / scale,
    width: size.width / scale,
    height: size.height / scale,
  }),
  [position.x, position.y, scale, size.width, size.height],
);
```

#### Performance Impact:

- **GridOverlay**: Receives stable reference, won't re-render unnecessarily
- **FogOfWarLayer**: Receives stable reference, won't re-render unnecessarily
- **Minimap**: Benefits from stable visibleBounds calculations

## Performance Benefits

### Render Optimization:

1. **Minimap**: Prevents unnecessary re-renders when props haven't changed
2. **GridOverlay**: Won't re-render when visibleBounds reference is stable
3. **FogOfWarLayer**: Won't re-render when visibleBounds reference is stable

### Computation Optimization:

1. **World bounds**: Calculated once, reused everywhere (not recalculated twice)
2. **Minimap scale**: Derived calculation memoized
3. **Token filtering**: Memoized to prevent re-filtering on every render

### Memory Optimization:

1. **Click handler**: Single function reference, not recreated on every render
2. **Object references**: useMemo prevents new object creation on every render

## Error Handling Architecture

### Layered Error Boundaries:

```
App
├── PrivacyErrorBoundary (app-level, shows error UI)
│   └── CanvasManager
│       ├── AssetProcessingErrorBoundary (file upload errors)
│       │   └── ImageCropper
│       ├── TokenErrorBoundary (per-token errors, silent)
│       │   └── Token (each token wrapped individually)
│       └── MinimapErrorBoundary (minimap errors, silent)
│           └── Minimap
```

### Error Boundary Types:

1. **PrivacyErrorBoundary**: App crashes, shows error screen
2. **AssetProcessingErrorBoundary**: File upload errors, shows error message
3. **TokenErrorBoundary**: Single token failure, silently hides token
4. **MinimapErrorBoundary**: Minimap failure, silently hides minimap

## Testing Recommendations

### Performance Testing:

1. Open World View with 50+ tokens
2. Pan and zoom rapidly
3. Check React DevTools Profiler for re-renders
4. Verify minimap updates smoothly without lag

### Error Boundary Testing:

1. **Minimap error simulation**:
   - Modify Minimap to throw error in useEffect
   - Verify minimap disappears but World View still works
   - Check console for error log
2. **Token error simulation**:
   - Already tested with TokenErrorBoundary
   - Verify pattern is consistent

### Memory Testing:

1. Open React DevTools Profiler
2. Pan/zoom for 1-2 minutes
3. Check for memory leaks (stable memory usage)
4. Verify click handlers aren't recreated on every render

## Code Quality Improvements

### Best Practices Applied:

1. ✅ React.memo for expensive components
2. ✅ useMemo for expensive calculations
3. ✅ useCallback for event handlers
4. ✅ Error boundaries for graceful degradation
5. ✅ DisplayName for React DevTools debugging
6. ✅ Comprehensive comments explaining optimizations
7. ✅ Type safety with TypeScript interfaces
8. ✅ No duplicate code (DRY principle)

### Performance Patterns:

```typescript
// ❌ BAD: Recalculated on every render
const bounds = calculateBounds(tokens, map);

// ✅ GOOD: Memoized, only recalculated when dependencies change
const bounds = useMemo(() => calculateBounds(tokens, map), [tokens, map]);

// ❌ BAD: New function on every render
const handleClick = (e) => { ... };

// ✅ GOOD: Stable function reference
const handleClick = useCallback((e) => { ... }, [dependencies]);

// ❌ BAD: Component re-renders even when props unchanged
const Component = (props) => { ... };

// ✅ GOOD: Only re-renders when props change
const Component = memo((props) => { ... });
```

## Files Modified

1. `src/components/Canvas/Minimap.tsx` - Performance optimizations
2. `src/components/Canvas/MinimapErrorBoundary.tsx` - New error boundary
3. `src/components/Canvas/CanvasManager.tsx` - useMemo for visibleBounds, error boundary integration
4. `PERFORMANCE_OPTIMIZATIONS_MINIMAP.md` - This documentation

## Backwards Compatibility

✅ All changes are backwards compatible:

- No API changes
- No breaking changes
- Only internal optimizations
- Error boundaries are transparent to users

## Future Optimizations

Potential areas for further improvement:

1. **Throttle minimap updates**: Update every 100ms instead of every frame
2. **Offscreen canvas**: Pre-render minimap background
3. **Web Worker**: Move minimap calculations to worker thread
4. **Virtual scrolling**: Only render visible tokens in lists
5. **requestAnimationFrame**: Batch canvas updates

## Conclusion

These optimizations ensure the Minimap feature:

- ✅ Performs efficiently even with many tokens
- ✅ Doesn't slow down the main canvas
- ✅ Fails gracefully if errors occur
- ✅ Follows React best practices
- ✅ Maintains clean, maintainable code
