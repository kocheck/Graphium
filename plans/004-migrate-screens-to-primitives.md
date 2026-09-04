# Plan 004: Migrate every screen onto the primitive layer

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. **Commit after every step.** If anything in
> "STOP conditions" occurs, stop and report — do not improvise. When done, update the
> status row in `plans/README.md`.
>
> **Read `src/components/ui/README.md` before Step 1** — the contribution contract from
> plan 003. If it does not exist, plan 003 has not landed: STOP.
>
> **Drift check (run first)**:
> `git diff --stat d3d3642..HEAD -- src/components/ src/App.tsx src/styles/app.css`

## Status

- **Priority**: P1
- **Effort**: XL
- **Risk**: HIGH
- **Depends on**: plans/000-repair-verification-infrastructure.md, plans/003-build-primitive-layer.md
- **Category**: migration
- **Grounded at**: `d3d3642` (2026-09-04)

> **Effort was "L" in an earlier draft. That was wrong.** This plan migrates ~20 files
> and roughly 4,600 lines, including an 858-line and a 634-line component, across
> fifteen commits, each gated by six commands. Budget accordingly, and prefer splitting
> a step over rushing one.

## Why this matters

Plan 003 built the primitive layer. Until screens use it, that layer is **pure cost** —
a second component system beside the first. Leaving this undone is the worst outcome of
the whole program: two systems, permanently.

The concrete win is accessibility. Across `src/`, **eleven components hand-roll a modal
overlay and exactly one has a focus trap** (`AboutModal.tsx`, lines 255–297). Four have
**no Escape handling at all**. Two of the worst are the DM's own asset surfaces —
`AssetLibrary/LibraryManager.tsx` (442 lines) and `AssetLibrary/TokenMetadataEditor.tsx`
(322 lines) — which have neither Escape nor `aria-modal`. A DM using a keyboard or a
screen reader can open a dialog and lose focus into the canvas behind it.

The second win is deletion: eleven bespoke overlays collapse into consumers of one
`Dialog`.

## Context the executor needs

### The safety net is real but narrow — read this before trusting any Check

An earlier draft of this plan claimed the E2E suite made every step verifiable, citing
"51 uses of `[data-testid^="token-"]`". **That was false and it changes how you work.**
Those selectors live in specs that `playwright.config.ts` ignored, and the testids they
reference (`campaign-title`, `token-*`, `add-token-button`, `tool-marker`) have **zero
occurrences in `src/`**.

**Plan 000 repaired this** — it extended the a11y suite to five surfaces in both themes,
and restored or deleted every ignored spec. Before Step 1, read
`docs/planning/verification-baseline.md` and establish what actually covers the files
you are about to change. Then hold two facts in mind:

1. **Not one of the ~20 files this plan migrates contains a `data-testid` today.** So
   "preserve every `data-testid`" is a real rule for the *app* but a near-no-op for
   *these files*. It is not the safety net here.
2. **The real net for these components is vitest**, and it is patchy. Colocated tests
   exist for `DungeonGeneratorDialog`, `UpdateManager`, `Sidebar`, `QuickTokenSidebar`,
   `HomeScreen`, `SessionConsolePanel`, `TokenInspector`. There are **none** for
   `ConfirmDialog`, `AboutModal`, `MapSettingsSheet`, `AddToLibraryDialog`,
   `ImageCropper`, `Tooltip`, `ToggleSwitch`, `CollapsibleSection`, `MapNavigator`,
   `DoorControls`, or the toolbar.

**Therefore Step 0 exists**: capture a screenshot and behaviour baseline before any
migration, because for many of these components it is the only evidence you will have.

Note also: `QuickTokenSidebar.test.tsx:519` asserts `toHaveClass('sidebar-token')` and
lines 315/480/493/506 assert on Tailwind utilities this plan changes. Those assertions
are among the few that actually run. Updating them is legitimate — but update them to
assert the *new* correct behaviour, never to silence a real regression.

### The overlay inventory — eleven, not nine

Every component in `src/` with `role="dialog"` or `aria-modal` (non-test), verified:

| Component | Lines | Escape | Focus trap | Migrate to |
|---|---|---|---|---|
| `AboutModal.tsx` | 858 | via `App.tsx:270` | **yes** (255–297) | `dialog` |
| `PreferencesDialog.tsx` | 678 | yes | no | **see below — dead code** |
| `UpdateManager.tsx` | 634 | yes + `App.tsx:275` | no | `dialog` |
| `DungeonGeneratorDialog.tsx` | 217 | yes | no | `dialog` |
| `ConfirmDialog.tsx` | 116 | yes | no | `dialog` |
| `MapSettingsSheet.tsx` | 461 | **no** | no | `sheet` |
| `AssetLibrary/AddToLibraryDialog.tsx` | 297 | **no** | no | `dialog` |
| `ImageCropper.tsx` | 271 | **no** | no | `dialog` (see mount note) |
| `SessionConsole/SessionConsoleEditorSheet.tsx` | 298 | yes | no | `sheet` |
| `SessionConsole/SessionConsoleSettingsSheet.tsx` | 68 | yes | no | `sheet` |
| `MobileSidebarDrawer.tsx` | 91 | yes | no | `sheet` |
| `MobileBottomSheet.tsx` | 107 | yes | no | `sheet` |
| `ErrorFallbackUI.tsx` | 114 | **no** | no | **out of scope** |
| `UpdateErrorFallbackUI.tsx` | 197 | **no** | no | **out of scope** |
| `AssetLibrary/LibraryManager.tsx` | 442 | **no** | no | `dialog` |
| `AssetLibrary/TokenMetadataEditor.tsx` | 322 | **no** | no | `dialog` |

The two `ErrorFallbackUI` components are excluded deliberately: they render *when React
has already failed*, and making them depend on a portal-based primitive adds a failure
mode to the last line of defence. Record that reasoning in
`src/components/ui/README.md`.

### `PreferencesDialog.tsx` is dead code — decide before migrating it

It has **zero importers anywhere in `src/`**, and the file admits it at line 677 with
`// eslint-disable-next-line import/no-unused-modules`. It also holds 45 of this plan's
headline 286 inline styles — 16% of the total, in a file no user can reach.

**Do not migrate it.** In Step 12, put the question to Kyle: delete it, or wire it up to
a menu item. Migrating unreachable code is the definition of wasted effort, and its
Check ("open Preferences, change the theme…") cannot be performed — there is no UI path.

### The `data-esc-owns` protocol — do not break the DM's music

`src/components/SessionConsole/useSessionConsoleHotkeys.ts:34`:

```ts
return Boolean(document.querySelector('[data-esc-owns="true"]'));
```

The global Escape hotkey STOPs Session Console audio playback **unless** some open
overlay claims Escape via `data-esc-owns="true"`. Nine components set it:
`ConfirmDialog:78`, `PreferencesDialog:71`, `AboutModal:334`, `UpdateManager:538`,
`DungeonGeneratorDialog:91`, `SessionConsoleEditorSheet:245`,
`SessionConsoleSettingsSheet:45`, `ErrorFallbackUI:47`, `UpdateErrorFallbackUI:134`.

**Re-attach `data-esc-owns="true"` to every migrated overlay's content element.** It is
not a `data-testid`, so the preservation rule does not cover it; miss it and pressing
Escape to close a dialog also kills the DM's ambience mid-session.
`useSessionConsoleHotkeys.test.ts:53` and `SessionConsolePanel.test.tsx:508` cover this —
run them after every overlay migration.

### `ConfirmDialog` renders with undefined CSS variables today

It styles itself with `var(--app-bg)`, `var(--app-border)` and `var(--app-text)`.
**None of the three is defined** in `theme.css` (the real names are `--app-bg-surface`,
`--app-border-default`, `--app-text-primary`). So it currently renders with no surface
colour — a live bug.

"Visually neutral" is therefore undefinable for this component. **Fix it as part of the
migration**: use the correct token names, and record the before/after in the commit. Do
not faithfully reproduce a bug in the name of neutrality.

