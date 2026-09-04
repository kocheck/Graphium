# Session Console Implementation Plan

> **For agentic workers:** Implement task-by-task. Check off steps as you go. Prefer TDD for store, sync, YouTube URL parsing, volume math, and asset rewrite. Do not start UI until the catalog + runtime + sync slice exist.

**Goal:** Ship a campaign-native Session Console (Architect editor + transport) and a World View Stage (player-safe plates + YouTube/local audio) as specified in [session-console-design.md](./session-console-design.md).

**Architecture:** Catalog lives on `Campaign.sessionConsole`. Runtime lives on `GameState.sessionConsoleRuntime` and is the only slice synced Architect → World. World View renders `WorldStage` above the canvas (below pause) and owns all playback. Production Electron must load the renderer from a non-`file://` origin so YouTube embedding works.

**Tech Stack:** Electron 33, React 18, TypeScript 5, Zustand, existing IPC/`media://` pipeline, YouTube IFrame API, HTMLAudioElement, Web Audio API.

## Global Constraints

- Architect is the source of truth; World does not edit the catalog.
- Tracks and images stay independent; never auto-apply `recommendedImageId`.
- Dismissing Stage does not stop audio; `Stop` / `Esc` does.
- World receives the current plate payload only — never the full image-set gallery.
- YouTube via official IFrame API only. Do not download or transcode YouTube media.
- Local audio extensions: `mp3`, `ogg`, `wav`, `m4a`. No WebP conversion.
- Pause overlay (`z-[9999]`) always covers Stage (`z-[9998]`).
- Follow existing immutable Zustand updates, preload channel whitelist, and `rewriteCampaignAssetSrcs` patterns.
- Do not add npm audio libraries unless HTMLAudio + Web Audio prove insufficient.
- PII-sanitize file paths in any user-visible playback error.

---

## File map

**Create**

- `src/types/sessionConsole.ts` — catalog + runtime types, empty catalog, volume helpers, YouTube id parser
- `src/types/sessionConsole.test.ts`
- `src/store/sessionConsoleReducers.ts` — catalog CRUD + runtime commands (pure)
- `src/store/sessionConsoleReducers.test.ts`
- `src/components/SessionConsole/SessionConsolePanel.tsx` — Architect sidebar section + master bar
- `src/components/SessionConsole/SessionConsoleEditorSheet.tsx` — add/edit image or track
- `src/components/SessionConsole/ImageSetBoard.tsx`
- `src/components/SessionConsole/TrackGroupList.tsx`
- `src/components/SessionConsole/DiscordSetupHelp.tsx`
- `src/components/SessionConsole/WorldStage.tsx` — World overlay + arm gate
- `src/components/SessionConsole/WorldAudioEngine.tsx` — YouTube, local audio, synth
- `src/components/SessionConsole/WorldAudioEngine.test.ts` — volume / command application (pure bits)
- `src/utils/localAudioAsset.ts` — validate + `SAVE_ASSET_TEMP` for audio
- `src/utils/localAudioAsset.test.ts`

**Modify**

- `src/store/gameStore.ts` — `Campaign.sessionConsole`, runtime fields, actions
- `src/store/gameStore.test.ts`
- `src/utils/syncUtils.ts` + `src/utils/syncUtils.test.ts` — runtime on `SyncableGameState`, new actions
- `src/components/SyncManager.tsx` — apply / detect runtime + optional World status event
- `src/utils/campaignAssets.ts` + test — rewrite plate and local-audio `src`s
- `electron/main.ts` — production `graphium://` origin; optional audio MIME on `media://`
- `electron/preload.ts` — whitelist `SESSION_CONSOLE_WORLD_EVENT` if used as its own channel
- `src/App.tsx` — mount `WorldStage` in World View
- `src/components/Sidebar.tsx` — Session Console section
- `src/utils/commandRegistry.ts` — open console, return to map, stop, duck
- `docs/architecture/IPC_API.md` — new sync actions + World event
- `docs/context/CONTEXT.md` — feature is planned/implemented; still no voice chat
- `docs/index.md` — link this plan and the design
- `src/window.d.ts` — `YT` typings if needed

---

### Task 1: Types, volume math, YouTube URL parser

**Files:**
- Create: `src/types/sessionConsole.ts`
- Test: `src/types/sessionConsole.test.ts`

