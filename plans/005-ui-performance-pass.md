# Plan 005: Fix the DOM-layer performance drags

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. **This plan is measurement-first**: Step 1
> builds the instrument, Step 2 establishes a baseline, and no optimisation is
> accepted without a before/after number. If anything in "STOP conditions" occurs,
> stop and report — do not improvise. When done, update the status row in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat d3d3642..HEAD -- src/App.tsx src/components/ vite.config.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/000-repair-verification-infrastructure.md, plans/001-stabilize-styling-foundation.md, **plans/004-migrate-screens-to-primitives.md**
- **Category**: perf
- **Grounded at**: `d3d3642` (2026-09-04)

> **This plan must run AFTER plan 004, not in parallel.** An earlier draft said it
> could run alongside 003/004. That was wrong in both directions. 004 rewrites most of
> the components this plan optimises — but worse, **004 would silently revert this
> plan's work**: Step 5 here moves tool state into a store, and 004 Step 8 rewrites the
> exact toolbar that reads it; Step 4 here adds `lazy()` boundaries around the exact
> five modals 004 Steps 4–7 rewrite. Plan 004 contains no instruction to preserve
> either. Running this first means doing it twice.

## Why this matters

Graphium's **canvas** rendering is already well optimised — see
`docs/architecture/PERFORMANCE_OPTIMIZATIONS.md` (delta-based IPC, cached visibility
polygons, Web Worker image processing) and `docs/architecture/PERFORMANCE_MINIMAP.md`.
Do not redo that work.

The **DOM chrome layer** has had none of that attention, but the specific problems are
narrower than they first appear, and an earlier draft of this plan got them wrong.
The corrected picture:

**What is already fine.** `src/components/Sidebar.tsx:477` is `export default memo(Sidebar)`
and `Sidebar` takes **no props** (`function Sidebar(): JSX.Element` at :97, rendered as
`<Sidebar />`). A memoised zero-prop component cannot re-render because its parent did.
`src/components/Canvas/CanvasManager.tsx:1489` is likewise `export default memo(CanvasManager)`,
and on a token selection its props are all unchanged primitives plus a stable `useState`
setter — so it does not re-render then either. There are **twelve** `memo()` call sites,
not eleven; a grep that missed `export default memo(...)` produced the earlier claim
that the chrome layer had none.

**What is actually wasteful.** `src/App.tsx` holds `tool`, `color`, `recentColors`,
`doorOrientation`, `measurementMode` and `selectedTokenIds` in local state (lines
134–162). Every change re-renders `App`'s whole return tree. The memoised components
bail out; **these do not**, because they are unmemoised children of `App`:
`ThemeManager`, `SyncManager`, `PauseManager`, `Toast`, `ConfirmDialog`,
`DungeonGeneratorDialog`, `AboutModal` (858 lines), `UpdateManager` (634 lines),
`AutoSaveManager`, `SessionConsoleEscapeStop`, `CommandPalette`, and every `Tooltip` in
the inline toolbar. That is the real waste. It is modest, and it is not what the earlier
draft pointed at.

**One concrete memo trap.** `src/App.tsx:739-742` passes
`onClose={() => setSelectedTokenIds([])}` — a fresh arrow on every render — to
`TokenInspector` (481 lines), defeating any memo placed on it.

**Bundle.** The 1274-line `playground-registry.tsx` and the 398-line playground are
statically imported at `src/App.tsx:21` for a route no end user visits. `HomeScreen.tsx`
(1792 lines) is static. There is no manual chunking.

**The discipline this plan enforces: measure first, and reject any change without a
number.** Step 1 exists because the earlier draft assumed a measurement tool that is
not installed in this repo.

## Context the executor needs

### The measurement problem, and the fix

An earlier draft told the executor to use the React DevTools Profiler. **That is not
available here**: there is no `react-devtools` or `react-devtools-core` in
`package.json`, no `<Profiler>` instrumentation in `src/`, and `electron/main.ts` loads
no extension (`{ role: 'toggleDevTools' }` at :287 opens plain Chrome DevTools, which
has no React tab). Step 1 builds the instrument instead of assuming it.

Two instruments are available and both should be used:

1. **React's built-in `<Profiler>` API** — `import { Profiler } from 'react'` is part of
   React itself, needs no extension, and its `onRender` callback yields exactly the
   render counts and durations this plan trades in. This is the primary instrument.
