# Graphium AI Context

> [!NOTE]
> This document is designed to help AI agents understand the architecture, patterns, and conventions of the Graphium codebase.

## Project Overview

**Graphium** is a tabletop roleplaying game (TTRPG) virtual tabletop (VTT) application built with **Electron**, **React**, **TypeScript**, and **Konva**.

### Core Architecture: Dual-Window Model

Graphium uses a unique "Dual-Window" architecture to mimic a physical game table:

1.  **Architect View (Main Window):** The Dungeon Master's control interface. Contains all UI, tools, file operations, and sensitive data.
2.  **World View (Secondary Window):** The Player's view. A "dumb" projection that renders the map and tokens but has no UI or logic.

**Key File:** `src/components/SyncManager.tsx` handles the state synchronization between these windows using Electron IPC (and BroadcastChannel for web dev).

### State Management

- **Zustand (`src/store/gameStore.ts`)**: The single source of truth.
- **Sync Pattern**:
  - `SyncManager` watches the store for changes.
  - `syncUtils.ts` detects changes (deltas) between frame X and X+1.
  - IPC sends _actions_ (e.g., `TOKEN_UPDATE`) to the other window.
  - The other window applies the action to its own local Zustand store.

## Key Technologies

- **Electron**: Main process handling (`electron/main.ts`), IPC.
- **React**: UI rendering.
- **Konva (react-konva)**: High-performance 2D canvas rendering for maps and tokens.
- **Tailwind CSS**: Styling (v4).
- **Radix UI**: Accessible UI primitives (dialogs, popovers).
- **Vite**: Build tool.

## Directory Structure

- `src/components/Canvas`: All map/token rendering logic (**Complex**).
- `src/components/SyncManager.tsx`: The nervous system of the app.
- `src/components/Sidebar.tsx`: The main DM interface for assets.
- `src/store`: State definitions.
- `src/utils`: Helper logic (math, file processing, sync diffing).

## Coding Conventions

- **Strict Null Checks**: Always handle `undefined`/`null` in `syncUtils` (see: "The Great Sync Fix of 2025").
- **Asset Processing**: We manipulate `File` objects directly in the browser/renderer when possible.
- **Components**: Functional components with hooks.
- **Performance**: Use `React.memo` for canvas layers (`FogOfWarLayer.tsx`).

## Common Pitfalls

1.  **Sync Loops**: Avoid naive 2-way sync. We use a "Producer (DM) -> Consumer (Player)" model mostly, with limited upstream sync (Player Token Drag).
2.  **Konva + Tests**: `jsdom` requires `canvas` package to mock Konva.
3.  **Electron vs Web**: Code often runs in both. Check `window.ipcRenderer` availability before using Node APIs.