**Interfaces:**
- Produces: `SessionConsoleCatalog`, `SessionConsoleRuntime`, `emptySessionConsoleCatalog(campaignName: string)`, `emptySessionConsoleRuntime()`, `parseYouTubeVideoId(input: string): string | null`, `effectiveVolume(volume: number, ducked: boolean, offset?: number): number`, `clampVolume(value: number): number`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  parseYouTubeVideoId,
  effectiveVolume,
  emptySessionConsoleCatalog,
} from './sessionConsole';

describe('parseYouTubeVideoId', () => {
  it('accepts a raw 11-char id', () => {
    expect(parseYouTubeVideoId('bLZApMsorjA')).toBe('bLZApMsorjA');
  });

  it('parses watch, youtu.be, shorts, and embed URLs', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/watch?v=bLZApMsorjA')).toBe('bLZApMsorjA');
    expect(parseYouTubeVideoId('https://youtu.be/bLZApMsorjA')).toBe('bLZApMsorjA');
    expect(parseYouTubeVideoId('https://www.youtube.com/shorts/bLZApMsorjA')).toBe('bLZApMsorjA');
    expect(parseYouTubeVideoId('https://www.youtube.com/embed/bLZApMsorjA')).toBe('bLZApMsorjA');
  });

  it('returns null for garbage', () => {
    expect(parseYouTubeVideoId('https://example.com')).toBeNull();
    expect(parseYouTubeVideoId('')).toBeNull();
  });
});

describe('effectiveVolume', () => {
  it('applies offset then duck (27%) and clamps', () => {
    expect(effectiveVolume(45, false, 0)).toBe(45);
    expect(effectiveVolume(45, false, 10)).toBe(55);
    expect(effectiveVolume(45, true, 0)).toBe(12); // round(45 * 0.27)
    expect(effectiveVolume(200, false, 0)).toBe(100);
  });
});

