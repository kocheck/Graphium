# Plan 004: Migrate every screen onto the primitive layer

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. **Commit after every step** — each step is
> designed to be independently shippable. If anything in "STOP conditions" occurs,
> stop and report — do not improvise. When done, update the status row in
> `plans/README.md`.
>
> **Read `src/components/ui/README.md` before Step 1.** It is the contribution
> contract produced by plan 003 and defines how primitives are used and extended.
>
> **Drift check (run first)**:
> `git diff --stat d3d3642..HEAD -- src/components/ src/App.tsx src/styles/app.css`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/003-build-primitive-layer.md
- **Category**: migration
- **Grounded at**: `d3d3642` (2026-09-04)

## Why this matters

Plan 003 built the primitive layer. Until screens actually use it, that layer is
**pure cost** — a second component system sitting next to the first one, with all
the maintenance burden and none of the benefit. This plan is where the value is
realized, and leaving it undone is the worst possible outcome of the entire
program: two competing systems, permanently.

The concrete win is accessibility. Today, nine components hand-roll a modal
overlay and **exactly one has a focus trap** (`AboutModal.tsx:279–297`). Three —
`MapSettingsSheet`, `AddToLibraryDialog`, `ImageCropper` — have no `role="dialog"`
or `aria-modal` at all. Four never handle Escape. A DM running Graphium with a
keyboard or a screen reader can currently open a dialog and lose their focus into
the canvas behind it. Every one of those is fixed for free by swapping in one
correct primitive.

The second win is that this plan **deletes more than it adds**. Nine bespoke
overlay implementations collapse into consumers of one `Dialog`. The four ad-hoc
button systems in `src/styles/app.css` collapse into CVA variants. That reduction
is what makes the next redesign (plan 006) cheap.

## Context the executor needs

### The core principle: behavior-neutral migration

**Every step in this plan must be visually and behaviorally neutral except for the
accessibility improvements.** This is not a redesign — plan 006 is. If a migration
tempts you to also improve the layout, resist it and note the idea for plan 006.
Mixing migration with redesign makes it impossible to tell whether a bug came from
the swap or the new design, and it is the single most common way a strangler-fig
migration stalls.

Plan 003 built the `button` `tool`/`mode`/`broadcast` variants specifically to
reproduce `src/styles/app.css` exactly, so that this neutrality is provable.

### The safety net

Graphium's E2E suite uses **`data-testid` selectors, not CSS or DOM structure** —
51 uses of `[data-testid^="token-"]`, 22 of `[data-testid="campaign-title"]`, and so
on across `tests/functional/`. There are 43 `data-testid` attributes in `src/`.

**This is the thing that makes this plan safe. Preserve every `data-testid`
exactly.** A migration that keeps testids intact can be validated by
`npm run test:e2e` at every single step. A migration that renames one silently
breaks a test that was your only proof the swap was neutral.

### Verified consumer map (at `d3d3642`)

**`src/components/Tooltip.tsx`** — consumed by `HomeScreen.tsx`, `Sidebar.tsx`,
`QuickTokenSidebar.tsx`, `App.tsx`.

**`src/components/ToggleSwitch.tsx`** — consumed by
`SessionConsole/SessionConsoleEditorSheet.tsx`,
`SessionConsole/sessionConsoleSettingsSections.tsx`, `MapSettingsSheet.tsx`, and
`DesignSystemPlayground/playground-registry.tsx`.

**`src/components/CollapsibleSection.tsx`** — consumed by `Sidebar.tsx` only.

**`src/components/ConfirmDialog.tsx`** — consumed by `App.tsx` and
`DesignSystemPlayground/DesignSystemPlayground.tsx`. Store-driven via
`showConfirmDialog` in `src/store/gameStore.ts`.

**The nine hand-rolled overlays**, with what each is missing today:

| Component | Escape | Focus trap | `role="dialog"` / `aria-modal` |
|-----------|--------|-----------|-------------------------------|
| `AboutModal.tsx` (858 lines) | no | **yes** (hand-rolled, lines 279–297) | yes |
| `PreferencesDialog.tsx` (678) | yes | no | yes |
| `UpdateManager.tsx` (634) | yes | no | yes |
| `ConfirmDialog.tsx` | yes | no | yes |
| `DungeonGeneratorDialog.tsx` (217) | yes | no | yes |
| `SessionConsole/SessionConsoleEditorSheet.tsx` (298) | yes | no | yes |
| `MapSettingsSheet.tsx` (461) | no | no | **no** |
| `AssetLibrary/AddToLibraryDialog.tsx` (297) | no | no | **no** |
| `ImageCropper.tsx` (271) | no | no | **no** |

