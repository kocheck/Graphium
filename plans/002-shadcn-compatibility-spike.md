# Plan 002: Prove shadcn/ui works on this stack before committing to it

> **Executor instructions**: This is a **timeboxed investigation, not a feature**.
> Its deliverable is a written go/no-go decision plus a throwaway branch — not
> merged production code. Follow each step, confirm its **Check**, and if anything
> in "STOP conditions" occurs, stop and report. When done, update the status row in
> `plans/README.md` and record the decision in the "Outcome" section at the bottom
> of this file.
>
> **Drift check (run first)**:
> `git diff --stat d3d3642..HEAD -- package.json tsconfig.json vite.config.ts src/index.css`
> If any changed since `d3d3642`, re-read them and confirm the "Context" section
> below still matches.

## Status

- **Priority**: P1
- **Effort**: S (timebox: 1 working day / ~6 focused hours)
- **Risk**: LOW (nothing merges to `main` from this plan)
- **Depends on**: plans/001-stabilize-styling-foundation.md
- **Category**: dx
- **Grounded at**: `d3d3642` (2026-09-04)

## Why this matters

Kyle has decided to adopt shadcn/ui fully — CLI, `components.json`, Radix
Primitives, CVA, owned source in-repo. That decision is sound and the rest of this
plan set assumes it. But shadcn's documented happy path is **React 19 + Next.js**,
and Graphium is **React 18 + Vite + Electron** with a **pre-existing Radix Colors
theme** it must not throw away. Those three deltas are each individually
survivable and each individually capable of costing a week if discovered halfway
through plan 003.

The cost of being wrong here is not "shadcn doesn't work" — it is discovering a
blocker after nine dialogs have been half-migrated. One day of proving it now buys
certainty for the ~4 plans that follow. The output of this plan is a decision
document and a set of exact, known-good install commands that plan 003 can execute
without improvising.

**This plan does not merge production code.** Everything happens on a throwaway
branch that is deleted at the end.

## Context the executor needs

Graphium is a local-first Electron virtual-tabletop app for D&D dungeon masters.
Relevant stack facts, all verified at `d3d3642`:

- **React 18.2** (`react`, `react-dom` `^18.2.0`) — *not* React 19.
- **Vite 6.4** with `vite-plugin-electron`. Two build modes: `npm run build`
  (Electron) and `npm run build:web` (`dist-web/`, base `./` for GitHub Pages).
- **Tailwind v4.1.18** via `@tailwindcss/postcss`. After plan 001, configured
  through a `@theme` block in `src/index.css` with no `tailwind.config.js`.
- **`@radix-ui/colors` ^3.0.0** is installed — this is the **color system only**.
  **No Radix Primitives** (`@radix-ui/react-*` behavior packages) are installed.
  This distinction matters: shadcn is built *on* Radix Primitives, and Graphium
  already having Radix Colors means the theme layer should survive the adoption.
- **`tsconfig.json` has no `paths` aliases.** shadcn's `components.json` requires
  them (`@/components`, `@/lib/utils`). `vite.config.ts` has no `resolve.alias`
  either. Both must be added.
- **No `clsx`, no `tailwind-merge`, no `class-variance-authority`.** shadcn's
  `cn()` helper needs the first two; its variant API needs the third.
- **Strict ESLint** (`.eslintrc.cjs`, 13.5KB) with `--max-warnings 0`, enforced by
  a Husky pre-commit hook. Notable rules that generated code may trip:
  `complexity` max 15, `max-lines-per-function`, `max-params` 5,
  `@typescript-eslint/no-magic-numbers`, and enforced import ordering
  (`eslint-plugin-import`). `.ai-rules.md` bans `any` outright.
- **Dual-window architecture**: the app renders an Architect View (DM) and a World
  View (player projection) — see `src/App.tsx`. Radix Primitives render overlays
  through **React portals**, which attach to `document.body` by default. Each
  Electron `BrowserWindow` has its own `document`, so this should be fine, but it
  is explicitly untested and is the single most Electron-specific risk here.
