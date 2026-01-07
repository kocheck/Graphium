# Copilot Instructions for Graphium

## Project Overview

**Graphium** is a local-first D&D digital battlemap application built with Electron, React, and TypeScript. It provides a dual-window system for Dungeon Masters: an "Architect View" for DM control and a "World View" for players.

## Tech Stack

- **Framework**: Electron 33 + React 18 + TypeScript 5
- **State Management**: Zustand (immutable updates pattern)
- **Canvas**: Konva/React-Konva (HTML5 Canvas)
- **Styling**: Tailwind CSS + Radix Colors
- **Build**: Vite 6
- **Testing**: Vitest + React Testing Library + Playwright

## Key Architecture Patterns

### 1. Dual-Window Architecture

- **Architect View**: DM's control window (full UI, tools, sidebar)
- **World View**: Player-facing window (canvas only, no UI chrome)
- **IPC Sync**: One-way state sync from Architect → World via Electron IPC

### 2. State Management (Zustand)

**CRITICAL**: Always use immutable updates. Never mutate state directly.

```typescript
// ✅ CORRECT: Immutable update
addToken: (token) =>
  set((state) => ({
    tokens: [...state.tokens, token],
  }));

// ❌ WRONG: Direct mutation
addToken: (token) => {
  state.tokens.push(token); // DON'T DO THIS
  return { tokens: state.tokens };
};
```

### 3. IPC Communication Pattern

**Architecture**: Architect (Producer) → Main Process (Relay) → World (Consumer)

```typescript
// Send from renderer (one-way)
window.ipcRenderer.send('SYNC_WORLD_STATE', gameState);

// Request-response (async)
const result = await window.ipcRenderer.invoke('SAVE_CAMPAIGN', gameState);
```

### 4. Error Handling & Privacy

- **Three layers**: PrivacyErrorBoundary (app-wide), TokenErrorBoundary (per-token), globalErrorHandler (window errors)
- **PII Sanitization**: Always sanitize errors before display/storage (removes usernames, emails, file paths, tokens)
- **Error Persistence**: Store in localStorage for optional user reporting

### 5. Asset Processing Pipeline

**Flow**: Upload → Resize → WebP Conversion → Temp Storage → Campaign Save

```typescript
// Process image (automatic resize + WebP conversion)
const tempUrl = await processImage(file, 'TOKEN');

// Use temp URL (stored in userData/temp_assets/)
addToken({ id: uuid(), x, y, src: tempUrl, scale: 1 });

// Save campaign (assets copied to .graphium ZIP)
await window.ipcRenderer.invoke('SAVE_CAMPAIGN', gameState);
```

## Coding Standards

### File Naming

- **Components**: PascalCase (e.g., `CanvasManager.tsx`, `GridOverlay.tsx`)
- **Utilities/Stores**: camelCase (e.g., `grid.ts`, `gameStore.ts`)
- **Configuration**: kebab-case (e.g., `vite.config.ts`)

### TypeScript

- **Strict mode enabled** - no `any` without justification
- **Interfaces for objects**, types for unions/primitives
- **Explicit return types** for exported functions
- Avoid `@ts-ignore` - create proper type declarations instead

### Component Structure (Order Matters)

```typescript
// 1. External imports (React, third-party)
import { useState, useEffect } from 'react';

// 2. Internal utilities
import { snapToGrid } from '../../utils/grid';

// 3. Stores
import { useGameStore } from '../../store/gameStore';

// 4. Components
import GridOverlay from './GridOverlay';

// 5. Type definitions
interface ComponentProps { ... }

// 6. Component definition
const Component = (props) => {
  // 7. Refs
  // 8. State hooks
  // 9. Store hooks
  // 10. Derived values (useMemo)
  // 11. Callbacks (useCallback)
  // 12. Event handlers
  // 13. Effects
  // 14. Render helpers
  // 15. JSX return
}

// 16. Export
export default Component;
```

### Styling (Tailwind CSS)

**Color Palette** (always use these):

- **Backgrounds**: `bg-neutral-900` (darkest), `bg-neutral-800` (panels), `bg-neutral-700` (hover)
- **Text**: `text-white` (primary), `text-neutral-400` (secondary)
- **Borders**: `border-neutral-700`
- **Primary Actions**: `bg-blue-600` + `hover:bg-blue-500`
- **Danger**: `bg-red-600` + `hover:bg-red-500`

**No inline styles** - use Tailwind classes only.

### Icons (Remix Icon)

**Always use Remix Icon components** from `@remixicon/react`:

```typescript
// ✅ Correct
import { RiAddLine, RiCloseLine, RiSearchLine } from '@remixicon/react';
<button><RiAddLine className="w-5 h-5" /> Add</button>

// ❌ Wrong - Don't use emoji or inline SVG
<button>➕ Add</button>
<button><svg>...</svg> Add</button>
```

**Rules:**

- Use Line style variants (`*Line`) for consistency
- Standard sizes: `w-4 h-4` (small), `w-5 h-5` (default), `w-6 h-6` (large)
- Icons inherit color via `currentColor`
- See CONVENTIONS.md for full icon list and mappings

### Import Organization

```typescript
// 1. React and core libraries
import React, { useState, useEffect } from 'react';

// 2. Third-party UI libraries
import { Stage, Layer } from 'react-konva';

// 3. Utilities (relative paths)
import { snapToGrid } from './grid';

// 4. Stores
import { useGameStore } from '../store/gameStore';

// 5. Components
import GridOverlay from './GridOverlay';

// 6. Types
import type { Token } from '../types';
```

