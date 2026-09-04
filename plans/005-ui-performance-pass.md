# Plan 005: Fix the DOM-layer performance drags

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. **This plan is measurement-first**: Step 1
> establishes a baseline and no optimization is accepted without a before/after
> number. If anything in "STOP conditions" occurs, stop and report — do not
> improvise. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat d3d3642..HEAD -- src/App.tsx src/components/ vite.config.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-stabilize-styling-foundation.md
- **Category**: perf
- **Grounded at**: `d3d3642` (2026-09-04)

> **Sequencing note**: This plan only hard-depends on 001. It can run in parallel
> with 003/004, or after them. **Recommended: run it after 004**, because 004
> rewrites most of the components this plan would optimize, and optimizing a
> component that is about to be rewritten wastes the work. Running it before 004
> is acceptable only if a performance problem is actively hurting users now.

## Why this matters

Graphium's **canvas** rendering is already well optimized — there is a whole
document about it (`docs/architecture/PERFORMANCE_OPTIMIZATIONS.md`: delta-based
IPC, cached visibility polygons, Web Worker image processing) and all eleven
`React.memo` calls in the codebase live in `src/components/Canvas/`.

The **DOM chrome layer has none of that attention.** Zero memoized components
outside the canvas directory. One lazy import in the entire app. No manual chunking.
And a set of specific, verifiable drags:

- Every tool switch re-renders the entire application subtree, including the
  1489-line `CanvasManager`, because tool state lives in `App.tsx` local state.
- The 1274-line Design System Playground registry — an internal-only developer
  tool — is statically imported and ships in the main bundle to every user.
- The 1792-line `HomeScreen` is statically imported even though it is unmounted the
  moment a DM enters the editor.

None of these are catastrophic on a fast machine. All of them matter on the
low-end hardware `PERFORMANCE_OPTIMIZATIONS.md` explicitly targets, and all of
them compound with the dual-window architecture, where two renderers run at once.

**The discipline this plan enforces: measure first, and reject any change that
doesn't show a number.** React performance work is famously easy to do
enthusiastically and uselessly.

## Context the executor needs

### What is already optimized (do not redo)

`docs/architecture/PERFORMANCE_OPTIMIZATIONS.md` documents three completed
optimizations targeting 60fps on low-end hardware with 500+ tokens:
1. **Delta-based IPC updates** in `src/components/SyncManager.tsx` (98% traffic reduction).
2. **Cached visibility polygons with dirty checking** in the fog-of-war raycaster.
3. **Web Worker image processing** to keep the main thread free.

There is also `docs/architecture/PERFORMANCE_MINIMAP.md`. Read both before starting.
**Do not touch the canvas or fog-of-war rendering paths** — they have been tuned
deliberately and this plan has nothing to add there.

### The verified DOM-layer findings (at `d3d3642`)

**1. All memoization is canvas-only.** The eleven `memo()` calls are in
`Canvas/TokenLayer.tsx`, `Canvas/TokenNode.tsx`, `Canvas/ConnectedMinimap.tsx`,
`Canvas/Minimap.tsx`, `Canvas/FogOfWarLayer.tsx`, `Canvas/GridOverlay.tsx`,
`Canvas/PressureSensitiveLine.tsx`, `Canvas/OverlayLayer.tsx`, and
`Canvas/DrawingLayer.tsx` (×2). Nothing in `Sidebar`, `SessionConsole`,
`MapNavigator`, `TokenInspector`, `QuickTokenSidebar`, or the toolbar is memoized.

**2. Tool state lives in `App.tsx` local state.** Around `src/App.tsx:135–160`:

```tsx
const [tool, setTool] = useState<'select'|'marker'|'eraser'|'wall'|'door'|'measure'>('select');
const [color, setColor] = useState('#df4b26');
const [recentColors, setRecentColors] = useState<string[]>([...]);
const [doorOrientation, setDoorOrientation] = useState<'horizontal'|'vertical'>('horizontal');
const [measurementMode, setMeasurementMode] = useState<'ruler'|'blast'|'cone'>('ruler');
const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
```

`App` renders `CanvasManager`, `Sidebar`, the toolbar, and every modal. So pressing
`V` to switch tools re-renders all of it. `selectedTokenIds` is the worst case: it
changes on every canvas selection, which is a high-frequency interaction.

