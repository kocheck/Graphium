---
name: Deep Codebase Improvement Pass
overview: 'Evidence-based improvement pass on Graphium: make the two red CI workflows green, harden the Electron main-process IPC/protocol surface, remove `any` from the sync hot path, and clean up committed artifacts. Findings come from running tsc/eslint/vitest locally and reading the failing CI logs for the latest `main` push.'
todos:
  - id: branch
    content: Fetch origin/main and create branch cursor/deep-improve-8ba8 from it
    status: pending
  - id: ci-playwright-vitest
    content: 'Tier 1: separate vitest specs from Playwright (testIgnore + vitest include for tests/unit, tests/integration); make those tests pass'
    status: pending
  - id: ci-electron-launch
    content: 'Tier 1: add tests/helpers/launchElectron.ts with CI --no-sandbox args, use it in tests/electron/*; run Electron job under xvfb-run and skip electron-builder in e2e.yml'
    status: pending
  - id: lint-zero
    content: 'Tier 1: drive eslint to 0 warnings (remove diagnose-dungeon.ts, add DEV-gated debugLog util, return types, ??, dead exports)'
    status: pending
  - id: main-path-security
    content: 'Tier 2: restrict media:// handler to userData roots; sanitize SAVE_ASSET_TEMP name, DELETE_LIBRARY_ASSET id, processAsset paths; extract electron/pathSecurity.ts with unit tests'
    status: pending
  - id: session-cleanup
    content: 'Tier 2: clean stale sessions/ and temp_assets/ on before-quit; update electron/README.md note'
    status: pending
  - id: sync-types
    content: 'Tier 3: remove any from SyncManager.tsx using SyncableGameState/GameState; reuse detectChanges for World->Architect diff'
    status: pending
  - id: ipc-types
    content: 'Tier 3: add src/types/ipc.ts channel/payload types, type window.ipcRenderer, remove @ts-expect-error workarounds'
    status: pending
  - id: store-selectors
    content: 'Tier 3: use selectors in Toast.tsx and ConfirmDialog.tsx'
    status: pending
  - id: hygiene
    content: 'Tier 4: git rm coverage/ + ignore, remove .github/ISSUES dump, drop unused deps fs-extra/wait-on, fix one-way-sync docs mismatch'
    status: pending
  - id: verify-pr
    content: Run type-check/lint/tests/format after each tier; commit per tier; push and open PR
    status: pending
isProject: false
---

# Deep Codebase Improvement Pass

## What I found