**`.btn` / `.btn-tool` / `.btn-mode` / `.btn-broadcast` consumers**:
`App.tsx` (the toolbar — the only user of `btn-tool`, `btn-mode`, `btn-broadcast`),
plus these generic `.btn` users: `SessionConsole/SessionConsoleEditorSheet.tsx`,
`SessionConsole/SessionConsolePanel.tsx`, `SessionConsole/TrackGroupList.tsx`,
`SessionConsole/sessionConsoleSettingsSections.tsx`,
`SessionConsole/SessionConsoleBoard.tsx`, `SessionConsole/ImageSetBoard.tsx`,
`SessionConsole/SessionConsoleMasterBar.tsx`, `MapSettingsSheet.tsx`,
`Sidebar.tsx`, `MapNavigator.tsx`.

**`.sidebar-input` / `.sidebar-token` / `.info-box` consumers**:
`SessionConsole/SessionConsoleEditorSheet.tsx`,
`SessionConsole/sessionConsoleSettingsSections.tsx`,
`SessionConsole/SessionConsoleBoard.tsx`, `MapSettingsSheet.tsx`,
`QuickTokenSidebar.tsx`.

### Other constraints

- **Dual-window architecture**: `src/App.tsx` branches between Architect View (DM)
  and World View (player projection). No migration may leak DM chrome into the
  World View. Verify after every step that touches a component rendered in both.
- **The 286 inline `style={{}}` objects** deferred from plan 001 get resolved here,
  per component, as each one migrates. Hotspots: `PreferencesDialog.tsx` (45),
  `AboutModal.tsx` (40), `UpdateManager.tsx` (21), `TokenInspector.tsx` (19).
  Replace them with primitive props and Tailwind utilities as you migrate that
  component. Do **not** sweep them globally.
- **Strict ESLint** with `--max-warnings 0` and a pre-commit hook. `.ai-rules.md` is
  mandatory. Note `max-lines-per-function` — `AboutModal.tsx` and
  `PreferencesDialog.tsx` are large and already carry `eslint-disable` comments;
  migration should shrink them enough to remove some.

## Inputs & resources

| Purpose        | Command                    | Expected on success        |
|----------------|----------------------------|----------------------------|
| Lint           | `npm run lint`             | exit 0, zero warnings      |
| Typecheck      | `npm run type-check`       | exit 0                     |
| Unit tests     | `npm run test:run`         | all pass                   |
| Web build      | `npm run build:web`        | exit 0                     |
| Electron dev   | `npm run dev`              | app + World View launch    |
| A11y E2E       | `npm run test:a11y`        | all pass                   |
| Full E2E       | `npm run test:e2e`         | all pass                   |

**Read first**: `src/components/ui/README.md`.

**The per-step gate**, run after every single step:
```bash
npm run lint && npm run type-check && npm run test:run && npm run test:e2e && npm run test:a11y
```

## Scope

**In scope**: the components named in the consumer map above, `src/App.tsx`,
`src/styles/app.css`, and the unit tests colocated with migrated components.

**Out of scope** (do NOT touch, even though they look related):
- **Any visual, layout, or information-architecture change.** Plan 006. If you spot
  a genuine improvement, write it in `docs/planning/ui-redesign-ideas.md` in Step 12
  instead of making it.
- **`src/components/Canvas/**`** — Konva rendering, not DOM. Untouched by this plan.
- **`src/components/AssetLibrary/CommandPalette.tsx`** — explicitly out of the
  primitive roster per plan 003.
- **Any `data-testid` value.** Preserving them is what makes this plan verifiable.
- **Performance refactoring** (memoization, code splitting, state hoisting) — plan
  005. Migrate the component as-is; don't also restructure it.
- **`src/store/gameStore.ts`** — unless the toast decision from plan 003 Step 6
  explicitly requires it, in which case follow that decision exactly.

## Working approach

Branch: `claude/ui-redesign-plan-xnyz33`. **One commit per step.** Every commit
must leave the app fully functional and releasable — that is the entire point of
the strangler-fig approach Kyle chose.

**The migration recipe**, applied identically to each component:
1. Read the component fully. Note its `data-testid` values and its exact current
   visual result.