2. **`src/components/ResourceMonitor.tsx`** (553 lines) — already in the repo, already
   tracks live FPS and memory, has its own section in
   `docs/architecture/PERFORMANCE_OPTIMIZATIONS.md:399`, and is toggled from the
   Electron menu. `src/utils/stressFixture.ts`'s own docstring says the fixture exists
   *"for Resource Monitor baselines."* Use it for frame-rate effects.

### The stress fixture

`src/utils/stressFixture.ts` is triggered by the **`?stress=1`** query parameter
(`shouldAutoloadStressFixture`, lines 74–79). Note two limits: it creates
`TOKEN_COUNT = 200` tokens and sets `map: null`, whereas
`docs/architecture/PERFORMANCE_OPTIMIZATIONS.md:9` targets **500+ tokens with large
maps**. So it is a lighter load than the documented problem scenario — say so in the
baseline rather than implying parity.

Because Electron's dev window loads `VITE_DEV_SERVER_URL` with no query string and has
no address bar, **use `npm run dev:web` and `http://localhost:5173/?stress=1`** for
profiling. The Electron build is for the frame-rate checks via ResourceMonitor.

### Facts that constrain the work

- **`ImageCropper` lives behind `src/components/Canvas/`.** It is imported at
  `src/components/Canvas/CanvasManager.tsx:11` and rendered at :1140 as
  `{pendingCrop && <ImageCropper …/>}`. It is **not** imported by `App.tsx`. Since this
  plan forbids touching `src/components/Canvas/**`, `ImageCropper` is **out of scope
  for lazy-loading**. The earlier draft listed it; that was a self-collision.
- **`PreferencesDialog` is dead code.** Zero importers anywhere; the file carries
  `// eslint-disable-next-line import/no-unused-modules` at :677. Do not lazy-load it,
  and do not treat it as a bundle win — it may already be tree-shaken. Plan 004 decides
  its fate.
- **The modals are mounted unconditionally.** `src/App.tsx:488-499` renders
  `<ConfirmDialog />`, `<DungeonGeneratorDialog />`, `<AboutModal isOpen={…} />`,
  `<UpdateManager isOpen={…} />`; each returns `null` internally when closed.
  `React.lazy` on an always-mounted component **fetches its chunk at mount and defers
  nothing.** Making the split pay off requires gating the render site
  (`{isAboutOpen && <AboutModal …/>}`), which changes mount/unmount semantics — state
  resets, effect timing, focus behaviour. See Step 4; this is a real behaviour change
  and needs its own verification.
- **The toolbar is inline JSX inside `App()`**, roughly `src/App.tsx:548-753`, reading
  `tool`, `color`, `doorOrientation`, `measurementMode`, `isGamePaused` and
  `broadcastMeasurement` from the closure. There is no `Toolbar` component to subscribe
  to a store. Extracting one is **plan 004 Step 8's job**, not this plan's — which is
  the other reason this plan runs after 004.
- **`selectedTokensOnly`** at `src/App.tsx:195-197` is a `useGameStore` selector that
  **closes over the local `selectedTokenIds`**. Moving that state to another store makes
  the derivation span two stores; restructure it carefully (stale-closure risk).
- **`vite.config.ts` has no `build` block for the Electron target** — the whole `build`
  key sits inside `...(isWeb && { … })`. Manual chunking applies to the web build only.
- **Five store precedents exist**, not one: `pointerOverlayStore.ts` (52),
  `preferencesStore.ts` (70), `touchSettingsStore.ts` (223), `visionStore.ts` (21), plus
  `sessionConsoleReducers.ts` (779) which is a *slice of gameStore*. The repo contains
  both patterns; pick deliberately.
- **`tests/performance/drawing-performance.spec.ts`** was in `playwright.config.ts`'s
  `testIgnore` and selected zero tests in every project. **Plan 000 either restored or
  deleted it** — check which before citing it. If deleted, this plan has no prior perf
  spec to model.

## Inputs & resources

| Purpose | Command | Expected on success |
|---|---|---|
| Install deps | `npm install` | exit 0 |
| Install browsers | `npx playwright install chromium` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Typecheck | `npm run type-check` | exit 0 |
| Unit tests | `npm run test:run` | all pass |
| Web build | `npm run build:web` | exit 0 |
| Web dev (profiling) | `npm run dev:web` then `/?stress=1` | app loads with 200 tokens |
| Electron dev | `npm run dev` | Architect window launches |
| A11y E2E | `npm run test:a11y` | all pass |
| Web E2E | `npm run build:web && npx playwright test --project=Web-Chromium` | all pass |
| Electron E2E | `npm run build:electron && npx playwright test --project=Electron-App` | all pass |