Note that `App.tsx` already shows awareness of this problem — there is a comment at
roughly line 196 explaining that `selectedTokensOnly` uses `useShallow` specifically
so App "does not subscribe to the tokens array." The instinct is right; the local
state is the remaining hole.

**3. Only one lazy import.** `src/App.tsx:46` lazy-loads `WorldStage`. Everything
else is static, including:
- `src/components/DesignSystemPlayground/DesignSystemPlayground.tsx` (398 lines) and
  its `playground-registry.tsx` (**1274 lines**), imported at `src/App.tsx:21`. It
  renders only at `window.location.pathname === '/design-system'`
  (`src/App.tsx:123`) — a route no end user visits. It is shipped to everyone.
- `src/components/HomeScreen.tsx` (**1792 lines** — the largest file in the app),
  which unmounts as soon as the DM enters the editor.
- `src/components/AboutModal.tsx` (858), `PreferencesDialog.tsx` (678),
  `UpdateManager.tsx` (634), `DungeonGeneratorDialog.tsx`, `ImageCropper.tsx` —
  all modal content that is closed by default.

**4. No manual chunking.** `vite.config.ts` has no `build.rollupOptions.output.manualChunks`.
Konva + react-konva is a large dependency that changes rarely; it is currently
bundled with application code, so every app change invalidates it in cache.

**5. The universal CSS transition** at `src/styles/theme.css:291` — **this is fixed
in plan 001**. If plan 001 has not landed, it is a prerequisite; do not fix it here.

### Constraints

- **Dual-window architecture.** `src/App.tsx` branches between Architect View and
  World View. Lazy boundaries must not delay the World View — players should never
  see a loading state on the projection screen. `LoadingOverlay` exists for exactly
  this reason and is rendered only in World View.
- **Electron loads from the local filesystem**, so code-split chunk loading is
  effectively instantaneous — the usual network-latency objection to aggressive
  splitting does not apply here. The `build:web` target (GitHub Pages) is the one
  where network latency matters, and it benefits most from splitting.
- **Strict ESLint** with `--max-warnings 0`. `.ai-rules.md` is mandatory reading.

## Inputs & resources

| Purpose            | Command                                | Expected on success        |
|--------------------|----------------------------------------|----------------------------|
| Lint               | `npm run lint`                         | exit 0                     |
| Typecheck          | `npm run type-check`                   | exit 0                     |
| Unit tests         | `npm run test:run`                     | all pass                   |
| Web build          | `npm run build:web`                    | exit 0                     |
| Electron dev       | `npm run dev`                          | app + World View launch    |
| Full E2E           | `npm run test:e2e`                     | all pass                   |
| Drawing perf E2E   | `npx playwright test tests/performance/drawing-performance.spec.ts --config=playwright.config.ts` | all pass |

The repo has an existing performance spec at `tests/performance/drawing-performance.spec.ts`
— read it first; it is the model for any new perf test and the existing bar.

There is also a stress fixture: `src/utils/stressFixture.ts`, with
`shouldAutoloadStressFixture()` wired into `App.tsx`. **Find out how it is triggered
and use it** — a large campaign is the condition under which these problems are
measurable at all.

Tooling: React DevTools Profiler (Chromium is preinstalled; Electron DevTools work
in `npm run dev`).

## Scope

**In scope**:
- `src/App.tsx` (state hoisting, lazy boundaries)
- `src/store/` (a new UI/tool-state slice)
- `vite.config.ts` (manual chunking)
- Memoization of specific DOM-layer components, **only where measured**
- `tests/performance/` (a new regression test)
- `docs/architecture/PERFORMANCE_OPTIMIZATIONS.md` (append findings)

**Out of scope** (do NOT touch, even though they look related):
- **`src/components/Canvas/**` and the fog-of-war raycasting.** Already tuned per
  `PERFORMANCE_OPTIMIZATIONS.md`. Nothing here improves them.
- **`src/components/SyncManager.tsx` delta IPC.** Same reason.
- **Blanket `React.memo` on everything.** Memo has a cost (comparison + retained
  props). Every memo added by this plan must be justified by a profiler measurement
  showing the component was actually re-rendering wastefully. **A memo without a
  number is not allowed.**
