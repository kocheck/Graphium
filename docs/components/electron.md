# Electron Main Process

The Electron main process handles the Node.js side of the application including window management, file I/O, and IPC routing.

## Purpose

The main process is responsible for:

- Creating and managing application windows (Architect View and World View)
- Handling file system operations (save/load campaigns, asset storage)
- Routing IPC messages between renderer processes
- Implementing custom protocol handlers (media:// for local file access)
- Managing application lifecycle

## Key Files

### main.ts

**Location**: `/electron/main.ts`

Main application entry point with:

- Window creation and management (`createMainWindow()`, `createWorldWindow()`)
- IPC channel handlers (SAVE_CAMPAIGN, LOAD_CAMPAIGN, SAVE_ASSET_TEMP, SYNC_WORLD_STATE)
- File I/O for campaign save/load
- Custom media:// protocol registration

### preload.ts

**Location**: `/electron/preload.ts`

IPC bridge between main and renderer processes. Safely exposes IPC methods to renderer via `contextBridge`.

### themeManager.ts

**Location**: `/electron/themeManager.ts`

Handles system theme detection and synchronization. See [Theme System](../features/theming.md) for details.

## Architecture

### Dual-Window Pattern

```
Main Process
├─ Main Window (Architect View)
│  └─ URL: index.html (no query params)
└─ World Window (Player View)
   └─ URL: index.html?type=world
```

### IPC Communication

All communication between renderer and main process uses IPC channels. See [IPC API Reference](../architecture/IPC_API.md) for complete channel documentation.

## Related Documentation

- [IPC API Reference](../architecture/IPC_API.md)
- [Architecture Overview](../architecture/ARCHITECTURE.md#electron-layer)
- [Troubleshooting](../guides/TROUBLESHOOTING.md)
