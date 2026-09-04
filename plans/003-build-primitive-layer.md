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
- **Depends on**: plans/000-repair-verification-infrastructure.md, plans/001-stabilize-styling-foundation.md, plans/002-shadcn-compatibility-spike.md
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

**Tranche C — the richer surfaces.** `sheet`, `popover` and `dropdown-menu` are
**required, not optional**: Step 7 exercises `popover` and `dropdown-menu`, and plan
004 Steps 4-5 migrate `MapSettingsSheet` and `SessionConsoleEditorSheet` onto `sheet`
with no fallback. Only `scroll-area` may be deferred.

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
| Install browsers | `npx playwright install chromium` | exit 0 — `npm install` does not fetch them |
| Lint           | `npm run lint`             | exit 0, zero warnings      |
| Typecheck      | `npm run type-check`       | exit 0                     |
| Unit tests     | `npm run test:run`         | all pass                   |
| Web build      | `npm run build:web`        | exit 0                     |
| Electron dev   | `npm run dev`              | app + World View launch    |
| A11y E2E       | `npm run test:a11y`        | all pass                   |
| Web E2E        | `npm run build:web && npx playwright test --project=Web-Chromium` | all pass |
| Electron E2E   | `npm run build:electron && npx playwright test --project=Electron-App` | all pass — **never run bare `npm run test:e2e`**; it launches the Electron project without building it |

## Scope

**In scope**:
- `components.json`, `src/lib/utils.ts`
- `src/components/ui/**` (all new primitives)
- `src/index.css` (theming bridge, from the plan 002 decision doc)
- `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` (path aliases)
- `.eslintrc.cjs` — a scoped override for `src/components/ui/**`. **Pre-authorised
  for exactly two rules**: `import/no-unused-modules` and `prettier/prettier`. This
  plan's defining premise is that primitives exist with no consumers yet, which
  *guarantees* unused-export warnings; `--max-warnings 0` turns those into failures.
  Anything beyond those two needs the plan 002 decision doc to have named it.
- `src/styles/theme.css` — **new `--app-*` tokens only** (see Step 3's note on
  `.btn-tool`). You may add tokens; you may not change an existing colour value.
- `src/components/DesignSystemPlayground/types.ts` — the `category` union is closed
  (12 members, none of which fit `tooltip`, `select`, `slider`, `tabs`,
  `collapsible`, `separator`, `sheet`, `popover`, `dropdown-menu`, or `scroll-area`).
  Extend it; do not shoehorn primitives into wrong categories.
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

**First, read its verdict line.**
- **GO** → proceed as written.
- **GO-WITH-CAVEATS** → the doc lists each caveat as a required change to this plan.
  Apply them before starting, and note them in `src/components/ui/README.md`.
- **NO-GO** → **STOP.** This plan is hardwired to the CLI path (`components.json`,
  "after generation", the Done criteria). The doc's fallback is "pattern only, no
  CLI" — own primitives built directly on Radix Primitives with CVA. That is a
  different plan and needs rewriting before execution, not improvising during it.

Do not improvise around the install sequence. If a command in that document fails,
that is a STOP condition — the environment has drifted since the spike.

**Expect `npm run lint` to fail on first contact** with `prettier/prettier` (shadcn
emits double quotes; `.prettierrc` sets `singleQuote: true`) and
`import/no-unused-modules` (every unused primitive export). Run `npm run lint:fix`
and `npm run format`, then apply the pre-authorised scoped override from Scope for
whatever remains. This is expected, not drift.

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

Add a temporary probe element to the playground that reads each bridged token
**as a custom property**, not as a computed colour:

```js
getComputedStyle(document.documentElement).getPropertyValue('--color-primary')
```

> **Do not check `getComputedStyle(el).backgroundColor`.** An undefined custom
> property makes `background-color: var(--nope)` compute to the *initial* value,
> `rgba(0, 0, 0, 0)` — a perfectly valid colour string. Every broken token would pass.
> `getPropertyValue` returns `''` for an undefined property, which is the signal you
> want.

**Check**: Every bridged `--color-*` token returns a non-empty value in **both**
`data-theme="light"` and `data-theme="dark"`. Also assert the reverse — that a
deliberately misspelled token returns `''` — so you know the probe works. Remove the
probe afterward.

