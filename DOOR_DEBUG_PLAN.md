# Door Visibility & Fog Blocking Debug Plan

## Problem Statement
1. Doors are NOT visible in World View
2. Doors are NOT blocking vision/fog of war

## Debugging Approach

I've added console logging to three key areas to diagnose the issue:

### 1. FogOfWarLayer.tsx Logging
**Lines 61, 84, 103**

Logs will show:
```
[FogOfWarLayer] PC tokens with vision: X out of Y total tokens
[FogOfWarLayer] Total doors: X Closed doors: X
[FogOfWarLayer] Total wall segments: X
```

**What to check:**
- Are there PC tokens with vision radius > 0?
- Are doors being received by the fog layer?
- Are closed doors being converted to wall segments?

### 2. CanvasManager.tsx State Logging
**Line 143**

Logs will show:
```
[CanvasManager] State: {
  isWorldView: true/false,
  isDaylightMode: true/false,
  doorsCount: X,
  tokensCount: X,
  pcTokensCount: X,
  activeVisionPolygonsCount: X
}
```

**What to check:**
- Is isWorldView true in World View?
- Is isDaylightMode preventing fog render?
- Are there doors in the store?
- Are there PC tokens?

### 3. DoorLayer.tsx Logging
**Lines 30, 35, 1341 (CanvasManager)**

Logs will show:
```
[CanvasManager] About to render DoorLayer with X doors
[DoorLayer] Rendering X doors. isWorldView: true/false
[DoorLayer] Rendering door: <id> isOpen: true/false at <x> <y>
```

**What to check:**
- Are doors being rendered at all?
- Is isWorldView correctly set?
- Are door positions valid (not NaN or off-screen)?

## Current Layer Rendering Order

```jsx
<Stage>
  {/* Layer 1: Background & Map */}
  <Layer>
    <Map />
    <GridOverlay />
  </Layer>

  {/* Fog of War Layer (World View only) */}
  {isWorldView && !isDaylightMode && (
    <Layer>
      <FogOfWarLayer />  {/* Dark overlay with vision cutouts */}
    </Layer>
  )}

  {/* Layer 2: Drawings & Stairs */}
  <Layer>
    <Drawings />
    <StairsLayer />
  </Layer>

  {/* Layer 3: Doors & Tokens */}
  <Layer>
    <DoorLayer />  {/* <-- Doors should render HERE, on top of fog */}
    <Tokens />
  </Layer>
</Stage>
```

## Possible Issues & Solutions

### Issue 1: No Doors in Store
**Symptom:** `[DoorLayer] Rendering 0 doors`
**Solution:** Doors need to be created/added to the map

### Issue 2: No PC Tokens with Vision
**Symptom:** `[FogOfWarLayer] PC tokens with vision: 0`
**Impact:** Fog layer will cover entire screen (no vision cutouts)
**Solution:** Add PC token and set vision radius > 0

### Issue 3: Doors Not Converting to Wall Segments
**Symptom:** Doors exist but `[FogOfWarLayer] Total wall segments: X` doesn't increase
**Solution:** Check door.isOpen state and wall conversion logic

### Issue 4: Layer Rendering Order
**Symptom:** Doors render but are covered by fog
**Check:** Verify fog layer renders BEFORE DoorLayer in DOM
**Solution:** Adjust layer ordering in CanvasManager.tsx

### Issue 5: Opacity or Visibility Issue
**Symptom:** Doors render but are invisible (opacity=0 or display:none)
**Check:** DoorShape.tsx line 98 should show `opacity={1}`
**Solution:** Remove any conditional opacity logic

## Testing Steps

1. **Open World View** (player window)
2. **Open Browser Console** (F12)
3. **Look for log messages** in this order:
   - `[CanvasManager] State:` - Shows critical flags and counts
   - `[CanvasManager] Fog condition:` - Shows if fog should render
   - `[CanvasManager] About to render DoorLayer` - Shows door count
   - `[DoorLayer] Rendering` - Shows actual door rendering
   - `[FogOfWarLayer] PC tokens with vision:` - Shows vision setup
   - `[FogOfWarLayer] Total doors:` - Shows door processing

4. **If NO logs appear at all**:
   - App isn't running or crashed
   - Wrong window/tab
   - Browser console not showing logs (check filter settings)

5. **Compare with DM View** (architect window) to see if doors appear there

## Expected Behavior

### In DM View (Architect):
- ✅ Doors visible (white rectangles)
- ✅ Doors clickable (can toggle open/closed)
- ✅ No fog layer rendered

### In World View (Player):
- ✅ Doors visible on top of fog (white rectangles)
- ✅ Closed doors block vision (fog remains behind them)
- ✅ Open doors allow vision through
- ✅ Doors NOT clickable (read-only)

## Next Steps

After running the app and checking console logs:
1. Report the log output
2. I'll analyze the logs to identify the root cause
3. Implement the appropriate fix
4. Remove debug logging
5. Test and commit

---

**Note:** This debug logging will be removed once we identify and fix the issue.