2. Replace the hand-rolled markup with the primitive, preserving every `data-testid`.
3. Replace that component's inline `style={{}}` objects with primitive props and
   Tailwind utilities.
4. Update its colocated unit test if one exists (`*.test.tsx`).
5. Run the per-step gate.
6. Manually confirm in `npm run dev` that it looks and behaves the same — plus that
   Escape and Tab now work correctly.
7. Commit.

## Steps

### Step 1: Migrate `Tooltip` — the rehearsal

Lowest-risk migration with real consumers. Do this first to shake out the process.

Replace `src/components/Tooltip.tsx`'s internals with the `tooltip` primitive from
`src/components/ui/`, **keeping its existing public props API unchanged** so its
four consumers (`HomeScreen.tsx`, `Sidebar.tsx`, `QuickTokenSidebar.tsx`,
`App.tsx`) need no edits. This is the adapter pattern — it lets you swap the
implementation without a fan-out change.

If the existing API cannot be preserved (e.g. it takes a `content` string where the
primitive wants children), adapt inside `Tooltip.tsx`; do not change the call sites.

**Check**: The per-step gate passes. In `npm run dev`, tooltips appear on the
toolbar buttons, the sidebar, and the home screen, positioned as before. Tooltips
near the window edge flip rather than clipping. The World View is unaffected.

### Step 2: Migrate `ToggleSwitch` and `CollapsibleSection`

Same adapter approach. `ToggleSwitch` → `switch` primitive; `CollapsibleSection` →
`collapsible` primitive. Preserve both public APIs so the five consumer files
(`SessionConsoleEditorSheet`, `sessionConsoleSettingsSections`, `MapSettingsSheet`,
`playground-registry`, `Sidebar`) need no changes.

**Check**: Per-step gate passes. In `npm run dev`: toggles in Map Settings and the
Session Console switch correctly and are keyboard-operable (Space/Enter); the
Sidebar's collapsible sections still expand and collapse. The playground still
renders `ToggleSwitch`.

### Step 3: Migrate `ConfirmDialog` — the first real Dialog

`ConfirmDialog` is the smallest of the nine overlays and is store-driven
(`showConfirmDialog` in `src/store/gameStore.ts`), so its call sites are already
decoupled. That makes it the right place to prove the `Dialog` primitive on a real
screen.

Rebuild its internals on the `dialog` primitive, keeping the store API and every
`data-testid` unchanged. Remove its hand-rolled Escape handler and overlay markup —
the primitive provides both.

**Check**: Per-step gate passes. In `npm run dev`, trigger a confirm dialog
(File → New Campaign). Confirm: it opens; **Escape closes it**; **Tab cycles
within it and does not reach the canvas**; focus returns to where it was on close;
clicking the overlay closes it; both buttons work. Then confirm `/design-system`
still renders it (`DesignSystemPlayground.tsx` mounts it).

**This step is the proof point for the whole plan.** If Dialog works here, the
remaining eight are mechanical.

### Step 4: Migrate the three overlays with no a11y at all

Highest accessibility value per unit of effort, because these three currently have
no `role="dialog"`, no `aria-modal`, no Escape, and no focus trap:

- `src/components/MapSettingsSheet.tsx` (461 lines) — use the **`sheet`** primitive;
  it is a side panel, not a centered dialog.
- `src/components/AssetLibrary/AddToLibraryDialog.tsx` (297 lines) — `dialog`.
- `src/components/ImageCropper.tsx` (271 lines) — `dialog`. Take care: it wraps
  `react-easy-crop`, which manages its own pointer events. Verify cropping still
  works by dragging and zooming, not just by the dialog opening.

Do these as **three separate commits**, gate after each.

Replace each one's inline `style={{}}` objects as you go.

**Check**: After each, the per-step gate passes. In `npm run dev`, each opens,
closes on Escape, traps focus, and restores focus. `npm run test:a11y` must pass —
these three are the ones most likely to have been generating (or newly fixing) axe
violations, so note any change in the axe output.

Then confirm `ImageCropper` specifically: drag a map image onto the canvas, crop
it, and confirm the crop is applied correctly.

### Step 5: Migrate `DungeonGeneratorDialog` and `SessionConsoleEditorSheet`

- `src/components/DungeonGeneratorDialog.tsx` (217 lines) — `dialog`.
- `src/components/SessionConsole/SessionConsoleEditorSheet.tsx` (298 lines) —
  `sheet`.