Then: `grep -nE "#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(|oklch\(" src/index.css` — the only
acceptable matches are inside `@keyframes` blocks. shadcn's `init` writes `oklch(...)`
values and a `.dark` block into this file; delete them, since the bridge supersedes
both.

> **A literal-colour grep will not tell you whether a primitive is on-theme.** shadcn
> components contain no colour literals by construction — they are all class names
> (`bg-blue-500`, `text-white`, `border-neutral-600`). Use this instead, which catches
> a primitive wired to a raw Tailwind palette rather than to the bridge:
> ```bash
> grep -rnE '\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber)-?[0-9]*\b' src/components/ui/
> ```
> That must return nothing. For scale: the same grep over `src/` returns **396 hits
> across 35 files** today, with **zero `dark:` variants anywhere** — the bulk of the
> real theme-invariance problem, resolved per-component in plan 004.

### Step 3: Add Tranche A primitives

Add `button`, `dialog`, `tooltip`, `input`, `label`.

For each, after generation:
- Read the generated file and confirm it uses only bridged Tailwind tokens
  (`bg-primary`, `text-foreground`, `border-border`, …) — never a raw color.
- Confirm it type-checks under this repo's strict settings. `noUncheckedIndexedAccess`
  is `true`; `exactOptionalPropertyTypes` is **`false`** — do not chase it.
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
active-state colours. Two things make this harder than it looks:

**(a) `.btn-tool`'s colours are hardcoded neutrals with no `--app-*` counterpart.**
`rgb(64,64,64)`, `rgb(229,229,229)`, `rgb(82,82,82)`, `rgb(115,115,115)` — none maps
to an existing token, and they are theme-*invariant* today because the toolbar sits on
`#000000`. The rules elsewhere in this plan (no literal colours in a primitive; no
literals in `index.css`) would leave these values with nowhere legal to live.
**Resolution: add new semantic tokens to `src/styles/theme.css`** — e.g.
`--app-toolbar-bg`, `--app-toolbar-fg`, `--app-toolbar-border` — defined per theme,
seeded with today's values for dark. `theme.css` is in scope for *additions* for
exactly this reason. Adding a token is right; putting the literal in the component is
not. The same applies to `.btn-broadcast.active`'s `color: white`, which needs an
`--app-success-solid-text`.

**(b) "Pixel-identical" is not achievable by translating classes, and you should not
promise it.** `src/index.css` imports `app.css` **unlayered**; Tailwind v4 emits
utilities into `@layer utilities`; unlayered CSS beats any layer regardless of
specificity. So today `.btn-tool` *overrides* the utilities on the same element —
which is why the pause button at `src/App.tsx:564-568` renders grey despite carrying
`bg-red-500`/`bg-green-500`. A CVA `Button` emits its variants as utilities in the
*same* layer as those classes, so the cascade outcome changes. Aim for **visually
equivalent in the default state**, and record the pause-button behaviour change
explicitly — plan 004 is told to expect it rather than treat it as a regression.

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
`/design-system` in both themes. Both Playwright projects still pass — nothing has
consumed these yet, so any E2E failure indicates an unexpected global side effect
(most likely a CSS reset introduced by a primitive) and should be reported.

### Step 6: Commit the Tranche B boundary, then add Tranche C

Commit. Then add `sheet`, `popover`, `dropdown-menu`, `scroll-area`.

**Caveat on toast**: shadcn's current toast recommendation is `sonner`, which
brings its own renderer and its own portal. Graphium already has a working
`src/components/Toast.tsx` driven by `showToast` in the Zustand store
(`src/store/gameStore.ts`), consumed throughout the app and in the World View.
Swapping it is a behavior change, not a primitive addition.

