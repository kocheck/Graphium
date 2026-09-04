# Plan 000: Make the verification gates actually verify

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. If anything in "STOP conditions" occurs,
> stop and report — do not improvise. When done, update the status row for this
> plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat d3d3642..HEAD -- tests/ playwright.config.ts src/styles/ src/index.css`
> On a mismatch against the "Current state" excerpts below, treat it as a STOP condition.

## Status

- **Priority**: P0
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Grounded at**: `d3d3642` (2026-09-04)

## Why this matters

Plans 001–006 stake their safety on three commands: `npm run test:a11y`,
`npm run test:e2e`, and a performance spec. A cold review of every plan found that
**all three are gates in name only.**

- `tests/accessibility.spec.ts` contains exactly one navigation — `page.goto(baseURL)`
  at line 41 — and four tests, none of which navigate anywhere else. It scans the
  **home screen and nothing else**. It never reaches the editor, the toolbar, a
  dialog, `/design-system`, or the World View. Plans 001, 002, 003 and 006 each
  nominate it as their most important gate, and each changes things it cannot see.
- `npm run test:e2e` runs **4 of 22 spec files**. `playwright.config.ts:72–91`
  ignores ten functional specs, the performance spec, and the visual spec, with the
  comment *"Stale specs wait on testids the current editor does not ship."* Verified:
  `add-token-button`, `export-campaign`, `campaign-title`, and `tool-marker` have
  **zero occurrences in `src/`**. Plan 004's entire twelve-step design rests on
  running this suite after each step.
- `tests/performance/drawing-performance.spec.ts` is in that ignore list and is not
  matched by the Electron project's `testMatch`, so it **selects zero tests** in
  every project. Plan 005 cites it as "the existing bar."

A gate that passes whether or not the work was done correctly is worse than no gate,
because it licenses shipping a regression and ticking the box. This plan makes the
gates real before anything else in the program relies on them.

It also does one piece of decidable-today plumbing that plan 006 wrongly deferred
behind a design decision: **extending the design-token layer past colour.** All 43
`--app-*` variables in `src/styles/theme.css` are colours — including
`--app-shadow-sm/md/lg`, which are `var(--slate-a3)`/`a6`/`a8`, colours rather than
`box-shadow` values. Radius, elevation, spacing, type scale, duration and easing
live as Tailwind utilities scattered through JSX. Plan 006 asks for decisions on all
six axes and then claims one token commit "re-skins the entire app." That is true
for colour and false for everything else. Creating the token families needs no
design input; only their *values* do.

## Context the executor needs

Graphium is a local-first Electron virtual-tabletop app for D&D dungeon masters
(React 18 + Vite 6 + TypeScript + Zustand + Konva + Tailwind v4 + Radix Colors).

**Dual-window architecture.** `src/App.tsx` branches between an Architect View (the
DM's control panel) and a World View (a sanitized canvas-only window projected to
players). `src/utils/useWindowType.ts` documents the mechanism in its own JSDoc:
the window type comes from a **`?type=world` URL query parameter**, set by the main
process when creating the World Window (`electron/main.ts:259`). This matters a
great deal here: it means **the World View is reachable in the web build at
`http://localhost:5173/?type=world`**, so the player-facing surface can be
axe-scanned and screenshotted like any other page. No second monitor required.

**View state.** `src/App.tsx:127` initialises `viewState` to `'HOME'`, and line 451
returns `<HomeScreen />` for that state. The editor — including the toolbar at
`src/App.tsx:556` — only mounts in the `'EDITOR'` branch. This is why the current
a11y suite never sees any of it. `tests/helpers/bypassLandingPage.ts` exists and is
the intended way past the home screen; read it before writing new specs.

**Two incompatible theme-forcing mechanisms already exist in the test suite**, and
new specs must pick deliberately:
- `tests/accessibility.spec.ts:50` — `window.themeAPI?.setThemeMode('light')`, then
  waits for `document.documentElement.getAttribute('data-theme')`. The optional chain
  means this is a **silent no-op in a plain browser context**, where `themeAPI` is
  injected only by `tests/helpers/mockElectronAPIs.ts`.
- `tests/visual.spec.ts:39` — `document.documentElement.setAttribute('data-theme', 'dark')`
  directly.

The second is reliable in the web build; prefer it, and keep the existing
`waitForFunction` on the attribute so the assertion still proves the theme applied.

