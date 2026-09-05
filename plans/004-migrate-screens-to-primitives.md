# Plan 004: Migrate every screen onto the primitive layer

> **Executor instructions**: Read `plans/CONVENTIONS.md` first. Run the pre-flight (§3), then the
> Drift check below. Follow the steps in order; each step's **Check** must hold before the next.
> If any **If it fails** or STOP condition fires, follow CONVENTIONS §10. Finish with the report
> in §11.

## Status

- **Priority**: P1
- **Effort**: XL (23 commits across six sequential PRs; the two largest files are 858 and 634 lines)
- **Risk**: HIGH
- **Depends on**: plans/000-repair-verification-infrastructure.md, plans/003-build-primitive-layer.md
- **Category**: migration
- **Requires**: `scripts/preflight.sh`; `src/components/ui/README.md`;
  `src/components/ui/{button,dialog,sheet,tooltip,switch,label,input,collapsible,tabs,separator}.tsx`;
  `src/lib/utils.ts`; `tests/helpers/surfaces.ts`; `tests/shots.spec.ts`; `tests/visual.spec.ts`
  with committed snapshots; `tests/functional/overlays.spec.ts`; `tests/touch-targets.spec.ts`;
  `tests/pause-button.spec.ts`; `src/styles/palette-classes.test.ts`;
  `docs/planning/verification-baseline.md`; `docs/guides/UI_RECIPES.md`
- **Grounded at**: ‹merge SHA of plan 003, written there by its final step› (citations verified
  at d3d3642)

## Drift check