## Domain Glossary

- **Architect View**: DM's control window with full controls
- **World View**: Clean player-facing window (canvas only)
- **Token**: Draggable image on battlemap (snaps to grid)
- **Drawing**: Freehand marker/eraser stroke
- **Map**: Background image for battlemap
- **Grid**: Tactical positioning overlay (LINES/DOTS/HIDDEN modes)
- **Grid Snapping**: Auto-alignment (intersections for even-sized tokens, cell centers for odd-sized)
- **Campaign File**: `.graphium` ZIP archive (manifest.json + assets/)
- **IPC**: Inter-Process Communication (Electron main ↔ renderer)
- **Sync Manager**: Broadcasts Architect state to World View
- **Asset Processor**: Resizes/converts images to WebP
- **Custom Protocol**: `media://` URL scheme for secure local file access
- **Toast**: Temporary notification (success/error/info)
- **PII Sanitization**: Remove usernames/emails/IPs from errors

## Development Commands

```bash
# Start development server
npm run dev

# Lint code
npm run lint

# Run unit tests
npm test

# Run tests once
npm run test:run

# Run accessibility tests
npm run test:a11y

# Build for production
npm run build
```

## Anti-Patterns (DON'T DO THIS)

❌ Mutate Zustand state directly (`state.tokens.push(...)`)
❌ Send state from World View → Architect (one-way only)
❌ Use `file://` URLs in renderer (use `media://` protocol)
❌ Store sensitive data in error reports (always sanitize)
❌ Skip PII sanitization for user-facing errors
❌ Block main process with sync file operations (use async)
❌ Create overlapping error boundaries
❌ Use `any` without explicit TODO/justification
❌ Add inline styles (use Tailwind only)
❌ Use emoji or inline SVG for UI icons (use Remix Icon components)

## Best Practices (DO THIS)

✅ Use Zustand actions for all state updates
✅ Keep World View as read-only consumer
✅ Convert `file://` → `media://` for renderer security
✅ Sanitize all errors before showing to user
✅ Use async/await for all file I/O
✅ Keep IPC handlers lightweight
✅ Batch state updates when possible
✅ Provide clear, actionable toast messages
✅ Add JSDoc for exported functions
✅ Use explicit return types for exported functions
✅ Use Remix Icon components (`@remixicon/react`) for all UI icons

## Common Tasks

### Add New State Property

```typescript
// 1. Update GameState interface (src/store/gameStore.ts)
export interface GameState {
  myNewProp: string;
  setMyNewProp: (value: string) => void;
}

// 2. Add initial value and action
export const useGameStore = create<GameState>((set) => ({
  myNewProp: 'default',
  setMyNewProp: (value) => set({ myNewProp: value }),
}));

// 3. Use in components
const myNewProp = useGameStore((state) => state.myNewProp);
```

### Add New IPC Channel

```typescript
// 1. Define in preload.ts
contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (...args) => ipcRenderer.invoke(...args),
});

// 2. Handle in main.ts
ipcMain.handle('MY_CHANNEL', async (_event, arg) => {
  return result;
});

// 3. Call from renderer
const result = await window.ipcRenderer.invoke('MY_CHANNEL', data);
```

### Add Toast Notification

```typescript
const { showToast } = useGameStore();

showToast('Failed to upload map', 'error'); // Red
showToast('Campaign saved successfully', 'success'); // Green
showToast('World View opened', 'info'); // Blue
```

## Testing

### Before Every Commit

- [ ] No TypeScript errors (`npm run lint`)
- [ ] App launches (`npm run dev`)
- [ ] Main Window renders
- [ ] World Window opens and syncs
- [ ] Save/load works
- [ ] No console errors

### For UI Changes

- [ ] Test in both Main and World windows
- [ ] Responsive design (resize window)
- [ ] Hover states work
- [ ] Keyboard shortcuts work

### For State Changes

- [ ] State syncs to World Window
- [ ] Save/load preserves new fields
- [ ] No performance degradation

## Git Workflow

### Commit Messages (Conventional Commits)

```
type(scope): brief description

feat(canvas): add fog of war layer
fix(sync): prevent IPC spam during token drag
refactor(grid): extract grid logic to utils
docs(architecture): add IPC flow diagram
```

**Types**: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`

## Key Files Reference

- **State Management**: `src/store/gameStore.ts`
- **Main Canvas**: `src/components/Canvas/CanvasManager.tsx`
- **Grid Logic**: `src/utils/grid.ts`
- **Error Handling**: `src/utils/errorSanitizer.ts`, `src/components/PrivacyErrorBoundary.tsx`
- **Asset Processing**: `src/utils/AssetProcessor.ts`
- **IPC Bridge**: `electron/preload.ts`, `electron/main.ts`
- **Sync Manager**: `src/components/SyncManager.tsx`

## Additional Documentation

- **Architecture Details**: See `ARCHITECTURE.md`
- **Full Conventions**: See `CONVENTIONS.md`
- **Project Context**: See `CONTEXT.md`
- **Decisions Log**: See `DECISIONS.md`

## Notes for AI Assistants

- This is a privacy-focused, local-first application
- All file I/O happens through Electron IPC (main process)
- State flows one direction: Architect → World (never reverse)
- Grid snapping is smart: even tokens → intersections, odd → centers
- Always use immutable state updates with Zustand
- Error boundaries prevent one bad token from crashing the canvas
- Theme system is WCAG AA compliant (accessibility matters)
