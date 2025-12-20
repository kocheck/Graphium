# State Management (Zustand Store)

All global application state is managed through a single Zustand store.

## Purpose

The store provides:
- Centralized state management (tokens, drawings, grid configuration)
- State mutations via actions (addToken, updateToken, addDrawing, etc.)
- Subscription API for side effects (IPC sync)
- Type-safe access patterns (TypeScript interfaces)

## Store Architecture

### Why Zustand?

Chosen over Redux/Context API for:
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
  addDrawing: (drawing: Drawing) => void;
  setGridSize: (size: number) => void;
  setState: (state: Partial<GameState>) => void;
  setTokens: (tokens: Token[]) => void;
}
```

## Access Patterns

### Component Rendering (Subscribe to Changes)
```typescript
const Component = () => {
  // Subscribes to tokens array - re-renders when tokens change
  const tokens = useGameStore((state) => state.tokens);
  return <div>{tokens.length} tokens</div>;
};
```

### Event Handlers (No Subscription)
```typescript
const Component = () => {
  const handleClick = () => {
    const { addToken } = useGameStore.getState();
    addToken({ id: crypto.randomUUID(), x: 100, y: 100, src: 'token.png', scale: 1 });
  };
  return <button onClick={handleClick}>Add Token</button>;
};
```

### Bulk Updates (Load/Sync)
```typescript
// Load campaign
const state = await window.ipcRenderer.invoke('LOAD_CAMPAIGN');
if (state) {
  useGameStore.setState({
    tokens: state.tokens,
    drawings: state.drawings,
    gridSize: state.gridSize
  });
}
```

### Subscriptions (Side Effects)
```typescript
useEffect(() => {
  const unsubscribe = useGameStore.subscribe((state) => {
    // IPC sync to World Window
    window.ipcRenderer.send('SYNC_WORLD_STATE', {
      tokens: state.tokens,
      drawings: state.drawings,
      gridSize: state.gridSize
    });
  });
  return unsubscribe;
}, []);
```

## Store Mutation Rules

### ❌ NEVER Mutate State Directly
```typescript
const { tokens } = useGameStore.getState();
tokens.push(newToken);  // BAD!
```

### ✅ ALWAYS Use Actions or setState
```typescript
const { addToken } = useGameStore.getState();
addToken(newToken);  // GOOD!
```

## Related Documentation
- [Architecture Overview](../architecture/ARCHITECTURE.md#state-management)
- [Code Conventions](../guides/CONVENTIONS.md)
- [IPC Sync](../architecture/IPC_API.md#sync_world_state)
