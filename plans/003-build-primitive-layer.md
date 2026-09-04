# Plan 003: Build the shared UI primitive layer

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. If anything in "STOP conditions" occurs,
> stop and report — do not improvise. When done, update the status row in
> `plans/README.md`.
>
> **Read `docs/planning/shadcn-adoption-decision.md` before Step 1.** It is the
> output of plan 002 and contains the exact, already-proven install commands, the
> theming bridge, and any ESLint overrides this plan needs. If that file does not
> exist, **STOP** — plan 002 has not been done and this plan is not safe to run.
>
> **Drift check (run first)**:
> `git diff --stat d3d3642..HEAD -- src/index.css src/styles/ package.json tsconfig.json vite.config.ts`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/001-stabilize-styling-foundation.md, plans/002-shadcn-compatibility-spike.md
- **Category**: migration
- **Grounded at**: `d3d3642` (2026-09-04)

## Why this matters

Graphium has no shared component layer. Every dialog, every button variant, every
overlay is built from scratch inside the feature component that needs it. The
concrete evidence: **nine components hand-roll a modal overlay, and exactly one of
them has a focus trap.** `AboutModal.tsx:279–297` implements focus wrapping by
hand; `PreferencesDialog`, `UpdateManager`, `MapSettingsSheet`,
`DungeonGeneratorDialog`, `ConfirmDialog`, `AddToLibraryDialog`,
`SessionConsoleEditorSheet`, and `ImageCropper` do not. Three of those
(`MapSettingsSheet`, `AddToLibraryDialog`, `ImageCropper`) have no `role="dialog"`
or `aria-modal` at all. Four do not handle Escape.

This is the extensibility ceiling in one sentence: **adding a new dialog to
Graphium costs a full rebuild of modal behavior, and the rebuild is usually
incomplete.** That is why the UI feels stale — not because the pixels are dated,
but because changing anything is expensive, so nothing changes.

This plan builds the layer that makes the next four years of UI work cheap. It
adds primitives; it does **not** migrate any existing screen to them — that is
plan 004, deliberately separated so this plan can land and ship without touching
a single user-facing component.

## Context the executor needs

### What already exists that this plan must respect

- **`src/styles/theme.css`** is the source of truth for color. Its semantic
  variables (`--app-bg-surface`, `--app-text-primary`, `--app-accent-solid`, …) are
  audited for WCAG AA compliance in `docs/features/wcag-audit.md`. Primitives
  consume these through the theming bridge established in plan 002 — they never
  define their own colors and never use raw Radix scale names.
- **`src/components/DesignSystemPlayground/`** already exists and is served at the
  `/design-system` route (`src/App.tsx:123`). It has a registry
  (`playground-registry.tsx`, 1274 lines) that renders live component examples with
  copyable snippets. **This is the validation surface for every primitive in this
  plan** — do not build a new one.
- **Dual-window architecture**: `src/App.tsx` branches between an Architect View
  (DM chrome) and a World View (player projection). Primitives must never render DM
  chrome into the World View. Plan 002 Step 6 verified portal behavior here; honor
  its findings.
- **Strict ESLint** with `--max-warnings 0` and a Husky pre-commit hook.
  `.ai-rules.md` at the repo root is mandatory reading: no `any`, enforced import
  ordering, complexity and function-length limits.
- **Existing hand-rolled primitives** that this layer will eventually replace (but
  does **not** delete in this plan): `src/components/Tooltip.tsx`,
  `src/components/Toast.tsx`, `src/components/ConfirmDialog.tsx`,
  `src/components/ToggleSwitch.tsx`, `src/components/CollapsibleSection.tsx`.

### The primitive roster

Derived from what Graphium's existing screens actually build by hand. Delivered in
three tranches so the plan stays shippable at each boundary.

**Tranche A — the load-bearing four** (unblocks plan 004 entirely):

| Primitive  | Why Graphium needs it | Replaces (in plan 004) |
|------------|----------------------|------------------------|
| `button`   | `.btn`, `.btn-tool`, `.btn-mode`, `.btn-broadcast` in `app.css` are four ad-hoc variant systems | `src/styles/app.css` button classes |
| `dialog`   | Nine hand-rolled overlays, one focus trap between them | the nine listed above |
| `tooltip`  | `src/components/Tooltip.tsx` is hand-positioned | `Tooltip.tsx` |
| `input` + `label` | Form fields are re-styled inline in every dialog | `.sidebar-input`, inline field styles |