Two commits, gate after each. Note that `DungeonGeneratorDialog.tsx` has a
colocated test (`DungeonGeneratorDialog.test.tsx`) — update it, and confirm
`DungeonGeneratorErrorBoundary.test.tsx` still passes.

**Check**: Per-step gate after each. In `npm run dev`, generate a dungeon end to
end and confirm the result renders on the canvas. Open the Session Console editor
sheet, edit a track, and confirm the change persists.

### Step 6: Migrate `UpdateManager` and `PreferencesDialog`

- `src/components/UpdateManager.tsx` (634 lines, 21 inline styles) — `dialog`.
  It has a colocated test and an error boundary with its own test; update both.
- `src/components/PreferencesDialog.tsx` (678 lines, **45 inline styles** — the
  largest concentration in the codebase) — `dialog`, plus `tabs` if it hand-rolls
  tab switching, plus `switch`, `select`, and `slider` for its controls.

Two commits, gate after each. `PreferencesDialog` is the largest single migration
in the plan; budget accordingly and do not merge it with anything else.

After migrating, check whether either file's `eslint-disable max-lines-per-function`
comment can now be removed. If so, remove it — that is a concrete measure of the
reduction.

**Check**: Per-step gate after each. In `npm run dev`: open Preferences, change the
theme, change a touch setting, close and reopen, and confirm the settings persisted.
Open the Update Manager and confirm its states render. Both must trap focus and
close on Escape.

### Step 7: Migrate `AboutModal`

`src/components/AboutModal.tsx` — 858 lines, 40 inline styles, and the **only**
component with a working hand-rolled focus trap (lines 279–297).

Replace the overlay with the `dialog` primitive and **delete the hand-rolled focus
trap** — Radix provides it. This is the largest single deletion in the plan.

If it hand-rolls tab switching, use the `tabs` primitive.

**Check**: Per-step gate passes. In `npm run dev`, press `?` to open the About
modal. Confirm: it opens; Escape closes it (note: `App.tsx` currently handles
Escape for this modal in its global keydown handler around `src/App.tsx:265` —
**check whether that handler is now redundant and conflicting with the primitive's
own Escape handling**, and if so remove the redundant branch); Tab cycles within;
focus restores; the "Check for Updates" button still opens the Update Manager.

Confirm the line count dropped materially — record before/after.

### Step 8: Migrate the toolbar to `button` variants

In `src/App.tsx`, replace every `btn btn-tool` / `btn btn-mode` / `btn btn-broadcast`
usage with the `Button` primitive using the `tool` / `mode` / `broadcast` variants
plan 003 built for exactly this. `App.tsx` is the **only** consumer of these three
classes.

Also replace `.toolbar-divider` (`src/App.tsx:581`, `:648`, `:683`) with the
`separator` primitive variant.

Preserve every `aria-label` and every `data-testid`.

**Check**: Per-step gate passes. In `npm run dev`, **compare the toolbar
side-by-side against a screenshot taken before this step**. It must be visually
identical in both light and dark theme. Every tool button switches tools; the
active state highlights correctly; the pause button toggles red/green; the
measurement mode sub-buttons work; the broadcast toggle turns green when active.
Keyboard shortcuts (V/M/E/W/D/R/I) still switch tools.

**This step has the highest chance of a visible regression.** If anything differs,
fix the `button` variant in `src/components/ui/button.tsx` rather than adding a
one-off class in `App.tsx`.

### Step 9: Migrate the generic `.btn` consumers

Ten files use the generic `.btn` classes:
`SessionConsole/SessionConsolePanel.tsx`, `SessionConsole/TrackGroupList.tsx`,
`SessionConsole/sessionConsoleSettingsSections.tsx`,
`SessionConsole/SessionConsoleBoard.tsx`, `SessionConsole/ImageSetBoard.tsx`,
`SessionConsole/SessionConsoleMasterBar.tsx`, `MapSettingsSheet.tsx`,
`Sidebar.tsx`, `MapNavigator.tsx`, and `SessionConsoleEditorSheet.tsx` (already
touched in Step 5 — finish it here).

Replace each with the `Button` primitive, choosing the variant that matches its
current appearance (`default`, `secondary`, `destructive`, …).

Then migrate the `.sidebar-input` / `.sidebar-token` / `.info-box` consumers
(`QuickTokenSidebar.tsx`, `MapSettingsSheet.tsx`, `SessionConsoleBoard.tsx`,
`sessionConsoleSettingsSections.tsx`, `SessionConsoleEditorSheet.tsx`) to the
`input` and `label` primitives.