```bash
git fetch origin main
G=$(grep -oE 'Grounded at\*\*: `[0-9a-f]{7,40}' plans/004-migrate-screens-to-primitives.md | grep -oE '[0-9a-f]{7,40}$')
git diff --stat "$G"..origin/main -- src/ tests/ scripts/ .eslintrc.cjs docs/guides/UI_RECIPES.md   # Expected: empty
```

Plan 006a may merge between plan 003 and this plan; it touches only `docs/planning/`, which is
why the paths above exclude it. For PR 2–6 of this plan, `<grounded-at>` is the merge SHA of the
previous PR, recorded under **Handoff** in `plans/reports/004-pr<k-1>.md`.

**Citation re-check** (line numbers are hints at d3d3642; the grep is authoritative):

| Anchor (grep)                                                                             | File                                 | Expected hits  |
| ----------------------------------------------------------------------------------------- | ------------------------------------ | -------------- |
| `grep -n 'className="toolbar' src/App.tsx`                                                | `src/App.tsx`                        | 1 (line 556)   |
| `grep -n "e.key === 'Escape' && is" src/App.tsx`                                          | `src/App.tsx`                        | 2 (271, 277)   |
| `grep -n "e.key === 'Enter'" src/components/ConfirmDialog.tsx`                            | `src/components/ConfirmDialog.tsx`   | 1 (line 49)    |
| `grep -rc 'data-esc-owns="true"' src/components --include=*.tsx \| grep -v ':0' \| wc -l` | `src/components/**`                  | 8 (see cards)  |
| `grep -c 'data-esc-owns' src/components/ui/dialog.tsx src/components/ui/sheet.tsx`        | primitives                           | ≥ 1 each       |
| `grep -c 'paused' src/components/ui/button.tsx`                                           | `src/components/ui/button.tsx`       | ≥ 1            |
| `grep -rlE 'data-testid="(dialog\|sheet)-[a-z-]+-root"' src/components \| wc -l`          | `src/components/**`                  | 13             |
| `grep -n 'const BASELINE' src/styles/palette-classes.test.ts`                             | `src/styles/palette-classes.test.ts` | 1              |
| `grep -n 'showCloseButton' src/components/ui/dialog.tsx`                                  | `src/components/ui/dialog.tsx`       | see rule below |
| `grep -n '"@/\*"' tsconfig.json`                                                          | `tsconfig.json`                      | 1              |

If any row differs: STOP.

**Dialog close-button rule** (decided once, here): if the `showCloseButton` row returned ≥ 1,
every `DialogContent` in this plan carries `showCloseButton={false}` and the component keeps its
own close button. If it returned 0, delete the `showCloseButton={false}` line from every code
block in Steps 3–9, delete the component's own close button (the primitive's X, accessible name
`Close`, replaces it), change test selectors that named the old button to
`screen.getByRole('button', { name: 'Close' })`, and record "primitive X button present" as an
expected difference in every dialog step.

## Why this matters

Plan 003 built the primitive layer; until screens use it, the app carries two component systems.
Thirteen components hand-roll a modal overlay and exactly one (`AboutModal.tsx`) has a focus trap;
five have no `role="dialog"`, no `aria-modal` and no Escape handling at all, including the DM's
own asset surfaces `LibraryManager.tsx` and `TokenMetadataEditor.tsx`. A keyboard or screen-reader
user can open one of those and lose focus into the canvas behind it. After this plan every overlay
is a consumer of one `Dialog` or `Sheet`, the `data-esc-owns` protocol comes from the primitive
instead of being re-typed per file, and the `.btn` class family in `src/styles/app.css` is deleted.

## Migration cards

One row per file. **Before** each step run `bash scripts/migration-card.sh <file>` and paste the
row into the PR report; **after** the step run it again. The after-row must show
`ui-imports≥1`, `role=0`, `aria-modal=0`, `Escape=0`, `esc-owns=0` (or `1` for a row whose
"after" column says `no`, because that row passes `ownsEscape={false}`), `palette=0`, `inline=0`
(a data-driven colour swatch may survive; the card says so), `btn=0`, `legacy=0`. The runtime
contract (role, aria-modal, Escape, focus trap, esc-owns in the DOM) is asserted by
`tests/functional/overlays.spec.ts`, not by the script.

Counts below were produced at d3d3642 by the script's own commands: `wc -l`,
`grep -c 'role="dialog"'`, `grep -c Escape`, `grep -c data-esc-owns`, `ls <file>.test.tsx`,
`grep -oE '<PALETTE>' <file> | wc -l` with
`PALETTE='\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange|yellow|purple|indigo)(-[0-9]{2,3})?\b'`,
and `grep -c 'style={{'`. Root test ids are the CONVENTIONS §8 names plan 000 added; read the
real value with `grep -o 'data-testid="[^"]*"' <file>` before relying on it.

### Overlays (13)

| File                                                            | Lines | Primitive               | Root testid                           | role/aria-modal today | Escape today      | esc-owns today → after            | Test                      | Palette | Inline | Mount quirk                                                                                  | PR  |
| --------------------------------------------------------------- | ----- | ----------------------- | ------------------------------------- | --------------------- | ----------------- | --------------------------------- | ------------------------- | ------- | ------ | -------------------------------------------------------------------------------------------- | --- |
| `src/components/AboutModal.tsx`                                 | 858   | `dialog` + `tabs`       | `dialog-about-root`                   | yes/yes               | in `App.tsx` only | 1 → yes                           | no                        | 1       | 40     | 212-line `modalStyles` literal; hand-rolled focus trap; `App.tsx` Escape branch              | 4   |
| `src/components/UpdateManager.tsx`                              | 634   | `dialog`                | `dialog-update-manager-root`          | yes/yes               | yes + `App.tsx`   | 1 → yes                           | yes                       | 4       | 21     | opened from AboutModal's "Check for Updates"; second Escape branch in `App.tsx`              | 4   |
| `src/components/DungeonGeneratorDialog.tsx`                     | 217   | `dialog`                | `dialog-dungeon-generator-root`       | yes/yes               | yes               | 1 → yes                           | yes                       | 4       | 6      | store-driven (`dungeonDialog`); `autoFocus` on Generate                                      | 4   |
| `src/components/ConfirmDialog.tsx`                              | 116   | `dialog`                | `dialog-confirm-root`                 | yes/yes               | yes (+ Enter)     | 1 → yes                           | no → new                  | 4       | 3      | store-driven; undefined `--app-bg/--app-border/--app-text`; renders in World View            | 1   |
| `src/components/MapSettingsSheet.tsx`                           | 461   | `sheet` `side="right"`  | `sheet-map-settings-root`             | no/no                 | no                | 0 → yes                           | no                        | 1       | 7      | calibration needs the canvas clickable: `modal={!isCalibrating}`; 6 `.btn`, 3 legacy classes | 2   |
| `src/components/AssetLibrary/AddToLibraryDialog.tsx`            | 297   | `dialog`                | `dialog-add-to-library-root`          | no/no                 | no                | 0 → yes                           | no                        | 27      | 1      | mounted by `Sidebar.tsx` and `LibraryManager.tsx`; `isMobile` → full height                  | 2   |
| `src/components/ImageCropper.tsx`                               | 271   | `dialog`                | `dialog-image-cropper-root`           | no/no                 | no                | 0 → yes                           | no → new                  | 11      | 0      | no `isOpen` prop; `CanvasManager.tsx` mount untouched; `react-easy-crop`                     | 2   |
| `src/components/SessionConsole/SessionConsoleEditorSheet.tsx`   | 298   | `sheet` `side="right"`  | `sheet-session-console-editor-root`   | yes/yes               | yes               | 1 → yes                           | no                        | 1       | 4      | 2 `.btn`, 3 `.sidebar-input`; uses `ToggleSwitch`                                            | 3   |
| `src/components/SessionConsole/SessionConsoleSettingsSheet.tsx` | 68    | `sheet` `side="right"`  | `sheet-session-console-settings-root` | yes/yes               | yes               | 1 → yes                           | no                        | 1       | 0      | —                                                                                            | 3   |
| `src/components/MobileSidebarDrawer.tsx`                        | 91    | `sheet` `side="left"`   | `sheet-mobile-sidebar-root`           | yes/yes               | yes               | 0 → **no** (`ownsEscape={false}`) | no                        | 1       | 0      | body scroll-lock effect → Radix does it                                                      | 3   |
| `src/components/MobileBottomSheet.tsx`                          | 107   | `sheet` `side="bottom"` | `sheet-mobile-bottom-root`            | yes/yes               | yes               | 0 → **no** (`ownsEscape={false}`) | no                        | 1       | 2      | `TokenInspector.tsx` mounts it with `isOpen` always true                                     | 3   |
| `src/components/AssetLibrary/LibraryManager.tsx`                | 442   | `dialog`                | `dialog-library-manager-root`         | no/no                 | no                | 0 → yes                           | no                        | 41      | 1      | nests `AddToLibraryDialog` and `TokenMetadataEditor` inside its content                      | 3   |
| `src/components/AssetLibrary/TokenMetadataEditor.tsx`           | 322   | `dialog`                | `dialog-token-metadata-root`          | no/no                 | no                | 0 → yes                           | yes (`closest('.fixed')`) | 51      | 1      | also mounted by `CommandPalette.tsx` (untouched)                                             | 3   |

Esc-owns re-attach sites today: **6** (`ConfirmDialog`, `AboutModal`, `UpdateManager`,
`DungeonGeneratorDialog`, `SessionConsoleEditorSheet`, `SessionConsoleSettingsSheet`); the other
two files carrying the attribute (`ErrorFallbackUI.tsx`, `UpdateErrorFallbackUI.tsx`) are excluded.
The five overlays with no attribute today gain it from the primitive default; the two mobile
sheets do not (CONVENTIONS §9).

### Adapters and toolbars (5)

| File                                                                 | Lines | Primitive              | Test                         | Palette                                       | Inline | Quirk                                                                           | PR  |
| -------------------------------------------------------------------- | ----- | ---------------------- | ---------------------------- | --------------------------------------------- | ------ | ------------------------------------------------------------------------------- | --- |
| `src/components/Tooltip.tsx`                                         | 95    | `tooltip`              | no                           | 5                                             | 1      | keep the `inline-flex` wrapper; `HomeScreen.tsx` passes `offset={20}` (4 sites) | 1   |
| `src/components/ToggleSwitch.tsx`                                    | 107   | `switch` + `label`     | no                           | 1                                             | 4      | `Math.random` id → `useId`                                                      | 1   |
| `src/components/CollapsibleSection.tsx`                              | 52    | `collapsible`          | no                           | 0                                             | 2      | —                                                                               | 1   |
| `src/components/MobileToolbar.tsx`                                   | 325   | `button`               | no                           | 1                                             | 14     | 10 × `min-h-[56px]` must survive; 1 colour swatch keeps `style`                 | 5   |
| `src/components/Toolbar.tsx` (new, from `src/App.tsx` lines 555–702) | ~150  | `button` + `separator` | `tests/pause-button.spec.ts` | 10 in `App.tsx` at d3d3642 (2 after plan 001) | 0      | keyboard handling stays in `App.tsx`                                            | 5   |

Adapter importers (`grep -rln "from '.*ToggleSwitch'" src --include=*.tsx | grep -v test` → 4;
same for `CollapsibleSection` → 1; `Tooltip` → 4): `MapSettingsSheet`, `SessionConsoleEditorSheet`,
`sessionConsoleSettingsSections`, the playground registry (`registry/legacy.tsx` after plan 003);
`Sidebar`; `App`, `HomeScreen`, `Sidebar`, `QuickTokenSidebar`. None needs an edit.

### `.btn` and legacy-class consumers not already covered above (9)

| File                                                               | `btn` hits | legacy hits         | Test                    | PR  |
| ------------------------------------------------------------------ | ---------- | ------------------- | ----------------------- | --- |
| `src/components/SessionConsole/SessionConsolePanel.tsx`            | 4          | 0                   | yes                     | 6   |
| `src/components/SessionConsole/TrackGroupList.tsx`                 | 1          | 0                   | no                      | 6   |
| `src/components/SessionConsole/sessionConsoleSettingsSections.tsx` | 3          | 2                   | no                      | 6   |
| `src/components/SessionConsole/SessionConsoleBoard.tsx`            | 3          | 1                   | no                      | 6   |
| `src/components/SessionConsole/ImageSetBoard.tsx`                  | 1          | 0                   | no                      | 6   |
| `src/components/SessionConsole/SessionConsoleMasterBar.tsx`        | 7          | 0                   | no                      | 6   |
| `src/components/Sidebar.tsx`                                       | 4          | 0                   | yes                     | 6   |
| `src/components/MapNavigator.tsx`                                  | 1          | 0                   | no                      | 6   |
| `src/components/DoorControls.tsx`                                  | 3          | 0                   | no                      | 6   |
| `src/components/QuickTokenSidebar.tsx`                             | 0          | 3 (`sidebar-token`) | yes (asserts the class) | 6   |

### Excluded rows

- `src/components/ErrorFallbackUI.tsx`, `src/components/UpdateErrorFallbackUI.tsx`: render when
  React has already failed; a portal-based primitive adds a failure mode to the last line of
  defence. Step 14 records this in `src/components/ui/README.md`.
- `src/components/AssetLibrary/CommandPalette.tsx`: out of scope for the program (CONVENTIONS §9).
- `src/components/HomeScreen.tsx`, `src/components/AboutModal.tsx` inline `<style>` blocks:
  `dismiss-btn`, `quick-action-btn`, `about-modal-close-btn` are different classes that contain
  the substring `btn`; they are not `.btn` consumers.
- Playground legacy examples (`ToggleSwitch`, `ConfirmDialog` via `showConfirmDialog`,
  `UpdateManager` in `src/components/DesignSystemPlayground/registry/legacy.tsx`, and
  `<ConfirmDialog />` mounted in `DesignSystemPlayground.tsx`): no change expected; they keep
  working through the adapters and `DesignSystemPlayground.test.tsx` must keep passing.

## `scripts/migration-card.sh`

Created in Step 0, exactly:

```bash
#!/usr/bin/env bash
# Prints one migration-card row (Markdown) for a component file.
# Usage: bash scripts/migration-card.sh src/components/ConfirmDialog.tsx
set -euo pipefail
f="${1:?usage: scripts/migration-card.sh <file.tsx>}"
PALETTE='\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange|yellow|purple|indigo)(-[0-9]{2,3})?\b'
count() { grep -cE "$1" "$f" || true; }
lines=$(wc -l < "$f" | tr -d ' ')
ui=$(count "from '@/components/ui/")
role=$(count 'role="dialog"')
modal=$(count 'aria-modal')
esc=$(count 'Escape')
owns=$(count 'data-esc-owns')
if [ -f "${f%.tsx}.test.tsx" ]; then test=yes; else test=no; fi
palette=$(grep -oE "$PALETTE" "$f" | wc -l | tr -d ' ')
inline=$(count 'style=\{\{')
btn=$(count '\bbtn\b')
legacy=$(count 'sidebar-input|sidebar-token|info-box')
testids=$(grep -oE 'data-testid="[^"]+"' "$f" | sort -u | tr '\n' ' ')
echo "| \`$f\` | lines=$lines | ui-imports=$ui | role=$role aria-modal=$modal | Escape=$esc | esc-owns=$owns | test=$test | palette=$palette | inline=$inline | btn=$btn legacy=$legacy | ${testids:-none} |"
```

## Shared procedures

Steps refer to these by letter. Each is a fixed sequence; do not vary it.

**(R) Ratchet** — after every step that changes a non-test `.tsx` under `src/`:

1. In `.eslintrc.cjs`, append each migrated file's path (repo-relative, quoted) to the `files`
   array of the override whose comment reads `plan 004 palette ratchet` (Step 1 creates it).
2. `npm run lint:strict` → exit 0. A hit names the line still carrying a palette class.
3. `COUNT=$(grep -rhoE '\b(bg|text|border|ring|divide|placeholder|outline|from|to|via|fill|stroke)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b|\b(bg|text|border)-(white|black)\b' src --include=*.tsx | wc -l); echo "$COUNT"`
   (the command in the header comment of `src/styles/palette-classes.test.ts`), then set
   `const BASELINE = <COUNT>;` in that file. Expected: `COUNT` ≤ the previous `BASELINE`.
4. `npx vitest run src/styles/palette-classes.test.ts` → `1 passed`.

The override added in Step 1, exactly (inside the existing `overrides: [` array, after the
config-files entry; `grep -n "overrides: \[" .eslintrc.cjs`):

```js
    // plan 004 palette ratchet: every file migrated onto the primitives is appended here and
    // may never regain a raw Tailwind palette class. Plan 006b extends it to the whole tree.
    {
      files: [],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector:
              'Literal[value=/\\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange|yellow|purple|indigo)(-[0-9]{2,3})?\\b/]',
            message: 'Hardcoded Tailwind palette class; use an --app-* token or a primitive.',
          },
          {
            selector:
              'TemplateElement[value.raw=/\\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange|yellow|purple|indigo)(-[0-9]{2,3})?\\b/]',
            message: 'Hardcoded Tailwind palette class; use an --app-* token or a primitive.',
          },
        ],
      },
    },
```

**(S) Screenshots** — where a step names it:

1. `SHOTS_OUT=docs/planning/screenshots/004-<step> npm run shots` → 14 files.
2. For each surface listed under the step's **Expected differences** only:
   `npx playwright test tests/visual.spec.ts --project=Web-Chromium --update-snapshots -g <surface>`
   and commit the updated files under `tests/visual.spec.ts-snapshots/`, listing them in the
   report (test titles contain the surface name: `npx playwright test tests/visual.spec.ts --list`).
3. `npm run verify:web` → exit 0. If `tests/visual.spec.ts` fails on any surface **not** listed:
   STOP, create `docs/planning/decisions/004-<component>-visual-delta.md` (CONVENTIONS §9) with
   the two screenshots' paths under Question.

**(O) Overlay row flip** — in `tests/functional/overlays.spec.ts`, in the row whose `name` is the
component being migrated: set every boolean that encodes today's missing behaviour (role/aria-modal,
Escape, focus trap) to `true`, set the esc-owns boolean to the card's "after" value, and leave
`open` and `root` unchanged (the root test id moves onto `DialogContent`/`SheetContent`). Then
`npx playwright test tests/functional/overlays.spec.ts --project=Web-Chromium` → passes.

**(I) Ideas** — append to `docs/planning/ui-redesign-ideas.md` under `## From plan 004`, a
`### <Component>` heading with bullets for every visual or IA improvement noticed and not made.
If the heading already exists, append below it. Never overwrite the file (plan 006a may own it).

**(P) PR boundary** — at the end of Steps 3, 4c, 6b, 9, 11 and 14:

1. Write `plans/reports/004-pr<k>.md` (CONVENTIONS §11; Numbers = every card row before/after and
   the ratchet counts; Screenshots = every `004-*` directory this PR added). Commit it with the
   step's commit.
2. `npm run verify` → exit 0. `git push -u origin <branch>`. Open the PR
   `Plan 004 (PR <k>/6): <title>` with the report as body. Set this plan's row in
   `plans/README.md` to `IN PROGRESS (PR <k>/6 open)`.
3. End the run. The next run (after merge) starts by writing the merge SHA under **Handoff** in
   `plans/reports/004-pr<k>.md`, creating the next branch from `origin/main`, and running the
   Drift check against that SHA. Merge method: merge commit (CONVENTIONS §7).

**Dialog recipe** — Step 3's `ConfirmDialog` is the pattern; every later overlay step lists only
its deltas. Rules that apply to all of them: keep every `data-testid` and every `aria-label`; the
root test id goes on `DialogContent`/`SheetContent`; delete the hand-rolled backdrop, the
`role`/`aria-modal`/`data-esc-owns` attributes and the Escape `useEffect` (the primitive supplies
all three); never pass `ref` to a primitive wrapper (React 18 does not forward it) — for initial
focus use `onOpenAutoFocus` with `e.currentTarget.querySelector(...)`; inside a `Button`, write
icon sizes as `size-N` instead of `w-N h-N` (the primitive's svg rule only exempts `size-*`);
keep `type="button"` where present; replace `w-N h-N` only inside `Button`; replace
`style={{ color: 'var(--x)' }}` with `text-[var(--x)]`, `backgroundColor` with `bg-[var(--x)]`,
`borderColor` with `border-[var(--x)]`, `marginBottom: '1.5rem'` with `mb-6`, `padding: '1rem'`
with `p-4`, `borderRadius: '6px'` with `rounded-md`, `fontSize: '1.3rem'` with `text-[1.3rem]`,
`lineHeight: '1.7'` with `leading-[1.7]`, `fontFamily: 'monospace'` with `font-mono`. Keyboard
tests: fire Escape on the dialog element (`screen.getByRole('dialog')`), never on `window` — Radix
listens on `document`, and an event dispatched on `window` never reaches it.

## Inputs & resources

Gates: `plans/CONVENTIONS.md` §4.

| Purpose               | Command                                                                                                                                    | Expected         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| One card row          | `bash scripts/migration-card.sh <file>`                                                                                                    | one Markdown row |
| Overlay contract only | `npx playwright test tests/functional/overlays.spec.ts --project=Web-Chromium`                                                             | exit 0           |
| Pause button only     | `npx playwright test tests/pause-button.spec.ts --project=Web-Chromium`                                                                    | `2 passed`       |
| Touch targets only    | `npx playwright test tests/touch-targets.spec.ts --project=Web-Chromium`                                                                   | exit 0           |
| Esc-owns protocol     | `npx vitest run src/components/SessionConsole/useSessionConsoleHotkeys.test.ts src/components/SessionConsole/SessionConsolePanel.test.tsx` | all pass         |
| Built CSS bytes       | `find dist-web/assets -name '*.css' \| xargs wc -c \| tail -1`                                                                             | a number         |

## Scope

**In scope**: the 13 overlay files, the 3 adapters, `src/components/MobileToolbar.tsx`,
`src/components/Toolbar.tsx` (new), `src/App.tsx`, the 10 `.btn`/legacy-class consumer files,
the colocated tests of migrated components (`ConfirmDialog.test.tsx` and `ImageCropper.test.tsx`
new), `src/styles/app.css` (deletions only, Step 13), `src/styles/palette-classes.test.ts`
(`BASELINE` only), `.eslintrc.cjs` (the ratchet override only), `tests/functional/overlays.spec.ts`
(row flips only), `tests/pause-button.spec.ts`, `tests/touch-targets.spec.ts` and
`tests/functional/editor-smoke.spec.ts` (selector updates only, Step 10),
`tests/visual.spec.ts-snapshots/`, `src/components/ui/README.md`, `src/components/README.md`
(one line, Step 10), `docs/guides/UI_RECIPES.md`, `docs/planning/ui-redesign-ideas.md`,
`docs/planning/screenshots/004-*/`, `scripts/migration-card.sh`, `plans/reports/004-pr*.md`,
`CHANGELOG.md`, `plans/README.md`, `plans/005-ui-performance-pass.md` (Grounded-at line only).

**Out of scope**: any visual or IA change beyond the expected differences each step lists;
`ErrorFallbackUI.tsx`, `UpdateErrorFallbackUI.tsx`, `CommandPalette.tsx`; `src/components/Canvas/**`
(`ImageCropper` is mounted at `CanvasManager.tsx` line 1140, `grep -n '<ImageCropper' src/components/Canvas/CanvasManager.tsx`);
renaming a `data-testid`; `src/components/ui/*.tsx` except a variant fix a step names; any
`--app-*` value; performance work (plan 005); moving toolbar state into a store (plan 005);
palette classes in files this plan does not touch (recorded in Step 14 for plan 006b).

## Landing

Branch, commits, PR, CI and rollback: `plans/CONVENTIONS.md` §7. This plan lands as **six
sequential PRs**, each from a fresh branch off `origin/main`, each releasable, each under ~1,500
changed lines; revert newest-first.

| PR  | Branch                                 | Steps  | Report                     |
| --- | -------------------------------------- | ------ | -------------------------- |
| 1   | `plan/004-pr1-adapters-and-confirm`    | 0–3    | `plans/reports/004-pr1.md` |
| 2   | `plan/004-pr2-no-a11y-overlays`        | 4a–4c  | `plans/reports/004-pr2.md` |
| 3   | `plan/004-pr3-sheets-and-library`      | 5a–6b  | `plans/reports/004-pr3.md` |
| 4   | `plan/004-pr4-large-dialogs`           | 7–9    | `plans/reports/004-pr4.md` |
| 5   | `plan/004-pr5-toolbars`                | 10–11  | `plans/reports/004-pr5.md` |
| 6   | `plan/004-pr6-btn-sweep-and-deletions` | 12a–14 | `plans/reports/004-pr6.md` |

## Steps

### Step 0: Baseline

**Files**: `scripts/migration-card.sh` (new), `docs/planning/screenshots/004-baseline/` (new),
`docs/planning/ui-redesign-ideas.md`, `plans/reports/004-pr1.md` (new).
**Do**: Create the branch and run the pre-flight. Create `scripts/migration-card.sh` with the
content above and `chmod +x` it. Run it for every file in the three card tables and paste the
rows under **Numbers** in `plans/reports/004-pr1.md`, together with the four global numbers from
**Commands**. Create `docs/planning/ui-redesign-ideas.md` with a `## From plan 004` heading if the
file is absent; if it exists, append that heading. Take the baseline screenshot set.
**Do NOT**: edit any component; take screenshots by any means other than `npm run shots`; delete
or edit anything in `docs/planning/ui-redesign-ideas.md` that is already there.
**Commands**:

```bash
git fetch origin main && git checkout -b plan/004-pr1-adapters-and-confirm origin/main
bash scripts/preflight.sh 004
grep -rhoE '\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange|yellow|purple|indigo)(-[0-9]{2,3})?\b' src --include=*.tsx | wc -l
grep -rn "style={{" --include=*.tsx src | wc -l
wc -l src/styles/app.css
npm run build:web && find dist-web/assets -name '*.css' | xargs wc -c | tail -1
SHOTS_OUT=docs/planning/screenshots/004-baseline npm run shots
ls docs/planning/screenshots/004-baseline | wc -l
npm run verify
```

**Expected**: exit 0; exit 0; a number (400 at d3d3642, 396 once plan 000 deleted
`PreferencesDialog.tsx`; record the printed value); a number (286 at d3d3642, 241 without
`PreferencesDialog.tsx`); a number (165 at d3d3642; plan 001 changed it); a byte count; exit 0;
`14`; exit 0.
**Check**: `ls docs/planning/screenshots/004-baseline | wc -l` prints `14` and the report holds
one card row per file.
**If it fails**: `npm run verify` red before any change is drift → STOP with the failing command.
**Commit**: `plan-004 step-0: baseline cards, screenshots and migration-card script`

### Step 1: Migrate `Tooltip` and create the ratchet override

**Files**: `src/components/Tooltip.tsx`, `.eslintrc.cjs`, `src/styles/palette-classes.test.ts`.
**Do**: Replace the whole of `src/components/Tooltip.tsx` with:

```tsx
/**
 * Tooltip adapter — same props API as before, rendered on the `tooltip` primitive.
 * Keeps the `inline-flex` wrapper so flex toolbars lay out exactly as they did; opening on
 * focus and flipping at viewport edges are accepted improvements (CONVENTIONS §9).
 */