**Existing exclusions to preserve.** `tests/accessibility.spec.ts:64–66` excludes
`canvas` (Konva draws non-text graphics axe cannot assess) and
`[aria-disabled="true"]`. The latter is deliberate:
`docs/features/wcag-audit.md` documents `--app-text-disabled` (slate-9) as
**intentionally** below the AA threshold, which is a valid WCAG exception for
disabled controls. Do not remove either exclusion.

**A live contrast finding to record, not fix here.** `--app-error-solid` is
`var(--red-9)` = `#e5484d`. White text on it computes to roughly **3.9:1**, below the
4.5:1 AA floor for normal text (it does clear the 3:1 bar for large text and UI
components). `src/styles/app.css` uses it for destructive buttons. Once Step 2 makes
the editor axe-visible this may surface as a real violation. **Record it; do not
change the palette here** — that is plan 006's decision.

**Touch targets are undocumented and inconsistent.** Plan 006 claims minimum sizes
are documented in `TOUCH_SUPPORT_MIGRATION.md` and `DEVICE_COMPATIBILITY.md`. They
are not — neither file contains a pixel minimum. The real values are inline and vary:

| Location | Minimum |
|---|---|
| `src/App.tsx:528–529` (mobile menu button) | `minWidth`/`minHeight: '48px'` |
| `src/components/TokenInspector.tsx:246,300,321,360` | `min-h-[44px]` |
| `src/components/HomeScreen.tsx:1729,1772,1776` | `min-height: 44px` |
| `src/components/MobileToolbar.tsx` (×9) | `min-h-[56px]` |
| `src/styles/app.css:54` `.btn-tool` | **none** |

**Conventions.** Strict ESLint with `--max-warnings 0`, enforced by a Husky
pre-commit hook. `.ai-rules.md` at the repo root is mandatory reading. Match the
patterns in the specs already in `tests/`.

## Inputs & resources

Run `npm install` first — there is no `node_modules` checked in. Playwright browser
binaries are **not** installed by `npm install`; run `npx playwright install chromium`
before any Playwright command, or every E2E run fails with a missing-executable error
that looks like a real defect.

| Purpose | Command | Expected on success |
|---|---|---|
| Install deps | `npm install` | exit 0 |
| Install browsers | `npx playwright install chromium` | exit 0 |
| Lint | `npm run lint` | exit 0, zero warnings |
| Typecheck | `npm run type-check` | exit 0 |
| Unit tests | `npm run test:run` | all pass |
| Web build | `npm run build:web` | exit 0 |
| A11y E2E | `npm run test:a11y` | all pass |
| Web E2E only | `npx playwright test --project=Web-Chromium` | all pass |
| Electron build | `npm run build:electron` | exit 0 — **required before Electron E2E** |
| Electron E2E | `npx playwright test --project=Electron-App` | all pass |

**Note on `npm run test:e2e`**: it runs *both* projects. The `Electron-App` project
launches the packaged main process (`package.json` `"main": "dist-electron/main.js"`),
which does not exist until `npm run build:electron` has run. `.github/workflows/e2e.yml`
never invokes bare `test:e2e` for this reason — it runs each project separately after
the matching build. **Every plan in this set that says "run `npm run test:e2e`" should
be read as the two project-scoped commands above, in that order.** Fixing that wording
across plans 001–006 is Step 6 of this plan.

## Scope

**In scope**:
- `tests/accessibility.spec.ts` — extend coverage
- `tests/` — new specs added by Steps 2–4
- `playwright.config.ts` — the `testIgnore` list
- The twelve currently-ignored spec files — restored or deleted per Step 3
- `src/index.css` — new non-colour token families (Step 5)
- `src/styles/theme.css` — new non-colour token families (Step 5)
- `docs/planning/verification-baseline.md` — new
- `plans/001`–`plans/006` — the `test:e2e` wording fix only (Step 6)

**Out of scope** (do NOT touch, even though they look related):
- **Any `--app-*` colour value.** This plan adds token *families*; it changes no
  existing colour. The `--app-error-solid` contrast issue is recorded, not fixed.
- **Any component's markup, styling, or behaviour.** If a restored spec fails because
  the app lacks a `data-testid`, adding that attribute is in scope (Step 3); changing
  what the component renders is not.
- **The `canvas` and `[aria-disabled="true"]` axe exclusions.** Both are deliberate.
- **`src/components/Canvas/**`** — Konva rendering.
- **The pause-button cascade bug** (`src/App.tsx:564–568`: `.btn-tool` beats
  `bg-red-500` because `app.css` is unlayered and Tailwind utilities are in
  `@layer utilities`, so the pause state never shows). Record it in Step 7; it is
  fixed during the plan 004 toolbar migration, where the fix is attributable.