**Do this as at least three commits** — Session Console, sidebar/navigator, and
inputs — gating after each. Ten files in one commit is not reviewable.

Note `QuickTokenSidebar.test.tsx` and `Sidebar.test.tsx` exist and reference these
classes; update them.

**Check**: Per-step gate after each commit. In `npm run dev`, exercise the Session
Console (play a track, adjust the master bar, open the board), the Sidebar (add a
token, rename it), and the Map Navigator (add a map, switch maps, rename one).

### Step 10: Delete the dead legacy styles and components

Only now, with every consumer migrated, remove the old code.

From `src/styles/app.css`, delete: `.btn`, `.btn-default`, `.btn-primary`,
`.btn-tool` (and its states), `.btn-mode`, `.btn-broadcast`, `.toolbar-divider`,
`.sidebar-input`, `.sidebar-token`, `.info-box`. Keep `.app-root`, `.toolbar`,
`.sidebar`, `.sidebar-section`, `.canvas-container`, and `.konvajs-content` unless
they too have zero consumers.

**Before deleting each rule, prove it has no consumers:**
```bash
for c in btn btn-default btn-primary btn-tool btn-mode btn-broadcast toolbar-divider sidebar-input sidebar-token info-box; do
  printf "%-18s " "$c"; grep -rn "$c" --include=*.tsx src/ | wc -l
done
```
A non-zero count means a consumer was missed. Inspect each hit before deleting —
note that short names like `btn` will also match longer ones, so read the matches
rather than trusting the count alone.

Then, if their internals are now pure adapters with no remaining hand-rolled logic,
consider whether `src/components/Tooltip.tsx`, `ToggleSwitch.tsx`, and
`CollapsibleSection.tsx` should be deleted and their consumers pointed directly at
`src/components/ui/`. **Recommendation: keep the adapters.** They are a few lines
each, they insulate the app from future shadcn API changes, and deleting them means
touching every call site for no functional gain. If you keep them, say so in
`src/components/ui/README.md` so it reads as a decision rather than an oversight.

**Check**: The grep loop above shows no remaining real consumers. Per-step gate
passes. `npm run build:web` exits 0 and the CSS bundle is smaller than before —
record the delta.

### Step 11: Verify the accessibility win is real

This is the payoff; measure it rather than assuming it.

For each of the nine formerly-hand-rolled overlays, in `npm run dev`, confirm all
five behaviors:
1. Opens from its trigger.
2. **Escape closes it.**
3. **Tab cycles within it and never reaches the canvas or the page behind.**
4. **Focus returns to the trigger on close.**
5. It has `role="dialog"` and `aria-modal="true"` in the DOM.

Record a 9×5 results table in your report.

Then run the full a11y suite and diff its output against the pre-plan baseline:
```bash
npm run test:a11y
```

Also verify the **World View** is uncontaminated: open it, and confirm no dialog,
sheet, popover, or tooltip from the Architect View renders in it.

**Check**: All 45 cells in the table pass. `npm run test:a11y` passes. World View
is clean.

### Step 12: Record what you deferred, and full verification

Create `docs/planning/ui-redesign-ideas.md` listing every visual, layout, or IA
improvement you noticed while migrating but deliberately did not make. Each entry:
the component, what you'd change, why. **This is the primary input to plan 006** —
you have just read every UI file in the app closely, which no one else will have
done, and that knowledge is worth more than the migration itself if it is captured.

Then:
```bash
npm run lint
npm run type-check
npm run test:run
npm run build:web
npm run test:a11y
npm run test:e2e
```