import type { JSX, ReactNode } from 'react';

import {
  Tooltip as TooltipRoot,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TooltipProps {
  content: string;
  children: ReactNode;
  delay?: number; // Delay in milliseconds before showing tooltip
  offset?: number; // Distance in pixels from the top of the element to the top of the tooltip
}

/** The old tooltip box was ~36px tall; sideOffset is the visible gap, so subtract it. */
const OLD_BOX_HEIGHT = 36;
const MIN_GAP = 4;

function Tooltip({ content, children, delay = 100, offset = 50 }: TooltipProps): JSX.Element {
  return (
    <TooltipProvider delayDuration={delay}>
      <TooltipRoot>
        <TooltipTrigger asChild>
          <span className="inline-flex">{children}</span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={Math.max(MIN_GAP, offset - OLD_BOX_HEIGHT)}>
          {content}
        </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}

export default Tooltip;
```

Add the ratchet override to `.eslintrc.cjs` (Shared procedures, R) with
`files: ['src/components/Tooltip.tsx']`. Prove the rule fires once: add ` bg-red-500` inside the
`className="inline-flex"` string, run `npx eslint src/components/Tooltip.tsx`, confirm one error,
remove the text. Then run (R).
**Do NOT**: put `asChild` on the children themselves (nested buttons); change `TooltipProps`;
edit any Tooltip consumer; delete the `offset`/`delay` props (`HomeScreen.tsx` passes `offset`).
**Commands**:

```bash
npx eslint src/components/Tooltip.tsx        # with bg-red-500 temporarily inserted
grep -c "inline-flex" src/components/Tooltip.tsx
npm run verify:static
npm run verify:web
```

**Expected**: 1 error naming `no-restricted-syntax`; `1`; exit 0; exit 0.
**Check**: `verify:web` exits 0 with the temporary text removed.
**If it fails**: if `verify:static` fails inside `QuickTokenSidebar.test.tsx`, `Sidebar.test.tsx`
or `HomeScreen.test.tsx`, the failure is a jsdom API the primitive needs (`ResizeObserver`,
`hasPointerCapture`): STOP and report the message; plan 003 owns `src/test/setup.ts`.
**Commit**: `plan-004 step-1: Tooltip on the tooltip primitive; palette ratchet override`

### Step 2: Migrate `ToggleSwitch` and `CollapsibleSection`

**Files**: `src/components/ToggleSwitch.tsx`, `src/components/CollapsibleSection.tsx`,
`.eslintrc.cjs`, `src/styles/palette-classes.test.ts`.
**Do**: Replace `src/components/ToggleSwitch.tsx` with:

```tsx
/**
 * ToggleSwitch adapter — same props API, rendered on the `switch` and `label` primitives.
 */

import type { JSX } from 'react';
import { useId } from 'react';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
}: ToggleSwitchProps): JSX.Element {
  const generatedId = useId();
  const toggleId = id ?? generatedId;

  return (
    <div>
      <div className="flex items-center justify-between">
        {label && (
          <Label
            htmlFor={toggleId}
            className="text-xs uppercase font-semibold cursor-pointer text-[var(--app-text-secondary)]"
          >
            {label}
          </Label>
        )}
        <Switch
          id={toggleId}
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
          aria-disabled={disabled}
        />
      </div>
      {description && <p className="text-xs mt-1 text-[var(--app-text-muted)]">{description}</p>}
    </div>
  );
}

export default ToggleSwitch;
```

Replace `src/components/CollapsibleSection.tsx` with:

```tsx
/**
 * CollapsibleSection adapter — same props API, rendered on the `collapsible` primitive.
 */

import type { JSX, ReactNode } from 'react';
import { useState } from 'react';