- **Adding shadcn, primitives, or any dependency.** Later plans.

## Working approach

Branch: `claude/ui-redesign-plan-xnyz33`. One commit per step. Every commit must
leave the test suite green — a plan about trustworthy gates cannot ship a red one.

## Steps

### Step 1: Record what actually runs today

Before changing anything, establish the baseline this plan is correcting.

```bash
npm install
npx playwright install chromium
npm run lint; npm run type-check; npm run test:run
npm run build:web && npx playwright test --project=Web-Chromium --list
npm run build:electron && npx playwright test --project=Electron-App --list
```

`--list` enumerates selected tests without running them. Record, in
`docs/planning/verification-baseline.md`: every spec file in `tests/`, whether each
is selected by either project, and the pass/fail result of the four commands above.

**Check**: `docs/planning/verification-baseline.md` exists and shows the selected-test
count per project. It should confirm that only `tests/accessibility.spec.ts` and
`tests/functional/campaign-workflow.spec.ts` run in Web-Chromium, and only the two
`tests/electron/*.electron.spec.ts` files run in Electron-App. **If the numbers differ
from that, the repo has drifted — STOP and report**, because every plan in this set
was written against those numbers.

### Step 2: Make the accessibility suite reach the surfaces the program changes

`tests/accessibility.spec.ts` currently scans one route. Extend it to cover the four
surfaces later plans modify, in both themes.

Restructure the existing `beforeEach` so the target route is parameterised rather
than hardcoded, keeping the reduced-motion emulation, the
`injectMockElectronAPIs` init script, and the `#root:visible` wait. Then add scans for:

1. **The home screen** — the existing coverage. Keep it.
2. **The editor**, reached via `tests/helpers/bypassLandingPage.ts`. This is where the
   toolbar (`src/App.tsx:556`), the sidebar, and the map navigator live.
3. **An open dialog.** Use `ConfirmDialog` — it is store-driven via `showConfirmDialog`
   (`src/store/gameStore.ts`), so it can be opened deterministically from a
   `page.evaluate` without depending on a menu path. Scan with it open.
4. **The World View**, at `?type=world`. Per the Context section this renders the
   player-facing projection in the web build.
5. **`/design-system`**, the Design System Playground. Later plans prototype every new
   primitive here and call `test:a11y` the proof; today axe never sees it.

Force the theme with `document.documentElement.setAttribute('data-theme', …)` per the
Context section, and keep a `waitForFunction` on the attribute. Run each surface in
**both** light and dark. Preserve both existing `.exclude()` calls.

Expect new violations to appear — that is the point. Triage each into:
(a) a real defect this plan should fix (a missing `aria-label`, an unlabelled input);
(b) a colour-contrast finding, which is **recorded, not fixed** (out of scope — see
the `--app-error-solid` note in Context); or (c) a false positive needing a
documented, narrowly-scoped exclusion.

**Check**: `npm run test:a11y` runs **ten scans** (five surfaces × two themes) and
passes. `docs/planning/verification-baseline.md` gains a triage table listing every
violation found and its category. **If a category (a) defect cannot be fixed inside
this plan's scope, STOP and report it** rather than adding an exclusion to hide it.

### Step 3: Triage the twelve ignored specs — restore or delete

For each spec in `playwright.config.ts:72–91`'s ignore list, determine which testids
it needs and whether the app ships them:

```bash
for f in tests/functional/*.spec.ts tests/performance/*.spec.ts tests/visual.spec.ts; do
  echo "=== $f"
  grep -ohE 'data-testid[="^~*]+[a-z0-9-]+' "$f" | sort -u
done
grep -rhoE 'data-testid="[^"]+"' src/ | sort -u
```

Then, for each spec, choose exactly one:

- **RESTORE** — the behaviour it tests still exists and the missing `data-testid`
  attributes can be added to the app. Add them (adding an attribute is in scope;
  changing rendered output is not), remove the spec from `testIgnore`, and make it
  pass.
- **DELETE** — the behaviour no longer exists, or the spec tests something the app
  never shipped. Delete the file and remove its ignore entry. A deleted spec is
  honest; an ignored one is a lie that reads as coverage.

**Do not leave anything in `testIgnore`.** An entry there is exactly the failure this
plan exists to correct. If a spec is genuinely worth keeping but cannot be made to
pass in this plan, that is a STOP condition, not a third option.

