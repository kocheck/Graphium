# State Management (Zustand Store)

This directory contains the Zustand state management implementation for Hyle. All global application state is managed through a single store.

## Purpose

The store provides:
- Centralized state management (tokens, drawings, grid configuration)
- State mutations via actions (addToken, updateToken, addDrawing, etc.)
- Subscription API for side effects (IPC sync)
- Type-safe access patterns (TypeScript interfaces)

## Contents

### `gameStore.ts` (44 lines)
**Single global state store for game data**

## Store Architecture

### Why Zustand?

**Chosen over Redux/Context API for:**
- Minimal boilerplate (no actions, reducers, providers)
- Built-in subscription API (needed for IPC sync)
- No Context Provider wrapper (simpler setup)
- TypeScript-first design
- Small bundle size (~1KB)

### State Shape

```typescript
export interface GameState {
  // Data
  tokens: Token[];
  drawings: Drawing[];
  gridSize: number;

  // Actions
  addToken: (token: Token) => void;
  updateTokenPosition: (id: string, x: number, y: number) => void;
  updateTokenProperties: (id: string, properties: Partial<Pick<Token, 'type' | 'visionRadius' | 'name'>>) => void;
  addDrawing: (drawing: Drawing) => void;
  setGridSize: (size: number) => void;
  setState: (state: Partial<GameState>) => void;
  setTokens: (tokens: Token[]) => void;
}

export interface Token {
  id: string;           // crypto.randomUUID()
  x: number;            // Grid-snapped X coordinate (pixels)
  y: number;            // Grid-snapped Y coordinate (pixels)
  src: string;          // file:// URL or https:// URL
  scale: number;        // Size multiplier (1 = 1x1 grid cell, 2 = 2x2, etc.)
  type?: 'PC' | 'NPC';  // Token type (PC = player character with vision, NPC = no vision)
  visionRadius?: number; // Vision range in feet (e.g., 60 for darkvision, 0 = blind)
  name?: string;        // Display name (shown in Token Inspector)
}

export interface Drawing {
  id: string;                        // crypto.randomUUID()
  tool: 'marker' | 'eraser' | 'wall'; // Tool type (wall blocks vision for fog of war)
  points: number[];                   // [x1, y1, x2, y2, x3, y3, ...]
  color: string;                      // Hex color ('#df4b26' marker, '#000000' eraser, '#ff0000' wall)
  size: number;                       // Stroke width (5 marker, 20 eraser, 8 wall)
}
```

### Store Implementation

```typescript
export const useGameStore = create<GameState>((set) => ({
  // Initial state
  tokens: [],
  drawings: [],
  gridSize: 50,

  // Actions
  addToken: (token) => set((state) => ({
    tokens: [...state.tokens, token]
  })),

  updateTokenPosition: (id, x, y) => set((state) => ({
    tokens: state.tokens.map((t) => t.id === id ? { ...t, x, y } : t)
  })),

  addDrawing: (drawing) => set((state) => ({
    drawings: [...state.drawings, drawing]
  })),

  setGridSize: (size) => set({ gridSize: size }),

  setTokens: (tokens) => set({ tokens }),

  setState: (state) => set(state),
}));
```

## Access Patterns

### Pattern 1: Component Rendering (Subscribe to Changes)

**Use when:** Component needs to re-render when state changes

```typescript
const Component = () => {
  // Subscribes to tokens array - re-renders when tokens change
  const tokens = useGameStore((state) => state.tokens);

  return <div>{tokens.length} tokens</div>;
};
```

**Optimization:** Selector function (only re-render when specific value changes)
```typescript
// Only re-renders when token COUNT changes (not when tokens mutate)
const tokenCount = useGameStore((state) => state.tokens.length);
```

### Pattern 2: Multiple Values

**Use when:** Component needs multiple pieces of state

```typescript
const Component = () => {
  // Subscribes to all three - re-renders when ANY change
  const { tokens, drawings, gridSize } = useGameStore();

  return <div>Tokens: {tokens.length}, Drawings: {drawings.length}</div>;
};
```

**Note:** Re-renders when ANY of these change (can be inefficient)

### Pattern 3: Event Handlers (No Subscription)

**Use when:** Need to call action without subscribing

