# Option + Drag Duplicate Implementation Notes

## Overview
This document describes the implementation of the Option + Drag duplicate feature for canvas tokens.

## Implementation Details

### Modified Files
- `src/components/Canvas/CanvasManager.tsx`

### Key Changes

#### 1. Enhanced URLImage Component
The `URLImage` component was refactored to support drag event handling with alt/option key detection:

- **Props Interface**: Updated to accept `token` object and callback functions `onDuplicate` and `onMove`
- **State Management**: Added `isDuplicateMode` state to track if Option key is pressed
- **Original Position Tracking**: Uses `useRef` to store the original position at drag start

#### 2. Drag Event Handlers

##### handleDragStart
- Captures the original position of the token
- Checks if Option/Alt key is pressed (`e.evt.altKey`)
- Updates cursor to 'copy' if in duplicate mode
- Sets the `isDuplicateMode` state

##### handleDragMove
- Continuously checks for changes in Option/Alt key state during drag
- Updates cursor dynamically ('copy' for duplicate, 'grabbing' for move)
- If switching from move to duplicate mode, resets token position to original
- Implements toggle behavior as specified in requirements

##### handleDragEnd
- Determines final action based on Option/Alt key state at drop time
- **Duplicate Mode** (Alt pressed):
  - Calls `onDuplicate` to create new token with unique ID at new position
  - Resets the dragged token back to original position
  - Original token remains visible and unchanged
- **Move Mode** (Alt not pressed):
  - Calls `onMove` to update token position in store
- Resets cursor to default
- Clears duplicate mode state

#### 3. CanvasManager Integration
Added handler functions in CanvasManager:

- **handleTokenDuplicate**: Creates a new token with `crypto.randomUUID()` and adds it to store
- **handleTokenMove**: Updates token position using existing `updateTokenPosition` store action

## Acceptance Criteria Coverage

✅ **Trigger**: Option key detection during drag operation  
✅ **Visual Feedback**: Cursor changes to 'copy', original stays visible  
✅ **Action**: Creates new instance at drop coordinates, original unchanged  
✅ **Toggle Behavior**: Dynamically switches between move and copy modes  
⚠️ **Selection**: No selection system exists in codebase yet  
⚠️ **Undo/Redo**: No history system exists in codebase yet (single action ready for future implementation)

## Cross-Platform Compatibility
The implementation uses `event.altKey` which maps to:
- **macOS**: Option (⌥) key
- **Windows/Linux**: Alt key

This ensures the feature works consistently across all platforms.

## Technical Notes

### Why Reset Position on Mode Switch?
When switching from move mode to duplicate mode (pressing Option mid-drag), we reset the token to its original position. This provides clear visual feedback that:
1. The original will stay in place
2. A new copy is being created
3. The user is now dragging a "preview" of where the duplicate will be placed

### Konva Event Integration
We use Konva's built-in drag events (`onDragStart`, `onDragMove`, `onDragEnd`) which provide:
- Native drag behavior
- Event object with access to keyboard modifiers (`evt.altKey`)
- Position tracking
- Stage/container access for cursor manipulation

## Future Enhancements

### Selection System
To fully implement the "Selection" acceptance criteria, a future enhancement should:
1. Add a `selectedTokenId` field to the game store
2. Update the store when tokens are clicked or created
3. Add visual indicators (outline, highlight) for selected tokens
4. Implement the selection update in `handleTokenDuplicate`

### Undo/Redo System
To implement the "Undo/Redo" acceptance criteria:
1. Add a history stack to the game store
2. Wrap state mutations in history-aware actions
3. Implement undo/redo actions
4. Add keyboard shortcuts (Cmd+Z / Cmd+Shift+Z)

The current implementation uses atomic actions (`addToken`, `updateTokenPosition`) which will integrate seamlessly with a future history system.

## Testing Recommendations

### Manual Testing Checklist
- [ ] Drag token without Option key - should move token
- [ ] Drag token with Option key held from start - should create duplicate
- [ ] Start dragging, then press Option mid-drag - should switch to duplicate mode
- [ ] Start dragging with Option, then release Option mid-drag - should switch to move mode
- [ ] Verify cursor changes appropriately during all above scenarios
- [ ] Verify original token stays in place during duplicate operation
- [ ] Verify new token is created at drop location in duplicate mode
- [ ] Test on both macOS (Option) and Windows/Linux (Alt)

### Unit Testing (Future)
When adding tests, consider:
- Mock Konva event objects with varying `altKey` states
- Test state transitions in `handleDragMove`
- Test position calculations in `handleDragEnd`
- Test token creation in `handleTokenDuplicate`