import { RiArrowRightSLine } from '@remixicon/react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
}: CollapsibleSectionProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-6">
      <CollapsibleTrigger className="w-full flex items-center justify-between mb-3 hover:opacity-80 transition">
        <h3 className="text-sm uppercase font-bold tracking-wider text-[var(--app-text-secondary)]">
          {title}
        </h3>
        <RiArrowRightSLine
          className={`w-4 h-4 transition-transform text-[var(--app-text-secondary)] ${isOpen ? 'rotate-90' : ''}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export default CollapsibleSection;
```

Then (R) with both files.
**Do NOT**: edit any consumer (`grep -rln "ToggleSwitch\|CollapsibleSection" src --include=*.tsx`
lists them); change the `role="switch"` semantics (the primitive provides them); restyle the
section header.
**Commands**:

```bash
grep -c "Math.random" src/components/ToggleSwitch.tsx
npm run verify:static
npm run verify:web
```

**Expected**: `0`; exit 0; exit 0.
**Check**: `verify:web` exits 0.
**If it fails**: `SessionConsolePanel.test.tsx` failing on a toggle → re-read the `Switch` props in
`src/components/ui/switch.tsx` once (`onCheckedChange`, not `onChange`); then STOP.
**Commit**: `plan-004 step-2: ToggleSwitch and CollapsibleSection adapters`

### Step 3: Migrate `ConfirmDialog` — the worked example

**Files**: `src/components/ConfirmDialog.tsx`, `src/components/ConfirmDialog.test.tsx` (new),
`tests/functional/overlays.spec.ts`, `tests/visual.spec.ts-snapshots/`,
`docs/planning/screenshots/004-step3/` (new), `.eslintrc.cjs`, `src/styles/palette-classes.test.ts`,
`docs/planning/ui-redesign-ideas.md`, `plans/reports/004-pr1.md`, `plans/README.md`.
**Do**: Store wiring stays exactly as today (`grep -n "confirmDialog\|showConfirmDialog\|clearConfirmDialog" src/store/gameStore.ts`,
lines 337, 429–430, 868–870); Enter-to-confirm stays (today lines 46–53); initial focus moves to
Cancel (CONVENTIONS §9); the confirm button becomes `variant="destructive"` (today `bg-red-600`,
line 104); the undefined `--app-bg`/`--app-border`/`--app-text` variables (lines 84, 89) disappear
with the hand-rolled shell. Replace the whole file with:

```tsx
/**
 * Confirmation Dialog Component
 *
 * Store-driven confirmation dialog on the `dialog` primitive. Triggered via
 * `showConfirmDialog(message, onConfirm, confirmText?)` in gameStore and cleared via
 * `clearConfirmDialog()`. Enter confirms from anywhere inside the dialog, Escape cancels, and the
 * Cancel button receives initial focus (the safe action on a destructive dialog).
 *
 * @component
 */

import { type JSX, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useGameStore } from '../store/gameStore';

/** Radix focuses the first tabbable element on open; we want Cancel instead. */
function focusCancelButton(event: Event): void {
  event.preventDefault();
  const root = event.currentTarget;
  if (root instanceof HTMLElement) {
    root.querySelector<HTMLButtonElement>('[data-testid="dialog-confirm-cancel"]')?.focus();
  }
}

function ConfirmDialog(): JSX.Element | null {
  const confirmDialog = useGameStore((state) => state.confirmDialog);
  const clearConfirmDialog = useGameStore((state) => state.clearConfirmDialog);

  // Enter confirms (Radix supplies Escape, not Enter)
  useEffect(() => {
    if (!confirmDialog) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmDialog.onConfirm();
        clearConfirmDialog();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDialog, clearConfirmDialog]);

  if (!confirmDialog) {
    return null;
  }

  const handleConfirm = (): void => {
    confirmDialog.onConfirm();
    clearConfirmDialog();
  };

  const handleOpenChange = (open: boolean): void => {
    if (!open) {
      clearConfirmDialog();
    }
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md"
        data-testid="dialog-confirm-root"
        showCloseButton={false}
        onOpenAutoFocus={focusCancelButton}
      >
        <DialogHeader>
          <DialogTitle>Confirm Action</DialogTitle>
          <DialogDescription>{confirmDialog.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={clearConfirmDialog}
            data-testid="dialog-confirm-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            data-testid="dialog-confirm-confirm"
          >
            {confirmDialog.confirmText ?? 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmDialog;
```

Create `src/components/ConfirmDialog.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ConfirmDialog from './ConfirmDialog';
import { useGameStore } from '../store/gameStore';

describe('ConfirmDialog', () => {
  beforeEach(() => {
    useGameStore.getState().clearConfirmDialog();
  });

  it('renders nothing when no confirmation is pending', () => {
    render(<ConfirmDialog />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the message, owns Escape and focuses Cancel first', () => {
    act(() => {
      useGameStore.getState().showConfirmDialog('Delete this map?', () => {}, 'Delete');
    });
    render(<ConfirmDialog />);

    const root = screen.getByTestId('dialog-confirm-root');
    expect(root).toHaveAttribute('role', 'dialog');
    expect(root).toHaveAttribute('aria-modal', 'true');
    expect(root).toHaveAttribute('data-esc-owns', 'true');
    expect(screen.getByText('Delete this map?')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-confirm-confirm')).toHaveTextContent('Delete');
    expect(screen.getByTestId('dialog-confirm-cancel')).toHaveFocus();
  });

  it('Enter confirms and closes', () => {
    const onConfirm = vi.fn();
    act(() => {
      useGameStore.getState().showConfirmDialog('Sure?', onConfirm);
    });
    render(<ConfirmDialog />);

    act(() => {
      fireEvent.keyDown(screen.getByTestId('dialog-confirm-root'), { key: 'Enter' });
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().confirmDialog).toBeNull();
  });

  it('Escape closes without confirming', () => {
    const onConfirm = vi.fn();
    act(() => {
      useGameStore.getState().showConfirmDialog('Sure?', onConfirm);
    });
    render(<ConfirmDialog />);

    act(() => {
      fireEvent.keyDown(screen.getByTestId('dialog-confirm-root'), { key: 'Escape' });
    });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(useGameStore.getState().confirmDialog).toBeNull();
  });
});
```

The audio protocol is proven mechanically by the chain: this test asserts the attribute is on the
dialog; `useSessionConsoleHotkeys.test.ts` (`grep -n "esc-owns" src/components/SessionConsole/useSessionConsoleHotkeys.test.ts`,
line 53) asserts the attribute defers the STOP. Then (O) for `ConfirmDialog`, (R), (S) with
step `004-step3`, (I), and (P) for PR 1.
**Expected differences** (S): `confirm-dialog` and `world-dialog` — the dialog now has a surface
colour, border and title styling from the primitive (it had none: the variables were undefined),
and the Cancel button is `secondary`. No other surface may change.
**Do NOT**: change `gameStore.ts`; keep an Escape branch in the effect (Radix owns Escape; two
handlers close it twice); apply any class other than `variant="destructive"` to the confirm
button; add a `DialogTrigger` (the store opens it); edit the mount sites in `src/App.tsx`
(lines 457, 488) or `DesignSystemPlayground.tsx`.
**Commands**:

```bash
npx vitest run src/components/ConfirmDialog.test.tsx
npx vitest run src/components/SessionConsole/useSessionConsoleHotkeys.test.ts src/components/SessionConsole/SessionConsolePanel.test.tsx
bash scripts/migration-card.sh src/components/ConfirmDialog.tsx
npx playwright test tests/functional/overlays.spec.ts --project=Web-Chromium
npm run verify:static
npm run verify:web
npm run verify
```

**Expected**: `4 passed`; all pass; a row with `ui-imports=2 role=0 aria-modal=0 Escape=0 esc-owns=0 test=yes palette=0 inline=0`;
exit 0; exit 0; exit 0; exit 0.
**Check**: the card row above and `verify` exit 0.
**If it fails**: `toHaveFocus` failing → `DialogContent` did not pass `onOpenAutoFocus` through;
STOP naming `src/components/ui/dialog.tsx`. `data-esc-owns` missing → plan 003's default is
absent; STOP.
**Commit**: `plan-004 step-3: ConfirmDialog on the dialog primitive`

### Step 4a: Migrate `MapSettingsSheet` to `sheet`

**Files**: `src/components/MapSettingsSheet.tsx`, `tests/functional/overlays.spec.ts`,
`.eslintrc.cjs`, `src/styles/palette-classes.test.ts`, `docs/planning/ui-redesign-ideas.md`.
**Do**: Follow the Dialog recipe with `Sheet`. Deltas: the shell (backdrop lines 236–242, drawer
line 245, header 247–256, footer 448–455; `grep -n 'fixed right-0' src/components/MapSettingsSheet.tsx`)
becomes:

```tsx
<Sheet
  open={isOpen}
  onOpenChange={(open) => {
    if (!open) {
      onClose();
    }
  }}
  modal={!isCalibrating}
>
  <SheetContent
    side="right"
    className="w-full sm:w-96 sm:max-w-none p-0 overflow-y-auto"
    data-testid="sheet-map-settings-root"
  >
    <SheetHeader className="sticky top-0 bg-[var(--app-bg-surface)] border-b border-[var(--app-border-default)] p-4">
      <SheetTitle className="text-lg font-bold">
        {mode === 'CREATE' ? 'New Map' : 'Edit Map'}
      </SheetTitle>
    </SheetHeader>
    {/* the existing <div className="p-4 space-y-6"> … </div> content block, unchanged */}
    <SheetFooter className="sticky bottom-0 bg-[var(--app-bg-surface)] border-t border-[var(--app-border-default)] p-4 flex flex-row gap-2">
      <Button variant="ghost" className="flex-1 py-2" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="default" className="flex-1 py-2" onClick={handleSave}>
        {mode === 'CREATE' ? 'Create Map' : 'Save Changes'}
      </Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

`modal={!isCalibrating}` reproduces today's calibration behaviour (backdrop transparent and
click-through, lines 238–241). Delete the hand-rolled `✕` button (line 250; the primitive's X
replaces it). Convert the six `.btn` hits per the Step 12 table (lines 298 `default`,
328 `secondary`, 336 `secondary`, 439 `ghost`, 449 `ghost`, 452 `default`), the two
`.sidebar-input` inputs (lines 274, 369) to `<Input className="w-full" …/>` with all other props
unchanged, and the `.info-box` div (line 321) to
`className="rounded p-3 mb-3 text-xs bg-[var(--app-accent-bg)] border border-[var(--app-accent-solid)] text-[var(--app-accent-text-contrast)]"`.
Keep the `eslint-disable-next-line max-lines-per-function, complexity` at line 32 only if
`npm run lint` still needs it. Then (O), (R), (I).
**Do NOT**: change any form field, label text or store call; wire `isCalibrating` to anything but
`modal`; convert `btn-destructive` to `destructive` (it renders as bare `.btn` today → `ghost`;
record the Danger Zone as an idea).
**Commands**:

```bash
bash scripts/migration-card.sh src/components/MapSettingsSheet.tsx
npx playwright test tests/functional/overlays.spec.ts --project=Web-Chromium
npm run lint
npm run verify:static
npm run verify:web
```

**Expected**: `… role=0 aria-modal=0 Escape=0 esc-owns=0 … palette=0 inline=0 btn=0 legacy=0`;
exit 0; exit 0; exit 0; exit 0.
**Check**: the overlays spec passes with the `MapSettingsSheet` row flipped.
**If it fails**: `npm run lint` reporting an unused disable directive → delete the directive.
Otherwise STOP.
**Commit**: `plan-004 step-4a: MapSettingsSheet on the sheet primitive`

### Step 4b: Migrate `AddToLibraryDialog`

**Files**: `src/components/AssetLibrary/AddToLibraryDialog.tsx`, `tests/functional/overlays.spec.ts`,
`.eslintrc.cjs`, `src/styles/palette-classes.test.ts`, `docs/planning/ui-redesign-ideas.md`.
**Do**: Follow the Dialog recipe. Deltas: `open={isOpen}`, `onOpenChange` → `handleClose`
(line 179); `DialogContent className={isMobile ? 'h-full max-w-none rounded-none' : 'max-w-md'}`
with `data-testid="dialog-add-to-library-root"` and `showCloseButton={false}`; `<h2>` (line 200)
becomes `DialogTitle`; the three fields (lines 227, 244, 266) become `<Input>` / a plain
`<select>` with `className="w-full px-3 py-2 rounded bg-[var(--app-bg-active)] text-[var(--app-text-primary)] border border-[var(--app-border-default)]"`;
labels `text-neutral-300` → `text-[var(--app-text-secondary)]`; hint `text-neutral-500` →
`text-[var(--app-text-muted)]`; preview `bg-neutral-800` → `bg-[var(--app-bg-subtle)]`; borders
`border-neutral-700` → `border-[var(--app-border-default)]`; footer buttons → `Button variant="secondary"`
(Cancel) and `variant="default"` (Add to Library) keeping `disabled` props. Then (O), (R), (I).
**Do NOT**: change the form markup, field order, `DEFAULT_CATEGORIES`, the save flow, or the two
mount sites (`Sidebar.tsx` line 459, `LibraryManager.tsx` line 407).
**Commands**:

```bash
bash scripts/migration-card.sh src/components/AssetLibrary/AddToLibraryDialog.tsx
npx playwright test tests/functional/overlays.spec.ts --project=Web-Chromium
npm run verify:static
npm run verify:web
```

**Expected**: `… role=0 aria-modal=0 Escape=0 esc-owns=0 … palette=0 inline=0`; exit 0; exit 0;
exit 0.
**Check**: the overlays spec passes with the `AddToLibraryDialog` row flipped.
**If it fails**: STOP.
**Commit**: `plan-004 step-4b: AddToLibraryDialog on the dialog primitive`

### Step 4c: Migrate `ImageCropper`

**Files**: `src/components/ImageCropper.tsx`, `src/components/ImageCropper.test.tsx` (new),
`tests/functional/overlays.spec.ts`, `.eslintrc.cjs`, `src/styles/palette-classes.test.ts`,
`docs/planning/ui-redesign-ideas.md`, `plans/reports/004-pr2.md` (new), `plans/README.md`.
**Do**: Follow the Dialog recipe. Deltas: the component has no `isOpen` prop, so the root is
`<Dialog open onOpenChange={(open) => { if (!open) { onCancel(); } }}>` — `CanvasManager.tsx`
keeps rendering `{pendingCrop && <ImageCropper …/>}` unchanged. `DialogContent` gets
`className="w-[90vw] max-w-none h-[80vh] p-0 flex flex-col overflow-hidden"`,
`data-testid="dialog-image-cropper-root"`, `showCloseButton={false}`, an
`<DialogTitle className="sr-only">Crop image</DialogTitle>` as its first child, and the existing
inner layout (line 151 onward) with: `bg-neutral-800` → `bg-[var(--app-bg-surface)]`, the
`bg-black` cropper stage → `bg-[var(--app-bg-base)]`, `bg-neutral-900` → `bg-[var(--app-bg-subtle)]`,
`border-neutral-700` → `border-[var(--app-border-default)]`, `text-white` → `text-[var(--app-text-primary)]`,
and the two buttons → `Button variant="ghost"` (Cancel) and `variant="default"` (Crop & Import).
Create `src/components/ImageCropper.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ImageCropper from './ImageCropper';

// react-easy-crop measures its container with getBoundingClientRect, which is all zeros in
// jsdom, so the real cropper cannot be driven here. This file covers the dialog shell only;
// cropping itself has no automated coverage (recorded in plans/reports/004-pr2.md).
vi.mock('react-easy-crop', () => ({
  default: () => <div data-testid="cropper-stub" />,
}));

describe('ImageCropper', () => {
  it('renders a modal dialog with the cropper and both actions', () => {
    render(<ImageCropper imageSrc="blob:test" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    const root = screen.getByRole('dialog');
    expect(root).toHaveAttribute('aria-modal', 'true');
    expect(root).toHaveAttribute('data-esc-owns', 'true');
    expect(screen.getByTestId('cropper-stub')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crop & Import' })).toBeInTheDocument();
  });

  it('Cancel and Escape both call onCancel', () => {
    const onCancel = vi.fn();
    render(<ImageCropper imageSrc="blob:test" onConfirm={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
```

Then (O) for `ImageCropper` (its row stays `open: null` if plan 000 recorded it so; flip only the
booleans), (R), (I), and (P) for PR 2.
**Do NOT**: edit `src/components/Canvas/CanvasManager.tsx`; add an `isOpen` prop; change
`getCroppedImg`, `createImage`, the `aspect={1}` or the zoom range.
**Commands**:

```bash
grep -c "ImageCropper" src/components/Canvas/CanvasManager.tsx
npx vitest run src/components/ImageCropper.test.tsx
bash scripts/migration-card.sh src/components/ImageCropper.tsx
npm run verify:static
npm run verify:web
npm run verify
```

**Expected**: `2` (import + mount, unchanged); `2 passed`; `… palette=0 inline=0`; exit 0;
exit 0; exit 0.
**Check**: `git diff --stat origin/main -- src/components/Canvas/` is empty and `verify` exits 0.
**If it fails**: if the Dialog root cannot be contained inside `ImageCropper` without touching
`CanvasManager.tsx`: STOP with the reason.
**Commit**: `plan-004 step-4c: ImageCropper on the dialog primitive`

### Step 5a: Migrate `SessionConsoleEditorSheet`

**Files**: `src/components/SessionConsole/SessionConsoleEditorSheet.tsx`,
`tests/functional/overlays.spec.ts`, `.eslintrc.cjs`, `src/styles/palette-classes.test.ts`,
`docs/planning/ui-redesign-ideas.md`.
**Do**: Follow Step 4a's `Sheet` shape (`side="right"`, same header/footer classes;
`data-testid="sheet-session-console-editor-root"`; title `{image ? 'Edit plate' : 'Edit track'}`
as `SheetTitle` so `SessionConsolePanel.test.tsx` still finds the heading; no `modal` prop).
Delete the backdrop and `✕` (lines 241–256); footer buttons (lines 284, 290) → `Button variant="ghost"`
/ `variant="default"` with `type="button"` kept; the three `.sidebar-input` inputs (lines 55, 87, 119)
→ `<Input className="mt-2 w-full" …/>`. Then (O), (R), (I).
**Do NOT**: touch `TrackFields`, `EditorTextField` logic, the `draft` state, or
`SessionConsolePanel.tsx`.
**Commands**:

```bash
bash scripts/migration-card.sh src/components/SessionConsole/SessionConsoleEditorSheet.tsx
npx vitest run src/components/SessionConsole/SessionConsolePanel.test.tsx
npx playwright test tests/functional/overlays.spec.ts --project=Web-Chromium
npm run verify:static
npm run verify:web
```

**Expected**: `… role=0 aria-modal=0 Escape=0 esc-owns=0 … palette=0 inline=0 btn=0 legacy=0`;
all pass; exit 0; exit 0; exit 0.
**Check**: the overlays spec passes with the row flipped.
**If it fails**: a heading query failing in `SessionConsolePanel.test.tsx` → the title must be a
`SheetTitle` (renders `h2`); fix once, then STOP.
**Commit**: `plan-004 step-5a: SessionConsoleEditorSheet on the sheet primitive`

### Step 5b: Migrate `SessionConsoleSettingsSheet`

**Files**: `src/components/SessionConsole/SessionConsoleSettingsSheet.tsx`,
`tests/functional/overlays.spec.ts`, `.eslintrc.cjs`, `src/styles/palette-classes.test.ts`.
**Do**: Same shape as Step 5a; `data-testid="sheet-session-console-settings-root"`; `SheetTitle`
text `Session Console settings`; delete the Escape effect (lines 18–31), backdrop and `✕`
(lines 41–56); keep the four section components as the content. Then (O), (R).
**Do NOT**: edit `sessionConsoleSettingsSections.tsx` (Step 12a).
**Commands**:

```bash
bash scripts/migration-card.sh src/components/SessionConsole/SessionConsoleSettingsSheet.tsx
npx playwright test tests/functional/overlays.spec.ts --project=Web-Chromium
npm run verify:static
npm run verify:web
```

**Expected**: `… Escape=0 esc-owns=0 … palette=0 inline=0`; exit 0; exit 0; exit 0.
**Check**: the overlays spec passes with the row flipped.
**If it fails**: STOP.
**Commit**: `plan-004 step-5b: SessionConsoleSettingsSheet on the sheet primitive`

### Step 5c: Migrate `MobileSidebarDrawer`

**Files**: `src/components/MobileSidebarDrawer.tsx`, `tests/functional/overlays.spec.ts`,
`.eslintrc.cjs`, `src/styles/palette-classes.test.ts`.
**Do**: Replace lines 35–86 (both effects and the JSX) with a `Sheet` `side="left"`,
`SheetContent className="w-[85vw] max-w-xs p-0" ownsEscape={false} aria-label="Navigation menu" data-testid="sheet-mobile-sidebar-root"`
containing `<SheetTitle className="sr-only">Navigation menu</SheetTitle>` and `{children}`. Keep
the `if (!isOpen) return null;` guard so the drawer is not mounted when closed. Radix locks body
scroll itself; the `document.body.style.overflow` effect goes. Then (O) with esc-owns `false`,
(R).
**Do NOT**: claim Escape (`ownsEscape={false}` is decided: `SessionConsolePanel.test.tsx` line
508 encodes it); edit `Sidebar.tsx`.
**Commands**:

```bash
grep -c "ownsEscape={false}" src/components/MobileSidebarDrawer.tsx
npx vitest run src/components/SessionConsole/SessionConsolePanel.test.tsx
npx playwright test tests/functional/overlays.spec.ts --project=Web-Chromium
npm run verify:static
npm run verify:web
```

**Expected**: `1`; all pass; exit 0; exit 0; exit 0.
**Check**: the overlays spec passes with the row flipped and its esc-owns expectation `false`.
**If it fails**: STOP.
**Commit**: `plan-004 step-5c: MobileSidebarDrawer on the sheet primitive`

### Step 5d: Migrate `MobileBottomSheet`

**Files**: `src/components/MobileBottomSheet.tsx`, `tests/functional/overlays.spec.ts`,
`.eslintrc.cjs`, `src/styles/palette-classes.test.ts`.
**Do**: As Step 5c with `side="bottom"`,
`className="max-h-[70vh] rounded-t-xl p-0 overflow-y-auto bg-[var(--app-bg-surface)] border-t border-[var(--app-border-default)]"`,
`ownsEscape={false}`, `aria-label="Bottom sheet"`, `data-testid="sheet-mobile-bottom-root"`, an
sr-only `SheetTitle`, the drag handle (lines 92–97, `style` → `bg-[var(--app-border-default)]`)
and the `px-4 pb-4` content wrapper. Then (O), (R).
**Do NOT**: edit `TokenInspector.tsx` (it mounts with `isOpen` always true, line 458) or its test
(it mocks this component).
**Commands**:

```bash
bash scripts/migration-card.sh src/components/MobileBottomSheet.tsx
npx playwright test tests/functional/overlays.spec.ts --project=Web-Chromium
npm run verify:static
npm run verify:web
```

**Expected**: `… Escape=0 esc-owns=1 … palette=0 inline=0`; exit 0; exit 0; exit 0.
**Check**: the overlays spec passes with the row flipped.
**If it fails**: STOP.
**Commit**: `plan-004 step-5d: MobileBottomSheet on the sheet primitive`

### Step 6a: Migrate `LibraryManager`

**Files**: `src/components/AssetLibrary/LibraryManager.tsx`, `tests/functional/overlays.spec.ts`,
`.eslintrc.cjs`, `src/styles/palette-classes.test.ts`, `docs/planning/ui-redesign-ideas.md`.
**Do**: Follow the Dialog recipe. Deltas: `open={isOpen}`; `DialogContent
className={isMobile ? 'h-full max-w-none rounded-none p-0 flex flex-col' : 'max-w-6xl h-[80vh] p-0 flex flex-col'}`,
`data-testid="dialog-library-manager-root"`, `showCloseButton={false}`; `<h2>` (line 219) →
`DialogTitle`; keep the nested `<AddToLibraryDialog>` and `<TokenMetadataEditor>` (lines 407–437)
inside `DialogContent` exactly where they are (Radix stacks nested dialogs). Palette mapping:
`bg-neutral-800` → `bg-[var(--app-bg-surface)]`, `bg-neutral-700`/`hover:bg-neutral-700` →
`bg-[var(--app-bg-active)]`/`hover:bg-[var(--app-bg-hover)]`, `border-neutral-700/600` →
`border-[var(--app-border-default)]`, `text-white` → `text-[var(--app-text-primary)]`,
`text-neutral-400/300` → `text-[var(--app-text-secondary)]`, `text-neutral-500` →
`text-[var(--app-text-muted)]`, `bg-blue-600 hover:bg-blue-500` buttons → `Button variant="default"`,
`bg-neutral-700` buttons → `Button variant="secondary"`, `bg-red-*` → `variant="destructive"`,
`focus:border-blue-500` → `focus:border-[var(--app-accent-solid)]`. Then (O), (R), (I).
**Do NOT**: change search, filter, upload, delete or drag logic; move the nested dialogs.
**Commands**:

```bash
bash scripts/migration-card.sh src/components/AssetLibrary/LibraryManager.tsx
npx playwright test tests/functional/overlays.spec.ts --project=Web-Chromium
npm run verify:static
npm run verify:web
```

**Expected**: `… role=0 aria-modal=0 Escape=0 esc-owns=0 … palette=0 inline=0`; exit 0; exit 0;
exit 0.
**Check**: the overlays spec passes with the row flipped.
**If it fails**: STOP.
**Commit**: `plan-004 step-6a: LibraryManager on the dialog primitive`

### Step 6b: Migrate `TokenMetadataEditor`

**Files**: `src/components/AssetLibrary/TokenMetadataEditor.tsx`,
`src/components/AssetLibrary/TokenMetadataEditor.test.tsx`, `tests/functional/overlays.spec.ts`,
`.eslintrc.cjs`, `src/styles/palette-classes.test.ts`, `docs/planning/ui-redesign-ideas.md`,
`plans/reports/004-pr3.md` (new), `plans/README.md`.
**Do**: As Step 6a (`data-testid="dialog-token-metadata-root"`, mobile/desktop classes from line
165, same palette mapping, `<h2>` line 177 → `DialogTitle`). In the test, replace the backdrop
test (`grep -n "closest" src/components/AssetLibrary/TokenMetadataEditor.test.tsx`, lines 116–122)
with:

```tsx
it('should close modal on Escape', () => {
  render(<TokenMetadataEditor isOpen={true} libraryItemId="lib-1" onClose={mockOnClose} />);

  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(mockOnClose).toHaveBeenCalled();
});
```

and leave the "clicking inside" test (lines 124–131) as it is. Then (O), (R), (I), (P) for PR 3.
**Do NOT**: edit `CommandPalette.tsx` (second mount site, line 407); wrap the new test in an `if`.
**Commands**:

```bash
npx vitest run src/components/AssetLibrary/TokenMetadataEditor.test.tsx
bash scripts/migration-card.sh src/components/AssetLibrary/TokenMetadataEditor.tsx
npm run verify:static
npm run verify:web
npm run verify
```

**Expected**: all pass; `… palette=0 inline=0`; exit 0; exit 0; exit 0.
**Check**: `verify` exits 0 with the overlays spec row flipped.
**If it fails**: STOP.
**Commit**: `plan-004 step-6b: TokenMetadataEditor on the dialog primitive`

### Step 7: Migrate `UpdateManager`

**Files**: `src/components/UpdateManager.tsx`, `src/components/UpdateManager.test.tsx`,
`src/App.tsx`, `tests/functional/overlays.spec.ts`, `.eslintrc.cjs`,
`src/styles/palette-classes.test.ts`, `docs/planning/ui-redesign-ideas.md`.
**Do**: Follow the Dialog recipe. Deltas: delete the `handleKeyDown` `useCallback` and its effect
(`grep -n "Handle keyboard events" src/components/UpdateManager.tsx`); shell lines 530–539 →
`Dialog open={isOpen} onOpenChange` → `onClose`, `DialogContent className="max-w-md" data-testid="dialog-update-manager-root" showCloseButton={false}`;
`<h2>` (line 543) → `DialogTitle`; keep the `Close update manager` button; the 21 `style={{}}`
props and 4 palette classes → recipe mapping; action buttons → `Button variant="default"` /
`"secondary"`. In `src/App.tsx` delete the `isUpdateManagerOpen` Escape branch (line 277–280,
`grep -n "e.key === 'Escape' && isUpdateManagerOpen" src/App.tsx`) and remove
`isUpdateManagerOpen` from that effect's dependency array (line 335). In the test: change
`fireEvent.keyDown(window, { key: 'Escape' })` (line 149) to
`fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })`, and delete the backdrop test
(lines 113–122; backdrop dismissal is the primitive's, covered by plan 003's keyboard tests — record
the deleted test in the report). Then (O), (R), (I).
**Do NOT**: touch `useAutoUpdater`, `StatusContent`, the `messages` ref, the
`SessionConsoleEscapeStop defer=` prop (line 511) or `UpdateManagerErrorBoundary`.
**Commands**:

```bash
grep -c "Escape" src/App.tsx
npx vitest run src/components/UpdateManager.test.tsx src/components/UpdateManagerErrorBoundary.test.tsx
bash scripts/migration-card.sh src/components/UpdateManager.tsx
npm run verify:static
npm run verify:web
```

**Expected**: one less than before the step (6 → 5 at d3d3642 numbering); all pass;
`… Escape=0 esc-owns=0 … palette=0 inline=0`; exit 0; exit 0.
**Check**: the overlays spec passes with the row flipped.
**If it fails**: STOP.
**Commit**: `plan-004 step-7: UpdateManager on the dialog primitive`

### Step 8: Migrate `AboutModal`

**Files**: `src/components/AboutModal.tsx`, `src/App.tsx`, `tests/functional/overlays.spec.ts`,
`.eslintrc.cjs`, `src/styles/palette-classes.test.ts`, `docs/planning/ui-redesign-ideas.md`.
**Do**: Follow the Dialog recipe. Deltas: delete the focus-trap effect
(`grep -n "Focus trap implementation" src/components/AboutModal.tsx`, lines 258–304) and
`modalRef`; the backdrop/content shell (lines 313–347) → `Dialog open={isOpen}` / `DialogContent
className="max-w-[700px] max-h-[85vh] flex flex-col p-0" data-testid="dialog-about-root" showCloseButton={false}`;
keep the `Close About dialog` button; the tab strip (lines 365–385) becomes:

```tsx
<Tabs value={activeTab} onValueChange={(value) => setActiveTab(toAboutModalTab(value))}>
  <TabsList className="flex gap-2 mt-4">
    <TabsTrigger value="about">About</TabsTrigger>
    <TabsTrigger value="tutorial">Tutorial</TabsTrigger>
    <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
  </TabsList>
</Tabs>
```

with, above the component, `function toAboutModalTab(value: string): AboutModalTab { return value === 'tutorial' || value === 'shortcuts' ? value : 'about'; }`,
and the three `{activeTab === 'x' && (…)}` blocks unchanged. Convert every `style={{}}` (40) with
the recipe mapping. Delete from `modalStyles` every class no longer referenced
(`for c in $(grep -oE '^\s+\.[a-z-]+' src/components/AboutModal.tsx | tr -d ' .' | sort -u); do echo "$c $(grep -c "$c" src/components/AboutModal.tsx)"; done`
— a count of 1 means only the definition remains: delete it). If the literal ends up empty, delete
it and the `<style>` element. Remove the `eslint-disable-next-line max-lines-per-function` at
line 237 if `npm run lint` reports it unused. In `src/App.tsx` delete the `isAboutOpen` Escape
branch (lines 271–274; the `?` branch stays). Then (O), (R), (I).
**Do NOT**: restyle the tabs beyond `Tabs`; edit any About/Tutorial/Shortcuts copy; touch the
`onCheckForUpdates` button (lines 447–450).
**Commands**:

```bash
grep -c "Escape" src/App.tsx
npm run lint
bash scripts/migration-card.sh src/components/AboutModal.tsx
wc -l src/components/AboutModal.tsx
npm run verify:static
npm run verify:web
npm run verify:electron
```

**Expected**: one less than after Step 7; exit 0 (no unused disable directive); `… role=0 aria-modal=0 esc-owns=0 … palette=0 inline=0`;
a number below 858 (record it); exit 0; exit 0; exit 0.
**Check**: `npm run lint` and `verify:electron` both exit 0 with the row flipped.
**If it fails**: STOP.
**Commit**: `plan-004 step-8: AboutModal on the dialog and tabs primitives`

### Step 9: Migrate `DungeonGeneratorDialog`

**Files**: `src/components/DungeonGeneratorDialog.tsx`, `src/components/DungeonGeneratorDialog.test.tsx`,
`tests/functional/overlays.spec.ts`, `.eslintrc.cjs`, `src/styles/palette-classes.test.ts`,
`docs/planning/ui-redesign-ideas.md`, `plans/reports/004-pr4.md` (new), `plans/README.md`.
**Do**: Follow the ConfirmDialog pattern exactly (store-driven: `open` while `dungeonDialog`,
`onOpenChange` → `clearDungeonDialog`, `data-testid="dialog-dungeon-generator-root"`,
`showCloseButton={false}`). Initial focus stays on Generate (today `autoFocus`, line 210): give the
button `data-testid="dialog-dungeon-generator-generate"` and use `onOpenAutoFocus` with the same
helper shape as `focusCancelButton`. Delete the Escape effect (lines 28–41). Buttons → `Button
variant="secondary"` (Cancel) / `variant="default"` (Generate). The six `style={{}}` and four
palette classes → recipe mapping. In the test, replace the background-click test (lines 85–97)
with an Escape test that fires on `screen.getByRole('dialog')` and change line 66's
`fireEvent.keyDown(window, …)` to fire on `screen.getByRole('dialog')`. Then (O), (R), (I), (P)
for PR 4.
**Do NOT**: change `handleGenerate`, the slider ranges, or `DungeonGeneratorErrorBoundary`.
**Commands**:

```bash
npx vitest run src/components/DungeonGeneratorDialog.test.tsx src/components/DungeonGeneratorErrorBoundary.test.tsx
bash scripts/migration-card.sh src/components/DungeonGeneratorDialog.tsx
npm run verify:static
npm run verify:web
npm run verify
```

**Expected**: all pass; `… Escape=0 esc-owns=0 … palette=0 inline=0`; exit 0; exit 0; exit 0.
**Check**: `verify` exits 0 with the row flipped.
**If it fails**: STOP.
**Commit**: `plan-004 step-9: DungeonGeneratorDialog on the dialog primitive`

### Step 10: Extract `Toolbar.tsx` onto the button and separator primitives

**Files**: `src/components/Toolbar.tsx` (new), `src/App.tsx`, `src/components/README.md`,
`tests/pause-button.spec.ts`, `tests/touch-targets.spec.ts`, `tests/functional/editor-smoke.spec.ts`,
`docs/planning/screenshots/004-step10/` (new), `tests/visual.spec.ts-snapshots/`, `.eslintrc.cjs`,
`src/styles/palette-classes.test.ts`, `docs/planning/ui-redesign-ideas.md`.
**Do**: Record `BEFORE_IDS=$(grep -c 'data-testid="toolbar-' src/App.tsx)` and
`BEFORE_LABELS=$(sed -n 555,702p src/App.tsx | grep -c aria-label)` first (the toolbar block is
`grep -n 'className="toolbar' src/App.tsx` through the `</div>` that closes it, lines 555–702 at
d3d3642). Create `src/components/Toolbar.tsx` with this header, then the toolbar JSX moved verbatim
from `App.tsx` and rewritten only by the substitution table:

```tsx
/**
 * Toolbar — the desktop tool strip (Architect View, non-mobile). Extracted from App.tsx in plan
 * 004; every value still lives in App and arrives as a prop (plan 005 moves them to a store).
 */

import type { JSX, RefObject } from 'react';

import {
  RiCursorLine,
  RiDoorOpenLine,
  RiEraserLine,
  RiLayoutMasonryLine,
  RiPauseFill,
  RiPencilLine,
  RiPlayFill,
  RiRulerLine,
} from '@remixicon/react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

import Tooltip from './Tooltip';

export type ToolbarTool = 'select' | 'marker' | 'eraser' | 'wall' | 'door' | 'measure';
export type MeasurementMode = 'ruler' | 'blast' | 'cone';
export type DoorOrientation = 'horizontal' | 'vertical';

export interface ToolbarProps {
  tool: ToolbarTool;
  setTool: (tool: ToolbarTool) => void;
  color: string;
  onColorChange: (color: string) => void;
  colorInputRef: RefObject<HTMLInputElement>;
  doorOrientation: DoorOrientation;
  onToggleDoorOrientation: () => void;
  measurementMode: MeasurementMode;
  setMeasurementMode: (mode: MeasurementMode) => void;
  broadcastMeasurement: boolean;
  setBroadcastMeasurement: (value: boolean) => void;
  isGamePaused: boolean;
  onPauseToggle: () => void;
}

// eslint-disable-next-line max-lines-per-function
function Toolbar(props: ToolbarProps): JSX.Element {
  // destructure every prop here, then the moved JSX
}

export default Toolbar;
```

Substitution table (apply to the moved JSX, nothing else):

| Today (`App.tsx`)                                                                              | In `Toolbar.tsx`                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<div className="toolbar fixed …">` (line 556)                                                 | same classes plus `data-testid="toolbar-root"`                                                                                                                                      |
| pause `<button className={\`btn btn-tool … ${isGamePaused ? 'is-paused' : 'is-running'}\`}>`   | `<Button variant="tool" state={isGamePaused ? 'paused' : 'running'} data-state={isGamePaused ? 'paused' : 'running'} className="flex items-center justify-center font-semibold" …>` |
| tool `<button className={\`btn btn-tool p-2 ${tool === 'x' ? 'active' : ''}\`}>`               | `<Button variant="tool" active={tool === 'x'} aria-pressed={tool === 'x'} className="p-2" …>`                                                                                       |
| door-orientation `<button className="btn btn-tool text-lg px-2">`                              | `<Button variant="tool" className="text-lg px-2" …>`                                                                                                                                |
| mode `<button className={\`btn btn-mode ${measurementMode === 'x' ? 'active' : ''}\`}>`        | `<Button variant="mode" active={measurementMode === 'x'} aria-pressed={measurementMode === 'x'} …>`                                                                                 |
| broadcast `<button className={\`btn btn-broadcast ${broadcastMeasurement ? 'active' : ''}\`}>` | `<Button variant="broadcast" active={broadcastMeasurement} aria-pressed={broadcastMeasurement} …>`                                                                                  |
| `<div className="toolbar-divider w-px mx-1"></div>` (lines 581, 648)                           | `<Separator variant="toolbar" />`                                                                                                                                                   |
| `<div className="toolbar-divider w-px mx-1 h-6"></div>` (line 683)                             | `<Separator variant="toolbar" className="h-6" />`                                                                                                                                   |
| `setDoorOrientation((prev) => …)`                                                              | `onToggleDoorOrientation()`                                                                                                                                                         |
| `handlePauseToggle()`                                                                          | `onPauseToggle()`                                                                                                                                                                   |
| `handleColorChange(e.target.value)`                                                            | `onColorChange(e.target.value)`                                                                                                                                                     |
| icon `className="w-5 h-5"`                                                                     | `className="size-5"`                                                                                                                                                                |

Every `data-testid`, `aria-label`, `title` and `Tooltip content` moves unchanged. In `App.tsx`
replace lines 555–702 with:

```tsx
{
  isArchitectView && !isMobile && (
    <Toolbar
      tool={tool}
      setTool={setTool}
      color={color}
      onColorChange={handleColorChange}
      colorInputRef={colorInputRef}
      doorOrientation={doorOrientation}
      onToggleDoorOrientation={() =>
        setDoorOrientation((prev) => (prev === 'horizontal' ? 'vertical' : 'horizontal'))
      }
      measurementMode={measurementMode}
      setMeasurementMode={setMeasurementMode}
      broadcastMeasurement={broadcastMeasurement}
      setBroadcastMeasurement={setBroadcastMeasurement}
      isGamePaused={isGamePaused}
      onPauseToggle={(): void => {
        void handlePauseToggle();
      }}
    />
  );
}
```

add `import Toolbar from './components/Toolbar';` (alphabetical, after `Toast`) and delete the
eight now-unused `@remixicon/react` imports (lines 3–12). The floating colour palette
(lines 706–735) and the keyboard handler (lines 255–335) stay in `App.tsx` untouched. Tests:
in `tests/pause-button.spec.ts` change each `toHaveClass(/is-running/)` to
`toHaveAttribute('data-state', 'running')` and `toHaveClass(/is-paused/)` to
`toHaveAttribute('data-state', 'paused')` (`grep -n "is-running\|is-paused" tests/pause-button.spec.ts`);
in `tests/touch-targets.spec.ts` and `tests/functional/editor-smoke.spec.ts`, if
`grep -n "btn-tool\|'active'\|/active/" <file>` hits, change that selector to
`[data-testid^="toolbar-tool-"]` and that class assertion to `toHaveAttribute('aria-pressed', 'true')`;
keep every asserted pixel value. Add one line naming `Toolbar.tsx` to `src/components/README.md`
next to the line that names `MobileToolbar.tsx` (`grep -n MobileToolbar src/components/README.md`).
Then (R) with `src/components/Toolbar.tsx`, (S) with step `004-step10`, (I).
**Expected differences** (S): none. The toolbar must match `004-baseline/editor-*.png`.
**Do NOT**: move state into a store or reduce the prop list (plan 005); change any shortcut;
touch `MobileToolbar.tsx` (Step 11); fix a variant with a one-off class in `Toolbar.tsx` — fix it
in `src/components/ui/button.tsx` and record the fix.
**Commands**:

```bash
npx playwright test tests/pause-button.spec.ts --project=Web-Chromium   # before editing: proves plan 001 landed
grep -c 'data-testid="toolbar-' src/App.tsx src/components/Toolbar.tsx
grep -c 'aria-label' src/components/Toolbar.tsx
grep -cE 'btn btn-|toolbar-divider' src/App.tsx src/components/Toolbar.tsx
npx playwright test tests/pause-button.spec.ts tests/touch-targets.spec.ts tests/functional/editor-smoke.spec.ts --project=Web-Chromium
npm run verify:static
npm run verify:web
```

**Expected**: `2 passed`; `src/App.tsx:0` and `src/components/Toolbar.tsx:$BEFORE_IDS`;
`$BEFORE_LABELS`; `0` for both files; all pass; exit 0; exit 0.
**Check**: the four specs pass and both counts equal their `BEFORE_` values.
**If it fails**: the first command red before any edit → plan 001 Step 8 did not land: STOP.
`tests/visual.spec.ts` red on `editor` → STOP with decision file `004-toolbar-visual-delta.md`.
**Commit**: `plan-004 step-10: extract Toolbar.tsx onto the button and separator primitives`

### Step 11: Migrate `MobileToolbar`

**Files**: `src/components/MobileToolbar.tsx`, `docs/planning/screenshots/004-step11/` (new),
`tests/visual.spec.ts-snapshots/`, `.eslintrc.cjs`, `src/styles/palette-classes.test.ts`,
`docs/planning/ui-redesign-ideas.md`, `plans/reports/004-pr5.md` (new), `plans/README.md`.
**Do**: Replace every `<button>` with `<Button variant="ghost" …>` keeping its `className`
verbatim (each bar button keeps `flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] transition-colors`),
and move its `style={{}}` colours into classes: active bar button →
`text-[var(--app-accent-solid)] bg-[var(--app-accent-bg)]`, inactive →
`text-[var(--app-text-secondary)] bg-transparent`; menu items → `bg-[var(--app-bg-surface)]`,
`border-b border-[var(--app-border-subtle)]`; the pause item →
`bg-[var(--app-error-solid)] text-[var(--app-error-solid-text)]` when paused and
`bg-[var(--app-success-solid)] text-[var(--app-success-solid-text)]` when running; the menu
backdrop `bg-black/30` (line 105) → `bg-[var(--app-overlay)]`; the bar container's `style`
(lines 248–254) → `bg-[var(--app-bg-surface)] border-t border-[var(--app-border-subtle)] pb-[env(safe-area-inset-bottom,0px)]`;
icons `w-6 h-6` → `size-6`. The colour swatch (`style={{ backgroundColor: color }}`, line 200)
keeps its `style` — it shows the user's colour. Keep `data-testid="toolbar-mobile-root"` and every
`min-h-[56px]`. Then (R), (S) with step `004-step11`, (I), (P) for PR 5.
**Expected differences** (S): none on `editor-mobile` (the more-menu is closed in the shot).
**Do NOT**: use `variant="tool"` here (the mobile active style is accent-bg + accent text, not
solid accent; record the unification as an idea); shrink any target; change the menu items' order.
**Commands**:

```bash
grep -c 'min-h-\[56px\]' src/components/MobileToolbar.tsx
grep -c 'style={{' src/components/MobileToolbar.tsx
bash scripts/migration-card.sh src/components/MobileToolbar.tsx
npx playwright test tests/touch-targets.spec.ts tests/functional/mobile-smoke.spec.ts --project=Web-Chromium
npm run verify:static
npm run verify:web
npm run verify
```

**Expected**: `10`; `1`; `… palette=0 inline=1`; all pass; exit 0; exit 0; exit 0.
**Check**: `verify` exits 0 and the `min-h-[56px]` count is `10`.
**If it fails**: `touch-targets.spec.ts` red → a target shrank: STOP.
**Commit**: `plan-004 step-11: MobileToolbar on the button primitive`

### Step 12a: Sweep `.btn` and `.sidebar-input` in the Session Console

**Files**: `src/components/SessionConsole/SessionConsolePanel.tsx`,
`src/components/SessionConsole/TrackGroupList.tsx`,
`src/components/SessionConsole/sessionConsoleSettingsSections.tsx`,
`src/components/SessionConsole/SessionConsoleBoard.tsx`,
`src/components/SessionConsole/ImageSetBoard.tsx`,
`src/components/SessionConsole/SessionConsoleMasterBar.tsx`, `.eslintrc.cjs`,
`src/styles/palette-classes.test.ts`, `docs/planning/ui-redesign-ideas.md`.
**Do**: Every `<button className="btn <kind> <rest>">` becomes `<Button variant=<mapped> className="<rest>">`
with all other props (`type="button"`, `aria-label`, `aria-pressed`, `onClick`, `disabled`, `key`)
unchanged. Mapping: `btn-primary` → `default`; `btn-default` → `secondary`; `btn-secondary`,
`btn-ghost`, `btn-destructive` (undefined in CSS, render as bare `.btn`) and bare `btn` → `ghost`.
Pre-listed hits (`grep -nE '\bbtn\b' <file>` at d3d3642):

| File                                 | Lines → variant                                   |
| ------------------------------------ | ------------------------------------------------- |
| `SessionConsolePanel.tsx`            | 72 `ghost`; 85, 92, 109 `ghost` (`btn-secondary`) |
| `TrackGroupList.tsx`                 | 118 `ghost`                                       |
| `sessionConsoleSettingsSections.tsx` | 224, 231, 238 `ghost`                             |
| `SessionConsoleBoard.tsx`            | 113 `ghost`; 120, 127 `ghost`                     |
| `ImageSetBoard.tsx`                  | 123 `ghost`                                       |
| `SessionConsoleMasterBar.tsx`        | 59, 67, 74, 81, 88, 95, 102 `ghost`               |

`.sidebar-input` inputs (`sessionConsoleSettingsSections.tsx` 51, 67; `SessionConsoleBoard.tsx` 89)
→ `<Input className="<rest>" …/>` with every other prop (`value`, `onChange`, `onPaste`,
`onKeyDown`, `aria-label`, `placeholder`) unchanged. Then (R), (I).
**Do NOT**: change sizes or spacing ("cleanups"); change `aria-pressed` on Duck; touch the hidden
file input in `SessionConsoleBoard.tsx`.
**Commands**:

```bash
grep -rcE '\bbtn\b|sidebar-input' src/components/SessionConsole/*.tsx | grep -v ':0'
npx vitest run src/components/SessionConsole
npm run verify:static
npm run verify:web
```

**Expected**: nothing (every count 0); all pass; exit 0; exit 0.
**Check**: the first command prints nothing.
**If it fails**: STOP.
**Commit**: `plan-004 step-12a: Session Console buttons and inputs on the primitives`

### Step 12b: Sweep `.btn` in `Sidebar`, `MapNavigator` and `DoorControls`

**Files**: `src/components/Sidebar.tsx`, `src/components/MapNavigator.tsx`,
`src/components/DoorControls.tsx`, `docs/planning/screenshots/004-step12b/` (new),
`tests/visual.spec.ts-snapshots/`, `.eslintrc.cjs`, `src/styles/palette-classes.test.ts`,
`docs/planning/ui-redesign-ideas.md`.
**Do**: Same mapping as Step 12a. Hits: `Sidebar.tsx` 357, 375, 393 `ghost` (`btn-secondary`),
402 `ghost`; `MapNavigator.tsx` 171 `ghost`; `DoorControls.tsx` 88, 100 `secondary`
(`btn-default`), 111 `secondary` **keeping `bg-orange-600/20 hover:bg-orange-600/30`** on the
Unlock All button (a colour with no token; plan 006b decides it — do not add `DoorControls.tsx`
to the ratchet `files` list and record it) and `text-orange-400` (line 74) likewise. Then (R)
for `Sidebar.tsx` and `MapNavigator.tsx` only, (S) with step `004-step12b`, (I).
**Expected differences** (S): none on `editor`.
**Do NOT**: change the dashed-border "New Map" styling; edit `Sidebar.test.tsx`.
**Commands**:

```bash
grep -cE '\bbtn\b' src/components/Sidebar.tsx src/components/MapNavigator.tsx src/components/DoorControls.tsx
npx vitest run src/components/Sidebar.test.tsx
npm run verify:static
npm run verify:web
```

**Expected**: `0` for all three; all pass; exit 0; exit 0.
**Check**: `verify:web` exits 0 with no snapshot updated.
**If it fails**: `tests/visual.spec.ts` red on `editor` → STOP with decision file
`004-btn-visual-delta.md`.
**Commit**: `plan-004 step-12b: Sidebar, MapNavigator and DoorControls buttons on the primitive`

### Step 12c: Replace `.sidebar-token` in `QuickTokenSidebar`

**Files**: `src/components/QuickTokenSidebar.tsx`, `src/components/QuickTokenSidebar.test.tsx`,
`.eslintrc.cjs`, `src/styles/palette-classes.test.ts`.
**Do**: `.sidebar-token` is a 64×64 draggable tile (`app.css`: `background: var(--app-bg-active); color: var(--app-text-primary)`,
hover `--app-bg-hover`), not an input. On each of the three tiles (lines 100, 128, 147) replace
the `sidebar-token` class with
`bg-[var(--app-bg-active)] text-[var(--app-text-primary)] hover:bg-[var(--app-bg-hover)]` and add
`data-testid="sidebar-token-tile"`; the generic tile keeps its inline `style` (it is a different
background by design). In the test replace the `sidebar-token` assertion (line 519) with
`expect(dragonToken).toHaveAttribute('data-testid', 'sidebar-token-tile');` and leave lines 315,
465, 480, 493, 506 and 552 as they are (those utilities are unchanged). Then (R).
**Do NOT**: convert the tiles to `Button` (they are drag sources, not buttons); change `w-16 h-16`.
**Commands**:

```bash
grep -c "sidebar-token-tile" src/components/QuickTokenSidebar.tsx
npx vitest run src/components/QuickTokenSidebar.test.tsx
npm run verify:static
npm run verify:web
```

**Expected**: `3`; all pass; exit 0; exit 0.
**Check**: `verify:web` exits 0.
**If it fails**: STOP.
**Commit**: `plan-004 step-12c: QuickTokenSidebar tiles on tokens`

### Step 13: Delete the dead legacy styles

**Files**: `src/styles/app.css`, `src/components/ui/README.md`.
**Do**: Delete from `src/styles/app.css` the rules `.btn`, `.btn-default` (+`:hover`),
`.btn-primary` (+`:hover`), `.btn-tool` (+`:hover`, `.active`, `.active:hover`, `.is-paused`,
`.is-paused:hover`, `.is-running`, `.is-running:hover`), `.btn-mode` (+states), `.btn-broadcast`
(+states), `.toolbar-divider`, `.sidebar-input` (+`:focus`), `.sidebar-token` (+`:hover`),
`.info-box`. Keep `.toolbar`, `.sidebar`, `.sidebar-section`, `.app-root`, `.canvas-container`,
`.konvajs-content`. Read every hit of the survivors command before deleting: the only allowed hits
are `HomeScreen.tsx` (`dismiss-btn`, `quick-action-btn` — definition and use inside its `<style>`
block) and `AboutModal.tsx` (`about-modal-close-btn`, if the close-button rule kept it). Add to
`src/components/ui/README.md` a short section "Kept adapters and excluded components":
`Tooltip.tsx`, `ToggleSwitch.tsx`, `CollapsibleSection.tsx` stay as adapters (they insulate call
sites from primitive API changes); `ErrorFallbackUI.tsx` and `UpdateErrorFallbackUI.tsx` are never
migrated (they render after React has failed).
**Do NOT**: delete `.toolbar`; edit any `.tsx`; touch `theme.css`.
**Commands**:

```bash
for c in btn-default btn-primary btn-tool btn-mode btn-broadcast toolbar-divider sidebar-input sidebar-token info-box is-paused is-running; do echo "=== $c"; grep -rn "$c" --include=*.tsx --include=*.ts src/; done
grep -rnE '"[^"]*\bbtn\b[^"]*"' --include=*.tsx src/
grep -cE '^\.(btn|toolbar-divider|sidebar-input|sidebar-token|info-box)' src/styles/app.css
npx vitest run src/styles
npm run build:web && find dist-web/assets -name '*.css' | xargs wc -c | tail -1
npm run verify:static
npm run verify:web
npm run verify:electron
```

**Expected**: only `===` headers (no hits); only the `HomeScreen.tsx` (and possibly
`AboutModal.tsx`) lines named above; `0`; all pass; a byte count smaller than Step 0's (record
both); exit 0; exit 0; exit 0.
**Check**: the third command prints `0` and the survivors list matches the allowed list exactly.
**If it fails**: a real consumer still exists → do not delete that rule; STOP naming the file.
**Commit**: `plan-004 step-13: delete the legacy button and sidebar classes`

### Step 14: Final verification, recipes, numbers, report and handoff

**Files**: `docs/guides/UI_RECIPES.md`, `docs/planning/screenshots/004-final/` (new),
`docs/planning/ui-redesign-ideas.md`, `plans/reports/004-pr6.md` (new), `CHANGELOG.md`,
`plans/README.md`, `plans/005-ui-performance-pass.md`.
**Do**: Fill the "Add a dialog" and "Add a sheet" sections of `docs/guides/UI_RECIPES.md`
(≤ 30 lines each): the Step 3 `ConfirmDialog` shape (store-driven `open`, `onOpenChange`,
`DialogContent` with `data-testid`, `DialogTitle`/`DialogDescription`, `DialogFooter` with
`Button`s, `onOpenAutoFocus` for non-default initial focus, the `data-esc-owns` default and
`ownsEscape={false}` for non-modal navigation) and the Step 4a `MapSettingsSheet` shape
(`side`, `modal`, sticky header/footer, `ownsEscape`). Record final numbers with the Step 0
commands, the surviving palette-class count per file
(`grep -rcE '<PALETTE>' src --include=*.tsx | grep -v ':0' | sort -t: -k2 -nr`), the final
`BASELINE`, the ratchet `files` list length (`grep -c "src/components/" .eslintrc.cjs`), and the
before/after card rows for every file. Take `SHOTS_OUT=docs/planning/screenshots/004-final npm run shots`.
Add one bullet under `## [Unreleased]` in `CHANGELOG.md`: every dialog and sheet now traps focus,
closes on Escape and exposes `role="dialog"`; the pause and tool buttons are unchanged. Write the
report (`plans/reports/004-pr6.md`, CONVENTIONS §11), then (P) for PR 6. After merge: set this
plan's row in `plans/README.md` to `DONE <merge sha>` and write the merge SHA into the
`Grounded at` line of `plans/005-ui-performance-pass.md`.
**Do NOT**: fill "Add a toolbar tool" or "Add a surface to the test harness" (plan 005); change
any file under `src/`.
**Commands**:

```bash
grep -rcE '\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange|yellow|purple|indigo)(-[0-9]{2,3})?\b' src --include=*.tsx | grep -v ':0' | sort -t: -k2 -nr
grep -rn "style={{" --include=*.tsx src | wc -l
grep -c "^### " docs/planning/ui-redesign-ideas.md
SHOTS_OUT=docs/planning/screenshots/004-final npm run shots && ls docs/planning/screenshots/004-final | wc -l
npm run verify
```

**Expected**: a list with none of this plan's migrated files in it (the survivors are files this
plan did not touch plus `DoorControls.tsx`; record the total for plan 006b); a number below
Step 0's; ≥ 20 (one heading per migrated component); `14`; exit 0.
**Check**: `npm run verify` exits 0 and the report's Numbers section holds every before/after row.
**If it fails**: STOP.
**Commit**: `plan-004 step-14: recipes, final numbers, report and handoff`

## Done criteria

- [ ] `docs/planning/screenshots/004-baseline/` and `004-final/` hold 14 files each
- [ ] All 13 in-scope overlays import from `@/components/ui/`; `tests/functional/overlays.spec.ts` has every row flipped (mobile sheets with esc-owns `false`) and passes
- [ ] `ErrorFallbackUI` / `UpdateErrorFallbackUI` exclusion and the kept adapters recorded in `src/components/ui/README.md`
- [ ] `src/components/ConfirmDialog.test.tsx` and `src/components/ImageCropper.test.tsx` exist and pass
- [ ] Both `App.tsx` Escape branches removed; `grep -c "e.key === 'Escape' && is" src/App.tsx` → `0`
- [ ] `src/components/Toolbar.tsx` exists; `tests/pause-button.spec.ts` passes on `data-state`
- [ ] `tests/touch-targets.spec.ts` green; `MobileToolbar.tsx` keeps 10 × `min-h-[56px]`
- [ ] `grep -rnE '\bbtn\b' --include=*.tsx src/` returns only the `HomeScreen.tsx`/`AboutModal.tsx` inline-style classes
- [ ] The legacy rules are gone from `src/styles/app.css` and the built CSS is smaller than at Step 0
- [ ] Every migrated file is in the ratchet override; `BASELINE` equals the final count
- [ ] No `data-testid` renamed (`git diff <grounded-at> -- src | grep '^-.*data-testid'` shows only lines re-added unchanged)
- [ ] `docs/planning/ui-redesign-ideas.md` has a heading per migrated component; `UI_RECIPES.md` dialog and sheet sections filled
- [ ] Six PRs merged with merge commits; `plans/reports/004-pr1.md` … `004-pr6.md` written
- [ ] `plans/README.md` row `DONE <merge sha>`; plan 005's `Grounded at` filled

## STOP conditions

- `ImageCropper` cannot contain its Dialog root without editing `CanvasManager.tsx` (Step 4c).
- `tests/pause-button.spec.ts` is red before Step 10 touches anything (plan 001 Step 8 missing).
- `tests/visual.spec.ts` fails on a surface not listed under a step's **Expected differences**
  → decision file `docs/planning/decisions/004-<component>-visual-delta.md`.
- `useSessionConsoleHotkeys.test.ts` or `SessionConsolePanel.test.tsx` goes red after any overlay
  step (the esc-owns protocol broke).
- `tests/touch-targets.spec.ts` goes red (a target shrank).
- `npm run test:a11y` reports a violation that was not in `docs/planning/verification-baseline.md`.
- A step's diff exceeds ~800 lines (`git diff --stat HEAD~1 | tail -1`).
- The Dialog close-button rule cannot be applied because `DialogContent` neither accepts
  `showCloseButton` nor renders an X (re-read `src/components/ui/dialog.tsx` once, then STOP).

## Handoff / after it lands

- Adding a dialog is now importing one primitive; the recipe is in `docs/guides/UI_RECIPES.md`.
- Reviewer focus: (1) the `esc-owns` column of every card versus the overlays spec; (2) the
  `004-step10`/`004-step11` screenshots against `004-baseline`; (3) the survivors list in Step 13.
- Plan 005 depends on `src/components/Toolbar.tsx` and its prop list above; it moves those props
  into a store and must not be run in parallel.
- Deferred: palette classes in untouched files and `DoorControls.tsx`'s orange (006b), the mobile
  toolbar's active style unification (006b), cropping coverage for `react-easy-crop` (no test),
  the two `ErrorFallbackUI` components, `CommandPalette`.
- Watch for: an adapter growing past ~30 lines, and any new `role="dialog"` typed by hand.
