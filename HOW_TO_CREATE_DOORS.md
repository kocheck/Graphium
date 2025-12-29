# How to Create Doors - Quick Guide

## Problem
Console logs show `doorsCount: 0` - There are NO doors in the gameStore!

## Solution: Use the Dungeon Generator

Doors in Hyle are created through the **Dungeon Generator Dialog**, not manually placed.

### Steps to Create Doors:

1. **Open DM View** (Architect window)

2. **Open Dungeon Generator**
   - Look for a "Dungeon Generator" button/menu item in the UI
   - OR check if there's a keyboard shortcut
   - The dialog is in `src/components/DungeonGeneratorDialog.tsx`

3. **Generate a Dungeon**
   - Configure dungeon parameters (size, room count, etc.)
   - The generator will automatically create:
     - Rooms
     - Corridors
     - **Doors** (at room entrances)
     - Walls

4. **Verify Doors Were Created**
   - Check the DM view - you should see white rectangles (doors)
   - Open console (F12) and look for: `[CanvasManager] State: { doorsCount: X }`
   - The count should be > 0

5. **Test in World View**
   - Switch to World View (player window)
   - Doors should now be visible
   - Closed doors should block vision/fog

## Why Doors Weren't Showing

Your console logs showed:
```
doorsCount: 0
[DoorLayer] Rendering 0 doors
```

This means:
- ✅ The rendering system works correctly
- ✅ World View is enabled properly
- ✅ Fog of War is enabled
- ❌ **No doors exist in the map data**

## Alternative: Check if You're on the Right Map

If you DID generate a dungeon but still see 0 doors:

1. **Check Active Map**
   - You might have multiple maps in your campaign
   - You might be viewing a different map than where you generated the dungeon

2. **Check Campaign State**
   - Doors are saved per-map in the campaign
   - Switching maps loads different door sets

## Next Steps

Once you generate a dungeon with doors:
- Doors will appear in both DM and World View
- Closed doors will block vision (create fog behind them)
- You can click doors in DM view to toggle open/closed
- Use DoorControls to bulk open/close/unlock doors