**Tranche B — the settings surfaces** (unblocks the Preferences/Settings migrations):

| Primitive | Why |
|-----------|-----|
| `switch` | replaces `src/components/ToggleSwitch.tsx` |
| `select` | dropdowns are hand-built in `PreferencesDialog` and `MapSettingsSheet` |
| `slider` | numeric settings (grid size, opacity, audio volume) |
| `tabs` | `PreferencesDialog` and `AboutModal` both hand-roll tab switching |
| `collapsible` | replaces `src/components/CollapsibleSection.tsx` |
| `separator` | replaces `.toolbar-divider` and ad-hoc `border-t` dividers |

**Tranche C — the richer surfaces** (nice-to-have; can be deferred without blocking):

| Primitive | Why |
|-----------|-----|
| `sheet` | `MapSettingsSheet` and `SessionConsoleEditorSheet` are side panels, not dialogs |
| `popover` | color picker, token quick-actions |
| `dropdown-menu` | context menus on tokens and maps |
| `scroll-area` | the token library and session console lists |
| `sonner` (toast) | replaces `src/components/Toast.tsx` — **see the caveat in Step 6** |

**Explicitly not in the roster**: `command`. Graphium already has a working
`src/components/AssetLibrary/CommandPalette.tsx` (420 lines) with its own registry
at `src/utils/commandRegistry.ts`. Replacing it is a feature-level decision, not a
primitive-layer one, and it is out of scope for this entire plan set.

## Inputs & resources

**Read first**: `docs/planning/shadcn-adoption-decision.md` (output of plan 002).

| Purpose        | Command                    | Expected on success        |
|----------------|----------------------------|----------------------------|
| Install deps   | `npm install`              | exit 0                     |
| Lint           | `npm run lint`             | exit 0, zero warnings      |
| Typecheck      | `npm run type-check`       | exit 0                     |
| Unit tests     | `npm run test:run`         | all pass                   |
| Web build      | `npm run build:web`        | exit 0                     |
| Electron dev   | `npm run dev`              | app + World View launch    |
| A11y E2E       | `npm run test:a11y`        | all pass                   |
| Full E2E       | `npm run test:e2e`         | all pass                   |

## Scope

**In scope**:
- `components.json`, `src/lib/utils.ts`
- `src/components/ui/**` (all new primitives)
- `src/index.css` (theming bridge, from the plan 002 decision doc)
- `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` (path aliases)
- `.eslintrc.cjs` (scoped override for `src/components/ui/**`, only if plan 002 found one necessary)
- `package.json` / lockfile (new dependencies)
- `src/components/DesignSystemPlayground/playground-registry.tsx` (register each primitive)
- `docs/architecture/DECISIONS.md` (the ADR in Step 8)
- `src/components/ui/README.md` (the contribution contract in Step 8)

**Out of scope** (do NOT touch, even though they look related):
- **Any existing feature component.** Not `AboutModal`, not `PreferencesDialog`,
  not `Sidebar`, not one of them. This plan *adds* a layer; plan 004 migrates onto
  it. Mixing the two is what turns a shippable increment into a three-week branch.
- **Deleting `src/components/Tooltip.tsx`, `Toast.tsx`, `ConfirmDialog.tsx`,
  `ToggleSwitch.tsx`, or `CollapsibleSection.tsx`.** They stay until their
  consumers migrate in plan 004. Deleting them here breaks the app.
- **`src/styles/app.css` button classes.** They still have live consumers. Removed
  in plan 004.
- **`src/components/Canvas/**`** — Konva rendering, no DOM primitives involved.
- **Performance work** (memoization, code splitting, state hoisting) — plan 005.
- **Any visual redesign decision** — plan 006. Primitives here should look like
  Graphium looks *today*, so that plan 004's migration is provably behavior-neutral.

## Working approach

Branch: `claude/ui-redesign-plan-xnyz33`. **Commit at every tranche boundary** so
the work is releasable at three natural points. Do not open a pull request unless
explicitly asked.

Every primitive follows the same lifecycle, and it is not done until all four hold:
1. Generated/written into `src/components/ui/`.
2. Re-themed onto `--app-*` variables via the bridge — zero literal colors.
3. Registered in the Design System Playground with a live example.
4. `npm run lint && npm run type-check && npm run test:a11y` all green.

