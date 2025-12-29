# Critical Bug Analysis: Doors Not Blocking & Not Visible

## User Report (Critical Info)

**User stated:**
> "In the past I was setting the vision to 30 and 60. And I could still see through where doors were while not being able to see the door."

**This means:**
- ✅ Vision system WAS working (had vision radius set)
- ❌ Doors NOT blocking vision (could see through them)
- ❌ Doors NOT visible (couldn't see the door itself)

## Root Cause Hypothesis

### Issue 1: Doors Not Blocking Vision
**Theory:** Door wall segments not being used in raycasting

**Evidence to check:**
1. Are doors being passed to FogOfWarLayer? (console log should show)
2. Are closed doors being converted to wall segments? (console log should show count)
3. Are wall segments being passed to `calculateVisibilityPolygon`? (code review: YES - line 157)
4. Is raycasting actually using the wall segments? (need to verify)

**Possible bugs:**
- `walls` memo not updating when doors change
- Doors array empty in FogOfWarLayer
- Door-to-segment conversion logic broken
- Raycasting not checking all wall segments

### Issue 2: Doors Not Visible
**Theory:** Doors rendering but covered/hidden by something

**Evidence to check:**
1. Are doors rendering in DoorLayer? (console logs show this)
2. Are doors visible in DM view? (user should check)
3. Layer ordering - doors after fog? (YES - Layer 3)
4. Opacity issues? (DoorShape.tsx line 98: `opacity={1}`)
5. Composite operation issues? (fog layer uses destination-out)

**Possible bugs:**
- Doors rendering with opacity: 0
- Doors off-screen (position bug)
- Z-index/layer ordering issue
- Konva composite operation affecting subsequent layers
- Doors not rendering in World View specifically

## Tests Created

### 1. Door Blocking Tests (`DoorBlocking.test.ts`)
Tests that verify:
- ✅ Closed doors convert to wall segments correctly
- ✅ Open doors DON'T convert to wall segments
- ✅ Horizontal doors create correct segments
- ✅ Vertical doors create correct segments
- ✅ Ray intersection with door segments works
- ✅ Vision should be blocked by closed doors

**Status:** Tests written, ready to run

### 2. Geometry Tests (`geometry.test.ts`)
Tests that verify:
- ✅ Point-in-polygon algorithm works
- ✅ Rect-in-polygon for token visibility works

**Status:** Tests written, ready to run

## Critical Debugging Questions

### Question 1: Are doors reaching FogOfWarLayer?
**Check console for:**
```
[FogOfWarLayer] Props: { doorsCount: X }  ← Should be > 0
[FogOfWarLayer] Total doors: X Closed doors: Y  ← Should show doors
```

**If doorsCount: 0** → Doors not in store or not passed to component
**If doors not logged** → FogOfWarLayer not rendering

### Question 2: Are door segments being created?
**Check console for:**
```
[FogOfWarLayer] Total wall segments: X
```

**Expected:**
- Wall segments from drawings: ~50-100 (typical dungeon)
- Wall segments from doors: 1 per closed door
- Total should be: drawings + closed doors

**If count doesn't increase with doors** → Conversion logic broken

### Question 3: Are doors rendering?
**Check console for:**
```
[DoorLayer] Rendering X doors. isWorldView: true
[DoorLayer] Rendering door: <id> isOpen: false at <x> <y>
```

**If not logging** → DoorLayer not rendering
**If logging but not visible** → Rendering but hidden/covered

### Question 4: Are doors visible in DM view?
**User should check:**
- Switch to DM view (Architect window)
- Do you see white rectangles (doors)?
- Can you click them to toggle open/closed?

**If YES in DM, NO in World View** → World View specific rendering bug
**If NO in both views** → Doors not rendering at all

## Hypothesis Based on User's Description

### Most Likely: Memo Dependency Bug

Looking at FogOfWarLayer.tsx line 128:
```typescript
}, [drawings, doors]);  // Re-calculate when drawings OR doors change
```

**BUT** - the `visibilityCache` dependencies (line 165) are:
```typescript
}, [
  pcTokensKey,
  walls,  // This comes from the memo above
  gridSize
]);
```

**Potential bug:**
- `walls` is a memoized value
- `visibilityCache` depends on `walls`
- If `walls` memo doesn't update properly, raycasting uses OLD wall segments
- This would explain seeing through doors (old segments without doors)

### Testing This Hypothesis

Add this console log in FogOfWarLayer:
```typescript
console.log('[FogOfWarLayer] walls dependency:', walls.length, 'segments');
console.log('[FogOfWarLayer] walls includes doors?', walls.length > drawings.filter(d => d.tool === 'wall').length);
```

Expected:
- walls.length should be: drawing segments + door segments
- Second log should be TRUE if doors are included

## Potential Fixes

### Fix 1: Force walls memo to update
```typescript
const walls: WallSegment[] = useMemo(() => {
  const wallSegments: WallSegment[] = [];
  // ... existing logic ...
  console.log('[FogOfWarLayer] WALLS MEMO RECALCULATING');
  return wallSegments;
}, [drawings, doors, doors.length]);  // Add doors.length to force update
```

### Fix 2: Serialize doors for change detection
```typescript
const doorsKey = useMemo(
  () => doors.map(d => `${d.id}:${d.isOpen}`).join('|'),
  [doors]
);

const walls: WallSegment[] = useMemo(() => {
  // ... existing logic ...
}, [drawings, doorsKey]);  // Use serialized key instead of doors array
```

### Fix 3: Add doors to visibilityCache dependencies
```typescript
}, [
  pcTokensKey,
  walls,
  gridSize,
  doors.length  // Force recalculation when door count changes
]);
```

### Fix 4: Debug door visibility in World View

Check if doors have conditional rendering:
```typescript
// In DoorShape.tsx or DoorLayer.tsx
if (isWorldView) {
  // Is there any code that hides doors?
}
```

## Next Steps

1. **Run the tests**
   - Verify door-to-segment conversion works
   - Verify raycasting logic works

2. **Add more diagnostic logging**
   - Log walls.length before and after door conversion
   - Log when walls memo recalculates
   - Log when visibilityCache recalculates

3. **Check DM view**
   - Confirm doors visible there
   - Rules out rendering issue

4. **Test memo dependencies**
   - Try the fixes above
   - See if forcing memo updates fixes blocking

5. **Check layer compositing**
   - Verify fog layer doesn't affect doors layer
   - Test with fog disabled (daylight mode)

## Success Criteria

- [ ] Console shows: `Total doors: X Closed doors: Y` where X, Y > 0
- [ ] Console shows: `Total wall segments: Z` where Z = drawings + doors
- [ ] Doors visible in DM view
- [ ] Doors visible in World View (within vision cone)
- [ ] Closed doors create fog behind them (block vision)
- [ ] Open doors allow vision through
- [ ] Tests pass

## Risk Assessment

**High probability bugs:**
1. Memo dependency issue (walls not updating with doors) - 70%
2. Doors not visible due to rendering bug - 20%
3. Door position/size calculation wrong - 10%

**Low probability:**
- Raycasting algorithm broken (would affect walls too)
- Layer ordering (already fixed)
- Geometry utilities (tested)
