# Components

React components for Graphium's renderer. This is an orientation map, not an inventory:
it names areas and responsibilities and carries no line counts (they rot). The component
you are about to change is the source of truth; read it.

## Areas

| Area                      | What lives there                                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/App.tsx`             | Picks Architect vs World View (`?type=world`), HOME vs EDITOR, renders the desktop toolbar and the global overlays.                                                                                                                                     |
| `Canvas/`                 | The Konva stage: `CanvasManager.tsx`, `GridOverlay.tsx`, `TokenLayer.tsx`, `DrawingLayer.tsx`, `DoorLayer.tsx`, `StairsLayer.tsx`, `FogOfWarLayer.tsx`, `MeasurementOverlay.tsx`, `Minimap.tsx`, `hooks/`. See `Canvas/README.md`.                      |
| `AssetLibrary/`           | Token library: `LibraryManager.tsx`, `AddToLibraryDialog.tsx`, `TokenMetadataEditor.tsx`, `CommandPalette.tsx`.                                                                                                                                         |
| `SessionConsole/`         | Audio/ambience panel and the player-facing stage: `SessionConsolePanel.tsx`, the editor and settings sheets, `WorldStage.tsx`, `WorldAudioEngine.tsx`, hotkeys.                                                                                         |
| `DesignSystemPlayground/` | The `/design-system` route (`playground-registry.tsx` lists every example).                                                                                                                                                                             |
| Sidebar and navigation    | `Sidebar.tsx`, `MapNavigator.tsx`, `CollapsibleSection.tsx`, `MobileSidebarDrawer.tsx`, `MobileToolbar.tsx`, `MobileBottomSheet.tsx`.                                                                                                                   |
| Overlays                  | `ConfirmDialog.tsx`, `DungeonGeneratorDialog.tsx`, `AboutModal.tsx`, `UpdateManager.tsx`, `MapSettingsSheet.tsx`, `ImageCropper.tsx`, `Toast.tsx`, `LoadingOverlay.tsx`. — `DungeonGeneratorDialogGate` mounts the generator only while open (plan 005) |
| Inspectors and panels     | `TokenInspector.tsx`, `QuickTokenSidebar.tsx`, `DoorControls.tsx`, `ResourceMonitor.tsx`.                                                                                                                                                               |
| System (no UI)            | `SyncManager.tsx` (Architect ↔ World state over IPC in Electron, `BroadcastChannel` on the web), `ThemeManager.tsx`, `AutoSaveManager.tsx`, `PauseManager.tsx`.                                                                                         |
| Error handling            | `GlobalErrorBoundary.tsx`, `PrivacyErrorBoundary.tsx`, `ErrorFallbackUI.tsx`, `UpdateErrorFallbackUI.tsx`, `PendingErrorsIndicator.tsx`, and a `*ErrorBoundary.tsx` next to each feature it wraps.                                                      |
| Adapters                  | `Tooltip.tsx`, `ToggleSwitch.tsx`, `CollapsibleSection.tsx` — thin components whose props stay stable while their internals change.                                                                                                                     |
| Brand                     | `LogoIcon.tsx`, `LogoLockup.tsx`.                                                                                                                                                                                                                       |

**Layout components**

- `Toolbar.tsx` — desktop Architect View tool strip (extracted from `App.tsx` in plan 004).

## Conventions that matter here

- Colours come from `--app-*` variables in `src/styles/theme.css`; never raw palette values
  in new code. Non-colour tokens (`--app-radius-*`, `--app-elevation-*`, `--app-duration-*`,
  `--app-ease-*`, `--app-space-unit`, `--app-font-size-*`, `--app-font-weight-*`) are
  aliased into Tailwind in `src/index.css`.
- `data-testid` values are kebab-case `<surface>-<element>` and are never renamed.
- Every overlay root carries `data-testid="dialog-<x>-root"` or `sheet-<x>-root`.
  `tests/functional/overlays.spec.ts` records each overlay's `role`, `aria-modal`,
  `data-esc-owns`, Escape and focus behaviour.
- `data-esc-owns="true"` on an open overlay stops the global Escape from killing Session
  Console audio.
- Unit tests are co-located `*.test.tsx` (Vitest); browser specs live in `tests/`.

## Related documentation

- [Canvas System](../../docs/components/canvas.md)
- [Architecture Overview](../../docs/architecture/ARCHITECTURE.md)
- [Code Conventions](../../docs/guides/CONVENTIONS.md)
- [Error Boundaries](../../docs/features/error-boundaries.md)
- [Tests](../../tests/README.md)