```typescript
const Component = () => {
  // Does NOT subscribe - no re-render when state changes
  const handleClick = () => {
    const { addToken } = useGameStore.getState();
    addToken({
      id: crypto.randomUUID(),
      x: 100,
      y: 100,
      src: 'https://example.com/token.png',
      scale: 1
    });
  };

  return <button onClick={handleClick}>Add Token</button>;
};
```

**Why:** Event handlers don't need to subscribe (they just trigger actions)

### Pattern 4: Bulk Updates (Load/Sync)

**Use when:** Need to replace entire state (load campaign, receive IPC sync)

```typescript
// Load campaign
const loadCampaign = async () => {
  const state = await window.ipcRenderer.invoke('LOAD_CAMPAIGN');
  if (state) {
    useGameStore.setState({
      tokens: state.tokens,
      drawings: state.drawings,
      gridSize: state.gridSize
    });
  }
};

// IPC sync (World View)
window.ipcRenderer.on('SYNC_WORLD_STATE', (_event, state) => {
  useGameStore.setState(state);
});
```

**Why:** setState() is faster than calling multiple actions

### Pattern 5: Subscriptions (Side Effects)

**Use when:** Need to react to ALL state changes (IPC sync, logging, persistence)

```typescript
useEffect(() => {
  // Called on EVERY state change
  const unsubscribe = useGameStore.subscribe((state) => {
    console.log('[STORE] State changed:', state);

    // IPC sync to World Window
    window.ipcRenderer.send('SYNC_WORLD_STATE', {
      tokens: state.tokens,
      drawings: state.drawings,
      gridSize: state.gridSize
    });
  });

  return unsubscribe;  // Cleanup on unmount
}, []);
```

**Important:** Subscribe callback receives ENTIRE state on every change

## Store Mutation Rules

### ❌ NEVER Mutate State Directly

```typescript
// WRONG - mutates array in place
const { tokens } = useGameStore.getState();
tokens.push(newToken);  // BAD!

// WRONG - mutates object in place
const { tokens } = useGameStore.getState();
tokens[0].x = 100;  // BAD!
```

**Why:** Zustand won't detect the change, won't trigger re-renders or subscriptions

### ✅ ALWAYS Use Actions or setState

```typescript
// CORRECT - use action
const { addToken } = useGameStore.getState();
addToken(newToken);

// CORRECT - use setState with new reference
useGameStore.setState((state) => ({
  tokens: [...state.tokens, newToken]
}));

// CORRECT - update existing token
useGameStore.setState((state) => ({
  tokens: state.tokens.map(t => t.id === id ? { ...t, x: 100 } : t)
}));
```

### Immutable Update Patterns

**Add to array:**
```typescript
set((state) => ({ tokens: [...state.tokens, newToken] }))
```

**Remove from array:**
```typescript
set((state) => ({ tokens: state.tokens.filter(t => t.id !== id) }))
```

**Update item in array:**
```typescript
set((state) => ({
  tokens: state.tokens.map(t => t.id === id ? { ...t, x, y } : t)
}))
```

**Update nested object:**
```typescript
set((state) => ({
  tokens: state.tokens.map(t =>
    t.id === id ? { ...t, metadata: { ...t.metadata, name: 'New Name' } } : t
  )
}))
```

## Common Store Tasks

### Task 1: Add New Action

```typescript
// 1. Add to interface
export interface GameState {
  // ... existing
  removeToken: (id: string) => void;  // Add this
}

// 2. Implement in store
export const useGameStore = create<GameState>((set) => ({
  // ... existing
  removeToken: (id) => set((state) => ({
    tokens: state.tokens.filter(t => t.id !== id)
  })),
}));

// 3. Use in component
const Component = () => {
  const { removeToken } = useGameStore();
  return <button onClick={() => removeToken('token-id')}>Delete</button>;
};
```

### Task 2: Add New State Field

```typescript
// 1. Add to interface
export interface GameState {
  // ... existing
  fogEnabled: boolean;  // NEW FIELD
  setFogEnabled: (enabled: boolean) => void;  // NEW ACTION
}

// 2. Add to initial state
export const useGameStore = create<GameState>((set) => ({
  tokens: [],
  drawings: [],
  gridSize: 50,
  fogEnabled: false,  // NEW DEFAULT

  // ... existing actions
  setFogEnabled: (enabled) => set({ fogEnabled: enabled }),
}));

// 3. Update save/load to include new field
const dataToSave = {
  tokens: state.tokens,
  drawings: state.drawings,
  gridSize: state.gridSize,
  fogEnabled: state.fogEnabled,  // Include in save
};
```

