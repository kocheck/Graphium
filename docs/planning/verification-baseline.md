# Verification baseline

Recorded by plan 000 Step 1 on `plan/000-verification-infrastructure`, grounded at `d3d3642`.

## Before

Commands run after `npm install && npx playwright install chromium`.

| Command                                                                                                                                                                                    | Exit | Last line                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------ |
| `npm run lint:strict`                                                                                                                                                                      | 0    | `(eslint produced no output)`                                                                    |
| `npm run type-check`                                                                                                                                                                       | 0    | `> tsc --noEmit`                                                                                 |
| `npm run test:run`                                                                                                                                                                         | 0    | `Duration  15.43s (transform 2.15s, setup 3.13s, import 6.11s, tests 6.99s, environment 21.97s)` |
| `npx prettier --check "**/*.{ts,tsx,js,jsx,json,md,css}"`                                                                                                                                  | 0    | `All matched files use Prettier code style!`                                                     |
| `CI=1 npx playwright test --project=Web-Chromium --list \| tail -1`                                                                                                                        | 0    | `Total: 13 tests in 2 files`                                                                     |
| `CI=1 npx playwright test --project=Electron-App --list \| tail -1`                                                                                                                        | 0    | `Total: 7 tests in 2 files`                                                                      |
| `grep -rnoE '\b(bg\|text\|border\|ring)-(white\|black\|slate\|gray\|zinc\|neutral\|blue\|red\|green\|amber\|orange\|yellow\|purple\|indigo)(-[0-9]{2,3})?\b' src --include=*.tsx \| wc -l` | 0    | `400`                                                                                            |
| `grep -rn "style={{" --include=*.tsx src \| wc -l`                                                                                                                                         | 0    | `286`                                                                                            |
| `grep -rhoE 'data-testid="[^"]+"' src/ \| sort -u \| wc -l`                                                                                                                                | 0    | `22`                                                                                             |

`npm run test:run` also printed `Test Files  78 passed (78)` / `Tests  1129 passed (1129)`.

`ls tests/functional tests/performance tests/electron tests/*.spec.ts`:

```
tests/accessibility.spec.ts
tests/visual.spec.ts

tests/electron:
ipc.electron.spec.ts
startup.electron.spec.ts

tests/functional:
campaign-workflow.spec.ts
data-integrity.spec.ts
dm-world-sync.spec.ts
door-sync.spec.ts
error-boundary-debugging.spec.ts
error-handling.spec.ts
map-management.spec.ts
state-persistence.spec.ts
token-library.spec.ts
token-management.spec.ts
touch-interactions.spec.ts

tests/performance:
drawing-performance.spec.ts
```

## Palette-class regex

```bash
grep -rnoE '\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange|yellow|purple|indigo)(-[0-9]{2,3})?\b' src --include=*.tsx | wc -l
```

Count at `d3d3642` / before plan 000: `400`.

## Deleted tests

Replaced by the 14-scan surface × theme matrix in `tests/accessibility.spec.ts` (plan 000 Step 4):

- `System theme syncs with OS preference`
- `Specific contrast checks - primary text on background`
- `should send TOKEN_DRAG_START when drag begins` — Error: Token X position should have changed after drag
- `should sync multiple tokens during drag` — Error: First token should have moved
- `should sync drawing creation between windows` — Error: Drawing should be created
- `should throttle TOKEN_DRAG_MOVE messages to ~60fps` — Error: Rapid drag should complete in reasonable time
- `should maintain state consistency after pointer event migration` — Error: Token should have moved

## Accessibility triage

| surface        | theme | rule                 | selector                                                                      | ratio                         | disposition                   |
| -------------- | ----- | -------------------- | ----------------------------------------------------------------------------- | ----------------------------- | ----------------------------- |
| editor         | light | aria-prohibited-attr | `[data-testid="session-console-status"]`                                      | n/a                           | (a) fixed: added `role="img"` |
| editor         | dark  | aria-prohibited-attr | `[data-testid="session-console-status"]`                                      | n/a                           | (a) fixed: added `role="img"` |
| confirm-dialog | light | aria-prohibited-attr | `[data-testid="session-console-status"]`                                      | n/a                           | (a) fixed: added `role="img"` |
| confirm-dialog | dark  | aria-prohibited-attr | `[data-testid="session-console-status"]`                                      | n/a                           | (a) fixed: added `role="img"` |
| editor-mobile  | dark  | color-contrast       | `.flex-col.justify-center.py-2:nth-child(1) > span` (mobile toolbar "Select") | 2.89 (`#0070c1` on `#0d2847`) | (b) deferred to plan 006      |

## Deleted specs

Evidence (`needs` / `missing` test ids vs `src/`):

```
tests/functional/campaign-workflow.spec.ts needs=20 missing=18
tests/functional/data-integrity.spec.ts needs=24 missing=23
tests/functional/dm-world-sync.spec.ts needs=0 missing=0
tests/functional/door-sync.spec.ts needs=0 missing=0
tests/functional/error-boundary-debugging.spec.ts needs=4 missing=4
tests/functional/error-handling.spec.ts needs=28 missing=27
tests/functional/map-management.spec.ts needs=30 missing=30
tests/functional/overlays.spec.ts needs=13 missing=0
tests/functional/state-persistence.spec.ts needs=12 missing=11
tests/functional/token-library.spec.ts needs=30 missing=30
tests/functional/token-management.spec.ts needs=23 missing=23
tests/functional/touch-interactions.spec.ts needs=8 missing=8
tests/performance/drawing-performance.spec.ts needs=2 missing=2
```

Lost coverage (one line per deleted file):

- `campaign-workflow.spec.ts` — campaign name edit, export/import cycle, empty-map state, multi-map navigation, campaign delete, and campaign-name edge cases. The one live test (new campaign opens the editor) is covered by `editor-smoke.spec.ts`.
- `data-integrity.spec.ts` — IndexedDB/campaign payload integrity after save and reload.
- `error-boundary-debugging.spec.ts` — error-boundary fallback UI and report-flow test ids.
- `error-handling.spec.ts` — upload/save/load failure toasts and recovery paths.
- `map-management.spec.ts` — create/edit/delete/reorder maps and map settings fields.
- `state-persistence.spec.ts` — theme, tool, and viewport persistence across reload.
- `token-library.spec.ts` — library CRUD, metadata editor, and add-to-library flow.
- `token-management.spec.ts` — place, select, transform, and delete tokens from the editor chrome.
- `touch-interactions.spec.ts` — touch/pen gestures on the canvas and mobile chrome.
- `drawing-performance.spec.ts` — drawing-stroke frame-time assertions.

## Overlay contract

Unreachable from a fresh campaign (`open: null`): MobileBottomSheet, AddToLibraryDialog, TokenMetadataEditor, ImageCropper, SessionConsoleEditorSheet.

No `trapsFocus` flips: AboutModal is the only overlay that traps focus; every other exercised row matches the source-read `trapsFocus: false`.