Read first: `docs/architecture/PERFORMANCE_OPTIMIZATIONS.md`,
`docs/architecture/PERFORMANCE_MINIMAP.md`, `docs/planning/verification-baseline.md`
(from plan 000).

## Scope

**In scope**: `src/App.tsx`, a new UI store under `src/store/`, `vite.config.ts`,
memoisation of named DOM-layer components where measured, a temporary `<Profiler>`
harness, `tests/performance/`, `docs/architecture/PERFORMANCE_OPTIMIZATIONS.md`.

**Out of scope** (do NOT touch):
- **`src/components/Canvas/**` and fog-of-war raycasting** — already tuned. This also
  means `ImageCropper` is out of scope for lazy-loading (see Context).
- **`src/components/SyncManager.tsx` delta IPC** — same reason.
- **Extracting a `Toolbar` component** — plan 004 Step 8.
- **Blanket `React.memo`.** Every memo needs a measurement. A memo without a number is
  reverted.
- **Any visual change** (plan 006) or **any behaviour change** — with the single
  documented exception of the modal mount-gating in Step 4, which is measured and
  verified explicitly.
- **`src/workers/`**, and any dependency upgrade.

## Working approach

Branch off `main` as `plan/005-ui-performance`. One commit per step. Every optimisation
commit message must carry its before/after numbers.

### How this plan lands: one PR per plan, targeting `main`

**This is the program-wide rule; it is identical in every plan.** Each plan is
developed on its own branch off `main` and merged as a **single pull request into
`main`** before the next plan begins.

That choice exists for one reason: **it is the only way CI runs.** Verified in
`.github/workflows/`:

| Workflow | Trigger | What it gates |
|---|---|---|
| `lint.yml` | `pull_request` → `main` | ESLint + `tsc` |
| `test.yml` | `pull_request` → `main` | Vitest |
| `e2e.yml` | `pull_request` → `main` | Playwright, **per project, after the matching build** |
| `accessibility.yml` | `pull_request` → `main` or `NEXT` | axe WCAG AA |
| `documentation-check*.yml` | `pull_request` → `main` | doc-drift comment |

Nothing fires on a long-lived feature branch. Under the original "one branch, don't
open a PR" approach, ~40 commits of work would have been gated only by local
`npm run` on one machine — which is how the unverified-gate problem this program was
revised to fix got in.

**Consequences to know before you start:**

- **`e2e.yml` is the reference for how to run Playwright** — it runs
  `--project=Web-Chromium` after `npm run build:web` and `--project=Electron-App` under
  `xvfb-run` after `npm run build:electron`. Never bare `npm run test:e2e`.
- **Merging to `main` auto-deploys the public web build.** `deploy-web.yml` runs on
  every push to `main`. Intermediate states of the migration will go live on GitHub
  Pages. That is consistent with the strangler-fig principle that every commit is
  releasable, but it is a real consequence — if the web demo must stay pinned, say so
  before starting rather than after.
- **Local gates still come first.** CI is the enforcement, not the discovery. Run the
  full local gate before every push; a red PR costs a cycle and reviewer trust.
- **Keep the PR reviewable.** Push each step as its own commit with a descriptive
  message so a reviewer can read the plan's steps in the commit history. If a plan's PR
  grows past roughly 1,500 changed lines, split it at a step boundary named in the plan
  and land the halves in order.
- **`build-release.yml` fires on `v*.*.*` tags only** — nothing here triggers a release.
  Versioning and `CHANGELOG.md` entries are a separate decision, noted in
  `plans/README.md`.


> **On enforcement, honestly**: the "no memo without a number" rule cannot be enforced
> by a command — an executor could write numbers from imagination. Step 1 is what makes
> it real: the `<Profiler>` harness writes measurements to a file, and Step 8 requires
> those files as artefacts. A reviewer should check the artefacts, not the prose.

## Steps

### Step 1: Build the measurement instrument

Add a temporary profiling harness — not shipped, removed in Step 8.

