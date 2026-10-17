# Graphium Core Porting Spec (Data + Pure Logic)

Status: reference spec for the native Swift/macOS port. It covers every type that is persisted in a
campaign, the current `.graphium` file format (for a one-time legacy importer), all pure-logic
modules, and every store action. It does not cover UI.

All `path:line` references point at the TypeScript sources on branch `claude/swift-macos`.
The Swift implementation must reproduce the behaviour described here exactly. Test names are listed
so the Swift test suite can mirror them one to one.

---

## 0. Cross-cutting porting rules (read first)

| #   | Rule                                                                                                                                                                                                                                                                                                                                                          | Why                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **`Math.round` is NOT Swift `.rounded()`.** JS `Math.round(x)` = `floor(x + 0.5)` (ties go toward +infinity: `Math.round(-2.5) == -2`, `Math.round(2.5) == 3`). Swift `.rounded()` uses `.toNearestOrAwayFromZero` (`-2.5 -> -3`). Implement `func jsRound(_ x: Double) -> Double { (x + 0.5).rounded(.down) }` and use it everywhere this spec says `round`. | Grid snapping, D&D distance, dungeon generator, image resize, fade steps all depend on it, and negative coordinates are common. |
| R2  | All coordinates/sizes are `Double` (JS `number`). No integers in the data model except where noted (`version: 1`). `dateAdded` and `timestamp` are milliseconds since the Unix epoch (`Date.now()`), stored as JSON numbers.                                                                                                                                  | JSON round-trip.                                                                                                                |
| R3  | **Optional vs absent.** TS optional fields (`?`) are omitted from JSON when `undefined`. Encode Swift `nil` optionals by omitting the key (default `Codable` behaviour with `encodeIfPresent`). Never write `null` for `?` fields. Fields typed `T \| null` (e.g. `MapData.map`, runtime fields) DO serialize `null`.                                         | Legacy files and pack JSON rely on absence.                                                                                     |
| R4  | IDs are `crypto.randomUUID()` strings (lowercase v4 with dashes). Keep them as `String`, not `UUID`, because seeded IDs like `"chime"`, pack slugs (`"opening-theme"`) and `"active"` (measurement) are not UUIDs.                                                                                                                                            | Session console + measurements.                                                                                                 |
| R5  | "No-op returns the previous reference" (reducers, token index patches). In Swift (value types) return an explicit `changed: Bool` or compare with `==`; callers skip the state write when nothing changed.                                                                                                                                                    | Sync diffing depends on "unchanged" detection.                                                                                  |
| R6  | String comparisons/sorting in JS use UTF-16 code units (`Array.prototype.sort()` default, `===`, `indexOf`, `toLowerCase()`). For `getCategories` sort and fuzzy matching, compare by `Array(s.utf16)` / ordinal, not `localizedCompare`. Default JS sort puts uppercase before lowercase.                                                                    | `fuzzySearch`, `getCategories`.                                                                                                 |
| R7  | JS `Array.prototype.sort` is stable (ES2019+). Use a stable sort in Swift (sort on `(score, originalIndex)`).                                                                                                                                                                                                                                                 | Fuzzy search ties keep input order.                                                                                             |
| R8  | Randomness: every random choice uses `Math.random()` (unseeded). Swift: inject a `RandomNumberGenerator` so tests can be seeded; behaviour with system RNG must match distribution semantics described below.                                                                                                                                                 | Dungeon generator, `rollForMessage`, snap SFX noise.                                                                            |

---

## 1. Data model

### 1.1 Where state lives

| Scope                       | Holder                                                                                                                                                                                                                        | Persisted in `.graphium`?                               | Notes                                                                                                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-campaign                | `Campaign` (`src/store/gameStore.ts:162`)                                                                                                                                                                                     | yes (`manifest.json`)                                   | maps, activeMapId, tokenLibrary, sessionConsole catalog                                                                                                                                                              |
| Per-map                     | `MapData` (`src/store/gameStore.ts:119`)                                                                                                                                                                                      | yes (inside `Campaign.maps`)                            | tokens, drawings, doors, stairs, background, grid, explored fog, daylight                                                                                                                                            |
| Active-map mirror           | top-level `GameState` fields `tokens…isDaylightMode` (`src/store/gameStore.ts:321-332`)                                                                                                                                       | only after `syncActiveMapToCampaign()` copies them back | The store is a "hybrid": edits go to the top-level copy; the campaign map is stale until sync (called before save/autosave/addMap/switchMap). Swift may instead edit the map in place; behaviour must be equivalent. |
| Session-only runtime        | `GameState.sessionConsoleRuntime` (`src/types/sessionConsole.ts:85`)                                                                                                                                                          | no                                                      | rebuilt from catalog on load/reset                                                                                                                                                                                   |
| Transient UI (gameStore)    | `isCalibrating, toast, confirmDialog, showResourceMonitor, dungeonDialog, isGamePaused, isMobileSidebarOpen, isCommandPaletteOpen, activeMeasurement, broadcastMeasurement, dmMeasurement` (`src/store/gameStore.ts:335-351`) | no                                                      |                                                                                                                                                                                                                      |
| Transient UI (other stores) | `uiStore`, `pointerOverlayStore`, `visionStore`                                                                                                                                                                               | no                                                      | see §4.2                                                                                                                                                                                                             |
| Per-user preferences        | `preferencesStore` (localStorage `graphium-preferences`), `touchSettingsStore` (localStorage `graphium-touch-settings`, version 1), recent campaigns (localStorage `graphium-recent-campaigns`)                               | no (app prefs)                                          | Map to `UserDefaults`.                                                                                                                                                                                               |
| Global token library        | `userData/library/index.json` + `userData/library/assets/{id}.webp`, `thumb-{id}.webp` (`electron/main.ts:905-1026`)                                                                                                          | no (separate from campaign)                             | Merged into `campaign.tokenLibrary` at Architect startup by id (`src/App.tsx:178-214`).                                                                                                                              |

### 1.2 `Campaign` — `src/store/gameStore.ts:162`

| Field            | TS type                   | Opt                                  | Default (`createDefaultCampaign`, `gameStore.ts:283`)                                                                                        |
| ---------------- | ------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | `string`                  | no                                   | `crypto.randomUUID()`                                                                                                                        |
| `name`           | `string`                  | no                                   | `'New Campaign'`                                                                                                                             |
| `maps`           | `Record<string, MapData>` | no                                   | `{ [map.id]: map }` with one map named `'Default Map'` (or the passed `firstMap`; the store always passes `'Map 1'`, `gameStore.ts:451,522`) |
| `activeMapId`    | `string`                  | no                                   | id of that map                                                                                                                               |
| `tokenLibrary`   | `TokenLibraryItem[]`      | no                                   | `[]`                                                                                                                                         |
| `sessionConsole` | `SessionConsoleCatalog`   | no (but may be missing in old files) | `emptySessionConsoleCatalog(name)`                                                                                                           |

`maps` is a JSON object; key order = insertion order (JS). `deleteMap` picks the "next" map by
`Object.keys` order (§4.1), so Swift must keep an **ordered** map list (e.g. `[MapData]` + index, or
an ordered dictionary), and encode `maps` as an object preserving insertion order.

### 1.3 `MapData` — `src/store/gameStore.ts:119`

| Field             | TS type                | Opt | Default (`createDefaultMap`, `gameStore.ts:265`)      | Load fallback (`loadCampaign`, `gameStore.ts:507-516`) |
| ----------------- | ---------------------- | --- | ----------------------------------------------------- | ------------------------------------------------------ |
| `id`              | `string`               | no  | UUID                                                  | —                                                      |
| `name`            | `string`               | no  | `'New Map'` (param)                                   | —                                                      |
| `tokens`          | `Token[]`              | no  | `[]`                                                  | `\|\| []`                                              |
| `drawings`        | `Drawing[]`            | no  | `[]`                                                  | `\|\| []`                                              |
| `doors`           | `Door[]`               | no  | `[]`                                                  | `?? []`                                                |
| `stairs`          | `Stairs[]`             | no  | `[]`                                                  | `?? []`                                                |
| `map`             | `MapConfig \| null`    | no  | `null`                                                | `?? null`                                              |
| `gridSize`        | `number` (px per cell) | no  | `50`                                                  | `\|\| 50` (0 also becomes 50)                          |
| `gridType`        | `GridType`             | no  | `'LINES'`                                             | `?? 'LINES'`                                           |
| `gridColor`       | `string` hex           | no  | `DEFAULT_GRID_COLOR = '#222222'` (`gameStore.ts:260`) | `?? '#222222'`                                         |
| `exploredRegions` | `ExploredRegion[]`     | no  | `[]`                                                  | `?? []`                                                |
| `isDaylightMode`  | `boolean`              | no  | `false`                                               | `\|\| false`                                           |

Legacy/older files may lack `doors`, `stairs`, `gridColor`. `switchMap`/`deleteMap` only default
`tokens/drawings/doors/stairs/exploredRegions/gridColor` (`gameStore.ts:664-673,717-726`) — `gridType`,
`gridSize`, `map`, `isDaylightMode` are taken raw. **Swift: apply the full `loadCampaign` fallback set
on decode for every map** (strictly more robust, no visible difference for valid files).

`GridType` (`gameStore.ts:113`): `'LINES' | 'DOTS' | 'HIDDEN' | 'HEXAGONAL' | 'ISOMETRIC'`.
LINES/DOTS/HIDDEN are all square geometry (visual style only). HEXAGONAL = flat-top hex. ISOMETRIC = diamond.

### 1.4 `Token` — `src/store/gameStore.ts:58`

| Field           | TS type         | Opt | Meaning / default when absent                                                                   |
| --------------- | --------------- | --- | ----------------------------------------------------------------------------------------------- |
| `id`            | `string`        | no  | UUID                                                                                            |
| `x`, `y`        | `number`        | no  | **top-left** corner, world px                                                                   |
| `src`           | `string`        | no  | image URL (`file://…` on desktop; `assets/…` inside ZIP)                                        |
| `libraryItemId` | `string`        | yes | prototype reference into `campaign.tokenLibrary`                                                |
| `scale`         | `number`        | yes | override; resolves `token.scale ?? lib.defaultScale ?? 1`                                       |
| `type`          | `'PC' \| 'NPC'` | yes | override; resolves `token.type ?? lib.defaultType ?? (lib.category == 'PC' ? 'PC' : undefined)` |
| `visionRadius`  | `number` (feet) | yes | override; resolves `token.visionRadius ?? lib.defaultVisionRadius` (may stay undefined)         |
| `name`          | `string`        | yes | override; resolves `token.name ?? lib.name ?? 'Token'`                                          |
| `movementSpeed` | `number` (feet) | yes | resolves `token.movementSpeed ?? lib.defaultMovementSpeed ?? 30`                                |

Token footprint: `size = gridSize * resolvedScale` (square). Token centre: `(x + size/2, y + size/2)`.
`TokenMetadata` (`gameStore.ts:32`) is just the shared optional subset `{name,type,visionRadius,scale,movementSpeed}`.

### 1.5 `Drawing` — `src/store/gameStore.ts:80`

| Field       | TS type                          | Opt | Notes                                                                                                            |
| ----------- | -------------------------------- | --- | ---------------------------------------------------------------------------------------------------------------- |
| `id`        | `string`                         | no  | UUID                                                                                                             |
| `tool`      | `'marker' \| 'eraser' \| 'wall'` | no  | eraser strokes are stored as drawings too (black, composited as erase)                                           |
| `points`    | `number[]`                       | no  | flat `[x1,y1,x2,y2,…]`, raw (untransformed)                                                                      |
| `color`     | `string`                         | no  | marker = current UI colour; eraser `'#000000'`; wall `'#ff0000'` (`useCanvasInteraction.ts:311-321`)             |
| `size`      | `number`                         | no  | marker 5, eraser 20, wall 8; dungeon walls `wallSize` (8)                                                        |
| `pressures` | `number[]`                       | yes | one per point (len = points.length/2), 0..1; 0.5 for mouse; only when `touchSettings.pressureSensitivityEnabled` |
| `scale`     | `number`                         | yes | transform; absent = 1                                                                                            |
| `x`, `y`    | `number`                         | yes | transform offset; absent = 0                                                                                     |

World-space point = `(px * scale + x, py * scale + y)` (`FogOfWarLayer.tsx:263-285`).

### 1.6 `MapConfig` (background image) — `src/store/gameStore.ts:96`

| Field             | Type     | Notes                                                       |
| ----------------- | -------- | ----------------------------------------------------------- |
| `src`             | `string` | image URL                                                   |
| `x`, `y`          | `number` | top-left world position                                     |
| `width`, `height` | `number` | natural pixel size of the (resized ≤4096) image             |
| `scale`           | `number` | uniform scale; rendered size = `width*scale × height*scale` |

### 1.7 `Door` — `src/store/gameStore.ts:215`

| Field            | Type                                  | Opt | Default                                   |
| ---------------- | ------------------------------------- | --- | ----------------------------------------- |
| `id`             | `string`                              | no  | UUID                                      |
| `x`, `y`         | `number`                              | no  | **centre** of the door                    |
| `orientation`    | `'horizontal' \| 'vertical'`          | no  | horizontal = lies along an east-west wall |
| `isOpen`         | `boolean`                             | no  | `false` on creation                       |
| `isLocked`       | `boolean`                             | no  | `false`                                   |
| `size`           | `number`                              | no  | `gridSize` at creation                    |
| `thickness`      | `number`                              | yes | render only; dungeon generator sets 12    |
| `swingDirection` | `'left' \| 'right' \| 'up' \| 'down'` | yes | render only                               |

Manual door placement (`useCanvasInteraction.ts:248-267`): `snapToGrid(pointer.x, pointer.y, gridSize, gridType)` in **legacy mode** (no width/height) → square grid rounds to the nearest intersection; hex/iso snap to a cell centre.

### 1.8 `Stairs` — `src/store/gameStore.ts:241`

`{ id: string; x: number; y: number /* centre */; direction: 'north'|'south'|'east'|'west'; type: 'up'|'down'; width: number; height: number }` — all required.
Note: no UI creates stairs today; they are only added via sync (`SyncManager.tsx:244`). Keep the type + actions for file compatibility.

### 1.9 `ExploredRegion` — `src/store/gameStore.ts:193`

`{ points: Array<{x:number;y:number}>; timestamp: number }`. Each region is one full visibility polygon
(90/180/360 points, §3.3). Cap: `MAX_EXPLORED_REGIONS = 2000` (`gameStore.ts:254`), oldest dropped first.

### 1.10 `TokenLibraryItem` — `src/store/gameStore.ts:145`

| Field                  | Type            | Opt | Notes                                                                                                                 |
| ---------------------- | --------------- | --- | --------------------------------------------------------------------------------------------------------------------- |
| `id`                   | `string`        | no  | UUID (validated by `isValidUuid` in main, `electron/pathSecurity.ts:6,45`)                                            |
| `name`                 | `string`        | no  | trimmed                                                                                                               |
| `src`                  | `string`        | no  | full image (`library/assets/{id}.webp`)                                                                               |
| `thumbnailSrc`         | `string`        | no  | `library/assets/thumb-{id}.webp`, 128×128 forced (aspect NOT preserved, `AddToLibraryDialog.tsx:75-106`), WebP q=0.85 |
| `category`             | `string`        | no  | free text; UI default `'Monsters'`; `'PC'` has semantic meaning (implies type PC)                                     |
| `tags`                 | `string[]`      | no  | parsed from input split on `/[,\s]+/`, empty dropped                                                                  |
| `dateAdded`            | `number`        | no  | ms epoch                                                                                                              |
| `defaultScale`         | `number`        | yes |                                                                                                                       |
| `defaultVisionRadius`  | `number`        | yes | feet                                                                                                                  |
| `defaultType`          | `'PC' \| 'NPC'` | yes |                                                                                                                       |
| `defaultMovementSpeed` | `number`        | yes | feet                                                                                                                  |