describe('emptySessionConsoleCatalog', () => {
  it('seeds four synth SFX and campaign title', () => {
    const catalog = emptySessionConsoleCatalog('Ashen Crown');
    expect(catalog.version).toBe(1);
    expect(catalog.stage.title).toBe('Ashen Crown');
    expect(catalog.sfx.map((item) => item.id)).toEqual([
      'chime',
      'drone',
      'snap',
      'ping',
      'test-tone',
    ]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL** (module missing)

Run: `npx vitest run src/types/sessionConsole.test.ts`

- [ ] **Step 3: Implement types and helpers**

`parseYouTubeVideoId` must accept only `[A-Za-z0-9_-]{11}` after extracting `v=`, path tail, or raw input. Reject playlists-only URLs with no video id.

`effectiveVolume`: `clampVolume(volume + (offset ?? 0))`, then if ducked `Math.round(clamped * 0.27)`.

`emptySessionConsoleCatalog` returns empty `imageSets` / `trackGroups`, `showFrame: true`, and the five synth SFX (`test-tone` included so the button shares the SFX pipeline).

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit** `feat: add session console types and youtube id parser`

---

### Task 2: Pure reducers for catalog and runtime

**Files:**
- Create: `src/store/sessionConsoleReducers.ts`
- Test: `src/store/sessionConsoleReducers.test.ts`

**Interfaces:**
- Consumes: types from Task 1
- Produces: `applyCatalogAction(catalog, action): SessionConsoleCatalog`, `applyRuntimeCommand(runtime, command, catalog): SessionConsoleRuntime`

Catalog actions (all immutable): `ADD_IMAGE_SET`, `UPDATE_IMAGE_SET`, `REMOVE_IMAGE_SET`, `REORDER_IMAGE_SETS`, `ADD_IMAGE`, `UPDATE_IMAGE`, `REMOVE_IMAGE`, `REORDER_IMAGES`, `ADD_TRACK_GROUP`, `UPDATE_TRACK_GROUP`, `REMOVE_TRACK_GROUP`, `REORDER_TRACK_GROUPS`, `ADD_TRACK`, `UPDATE_TRACK`, `REMOVE_TRACK`, `REORDER_TRACKS`, `UPDATE_STAGE_CHROME`.

Runtime commands: `SHOW_PLATE` (looks up image in catalog, copies `{id,src,alt,name}`, sets `stageVisible: true`), `RETURN_TO_MAP` (`stageVisible: false`, leave `activeImage` as last plate for preview), `PLAY_TRACK`, `PAUSE`, `RESUME`, `RESTART` (status playing; engine seeks), `STOP`, `SET_VOLUME`, `SET_DUCKED`, `FIRE_SFX`.

- [ ] **Step 1: Tests**

```ts
it('SHOW_PLATE copies player-safe fields only', () => {
  const catalog = catalogWithPlate();
  const next = applyRuntimeCommand(emptySessionConsoleRuntime(), {
    type: 'SHOW_PLATE',
    imageId: 'session-3-05',
  }, catalog);
  expect(next.stageVisible).toBe(true);
  expect(next.activeImage).toEqual({
    id: 'session-3-05',
    src: 'file://plate.webp',
    alt: 'The statue opening',
    name: 'The statue opens',
  });
  expect(JSON.stringify(next)).not.toMatch(/cue|recommended/i);
});

it('RETURN_TO_MAP hides stage and does not stop audio', () => {
  const playing = { ...runtimePlaying(), stageVisible: true };
  const next = applyRuntimeCommand(playing, { type: 'RETURN_TO_MAP' }, catalog);
  expect(next.stageVisible).toBe(false);
  expect(next.audio.status).toBe('playing');
});

it('PLAY_TRACK does not change activeImage', () => {
  const withPlate = applyRuntimeCommand(empty, { type: 'SHOW_PLATE', imageId: 'a' }, catalog);
  const next = applyRuntimeCommand(withPlate, { type: 'PLAY_TRACK', trackId: 't1' }, catalog);
  expect(next.activeImage?.id).toBe('a');
  expect(next.audio.trackId).toBe('t1');
  expect(next.audio.status).toBe('playing');
});

it('FIRE_SFX increments seq', () => {
  const next = applyRuntimeCommand(empty, { type: 'FIRE_SFX', sfxId: 'chime' }, catalog);
  expect(next.sfxSeq).toBe(1);
  expect(next.sfxId).toBe('chime');
});
```

Unknown ids are no-ops (return previous reference).

- [ ] **Step 2: Implement reducers**

- [ ] **Step 3: Tests pass + commit** `feat: add session console catalog and runtime reducers`

---

### Task 3: Wire Zustand + legacy migration

**Files:**
- Modify: `src/store/gameStore.ts`
- Modify: `src/store/gameStore.test.ts`
- Modify: `electron/main.ts` `migrateLegacyCampaign` if it constructs `Campaign`

**Interfaces:**
- Produces store actions that call the reducers:

```ts
sessionConsole: SessionConsoleCatalog;
sessionConsoleRuntime: SessionConsoleRuntime;
updateSessionConsole: (action: SessionConsoleCatalogAction) => void;
dispatchSessionConsole: (command: SessionConsoleRuntimeCommand) => void;
setSessionConsoleWorldArmed: (armed: boolean) => void;
```

`loadCampaign` / `setCampaign` must call `ensureSessionConsole(campaign)` so missing catalogs are filled without wiping maps.

- [ ] **Step 1: Tests** — new campaign has empty catalog + seeded SFX; `dispatchSessionConsole({type:'SHOW_PLATE'})` updates runtime immutably; loading a campaign JSON without `sessionConsole` migrates.

- [ ] **Step 2: Implement** — do not put catalog on the active-map proxy. Runtime is top-level game state like `isGamePaused` but *is* synced (pause is a separate IPC).

- [ ] **Step 3: Commit** `feat: persist session console catalog on the campaign`

---

### Task 4: Asset rewrite + local audio ingest

**Files:**
- Modify: `src/utils/campaignAssets.ts`, `src/utils/campaignAssets.test.ts`
- Create: `src/utils/localAudioAsset.ts`, `src/utils/localAudioAsset.test.ts`
- Modify: `src/services/WebStorageService.ts` only if rewrite coverage is not enough (it already calls `rewriteCampaignAssetSrcs`)

**Interfaces:**
- Produces: `isAllowedAudioFileName(name: string): boolean`, `saveLocalAudioFile(file: File): Promise<string>` (uses `getStorage().saveAssetTemp`)

- [ ] **Step 1: Tests**

`rewriteCampaignAssetSrcs` visits every `image.src`, `track.src` when `source === 'local'`, and local SFX `src`. YouTube tracks are not rewritten.

`isAllowedAudioFileName` accepts `bed.mp3`, rejects `bed.exe`, `bed.webp`.

- [ ] **Step 2: Implement walk** of `campaign.sessionConsole` inside `rewriteCampaignAssetSrcs`. Extend `CampaignAssetHost` with an optional `sessionConsole` shape.

- [ ] **Step 3: Commit** `feat: include session console assets in campaign zip rewrite`

---

### Task 5: Sync slice

**Files:**
- Modify: `src/utils/syncUtils.ts`, `src/utils/syncUtils.test.ts`
- Modify: `src/components/SyncManager.tsx`
- Modify: `docs/architecture/IPC_API.md`

**Interfaces:**
- Add `sessionConsoleRuntime: SessionConsoleRuntime` to `SyncableGameState`
- Actions: `STAGE_UPDATE`, `AUDIO_UPDATE`, `SFX_FIRE` (payloads = relevant runtime fields)
- `cloneSyncableStateFromGame` / `FromPayload` / `isSyncSliceUnchanged` / `detectChanges` / `applyAction` all updated
- World apply path: `set` runtime from payload (do not run catalog reducers on World)

Optional World → Architect: reuse `SYNC_FROM_WORLD_VIEW` only if we can do it without loosening the token-xy sanitizer. Prefer a dedicated send channel `SESSION_CONSOLE_WORLD_EVENT` (whitelist in preload + relay in `main.ts`) with payload `{ type: 'armed' | 'unarmed' | 'ready' | 'error', message?: string }`. Architect sets `worldArmed` / toast.

- [ ] **Step 1: Unit tests** — detect plate change emits `STAGE_UPDATE`; play emits `AUDIO_UPDATE`; `RETURN_TO_MAP` does not emit audio stop; `FULL_SYNC` includes runtime; applying `STAGE_UPDATE` on a consumer store does not require catalog.

- [ ] **Step 2: Implement + update IPC_API.md** under State Synchronization with the new action table.

- [ ] **Step 3: Commit** `feat: sync session console runtime to World View`

---

### Task 6: Production origin for YouTube (Error 153)

**Files:**
- Modify: `electron/main.ts`
- Test: `tests/electron/startup.electron.spec.ts` (window still loads) and a small unit test if scheme registration is extractable

**Requirement:** Production must not load Architect/World via `file://` if we expect YouTube. Register a privileged scheme before `app.ready`:

```ts
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { bypassCSP: true, supportFetchAPI: true, stream: true } },
  {
    scheme: 'graphium',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);
```

After ready, `protocol.handle('graphium', ...)` serves files from `RENDERER_DIST` (path-traversal safe, same sandbox spirit as `media://`). Load:

```ts
void mainWindow.loadURL('graphium://app/index.html');
void worldWindow.loadURL('graphium://app/index.html?type=world');
```

Dev keeps `VITE_DEV_SERVER_URL`.

Pass `origin: location.origin` into the YouTube player vars (will be `graphium://app` or `http://localhost:5173`).

If `media://` audio has no MIME, map extensions in the existing `media` handler (`audio/mpeg`, `audio/ogg`, `audio/wav`, `audio/mp4`).

- [ ] **Step 1: Electron startup test still launches both windows**
- [ ] **Step 2: Implement scheme + MIME**
- [ ] **Step 3: Commit** `fix: serve renderer from graphium:// so YouTube embeds work`

---

### Task 7: World audio engine + Stage overlay

**Files:**
- Create: `src/components/SessionConsole/WorldAudioEngine.tsx`
- Create: `src/components/SessionConsole/WorldStage.tsx`
- Modify: `src/App.tsx` — `{isWorldView && <WorldStage />}` next to `LoadingOverlay`

**Behavior (port from the prototype, Graphium-styled):**

- `WorldStage` reads `sessionConsoleRuntime` + `campaign.sessionConsole.stage` chrome.
- If `!worldArmed`, show arm gate. Loading the IFrame API enables the button. Arm = muted play of a known public video or silent local tick, then pause — same as prototype `armStage`.
- If `stageVisible && activeImage`, show the plate with fade + optional frame. Convert `file://` → `media://`.
- If `!stageVisible`, render `null` for the art layer but **keep `WorldAudioEngine` mounted**.
- Engine subscribes to runtime: play/pause/resume/restart/stop/volume/duck/sfxSeq.
- YouTube: load `https://www.youtube.com/iframe_api` only in World View, only after arm path starts (or on mount if online). On error 101/150/153, report `SESSION_CONSOLE_WORLD_EVENT` `{ type: 'error', message }` and Architect toasts a sanitized message plus “copy links”.
- Local: `<audio>` + `toMediaProtocol`.
- Synth: copy the four oscillators + test-tone chord from the prototype (`Soundboard.html` `playStageSfx` / `playStageTestTone`).
- `prefers-reduced-motion`: skip fades.

- [ ] **Step 1: Component tests with React Testing Library** — Stage hidden when `stageVisible` is false; arm button present when unarmed; image `alt` comes from runtime; pause overlay still exists independently (do not re-test pause internals).
- [ ] **Step 2: Implement**
- [ ] **Step 3: Commit** `feat: add World View stage overlay and audio engine`

---

### Task 8: Architect Session Console UI

**Files:**
- Create the `src/components/SessionConsole/*` Architect components listed above
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/utils/commandRegistry.ts`
- Modify: `src/App.tsx` only if a top-level shortcut listener is cleaner than Sidebar

**UI rules:**

- Master bar + Discord disclosure at top of the sidebar section.
- Image board and track groups under it. Empty state: “Add a plate or a track to start the board.”
- Editor sheet: image (file → `processImage(..., 'MAP')` + `ADD_IMAGE`) or track (URL → `parseYouTubeVideoId` or file → `saveLocalAudioFile`).
- Show recommended plate as brass DM text on the track row. Clicking the track does not show it.
- Keyboard in Architect when target is not `INPUT`/`TEXTAREA`: `1`–`9` click the flattened track list, `d` ducks, `Escape` stops. Do not steal keys when the command palette is open.
- Status dot: World closed / connected / armed (from `worldArmed` + whether World has requested state).

- [ ] **Step 1: RTL tests** — clicking a plate calls `SHOW_PLATE`; clicking a track calls `PLAY_TRACK` without changing the plate; Return to map keeps `audio.status`; invalid YouTube paste shows a toast and does not add a track.
- [ ] **Step 2: Implement**
- [ ] **Step 3: Commit** `feat: add Architect session console editor and transport`

---

### Task 9: Fallback, commands, docs, campaign workflow test

**Files:**
- Copy-all helper: `tracks` with `source === 'youtube'` become `N. Title — https://www.youtube.com/watch?v=ID`. Local-only tracks listed as `(local file)` so the fallback still has an index.
- Commands: `session-console-stop`, `session-console-duck`, `session-console-return-to-map`, `session-console-test-tone`
- Docs: `docs/context/CONTEXT.md` (add Session Console under implemented features; keep chat/voice not-planned), `docs/index.md`, `docs/guides/TROUBLESHOOTING.md` (Error 153, Discord Krisp, arm audio)
- Test: `tests/functional` or a focused store/sync integration that: create catalog → show plate → play youtube track → return to map → assert runtime; plus `rewriteCampaignAssetSrcs` round-trip

- [ ] **Step 1: Tests for copy-all formatting and command registry entries**
- [ ] **Step 2: Docs**
- [ ] **Step 3: Commit** `docs: document session console sync, setup, and fallbacks`

---

### Task 10: Manual / Electron verification (required before merge)

Cannot be fully replaced by RTL. After Tasks 1–9:

1. Dev: Architect + World on localhost. Arm. Test tone. YouTube bed. Local mp3. Plate fade. Return to map with music still going. Duck. Stop. Pause overlay covers a visible plate.
2. Production-like: `loadURL('graphium://...')` path — play a YouTube id that embeds (Bardify / Ghelfi public ambience). Confirm no Error 153.
3. Save / load `.graphium` — plates and local audio survive; YouTube ids survive without being fetched at save time.
4. Web two-tab: BroadcastChannel carries Stage + audio commands.
5. Spoiler check: World DOM has no cue strings from hidden plates.

If YouTube is blocked in CI, keep CI on parser + reducers + sync + Stage render with mocked engine.

---

## Out of scope (do not implement in this plan)

- Architect headphone preview
- Import from Ash Crown HTML
- Layered / simultaneous beds
- Custom keybinding UI
- Auto-switching plates with tracks
- New npm audio frameworks

## Execution note

Tasks 1–5 are the spine and can merge as a dark feature (no Sidebar entry) if needed. Tasks 6–8 are the user-visible feature. Task 6 is the YouTube production blocker — do not advertise YouTube in the UI if the `graphium://` load path is not in.

After the plan is approved for implementation, use subagent-driven development (one task per subagent + review) or execute inline in this branch.