## Steps

### Step 1: Execute the proven install sequence

Open `docs/planning/shadcn-adoption-decision.md` and run the install sequence it
records, verbatim — including any peer-dependency flag it identified, the
`tsconfig.json` / `vite.config.ts` / `vitest.config.ts` alias edits, and the
`@theme inline` bridge block for `src/index.css`.

Do not improvise around it. If a command in that document fails, that is a STOP
condition, not a prompt to try something else — the environment has drifted since
the spike and the drift needs to be understood.

Apply the ESLint override for `src/components/ui/**` **only if** the decision doc
concluded one was necessary, and only for the specific rules it named. Do not
blanket-disable linting for the directory.

**Check**:
```bash
npm install && npm run type-check && npm run lint && npm run build:web
```
All exit 0. `components.json` and `src/lib/utils.ts` exist, and `src/lib/utils.ts`
exports a `cn` function.

### Step 2: Verify the theming bridge is complete and correct

The bridge maps shadcn's token names onto Graphium's `--app-*` variables. Before
adding primitives, confirm nothing in it resolves to an undefined variable.

Add a temporary probe element to the playground that renders a swatch for every
bridged token, then in `npm run dev` with DevTools open, confirm each computed
background/color resolves to an actual color rather than the empty string.

**Check**: Every bridged `--color-*` token resolves to a real value in **both**
`data-theme="light"` and `data-theme="dark"`. Remove the probe element afterward.

Then: `grep -nE "#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(|oklch\(" src/index.css` — the only
acceptable matches are inside `@keyframes` blocks, if any. Report anything else.

### Step 3: Add Tranche A primitives

Add `button`, `dialog`, `tooltip`, `input`, `label`.

For each, after generation:
- Read the generated file and confirm it uses only bridged Tailwind tokens
  (`bg-primary`, `text-foreground`, `border-border`, …) — never a raw color.