Persistence quirk: `UPDATE_LIBRARY_METADATA` (`electron/main.ts:985-1025`) only persists `name`,
`category`, `tags` to `index.json`; `defaultType/defaultVisionRadius/defaultScale` edits survive only
inside the campaign's copy of `tokenLibrary`. Swift should persist all fields (intentional fix; flag in release notes).

### 1.11 Session Console catalog (persisted) — `src/types/sessionConsole.ts`

`SessionConsoleCatalog` (`sessionConsole.ts:63`):

| Field                  | Type              | Default (`emptySessionConsoleCatalog(campaignName)`, `:210`)                                                                                                     |
| ---------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`              | literal `1`       | `1`                                                                                                                                                              |
| `stage.title`          | `string`          | campaign name                                                                                                                                                    |
| `stage.subtitle`       | `string`          | `''`                                                                                                                                                             |
| `stage.showFrame`      | `boolean`         | `true`                                                                                                                                                           |
| `defaults.volume`      | `number` 0..100   | `45` (`DEFAULT_VOLUME`, `:113`)                                                                                                                                  |
| `defaults.duckPercent` | `number` 1..100   | `27` (`DEFAULT_DUCK_PERCENT`, `:114`)                                                                                                                            |
| `imageSets`            | `ImageSet[]`      | `[]`                                                                                                                                                             |
| `trackGroups`          | `TrackGroup[]`    | `[]`                                                                                                                                                             |
| `sfx`                  | `SfxDefinition[]` | five synth SFX, in order: `chime, drone, snap, ping, test-tone` (`:116-122`) with labels `Chime, Drone, Snap, Ping, Test Tone`, `kind:'synth'`, `synthType` = id |

`ImageSet` (`:17`): `{ id, title, note: string, images: StageImage[] }`.
`StageImage` (`:8`): `{ id, name, cue, src, thumbnailSrc, alt }` — all `string`, all required.
`TrackGroup` (`:45`): `{ id, title, note, accent: TrackAccent, tracks: Track[] }`.
`TrackAccent` (`:24`): `'bed' | 'road' | 'dread' | 'combat' | 'arrive'` (`TRACK_ACCENTS`, `:26`; `isTrackAccent`, `:28`).
`Track` (`:32`):

| Field                       | Type                   | Opt | Notes                                        |
| --------------------------- | ---------------------- | --- | -------------------------------------------- |
| `id`, `title`, `cue`, `tag` | `string`               | no  | `tag` is free text (board default `'bed'`)   |
| `source`                    | `'youtube' \| 'local'` | no  |                                              |
| `youtubeId`                 | `string`               | yes | 11 chars `[A-Za-z0-9_-]` when source youtube |
| `src`                       | `string`               | yes | file URL when source local                   |
| `volumeOffset`              | `number`               | no  | ±30 (`clampVolumeOffset`, `:132`)            |
| `loop`                      | `boolean`              | no  | default `true`                               |
| `recommendedImageId`        | `string`               | yes | id of a StageImage                           |

`SynthType` (`:53`): `'chime' | 'drone' | 'snap' | 'ping' | 'test-tone'`.
`SfxDefinition` (`:55`): `{ id, label, kind: 'synth' | 'local', synthType?: SynthType, src?: string }`.

### 1.12 Session Console runtime (transient) — `src/types/sessionConsole.ts:85`

| Field                          | Type                                 | `emptySessionConsoleRuntime()` (`:231`) |
| ------------------------------ | ------------------------------------ | --------------------------------------- |
| `stageVisible`                 | `boolean`                            | `false`                                 |
| `activeImage`                  | `{id,src,alt,name} \| null`          | `null`                                  |
| `stage`                        | `{title,subtitle,showFrame}`         | `{'', '', true}`                        |
| `audio.trackId`                | `string \| null`                     | `null`                                  |
| `audio.title`                  | `string`                             | `''`                                    |
| `audio.source`                 | `'youtube' \| 'local' \| null`       | `null`                                  |
| `audio.youtubeId`, `audio.src` | `string \| null`                     | `null`                                  |
| `audio.status`                 | `'stopped' \| 'playing' \| 'paused'` | `'stopped'`                             |
| `audio.loop`                   | `boolean`                            | `true`                                  |
| `audio.restartSeq`             | `number`                             | `0`                                     |
| `audio.volumeOffset`           | `number`                             | `0`                                     |
| `volume`                       | `number`                             | `45`                                    |
| `ducked`                       | `boolean`                            | `false`                                 |
| `duckPercent`                  | `number`                             | `27`                                    |
| `sfxSeq`                       | `number`                             | `0`                                     |
| `sfxId`                        | `string \| null`                     | `null`                                  |
| `sfxKind`                      | `'synth' \| 'local' \| null`         | `null`                                  |
| `sfxSynthType`                 | `SynthType \| null`                  | `null`                                  |
| `sfxSrc`                       | `string \| null`                     | `null`                                  |
| `worldArmed`                   | `boolean`                            | `false`                                 |

`sessionConsoleRuntimeFromCatalog(catalog, {worldArmed})` (`:280`) = empty runtime + `worldArmed ?? false`,
`volume = catalog.defaults.volume`, `duckPercent = catalog.defaults.duckPercent`, `stage = copy of catalog.stage`.
`copySessionConsoleChrome(runtime, catalog)` (`:266`) = runtime with `stage` and `duckPercent` replaced from the catalog.

Helpers (`sessionConsole.ts`):

| Function                                                 | Line | Behaviour                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clampVolume(v)`                                         | 127  | `min(100, max(0, v))`                                                                                                                                                                                                                                                               |
| `clampVolumeOffset(v)`                                   | 132  | `min(30, max(-30, v))`                                                                                                                                                                                                                                                              |
| `effectiveVolume(volume, ducked, offset?, duckPercent?)` | 139  | `c = clampVolume(volume + (offset ?? 0))`; if not ducked → `c`; else `round(c * (duckPercent ?? 27) / 100)` (R1)                                                                                                                                                                    |
| `isYouTubeHostname(host)`                                | 152  | strip leading `www.`; true for `youtu.be, youtube.com, m.youtube.com, music.youtube.com, youtube-nocookie.com`                                                                                                                                                                      |
| `parseYouTubeVideoId(input)`                             | 167  | trim; empty → null; matches `^[A-Za-z0-9_-]{11}$` → itself; else parse as URL (failure → null); host not YouTube → null; `youtu.be` → first path segment if valid; else `?v=` if valid; else path `^/(shorts\|embed\|v)/([A-Za-z0-9_-]{11})`; else null (playlist-only URLs → null) |

Tests `src/types/sessionConsole.test.ts`: `parseYouTubeVideoId` › accepts a raw 11-char id; parses watch, youtu.be, shorts, and embed URLs; returns null for garbage. `clampVolumeOffset` › clamps to ±30. `isTrackAccent` › accepts known accents. `effectiveVolume` › applies offset then duck percent and clamps. `emptySessionConsoleCatalog` › seeds four synth SFX and campaign title (asserts five ids despite the name). `emptySessionConsoleRuntime` › seeds player-safe chrome, duckPercent, and audio.volumeOffset (runtime must not contain catalog-only keys like `cue`, `thumbnailSrc`, `imageSets`).

### 1.13 Measurement (transient, synced) — `src/types/measurement.ts`

`MeasurementMode` (`:10`): `'ruler' | 'blast' | 'cone'`. `Measurement` (`:81`) = union, discriminated by `type`:

| Variant            | Line | Fields                                                                                                        |
| ------------------ | ---- | ------------------------------------------------------------------------------------------------------------- |
| `RulerMeasurement` | 32   | `id, type:'ruler', origin: Point, end: Point, distanceFeet: number`                                           |
| `BlastMeasurement` | 47   | `id, type:'blast', origin, radius: number (px), radiusFeet: number`                                           |
| `ConeMeasurement`  | 62   | `id, type:'cone', origin, target: Point, lengthFeet, angleDegrees (always 53), vertices: [Point,Point,Point]` |

Live measurement id is always `'active'` (`useCanvasInteraction.ts:~415-450`). All feet values use
`pixelsToFeet(euclideanDistance(origin, pointer), gridSize, EUCLIDEAN)` — the D&D 5e mode is never used by the app.

### 1.14 Geometry primitives

`Point {x,y}` (`src/types/geometry.ts:7`, duplicated `src/types/grid.ts:11`), `WallSegment {start,end}` (`geometry.ts:12`),
`Bounds {x,y,width,height}` (`grid.ts:19`), `GridCell {q,r}` (`grid.ts:30`; square: q=col r=row; hex: axial; iso: diamond col/row),
`GridGeometry` protocol (`grid.ts:47`): `pixelToGrid, gridToPixel, getSnapPoint, getCellVertices, getVisibleCells`.

---

## 2. `.graphium` file format (legacy importer)

### 2.1 Container

A standard ZIP (JSZip, DEFLATE or STORE — read both):

```
manifest.json          // UTF-8 JSON: the Campaign object (Electron: compact; Web: pretty, 2-space)
assets/<basename>      // every referenced local asset, flat (no subfolders)
```

Writer: `writeCampaignZip` (`electron/main.ts:700-718`); atomic for autosave (`<path>.tmp` then rename),
non-atomic for "Save As" (`SAVE_CAMPAIGN`, `main.ts:817-832`). Autosave (`AUTO_SAVE`, `main.ts:834-851`)
writes only if a path is known (last save/load); renderer calls it every 60 s (`AutoSaveManager.tsx:51-53`)
after `syncActiveMapToCampaign()`, failures are silent.

### 2.2 `manifest.json` shape

Exactly the `Campaign` JSON of §1.2–1.11 with asset `src` strings rewritten to `assets/<basename>`.
Electron's own serializable mirror is in `electron/main.ts:503-553` (all fields optional + index signature;
i.e. unknown keys must be preserved/ignored, not rejected). Example (trimmed):

```json
{
  "id": "9b0c…", "name": "Ashen Crown", "activeMapId": "m1",
  "maps": { "m1": {
    "id": "m1", "name": "Map 1", "gridSize": 50, "gridType": "LINES", "gridColor": "#222222",
    "isDaylightMode": false,
    "map": { "src": "assets/1712345678901-cave.webp", "x": 0, "y": 0, "width": 4096, "height": 2304, "scale": 0.5 },
    "tokens": [ { "id": "t1", "x": 125, "y": 75, "src": "assets/9f…-uuid.webp", "libraryItemId": "9f…" } ],
    "drawings": [ { "id": "d1", "tool": "wall", "points": [0,0,100,0], "color": "#ff0000", "size": 8 } ],
    "doors": [ { "id": "dr1", "x": 50, "y": 0, "orientation": "horizontal", "isOpen": false, "isLocked": false, "size": 50 } ],
    "stairs": [], "exploredRegions": [ { "points": [ {"x":1,"y":2} ], "timestamp": 1712345678901 } ]
  } },
  "tokenLibrary": [ { "id": "9f…", "name": "Goblin", "src": "assets/9f….webp", "thumbnailSrc": "assets/thumb-9f….webp",
                      "category": "Monsters", "tags": ["goblin"], "dateAdded": 1712345678901 } ],
  "sessionConsole": { "version": 1, "stage": {…}, "defaults": {…}, "imageSets": […], "trackGroups": […], "sfx": […] }
}
```

### 2.3 Which `src` fields are assets — `src/utils/campaignAssets.ts`

`rewriteCampaignAssetSrcs(campaign, rewrite, {includeThumbnails = true})` (`campaignAssets.ts:155`) visits, in order:

1. every map: `map.map.src` (if map and src non-empty) and every `token.src` (`:3-26`);
2. every `tokenLibrary[i].src` and, if `includeThumbnails`, non-empty `thumbnailSrc` (`:28-46`);
3. `sessionConsole.imageSets[].images[]`: non-empty `src`, and non-empty `thumbnailSrc` if includeThumbnails (`:61-80`);
4. `sessionConsole.trackGroups[].tracks[]` where `source === 'local'` and `src` non-empty (`:82-94`);
5. `sessionConsole.sfx[]` where `kind === 'local'` and `src` non-empty (`:95-101`).

Drawings, doors, stairs, explored regions and YouTube tracks carry no assets. Identical src strings are rewritten
once (in-flight promise cache, `:162-172`); jobs run with concurrency 8 (`runWithConcurrency`, `:104,126-149`).

Tests `src/utils/campaignAssets.test.ts`: rewrites map, token, and thumbnail srcs in parallel; rewrites session console images, local tracks, and local sfx, but not youtube tracks; dedupes identical srcs so rewrite runs once. Also `src/store/sessionConsoleCampaignWorkflow.test.ts`: show plate, play YouTube, return to map keeps audio, and rewrite still walks session console srcs.

### 2.4 Electron save rewrite — `processAssetForZip` (`electron/main.ts:638-681`)

For each src: if it does not start with `file://` → unchanged (http, blob, already-relative `assets/…`, YouTube are kept).
Else: `fileURLToPath` → `realpath` (ENOENT → error "Campaign asset file not found: <basename>", save fails) →
must be inside an allowed root (`temp_assets`, `sessions`, `library` under userData; symlinks resolved,
`isRealPathInsideAllowedRoots`, `pathSecurity.ts:74-99`) else error → per-realpath cache →
`allocateUniqueZipBasename` (`pathSecurity.ts:51-68`: keep basename if unused else `stem-2.ext`, `stem-3.ext`, …) →
store bytes at `assets/<name>`, return `"assets/<name>"`. Deep-clones the campaign first (`JSON.parse(JSON.stringify)`), so `undefined` keys vanish.

Web save (`WebStorageService.ts:550-590`): rewrites srcs starting with `blob:`, `http:`, `https:`, `file:` by fetching bytes and
naming `asset-<Date.now()>-<counter>-<random36><ext>` where ext = URL extension or content-type extension (`assetContentType.ts:77`) or `.webp`. Fetch failure keeps original src.

### 2.5 Load — `LOAD_CAMPAIGN` (`electron/main.ts:853-902`)

1. Read ZIP; `manifest.json` missing → throw "Invalid Graphium file".
2. Session dir: `userData/sessions/<Date.now()>/`.
3. `JSON.parse`. If the object has a truthy `maps` key → modern campaign; else legacy → `migrateLegacyCampaign`.
4. If ZIP has an `assets/` folder → `restoreCampaignAssets` (`main.ts:753-776`): for each src starting with `assets/`,
   take `path.basename(src)`, read `assets/<basename>` from the ZIP; if present write to `<sessionDir>/assets/<basename>`
   and return `file://<absolute path>` (note: plain string concat, no percent-encoding); missing entry → src unchanged.
5. Renderer `loadCampaign` (`gameStore.ts:490-518`): rejects (console error, no state change) when `maps` missing,
   `activeMapId` missing, or `maps[activeMapId]` missing; fills a missing `sessionConsole` with
   `emptySessionConsoleCatalog(campaign.name)` (`ensureSessionConsole`, `:299-307`); rebuilds runtime from catalog.

Renderer then converts `file:` → `media:` for display only (`toMediaProtocol`, `src/utils/mediaProtocol.ts:2`). Native app: ignore `media:`.

### 2.6 Legacy (pre-campaign) manifest — `migrateLegacyCampaign` (`electron/main.ts:720-750`)

Legacy manifest = a single-map game state: `{ tokens?, drawings?, map?, gridSize?, gridType?, exploredRegions?, isDaylightMode?, … }`, no `maps`.

| Output field                      | Value                                                                   |
| --------------------------------- | ----------------------------------------------------------------------- |
| map `id`                          | new UUID                                                                |
| map `name`                        | `'Imported Map'`                                                        |
| `tokens/drawings/exploredRegions` | legacy value `?? []`                                                    |
| `map`                             | legacy `?? null`                                                        |
| `gridSize`                        | `?? 50`                                                                 |
| `gridType`                        | `?? 'LINES'`                                                            |
| `isDaylightMode`                  | `?? false`                                                              |
| (doors, stairs, gridColor)        | **not set** → filled by `loadCampaign` defaults (`[]`, `[]`, `#222222`) |
| campaign `id`                     | new UUID                                                                |
| campaign `name`                   | `'Imported Campaign'`                                                   |
| `tokenLibrary`                    | `[]` (legacy library is dropped)                                        |
| `sessionConsole`                  | `emptySessionConsoleCatalog('Imported Campaign')`                       |

