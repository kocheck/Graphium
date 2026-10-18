# UI performance baseline (plan 005, before any optimisation)

Grounded at: 5d44b4d. Dumps: `docs/planning/perf/*-before.json`.
Dev-server numbers come from React in development mode under StrictMode: counts are commits with
`phase !== 'mount'`; durations are not comparable to production. The stress fixture is 200 tokens
and no map — lighter than the 500-token scenario in `docs/architecture/PERFORMANCE_OPTIMIZATIONS.md`.

## Render counts (dev server, `?stress=1`)

| Scenario        | Dump                          | Counts (from perf-counts)                                                                                                                                                                                                                                                    |
| --------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tool switch     | `tool-switch-before.json`     | {"ThemeManager":2,"SyncManager":2,"PauseManager":2,"Toast":2,"ConfirmDialog":2,"DungeonGeneratorDialog":2,"AboutModal":2,"UpdateManager":2,"SessionConsoleEscapeStop":2,"AutoSaveManager":2,"CanvasManager":4,"Toolbar":2,"CommandPalette":3}                                |
| token selection | `token-selection-before.json` | {"CanvasManager":8,"ThemeManager":3,"SyncManager":3,"PauseManager":3,"Toast":3,"ConfirmDialog":3,"DungeonGeneratorDialog":3,"AboutModal":3,"UpdateManager":3,"SessionConsoleEscapeStop":3,"AutoSaveManager":3,"Toolbar":3,"CommandPalette":4,"TokenInspector":3}             |
| token move      | `token-move-before.json`      | {"CanvasManager":3,"ThemeManager":1,"SyncManager":1,"PauseManager":1,"Toast":1,"ConfirmDialog":1,"DungeonGeneratorDialog":1,"AboutModal":1,"UpdateManager":1,"SessionConsoleEscapeStop":1,"AutoSaveManager":1,"Toolbar":1,"CommandPalette":1,"TokenInspector":2,"Sidebar":2} |

## Frame rate (dev server, rAF count, 3 s each): idle 60 fps, dragging 60 fps (`fps-before.json`)

## Modal open, warm (dev server): About 27.600000001490116 ms, Dungeon Generator 17.699999999254942 ms (`modal-open-before.json`)

## Initial load (built app via `preview:web`, median of 5): home 39.19999999925494 ms, editor 984.1999999992549 ms (`load-before.json`)

## Bundle (`npm run build:web`): main 1177378 (`dist-web/assets/index-DDU94B_k.js`), total JS+CSS 1424122; `agentation` in production chunks: 1
