# Explored Fog of War Improvements

## Changes Made

### Issue 1: Explored Areas Not Dim Enough

**Problem:** Explored areas were too dark, making it hard to see the map layout.

**Cause:** Using `rgba(0, 0, 0, 0.5)` (50% opacity) for explored areas meant only 50% of the fog was being erased, leaving 50% of the heavy fog still covering the map.

**Fix:** Increased alpha from `0.5` to `0.8` (80% opacity)

- Erases 80% of the fog instead of 50%
- Leaves only 20% of the fog for dimming effect
- Much more visible while still clearly distinct from current vision

**Visual Effect:**

- Before: 50% fog remaining = very dark, hard to see
- After: 20% fog remaining = nicely dimmed, can see room layout

### Issue 2: Debugging Explored Region Updates

**Added:** Console logging to track when explored regions are saved.

This will help identify if regions are being added consistently or if there's a timing issue.

**Log Format:**

```
[FogOfWar] Added 1 explored region(s). Total: 15
```

This shows:

- How many regions were added this update (usually 1 per PC token)
- Total number of regions accumulated

### How It Works

**Fog Opacity Levels:**

1. **Unexplored** (never seen): 100% fog (blur + very dark)
2. **Explored** (previously seen): 20% fog (dimmed but visible)
3. **Current Vision**: 0% fog (completely clear)

**Update Timing:**

- Effect triggers when tokens array changes (includes position changes)
- Throttled to 1-second intervals to prevent performance issues
- Logs confirm when regions are being added

### Testing Recommendations

1. **Check dimness level:**
   - Move PC token to explore an area
   - Move token away
   - Explored area should be clearly visible (much lighter than before)
   - Should still be dimmer than current vision

2. **Check console logs:**
   - Open browser DevTools console
   - Move PC token around
   - Should see logs every ~1 second showing regions being added
   - Confirms the update mechanism is working

3. **Performance:**
   - Explore for several minutes
   - Check if there's any slowdown (many accumulated regions)
   - May need to add region limiting/merging in future

### Potential Future Improvements

If performance becomes an issue with many accumulated regions:

1. **Limit region count:**

   ```typescript
   // Keep only last 200 regions
   if (exploredRegions.length > 200) {
     exploredRegions = exploredRegions.slice(-200);
   }
   ```

2. **Merge overlapping regions:**
   - Use polygon union algorithms
   - Reduce number of shapes to render
   - More complex but better performance

3. **Clear old regions:**
   - Use timestamp to remove regions older than X minutes
   - Simulates "memory decay"

4. **Single canvas approach:**
   - Render all explored areas to a single cached canvas
   - Render that canvas instead of individual shapes
   - Much better performance for many regions

### Files Modified

1. **src/components/Canvas/FogOfWarLayer.tsx**
   - Changed explored fog opacity: 0.5 → 0.8
   - Added console logging for debugging
   - Added regionsAdded counter

2. **EXPLORED_FOG_IMPROVEMENTS.md**
   - This documentation

## Testing Notes

Run the game and:

1. Check if explored areas are now more visible ✅
2. Check console for region addition logs ✅
3. Verify regions continue to be added as tokens move ✅

If regions stop being added after the first movement, check console logs to see if the effect is still triggering.