Wrap `App`'s return tree in React's built-in `<Profiler id="app" onRender={…}>` and
have `onRender` append `{id, phase, actualDuration, timestamp}` to an in-memory array
exposed on `window.__profile`. Wrap the components named in "Why this matters"
individually so their renders are attributable. Add a helper that dumps the array as
JSON to the clipboard or console.

Gate the whole harness behind `import.meta.env.DEV` so it cannot reach production.

**Check**: With `npm run dev:web` and `/?stress=1`, pressing a tool key produces
entries in `window.__profile`. Prove the instrument discriminates: confirm
`CanvasManager` appears on a **tool switch** (it consumes `tool`, so it must) and does
**not** appear on a **token selection** (it is memoised with stable props). If that
distinction does not show up, the harness is wrong — fix it before measuring anything.

### Step 2: Record the baseline

With the harness in place, `npm run dev:web`, `/?stress=1`:

1. **Tool switch** — press `V`, `M`, `E`. Dump `window.__profile`.
2. **Token selection** — click a token, then shift-click three more. Dump.
3. **Initial load** — time launch to interactive editor.
4. **Frame rate** — enable ResourceMonitor (Electron View menu) and record idle and
   during-drag FPS with the stress fixture loaded.

Then the bundle baseline:
```bash
npm run build:web
find dist-web -name '*.js' -o -name '*.css' | xargs wc -c | tail -1
ls -la dist-web/assets/
```
Use exact bytes; `du -sh` rounds to units in which the deltas here are invisible.

Save everything as `docs/planning/ui-perf-baseline.md`, with the raw JSON dumps
committed alongside. **Commit this before any optimisation.**

**Check**: The file exists, contains render counts per component for scenarios 1–2,
FPS figures, and exact byte totals. It must show `CanvasManager` re-rendering on tool
switch and not on selection — if it shows otherwise, the harness or this plan's model
of the code is wrong. STOP and report.

### Step 3: Code-split the Design System Playground

Change the static import at `src/App.tsx:21` to `lazy()`, matching the `WorldStage`
pattern at `src/App.tsx:46`, and wrap the render site (`src/App.tsx:441-448`) in
`<Suspense>`. No user-facing path touches this boundary, so a `null` fallback is fine.

Be honest about the size of this win when you record it. The playground's imports —
`react`, `@remixicon/react`, `gameStore`, `ToggleSwitch`, `UpdateManager`,
`services/storage`, `ConfirmDialog`, `ThemeManager`, `Toast` — are **all already
imported by `App.tsx`** and stay in the main chunk. What leaves is the playground's own
source, much of which is example-code template literals that compress well. Also note
the route is unreachable in packaged Electron (`electron/main.ts:378` loads
`graphium://app/index.html`, so `pathname` is `/app/index.html`), so for the desktop
product this saves a local file read either way.

**Check**: `npm run build:web` produces a separate playground chunk and the main chunk
shrinks. Record exact bytes. `npm run dev:web` → `/design-system` still renders fully.

### Step 4: Code-split `HomeScreen`, and gate the modal mount sites

Two different changes; do them as two commits.

**4a — `HomeScreen`.** 1792 lines, unmounted on entry to the editor. Convert to
`lazy()` + `Suspense`. It is the *first* thing rendered on the web build, so splitting
it turns one request into two on the critical path. **If a fallback frame is visible on
launch, revert this commit** — first-paint quality outranks a bundle number. Expect
that outcome as likely.

**4b — the modals.** `AboutModal`, `UpdateManager`, `DungeonGeneratorDialog` are
mounted unconditionally and return `null` internally, so `lazy()` alone defers nothing.
To get any benefit you must **also gate the render sites**:

```tsx
{isAboutOpen && <AboutModal isOpen={isAboutOpen} … />}
```

This is a real behaviour change — the component now unmounts on close, resetting
internal state and re-running effects. Verify explicitly for each: open, interact,
close, reopen, and confirm nothing was lost that the user would expect to persist. If
any modal depends on staying mounted, leave it static and record why.

Do **not** include `ImageCropper` (lives under `src/components/Canvas/`, out of scope)
or `PreferencesDialog` (dead code, no importers).

**Check**: Separate chunks exist; main chunk shrinks (record bytes). No launch flash
(4a). Each gated modal opens with no perceptible delay and survives close/reopen (4b).
Lint, typecheck, unit tests, and both E2E projects pass.

### Step 5: Add manual chunking for stable vendor code