**The decision is: do not add `sonner`.** Recording it here rather than leaving it to
the executor, because the stated criterion ("can be driven from `showToast` without
changing a call site") is trivially satisfiable by a subscribing `useEffect` and would
lead two executors to opposite conclusions.

The reasons: `gameStore` models a **single** toast (replaced by newer ones, cleared via
`clearToast`, on a 5s timer in `Toast.tsx:52-60`), while sonner stacks and owns its own
timers, positioning and dismissal — a behaviour change, not a primitive addition. And
`Toast` is mounted **twice** (in `App.tsx` and in the playground shell at
`DesignSystemPlayground.tsx:44`), so a partial swap ships two toast renderers.

Keep `src/components/Toast.tsx`. Record in `src/components/ui/README.md` that toast is
deliberately not a shadcn primitive in Graphium, with these reasons, so it reads as a
decision rather than an oversight.

**Check**: Same four commands green. Tranche C primitives render at
`/design-system`. The toast decision is written down either way.

### Step 7: Prove the Electron dual-window behavior at layer scale

Plan 002 tested one dialog. Now test the layer.

> **`/design-system` cannot host this step.** `src/App.tsx:441-448` returns the
> playground *exclusively* — no Konva canvas, no toolbar, no World View launcher.
> **This step is authorised to add a temporary, dev-only scaffold to `src/App.tsx`**
> that mounts the four primitives inside the real editor. Remove it before the Step 9
> commit. That is not "migrating a feature component"; do not convert a real overlay.

With `npm run dev` running and the scaffold in place, open the World View alongside
the Architect View, then:

1. Open a `dialog`, a `popover`, a `dropdown-menu`, and a `tooltip` **in the editor**.
   Confirm each renders above the Konva canvas, traps focus where appropriate, and
   closes on Escape.
2. With an overlay open, confirm the Konva canvas beneath does not receive pointer
   events — attempt to draw; no stroke may appear.
3. Confirm the World View window is unaffected and shows none of them.
   > This one is close to unfailable — each Electron `BrowserWindow` has its own
   > `document`, and a portal to `document.body` in one cannot render in another. Do
   > it as a smoke check, but do not treat passing it as evidence of anything.
4. Toggle light/dark with an overlay open and confirm it re-themes.
   > Also near-unfailable: `--app-*` are defined on `<html>` and inherit into
   > `document.body`, so a same-document portal cannot escape the theme scope. **The
   > mechanism that *will* actually break light/dark is shadcn's inline `dark:`
   > utilities**, which key off `prefers-color-scheme` rather than this app's
   > `data-theme` attribute. Test *that* instead: set `data-theme="light"` while
   > emulating a dark OS preference, and confirm no `dark:` styling applies. If it
   > does, the `@custom-variant dark` from plan 002 Step 5 is missing or wrong.

**Record the outcome of item 4 in `src/components/ui/README.md`** — it affects how
every overlay primitive is built, and plan 004 migrates nine of them against it.

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

**Check**: Both files exist.

The contract is only real if someone without this plan's context can follow it. Verify
that concretely: **dispatch a subagent with no context from this work**, give it only
the repo path and `src/components/ui/README.md`, and ask it to add a `badge` primitive.
If it satisfies all four lifecycle steps without asking a question, the contract works.
If it stalls, fix the README — that failure *is* the test result.

Practicalities the original framing omitted: `badge` is not in the roster, so **delete
its output after evaluating** (keep the transcript as evidence); and if no subagent
mechanism is available, say so and mark this Done-criteria line **not performed**
rather than silently ticking it.

### Step 9: Full verification

```bash
npm run lint
npm run type-check
npm run test:run
npm run build:web
npm run test:a11y
npm run build:web && npx playwright test --project=Web-Chromium
npm run build:electron && npx playwright test --project=Electron-App
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
- [ ] `sheet`, `popover` and `dropdown-menu` exist (required by Step 7 and plan 004)
- [ ] `scroll-area` exists, **or** its deferral is recorded in `src/components/ui/README.md`
- [ ] `src/components/DesignSystemPlayground/types.ts` `category` union extended for the new primitives
- [ ] The item-4 finding from Step 7 (the `dark:` variant behaviour) is recorded in `src/components/ui/README.md`
- [ ] The `button` primitive has working `tool`, `mode`, and `broadcast` variants matching `src/styles/app.css`
- [ ] `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(" src/components/ui/*.tsx` returns nothing
- [ ] Every primitive is registered and renders at `/design-system` in both themes
- [ ] Electron dual-window portal behavior verified per Step 7, including the theme-scope check
- [ ] `src/components/ui/README.md` exists and passed the Step 8 fresh-reader test
- [ ] An ADR is recorded in `docs/architecture/DECISIONS.md`
- [ ] The toast/`sonner` decision is written down
- [ ] `npm run lint`, `npm run type-check`, `npm run test:run`, `npm run build:web`, `npm run test:a11y`, and both Playwright projects (`--project=Web-Chromium` after `build:web`, `--project=Electron-App` after `build:electron`) all exit 0
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
