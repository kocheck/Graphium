# Door Visibility & Vision Blocking - Comprehensive Analysis

## Current Status
Based on console logs, we know:
- ✅ World View is enabled (`isWorldView: true`)
- ✅ Daylight mode is OFF (`isDaylightMode: false`)
- ✅ Fog should render (`shouldRenderFog: true`)
- ✅ Doors exist (after generation): `doorsCount: X`
- ✅ PC tokens exist: `pcTokensCount: 1`
- ❌ **FogOfWarLayer logs NOT appearing**

## Critical Issue: FogOfWarLayer Not Logging

The fact that FogOfWarLayer logs don't appear is the KEY issue. This means either:

### Possibility 1: Component Not Rendering
- React error/crash preventing FogOfWarLayer from mounting
- Check browser console for React errors (red text)
- Look for "Error:" or "Uncaught" messages

### Possibility 2: PC Token Has No Vision Radius
- If PC token has `visionRadius: 0` or `undefined`:
  - FogOfWarLayer renders
  - But NO vision cutouts are created
  - Entire map covered in solid fog
  - Doors rendered underneath but invisible

## The Vision Radius Problem

**How Vision Works:**
1. PC tokens MUST have `visionRadius > 0` (e.g., 30, 60, 120 feet)
2. FogOfWarLayer creates vision "cutouts" based on this radius
3. Without vision, the ENTIRE map is black fog
4. Doors/tokens underneath are invisible

**Setting Vision Radius:**
1. In DM view, click a PC token
2. Open TokenInspector panel
3. Set "Vision Radius" to 60ft (or similar)
4. Save/apply changes

## Door Visibility Issues - Root Causes

### Issue 1: No Vision Cutouts
**Symptom:** Entire map is black, can't see anything
**Cause:** PC token has no vision radius set
**Solution:** Set PC token vision radius to 60ft+

### Issue 2: Doors Covered by Fog
**Symptom:** Doors exist but not visible
**Cause:** Fog layer rendered on top of doors
**Current Fix:** Doors moved to Layer 3 (after fog)
**Should Work If:** Vision cutouts exist

### Issue 3: Layer Compositing Bug
**Symptom:** Doors still not visible even with vision
**Cause:** Konva layer compositing issues
**Test:** Check if doors visible in DM view
**Solution:** May need to render doors within fog layer itself

## Door Vision Blocking Issues

### How Door Blocking Works
1. Closed doors (`isOpen: false`) converted to wall segments
2. Wall segments added to raycasting obstacles
3. Raycasting stops at door, creating fog behind it
4. Open doors (`isOpen: true`) NOT added to obstacles

### Why It Might Not Be Working
1. **No vision to block** - If PC has no vision radius, no raycasting happens
2. **Doors are open** - Check door state, verify `isOpen: false`
3. **Door position** - Doors must be between PC and area being blocked

## Testing Checklist

### Step 1: Verify Basic Setup
- [ ] Dungeon generated with doors
- [ ] Doors visible in DM view (white rectangles)
- [ ] PC token exists on map
- [ ] PC token type set to 'PC' (not 'NPC')

### Step 2: Set Vision Radius
- [ ] Click PC token in DM view
- [ ] Open TokenInspector
- [ ] Set Vision Radius to 60ft
- [ ] Verify value saved (check console for visionRadius)

### Step 3: Check Console Logs
After setting vision, you should see:
```
[FogOfWarLayer] COMPONENT RENDERING - Start
[FogOfWarLayer] Props: { tokensCount: 1, doorsCount: X, ... }
[FogOfWarLayer] PC tokens with vision: 1 out of 1 total tokens
[FogOfWarLayer] Total doors: X Closed doors: X
[FogOfWarLayer] Total wall segments: X
[FogOfWarLayer] RENDERING JSX - PC tokens: 1
```

**If you still see 0 PC tokens with vision:**
- Vision radius not set correctly
- Token type not 'PC'
- visionRadius property not saving

### Step 4: Test in World View
- [ ] Switch to World View window
- [ ] Should see vision cone around PC token
- [ ] Map visible within vision cone
- [ ] Fog/darkness outside vision
- [ ] Doors visible at vision cone edge

### Step 5: Test Door Blocking
- [ ] Place PC token in room
- [ ] Close door to adjacent room
- [ ] Verify fog/darkness behind closed door
- [ ] Open door
- [ ] Verify vision extends through open door

## Expected Console Output (Working)

```
[CanvasManager] State: {
  isWorldView: true,
  isDaylightMode: false,
  doorsCount: 12,
  tokensCount: 1,
  pcTokensCount: 1,
  activeVisionPolygonsCount: 1
}

[FogOfWarLayer] COMPONENT RENDERING - Start
[FogOfWarLayer] Props: {
  tokensCount: 1,
  doorsCount: 12,
  drawingsCount: 50,
  hasMap: true
}

[FogOfWarLayer] PC tokens with vision: 1 out of 1 total tokens
[FogOfWarLayer] Total doors: 12 Closed doors: 8
[FogOfWarLayer] Total wall segments: 145
[FogOfWarLayer] RENDERING JSX - PC tokens: 1

[DoorLayer] Rendering 12 doors. isWorldView: true
[DoorLayer] Rendering door: abc123 isOpen: false at 500 300
...
```

## Expected Console Output (No Vision)

```
[CanvasManager] State: {
  isWorldView: true,
  isDaylightMode: false,
  doorsCount: 12,
  tokensCount: 1,
  pcTokensCount: 1,
  activeVisionPolygonsCount: 0  ← Zero vision polygons!
}

[FogOfWarLayer] PC tokens with vision: 0 out of 1 total tokens  ← Problem!
[FogOfWarLayer] WARNING: PC tokens exist but NONE have vision radius set!
[FogOfWarLayer] Set vision radius on PC tokens in TokenInspector (try 60ft)
[FogOfWarLayer] Without vision, the entire map will be covered in fog!
```

## Next Steps

1. **Refresh the app** to get latest logging code
2. **Open World View console** (F12)
3. **Share COMPLETE console output** (screenshot or copy/paste all text)
4. **Verify PC token has vision radius set** in TokenInspector
5. **Test again and report results**

If FogOfWarLayer logs STILL don't appear after refresh, there's a React crash/error. Check for red error messages in console.