In `vite.config.ts`, add `build.rollupOptions.output.manualChunks` **inside the
existing `...(isWeb && { build: {…} })` block** — there is no Electron `build` block to
add it to, and inventing one is out of scope. Separate `konva` + `react-konva`,
`react` + `react-dom`, and `@remixicon/react`.

Be honest in the record: Electron loads from `graphium://` off the local filesystem, so
there is no HTTP cache to benefit. This helps repeat visitors to the GitHub Pages web
build only.

**Check**: Named vendor chunks appear. Total bytes across all chunks stays within 2% of
Step 4 — this redistributes rather than reduces; a larger total means a module is
duplicated across chunks. `npm run build:web` and `npm run build:electron` both exit 0.

### Step 6: Move tool state out of `App.tsx` into a store

Move `tool`, `color`, `recentColors`, `doorOrientation`, `measurementMode` and
`selectedTokenIds` into a **new `src/store/uiStore.ts`**.

A separate store, not a `gameStore` slice: this is ephemeral UI state that must not be
serialised into `.graphium` campaign files or broadcast over IPC to the World View, and
a separate store makes that structural rather than conventional. Follow the shape of
`src/store/preferencesStore.ts` or `touchSettingsStore.ts`. Write a colocated unit test
— `src/store/gameStore.test.ts` (1432 lines) establishes that stores get tests here.

`recentColors` is the only one of the six with a claim to durability. Keep it
session-only for now and note the question; persistence is a product decision.

Restructure `selectedTokensOnly` (`src/App.tsx:195-197`) carefully — it currently
closes over local `selectedTokenIds` and will now span two stores.

**Be precise about what this can and cannot achieve.** `CanvasManager` receives `tool`
as a prop and **must** re-render when the tool changes, wherever the state lives —
moving it to a store relocates the subscription, it does not remove the render. Do not
set that as a goal. The achievable win is that `App`'s *unmemoised* children
(`ThemeManager`, `SyncManager`, `PauseManager`, `Toast`, `ConfirmDialog`,
`AboutModal`, `UpdateManager`, `AutoSaveManager`, `CommandPalette`, the toolbar
`Tooltip`s) stop re-rendering on every tool switch and selection change.

**Check**: Re-run Step 2 scenarios 1 and 2 and diff against
`docs/planning/ui-perf-baseline.md`. The named unmemoised components must show
**zero** renders on a tool switch. Record before/after counts in the commit message.
Then exercise every tool manually: V/M/E/W/D/R/I shortcuts, drawing, erasing, wall
placement, door placement and rotation, all three measurement modes, and the broadcast
toggle. Lint, typecheck, unit tests, both E2E projects pass.

### Step 7: Memoise only what the profiler still shows

Re-measure after Step 6; some candidates will have disappeared.

For anything still re-rendering wastefully, apply `React.memo` plus `useCallback` on
the props causing it. Start with the one confirmed trap: `TokenInspector` at
`src/App.tsx:739-742` receives a fresh `onClose` arrow every render, so memoising it
without stabilising that prop does nothing.

Do **not** add memo to `Sidebar` (already memoised, zero props) or `CanvasManager`
(already memoised). If you find yourself reaching for a Session Console component,
check first: they render inside the memoised, prop-less `Sidebar` (`Sidebar.tsx:423`),
so `App` state cannot reach them.

**For every memo added, record component, renders before, renders after.** Revert any
that shows no improvement.

**Check**: A table of memo-by-memo before/after counts, backed by committed profiler
dumps. All gates pass.

### Step 8: Remove the harness, add a regression test, record results

Remove the `<Profiler>` harness added in Step 1.

Add a regression test to `tests/performance/` for the Step 6 fix. Playwright cannot
assert React render counts directly, so prefer a timing assertion on a tool-switch
interaction under the stress fixture, modelled on whatever plan 000 left in
`tests/performance/`. Check `playwright.config.ts` to confirm your new file is actually
selected by a project — a spec that runs zero tests reports success.

If a robust assertion is not achievable, **say so plainly** and instead document the
Step 1 harness and the Step 2 procedure in
`docs/architecture/PERFORMANCE_OPTIMIZATIONS.md` so the measurement is repeatable. A
documented manual procedure beats a flaky CI test — but write it as a procedure someone
could actually follow, not a promise.