Local checkout is stale (`9979e63`); `origin/main` is at `22b0768` (PR #255, merged today). All work below targets `origin/main`, which already fixed some things I first spotted locally (fog debug logging is gated behind `fogLog`, preload now has channel allow-lists).

Baseline on `main`:

- `tsc --noEmit`: clean.
- `vitest run`: 39 files / 792 tests pass.
- `prettier --check`: clean.
- **Lint & Type Check workflow: red on every push to `main`** — `eslint --max-warnings 0` reports 993 warnings (0 errors). Top rules: `explicit-function-return-type` (229), `no-console` (167), `no-unsafe-member-access` (106), `no-non-null-assertion` (97), `import/no-unused-modules` (78), `prefer-nullish-coalescing` (73).
- **E2E workflow: red on every push to `main`**, for two independent reasons:
  - Web shards: `TypeError: Cannot redefine property: Symbol($$jest-matchers-object)`. Cause: `tests/unit/touchSettingsStore.spec.ts` and `tests/integration/touch-settings-integration.spec.ts` are **vitest** tests but match Playwright's `testMatch: /.*\.spec\.ts/` in `playwright.config.ts`. Meanwhile `vitest.config.ts` only includes `src/**`, so the three files in `tests/unit/` never run anywhere.
  - Electron job: `FATAL:setuid_sandbox_host.cc ... chrome-sandbox is owned by root and has mode 4755`. Cause: every test in `tests/electron/*.electron.spec.ts` calls `electron.launch({ args: ['./dist-electron/main.js'] })` directly, bypassing the `--no-sandbox` args defined in `playwright.config.ts`. Also no `xvfb-run`.
- Security gaps in `electron/main.ts` (still present on `origin/main`):
  - `protocol.handle('media', ...)` does `net.fetch('file://' + request.url.slice(...))` with no path check — any `media://` URL reads any file on disk, contradicting the comment "no directory traversal".
  - `SAVE_ASSET_TEMP` builds `path.join(tempDir, `${Date.now()}-${name}`)` with renderer-supplied `name` (traversal via `../`).
  - `DELETE_LIBRARY_ASSET` unlinks `${assetId}.webp` with unvalidated `assetId`.
  - `serializeCampaignToZip.processAsset` reads any `file://` path present in state into the campaign ZIP; should be restricted to `userData`.
  - Each `LOAD_CAMPAIGN` creates `userData/sessions/<timestamp>/` and nothing ever cleans them (also noted as a TODO in `electron/README.md`).
- Committed artifacts: `coverage/.tmp/*.json` (29 files), `diagnose-dungeon.ts` (scratch script, included in `tsconfig.json`, 55 lint warnings), `.github/ISSUES/WORKFLOW_FAILURE_*.md` (stale failure dump describing a different, since-fixed error).
- Type safety in the sync path: `src/components/SyncManager.tsx` has 14 `any`s (prev-state refs, `detectWorldViewChanges`, `GRID_UPDATE` cast) even though `SyncableGameState`/`SyncAction` exist in `src/utils/syncUtils.ts`. `src/vite-env.d.ts` types `window.ipcRenderer` with `any` everywhere; `ElectronStorageService.ts` and `PauseManager.tsx` paper over it with `@ts-expect-error`.
- Perf nits: `Toast.tsx` and `ConfirmDialog.tsx` call `useGameStore()` with no selector, so both re-render on every store change (including 60fps token drags).
- Dependency hygiene: `fs-extra` and `wait-on` are declared but never imported.
- Docs mismatch: `.cursorrules` / `main.ts` doc comments say World View "NEVER modifies state", but `SyncManager` implements bidirectional `SYNC_FROM_WORLD_VIEW`.

## Plan (prioritized tiers; each tier is its own commit)

### Tier 1 — Make CI green

1. **Fix Playwright/vitest overlap** in [playwright.config.ts](playwright.config.ts): add `testIgnore: [/.*\.electron\.spec\.ts/, /tests\/unit\//, /tests\/integration\//]` to `Web-Chromium`. In [vitest.config.ts](vitest.config.ts): extend `include` to `['src/**/*.{test,spec}.*', 'tests/unit/**/*.{test,spec}.*', 'tests/integration/**/*.{test,spec}.*']` and run them; fix anything that fails now that they actually execute.
2. **Fix Electron launch in CI**: add `tests/helpers/launchElectron.ts` that wraps `_electron.launch` with `args: ['./dist-electron/main.js', ...(process.env.CI ? ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu'] : [])]`, and replace the ~25 inline `electron.launch({ args: [...] })` calls in `tests/electron/*.electron.spec.ts`. In [.github/workflows/e2e.yml](.github/workflows/e2e.yml) run the Electron step under `xvfb-run -a` and skip the `electron-builder` packaging step (`npm run build` invokes it and needs `GH_TOKEN`) by using `tsc && vite build` only.
3. **Get lint to zero warnings** without weakening the ruleset: remove `diagnose-dungeon.ts` (55), add a small `src/utils/logger.ts` (`debugLog` gated on `import.meta.env.DEV`) and route the remaining `console.log` calls in `FogOfWarLayer.tsx`, `CanvasManager.tsx`, `WebStorageService.ts`, `errorBoundaryUtils.ts`, `storage.ts`, `DoorLayer/DoorShape.tsx`, `AutoSaveManager.tsx`, `App.tsx` through it (167); add explicit return types (229, mechanical); replace `!` with guards where cheap and `||` with `??` where types are nullable (auto-fixable set); fix `import/no-unused-modules` by deleting dead exports or marking intentional ones. Remaining `no-unsafe-*` warnings are concentrated in `SyncManager.tsx`/`ResourceMonitor.tsx`/`ImageCropper.tsx` and are resolved by Tier 3. Verify with `npm run lint` (`--max-warnings 0`).

### Tier 2 — Harden `electron/main.ts`

4. Add an `isPathInside(base, target)` helper and an `ALLOWED_MEDIA_ROOTS = [userData/temp_assets, userData/sessions, userData/library]` list. In the `media://` handler: `fileURLToPath`/decode, resolve, reject with 403 if outside allowed roots.
5. `SAVE_ASSET_TEMP`: `path.basename(name)` plus a filename whitelist regex; `DELETE_LIBRARY_ASSET`: validate `assetId` against a UUID regex before building paths; `processAsset` in `serializeCampaignToZip`: skip any `file://` path not inside `userData`.
6. Session cleanup: on `app.on('before-quit')` remove `sessions/*` and `temp_assets/*` older than the current session (keep the active campaign's session dir). Update the "Cleanup note" in `electron/README.md`.
7. Add vitest unit tests for the pure helpers (`isPathInside`, filename/UUID validators) by extracting them to `electron/pathSecurity.ts`.

### Tier 3 — Type the sync path and IPC surface

8. In [src/components/SyncManager.tsx](src/components/SyncManager.tsx): type `prevStateRef`/`worldViewPrevStateRef` as `SyncableGameState | null`, type `detectWorldViewChanges`/`handleWorldViewUpdate`/`handleStoreUpdate` parameters with `GameState`/`SyncableGameState`, replace `setState(action.payload as any)` for `GRID_UPDATE` with a typed `Pick<GameState,'gridSize'|'gridType'>`. Reuse `detectChanges` from `syncUtils` for the World→Architect diff instead of the hand-rolled loop.
9. Create `src/types/ipc.ts` with the channel-name unions already present in `electron/preload.ts` (`ALLOWED_SEND_CHANNELS`, `ALLOWED_INVOKE_CHANNELS`) plus payload/result types per channel; make `window.ipcRenderer` in [src/vite-env.d.ts](src/vite-env.d.ts) generic over those, and delete the `@ts-expect-error` workarounds in `ElectronStorageService.ts`, `PauseManager.tsx`, `SyncManager.tsx` (`graphiumSync` becomes a declared global).
10. Fix whole-store subscriptions: `Toast.tsx` -> `useGameStore((s) => s.toast)` / `useGameStore((s) => s.clearToast)`; same for `ConfirmDialog.tsx`.

### Tier 4 — Repo hygiene

11. `git rm -r coverage/` and add `coverage/` to [.gitignore](.gitignore); `git rm .github/ISSUES/WORKFLOW_FAILURE_*.md`; drop `diagnose-dungeon.ts` from `tsconfig.json` `include`.
12. Remove unused deps `fs-extra`, `@types/fs-extra`, `wait-on` from [package.json](package.json) (verified zero imports in `src/`, `electron/`, `tests/`, configs).
13. Fix the doc mismatch: update `.cursorrules` ("one-way sync") and the `createWorldWindow` doc comment in `main.ts` to describe the actual bidirectional token-position sync.

## Execution notes

- Start with `git fetch origin main && git checkout -b cursor/deep-improve-8ba8 origin/main`.
- After each tier: `npm run type-check && npm run lint && npm run test:run && npm run format:check`; commit and push; open/update the PR.
- Tier 1 items 1–2 can only be fully verified in CI (Electron launch under xvfb); I will verify locally that `npx playwright test --project=Web-Chromium --list` no longer lists the vitest files and that `tests/unit/*` run under vitest.
- Out of scope (suggest as follow-ups, not doing now): splitting the 1.8k-line `CanvasManager.tsx`/`HomeScreen.tsx`, ESLint 8 -> 9 flat-config migration, consolidating the 13 root-level `*.md` files into `docs/`.