### Task 3: Add Computed Selector

```typescript
// Create selector function
const useVisibleTokens = (viewport: { x: number; y: number; width: number; height: number }) => {
  return useGameStore((state) =>
    state.tokens.filter(token =>
      token.x >= viewport.x &&
      token.x <= viewport.x + viewport.width &&
      token.y >= viewport.y &&
      token.y <= viewport.y + viewport.height
    )
  );
};

// Use in component
const Component = () => {
  const viewport = { x: 0, y: 0, width: 1000, height: 1000 };
  const visibleTokens = useVisibleTokens(viewport);

  return <div>{visibleTokens.length} visible</div>;
};
```

### Task 4: Persist State to LocalStorage

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      // ... store implementation
    }),
    {
      name: 'hyle-game-state',  // LocalStorage key
      partialize: (state) => ({
        // Only persist specific fields
        gridSize: state.gridSize,
        // Don't persist tokens/drawings (campaign files handle that)
      }),
    }
  )
);
```

## Performance Considerations

### Subscription Performance

**Problem:** Subscriptions fire on EVERY state change

```typescript
// This subscription fires when tokens, drawings, OR gridSize change
useGameStore.subscribe((state) => {
  // Called very frequently
});
```

**Solution:** Filter in subscription callback
```typescript
let prevTokens = useGameStore.getState().tokens;

useGameStore.subscribe((state) => {
  if (state.tokens !== prevTokens) {
    // Only react to token changes
    console.log('Tokens changed');
    prevTokens = state.tokens;
  }
});
```

### Selector Performance

**Problem:** Component re-renders on unrelated state changes

```typescript
// Re-renders when tokens, drawings, OR gridSize change
const { tokens, drawings, gridSize } = useGameStore();
```

**Solution:** Use specific selectors
```typescript
// Only re-renders when tokens change
const tokens = useGameStore((state) => state.tokens);

// Even better: only re-render when token COUNT changes
const tokenCount = useGameStore((state) => state.tokens.length);
```

### Large State Arrays

**Problem:** Re-rendering 1000+ tokens on every change

**Solution 1:** Memoize rendering
```typescript
const tokens = useGameStore((state) => state.tokens);

const renderedTokens = useMemo(() => {
  return tokens.map(token => <TokenImage key={token.id} {...token} />);
}, [tokens]);
```

**Solution 2:** Virtualization
```typescript
import { FixedSizeList } from 'react-window';

const tokenCount = useGameStore((state) => state.tokens.length);
const getToken = (index: number) => useGameStore.getState().tokens[index];

<FixedSizeList
  height={600}
  itemCount={tokenCount}
  itemSize={100}
  width={300}
>
  {({ index, style }) => {
    const token = getToken(index);
    return <div style={style}>{token.id}</div>;
  }}
</FixedSizeList>
```

## Testing

### Manual Testing Checklist

**Store initialization:**
- [ ] Store creates with default values ([], [], 50)
- [ ] No console errors on import

**Actions:**
- [ ] addToken adds token to array
- [ ] updateTokenPosition updates correct token
- [ ] addDrawing adds drawing to array
- [ ] setGridSize updates gridSize
- [ ] setState replaces state correctly

**Subscriptions:**
- [ ] subscribe callback fires on state change
- [ ] unsubscribe stops receiving updates
- [ ] Multiple subscriptions work independently

**IPC sync:**
- [ ] Main Window subscription sends IPC
- [ ] World Window IPC listener updates store
- [ ] State syncs correctly between windows

### Unit Testing (Future)

```typescript
// gameStore.test.ts
import { useGameStore } from './gameStore';