Two more `ConfirmDialog` specifics: its Escape `useEffect` (lines 46–53) **also
implements Enter-to-confirm** — Radix provides no such thing, so preserve it explicitly
rather than deleting the effect wholesale. And `autoFocus` sits on the Confirm button
(line 105) while Radix auto-focuses the first tabbable node (Cancel) — on a destructive
dialog that difference matters. Decide deliberately and record it.

### Three button classes that are used but never defined

`btn-secondary` (18 uses), `btn-ghost` (8), `btn-destructive` (1) appear across the
Session Console, `MapSettingsSheet:449` and `Sidebar:402`. **None is defined in any CSS
file in `src/`.** So `btn btn-secondary` renders as bare `.btn` — padding, radius,
font-size and weight, with a **transparent background and inherited colour**.

Do **not** map them onto shadcn variants by name. `variant="secondary"` ships a real
background; these render transparent. **Map by observed appearance** — all three are
`ghost` today. Screenshot each before and after.

### The `.btn` consumer list — eleven files, not ten

`SessionConsolePanel`, `TrackGroupList`, `sessionConsoleSettingsSections`,
`SessionConsoleBoard`, `ImageSetBoard`, `SessionConsoleMasterBar`,
`SessionConsoleEditorSheet`, `MapSettingsSheet`, `Sidebar`, `MapNavigator`, **and
`DoorControls.tsx`** (lines 88, 100, 111 — `btn btn-default`). `DoorControls` was
missing from an earlier draft, has no unit test and no E2E coverage, and Step 12 deletes
`.btn-default` — miss it and three door-control buttons silently lose their styling.

### The mobile surface

`MobileToolbar.tsx` (325 lines) is a complete second toolbar rendered when
`isMobile` is true; `MobileSidebarDrawer.tsx` (91) and `MobileBottomSheet.tsx` (107) are
its overlays. Steps 5 and 11 cover them. Leaving them hand-rolled would guarantee "two
component systems" for every touch user — the outcome this program exists to prevent —
while `README.md` sells touch and pen as first-class.

### The cascade-layering behaviour change

`src/index.css` imports `app.css` **unlayered**; Tailwind v4 emits utilities into
`@layer utilities`; unlayered CSS beats any layer regardless of specificity. Two
consequences:

1. **The pause button is grey today.** `src/App.tsx:564-568` carries `.btn-tool` *and*
   `bg-red-500`/`bg-green-500`/`text-white`; `.btn-tool` wins, so the pause state never
   shows. Migrating to a CVA `Button` puts those colours in the same layer and **the
   pause button starts working**. That is a fix, and it is **expected** — do not treat
   it as a regression, and do not try to preserve the grey.
2. More generally, wherever a `.btn*` class and a Tailwind colour utility sit on the
   same element, the migration changes which one wins. Screenshot before and after.

### Other constraints

- **Dual-window architecture.** `src/App.tsx:485-500`, under the comment *"Global
  components (rendered in both Architect and World View)"*, renders `Toast`,
  `ConfirmDialog`, `DungeonGeneratorDialog`, `AboutModal` and `UpdateManager`.
  **Dialogs render in the World View by design, today.** Do not "fix" that. The rule is
  narrower than an earlier draft stated: no *new* DM chrome may appear there, and the
  World View must not regress.
- **396 hardcoded Tailwind palette classes across 35 files, with zero `dark:` variants
  anywhere.** These are the bulk of the theme-invariance problem. Resolve them **in the
  files this plan touches, as you touch them** — replacing e.g. `bg-neutral-800` with a
  themed primitive or token. Do not sweep the other files; record the remaining count in
  Step 14 for plan 006.
- **`tsconfig.json` excludes `**/*.test.tsx`**, so `npm run type-check` does not
  typecheck the colocated tests you edit. `npm run test:run` is the only thing that
  catches a broken test file.
- **Strict ESLint**, `--max-warnings 0`, Husky pre-commit. `.ai-rules.md` is mandatory.

## Inputs & resources