- Confirm it type-checks under this repo's strict settings, including
  `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- Fix import ordering to satisfy `eslint-plugin-import`.

Then **extend `button` with Graphium's real variants**. `src/styles/app.css`
currently encodes four button behaviors that the stock shadcn variants do not
cover. Add these as CVA variants so plan 004 can migrate cleanly:

- `tool` — the toolbar tool button, with an `active` state that uses
  `--app-accent-solid` (today: `.btn-tool` / `.btn-tool.active`)
- `mode` — the smaller sub-option button (today: `.btn-mode`)
- `broadcast` — like `mode`, but its active state uses `--app-success-solid`
  (today: `.btn-broadcast.active`)

Read `src/styles/app.css` and reproduce the existing padding, font-size, and
active-state colors exactly. The goal is that a migrated toolbar button is
**pixel-identical** to today's, so plan 004's migration is provably neutral.

**Check**:
```bash
npm run lint && npm run type-check && npm run test:run && npm run test:a11y
```
All exit 0. Then in `npm run dev` at `/design-system`, all five primitives render,
and the `tool` / `mode` / `broadcast` button variants are visually
indistinguishable from the equivalents in the live toolbar (compare side by side
with the editor open in another window).

### Step 4: Register Tranche A in the Design System Playground

Add an entry for each new primitive to
`src/components/DesignSystemPlayground/playground-registry.tsx`, following the
shape of the entries already there. Each entry needs a live rendered example, every
variant shown, and a copyable code snippet.

For `dialog`, the example must demonstrate the behaviors that justify the whole
migration: an open trigger, Escape-to-close, focus trapping, and focus restoration
to the trigger.

Note: `playground-registry.tsx` is already 1274 lines. Do not let it grow
unboundedly — if adding these entries pushes it past roughly 1500 lines, split it
into per-category modules (`registry/buttons.tsx`, `registry/overlays.tsx`, …) with
`playground-registry.tsx` re-exporting the composed list.

**Check**: `/design-system` renders every Tranche A primitive with working live
examples. `npm run lint` exits 0 (this file is subject to `max-lines-per-function`,
so watch for it).

### Step 5: Commit the Tranche A boundary, then add Tranche B

Commit. The app is fully functional and shippable at this point — new primitives
exist, nothing consumes them yet.

Then add `switch`, `select`, `slider`, `tabs`, `collapsible`, `separator`, applying
the same four-part lifecycle and registering each in the playground.

For `separator`, reproduce `.toolbar-divider` from `src/styles/app.css` as a variant
so the toolbar migration in plan 004 is a pure swap.

**Check**: Same four commands green. All Tranche B primitives render at
`/design-system` in both themes. `npm run test:e2e` still passes — nothing has
consumed these yet, so any E2E failure indicates an unexpected global side effect
(most likely a CSS reset introduced by a primitive) and should be reported.

### Step 6: Commit the Tranche B boundary, then add Tranche C

Commit. Then add `sheet`, `popover`, `dropdown-menu`, `scroll-area`.

**Caveat on toast**: shadcn's current toast recommendation is `sonner`, which
brings its own renderer and its own portal. Graphium already has a working
`src/components/Toast.tsx` driven by `showToast` in the Zustand store
(`src/store/gameStore.ts`), consumed throughout the app and in the World View.
Swapping it is a behavior change, not a primitive addition.

**Decide, and record the decision, before adding it:**
- If `sonner` can be driven from the existing `showToast` store action without
  changing any call site, add it and note the migration path for plan 004.
- If it cannot, **do not add it**. Keep `Toast.tsx`, and record in
  `src/components/ui/README.md` that toast is deliberately not a shadcn primitive
  in Graphium, with the reason. A working, store-integrated toast is worth more
  than consistency for its own sake.

**Check**: Same four commands green. Tranche C primitives render at
`/design-system`. The toast decision is written down either way.

### Step 7: Prove the Electron dual-window behavior at layer scale

Plan 002 tested one dialog. Now test the layer.

With `npm run dev` running, open the World View alongside the Architect View, then:

1. Open a `dialog`, a `popover`, a `dropdown-menu`, and a `tooltip` from the
   playground in the Architect window. Confirm each renders correctly, traps focus
   where appropriate, and closes on Escape.
2. Confirm **none** of them appear in, or affect, the World View window.
3. With an overlay open in the Architect View, confirm the Konva canvas beneath
   does not receive pointer events.
4. Toggle light/dark theme with an overlay open. Confirm the overlay re-themes —
   this proves portalled content is still inside the `data-theme` scope. **If it
   does not re-theme, the portal is escaping the themed root**, and the fix is to
   give Radix an explicit portal container inside the themed element rather than
   `document.body`. Record whichever applies.

**Check**: All four confirmed and recorded. Item 4 is the subtle one — a portal
that escapes the theme scope will look correct in dark mode (the default) and
silently wrong in light mode.

### Step 8: Write the contribution contract and the ADR

**This step is what makes the layer *extendible* rather than just *present*.**
Without it, the next person adds a primitive their own way and the drift restarts.

Create `src/components/ui/README.md` covering:
- What lives in `src/components/ui/` and what does not (primitives, not features).
- **The rule**: primitives consume `--app-*` theme variables through the bridge in
  `src/index.css`. Zero literal colors. Ever. State it as flatly as
  `src/styles/theme.css` already states it.
- The four-part lifecycle from "Working approach" above, as the checklist for
  adding a primitive.
- How to add a Graphium-specific variant to an existing primitive (the CVA
  pattern), using the `button` `tool`/`mode`/`broadcast` variants as the worked example.
- Which ESLint rules are relaxed for this directory and why, if any.
- The toast decision from Step 6.
- The explicit note that `command` is out of scope and why.

Then add an ADR to `docs/architecture/DECISIONS.md`, matching the format of the
entries already in that file, recording: the decision to adopt shadcn/ui, the
alternatives considered (hand-rolled primitives; pattern-only without the CLI), why
the existing Radix Colors system is bridged rather than replaced, and a link to
`docs/planning/shadcn-adoption-decision.md`.

**Check**: Both files exist. A reviewer who has not read this plan can follow
`src/components/ui/README.md` to add a new primitive correctly. Verify this
concretely: have someone (or a fresh agent with no context from this work) add a
`badge` primitive using only that README as guidance. If they produce something
that satisfies all four lifecycle checks without asking a question, the contract
works. If they don't, fix the README — that failure is the point of the test.

### Step 9: Full verification

```bash
npm run lint
npm run type-check
npm run test:run
npm run build:web
npm run test:a11y
npm run test:e2e
```

Record the `dist-web/` size and compare against the pre-plan baseline captured in
plan 002 Step 1. Note the delta in `src/components/ui/README.md`.

**Check**: All exit 0. The bundle delta is recorded and is within a factor of ~2 of
the extrapolation made in plan 002 Step 7. A much larger delta means something is
bundled wrongly — investigate before closing the plan.

## Validation plan

- **Automated**: the Step 9 sequence. `npm run test:a11y` is the most important
  gate — it runs axe-core against WCAG 2.1 AA in both themes, and it is what proves
  the theming bridge did not quietly break contrast.
- **The playground is the acceptance surface.** Every primitive must render, in
  both themes, at `/design-system`. A primitive that is not in the playground does
  not count as delivered.
- **No new unit tests are required for the primitives themselves.** They are
  third-party-generated code whose behavior is covered by Radix's own test suite;
  writing tests for `Dialog` here would test Radix, not Graphium. The a11y suite
  and the playground cover the integration, which is the part that can actually
  break. Tests come in plan 004, where real behavior migrates.
- **The Step 8 README test is a real gate**, not a formality. An unextendible
  primitive layer is the failure mode this whole plan set exists to avoid.
- **Kyle confirms** that the `tool` / `mode` / `broadcast` button variants are
  visually indistinguishable from today's toolbar buttons.

## Done criteria

- [ ] `docs/planning/shadcn-adoption-decision.md` was read and its install sequence executed
- [ ] `components.json` and `src/lib/utils.ts` (exporting `cn`) exist
- [ ] Path aliases resolve in `tsconfig.json`, `vite.config.ts`, and `vitest.config.ts`
- [ ] All Tranche A and Tranche B primitives exist in `src/components/ui/`
- [ ] Tranche C primitives exist, **or** their deferral is recorded in `src/components/ui/README.md`
- [ ] The `button` primitive has working `tool`, `mode`, and `broadcast` variants matching `src/styles/app.css`
- [ ] `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(" src/components/ui/*.tsx` returns nothing
- [ ] Every primitive is registered and renders at `/design-system` in both themes
- [ ] Electron dual-window portal behavior verified per Step 7, including the theme-scope check
- [ ] `src/components/ui/README.md` exists and passed the Step 8 fresh-reader test
- [ ] An ADR is recorded in `docs/architecture/DECISIONS.md`
- [ ] The toast/`sonner` decision is written down
- [ ] `npm run lint`, `npm run type-check`, `npm run test:run`, `npm run build:web`, `npm run test:a11y`, `npm run test:e2e` all exit 0
- [ ] **No existing feature component was modified** (`git diff --stat` confirms only in-scope paths)
- [ ] Bundle delta recorded
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back — do not improvise — if:

- **`docs/planning/shadcn-adoption-decision.md` does not exist.** Plan 002 has not
  run. Do not attempt the install by guessing.
- **A command from that decision doc fails.** The environment has drifted since the
  spike. Report the failure; do not substitute a different command.
- **`npm run test:a11y` fails at any tranche boundary.** Report the exact axe
  violation and which primitive introduced it. Do not weaken the test, and do not
  hardcode a color to satisfy it.
- **A primitive requires a literal color to look right.** That means the theming
  bridge is missing a token. Add the token to the bridge; do not add the color to
  the component.
- **An overlay fails to re-theme in Step 7 item 4.** The portal is escaping the
  themed root. Report it — the fix (an explicit portal container) affects every
  overlay primitive and should be decided once, not per-component.
- **You find yourself needing to modify an existing feature component** to make a
  primitive work. That is plan 004's scope and a sign this plan has grown.
- **`sonner` cannot be driven from the existing `showToast` store action.** Do not
  refactor the store to accommodate it. Keep `Toast.tsx` and record the decision.
- **The bundle delta is more than ~2× the plan 002 extrapolation.**

## Handoff / after it lands

- **Plan 004 consumes this directly** and is where the value is realized — until
  screens migrate, this layer is pure cost. Do not let 003 land and 004 stall; that
  is the worst outcome in the set (two component systems, permanently).
- **What a reviewer should scrutinize most**: (1) the `button` variants — if they
  don't match today's toolbar exactly, plan 004's migration stops being provably
  neutral and becomes a redesign by accident; (2) `src/components/ui/README.md` —
  it is the only thing preventing the drift from restarting.
- **Deliberately deferred**: `command` (Graphium's palette works and is
  feature-coupled), toast (decided in Step 6), and every visual change (plan 006).
- **Watch for**: `src/components/ui/` accumulating feature components. It is for
  primitives. A `TokenCard` is not a primitive.