- **Any visual change.** Plan 006.
- **Any behavior change.** A user must not be able to tell this plan ran, except
  that things feel faster.
- **The Web Worker architecture** in `src/workers/`.
- **Upgrading React, Konva, or Vite.**

## Working approach

Branch: `claude/ui-redesign-plan-xnyz33`. One commit per step.

**The rule for this entire plan**: every optimization step must produce a
before/after measurement recorded in the commit message. If a change cannot be
shown to help, revert it. Speculative optimization is how codebases acquire
complexity with no benefit.

## Steps

### Step 1: Establish the baseline

Do not change anything. Measure.

**Bundle baseline:**
```bash
npm run build:web
ls -la dist-web/assets/
du -sh dist-web/
```
Record every chunk name and byte size.

**Runtime baseline** — with `npm run dev` running and the stress fixture loaded
(see `src/utils/stressFixture.ts` for how to trigger it), open React DevTools
Profiler and record:

1. **Tool switch**: press `V`, then `M`, then `E`. Record which components re-render
   and their render durations. Specifically note whether `CanvasManager`, `Sidebar`,
   and the Session Console re-render.
2. **Token selection**: click a token, then shift-click three more. Record the same.
3. **Initial load**: time from launch to interactive editor.
4. **Theme toggle**: switch light↔dark and record the commit duration (this
   validates plan 001's scoped-transition fix).

**Existing perf spec baseline:**
```bash
npx playwright test tests/performance/drawing-performance.spec.ts --config=playwright.config.ts
```
Record its timings.

**Check**: You have a written baseline document with all of the above. Save it as
`docs/planning/ui-perf-baseline.md` and commit it. **Every subsequent step compares
against this file.**

### Step 2: Code-split the Design System Playground

The single clearest win: an internal developer tool (398 + 1274 = ~1670 lines plus
its dependencies) shipping to every user.

In `src/App.tsx`, change the static import at line 21 to a `lazy()` import, matching
the pattern already used for `WorldStage` at `src/App.tsx:46`. Wrap the render site
at `src/App.tsx:441–444` in `<Suspense>`.

Because the playground is only reached at `/design-system`, no user-facing path
touches this boundary — a `Suspense` fallback of `null` or a minimal spinner is fine.

**Check**:
```bash
npm run build:web && ls -la dist-web/assets/
```
The playground must now be its own chunk, and the **main** chunk must be measurably
smaller than the Step 1 baseline. Record the delta. Then `npm run dev`, visit
`/design-system`, and confirm it still renders fully.

### Step 3: Code-split `HomeScreen` and the modal content

`HomeScreen.tsx` (1792 lines) renders only in the `viewState === 'HOME'` branch and
unmounts on entry to the editor. `AboutModal`, `PreferencesDialog`, `UpdateManager`,
`DungeonGeneratorDialog`, and `ImageCropper` are closed by default.

Convert each to `lazy()` + `Suspense`.

**Important caveats:**
- **`HomeScreen` is the first thing a DM sees.** Splitting it moves its load to a
  separate chunk, which in Electron is a local file read (negligible) but on the web
  build is a network fetch. Give it a real `Suspense` fallback, and confirm there is
  no visible flash on launch. **If there is a flash, revert this one** — first-paint
  quality beats a bundle-size number.
- **Modals must not flash a loading state when opened.** Verify each opens
  instantly. If one does not, consider preloading its chunk on hover/focus of its
  trigger, or leave that modal static.
- **Do not lazy-load anything rendered in the World View.** Players must never see a
  loading state on the projection.

**Check**: `npm run build:web` produces separate chunks for each; the main chunk
shrinks again (record the delta). In `npm run dev`: the home screen appears with no
flash; each modal opens with no perceptible delay; the World View is unaffected. The
per-step gate (`npm run lint && npm run type-check && npm run test:run && npm run test:e2e`)
passes.

### Step 4: Add manual chunking for stable vendor code

In `vite.config.ts`, add `build.rollupOptions.output.manualChunks` to separate
rarely-changing dependencies from application code, so a change to app code does not
invalidate the vendor chunk in cache:

- `konva` + `react-konva` — the largest and most stable dependency
- `react` + `react-dom`
- `@remixicon/react`

Apply this to the **web** build configuration primarily. It benefits the Electron
build less (local filesystem, no cache concerns), but it is harmless there and keeps
the two builds consistent.

**Check**: `npm run build:web` produces the named vendor chunks. Total size across
all chunks should be roughly unchanged from Step 3 — this step redistributes rather
than reduces; if the total grows significantly, a module is being duplicated across
chunks. `npm run dev` and `npm run build` (Electron) both still work.

### Step 5: Move tool state out of `App.tsx` into the store

The highest-value runtime fix. Move `tool`, `color`, `recentColors`,
`doorOrientation`, `measurementMode`, and `selectedTokenIds` from `App.tsx` local
state into a Zustand slice, so only the components that read a given value re-render
when it changes.

Follow the patterns already in `src/store/` — note that `src/store/touchSettingsStore.ts`
(223 lines) exists as a **separate store**, which is a useful precedent. Decide
between a new `uiStore` and a slice of `gameStore`, and state your reasoning. **A
separate `uiStore` is likely correct**: this is ephemeral UI state that should not be
serialized into `.graphium` campaign files or broadcast over IPC to the World View,
and keeping it out of `gameStore` makes that structurally guaranteed rather than a
convention.

Then update consumers to subscribe with **narrow selectors**, following the
`useShallow` pattern already used at roughly `src/App.tsx:196`. The toolbar should
subscribe to `tool`; `CanvasManager` should subscribe to what it actually reads —
not the whole slice.

Keep the keyboard shortcut handler in `App.tsx` working; it will now call store
actions instead of `setState`.

**Check**: The per-step gate passes. Then **re-profile scenarios 1 and 2 from Step 1**
and compare against `docs/planning/ui-perf-baseline.md`. `CanvasManager` must no
longer re-render on a tool switch, and the Sidebar must no longer re-render on token
selection. **Record the before/after render counts and durations in the commit
message.** If the numbers did not improve, the selectors are still too broad — fix
them before moving on.

Manually confirm every tool still works: V/M/E/W/D/R/I shortcuts, drawing, erasing,
wall placement, door placement and rotation, all three measurement modes, and the
broadcast toggle.

### Step 6: Memoize — but only what the profiler says to

Re-profile after Step 5. Some components that looked hot will no longer be.

For each component that **still** re-renders wastefully, apply `React.memo` (plus
`useCallback` on the props causing it, where needed). Likely candidates given the
current state, but **confirm each with the profiler before touching it**:
`Sidebar.tsx` (477), `MapNavigator.tsx`, `QuickTokenSidebar.tsx`,
`TokenInspector.tsx` (481), and the Session Console list components
(`TrackGroupList.tsx`, `ImageSetBoard.tsx`).

**For every memo added, record in the commit message: the component, the render
count before, and the render count after.** A memo without a number gets reverted.

Watch for the classic trap: `React.memo` on a component receiving a fresh object or
inline arrow function as a prop does nothing. If you add a memo, check its props are
actually stable — otherwise you have added cost and gained nothing.

**Check**: The per-step gate passes. A table of memo-by-memo before/after render
counts exists. Re-run the drawing performance spec and confirm no regression.

### Step 7: Add a regression test and record the results

Add a test to `tests/performance/` that would catch a regression of the Step 5 fix —
for example, asserting that switching tools does not cause a canvas re-render, or a
timing assertion on a tool-switch interaction. Model it on
`tests/performance/drawing-performance.spec.ts`.

Be realistic: React render counts are hard to assert from Playwright. If a robust
assertion is not achievable, **say so rather than writing a flaky test**, and instead
document the manual profiling procedure in
`docs/architecture/PERFORMANCE_OPTIMIZATIONS.md` so the next person can repeat the
Step 1 measurement. A documented manual procedure beats a test that fails randomly
in CI.

Then append a section to `docs/architecture/PERFORMANCE_OPTIMIZATIONS.md` covering
the DOM-layer work, matching that document's existing structure
(Problem → Location → Solution → Result), with the real numbers.

**Check**: The new test passes reliably — run it five times consecutively and
confirm five passes. The docs section exists with real measured numbers, not
estimates.

### Step 8: Full verification

```bash
npm run lint
npm run type-check
npm run test:run
npm run build:web
npm run build
npm run test:a11y
npm run test:e2e
npx playwright test tests/performance/ --config=playwright.config.ts
```

**Check**: All exit 0. Produce a final comparison against
`docs/planning/ui-perf-baseline.md`: main chunk size, total bundle size, tool-switch
render count, token-selection render count, initial load time.

## Validation plan

- **The baseline document is the contract.** Every claim in this plan is validated
  by comparing against `docs/planning/ui-perf-baseline.md`. Without it, none of this
  is verifiable and the plan has failed regardless of what was changed.
- **Automated**: the Step 8 sequence, including both build targets (web and
  Electron) — this plan touches `vite.config.ts`, which affects both.
- **`npm run test:e2e` proves behavior neutrality.** This plan must change nothing
  a user can perceive except speed.
- **The manual tool-by-tool check in Step 5** is essential. Moving tool state to a
  store is the most behaviorally risky change here; every tool must be exercised.
- **Kyle confirms** the app feels at least as responsive as before, particularly the
  home screen's first paint (the Step 3 risk).

## Done criteria

- [ ] `docs/planning/ui-perf-baseline.md` exists, was committed before any optimization, and covers bundle + all four runtime scenarios
- [ ] The Design System Playground is a separate chunk and absent from the main chunk
- [ ] `HomeScreen` and the modal content are lazy-loaded, **or** their exclusion is documented with the measured reason
- [ ] `vite.config.ts` has manual chunking for konva/react-konva, react/react-dom, and remixicon
- [ ] Tool state lives in a store, not `App.tsx` local state, with the store choice reasoned in the commit message
- [ ] `CanvasManager` does not re-render on tool switch (profiler-verified, numbers recorded)
- [ ] The Sidebar does not re-render on token selection (profiler-verified, numbers recorded)
- [ ] **Every `React.memo` added has a before/after render count in its commit message**
- [ ] A regression test exists and passes 5/5 consecutive runs, **or** a manual profiling procedure is documented in its place with the reason
- [ ] `docs/architecture/PERFORMANCE_OPTIMIZATIONS.md` has a DOM-layer section with real numbers
- [ ] Main chunk size is measurably smaller than baseline (delta recorded)
- [ ] All eight Step 8 commands exit 0
- [ ] No user-perceptible behavior change (Kyle confirms)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back — do not improvise — if:

- **You are about to make an optimization without a baseline number for it.** That
  is the one rule this plan exists to enforce.
- **A change shows no measurable improvement.** Revert it and report. Complexity
  without benefit is a net loss.
- **Lazy-loading `HomeScreen` produces a visible flash on launch.** Revert that
  specific change — first-paint quality outranks a bundle-size figure.
- **A modal shows a loading state when opened.** Same: revert or preload.
- **Any tool stops working after Step 5.** Tool state is load-bearing for the
  entire drawing system.
- **Any E2E spec fails.** This plan is behavior-neutral by design.
- **You find yourself editing `src/components/Canvas/**` or the fog-of-war
  raycasting.** Out of scope and already tuned.
- **Total bundle size grows significantly after Step 4.** A module is being
  duplicated across chunks; diagnose before proceeding.
- **You cannot write a non-flaky regression test in Step 7.** Document the manual
  procedure instead and say so — do not commit a flaky test to CI.

## Handoff / after it lands

- **What a reviewer should scrutinize most**: (1) that every memo has a number
  attached — this is where speculative optimization creeps in; (2) the store
  migration in Step 5, since it is the only behaviorally risky change; (3) that
  `docs/planning/ui-perf-baseline.md` was genuinely committed *before* the
  optimizations, not reconstructed afterward.
- **If this runs before plan 004**, expect rework: 004 rewrites most of these
  components. Prefer running it after.
- **Deliberately deferred**: canvas and fog-of-war performance (already tuned), the
  Web Worker architecture, and any dependency upgrade.
- **Watch for**: the new UI store accumulating campaign state. It exists to hold
  ephemeral UI state that must *not* be serialized to `.graphium` files or broadcast
  to the World View. If something durable lands in it, it belongs in `gameStore`.