| Purpose | Command | Expected |
|---|---|---|
| Install browsers | `npx playwright install chromium` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Typecheck | `npm run type-check` | exit 0 |
| Unit tests | `npm run test:run` | all pass |
| A11y E2E | `npm run test:a11y` | all pass |
| Web E2E | `npm run build:web && npx playwright test --project=Web-Chromium` | all pass |
| Electron E2E | `npm run build:electron && npx playwright test --project=Electron-App` | all pass |

**The per-step gate**, after every step:
```bash
npm run lint && npm run type-check && npm run test:run && npm run test:a11y \
  && npm run build:web && npx playwright test --project=Web-Chromium
```
Run the Electron project at Steps 0, 8, 13 and 14 (it is slow; the web project catches
most regressions).

## Scope

**In scope**: the sixteen components in the overlay inventory (minus the two
`ErrorFallbackUI` exclusions and `PreferencesDialog`), the eleven `.btn` consumers, the
`.sidebar-input`/`.sidebar-token`/`.info-box` consumers, `MobileToolbar.tsx`,
`src/App.tsx`, `src/styles/app.css`, `src/components/ui/**` (variant fixes),
`src/components/ui/README.md`, and the colocated unit tests of migrated components.

**Out of scope**:
- **Any visual or IA change** beyond the documented, expected consequences above
  (`ConfirmDialog`'s undefined variables, the pause button, `btn-ghost` mapping). Record
  ideas in `docs/planning/ui-redesign-ideas.md` instead.
- **`ErrorFallbackUI.tsx` and `UpdateErrorFallbackUI.tsx`** — see inventory.
- **`PreferencesDialog.tsx`** — dead code; decision deferred to Step 12.
- **`src/components/AssetLibrary/CommandPalette.tsx`** — out of the roster entirely.
- **`src/components/Canvas/**`** — except that `ImageCropper` is *mounted* at
  `CanvasManager.tsx:1140`; see Step 4's note.
- **Renaming any `data-testid`.** Adding one is encouraged.
- **Performance refactoring** — plan 005, which runs after this.
- **The 396 hardcoded classes in files this plan does not touch.**

## Working approach

Branch: `claude/ui-redesign-plan-xnyz33`. **One commit per step**, each releasable.

**Migration recipe**, applied identically:
1. Read the component fully. **Screenshot it** (both themes) and note its behaviour.
2. Replace hand-rolled markup with the primitive. Preserve every `data-testid` **and
   every `data-esc-owns="true"`**.
3. Replace that component's inline `style={{}}` objects and hardcoded palette classes.
4. Update its colocated unit test if one exists.
5. Run the per-step gate.
6. Compare against the Step 0 screenshot; confirm Escape, Tab and focus restoration.
7. Commit.

## Steps

### Step 0: Capture the baseline

For every component in Scope, in both themes, capture a screenshot and a short
behaviour note (what opens it, what closes it, what focus does). Save under
`docs/planning/ui-migration-baseline/`.

Also record the starting numbers: `grep -rn "style={{" --include=*.tsx src | wc -l`
(286 at `d3d3642`), the hardcoded-palette-class count (396), `wc -l src/styles/app.css`,
and the built CSS byte size from `npm run build:web`.

Run the full gate including both E2E projects and record the result.

**Check**: The baseline directory exists with a screenshot per component per theme.
**Without this, Steps 8, 12, 13 and 14 have nothing to diff against** — several of these
components have no automated coverage at all.

### Step 1: Migrate `Tooltip` — the rehearsal

Replace `src/components/Tooltip.tsx`'s internals with the `tooltip` primitive, keeping
its public props API so `HomeScreen`, `Sidebar`, `QuickTokenSidebar` and `App.tsx` need
no edits.

Three real differences to decide and record, not discover: today's Tooltip wraps
children in `<div className="inline-flex">` (Radix with `asChild` drops that wrapper — a
layout change inside a flex toolbar); it fires on `mouseenter` only (Radix also opens on
focus, which is an a11y improvement); and it positions by hand at `rect.top - offset`
with no collision detection (Radix flips near edges). **The flip is a behaviour change,
not a restoration** — an earlier draft asserted it as if it were current behaviour.

Also replace its hardcoded `bg-neutral-900` / `text-white` / `border-neutral-600`.

**Check**: Per-step gate. Tooltips appear on the toolbar, sidebar and home screen,
positioned as before. Toolbar layout unchanged versus the Step 0 screenshot. World View
unaffected.

### Step 2: Migrate `ToggleSwitch` and `CollapsibleSection`

Adapters again, preserving both public APIs so the five consumers need no changes. Note
`ToggleSwitch` has a richer API than the `switch` primitive (`checked`, `onChange`,
`label`, `description`, `disabled`, `id`) — the adapter must recompose `Switch` + `Label`
+ description.

**Check**: Per-step gate. Toggles in Map Settings and the Session Console work and are
keyboard-operable. Sidebar sections expand and collapse.

### Step 3: Migrate `ConfirmDialog` — the proof point

Rebuild on `dialog`. Specifically:
- **Fix the undefined CSS variables** (`--app-bg` → `--app-bg-surface`, `--app-border` →
  `--app-border-default`, `--app-text` → `--app-text-primary`). Record before/after.
- **Preserve Enter-to-confirm** from the effect at lines 46–53.
- **Re-attach `data-esc-owns="true"`** (currently line 78).
- **Decide the initial-focus question** (Confirm via `autoFocus` today vs Radix's first
  tabbable, Cancel) and record the choice. On a destructive dialog, Cancel is the safer
  default.

**Check**: Per-step gate, plus `npm run test:run -- useSessionConsoleHotkeys` and
`SessionConsolePanel`. In `npm run dev`: File → New Campaign opens it; Escape closes it;
Tab cycles within; focus restores; Enter confirms; **and with Session Console audio
playing, Escape closes the dialog without stopping playback.**

### Step 4: The three overlays with no a11y at all

Highest value per unit of effort — no `role="dialog"`, no `aria-modal`, no Escape, no
focus trap. Three separate commits.

- `MapSettingsSheet.tsx` (461) → **`sheet`**
- `AssetLibrary/AddToLibraryDialog.tsx` (297) → `dialog`
- `ImageCropper.tsx` (271) → `dialog`

**`ImageCropper` mount note**: it is rendered at `src/components/Canvas/CanvasManager.tsx:1140`
as `{pendingCrop && <ImageCropper …/>}` with no `isOpen` prop, and `CanvasManager` is out
of scope. **Contain the Dialog Root entirely inside `ImageCropper`**, defaulting `open`
to true, so the mount site needs no change. If that proves impossible, STOP — do not
edit `CanvasManager`. Also verify `react-easy-crop` still works: drag and zoom, not just
"the dialog opened."

**Check**: Per-step gate after each. Each opens, closes on Escape, traps focus, restores
focus. Compare against Step 0 screenshots. `npm run test:a11y` — these three are the
most likely to move the axe output; record the change.

### Step 5: The Session Console and mobile sheets

Four commits: `SessionConsole/SessionConsoleEditorSheet.tsx` (298),
`SessionConsole/SessionConsoleSettingsSheet.tsx` (68), `MobileSidebarDrawer.tsx` (91),
`MobileBottomSheet.tsx` (107) — all → `sheet`.

Re-attach `data-esc-owns="true"` on the first two.

**Check**: Per-step gate after each. Editor sheet: edit a track, confirm it persists.
Settings sheet: change a setting. Mobile drawers: verify with device emulation at a
mobile viewport — they only render when `isMobile`.

### Step 6: The Asset Library overlays

Two commits: `AssetLibrary/LibraryManager.tsx` (442) and
`AssetLibrary/TokenMetadataEditor.tsx` (322) → `dialog`. Neither has Escape or
`aria-modal` today; both are primary DM surfaces.

Both are heavy users of hardcoded palette classes (`LibraryManager` 22,
`TokenMetadataEditor` 26) — replace them as you go.

**Check**: Per-step gate after each. Open the library, add a token, edit its metadata,
close. Escape works, focus traps and restores.

### Step 7: `UpdateManager`

`UpdateManager.tsx` (634 lines, 21 inline styles) → `dialog`. Re-attach
`data-esc-owns` (line 538). Update its colocated test and the error-boundary test.

**Remove the redundant Escape branch at `src/App.tsx:275`** (`isUpdateManagerOpen`) —
it now races Radix's `onEscapeKeyDown`. An earlier draft flagged this only for
`AboutModal`; both have it.

**Check**: Per-step gate. Update Manager opens, its states render, Escape closes once
(not twice), focus traps.

### Step 8: `AboutModal`

`AboutModal.tsx` — 858 lines, 40 inline styles, a 212-line `modalStyles` template
literal, hand-rolled tabs, and the **only** working focus trap (255–297).

Replace the overlay with `dialog` and **delete the hand-rolled focus trap**. Use `tabs`
for the tab strip. Re-attach `data-esc-owns` (line 334). Remove the redundant
`App.tsx:270` Escape branch.

The `modalStyles` template literal defines classes used only inside this file — check
for class names invisible to any external grep before deleting anything.

**Check**: Per-step gate **plus both E2E projects**. `?` opens it; Escape closes once;
Tab cycles; focus restores; "Check for Updates" opens the Update Manager. Record
before/after line count. Check whether the `eslint-disable max-lines-per-function` at
line 237 can now go.

### Step 9: `DungeonGeneratorDialog`

→ `dialog`. Re-attach `data-esc-owns` (line 91). Update
`DungeonGeneratorDialog.test.tsx`; confirm `DungeonGeneratorErrorBoundary.test.tsx`
still passes.

**Check**: Per-step gate. Generate a dungeon end to end; the result renders on canvas.

### Step 10: The desktop toolbar

In `src/App.tsx`, replace `btn btn-tool` / `btn btn-mode` / `btn btn-broadcast` with the
`Button` primitive's `tool` / `mode` / `broadcast` variants, and `.toolbar-divider`
(`:581`, `:648`, `:683`) with `separator`.

Decide how the `active` state maps — today it is a template-literal class
(`` `btn btn-tool p-2 ${tool === 'select' ? 'active' : ''}` ``). A boolean prop or
`data-state` are both fine; pick one and use it consistently.

**Expect the pause button to start showing red/green.** See the cascade note in Context.
That is a bug fix, not a regression.

Preserve every `aria-label` and `data-testid`.

**Check**: Per-step gate **plus both E2E projects**. Diff against the Step 0 toolbar
screenshots in both themes: identical apart from the pause button now working. Every
tool switches; active state highlights; measurement sub-buttons work; broadcast turns
green. Keyboard shortcuts V/M/E/W/D/R/I still work. If anything else differs, fix the
variant in `src/components/ui/button.tsx`, not with a one-off class in `App.tsx`.

### Step 11: `MobileToolbar`

`MobileToolbar.tsx` (325 lines, 14 inline styles) — the touch-surface counterpart to
Step 10. Migrate to the same `Button` variants.

**Do not shrink any hit target.** Plan 000 recorded the current minimums (48px in
`App.tsx:528-529`, 44px in `TokenInspector`/`HomeScreen`, 56px in `MobileToolbar`) as an
asserted baseline — that spec must stay green.

**Check**: Per-step gate, including plan 000's touch-target spec. Verify at a mobile
viewport: every tool works, the more-menu opens, hit targets unchanged.

### Step 12: The generic `.btn` and input consumers

**At least four commits.** Eleven `.btn` files:
`SessionConsolePanel`, `TrackGroupList`, `sessionConsoleSettingsSections`,
`SessionConsoleBoard`, `ImageSetBoard`, `SessionConsoleMasterBar`,
`SessionConsoleEditorSheet` (finish from Step 5), `MapSettingsSheet`, `Sidebar`,
`MapNavigator`, **`DoorControls`**.

Map by observed appearance, not by class name — `btn-secondary`, `btn-ghost` and
`btn-destructive` are **undefined in CSS** and all render as bare `.btn`, i.e. `ghost`.
Each call site also carries its own sizing (`flex-1 py-1 text-xs`, `w-full py-2 text-sm`,
`p-1`, …); `tailwind-merge` resolves these against shadcn `size` variants differently
from how the CSS cascade did. Screenshot each before and after.

Then the `.sidebar-input` / `.sidebar-token` / `.info-box` consumers. Note:
**`.sidebar-token` is a 64×64 draggable token tile and `.info-box` is a bordered
callout** — neither is an input or a label, and plan 003's roster has no primitive for
either. Convert them to themed markup using tokens; do not force them into `input`.

`QuickTokenSidebar.test.tsx` asserts on `sidebar-token` and on Tailwind utilities —
update those assertions to the new correct behaviour.

**Also in this step**: put the `PreferencesDialog` question to Kyle (delete, or wire up
to a menu item). Record the answer; do not migrate it either way without one.

**Check**: Per-step gate after each commit. Exercise the Session Console, the Sidebar,
the Map Navigator, and the door controls.

### Step 13: Delete the dead legacy styles

Only now. From `src/styles/app.css` delete `.btn`, `.btn-default`, `.btn-primary`,
`.btn-tool` (+states), `.btn-mode`, `.btn-broadcast`, `.toolbar-divider`,
`.sidebar-input`, `.sidebar-token`, `.info-box`.

Prove each has no consumers — **and read the matches, do not trust counts**:

```bash
for c in btn-default btn-primary btn-tool btn-mode btn-broadcast \
         toolbar-divider sidebar-input sidebar-token info-box; do
  echo "=== $c"; grep -rn "$c" --include=*.tsx --include=*.ts src/
done
echo "=== bare btn (expect survivors — read every hit)"
grep -rnE '"[^"]*\bbtn\b[^"]*"' --include=*.tsx src/
```

**`btn` will never reach zero.** It matches `.about-modal-close-btn` and `.dismiss-btn`
/ `.quick-action-btn` in `HomeScreen`'s inline `<style>` block — different classes that
happen to contain the substring. Triage every hit by reading it. Classes defined *and*
used inside a template literal are invisible to any class-name audit, so check
`AboutModal`'s `modalStyles` and `HomeScreen`'s `<style>` block by eye.

Keep the adapters (`Tooltip.tsx`, `ToggleSwitch.tsx`, `CollapsibleSection.tsx`) — a few
lines each, they insulate against shadcn API changes, and deleting them means touching
every call site for no functional gain. Record that as a decision in
`src/components/ui/README.md`.

**Check**: Every deleted class has zero real consumers. Per-step gate plus both E2E
projects. Built CSS smaller than the Step 0 figure — record the delta.

### Step 14: Verify the accessibility win and record what you deferred

For each migrated overlay, confirm all six behaviours and record a results table:
1. Opens from its trigger. 2. Escape closes it. 3. Tab cycles within, never reaching the
canvas. 4. Focus returns to the trigger. 5. `role="dialog"` and `aria-modal="true"` in
the DOM. 6. **`data-esc-owns="true"` present, and Escape does not stop Session Console
audio.**

Then `npm run test:a11y` and diff against plan 000's baseline. Verify the World View
still works and shows nothing new.

Create `docs/planning/ui-redesign-ideas.md` — every visual, layout or IA improvement you
noticed and deliberately did not make, per component, with why. **This is plan 006's
primary input.** You will have read every UI file closely; nobody else will have.

> Do not leave this to the end in practice: append to it **as you go**, from Step 1.
> It is the first thing lost if this plan is truncated, and truncation mid-migration is
> the likeliest failure mode.

Record final numbers: lines added/removed, inline `style={{}}` count (from 286),
hardcoded palette classes remaining (from 396), `app.css` line count, built CSS bytes.

Then the full sweep, including both E2E projects.

**Check**: All commands exit 0. The behaviour table is complete. The ideas document is
non-trivial and covers every migrated component.

## Validation plan

- **The Step 0 baseline is the primary control**, because for many of these components
  it is the only evidence available. The per-step gate is the secondary control.
- **`npm run test:a11y` is the improvement proof** — meaningful only because plan 000
  extended it past the home screen.
- **`npm run test:run -- useSessionConsoleHotkeys` and `SessionConsolePanel`** after
  every overlay migration — the only automated coverage of the `data-esc-owns` protocol.
- **The Step 14 behaviour table is the acceptance artefact.**
- **Kyle confirms** the toolbar (Step 10), the mobile toolbar (Step 11), and a general
  pass at Step 14 — visual equivalence is ultimately a judgement call, and the automated
  coverage of these files is thin.

## Done criteria

- [ ] Step 0 baseline exists: screenshot per component per theme, plus starting metrics
- [ ] All fourteen in-scope overlays use `dialog` or `sheet`
- [ ] `ErrorFallbackUI` / `UpdateErrorFallbackUI` deliberately excluded, reasoning recorded
- [ ] `PreferencesDialog` decision made by Kyle and acted on
- [ ] Every migrated overlay passes the six-point check (table recorded)
- [ ] **`data-esc-owns="true"` re-attached on all nine components that had it**, verified against Session Console audio
- [ ] `ConfirmDialog`'s undefined CSS variables fixed; Enter-to-confirm preserved
- [ ] `AboutModal`'s hand-rolled focus trap deleted
- [ ] Redundant Escape branches removed from `App.tsx` for **both** `AboutModal` and `UpdateManager`
- [ ] Desktop **and** mobile toolbars migrated; pause button now shows red/green
- [ ] Plan 000's touch-target spec still green
- [ ] All eleven `.btn` consumers migrated, `DoorControls` included
- [ ] `btn-secondary`/`btn-ghost`/`btn-destructive` mapped by appearance, not name
- [ ] Legacy classes deleted with every remaining `btn` hit read and triaged
- [ ] No `data-testid` renamed
- [ ] Inline style count and hardcoded-palette-class count both recorded against their baselines
- [ ] `docs/planning/ui-redesign-ideas.md` covers every migrated component
- [ ] Lint, typecheck, unit tests, a11y, and both E2E projects exit 0
- [ ] Every commit leaves the app releasable
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back — do not improvise — if:

- **`src/components/ui/README.md` does not exist** — plan 003 has not landed.
- **Plan 000 has not landed** — check `tests/accessibility.spec.ts` for an editor-route
  scan. Without it there is no a11y gate on any of this.
- **The `sheet` primitive does not exist.** Plan 003 was told it is required, not
  optional; if it was deferred anyway, Steps 4 and 5 cannot proceed.
- **Escape stops Session Console audio** after an overlay migration — `data-esc-owns`
  was dropped.
- **`ImageCropper` cannot be migrated without editing `CanvasManager.tsx`.**
- **`react-easy-crop` breaks** after Step 4.
- **A migrated component differs from its Step 0 screenshot** in a way not documented in
  Context (the pause button, `ConfirmDialog`'s colours, `btn-ghost` mapping, the tooltip
  wrapper). Do not accept it silently and do not "improve" it.
- **You need to rename a `data-testid`.**
- **`npm run test:a11y` regresses.**
- **A touch target would shrink** below plan 000's recorded minimum.
- **A step's diff exceeds ~800 lines.** Split it.
- **You are about to migrate `PreferencesDialog`** without Kyle's answer.

## Handoff / after it lands

- **This is where the program pays off.** After it, adding a dialog is importing one
  primitive instead of reimplementing modal behaviour.
- **What a reviewer should scrutinise most**: (1) the `data-esc-owns` re-attachment —
  silent, easy to miss, and it breaks the DM's music mid-session; (2) the Step 14
  behaviour table; (3) the toolbars, the highest-visibility surfaces with the thinnest
  automated coverage.
- **Plan 005 runs after this** and depends on the toolbar having been extracted here.
- **Deliberately deferred**: all visual and IA change (006), performance (005), the
  `CommandPalette`, the two `ErrorFallbackUI` components, and the ~370 hardcoded palette
  classes in files this plan does not touch.
- **Watch for**: the adapters growing past ~30 lines — at that point they have stopped
  being adapters.