Prioritise in this order, because later plans depend on them most:
`dm-world-sync` (the World View — no other spec covers it),
`touch-interactions` (the only touch coverage; plan 006 has a touch STOP condition
with nothing behind it), `token-management` and `token-library` (the sidebar surfaces
plan 004 migrates), then the rest.

Handle `tests/visual.spec.ts` explicitly: it is the repo's only visual-regression
spec and therefore the single most relevant existing test to plan 006. Either restore
it with fresh baseline screenshots, or delete it and record in
`docs/planning/verification-baseline.md` that plan 006 has no visual-regression
safety net.

**Check**: `playwright.config.ts`'s `testIgnore` contains only the three structural
entries — `/.*\.electron\.spec\.ts/`, `/tests\/unit\//`, `/tests\/integration\//`.
Every remaining spec in `tests/` passes. Re-run `--list` for both projects and record
the new selected-test counts in the baseline document.

### Step 4: Capture the touch-target baseline as an assertion

Plan 006 has a STOP condition — *"A change would shrink a touch target below its
current minimum"* — against a baseline that exists nowhere. Create it as a test, not
a document.

Add a spec that enumerates the touch-target sites in the Context table, and asserts
each element's `boundingBox()` meets its current minimum. Use the values that are
there today (48 / 44 / 56); this records reality, it does not impose a new standard.

`.btn-tool` currently has **no** minimum. Do not invent one — assert its current
measured size so a future change is detectable, and note the gap in the baseline
document as an open question for plan 006.

**Check**: The new spec passes and is selected by `--project=Web-Chromium`. Verify it
is a real gate by temporarily shrinking one target, confirming the spec fails, then
reverting. **A test that has never been seen to fail is not yet a test.**

### Step 5: Extend the token layer past colour

`src/styles/theme.css` defines 43 `--app-*` variables, all colours. Add the families
that radius, elevation, motion, spacing and type currently express as ad-hoc Tailwind
utilities, so that a later token change actually propagates:

- `--app-radius-sm|md|lg` — seed from what the code already uses: `.btn` is
  `border-radius: 0.25rem` (`src/styles/app.css`), the toolbar is `rounded-lg`.
- `--app-shadow-elevation-low|medium|high` — **real `box-shadow` values**. Note the
  existing `--app-shadow-sm|md|lg` are *colours*; leave them alone and do not reuse
  their names.
- `--app-duration-fast|base|slow` and `--app-ease-standard|decelerate` — seed from
  the 0.2s ease already in `theme.css` and the 0.3s ease-out of `slide-down`.
- `--app-space-*` — only if a coherent scale is already implied by the code. If
  spacing is genuinely ad-hoc, **say so in the baseline document and skip it**; an
  invented scale nothing uses is worse than none.
- `--app-font-size-*` / `--app-font-weight-*` — seed from `src/styles/fonts.css`.

Expose them through the Tailwind v4 `@theme` block in `src/index.css` so they are
usable as utilities. **Values must be the ones in the code today.** This step changes
no pixel; it gives later plans somewhere to put a decision.

**Check**: `npm run build:web` exits 0 and the new custom properties appear in the
built CSS. `npm run test:a11y` and both E2E projects still pass. Visually diff the
app before and after in `npm run dev` — **nothing may change**. Then prove the tokens
are live: temporarily set `--app-radius-lg` to `0`, confirm the toolbar corners
square off, and revert.

### Step 6: Verify the `test:e2e` correction across plans 001–006

Bare `npm run test:e2e` fails on a clean machine because `Electron-App` needs
`npm run build:electron` first, and the plans' STOP conditions would read that
self-inflicted failure as a real coupling problem.

**This sweep has already been applied** to plans 001–006 — every Inputs table, Check and
Done criterion now uses the two project-scoped commands, and each table has an
`npx playwright install chromium` row. **Verify it rather than redoing it**, and fix any
occurrence the sweep missed. The correct form is:

```bash
npm run build:web && npx playwright test --project=Web-Chromium
npm run build:electron && npx playwright test --project=Electron-App
```

Add `npx playwright install chromium` to each Inputs table.

**Check**: `grep -rn "npm run test:e2e" plans/` returns only occurrences that
explicitly explain the two-project split. `npm run lint` still passes (markdown is
not linted, but the pre-commit hook runs Prettier over `*.md`).

### Step 7: Record the deferred findings and verify

Append to `docs/planning/verification-baseline.md`:

1. **The pause-button cascade bug.** `src/App.tsx:564–568` applies `bg-red-500` /
   `bg-green-500` and `text-white` to an element also carrying `.btn-tool`. Because
   `src/index.css:4` imports `app.css` unlayered and Tailwind v4 emits utilities in
   `@layer utilities`, the unlayered `.btn-tool { background: rgb(64,64,64); color: rgb(229,229,229) }`
   wins regardless of specificity — so the pause button never shows its red/green
   state. Note that this makes the plan 004 toolbar migration **non-neutral by
   design**: moving to a CVA variant puts those colours in the same layer, and the
   pause state starts working. That is a fix, but plan 004 must expect it rather than
   treat it as a regression.
2. **The `--app-error-solid` contrast finding** from Context (~3.9:1 white-on-red-9).
3. **The `.btn-tool` missing touch minimum** from Step 4.
4. **Any spec deleted in Step 3**, with one line on what coverage was lost.

Then run everything:

```bash
npm run lint
npm run type-check
npm run test:run
npm run build:web && npx playwright test --project=Web-Chromium
npm run build:electron && npx playwright test --project=Electron-App
npm run test:a11y
```

**Check**: All exit 0. The baseline document contains the before/after selected-test
counts, the a11y triage table, and the four deferred findings.

## Validation plan

- **The suite must be seen to fail.** For the a11y extension (Step 2) and the
  touch-target spec (Step 4), deliberately break the thing being tested, confirm the
  gate goes red, and revert. This is the only way to know a new gate is real, and it
  is precisely the verification the original plans skipped.
- **Selected-test counts, before and after** (Step 1 vs Step 3) are the headline
  evidence: 4 of 22 should become a substantially larger number, or the difference
  must be explained by deletions.
- **Step 5 must be visually inert.** It adds token families at their current values;
  any visible change means a wrong value was seeded.
- **A reviewer should confirm** that no spec was deleted merely to make this plan
  easier, and that every deletion has its lost coverage recorded.

## Done criteria

- [ ] `docs/planning/verification-baseline.md` exists with before/after selected-test counts per project
- [ ] `npm run test:a11y` scans five surfaces × two themes and passes
- [ ] The a11y triage table records every violation found and its category
- [ ] `playwright.config.ts` `testIgnore` contains only the three structural entries
- [ ] Every spec in `tests/` either passes or has been deleted with its lost coverage recorded
- [ ] The touch-target spec exists, passes, and was observed to fail when a target was shrunk
- [ ] Non-colour token families exist in `theme.css`, are exposed via `@theme`, and were proven live
- [ ] Step 5 changed nothing visually
- [ ] `grep -rn "npm run test:e2e" plans/` returns only explained occurrences
- [ ] All four deferred findings are recorded
- [ ] `npm run lint`, `npm run type-check`, `npm run test:run`, both E2E projects, and `npm run test:a11y` all exit 0
- [ ] No `--app-*` colour value changed
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back — do not improvise — if:

- **Step 1's selected-test counts don't match** the numbers in the Check. Every plan
  in this set was written against them.
- **A category (a) a11y defect** (a genuine, non-contrast violation) cannot be fixed
  within scope. Do not add an axe exclusion to hide it.
- **A spec is worth keeping but cannot be made to pass** in this plan. Restore and
  delete are the only two options; leaving it in `testIgnore` is not a third.
- **Making a spec pass would require changing what a component renders**, not merely
  adding a `data-testid`.
- **Step 5 changes anything visually.** A wrong seed value; find it rather than
  accepting the change.
- **A new gate cannot be made to fail** when you deliberately break its subject. It
  is not testing what you think.
- **You are tempted to change a colour value** to clear a contrast violation. Record
  it; plan 006 decides the palette.

## Handoff / after it lands

- **Every other plan in this set depends on this one.** Plans 001, 002, 003 and 006
  each name `npm run test:a11y` as their most important gate; plan 004's entire
  twelve-step design assumes the E2E suite is meaningful; plan 005 cites a spec that
  currently selects zero tests. None of those claims is true until this lands.
- **What a reviewer should scrutinise most**: the Step 3 restore/delete decisions.
  Deleting a spec is the easy way to a green suite, and the temptation is strongest
  exactly where coverage matters most (`dm-world-sync` is the only World View test).
- **Deliberately deferred**: the pause-button cascade bug (plan 004, where it is
  attributable), the `--app-error-solid` contrast finding and all palette decisions
  (plan 006), and token *values* for the new families (plan 006).
- **Watch for**: `testIgnore` regrowing. If a spec becomes flaky later, fix or delete
  it. The comment now sitting in `playwright.config.ts` is how a suite quietly stops
  being a suite.