- **Theme switching** is driven by a `data-theme="light|dark"` attribute on
  `<html>` (see `src/styles/theme.css` and `src/components/ThemeManager.tsx`).
  shadcn's default Tailwind v4 setup instead assumes a `.dark` **class** and OKLCH
  variables in an `@theme inline` block. **These two systems must be bridged, not
  replaced** — Graphium's semantic variables (`--app-bg-surface`,
  `--app-text-primary`, `--app-accent-solid`, …) are documented in
  `docs/features/wcag-audit.md` as WCAG-AA-verified and are the source of truth.

### The four questions this spike must answer

1. **Does the shadcn CLI install and generate working components on React 18?**
   Several `@radix-ui/react-*` packages declare React 19 in `peerDependencies`.
   Does npm resolve cleanly, or does it require `--legacy-peer-deps` / overrides?
   If a flag is required, that flag becomes a permanent property of the repo and
   must be recorded.
2. **Can shadcn components be re-themed onto Graphium's existing `--app-*`
   variables** without forking the color system or losing WCAG AA compliance?
3. **Do Radix portals behave correctly in Electron**, in both the Architect window
   and the World View window, including Escape/focus-trap behavior?
4. **What does it cost?** Bundle-size delta on `npm run build:web`, and how much
   generated code the existing ESLint config rejects.

## Inputs & resources

| Purpose        | Command                    | Expected on success        |
|----------------|----------------------------|----------------------------|
| Install deps   | `npm install`              | exit 0                     |
| Lint           | `npm run lint`             | exit 0, zero warnings      |
| Typecheck      | `npm run type-check`       | exit 0                     |
| Unit tests     | `npm run test:run`         | all pass                   |
| Web build      | `npm run build:web`        | exit 0, writes `dist-web/` |
| Electron dev   | `npm run dev`              | app + World View launch    |
| A11y E2E       | `npm run test:a11y`        | all pass                   |

Reference docs the executor should read before starting:
- shadcn/ui installation for **Vite** (not Next.js) — the Vite guide is the correct one.
- shadcn/ui **Tailwind v4** notes — v4 changes the theming contract materially.
- `docs/features/wcag-audit.md` in this repo — the contrast guarantees that must survive.
- `src/styles/theme.css` — the semantic variable contract.

## Scope

**In scope**: a throwaway branch `spike/shadcn-compat`, and edits to
`plans/002-shadcn-compatibility-spike.md` (the Outcome section) plus a new
`docs/planning/shadcn-adoption-decision.md`.

**Out of scope** (do NOT do these, even though they are the obvious next step):
- **Merging anything into `claude/ui-redesign-plan-xnyz33` or `main`.** The spike
  branch is deleted at the end. Plan 003 does the real installation, using the
  commands this spike proves out.
- **Migrating any existing component** to a shadcn primitive. Not one. Plan 004.
- **Deleting or rewriting `src/styles/theme.css`.** The spike *bridges* to it; it
  does not replace it.
- **Upgrading React to 19.** If the spike concludes that React 19 is required, that
  is a finding to report, not a change to make — it is a large independent
  migration affecting Konva, react-konva, and the Electron renderer.
- **Adding shadcn components beyond the three named in Step 4.** The spike needs
  enough surface to answer the four questions, not a component library.

## Steps

### Step 1: Create the throwaway branch and record the baseline

```bash
git checkout -b spike/shadcn-compat
npm install
npm run build:web
du -sh dist-web/
ls -la dist-web/assets/
```

Record the total `dist-web/` size and the individual JS/CSS asset sizes. This is
the baseline for the bundle-cost answer in Step 6.

**Check**: You have written down the baseline byte sizes. `npm run build:web`
exits 0.

### Step 2: Add the path aliases shadcn requires

shadcn's `components.json` resolves imports through `@/`. Add to
`tsconfig.json` `compilerOptions`:

```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

And to `vite.config.ts`, inside the returned config object:

```ts
resolve: {
  alias: { '@': path.resolve(__dirname, './src') },
},
```

`path` is already imported in `vite.config.ts` as `import path from 'node:path'`.

**Check**: Create a scratch file that imports something via the alias and confirm
both the typechecker and the bundler resolve it:
```bash
npm run type-check && npm run build:web
```
Both exit 0. Then delete the scratch file.

Note whether `vitest.config.ts` also needs the alias — it is a separate config
file. If unit tests fail to resolve `@/`, record that as a required change for
plan 003.

### Step 3: Run the shadcn init and record exactly what it takes

Run the shadcn CLI init for a Vite project. Use the **Neutral** base color (closest
to Graphium's Radix `slate`) and answer its prompts to match the repo: TypeScript
yes, CSS file `src/index.css`, alias `@/components` and `@/lib/utils`.

**Capture, verbatim, in your notes:**
- The exact command invoked, including any flag needed to get past peer-dependency
  resolution (e.g. `--legacy-peer-deps`). **If a flag was required, that is a
  finding** — record which packages demanded it and what they wanted.
- Every file the CLI created or modified (`git status`).
- Every dependency it added and the resolved version (`git diff package.json`).
- Anything it wrote into `src/index.css` — particularly whether it added an
  `@theme inline` block, `.dark` class definitions, or OKLCH variables that
  conflict with the existing `[data-theme='dark']` blocks in
  `src/styles/theme.css`.

**Check**: `components.json` exists, `src/lib/utils.ts` exists and exports `cn`,
and `npm run type-check` exits 0. If init modified `src/index.css` in a way that
conflicts with `theme.css`, do **not** resolve the conflict yet — document it and
continue to Step 4, where the bridge is designed.

### Step 4: Add three primitives that exercise the hard parts

Add exactly three components via the CLI, chosen because each tests a different
risk:

- **`button`** — the CVA variant pattern and the theming bridge (no portal).
- **`dialog`** — the portal, focus trap, Escape handling, and scroll locking.
  This is the highest-value primitive in the entire program; nine hand-rolled
  dialogs exist today and exactly one of them has a focus trap.
- **`tooltip`** — a second portal type with different positioning behavior, and a
  direct replacement candidate for the existing `src/components/Tooltip.tsx`.

**Check**: All three files exist under `src/components/ui/`. `npm run type-check`
exits 0.

Then run `npm run lint` and **record the full output**. Generated shadcn code is
likely to trip this repo's strict rules. Categorize each violation as:
(a) auto-fixable by `npm run lint:fix`, (b) fixable by a small hand-edit to the
generated file, or (c) requiring an ESLint config change. **Category (c) is the
important finding** — it tells plan 003 whether an ESLint override scoped to
`src/components/ui/**` is needed, and if so, exactly which rules.

### Step 5: Build the theming bridge and prove contrast survives

This is the core of the spike. shadcn components reference tokens like
`bg-primary`, `text-primary-foreground`, `bg-background`, `border-border`.
Graphium's source of truth is `--app-bg-surface`, `--app-text-primary`,
`--app-accent-solid`, and so on.

**Do not** replace Graphium's variables with shadcn's. Instead, define shadcn's
token names *in terms of* Graphium's, in the `@theme` block in `src/index.css`, so
one theme system feeds the other:

```css
@theme inline {
  --color-background: var(--app-bg-base);
  --color-foreground: var(--app-text-primary);
  --color-card: var(--app-bg-surface);
  --color-card-foreground: var(--app-text-primary);
  --color-popover: var(--app-bg-surface);
  --color-popover-foreground: var(--app-text-primary);
  --color-primary: var(--app-accent-solid);
  --color-primary-foreground: var(--app-accent-solid-text);
  --color-secondary: var(--app-bg-active);
  --color-secondary-foreground: var(--app-text-primary);
  --color-muted: var(--app-bg-subtle);
  --color-muted-foreground: var(--app-text-secondary);
  --color-destructive: var(--app-error-solid);
  --color-border: var(--app-border-subtle);
  --color-input: var(--app-border-default);
  --color-ring: var(--app-accent-solid);
}
```

Because the `--app-*` variables are already redefined under `[data-theme='dark']`,
this bridge makes shadcn components theme-aware through Graphium's *existing*
mechanism — no `.dark` class needed. If the shadcn init wrote its own `.dark`
block or OKLCH definitions into `src/index.css` in Step 3, remove them; they are
now redundant and would compete.

Verify the mapping is complete: grep the three generated components for every
Tailwind color token they use and confirm each has a bridge entry.

```bash
grep -ohE "(bg|text|border|ring|fill|stroke)-(background|foreground|card|popover|primary|secondary|muted|accent|destructive|border|input|ring)(-foreground)?" src/components/ui/*.tsx | sort -u
```

Every token this returns must have a corresponding `--color-*` line above.

**Check**: Render all three primitives on the existing `/design-system` playground
route (`src/components/DesignSystemPlayground/`) — it already exists for exactly
this purpose. Then, with `npm run dev` running, confirm by eye in **both** themes
that the Button, Dialog, and Tooltip match the surrounding Graphium UI rather than
looking like stock shadcn.

Then run the accessibility suite, which is the objective gate:
```bash
npm run test:a11y
```
Must pass in both light and dark. If a contrast violation appears, the bridge has
mapped a token to a variable pair that does not meet AA — record which mapping.

### Step 6: Test the Electron dual-window portal behavior

This is the risk that no amount of reading documentation can settle.

Temporarily mount the spike Dialog somewhere reachable in the running app, then:

```bash
npm run dev
```

1. In the **Architect View**, open the Dialog. Confirm: it renders above the Konva
   canvas; **Escape** closes it; **Tab** cycles focus within it and does not escape
   to the canvas behind; focus returns to the trigger on close; clicking the
   overlay closes it.
2. Open the **World View** (player window) via the toolbar button. Confirm the
   Dialog does **not** appear there, and that opening the Architect dialog does not
   disturb the World View.
3. With the Dialog open in the Architect View, confirm the Konva canvas beneath it
   does not receive pointer events (draw attempts should not create strokes).
4. Confirm the Tooltip positions correctly near the window edges in both windows.

**Check**: All four behaviors confirmed, with any failure recorded precisely
(which window, which behavior, what happened instead). Behavior 1 is the one that
matters most — it is the entire justification for adopting Radix Primitives over
hand-rolling.

### Step 7: Measure the cost

```bash
npm run build:web
du -sh dist-web/
ls -la dist-web/assets/
```

Compare against the Step 1 baseline. Record the delta in raw and, if the build
reports it, gzipped bytes. Note that this is the cost of **three** primitives plus
`clsx`, `tailwind-merge`, and `class-variance-authority`; extrapolate roughly what
a dozen primitives would add, and note that most of the shared cost
(`tailwind-merge` in particular) is paid once.

Also run the full suite to see if anything unrelated broke:
```bash
npm run lint ; npm run type-check ; npm run test:run ; npm run test:e2e
```

**Check**: You have concrete before/after numbers and a full record of which
existing checks pass and which fail on the spike branch.

### Step 8: Write the decision and destroy the branch

Write `docs/planning/shadcn-adoption-decision.md` containing:

1. **The verdict**: GO, GO-WITH-CAVEATS, or NO-GO, in the first line.
2. **Answers to the four questions** from the Context section, each with the
   evidence that settled it.
3. **The exact, known-good install command sequence** for plan 003 to run —
   including any peer-dependency flag, the `tsconfig`/`vite`/`vitest` alias edits,
   and the full theming bridge block from Step 5, copy-pasteable.
4. **The ESLint findings** from Step 4: which rules generated code violates and the
   recommended scoped override for `src/components/ui/**`, if one is needed.
5. **The bundle delta** from Step 7.
6. **Anything that surprised you.** This is the highest-value section for whoever
   executes plan 003.

If the verdict is **NO-GO** or **GO-WITH-CAVEATS**, state plainly what plan 003
must change — the fallback is the "pattern only, no CLI" approach (own primitives
built directly on Radix Primitives with CVA, no `components.json`), which removes
the CLI and React-19-assumption risk at the cost of writing the boilerplate by hand.

Then commit the decision doc to the working branch (not the spike branch), and
delete the spike:

```bash
git checkout claude/ui-redesign-plan-xnyz33
git checkout spike/shadcn-compat -- docs/planning/shadcn-adoption-decision.md
git add docs/planning/shadcn-adoption-decision.md
git commit -m "docs: record shadcn/ui compatibility spike findings"
git branch -D spike/shadcn-compat
```

**Check**: `docs/planning/shadcn-adoption-decision.md` exists on
`claude/ui-redesign-plan-xnyz33` and opens with a one-word verdict.
`git branch --list spike/shadcn-compat` returns nothing. `git status` is clean.

## Validation plan

The deliverable is a decision, so validation is about the decision's quality:

- **Every one of the four questions in Context has an answer backed by a command
  output or an observed behavior** — not by a documentation citation. A spike that
  concludes "the docs say it should work" has failed.
- **The install command sequence in the decision doc has actually been run
  successfully**, on this repo, at this commit. That is what makes plan 003 safe.
- **`npm run test:a11y` passed on the spike branch** with the theming bridge in
  place. Without this, the bridge is unproven.
- **Kyle reviews and signs off on the verdict** before plan 003 begins. This is the
  one judgment call in the plan set that a reviewer must confirm rather than a
  command.

## Done criteria

- [ ] `docs/planning/shadcn-adoption-decision.md` exists and opens with GO / GO-WITH-CAVEATS / NO-GO
- [ ] It answers all four Context questions, each with cited evidence
- [ ] It contains a copy-pasteable install sequence that was actually executed
- [ ] It records the exact bundle-size delta (before/after bytes)
- [ ] It records the ESLint findings and the recommended scoped override, if any
- [ ] The Electron dual-window portal behavior in Step 6 was tested in a real
      `npm run dev` session, in both windows, with results recorded
- [ ] `npm run test:a11y` was run with the theming bridge in place, and its result recorded
- [ ] Branch `spike/shadcn-compat` has been deleted
- [ ] No production code from the spike was merged
- [ ] Kyle has signed off on the verdict
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back — do not improvise — if:

- **The shadcn CLI cannot install on React 18 at all**, even with
  `--legacy-peer-deps`. Do not upgrade React to 19 to unblock it. Report; the
  fallback is the "pattern only" approach.
- **The theming bridge in Step 5 cannot be made to pass `npm run test:a11y`**
  in both themes. Do not weaken the a11y test or hardcode a color to get past it.
  Report exactly which token mapping fails and by how much.
- **Radix portals misbehave in the World View window** — e.g. a dialog leaks DM
  chrome into the player projection. This is a product-correctness issue, not a
  styling one, and it changes the shape of plan 003.
- **The bundle delta for three primitives exceeds ~150KB raw.** That is far larger
  than expected and suggests something is being bundled wrongly. Investigate and
  report before proceeding.
- **The timebox is exhausted (one working day) with any of the four questions
  unanswered.** Report what you learned and what remains open. An honest partial
  answer is more useful than an over-run.
- **You are tempted to migrate a real component to prove a point.** Don't. Report
  instead.

## Handoff / after it lands

- **Plan 003 consumes this directly.** Its first step is "read
  `docs/planning/shadcn-adoption-decision.md` and execute the install sequence it
  records." If this spike's decision doc is vague, plan 003 will improvise — which
  is exactly what this plan set is designed to prevent.
- **What a reviewer should scrutinize most**: the theming bridge in Step 5 and its
  a11y result. Everything downstream inherits it, and a bad token mapping there
  becomes invisible technical debt across every future component.
- **Deliberately deferred**: choosing the full component roster. This spike adds
  exactly three primitives to answer risk questions. Which components Graphium
  actually needs is plan 003's decision, made with the spike's findings in hand.

## Outcome

> *Fill this in when the spike completes.*
>
> - **Verdict**: ‹GO / GO-WITH-CAVEATS / NO-GO›
> - **Date**: ‹›
> - **Decision doc**: `docs/planning/shadcn-adoption-decision.md`
> - **One-line summary**: ‹›