Web load (`WebStorageService.ts:196-226`) does **not** migrate legacy files and restores with `src.replace('assets/','')` (first occurrence) into blob URLs.

### 2.7 Importer checklist for Swift

- Accept modern + legacy manifests; accept missing `sessionConsole`, `doors`, `stairs`, `gridColor`, `exploredRegions`.
- Resolve any `assets/<x>` src by basename lookup inside the ZIP; leave `http(s):`, `blob:`, absolute `file://` (dangling), and unknown strings as-is (or mark missing).
- Prefer importing assets into the new package's own asset store and rewriting srcs to package-relative references.
- Keep unknown JSON keys if round-tripping matters (TS index signatures tolerate them).
- `SAVE_ASSET_TEMP` naming for new assets (`main.ts:805-815`): `temp_assets/<Date.now()>-<rewriteSafeAssetFileName(name)>`.

### 2.8 Filename helpers

| Function                         | Ref                                   | Behaviour                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rewriteSafeAssetFileName(name)` | `src/utils/safeAssetFileName.ts:5-23` | basename after `\`→`/`; ext = from last dot, lowercased, strip non `[a-z0-9.]`; stem: runs of non `[A-Za-z0-9._-]` → `-`, trim leading/trailing `-`; result `(stem \|\| 'asset') + ext`; `.`/`..` → `asset` |
| `sanitizeAssetFileName(name)`    | `electron/pathSecurity.ts:36`         | basename must match `^[a-zA-Z0-9._-]+$` else throw                                                                                                                                                          |
| `allocateUniqueZipBasename`      | `electron/pathSecurity.ts:51`         | see §2.4                                                                                                                                                                                                    |
| `isValidUuid`                    | `electron/pathSecurity.ts:45`         | `/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`                                                                                                                              |
| `fileExtension(path)`            | `src/utils/assetContentType.ts:15`    | lowercased ext incl. dot from basename, `''` if none                                                                                                                                                        |
| `contentTypeForAssetFileName`    | `assetContentType.ts:33`              | audio map (`.mp3 audio/mpeg, .ogg audio/ogg, .wav audio/wav, .m4a audio/mp4`) then image map (`.webp, .png, .jpg/.jpeg → image/jpeg`) else `image/webp`                                                     |
| `extensionForContentType`        | `assetContentType.ts:50`              | reverse map + aliases `image/jpeg→.jpg`, `audio/x-m4a→.m4a`, `audio/x-wav→.wav`; strips `;params`                                                                                                           |

Tests: `safeAssetFileName.test.ts` › keeps already-safe names; rewrites spaces, parentheses, and path segments. `assetContentType.test.ts` › contentTypeForMediaPath maps audio extensions and leaves images undefined; contentTypeForAssetFileName maps local audio extensions to playable MIME types / keeps image types as webp/png/jpeg; extensionForContentType maps standard and browser audio MIME aliases. `tests/unit/pathSecurity.spec.ts` › isPathInside (true for nested child paths; false for traversal paths; false for equal paths), isPathInsideOrEqual (true for equal; true for nested; false for traversal), mediaUrlToFilePath (converts media:// URLs; accepts file:// URLs; rejects non-file/media schemes), sanitizeAssetFileName (keeps a safe basename; strips path segments; rejects unsafe characters), isValidUuid (accepts/rejects), allocateUniqueZipBasename (keeps the first basename and suffixes collisions), isRealPathInsideAllowedRoots (accepts files under an allowed root; rejects symlink escape outside allowed roots).

### 2.9 Global library index (`userData/library/index.json`)

`{ "items": LibraryItem[] }` pretty-printed (2 spaces) (`main.ts:905-1026`). Invalid structure → reset to `{items:[]}`.
Save: writes `{id}.webp` + `thumb-{id}.webp`, appends `{...metadata, src:file://…, thumbnailSrc:file://…, dateAdded:Date.now()}`.
Delete: unlink both files (errors logged), filter index. Update: merges only `name/category/tags`; unknown id → error.

---

## 3. Pure logic modules

### 3.1 Grid geometry — `src/utils/gridGeometry.ts`, `src/utils/grid.ts`

Constants: `SQRT3 = √3`, `SQRT3_2 = √3/2`, `SQRT3_3 = √3/3` (`gridGeometry.ts:23-25`), `HEX_BOUNDS_SAFETY_FACTOR = 1.2` (`:32`).
`createGridGeometry(type)` (`:404`): LINES/DOTS/HIDDEN → Square, HEXAGONAL → Hex, ISOMETRIC → Iso, else throw.
`snapToGrid(x, y, gridSize, gridType = 'LINES', width?, height?)` (`grid.ts:86`) = `createGridGeometry(gridType).getSnapPoint(...)`.
Snap inputs/outputs are **top-left** positions for tokens; "legacy mode" (width or height undefined) is used for doors.

**Square** (`gridGeometry.ts:45-125`)

| Method                | Formula                                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pixelToGrid`         | `q = floor(x/g)`, `r = floor(y/g)`                                                                                                                                                       |
| `gridToPixel`         | centre `((q+0.5)g, (r+0.5)g)`                                                                                                                                                            |
| `getSnapPoint` legacy | `(round(x/g)*g, round(y/g)*g)` (R1)                                                                                                                                                      |
| `getSnapPoint` sized  | per axis: `center = pos + size/2`; `n = round(size/g)`; odd n → `snapCenter = (floor(center/g)+0.5)g`; even n (incl. 0) → `snapCenter = round(center/g)*g`; return `snapCenter - size/2` |
| `getCellVertices`     | TL, TR, BR, BL of `[qg, rg, g, g]`                                                                                                                                                       |
| `getVisibleCells`     | `q ∈ [floor(x/g), ceil((x+w)/g)]`, `r ∈ [floor(y/g), ceil((y+h)/g)]` inclusive, q outer loop                                                                                             |

**Hexagonal, flat-top, axial; `g` = circumradius** (`:142-284`)

| Method                | Formula                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---- | --- | ---- | --- | ---- | ------------------------------------------------------------------------------------------------- |
| `pixelToGrid`         | `qf = (2/3·x)/g`, `rf = (-1/3·x + √3/3·y)/g` → `hexRound`                                                                              |
| `hexRound`            | `s=-q-r`; `rq,rr,rs = round(q),round(r),round(s)`; diffs `                                                                             | rq-q | ,   | rr-r | ,   | rs-s | `; if `dq>dr && dq>ds`→`rq=-rr-rs`; else if `dr>ds`→`rr=-rq-rs`; return `(rq, rr)`(R1 for`round`) |
| `gridToPixel`         | `x = g·1.5·q`, `y = g·(√3/2·q + √3·r)` (cell centre)                                                                                   |
| `getSnapPoint` legacy | centre of `pixelToGrid(x,y)` (returned as-is, not offset)                                                                              |
| `getSnapPoint` sized  | centre of hex containing `(x+w/2, y+h/2)`, minus `(w/2, h/2)`                                                                          |
| `getCellVertices`     | 6 points `centre + g·(cos θ, sin θ)`, θ = 0°,60°,…,300° (first vertex is due east; clockwise on a y-down screen)                       |
| `getVisibleCells`     | pixelToGrid of the 4 viewport corners → min/max q,r, pad by 2; for each (q outer, r inner) keep if centre ± `1.2g` overlaps the bounds |

**Isometric diamond** (`:308-396`), diamond = `2g` wide, `g` tall

| Method            | Formula                                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `pixelToGrid`     | `col = (x/g + 2y/g)/2`, `row = (2y/g − x/g)/2`, `q=floor(col)`, `r=floor(row)`                                                                 |
| `gridToPixel`     | `x = (q−r)g`, `y = (q+r)g/2`                                                                                                                   |
| `getSnapPoint`    | same pattern as hex (legacy → centre; sized → centre − half size)                                                                              |
| `getCellVertices` | top `(cx, cy−g/2)`, right `(cx+g, cy)`, bottom `(cx, cy+g/2)`, left `(cx−g, cy)`                                                               |
| `getVisibleCells` | corners → `minQ=min(TL.q,BL.q)−2`, `maxQ=max(TR.q,BR.q)+2`, `minR=min(TL.r,TR.r)−2`, `maxR=max(BL.r,BR.r)+2`; full rectangle, no per-cell test |

Known quirk (preserve unless deliberately fixed): iso `pixelToGrid` uses `floor`, so the "cell" of a point is the
diamond whose **top vertex** is `gridToPixel(q,r)`; snapping therefore lands on that diamond's top vertex rather
than the visual centre for points in the upper half. Round-trip `pixelToGrid(gridToPixel(c)) == c` holds and is tested.
**Native:** deliberately fixed. Swift `IsoGrid.pixelToGrid` uses `round` (`jsRound`) on `col` and `row`, so a point
resolves to the diamond whose drawn centre is nearest and snapping lands on the visual centre. The round trip still
holds. Saved TS iso positions load unchanged but can sit half a cell off the native snap grid until next moved.

Token display (TS `TokenNode.tsx:149-150`): on ISOMETRIC grids the token is drawn at `y − size/2` (it stands on its
diamond); the name label stays at `y + size + 8`. Swift: `GameMap.tokenDisplayYOffset(size:)` /
`tokenDisplayBounds`, used for drawing, hit-testing and marquee; `tokenBounds` stays the stored footprint.

Tests `src/utils/grid.test.ts` (`snapToGrid`): legacy behavior (no dimensions provided) › should snap to top-left corner when dimensions are undefined; should snap to nearest grid intersection; should handle negative coordinates; should handle zero dimensions (zero-sized tokens). dimension-aware snapping › odd cell count tokens (snap to cell center) › should snap 1x1 / 3x3 / 5x5 token (odd) to cell center; even cell count tokens › should snap 2x2 / 4x4 token (even) to grid intersection; non-square tokens › should handle different width and height (odd x even) / (even x odd); edge cases › should handle tokens already perfectly aligned (odd) / (even); should handle very small tokens (less than grid size); should handle negative coordinates with dimensions; grid size variations › should work with different grid sizes; should work with very small grid sizes; grid type parameter › should default to LINES (square grid) when gridType not provided; should work with explicit DOTS grid type (same as square); should work with HIDDEN grid type (same as square).

Tests `src/utils/gridGeometry.test.ts`: SquareGridGeometry › pixelToGrid (converts pixel coordinates to grid cell coordinates; handles negative coordinates; handles different grid sizes), gridToPixel (converts grid cell to pixel coordinates (center); handles negative cell coordinates), getSnapPoint (snaps odd-sized tokens to cell center; snaps even-sized tokens to intersection; snaps 3x3 tokens to cell center; handles legacy mode without dimensions; handles negative coordinates), getCellVertices (returns 4 vertices for square cell; handles different cell positions), getVisibleCells (returns cells within viewport bounds; handles offset viewport). HexagonalGridGeometry › pixelToGrid and gridToPixel roundtrip (converts pixel to hex and back accurately; handles multiple hex positions), getSnapPoint (snaps tokens to nearest hex center; handles legacy mode; snaps large tokens correctly), getCellVertices (returns 6 vertices for hexagon; vertices are evenly spaced at 60 degrees), getVisibleCells (returns hexes within viewport bounds; includes padding to catch boundary hexes; covers the entire viewport including top-right and bottom-left corners). IsometricGridGeometry › roundtrip (converts pixel to iso and back accurately; handles arbitrary pixel positions), getSnapPoint (snaps tokens to nearest diamond center; handles legacy mode; snaps large tokens correctly), getCellVertices (returns 4 vertices for diamond; vertices form diamond shape), getVisibleCells (returns diamonds within viewport bounds; handles rotated viewport correctly). createGridGeometry factory › creates Square for LINES / DOTS / HIDDEN; Hexagonal for HEXAGONAL; Isometric for ISOMETRIC. Performance tests › Square/Hexagonal/Isometric getVisibleCells is efficient (for large viewport).

Token drag snapping (`src/components/Canvas/hooks/useTokenDrag.ts:240-390`): token size = `gridSize * resolvedScale` for both axes;
on drop the primary token is snapped with its size, then for multi-select the same `(snapped − dragPos)` offset is applied to every other selected token, and each is snapped **again** with its own size (fallback `gridSize`).

### 3.2 Measurement — `src/utils/measurement.ts`

| Function                                            | Line | Behaviour                                                                                   |
| --------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------ | --- | -------------------------------------------------------------------------------------------------------------------------- |
| `DistanceMode`                                      | 15   | `EUCLIDEAN = 'euclidean'`, `DND_5E = 'dnd5e'`                                               |
| `euclideanDistance(p1,p2)`                          | 30   | `sqrt(dx²+dy²)`                                                                             |
| `dnd5eDistance(p1,p2,g)`                            | 51   | `cx = round(                                                                                | dx            | /g)`, `cy = round(                                                                                                       | dy  | /g)`; `diag = min`, `straight = max − diag`; `cells = floor(diag/2)\*3 + diag%2 + straight` (5-10-5 rule, result in cells) |
| `pixelsToFeet(px, g, mode = EUCLIDEAN, p1?, p2?)`   | 84   | DND_5E with both points → `dnd5eDistance*5`; else `round(px/g*5)`                           |
| `calculateAngle(p1,p2)`                             | 109  | `atan2(dy, dx)` radians (y-down: "up" = −π/2)                                               |
| `calculateAngleDegrees`                             | 121  | degrees, negatives +360 → [0,360)                                                           |
| `calculateConeVertices(origin, target, angle = 53)` | 139  | `L =                                                                                        | target−origin | `, `θ = atan2`, `h = angle/2 in rad`; returns `[origin, origin + L(cos(θ+h), sin(θ+h)), origin + L(cos(θ−h), sin(θ−h))]` |
| `formatDistance(feet, showCells = true)`            | 180  | `"{feet}ft ({n} cell[s])"`, `n = round(feet/5)`, singular iff n == 1; else `"{feet}ft"`     |
| `formatRadius(feet, showCells = true)`              | 198  | `"{feet}ft radius ({n} cell[s])"` (singular iff n == 1) / `"{feet}ft radius"`               |
| `formatCone(feet, angle = 53, showCells = true)`    | 217  | `"{feet}ft {angle}° cone ({n} cell[s])"` (singular iff n == 1) / `"{feet}ft {angle}° cone"` |

Number formatting: JS `${n}` — integers print without `.0`; Swift must format `30.0` as `"30"` (use a JS-number formatter).

Tests `src/utils/measurement.test.ts`: euclideanDistance › should calculate distance between two points; should handle horizontal distance; vertical distance; negative coordinates; should return 0 for identical points; should handle decimal coordinates. dnd5eDistance › straight horizontal movement; straight vertical movement; single diagonal (costs 1 square); two diagonals (costs 3 squares: 5ft + 10ft); three diagonals (costs 4 squares: 5ft + 10ft + 5ft); four diagonals (costs 6 squares); mixed diagonal and straight movement; negative coordinates; movement in all four quadrants. pixelsToFeet › EUCLIDEAN mode (one grid cell to 5 feet; multiple cells to feet; should round fractional cells; zero distance), DND_5E mode (should use dnd5eDistance when points are provided; straight movement; should fall back to EUCLIDEAN if points not provided). calculateAngle › right (0), upward (−π/2), downward (π/2), left (π), 45-degree. calculateAngleDegrees › 0-360 range; upward (270); downward (90); left (180); 45-degree. calculateConeVertices › should return tuple of exactly 3 points; should include origin as first vertex; horizontal cone; vertical cone; diagonal cone; should respect custom cone angle; should use default 53-degree cone angle. formatting functions › formatDistance / formatRadius / formatCone (cell count by default; zero; large; singular cell; without cells when showCells=false; formatCone also: default 53-degree angle, custom angles).

Map calibration (`useCanvasInteraction.ts:576-603`): only if drag rect `w>5 && h>5` and a map exists:
`s = gridSize / ((w+h)/2)`; `newScale = map.scale*s`; `rel = (rect.x−map.x, rect.y−map.y)*s`; `proj = map + rel`;
`target = round(proj/g)*g` per axis; `updateMapTransform(newScale, map.x + (target.x − proj.x), map.y + (target.y − proj.y))`.
Test: `useCanvasInteraction.test.ts` › finalizes calibration on pointer up (updates map transform); grows calibration rect on move; updates active measurement while dragging ruler / blast / cone; updates selection rect while marquee dragging; keeps and unions selection on shift-marquee pointer up; updates hovered cell for square grids.

### 3.3 Fog of War / visibility

Sources: `src/components/Canvas/FogOfWarLayer.tsx` (algorithm lives in the component), `src/utils/fogVisibility.ts`, `src/types/geometry.ts`, `src/store/visionStore.ts`.

Fog is rendered **only in World View and only when `!isDaylightMode`** (`CanvasManager.tsx:1292`).

**Inputs:** tokens (with live drag positions overlaid: `applyLiveTokenPositions`, `fogVisibility.ts:27`), token library, wall drawings, doors, gridSize, viewport width, map.

**Algorithm**

1. _Viewers_ (`FogOfWarLayer.tsx:201-240`): tokens whose resolved type (`peekTokenType`) is `'PC'` and resolved `visionRadius > 0` (undefined → 0 → excluded). Record `x, y, scale = peekTokenScale, visionRadius`.
2. _Walls_ (`:253-325`): for every drawing with `tool == 'wall'`, consecutive point pairs → segments, transformed `p*scale + offset` (§1.5). Plus every door with `!isOpen`: half = `size/2`; horizontal → `(x−half, y)–(x+half, y)`; vertical → `(x, y−half)–(x, y+half)`. Open doors add nothing; lock state is irrelevant. Marker/eraser strokes never block.
3. _Per viewer polygon_ (`:340-382`): centre `c = (x + g·scale/2, y + g·scale/2)`; radius px `R = visionRadius/5 · g`;
   zoom = `clamp(1200 / viewportWidth, 0.1, 5)` (1 if width ≤ 0) (`sizeFallbackZoom`, `:82`);
   rays = `90` if `R·zoom < 200`, `180` if `< 600`, else `360` (`rayCountForVision`, `:37`);
   `calculateVisibilityPolygon` (`:559`): for `i in 0..<rays`, `θ = i·2π/rays`, endpoint `= castRay`.
   `castRay` (`:588`): ray `c → c + R(cosθ, sinθ)`; closest intersection over all walls by `hypot`, strict `<` (first found wins ties), default = ray end.
   `lineSegmentIntersection` (`:637`): `den = (x1−x2)(y3−y4) − (y1−y2)(x3−x4)`; `|den| < 1e-10` → none; `t = ((x1−x3)(y3−y4) − (y1−y3)(x3−x4))/den`; `u = −((x1−x2)(y1−y3) − (y1−y2)(x1−x3))/den`; hit iff `0≤t≤1 && 0≤u≤1`, point `= p1 + t(p2−p1)`.
   Cache: polygon recomputed when walls/gridSize change or the token key `"x:y:visionRadius:scale"` changes; removed viewers are evicted.
4. _Hidden NPCs_ (`computeHiddenNpcIds`, `fogVisibility.ts:40`): for tokens whose resolved type is exactly `'NPC'` (untyped tokens are never hidden), `size = g·scale`; hidden iff `!isRectInAnyPolygon(x, y, size, size, polygons)`. Published with polygons to `visionStore.setVision` (World View hides those token visuals).
5. _Explored regions_ (`:397-427`): when the viewer set/polygons change and ≥1000 ms since the last stamp (`EXPLORE_UPDATE_INTERVAL`), append one `ExploredRegion {points: polygon, timestamp: now}` per viewer with a non-empty polygon (store caps at 2000).
6. _Fog bounds_ (`getFogBounds`, `fogVisibility.ts:10`): map present → `(map.x, map.y, map.width·scale, map.height·scale)`; else constant `(-500, -500, 3500, 3500)` (`NO_MAP_FOG_BOUNDS`, `:8`).
7. _Compositing_ (render, for parity): fill bounds `rgba(0,0,0,0.94)`; erase (destination-out) an offscreen mask where each explored polygon was filled `rgba(0,0,0,0.8)` (cumulative, overlaps compound); erase each current polygon with a radial gradient from `c`, radius `R`, alpha 1 at stops 0 and 0.6, alpha 0 at 1.

`isPointInPolygon` (`geometry.ts:28`): `<3` vertices → false; even-odd ray cast: toggle when `(yi > py) != (yj > py) && px < (xj−xi)(py−yi)/(yj−yi) + xi`.
`isPointInAnyPolygon` (`:66`). `isRectInAnyPolygon(x,y,w,h,polys)` (`:83`): centre first, then the 4 corners.

Observed data-flow caveat: explored regions are appended only in the World View process; World→Architect sync carries only token x/y (§3.12), so the Architect's (saved) `exploredRegions` never receives them and Architect `EXPLORED_UPDATE`/`FULL_SYNC` overwrite World's. No UI calls `clearExploredRegions`. Decide deliberately in Swift (recommended: compute exploration in the shared model so it persists).

Tests: `src/utils/fogVisibility.test.ts` › uses map bounds when a map is present; returns a stable world AABB when no map is uploaded; hides NPCs that sit outside every vision polygon; overlays live drag positions without mutating the original tokens; hides NPCs from live positions, not stale store coordinates. `src/types/geometry.test.ts` › isPointInPolygon (false for empty polygon; false for polygon with less than 3 points; true for point inside square; false outside square; true inside triangle; false outside triangle; should handle point on edge correctly), isPointInAnyPolygon (false for empty polygons array; true if point is in at least one polygon; false if in none), isRectInAnyPolygon (false for empty polygons array; true if rect center is inside polygon; true if any rect corner is inside polygon; false if rect is completely outside polygon; should handle token visibility scenario). `src/components/Canvas/DoorBlocking.test.ts` › Door to Wall Segment Conversion (closed horizontal door to wall segment; closed vertical door; should NOT convert open door; multiple closed doors correctly), Ray Intersection with Door Segments (detect ray intersection with horizontal door; with vertical door; should NOT detect intersection when ray misses door; should block vision through closed door), Door State Integration (should allow vision through open door; should block vision through closed locked door).

### 3.4 Movement range — `src/components/Canvas/MovementRangeOverlay.tsx:42-146`

Inputs: token top-left position (live drag position if dragging, `OverlayLayer.tsx:123-126`), `movementSpeed` (resolved, default 30), gridSize, gridType. Shown only in Architect, single selection, while `M` is held.

- `HIDDEN` → no cells.
- `maxCells = ceil(speed / 5)`; start = `pixelToGrid(token.x, token.y)` (top-left, not centre).
  **Native:** square grids keep the top-left; hex and iso seed from the token centre
  (`pixelToGrid(x + size/2, y + size/2)`), the cell the token is snapped onto, because the top-left lies in a
  neighbouring cell there (TS iso starts half a cell above the token). See `movementRangeOrigin`.
- BFS (FIFO) with visited set keyed `"q,r"`: pop; skip if visited or `distance > maxCells`; mark & emit; push all neighbours not yet visited with `distance+1`. Output order = BFS discovery order.
- Neighbours: square & iso: `(±1,0),(0,±1)` in order `+q, −q, +r, −r`; hex: `(+1,0),(−1,0),(0,+1),(0,−1),(+1,−1),(−1,+1)`.
- All steps cost 1 (no 5-10-5 diagonal rule, no walls/doors).
  Tests `MovementRangeOverlay.test.tsx`: rendering (Group for valid grid types; null for HIDDEN; custom colors), movement calculation (reachable cells based on movement speed; zero movement speed without crashing; large movement speed without crashing), grid type support (LINES, DOTS, HEXAGONAL, ISOMETRIC), edge cases (negative token position; very small grid size; very large grid size; recalculate when token position / movement speed / grid type changes), neighbor calculations (4 neighbors for LINES; 4 for DOTS; 6 for hexagonal; 4 for isometric), BFS visited set (should not render duplicate cells), performance (large movement range efficiently; memoization).
  Reachable count reference: square/iso with r = maxCells → `2r²+2r+1`; hex → `3r²+3r+1`.

### 3.5 Wall path optimisation — `src/utils/pathOptimization.ts`

| Function                                    | Line | Behaviour                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------- |
| `simplifyPath(points, ε)`                   | 21   | flat array; `length ≤ 4` → returned unchanged; else Ramer–Douglas–Peucker (`rdpRecursive`, `:50`): find max perpendicular distance among interior points (first strictly greater wins); if `> ε` split at that index, recurse both halves, join dropping the duplicate split point; else keep `[first, last]` |
| `perpendicularDistance`                     | 87   | degenerate line (start == end) → point distance; else `                                                                                                                                                                                                                                                       | dy·px − dx·py + ex·sy − ey·sx | / sqrt(dx²+dy²)` |
| `pointToSegmentDistanceWithPoint`           | 120  | clamp projection `t ∈ [0,1]`; zero-length → start                                                                                                                                                                                                                                                             |
| `findClosestPointOnPath`                    | 162  | `< 4` values → nil; min over segments (strict `<`)                                                                                                                                                                                                                                                            |
| `snapPointToPaths(point, paths, threshold)` | 207  | 1) vertex snap: closest vertex of any path with `dist < threshold` (strict, earliest wins ties) → `{vertex, snapped: true, pathIndex}`; 2) else segment snap: closest point on any path with `dist < threshold` → snapped; 3) else `{point, false, -1}`                                                       |

App usage on wall stroke end (`useCanvasInteraction.ts:620-645`) with prefs (`preferencesStore.ts:37-43`: `enableSmoothing=true, smoothingEpsilon=3.0, enableSnapping=true, snapThreshold=10, minPoints=2`): smooth, keep the smoothed version only if `result.length ≥ minPoints*2`; then if other walls exist and ≥2 points, snap only the **first and last** point against existing wall `points` (raw, untransformed) (`applyWallSnapping`, `:81-101`).

Tests `pathOptimization.test.ts`: simplifyPath › edge cases (empty array for empty input; single point unchanged; two points unchanged), straight line simplification (collinear points to endpoints only; collinear diagonal points), path smoothing with epsilon (keep points that deviate beyond epsilon; remove points within epsilon tolerance; more aggressive with higher epsilon), realistic wall paths (reduce jittery hand-drawn wall; preserve important corners in L-shaped wall), minimum points requirement (paths at minimum length (4 values = 2 points)). snapPointToPaths › empty or invalid input (original point when no paths exist; when paths are too short), snapping within threshold (horizontal; vertical; diagonal line), no snapping beyond threshold, multiple paths (closest path when multiple; absolute closest point across all paths), endpoint and segment snapping (line endpoints; middle of segment; closest segment in multi-segment path), realistic wall snapping scenarios (connect new wall to existing wall endpoint; not snap when walls are far apart), configurable threshold (respect different threshold values).

### 3.6 Viewport culling — `src/utils/viewportCulling.ts`

`isTokenInViewport(x, y, size, bounds, padding)` (`:20`): `x+size ≥ bx−p && y+size ≥ by−p && x ≤ bx+bw+p && y ≤ by+bh+p`. App padding = `gridSize*2` (`TokenNode.tsx:151`).
`shouldRenderTokenVisuals(hiddenByFog, isDragging, inViewport)` (`:9`): hidden → false; else `isDragging || inViewport`.
Tests `viewportCulling.test.ts`: isTokenInViewport › keeps tokens that intersect the padded viewport; culls tokens fully outside the padded viewport. shouldRenderTokenVisuals › hides fog-hidden tokens even while dragging; keeps visuals for in-view or actively dragged tokens; skips expensive visuals when off-screen and idle.

### 3.7 Token helpers / resolution

| Function                                            | Ref                            | Behaviour                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------------------------- |
| `resolveTokenData(token, library)`                  | `src/hooks/useTokenData.ts:79` | rules of §1.4 plus `_isInherited.{scale,type,visionRadius,name,movementSpeed}` = instance undefined AND library value defined (category-inferred PC does NOT count as inherited type)                                                                                                                          |
| constants                                           | `useTokenData.ts:65-68`        | `DEFAULT_SCALE = 1`, `DEFAULT_NAME = 'Token'`, `DEFAULT_MOVEMENT_SPEED = 30`                                                                                                                                                                                                                                   |
| `indexTokenLibrary`                                 | `:129`                         | id → item map (last duplicate wins)                                                                                                                                                                                                                                                                            |
| `peekTokenType / peekTokenScale / peekVisionRadius` | `:137,154,162`                 | same precedence as resolve, without allocation                                                                                                                                                                                                                                                                 |
| `getResolvedPcTokens`                               | `:174`                         | resolved tokens whose type is PC                                                                                                                                                                                                                                                                               |
| `addLibraryTokenToMap(item, addToken, map)`         | `src/utils/tokenHelpers.ts:21` | new token `{id: UUID, x, y, src: item.src, libraryItemId: item.id}` (no overrides) where `(x,y) = map ? (map.x + map.width·map.scale/2, map.y + map.height·map.scale/2) : (500,500)`; this is the map centre used as the token **top-left**; calls `addToken`, returns token                                   |
| `getRecentTokens(tokens, library, limit=3)`         | `src/utils/tokenUtils.ts:40`   | iterate tokens from the end; first time each `src` is seen, push the library item with equal `src` (if any); stop at `limit` items                                                                                                                                                                             |
| `getPlayerTokens(library, limit=5)`                 | `tokenUtils.ts:73`             | `defaultType=='PC'                                                                                                                                                                                                                                                                                             |     | category=='PC'`, sort `dateAdded` desc, take limit |
| `deduplicatePlayerTokens(players, recent)`          | `tokenUtils.ts:88`             | drop players whose `src` is in recent                                                                                                                                                                                                                                                                          |
| token index                                         | `src/utils/tokenIndex.ts:3-69` | `buildTokenIndex`, `withTokenIndex` (tokens + byId + ids), `patchTokenInIndex(tokens, byId, id, changes)` → nil if id missing else merged token replaced in both; `patchTokenPositions(updates)` → nil if empty; 1 update → patchTokenInIndex; else patch only tokens whose x/y differ, nil if nothing changed |

Tests: `useTokenData.test.ts` › resolveTokenData: use instance values when all properties are set; fall back to library defaults when instance properties are undefined; fall back to system defaults when both are undefined; handle token without libraryItemId; handle non-existent libraryItemId gracefully; preserve id, x, y, src from instance; mixed inheritance; infer PC type from category if defaultType is missing; handle empty token library; handle explicit zero values correctly; tokens with only required properties. useTokenData hook › resolve token data using store. ResolvedTokenData interface › all required properties. Edge cases › null/undefined token library gracefully; very large scale; very small scale; very large vision radius; special characters in name; empty string name; multiple library items with correct ID selection. library peek helpers › reads type, scale, and vision without a full resolve; prefers instance overrides.
`tokenHelpers.test.ts` (addLibraryTokenToMap) › create a token instance with libraryItemId reference; place token at center of map when map exists; account for map scale when calculating center; place token at (500, 500) when no map loaded; generate unique IDs for each token; call addToken with the created token; handle map at origin (0, 0); handle map with negative position; copy the library item src to the token; return the created token for caller use.
`tokenUtils.test.ts` › getRecentTokens (empty array for no tokens; recent unique tokens in reverse order; respects the limit; ignores tokens not in library); getPlayerTokens (defaultType PC OR category PC; category PC even if defaultType is undefined; sorts by dateAdded (most recent first); respects the limit parameter; empty array when no PC tokens exist; handles empty library; uses default limit of 5); deduplicatePlayerTokens (removes player tokens that appear in recent tokens; removes multiple; returns all when none are in recent; empty player tokens array; empty recent tokens array; matches tokens by src property; empty array when all player tokens are in recent).
`tokenIndex.test.ts` › builds an id map; pairs tokens with an index; patches one token without rewriting other object identities; returns null when the id is missing; patches multiple positions without rewriting untouched tokens; returns null for an empty position batch.

### 3.8 Dungeon generator — `src/utils/DungeonGenerator.ts`

**Options** (`:151`, defaults `:229-240`): `numRooms` (required), `minRoomSize = 3`, `maxRoomSize = 8` (cells), `gridSize = 50`, `canvasWidth = 1920`, `canvasHeight = 1080`, `wallColor = '#ff0000'`, `wallSize = 8`.
Dialog (`src/components/DungeonGeneratorDialog.tsx:35-80`): defaults `numRooms 5` (3–15), `minRoomSize 3` (2–6), `maxRoomSize 8` (4–12), `gridSize` = current map's, canvas = window inner size (fallback 1920×1080), wall colour/size fixed; "clear canvas" removes **all** drawings and doors first; then `addDrawing` each drawing, `addDoor` each door.
**Constants** (`:224-227`): `RETRIES_PER_ROOM = 10`, `RETRY_THRESHOLD_FRACTION = 0.5`, `ROOM_SPACING_CELLS = 1`, `MIN_WALL_SEGMENT_FRACTION = 0.25`. Corridor template (`:246-249`): length 4 cells, width 2 cells. Templates: only `rectangular` (min/max from options).
**Randomness:** `Math.random()` only (unseeded). Draw order per call matters if you want reproducible seeded tests: `createRoom` → template index (`floor(r·count)`, always 0 but consumes a draw), width `floor(r·(max−min+1))+min`, height same; growth loop → source room `floor(r·roomCount)`; direction shuffle via `sort(() => r − 0.5)` (biased comparator shuffle; Swift may use a Fisher–Yates with the injected RNG — exact order cannot be bit-matched anyway).

**`generate()`** (`:295-383`)

1. `start = (round(cw/2/g)·g, round(ch/2/g)·g)`; first room = `createRoom(start)` (top-left at start). `pieces=[room0]`, `usedDirections[room0] = {}`.
2. `maxRetries = numRooms·10`, `retries = 0`, `roomsAdded = 1`. While `roomsAdded < numRooms && retries < maxRetries`: `retries++`; `roomPieces` = pieces at index 0 or even indices (layout `[room, corridor, room, corridor, …]`); pick random source; candidate dirs = `[north,south,east,west]` minus used, shuffled; for each dir try `tryAddPieceInDirection(source, dir, pieces, exclude = source)`; on first success append `corridor, newRoom`, mark `dir` used on source, set `usedDirections[newRoom] = {opposite(dir)}`, `roomsAdded++`, `retries = 0`. If nothing was added and `retries ≥ maxRetries·0.5` → stop.
3. Output: for each piece, `pieceToDrawings` then, for each direction in order N,S,E,W with a stored doorway, `createDoorFromPosition`.

**`tryAddPieceInDirection`** (`:576-759`), `b` = source bounds:

1. Connection point: N `(round((b.x+b.w/2)/g)g, b.y)`; S `(same x, b.y+b.h)`; E `(b.x+b.w, round((b.y+b.h/2)/g)g)`; W `(b.x, same y)`.
2. Corridor (`createCorridorPiece`, `:447-557`), W = 2g, L = 4g: N: `x = round(cx/g)g − W/2, y = cy − L, w = W, h = L`, walls east+west only; S: `y = cy`; E: `x = cx, y = round(cy/g)g − W/2, w = L, h = W`, walls north+south only; W: `x = cx − L`. Wall point order: north `(x,y)→(x+w,y)`, east `(x+w,y)→(x+w,y+h)`, south `(x+w,y+h)→(x,y+h)`, west `(x,y+h)→(x,y)`.
3. New room = `createRoom(0,0)` (random size), positioned: N `y = corr.y − h, x = cx − w/2`; S `y = corr.y + corr.h, x = cx − w/2`; E `x = corr.x + corr.w, y = cy − h/2`; W `x = corr.x − w, y = cy − h/2`; then `x = round(x/g)g`, `y = round(y/g)g`; rebuild its walls (`updateWallSegments`, `:764`, regenerates only directions that currently exist).
4. Re-align corridor: N/S `corr.x += round(roomCentreX/g)g − cx`; E/W `corr.y += round(roomCentreY/g)g − cy`; rebuild corridor walls.
5. Collision: corridor or new room overlaps any existing piece except the source → fail (`null`). `boundsOverlap(a,b,pad = g)` (`:980`) = NOT(`a.x+a.w+pad < b.x || a.x > b.x+b.w+pad || a.y+a.h+pad < b.y || a.y > b.y+b.h+pad`) — touching/near counts as overlap.
6. Doorways from the adjusted corridor centre: N: source `(round(ccx/g)g, b.y)`, new `(same, new.y+new.h)`; S: source `(…, b.y+b.h)`, new `(…, new.y)`; E: source `(b.x+b.w, round(ccy/g)g)`, new `(new.x, same)`; W: source `(b.x, …)`, new `(new.x+new.w, …)`.
7. `removeConnectingWalls(source, dir, sourceDoor)`, `removeConnectingWalls(newRoom, opposite, newDoor)`.

**`removeConnectingWalls(piece, dir, pos)`** (`:807-959`): store `piece.doorways[dir] = pos`; doorway width `= g`, `minSeg = 0.25g`. For a horizontal wall (N/S): `L = min(x)`, `R = max(x)`; if `R−L ≤ g + minSeg` → remove wall; left part `[L, pos.x − g/2]` kept iff `pos.x − g/2 > L` and length `> minSeg`; right part `[pos.x + g/2, R]` likewise; wall becomes `[left…, right…]` (4 points), one of them (2 points), or removed. Vertical (E/W) analogous on y. Only `segment[0..1]` are read (each direction is split at most once per room).
**`pieceToDrawings`** (`:993`): for N,S,E,W: 2 points → one wall drawing `{id: UUID, tool:'wall', points:[x0,y0,x1,y1], color, size}`; 4 points → two drawings. No `pressures/scale/x/y`.
**`createDoorFromPosition(pos, dir)`** (`:1056`): `{id: UUID, x, y, orientation: N/S → 'horizontal', E/W → 'vertical', isOpen:false, isLocked:false, size: g, thickness: 12, swingDirection: {north:'left', south:'right', east:'down', west:'up'}[dir]}`. Each connection yields two doors (one on each room); corridors have no doorways.
`getRooms()` (`:1090`) returns room bounds in creation order.

Tests `tests/unit/dungeon-generator.test.ts` (DungeonGenerator - Door and Corridor Alignment): should generate a dungeon with doors; should create doors that align to grid; should verify door properties are valid.

### 3.9 Session Console reducers — `src/store/sessionConsoleReducers.ts`

`applyCatalogAction(catalog, action) -> catalog` (`:604`). Every "not found / invalid" case returns the input unchanged (R5). Added payloads are deep-copied.

| Action (`:20-44`)                                                                  | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADD_IMAGE_SET {set}`                                                              | append clone; no-op if a set with that id exists                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `UPDATE_IMAGE_SET {setId, patch}`                                                  | merge patch (title/note), `id` and `images` preserved                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `REMOVE_IMAGE_SET {setId}`                                                         | filter out                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `REORDER_IMAGE_SETS {orderedIds}`                                                  | `reorderByIds` (`:92`): if any id unknown → no-op; else listed ids in order (duplicates skipped), then all unlisted items in original order                                                                                                                                                                                                                                                                                                                                                               |
| `ADD_IMAGE {setId, image}`                                                         | append clone to set; no-op if set missing or image id exists in **any** set                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `UPDATE_IMAGE {imageId, patch}`                                                    | in the first set containing it; `id` preserved                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `REMOVE_IMAGE {imageId}`                                                           | from the first set containing it                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `REORDER_IMAGES {setId, orderedIds}`                                               | reorderByIds within set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `ADD_TRACK_GROUP / UPDATE_TRACK_GROUP / REMOVE_TRACK_GROUP / REORDER_TRACK_GROUPS` | as image sets (patch can't change `id`/`tracks`)                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `ADD_TRACK {groupId, track}` / `UPDATE_TRACK` / `REMOVE_TRACK` / `REORDER_TRACKS`  | as images (track id unique across all groups)                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `UPDATE_STAGE_CHROME {patch}`                                                      | shallow-merge into `stage`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `UPDATE_DEFAULTS {patch}`                                                          | `volume` → `clampVolume`, `duckPercent` → `clamp(1, 100)` (`clampDuckPercent`, `:249`); missing keys keep current                                                                                                                                                                                                                                                                                                                                                                                         |
| `REPLACE_CATALOG {catalog}`                                                        | deep clone of incoming                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `MERGE_CATALOG {catalog}`                                                          | `mergeCatalog` (`:214`): `used` = all ids in current catalog (sets, images, groups, tracks, sfx); append every incoming set/image/group/track with `allocateId(preferred, used)` (keep id if unused else fresh UUID; record image remaps); tracks' `recommendedImageId` remapped through the image map; incoming SFX whose id already exists **in current sfx** are skipped, others appended with allocateId (may be remapped if colliding with e.g. an image id); `stage`/`defaults`/`version` unchanged |

`applyRuntimeCommand(runtime, command, catalog)` (`:757`):

| Command (`:46-56`)     | Effect                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SHOW_PLATE {imageId}` | image must exist → `stageVisible = true`, `activeImage = {id, src, alt, name}` (no cue/thumbnail)                                                  |
| `RETURN_TO_MAP`        | if visible → `stageVisible = false` (activeImage kept, audio untouched)                                                                            |
| `PLAY_TRACK {trackId}` | track must exist → `audio = {trackId, title, source, youtubeId ?? null, src ?? null, status:'playing', loop, restartSeq: unchanged, volumeOffset}` |
| `PAUSE`                | only if playing and trackId → paused                                                                                                               |
| `RESUME`               | only if paused and trackId → playing                                                                                                               |
| `RESTART`              | if trackId → playing, `restartSeq + 1`                                                                                                             |
| `STOP`                 | if not stopped → stopped (track info kept)                                                                                                         |
| `SET_VOLUME {volume}`  | clampVolume; no-op if equal                                                                                                                        |
| `SET_DUCKED {ducked}`  | no-op if equal                                                                                                                                     |
| `FIRE_SFX {sfxId}`     | sfx must exist → `sfxSeq + 1`, `sfxId`, `sfxKind`, `sfxSynthType ?? null`, `sfxSrc ?? null`                                                        |

Store wiring (`gameStore.ts:878-927`): catalog writes go to both `state.sessionConsole` and `campaign.sessionConsole`; after `REPLACE_CATALOG` runtime = `sessionConsoleRuntimeFromCatalog(next, {worldArmed: current})`; after `UPDATE_STAGE_CHROME`, `UPDATE_DEFAULTS`, `MERGE_CATALOG` runtime = `copySessionConsoleChrome`. Note `UPDATE_DEFAULTS` does not copy `volume` into the runtime.

Tests `sessionConsoleReducers.test.ts`: applyRuntimeCommand › SHOW_PLATE copies player-safe fields only; RETURN_TO_MAP hides stage and does not stop audio; PLAY_TRACK copies player-safe fields and volumeOffset onto runtime.audio; FIRE_SFX increments seq; FIRE_SFX copies remapped synthType and local src onto runtime; unknown ids are no-ops and return the previous reference; PAUSE, RESUME, RESTART, and STOP only change transport status; SET_VOLUME clamps and SET_DUCKED toggles without touching the plate; RESTART increments restartSeq while already playing. applyCatalogAction › adds, updates, reorders, and removes image sets immutably; adds, updates, reorders, and removes images within a set; adds, updates, reorders, and removes track groups and tracks; updates stage chrome and defaults without mutating the previous catalog; REPLACE_CATALOG swaps the catalog; MERGE_CATALOG appends; colliding ids get new ids; no silent overwrite; MERGE_CATALOG skips seeded SFX ids when merging two empty catalogs; MERGE_CATALOG appends incoming SFX with a new id as a clone; MERGE_CATALOG remaps new SFX ids that collide with image ids; ADD_IMAGE / ADD_IMAGE_SET / ADD_TRACK / ADD_TRACK_GROUP clones the payload so later mutation does not change the catalog; unknown catalog ids are no-ops and return the previous reference.
`gameStore.test.ts` › Session Console: seeds an empty catalog with synth SFX on a new campaign; updateSessionConsole writes the same catalog object on GameState and campaign; dispatchSessionConsole SHOW_PLATE updates runtime immutably; setSessionConsoleWorldArmed updates runtime worldArmed; loadCampaign migrates missing sessionConsole without wiping maps and resets runtime; loadCampaign keeps an existing catalog and still resets runtime; REPLACE_CATALOG resets runtime chrome from the new catalog and preserves worldArmed; does not leak catalog or runtime after resetGameStore.

### 3.10 Session Console board — `src/utils/sessionConsoleBoard.ts`

| Function                              | Line    | Behaviour                                                                                                                                                                                                               |
| ------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---- | --- | ---------------------------------------- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flattenTracks(catalog)`              | 26      | all tracks in group order                                                                                                                                                                                               |
| `formatTrackFallbackLine(i, track)`   | 30      | youtube with id → `"{i}. {title} — https://www.youtube.com/watch?v={id}"`; otherwise `"{i}. {title} — (local file)"` (em dash U+2014)                                                                                   |
| `formatSessionConsoleFallbackLinks`   | 37      | lines joined by `\n`, index 1-based over the flattened list                                                                                                                                                             |
| `folderTitleFromFiles(files)`         | 44      | first `webkitRelativePath` segment, else nil                                                                                                                                                                            |
| `nextBoardTitle(existing, base)`      | 50      | `base`, else `base 2`, `base 3`, … first unused title                                                                                                                                                                   |
| `addNewImageSet` / `addNewTrackGroup` | 108/112 | new set `{id: UUID, title: nextBoardTitle(…,'Plates'), note:'', images:[]}` / group `{…'Tracks', note:'', accent:'bed', tracks:[]}`                                                                                     |
| `ensureImageSet(title?)`              | 79      | title given → set with that exact title or create it; else last set or create `'Plates'`                                                                                                                                |
| `ensureTrackGroup(groupId?)`          | 94      | existing id, else last group, else create `'Tracks'`                                                                                                                                                                    |
| `processImportedCatalogPlates`        | 149     | re-encode every plate: `MAP` (≤4096) for `src` and `THUMB` (≤256) for `thumbnailSrc` in parallel (concurrency 8); THUMB failure → thumbnail = src; any failure keeps the original image                                 |
| `addYouTubeFromText(raw, target)`     | 206     | parse id (fail → toast `'Invalid YouTube link'`, false); add track `{id: UUID, title: "YouTube {id}", cue:'', tag:'bed', source:'youtube', youtubeId, volumeOffset:0, loop:true}` to `ensureTrackGroup(target.groupId)` |
| `ingestDroppedFiles(files, target)`   | 255     | image = MIME `image/*` or ext `png                                                                                                                                                                                      | jpe?g | webp | gif | avif`; audio = MIME `audio/\*`or ext`mp3 | ogg | wav | m4a`; set = `target.setId`if exists else`ensureImageSet(folderTitle)`; group = `ensureTrackGroup(target.groupId)`; info toast if any audio 8–25 MB; per image: plate `{id: UUID, name: stem, cue:'', src, thumbnailSrc, alt: stem}`; per audio: `saveLocalAudioFile`then track`{title: stem, cue:'', tag:'bed', source:'local', src, volumeOffset:0, loop:true}`; stem = name minus last extension or `'Untitled'`; errors → sanitized error toast; progress toast `"Adding files… {done}/{total}"` only when total > 1, on first completion, last, or ≥200 ms since last |

Local audio rules (`src/utils/localAudioLimits.ts`, `localAudioAsset.ts`): allowed ext `mp3, ogg, wav, m4a` (case-insensitive, by name only); warn `> 8 MiB && ≤ 25 MiB` with message `'This audio file is larger than 8MB and will bloat the campaign zip.'`; reject `> 25 MiB` (`'Audio file is larger than 25MB and cannot be added to the campaign.'`); unsupported → `'Unsupported audio format (mp3, ogg, wav, m4a)'`; saved raw (no transcode) via `saveAssetTemp(buffer, rewriteSafeAssetFileName(name))`.
`OPEN_SESSION_CONSOLE_SETTINGS_EVENT = 'graphium-open-session-console-settings'` (`src/utils/sessionConsoleEvents.ts:1-5`) — UI event, map to a Notification/closure.

Tests `sessionConsoleBoard.test.ts`: formatSessionConsoleFallbackLinks › formats YouTube watch URLs and local-file placeholders in board order; lists YouTube tracks without an id as local-file placeholders so the index stays contiguous. folderTitleFromFiles › uses the first webkitRelativePath folder as the set title; returns undefined when files are not from a folder picker. processImportedCatalogPlates › starts MAP and THUMB processing together. addNewImageSet › creates uniquely titled plate sets instead of always using the first set. addNewTrackGroup › creates uniquely titled track groups. ingestDroppedFiles › throttles progress toasts to the first and last update when files finish together; adds a targeted drop to the chosen plate set, not the first set. `localAudioAsset.test.ts` › isAllowedAudioFileName accepts mp3 and rejects exe and webp; saveLocalAudioFile rejects files larger than 25MB; saves a small bed.mp3 and returns the mocked file URL; rewrites spaces and parentheses before saveAssetTemp; rejects bed.exe and does not call saveAssetTemp; saves a file just over 8MB without throwing.

### 3.11 Session Console pack format — `src/utils/sessionConsolePack.ts`

Authoring JSON (`board.json`), `SESSION_CONSOLE_PACK_KIND = 'graphium.sessionConsolePack'` (`:28`):

```json
{
  "version": 1,
  "kind": "graphium.sessionConsolePack",
  "stage": { "title": "", "subtitle": "", "showFrame": true },
  "defaults": { "volume": 45, "duckPercent": 27 },
  "imageSets": [
    {
      "id": "",
      "title": "",
      "note": "",
      "images": [{ "id": "", "name": "", "cue": "", "src": "", "alt": "" }]
    }
  ],
  "trackGroups": [
    {
      "id": "",
      "title": "",
      "note": "",
      "accent": "bed",
      "tracks": [
        {
          "id": "?",
          "title": "",
          "cue": "",
          "tag": "",
          "src": "",
          "recommendedImage": "?",
          "loop": true,
          "volumeOffset": 0
        }
      ]
    }
  ],
  "sfx": [{ "id": "", "label": "", "kind": "synth|local", "synthType": "?", "src": "?" }]
}
```

Types: `SessionConsolePack*` (`:114-171`). Constants: `PACK_HTTP_MAX_BYTES = 25 MiB` (`:29`), `PACK_INGEST_CONCURRENCY = 8` (`:173`).

**Parsing** `parseSessionConsolePack(json) -> {pack, errors}` (`:571`): not an object → `'Pack JSON must be an object'`; wrong kind → `Expected kind "graphium.sessionConsolePack"`; `version !== 1` → `'Expected pack version 1'` (these three return an empty pack). Stage: strings default `''`, `showFrame` default true; defaults: finite numbers else 45/27 (no clamping here). Sets (`:507`): non-object → error `imageSets[i] is not an object`; id default `image-set-{i+1}`, title default id. Images (`:440`): require id+trimmed src; src classified invalid or youtube → error `Image "{id}": {reason | must be a file or http src}`; `name` default id. Groups (`:535`): id default `track-group-{i+1}`; invalid accent → error + `'bed'`. Tracks (`:472`): require title+src; invalid src → error; `loop` default true, `volumeOffset` finite else 0, optional `id`/`recommendedImage` only when non-empty. SFX (`:626`): items need string id; `kind` = `'local'` only if exactly that, else `'synth'`; `label` default id; `synthType`/`src` copied if strings (synthType not validated).

**Src classification** `classifyPackSrc(src)` (`:411`), on trimmed input:

1. empty → invalid `empty src`; 2. `parseYouTubeVideoId` ok → `youtube`; 3. `^file:` (ci) → path via URL pathname decode (strip leading `/` before drive letter); UNC/`//` → invalid `network path is not allowed`; else `absolute`; parse error → `invalid file URL`;
2. `^https?://` (ci) → YouTube host without id → invalid `youtube URL is missing a video id`; unparsable → `invalid http URL`; `!isSafePackHttpUrl` → `remote file host is not allowed`; else `http`;
3. otherwise: `^(\\\\|//)` → network invalid; any other `scheme:` (not a drive letter) → `unsupported scheme in "{src}"`; absolute (`^([a-zA-Z]:[\\/]|/|\\\\)`) → absolute; starts `./`/`../`, contains `/` or `\`, or ends with `\.[a-zA-Z0-9]{2,5}` → relative; else `unrecognized src "{src}"`.

`isSafePackHttpUrl` (`:266`): https only; reject hosts `localhost`, `metadata.google.internal`, `0.0.0.0`, `::1`, prefixes `fe80:`, `fc`, `fd` (note: also rejects any hostname starting with "fc"/"fd", e.g. `fdn.example.com`), and IPv4 `0.*, 10.*, 127.*, 169.254.*, 172.16–31.*, 192.168.*`.
`isPathInsidePackRoot(root, candidate)` (`:433`): POSIX-style normalisation (`normalizePath`, `:58`) + relative path; inside iff relative is `''` or doesn't start with `..` and isn't absolute.
`readResponseCapped` (`:200`) / `fetchHttpCapped` (`:294`): not ok → failed; `Content-Length > cap` → too-large without reading; streamed total `> cap` → cancel, too-large; exceptions → failed. Electron uses `net.fetch(href, {redirect: 'error'})` (`electron/sessionConsolePackIngest.ts:39-46`).

**Materialisation** `materializePack(pack, resolveFile, fetchHttp?, persistBuffer?, options?)` (`:984`):

1. Catalog = `emptySessionConsoleCatalog(pack.stage.title)` with `stage`/`defaults` copied (defaults **not clamped**). `usedIds` seeded with the five synth ids.
2. Prefetch every unique non-YouTube src (images, tracks, local sfx) with concurrency 8; each src ingested once (cache by trimmed src).
3. `ingestSrc`: youtube/invalid → skipped `"{label}: {reason}"`; http → requires `fetchHttp` + `persistBuffer`; too-large → `"{label}: remote file is larger than 25MB"`; failure → `"{label}: failed to fetch remote file"`; audio-named over 8 MiB → generic warning; relative/absolute → `resolveFile(path)`: `{skip}` → `"{label}: {skip}"`, nil → `options.localFileSkipReason ?? "{label}: missing or unsandboxed file"`.
4. Images: dropped if not ingested; id kept unless already used, then `slugId(id)`; `thumbnailSrc = src`. Set ids/titles copied verbatim (not deduplicated).
5. Track id always `slugId(id ?? title, usedIds)` (`slugId`, `:650`: lowercase, runs of non `[a-z0-9]` → `-`, trim `-`, empty → `item`, then `-2`, `-3`… until unused). `recommendedImage` resolves by exact image id, else by lowercased image name. YouTube → `{source:'youtube', youtubeId}`; local → `{source:'local', src}` or dropped. `volumeOffset` clamped ±30, `loop ?? true`.
6. SFX (only if pack has a non-empty `sfx`): synth → `{id,label,kind:'synth',synthType?}`; local without src → skipped `SFX "{id}": local clip is missing src`; local ingested → `{id,label,kind:'local',src}`. `unionSfx(seeded, incoming)` (`:808`): seeded order with same-id replacements, then new incoming ids appended.
   Returns `{catalog, skipped, warnings}`; callers prepend parse errors to `skipped`.

Electron board import (`electron/sessionConsolePackFiles.ts:132-169`): pack root = dir of `board.json`; `resolveSandboxedPackPath` (`:54`) accepts relative or absolute only if `realpath` stays under realpath(root); size limit 25 MiB (audio by `isAllowedAudioFileName`, else image) → `{skip: 'file is larger than 25MB'}`; copy to `temp_assets/<Date.now()>-<uuid8>-<safeName>` (`:43-48`); returns `file://…`. Only Architect window may invoke (`isArchitectPackSender`, `src/utils/sessionConsolePackIpc.ts:2`).
Web import (`ingestSessionConsolePackFromJson`, `:1033`): local files skipped with `'Local files cannot be imported in the browser — add files on the board.'`.

**Export** `catalogToSessionConsolePack(catalog)` (`:1078`): stage/defaults copied; images `src = ./images/{sanitizeExportId(id)}{ext}`; tracks youtube → `https://www.youtube.com/watch?v={id}`, else `./audio/{id}{ext}`; `recommendedImage = recommendedImageId`; sfx keep synthType, local sfx src `./audio/{id}{ext}`. `ext` = `fileExtension(src)` if it matches `^\.[a-zA-Z0-9]{1,5}$` else `.png` (images) / `.mp3` (audio). `sanitizeExportId` (`:1056`): basename, runs of non `[a-zA-Z0-9._-]` → `-`, trim leading/trailing `-`/`.`, empty/`.`/`..` → `asset`.
Electron export (`sessionConsolePackFiles.ts:226-286`): creates `images/` and `audio/`, copies image and **local track** files (sources must be inside allowed media roots; dest resolved by `resolveSandboxedExportDest`, `:199`), writes `board.json` pretty + trailing newline; returns `{ok: skipped.length == 0, skipped}`. Local SFX files are referenced in `board.json` but **not copied** (bug to fix or preserve knowingly).

Tests `sessionConsolePack.test.ts`: readResponseCapped › does not read the body when Content-Length exceeds the cap; concatenates streamed chunks under the cap; aborts a streamed body that exceeds the cap. classifyPackSrc › classifies youtube, relative, absolute, and http srcs; classifies raw youtube ids and absolute file paths; rejects UNC and protocol-relative file srcs; rejects loopback and plain-http remote srcs. isSafePackHttpUrl › allows public https and rejects private or non-https hosts. isPathInsidePackRoot › rejects relative paths that escape the pack root. parseSessionConsolePack › parses the example board pack with kind graphium.sessionConsolePack; collects row errors and keeps the rest of the pack; rejects the wrong pack kind. materializePack › resolves a repeated pack src once; ingests plates, tracks, and sfx in one shared pool; maps recommendedImage name or id onto recommendedImageId; keeps youtube tracks as ids and copies local srcs via resolveFile; skips files when resolveFile returns null and http when fetch fails; ingests http bytes via persistBuffer; seeds synth sfx when the pack omits sfx; unions pack sfx onto the seeded five and only replaces matching ids; skips http bodies larger than 25MB without persisting a path; skips over-cap HTTP with a 25MB reason when fetch returns too-large; skips failed HTTP fetches without calling them oversized; keeps pack image order when HTTP fetches finish out of order; skips relative local files with an add-on-the-board reason for web ingest; warns generically when ingested HTTP audio is over 8MB and still persists under 25MB. catalogToSessionConsolePack › writes youtube as watch URLs and files as ./images or ./audio; sanitizes ids so a ".." id cannot resolve outside destDir.
`tests/unit/sessionConsolePackIngest.spec.ts`: isArchitectPackSender › accepts only the Architect webContents id. resolveSandboxedPackPath › accepts files under the pack root and rejects traversal; rejects symlink escape outside the pack root; rejects absolute paths outside the pack root. copyPackAssetToTemp › skips oversized local images; skips oversized local audio the same way as localAudioAsset; copies 8MB-plus audio and reports a generic warning without the filename; copies allowed audio under the size gate. ingestSessionConsolePackFromBoardPath › materializes relative files from beside board.json into temp_assets; skips oversized local pack audio with a 25MB reason. exportSessionConsolePackToDirectory › writes board.json and copies ingested assets into images/ and audio/; does not write outside destDir when an image id contains ".."; returns skipped and ok false when a required copy is rejected.

### 3.12 Architect ↔ World View sync — `src/utils/syncUtils.ts`, `src/utils/worldViewTokenSync.ts`, `src/utils/syncStamp.ts`

**Architect → World (one-way authoritative).** Syncable slice `SyncableGameState` (`syncUtils.ts:113`): `tokens, tokenLibrary, drawings, doors, stairs, gridSize, gridType, gridColor, map, exploredRegions, isDaylightMode, activeMeasurement, broadcastMeasurement, sessionConsoleRuntime`. The **catalog is never sent** (only runtime), maps other than the active one are never sent.
Change detection is throttled at 32 ms (`SyncManager.tsx:472`). `detectChanges(prev, curr)` (`:573`) order: null prev → `[FULL_SYNC]`; `LIBRARY_UPDATE` (ref changed and deep-unequal); token add/update/remove; drawing add/update/remove; `GRID_UPDATE {gridSize, gridType, gridColor, isDaylightMode}` if any differs; `MAP_UPDATE` deep-unequal; `EXPLORED_UPDATE` if array ref changed (full array); measurement; door add/update/remove; stairs add/update/remove; session console.
`detectEntityActions` (`:407`): same collection ref → none; items without id ignored; new id → ADD (full item); same ref → skip; else UPDATE with `changes` = keys of the **current** item whose values are deep-unequal (removed keys are not reported); missing ids → REMOVE.
Measurement (`:463`): broadcasting → send `MEASUREMENT_UPDATE(current)` when measurement changed or broadcast was just enabled; broadcast turned off → `MEASUREMENT_UPDATE(null)`.
Session console (`:515`): skip if runtime ref unchanged; `STAGE_UPDATE {stageVisible, activeImage, stage}` if any differs; `AUDIO_UPDATE {audio, volume, ducked, duckPercent}` if any differs; `SFX_FIRE {seq, sfxId, kind, synthType, src}` if `sfxSeq` or `sfxId` differs. `worldArmed` changes alone emit nothing.
`coalesceSyncActions` (`:353`): 0 → none; `≥ FULL_SYNC_ACTION_THRESHOLD (20)` → single FULL_SYNC of current; 1 → as is; else `BATCH`.
`buildFullSyncPayload` (`:207`): doors/stairs default `[]`, measurement default null, broadcast bool, runtime cloned (`cloneSessionConsoleRuntime`, `:95`, fills `restartSeq/volumeOffset` 0, `duckPercent` 27, stage default).
`isEqual` (`:70`): deep equality for primitives/arrays/plain objects/Date; `null == undefined` only if identical; key sets must match exactly (an explicit `undefined` key counts as a key — Swift: treat absent and nil the same, which is the intended semantics).
Other: `SyncAction` union (`:138-197`, also drag actions `TOKEN_DRAG_START/MOVE/MOVE_BATCH/END`, `DOOR_TOGGLE`), `isTokenDragAction` (`:318`), `isSyncSliceUnchanged` (`:333`, reference equality of the slice), `cloneSyncableStateFromGame` (`:261`), `cloneSyncableStateFromPayload` (`:295`, defaults gridSize 50, LINES, given gridColor), `worldFullSyncStatePatch` (`:247`: only `tokens, drawings, doors, stairs, gridSize, gridType, gridColor, map, exploredRegions, isDaylightMode, activeMeasurement, broadcastMeasurement` and only if defined), `applyAction(runtime, action)` (`:653`: World-side runtime update for BATCH/STAGE_UPDATE/AUDIO_UPDATE/SFX_FIRE/FULL_SYNC; FULL_SYNC preserves the consumer's `worldArmed`).
World apply (`SyncManager.tsx:120-295`): FULL_SYNC sets the patch + tokens + runtime, `dmMeasurement = broadcast ? activeMeasurement : null`, replaces library if present; nested BATCH inside BATCH is ignored; other actions map onto store actions.

**World → Architect (what the World View may change): token x/y only.**
`detectWorldViewTokenUpdates(prev, tokens)` (`syncUtils.ts:370`): for tokens present in prev, emit `TOKEN_UPDATE {id, changes: {x?, y?}}` for changed coordinates; new/removed tokens ignored. Throttled 32 ms (`SyncManager.tsx:324`).
`sanitizeWorldToArchitectAction(raw)` (`worldViewTokenSync.ts:70`), applied in Electron main before relaying (`electron/main.ts:1166-1172`) and again in the Architect: accepts `TOKEN_UPDATE` with non-empty string id and at least one finite numeric `x`/`y` (`pickTokenPositionChanges`, `:16`, drops every other key), or a single-level `BATCH` of those (invalid entries dropped; 0 valid → reject; 1 valid → unwrapped TOKEN_UPDATE). Architect applies via `updateTokenPosition` only if the token exists and the position actually differs, then stamps the snapshot (`stampTokenPositionsOnSnapshot`, `syncStamp.ts:17`) so it is not echoed back.
World → Architect status events: `parseSessionConsoleWorldEvent` (`syncUtils.ts:708`): `type ∈ {armed, unarmed, ready, error}`, optional non-empty string `message`. `armed/unarmed` → `setSessionConsoleWorldArmed`; `error` → toast with `sanitizeSessionConsoleErrorMessage` (`:726`: replaces `/Users|home/<name>` → `<USER>`, Windows user dirs, `file://…` → `<FILE>`, `http(s)://…` → `<URL>`, then user paths → `<PATH>`, `/tmp|var|opt|private/…` → ` <PATH>`, then `sanitizeStack`).
Inbound-apply guard (`syncStamp.ts:31-46`): depth counter `beginInboundApply/endInboundApply` (never below 0), `isInboundApply`.

Tests `syncUtils.test.ts`: isTokenDragAction › identifies drag motion actions. isEqual › handles primitives; nested objects; arrays. detectChanges › detects token addition; token update; library update; includes gridColor in GRID_UPDATE; emits MEASUREMENT_UPDATE when broadcasting; clears measurement when broadcast is disabled; includes activeMeasurement in FULL_SYNC when broadcasting; detects stairs add/remove; detects explored region updates; emits FULL_SYNC when previous state is null; skips entity diffs when collection references are unchanged; skips deep compare when a token object reference is unchanged; emits STAGE_UPDATE when only the plate changes; emits AUDIO_UPDATE including restartSeq when it increments; emits AUDIO_UPDATE when a track starts playing; does not emit audio stop on RETURN_TO_MAP while audio is still playing; emits AUDIO_UPDATE (not FULL_SYNC) for volume and duck changes; emits SFX_FIRE when sfx seq advances; does not emit session console actions when only worldArmed changes; includes sessionConsoleRuntime chrome in FULL_SYNC and omits catalog imageSets. applyAction › applies STAGE_UPDATE on a consumer runtime without a catalog; merges AUDIO_UPDATE and SFX_FIRE into runtime without catalog reducers; applies FULL_SYNC runtime while preserving consumer worldArmed. clone and slice helpers › clones sessionConsoleRuntime from game and payload without catalog; treats sessionConsoleRuntime as part of the Architect sync slice; strips catalog and campaign keys from a World FULL_SYNC patch; includes runtime in buildFullSyncPayload. SESSION_CONSOLE_WORLD_EVENT › parses armed/unarmed/ready/error and rejects unknown payloads; sanitizes file paths in World error messages via errorSanitizer. coalesceSyncActions › returns an empty list when there are no actions; leaves a single action unwrapped; batches a small set of actions; collapses a large set of actions into FULL_SYNC. detectWorldViewTokenUpdates › returns no actions when previous state is null; emits position-only TOKEN_UPDATE actions; ignores newly added or removed tokens.
`worldViewTokenSync.test.ts` › pickTokenPositionChanges (keeps only finite x/y numbers; drops non-finite values); sanitizeWorldToArchitectAction (accepts TOKEN_UPDATE with position fields only; rejects non-token actions; sanitizes BATCH payloads and drops invalid entries; unwraps a single valid BATCH entry).
`syncStamp.test.ts` › syncStamp inbound apply (treats nested begin/end as a depth counter; does not go negative when end is called without begin); stampTokenPositionsOnSnapshot (patches matching token coordinates on the snapshot).

### 3.13 Asset processing — `src/utils/AssetProcessor.ts`, `src/utils/imageMaxDimensions.ts`, `src/workers/image-processor.worker.ts`

| Type    | Max dimension (`imageMaxDimensions.ts:3-14`) | Used for                                                               |
| ------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| `MAP`   | 4096                                         | map backgrounds (`MapSettingsSheet.tsx:126`), session plates `src`     |
| `TOKEN` | 512 (also the fallback for unknown types)    | tokens & library uploads (`Sidebar.tsx:226`, `LibraryManager.tsx:116`) |
| `THUMB` | 256                                          | session plate thumbnails                                               |

Algorithm (`AssetProcessor.ts:286-364`, identical in worker `image-processor.worker.ts:54-130`): decode; if `w > max || h > max`: `ratio = w/h`; if `w > h` → `w = max, h = round(max/ratio)`; else (portrait **or square**) → `h = max, w = round(max·ratio)`; draw scaled; encode **WebP quality 0.85**; file name = original name with last extension replaced by `.webp` (regex `\.[^/.]+$`); persist via `saveAssetTemp`. Images never upscale. Progress callbacks 0/20/40/60/80/(90)/100. `processBatch` (`:392`): parallel, overall progress = `round(sum/count)`, empty → `[]` and progress 100. Library thumbnails are separate (128×128 stretched, §1.10). Animated GIFs become a single frame.
macOS note: WebP _encoding_ is not available in ImageIO on all supported macOS versions; plan for libwebp or a different internal format (keep WebP decode for import).
Tests `AssetProcessor.test.ts` › processing handles map constraints correctly; token constraints; thumb constraints; converts extension to .webp. `imageMaxDimensions.test.ts` › uses shared map, token, and thumb caps.

### 3.14 Fuzzy search — `src/utils/fuzzySearch.ts`

`fuzzySearch(items, query)` (`:121`): empty/whitespace query → all items sorted `dateAdded` desc. Else `q = trim(query)`, `lq = lower(q)`; `isSection = "assets".hasPrefix(lq)`; per item: if section → `score = 50`, and if `lq == "assets"` → score exactly 100 (skip the rest); `score += 3·match(name) + match(category) + Σ 2·match(tag)`. Keep `score > 0`, stable sort desc.
`scoreMatch(text, q)` (`:65`): empty q → 0; lower both; equal → 100; not a subsequence → 0; else `10 + (startsWith ? 40 : 0) + (contains ? 20 : 0) + structural`, clamped ≥ 0.
`scoreStructuralBonuses` (`:31`): walk q chars, `idx = text.indexOf(ch, last+1)` (greedy); `+15` if idx is 0 or preceded by `' '`, `'-'`, `'_'`; `+10` if `idx == last+1` (note: true for the first char when idx == 0), else if `last != -1` add `idx − last` to `compactness`; finally `−min(compactness, 20)`.
`filterByCategory(items, cat)` (`:175`): empty or `'All'` → all; else case-insensitive equality. `getCategories` (`:189`): unique, default JS sort (R6).
Tests `fuzzySearch.test.ts`: fuzzySearch function › return all items sorted by date when query is empty; all items when query is whitespace only; match exact name; match case-insensitively; names that start with query; names containing query; match tags; match category; partial words (fuzzy); multi-word queries; prioritize exact matches over partial matches; prioritize name matches over tag matches; queries with special characters; empty array when no matches found; handle empty library; score exact matches highest (100 points); score "starts with" matches higher than "contains". filterByCategory function › filter items by category; filter case-insensitively; all items when category is "All"; all items when category is empty; empty array when category not found; handle empty library. getCategories function › unique categories sorted alphabetically; handle duplicate categories; handle empty library; sort categories alphabetically.

### 3.15 Command registry — `src/utils/commandRegistry.ts`

`Command {id, label, category: 'Tool'|'World View'|'Generation'|'System', keywords[], shortcut?, icon?, execute}` (`:20`). `createCommandRegistry(handlers)` (`:39`) returns, in order:

| id                              | label                                                        | category   | shortcut      | keywords                                                      |
| ------------------------------- | ------------------------------------------------------------ | ---------- | ------------- | ------------------------------------------------------------- |
| `tool-select`                   | Select Tool                                                  | Tool       | V             | select, cursor, move, tool, v                                 |
| `tool-marker`                   | Marker Tool                                                  | Tool       | M             | marker, draw, pen, brush, tool, m                             |
| `tool-eraser`                   | Eraser Tool                                                  | Tool       | E             | eraser, erase, remove, tool, e                                |
| `tool-wall`                     | Wall Tool                                                    | Tool       | W             | wall, barrier, draw, tool, w                                  |
| `tool-door`                     | Door Tool                                                    | Tool       | D             | door, entrance, tool, d                                       |
| `tool-measure`                  | Measure Tool                                                 | Tool       | R             | measure, ruler, distance, aoe, blast, cone, tool, r           |
| `world-view-toggle-pause`       | `Resume World View (Play)` if paused else `Pause World View` | World View | —             | pause, play, resume, world, view, players, loading            |
| `world-view-launch`             | Launch World View Window                                     | World View | Cmd+Shift+W   | world, view, projector, player, window, launch, open          |
| `dungeon-generate`              | Generate Dungeon                                             | Generation | —             | dungeon, generator, generate, random, map, create             |
| `session-console-stop`          | Session Console: Stop                                        | World View | Esc           | session, console, stop, audio, escape → `STOP`                |
| `session-console-duck`          | Session Console: Duck                                        | World View | `D (Console)` | session, console, duck, volume → `SET_DUCKED(!ducked)`        |
| `session-console-return-to-map` | Session Console: Return to Map                               | World View | —             | session, console, map, plate, stage → `RETURN_TO_MAP`         |
| `session-console-test-tone`     | Session Console: Test Tone                                   | World View | —             | session, console, test, tone, sfx → `FIRE_SFX('test-tone')`   |
| `session-console-settings`      | Session Console: Settings                                    | World View | —             | session, console, settings, pack, stage → open settings event |

Icons (emoji) per entry at `:66-190`. `searchCommands(commands, query)` (`:208`): blank → all; `isSection = "actions".hasPrefix(lq)` (+50; exact `"actions"` → 100); `scoreText`: equal 100, startsWith 40, contains 20, subsequence 10, else 0; `score += 3·label + category + Σ 2·keyword`; keep > 0; stable sort desc.
Tests `commandRegistry.test.ts` (createCommandRegistry session console commands): does not reuse the Door Tool D shortcut for Duck; registers the five session console command ids; stop, duck, return-to-map, and test-tone dispatch runtime commands; settings command opens the Session Console settings sheet via custom event.

### 3.16 Recent campaigns — `src/utils/recentCampaigns.ts`

`RecentCampaign = {id, name, lastOpened: ms, platform: 'web'} | {…, platform: 'electron', filePath}` (`:11-35`); key `graphium-recent-campaigns` (`:37`), `MAX_RECENT = 3` (`:38`).
`getRecentCampaigns` (`:44`): parse JSON array, any error → `[]` (no re-sorting). `addRecentCampaign` (`:65`): remove same id, prepend with `lastOpened = now`, cap 3. `addRecentCampaignWithPlatform(id, name, filePath?)` (`:87`): electron entry only if running in Electron **and** filePath given (App never passes it, `App.tsx:310,330`, so all entries are `web`). `removeRecentCampaign` (`:112`), `clearRecentCampaigns` (`:126`). All storage errors swallowed.
Swift: store security-scoped bookmarks instead of paths (sandbox).
Tests `recentCampaigns.test.ts`: getRecentCampaigns › empty array when no campaigns are stored; return stored campaigns; handle corrupted localStorage data; return campaigns in pre-sorted order. addRecentCampaign › add a new campaign to empty list; add campaign to beginning of list; update existing campaign timestamp; limit to MAX_RECENT campaigns (3); handle Electron campaigns with file paths. addRecentCampaignWithPlatform › web campaign when not in Electron; Electron campaign with file path when in Electron; web campaign in Electron if no file path provided. removeRecentCampaign › remove campaign by id; removing non-existent campaign; removing from empty list. clearRecentCampaigns › clear all campaigns; clearing when already empty. error handling › localStorage errors gracefully in getRecentCampaigns / addRecentCampaign.

### 3.17 System messages — `src/utils/systemMessages.ts`

`rollForMessage(intent, replacements?)` (`:390`): pick `messages[floor(random·count)]`; missing/empty pool → `'✨ The message scroll is blank. Please report this to the archmage.'`; each replacement replaces every `{key}` (regex, so keys are regex-escaped implicitly only for simple names).
Keys (`MessageIntent`, `:15-60`, pools `:62-363`, 5–10 variants each):
Success: `CAMPAIGN_SAVE_SUCCESS, CAMPAIGN_LOAD_SUCCESS, ASSET_DELETED_SUCCESS, ASSET_ADDED_TO_MAP_SUCCESS ({itemName}), ASSET_ADDED_TO_LIBRARY_SUCCESS`.
Errors: `CANNOT_DELETE_ONLY_MAP, PAUSE_TOGGLE_FAILED, CAMPAIGN_SAVE_FAILED ({error}), CAMPAIGN_LOAD_FAILED ({error}), MAP_IMAGE_PROCESS_FAILED, MAP_IMAGE_LOAD_FAILED, MAP_UPLOAD_FAILED, TOKEN_UPLOAD_FAILED, PROCESSED_IMAGE_READ_FAILED, IMAGE_PROCESS_FAILED, ASSET_DELETE_FAILED, LIBRARY_NAME_REQUIRED, LIBRARY_IMAGE_DATA_MISSING, LIBRARY_SAVE_FAILED, LIBRARY_UPDATE_FAILED, PAUSE_STATE_SYNC_FAILED`.
Confirms: `CONFIRM_TOKEN_REMOVAL, CONFIRM_MAP_DELETE, CONFIRM_LIBRARY_ASSET_DELETE`. Loading: `LOADING_PAUSE_OVERLAY, LOADING_ERROR_REPORT`. Error boundaries: `ERROR_DUNGEON_GENERATION_TITLE/_DESC, ERROR_PRIVACY_TITLE/_DESC, ERROR_ASSET_PROCESSING_TITLE/_DESC`.
Examples: `CAMPAIGN_SAVE_SUCCESS` → "🎲 Natural 20 on that Arcana check! Campaign saved successfully."; `CAMPAIGN_SAVE_FAILED` → "💀 Critical failure! Your campaign could not be saved: {error}". Port the pools verbatim into a `.strings`/JSON resource (no tests).

### 3.18 Session Console audio helpers (component-level pure logic)

| Item                                  | Ref                                                     | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| synth recipes                         | `src/components/SessionConsole/worldStageSfx.ts:18-108` | test-tone: sines 220/330/440 Hz (detune 0/4/8 cents), gain 0.0001→0.22 by 0.2 s, hold to 2.6 s, →0.0001 at 3 s; chime: sine 880→1760 Hz exp in 0.1 s, gain 0.35→0.0001 exp over 2.5 s; drone: saw 55 Hz → lowpass 220 Hz, gain 0.0001→0.28 lin 0.8 s →0.0001 at 5 s; snap: 50 ms white noise × linear decay → highpass 1 kHz, gain 0.5→0.0001 exp 0.06 s; ping (default): triangle 1200 Hz, gain 0.3→0.0001 exp 1.2 s |
| `resolveSynthType(sfxId, synthType?)` | `:110`                                                  | synthType if set, else sfxId if it is a synth id, else nil                                                                                                                                                                                                                                                                                                                                                            |
| local SFX cache                       | `:123-160`                                              | decoded buffers cached per audio context by URL; concurrent fires share one fetch                                                                                                                                                                                                                                                                                                                                     |
| `youtubeErrorMessage(code)`           | `worldAudioYoutube.ts:97`                               | 101/150 → embedding disabled; 153 → origin/referrer hint; else `YouTube error {code}` (+ copy-links suffix for known codes)                                                                                                                                                                                                                                                                                           |
| `currentLevel`                        | `:108`                                                  | `effectiveVolume(volume, ducked, offset, duckPercent)`                                                                                                                                                                                                                                                                                                                                                                |
| `fadeToLevel`                         | `:186`                                                  | reduced-motion or `duration ≤ 0` → set immediately; else `steps = max(1, round(duration/40))`, every 40 ms linear interpolate (rounded) for YouTube volume (0–100) and local audio (`/100`, clamped 0–1)                                                                                                                                                                                                              |
| constants                             | `:4-6`                                                  | `ARM_VIDEO_ID = 'dxwJuo_KejY'`, `RESTRICTED_YT_ERRORS = {101,150,153}`                                                                                                                                                                                                                                                                                                                                                |
| `shouldDeferSessionConsoleEscape`     | `useSessionConsoleHotkeys.ts:38`                        | Esc does not stop audio while a confirm dialog / palette / measurement is active or focus is in an input                                                                                                                                                                                                                                                                                                              |

Tests: `worldStageSfx.test.ts` › playLocalSfx fetches and decodes a local clip once when the same src is replayed; shares one in-flight fetch when the same src is fired twice at once. `worldAudioYoutube.test.ts` › sendWorldEvent posts SESSION_CONSOLE_WORLD_EVENT on graphium-sync when ipcRenderer is missing; ensureIframeApi does not fire onReady after cleanup; fadeToLevel fades YouTube and local audio together. `useSessionConsoleHotkeys.test.ts` › shouldDeferSessionConsoleEscape (defers while a confirm dialog, palette, or measurement is active; defers while typing in an input; defers only for explicit Esc owners, not a nav drawer dialog); empty runtime stays stopped (starts stopped so Esc does not capture).

### 3.19 Touch settings helpers — `src/store/touchSettingsStore.ts`

Defaults (`:114-144`): `pressureSensitivityEnabled true, pressureCurve 'normal', pinchDistanceThreshold 10, twoFingerPanEnabled true, palmRejectionMode 'touchSize', palmRejectionThreshold 40, palmRejectionDelay 300, desktopOnlyMode false, tiltSensitivityEnabled true, hoverPreviewEnabled true, barrelButtonEnabled true, showPressureIndicator true, showTouchPointIndicators true, showGestureFeedback true, showGestureTutorial true, showGestureHints true`. Enums: `PressureCurve = light|normal|heavy`, `PalmRejectionMode = off|touchSize|stylusOnly|smartDelay`.
`getPressureRange` (`:164`): light `{0.2, 2.0}`, normal `{0.3, 1.5}`, heavy `{0.4, 1.2}`. `shouldRejectTouch(event, stylusActive)` (`:177`): desktopOnly && touch → true; mode off → false; non-touch → false; stylusOnly && stylusActive → true; touchSize && `max(width, height) > threshold` → true; else false (smartDelay timing is the caller's job).
Tests `tests/unit/touchSettingsStore.spec.ts`: Default Values; updateSettings (single; multiple; not affect other settings); resetToDefaults; getPressureRange (light, normal, heavy); shouldRejectTouch (accept all when off; reject all touch when desktopOnlyMode; reject large contact areas in touchSize mode; reject touch when stylus is active in stylusOnly mode; not reject pen events; not reject mouse events; use max dimension for contact size threshold); Threshold Validation; Feature Toggles. (Mostly relevant for an iPad build; on macOS keep the model for pen tablets.)

---

## 4. Store actions

### 4.1 `gameStore` — `src/store/gameStore.ts:449-935`

Campaign / maps

| Action                      | Line | Effect                                                                                                                                                                                                                                                                |
| --------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadCampaign(c)`           | 490  | validate (`maps`, `activeMapId`, active map exist) else no-op; ensure catalog; hydrate active-map mirror with fallbacks (§1.3); `sessionConsole = c.sessionConsole`; runtime = fresh from catalog (worldArmed reset to false)                                         |
| `resetToNewCampaign()`      | 520  | new campaign with one map `'Map 1'`; hydrate; runtime from catalog; `isCalibrating = false`                                                                                                                                                                           |
| `addMap(name = 'New Map')`  | 603  | sync active map → add default map → make it active and hydrate                                                                                                                                                                                                        |
| `deleteMap(id)`             | 632  | if only one map → toast `CANNOT_DELETE_ONLY_MAP` (error), no-op; if deleting active: next active = key after it in insertion order, else the one before; hydrate it **without** syncing the deleted map; remove map. (Deleting an unknown id simply filters nothing.) |
| `switchMap(id)`             | 692  | no-op if already active or unknown; sync current → set active → hydrate                                                                                                                                                                                               |
| `renameMap(id, name)`       | 730  | rename if exists                                                                                                                                                                                                                                                      |
| `syncActiveMapToCampaign()` | 571  | copy mirror fields into `campaign.maps[activeMapId]` (preserving id/name)                                                                                                                                                                                             |

Token library (campaign copy)

| Action                          | Line | Effect             |
| ------------------------------- | ---- | ------------------ |
| `addTokenToLibrary(item)`       | 545  | append (no dedupe) |
| `removeTokenFromLibrary(id)`    | 553  | filter             |
| `updateLibraryToken(id, patch)` | 561  | shallow merge      |

Tokens (active map) — all keep `tokensById`/`tokenIds` in sync

| Action                                                     | Line    | Effect                                                                                          |
| ---------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `addToken(t)`                                              | 752     | append (no dedupe)                                                                              |
| `removeToken(id)` / `removeTokens(ids)`                    | 753/755 | filter                                                                                          |
| `updateTokenPosition(id, x, y)`                            | 757     | patch x,y; unknown id no-op                                                                     |
| `updateTokenPositions([{id,x,y}])`                         | 759     | batch patch; unchanged → no-op                                                                  |
| `updateTokenTransform(id, x, y, scale)`                    | 761     | patch x,y,scale                                                                                 |
| `updateTokenProperties(id, {type?, visionRadius?, name?})` | 765     | shallow patch (passing `undefined` values sets them undefined → reverts to library inheritance) |
| `setTokens(tokens)`                                        | 862     | replace all                                                                                     |

Drawings

| Action                                      | Line    | Effect        |
| ------------------------------------------- | ------- | ------------- |
| `addDrawing(d)`                             | 771     | append        |
| `removeDrawing(id)` / `removeDrawings(ids)` | 772/774 | filter        |
| `updateDrawingTransform(id, x, y, scale)`   | 776     | set x,y,scale |

Doors

| Action                                | Line    | Effect                                                 |
| ------------------------------------- | ------- | ------------------------------------------------------ |
| `addDoor(d)`                          | 782     | append unless id exists (silent dedupe)                |
| `removeDoor(id)` / `removeDoors(ids)` | 791/792 | filter                                                 |
| `toggleDoor(id)`                      | 794     | flip `isOpen` (ignores lock; UI blocks locked toggles) |
| `updateDoorState(id, isOpen)`         | 808     | set                                                    |
| `updateDoorLock(id, isLocked)`        | 812     | set (open state preserved)                             |
| `updateAllDoorStates(isOpen)`         | 816     | set on all **unlocked** doors                          |
| `updateAllDoorLocks(isLocked)`        | 820     | set on all doors                                       |

Stairs: `addStairs` (826, append), `removeStairs` (827), `removeMultipleStairs` (829).

Grid / map background

| Action                                                                          | Line        | Effect                                 |
| ------------------------------------------------------------------------------- | ----------- | -------------------------------------- |
| `setGridSize(n)` / `setGridType(t)` / `setGridColor(c)`                         | 833-835     | set (no validation)                    |
| `setMap(cfg \| null)`                                                           | 836         | set                                    |
| `updateMapPosition(x, y)` / `updateMapScale(s)` / `updateMapTransform(s, x, y)` | 837/841/845 | patch if a map exists, else stays null |
| `setDaylightMode(b)`                                                            | 861         | set                                    |

Exploration: `addExploredRegion(r)` (852, append, keep last 2000), `clearExploredRegions()` (860).

Session console: `updateSessionConsole(action)` (878), `dispatchSessionConsole(cmd)` (907), `setSessionConsoleWorldArmed(b)` (919) — see §3.9.

Measurement: `setActiveMeasurement(m)` (930), `setBroadcastMeasurement(b)` (932), `setDmMeasurement(m)` (933, World View display copy).

Transient UI / system: `setIsCalibrating` (851), `showToast(message, type)` / `clearToast` (865/867; type `error|success|info`), `showConfirmDialog(message, onConfirm, confirmText?)` / `clearConfirmDialog` (868/870), `setShowResourceMonitor` (871), `showDungeonDialog` / `clearDungeonDialog` (872/873), `setIsGamePaused` (874; mirrors Electron main `TOGGLE_PAUSE`/`GET_PAUSE_STATE`, `main.ts:1035-1046`, global across map changes), `setMobileSidebarOpen` (875), `setCommandPaletteOpen` (876), `setState(partial)` (863, legacy escape hatch; rebuilds the token index when `tokens` is present).

Tests `src/store/gameStore.test.ts`: Token Operations › add a token to the current map; remove a token by id; remove multiple tokens by ids; update token position; update multiple token positions in one write; update token transform (position and scale); update token properties (type, visionRadius, name); maintain immutability when updating tokens; handle updating non-existent token gracefully. Drawing Operations › add; remove by id; remove multiple; update drawing transform; maintain immutability. Door Operations › add; remove by id; toggle a door open/closed; toggle a door regardless of lock state; update door state directly; update door lock state; update all unlocked doors at once; update all door locks at once; remove multiple doors. Stairs Operations › add; remove by id; remove multiple. Map Operations › set a new map config; clear map config by setting to null; update map position; update map scale; update map transform (scale and position); set grid size; set grid type; set daylight mode. Campaign Operations › load a campaign and hydrate active map; handle invalid campaign structure gracefully; add a new map to campaign; sync active map state to campaign before adding new map; delete a map from campaign; not delete the last remaining map; switch to another map when deleting active map; sync active map to campaign. Token Library Operations › add; remove; update a library token. Exploration Operations › add an explored region; clear all explored regions. System State Operations › show and clear toast messages; show and clear confirm dialog; toggle calibration mode; toggle resource monitor; show and clear dungeon dialog; set game paused state; set mobile sidebar open state. Measurement Operations › set active measurement; clear active measurement; set broadcast measurement flag; set DM measurement for World View. Session Console (see §3.9).
Door UI behaviour tests `src/components/Canvas/DoorInteraction.test.ts`: Context Menu: Toggle Door › toggle a closed door to open; toggle an open door to closed; allow toggling a locked door via store (UI blocks this separately). Lock/Unlock Door › lock an unlocked door; unlock a locked door; preserve open/closed state when toggling lock. Delete Door › delete a single door via removeDoor; handle deleting a non-existent door gracefully. Eraser Tool › remove door when eraser tool clicks it. Delete/Backspace › remove multiple doors via removeDoors; handle mixed IDs (tokens + doors) gracefully; handle empty selection gracefully. State Combinations › allow deleting a locked door; allow deleting an open door; support full lifecycle: add → toggle → lock → delete.

### 4.2 Other stores

| Store                                                         | Ref                                   | State (defaults)                                                                                                                 | Actions                                                                                                                                                  |
| ------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uiStore` (not persisted)                                     | `src/store/uiStore.ts:32`             | `tool 'select'` (`select                                                                                                         | marker                                                                                                                                                   | eraser | wall | door | measure`), `color '#df4b26'`, `recentColors ['#df4b26','#3b82f6','#22c55e']`, `doorOrientation 'horizontal'`, `measurementMode 'ruler'`, `selectedTokenIds []` | `setTool`; `setColor(c)` (c first, others deduped case-insensitively, max 3); `toggleDoorOrientation`; `setMeasurementMode(m)` (also `gameStore.setActiveMeasurement(null)`); `setSelectedTokenIds`; `clearSelection` |
| `pointerOverlayStore`                                         | `src/store/pointerOverlayStore.ts:37` | `hoveredCell null`, `doorPreviewPos null`, `hoveredTokenId null`, `snapPreviews []` (`{id,x,y,size}`), `livePositions` empty map | `setHoveredCell`, `setDoorPreviewPos`, `setHoveredTokenId`, `setSnapPreviews`, `setLivePositions([{id,x,y}])` (replaces whole map), `clearLivePositions` |
| `visionStore`                                                 | `src/store/visionStore.ts:17`         | `polygons []`, `hiddenTokenIds ∅`                                                                                                | `setVision(polygons, hidden)`                                                                                                                            |
| `preferencesStore` (persisted `graphium-preferences`)         | `src/store/preferencesStore.ts:48`    | `wallTool {enableSmoothing true, smoothingEpsilon 3.0, enableSnapping true, snapThreshold 10, minPoints 2}`                      | `setWallToolPreference(key, value)`, `resetWallToolPreferences()`                                                                                        |
| `touchSettingsStore` (persisted `graphium-touch-settings` v1) | `src/store/touchSettingsStore.ts:151` | §3.19                                                                                                                            | `updateSettings(partial)`, `resetToDefaults()`, `getPressureRange()`, `shouldRejectTouch(event, stylusActive)`                                           |

Tests: `uiStore.test.ts` › starts on the select tool with the default colour and three recent colours; setColor puts the colour first in recentColors, deduplicated case-insensitively, max three; toggleDoorOrientation flips between horizontal and vertical; setMeasurementMode clears the active measurement in gameStore; setSelectedTokenIds and clearSelection round-trip; writes nothing to localStorage (not persisted). `pointerOverlayStore.test.ts` › replaces the live position map for the current drag set; clears back to an empty map.

### 4.3 Electron IPC surface relevant to the model (to replace with native services)

| Channel                                                                                            | Ref                                          | Native replacement                                                                                                                                           |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SAVE_ASSET_TEMP(buffer, name)` → `file://temp_assets/<ts>-<safe>`                                 | `electron/main.ts:805`                       | asset store write                                                                                                                                            |
| `SAVE_CAMPAIGN(campaign)` / `AUTO_SAVE(campaign)` / `LOAD_CAMPAIGN()`                              | `:817/834/853`                               | document save/autosave/open                                                                                                                                  |
| `SAVE_ASSET_TO_LIBRARY`, `LOAD_LIBRARY_INDEX`, `DELETE_LIBRARY_ASSET`, `UPDATE_LIBRARY_METADATA`   | `:908-1025`                                  | global library service                                                                                                                                       |
| `TOGGLE_PAUSE` / `GET_PAUSE_STATE`                                                                 | `:1035-1046`                                 | app-level pause flag                                                                                                                                         |
| `IMPORT_SESSION_CONSOLE_PACK` / `EXPORT_SESSION_CONSOLE_PACK`                                      | `electron/sessionConsolePackIngest.ts:26-65` | pack import/export                                                                                                                                           |
| `SYNC_WORLD_STATE`, `SYNC_FROM_WORLD_VIEW`, `REQUEST_INITIAL_STATE`, `SESSION_CONSOLE_WORLD_EVENT` | `electron/main.ts:1157-1185`                 | in-process model observation for a second window (the sync diff layer can become much simpler, but World View write-scope must stay "token x/y only")        |
| `campaignWriteGate`                                                                                | `electron/campaignWriteGate.ts`              | serialise writes, block new writes after quit begins (tests: waits for in-flight writes before reporting idle; rejects new writes after quit cleanup begins) |