Append a DOM-layer section to `docs/architecture/PERFORMANCE_OPTIMIZATIONS.md` matching
that document's existing structure (`### The Problem` / `### The Solution: X` / a
results table) with the real numbers.

Then:
```bash
npm run lint
npm run type-check
npm run test:run
npm run build:web && npx playwright test --project=Web-Chromium
npm run build:electron && npx playwright test --project=Electron-App
npm run test:a11y
npx playwright test tests/performance/ --project=Web-Chromium
```

**Check**: All exit 0, and the perf command selects a non-zero number of tests. Produce
a final comparison against the baseline: main chunk bytes, total bytes, render counts
for both scenarios, FPS, initial load time. Verify no `<Profiler>` remains
(`grep -rn "Profiler" src/` returns nothing).

## Validation plan

- **`docs/planning/ui-perf-baseline.md` plus the committed profiler dumps are the
  contract.** Prose numbers in a commit message are not evidence; the dumps are.
- **Step 1's discriminating check is what makes the rest trustworthy.** An instrument
  that cannot tell a memoised component from an unmemoised one will produce confident,
  wrong measurements throughout.
- **Behaviour neutrality**, except the Step 4b modal mount-gating, which is explicitly
  verified per modal.
- **The manual tool-by-tool sweep in Step 6** is essential — moving tool state is the
  most behaviourally risky change here.
- **Kyle confirms** the app feels at least as responsive, particularly the home
  screen's first paint (the Step 4a risk).

## Done criteria

- [ ] The `<Profiler>` harness was built, discriminated memoised from unmemoised components, and was removed in Step 8
- [ ] `docs/planning/ui-perf-baseline.md` was committed **before** any optimisation, with raw dumps
- [ ] The playground is a separate chunk, absent from the main chunk
- [ ] `HomeScreen` is lazy-loaded, **or** reverted with the measured flash recorded
- [ ] Modal render sites are gated and each verified across close/reopen, **or** left static with the reason recorded
- [ ] `ImageCropper` and `PreferencesDialog` were **not** touched
- [ ] `vite.config.ts` has manual chunking inside the `isWeb` build block
- [ ] Tool state lives in `src/store/uiStore.ts` with a colocated unit test
- [ ] `App`'s unmemoised children show zero renders on a tool switch (dumps prove it)
- [ ] Every `React.memo` added has before/after counts backed by a dump
- [ ] A regression test exists and is selected by a project, **or** the manual procedure is documented with the reason
- [ ] `docs/architecture/PERFORMANCE_OPTIMIZATIONS.md` has a DOM-layer section with real numbers
- [ ] `grep -rn "Profiler" src/` returns nothing
- [ ] All Step 8 commands exit 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back — do not improvise — if:

- **Step 1's harness cannot distinguish** `CanvasManager` on a tool switch from
  `CanvasManager` on a selection. Every later measurement would be untrustworthy.
- **Step 2's baseline contradicts this plan's model of the code** — e.g. `Sidebar` or
  `CanvasManager` re-rendering on selection. The premise is wrong; report before
  optimising.
- **You are about to make an optimisation without a baseline number for it.**
- **A change shows no measurable improvement.** Revert it and report.
- **Lazy-loading `HomeScreen` produces a visible launch flash** — revert 4a.
- **A gated modal loses state a user would expect to persist** — leave it static.
- **Any tool stops working after Step 6.**
- **You find yourself editing `src/components/Canvas/**`** — including for
  `ImageCropper`. Out of scope.
- **You find yourself extracting a `Toolbar` component** — that is plan 004 Step 8.
- **Total bundle size grows more than 2% after Step 5** — a module is duplicated.
- **Plan 004 has not landed.** This plan's work would be reverted by it.

## Handoff / after it lands

- **What a reviewer should scrutinise most**: (1) that the profiler dumps exist and
  match the claimed numbers — this is where invented measurements would hide; (2) the
  Step 6 store migration, the only behaviourally risky change; (3) the Step 4b modal
  gating, the one sanctioned behaviour change.
- **Deliberately deferred**: canvas and fog-of-war performance (already tuned),
  `ImageCropper` and `PreferencesDialog`, the Web Worker architecture, Electron-target
  chunking, and any dependency upgrade.
- **Watch for**: `uiStore` accumulating durable state. It exists for state that must
  *not* be serialised to `.graphium` or broadcast to the World View. Anything durable
  belongs in `gameStore`.