describe('gameStore', () => {
  beforeEach(() => {
    // Reset store
    useGameStore.setState({
      tokens: [],
      drawings: [],
      gridSize: 50
    });
  });

  test('addToken adds token to store', () => {
    const token = {
      id: '1',
      x: 100,
      y: 100,
      src: 'test.png',
      scale: 1
    };

    useGameStore.getState().addToken(token);

    const tokens = useGameStore.getState().tokens;
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toEqual(token);
  });

  test('updateTokenPosition updates correct token', () => {
    const token1 = { id: '1', x: 0, y: 0, src: 'a.png', scale: 1 };
    const token2 = { id: '2', x: 50, y: 50, src: 'b.png', scale: 1 };

    useGameStore.setState({ tokens: [token1, token2] });
    useGameStore.getState().updateTokenPosition('1', 100, 100);

    const tokens = useGameStore.getState().tokens;
    expect(tokens[0].x).toBe(100);
    expect(tokens[0].y).toBe(100);
    expect(tokens[1].x).toBe(50);  // Unchanged
  });

  test('subscription fires on state change', () => {
    const callback = jest.fn();
    const unsub = useGameStore.subscribe(callback);

    useGameStore.setState({ gridSize: 100 });

    expect(callback).toHaveBeenCalled();
    unsub();
  });
});
```

## Common Issues

### Issue: State not updating in component
**Symptoms:** Store changes but component doesn't re-render

**Diagnosis:**
1. Using getState() instead of hook
2. Subscribing to wrong part of state
3. Mutating state directly (no new reference)

**Solution:**
```typescript
// ❌ WRONG - no subscription
const Component = () => {
  const tokens = useGameStore.getState().tokens;  // No re-render!
  return <div>{tokens.length}</div>;
};

// ✅ CORRECT - with hook
const Component = () => {
  const tokens = useGameStore((state) => state.tokens);  // Re-renders!
  return <div>{tokens.length}</div>;
};
```

### Issue: Component re-renders too often
**Symptoms:** Performance lag, console.log in component fires frequently

**Diagnosis:** Subscribing to entire store or unrelated fields

**Solution:**
```typescript
// ❌ BAD - re-renders on ANY state change
const { tokens, drawings, gridSize } = useGameStore();

// ✅ BETTER - only re-renders when tokens change
const tokens = useGameStore((state) => state.tokens);

// ✅ BEST - only re-renders when token COUNT changes
const tokenCount = useGameStore((state) => state.tokens.length);
```

### Issue: Subscription not firing
**Symptoms:** IPC sync not working, side effects not triggering

**Diagnosis:**
1. Subscription not set up (useEffect missing)
2. State not actually changing (same reference)
3. Subscription unsubscribed prematurely

**Solution:**
```typescript
// Ensure useEffect returns cleanup
useEffect(() => {
  const unsub = useGameStore.subscribe((state) => {
    console.log('[SUBSCRIBE] State changed:', state);
  });

  return unsub;  // CRITICAL: cleanup on unmount
}, []);  // Empty deps = runs once

// Ensure state reference changes
set((state) => ({
  tokens: [...state.tokens, newToken]  // New array reference
}));
```

### Issue: setState not merging correctly
**Symptoms:** Some state fields disappear after setState

**Diagnosis:** setState REPLACES entire state by default

**Solution:**
```typescript
// ❌ WRONG - loses other fields
useGameStore.setState({ tokens: newTokens });
// Result: drawings and gridSize are undefined!

// ✅ CORRECT - merge with existing state
useGameStore.setState((state) => ({
  ...state,  // Spread existing state
  tokens: newTokens
}));

// ✅ ALSO CORRECT - Zustand auto-merges top-level
useGameStore.setState({ tokens: newTokens });  // Actually works!
// (Zustand's default is shallow merge for top-level fields)
```

## Future Enhancements

### Planned
1. **Undo/Redo** - History middleware for state changes
2. **State Validation** - Type guards for loaded data
3. **Optimistic Updates** - Update UI before IPC confirmation
4. **State Persistence** - LocalStorage for grid settings

### Under Consideration
1. **Multiple Stores** - Separate UI state from game state
2. **Derived State** - Computed selectors (visible tokens, selected items)
3. **Middleware** - Logging, dev tools, state snapshots
4. **Immer Integration** - Simpler immutable updates

## Related Documentation

- **[State Management Guide](../../docs/components/state-management.md)** - Complete store documentation
- **[Architecture Overview](../../docs/architecture/ARCHITECTURE.md#state-management)** - State management architecture
- **[Code Conventions](../../docs/guides/CONVENTIONS.md)** - Store mutation rules
- **[Renderer Process](../README.md)** - Renderer process overview
- **[Domain Context](../../docs/context/CONTEXT.md)** - Business rules for state