Record: total lines removed vs. added (`git diff --stat` against the plan's start),
the inline `style={{}}` count now (`grep -rn "style={{" --include=*.tsx src | wc -l`
— it was 286 at `d3d3642`), and the `dist-web/` size delta.

**Check**: All commands exit 0. The inline style count has dropped substantially.
`docs/planning/ui-redesign-ideas.md` exists and is non-trivial.

## Validation plan

- **The per-step gate is the primary control.** Running the full E2E suite after
  every step is what makes a twelve-step migration safe; the testid-based selectors
  make it meaningful. Do not batch steps to save time — the whole design of this
  plan is that a regression is always attributable to exactly one step.
- **`npm run test:e2e` is the neutrality proof.** Because this plan changes no
  testid and no behavior, any E2E failure means the migration was not neutral.
- **`npm run test:a11y` is the improvement proof.** It should pass throughout and
  the axe output should get cleaner, particularly after Step 4.
- **The Step 11 9×5 table is the acceptance artifact.** It is the concrete evidence
  that the accessibility problem this plan exists to solve is actually solved.
- **Update colocated unit tests as you go.** `DungeonGeneratorDialog.test.tsx`,
  `UpdateManager.test.tsx`, `Sidebar.test.tsx`, `QuickTokenSidebar.test.tsx`,
  `HomeScreen.test.tsx`, and `TokenInspector.test.tsx` all touch migrated
  components. Follow the patterns already in those files.
- **Kyle confirms** the toolbar after Step 8 and does a general pass after Step 12,
  since visual neutrality is ultimately a judgment call.

## Done criteria

- [ ] `Tooltip`, `ToggleSwitch`, and `CollapsibleSection` are backed by primitives; consumers unchanged
- [ ] All nine overlays use the `dialog` or `sheet` primitive
- [ ] All nine pass the 5-point behavior check in Step 11 (table recorded)
- [ ] The hand-rolled focus trap in `AboutModal.tsx` is deleted
- [ ] The toolbar in `src/App.tsx` uses `Button` variants and is visually identical to before (Kyle confirms)
- [ ] All ten generic `.btn` consumers migrated
- [ ] `.sidebar-input` / `.sidebar-token` / `.info-box` consumers migrated
- [ ] The legacy classes are deleted from `src/styles/app.css`, with the Step 10 grep loop showing no real consumers
- [ ] **Every `data-testid` value is unchanged** (`git diff` on testids is empty)
- [ ] The inline `style={{}}` count has dropped substantially from its baseline of 286
- [ ] `docs/planning/ui-redesign-ideas.md` exists and captures deferred improvements
- [ ] World View verified free of Architect chrome
- [ ] `npm run lint`, `npm run type-check`, `npm run test:run`, `npm run build:web`, `npm run test:a11y`, `npm run test:e2e` all exit 0
- [ ] Every commit in this plan leaves the app releasable
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back — do not improvise — if:

- **Any E2E spec fails after a step.** This plan is behavior-neutral by design, so
  a failure means the migration changed something it shouldn't have. Report which
  spec, which assertion. Do not update the test to match the new behavior — that
  destroys the safety net.
- **You need to change a `data-testid` to complete a step.** Report it. There is
  almost always a way to preserve it, and preserving it is more valuable than any
  structural elegance gained by changing it.
- **Step 3 (`ConfirmDialog`) does not work cleanly.** It is the simplest of the
  nine. If the `Dialog` primitive struggles there, it will fail on the other eight —
  stop and fix the primitive in plan 003's scope rather than working around it
  eight times.
- **A migrated component looks different and you cannot make it match** by adjusting
  the primitive's variants. Report it. Do not accept the difference silently and do
  not "improve" it — that is plan 006's decision to make.
- **`npm run test:a11y` regresses** at any step. A migration to accessible
  primitives making accessibility worse means something is wrong with how the
  primitive is being used.
- **A dialog, sheet, popover, or tooltip appears in the World View.** This is a
  product-correctness bug affecting what players see. Stop immediately.
- **`ImageCropper` cropping breaks** after Step 4. `react-easy-crop` manages its own
  pointer events and may conflict with the dialog's event handling.
- **A step's diff exceeds roughly 800 lines.** The step has grown beyond what is
  reviewable; split it.

## Handoff / after it lands

- **This is where the program pays off.** After this plan, adding a new dialog to
  Graphium is importing one primitive instead of reimplementing modal behavior.
- **What a reviewer should scrutinize most**: (1) the Step 11 accessibility table —
  it is the plan's core claim; (2) the toolbar after Step 8 — the highest-visibility
  surface and the most likely place a "neutral" migration wasn't; (3) that no
  `data-testid` changed.
- **Plan 006 depends on `docs/planning/ui-redesign-ideas.md`** from Step 12. Do not
  skip it — it is the cheapest, highest-value artifact in this plan.
- **Deliberately deferred**: all visual and IA change (plan 006), all performance
  work (plan 005), the `CommandPalette` (out of scope entirely), and possibly the
  toast/`sonner` swap (per plan 003 Step 6).
- **Watch for**: the adapters (`Tooltip.tsx`, `ToggleSwitch.tsx`,
  `CollapsibleSection.tsx`) accumulating logic. They should stay thin. If one grows
  past ~30 lines, it has stopped being an adapter.
