# Plan 002: Prove shadcn/ui works on this stack before committing to it

> **Executor instructions**: Read `plans/CONVENTIONS.md` first. Run the pre-flight (§3), then the
> Drift check below. Follow the steps in order; each step's **Check** must hold before the next.
> If any **If it fails** or STOP condition fires, follow CONVENTIONS §10. Finish with the report
> in §11.

**Drift check** (run after pre-flight, on `plan/002-shadcn-decision`):

```bash
git fetch origin main
G=$(grep -oE 'Grounded at\*\*: `[0-9a-f]{7,40}' plans/002-shadcn-compatibility-spike.md | grep -oE '[0-9a-f]{7,40}$')
git diff --stat "$G"..origin/main -- package.json package-lock.json tsconfig.json \
  vite.config.ts vitest.config.ts .eslintrc.cjs src/index.css src/styles/ src/App.tsx \
  src/test/setup.ts src/components/DesignSystemPlayground/ src/components/SessionConsole/ \
  tests/helpers/ tests/accessibility.spec.ts     # Expected: empty
```

**Citation re-check** (line numbers are hints at `d3d3642`; the grep is authoritative):

| Anchor (grep)                                                                                                  | File                          | Expected hits                       |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------- |
| `grep -c '^@theme' src/index.css`                                                                              | `src/index.css`               | 1 (0 at d3d3642; plans 000/001 add) |
| `grep -c '"paths"' tsconfig.json`                                                                              | `tsconfig.json`               | 0                                   |
| `grep -c '^\s*resolve:' vite.config.ts`                                                                        | `vite.config.ts`              | 0                                   |
| `grep -n "import path from 'node:path'" vite.config.ts`                                                        | `vite.config.ts`              | 1 hit (line 2)                      |
| `grep -n "test:" vite.config.ts`                                                                               | `vite.config.ts`              | 1 hit (line 49)                     |
| `grep -n "const \[tool, setTool\]" src/App.tsx`                                                                | `src/App.tsx`                 | 1 hit (line 135)                    |
| `grep -n "<UpdateManager isOpen={isUpdateManagerOpen} onClose" src/App.tsx`                                    | `src/App.tsx`                 | 1 hit (line 499)                    |
| `grep -n "dispatchSessionConsole({ type: 'STOP' })" src/components/SessionConsole/useSessionConsoleHotkeys.ts` | `useSessionConsoleHotkeys.ts` | 1 hit (line 75)                     |
| `grep -n "^export const componentExamples" src/components/DesignSystemPlayground/playground-registry.tsx`      | `playground-registry.tsx`     | 1 hit (line 110)                    |
| `grep -n "pattern: '@/\*\*'" .eslintrc.cjs`                                                                    | `.eslintrc.cjs`               | 1 hit (line 227)                    |
| `grep -c "ResizeObserver" src/test/setup.ts`                                                                   | `src/test/setup.ts`           | 0                                   |

If any row differs: STOP.

## Status

- **Priority**: P1
- **Effort**: S (step budget, see "Step budget" below; there is no clock)
- **Risk**: LOW (only documentation, a patch file and two screenshots reach `main`)
- **Depends on**: plans/000-repair-verification-infrastructure.md,
  plans/001-stabilize-styling-foundation.md
- **Category**: dx
- **Requires**: `scripts/preflight.sh`, `tests/helpers/bypassLandingPage.ts`,
  `tests/helpers/mockElectronAPIs.ts`, `src/components/DesignSystemPlayground/playground-registry.tsx`,
  `src/components/DesignSystemPlayground/types.ts`,
  `src/components/SessionConsole/useSessionConsoleHotkeys.ts`, `src/index.css` containing exactly
  one `@theme` block, `plans/README.md` row 001 = `DONE`
- **Grounded at**: ‹merge SHA of plan 001, written there by its final step› (citations verified at
  d3d3642)

## Why this matters

Kyle has decided to adopt shadcn/ui fully: CLI, `components.json`, Radix Primitives, CVA, source
owned in-repo. shadcn's documented happy path is React 19 + Next.js; Graphium is React 18.3.1 +
Vite 6.4.1 + Electron with a Radix Colors theme it must keep. Each delta is survivable and each
can cost a week if found halfway through plan 003, after some of the eleven hand-rolled overlays
(`grep -rl 'role="dialog"' src --include=*.tsx | grep -v test | wc -l` → `11`) are half-migrated.
This plan spends one throwaway branch proving the install, the theming bridge, the portal
behaviour and the cost, and leaves plan 003 a decision document, a patch it applies instead of
re-running an interactive CLI, and a mechanical verdict.

## Context the executor needs

All verified at `d3d3642`:

- `react` and `react-dom` resolve to **18.3.1**
  (`grep -n '"node_modules/react"' -A2 package-lock.json`). Vite **6.4.1**, Tailwind **4.1.18**
  via `@tailwindcss/postcss`, vitest **4.0.18**, jsdom **24.1.3**.
- `@radix-ui/colors` is the **only** Radix package
  (`grep -c '"node_modules/@radix-ui/react' package-lock.json` → `0`). No `clsx`,
  `tailwind-merge` or `class-variance-authority`.
- No `@/` alias anywhere: `tsconfig.json` has no `paths`, `vite.config.ts` has no `resolve`,
  `vitest.config.ts` has no `resolve`. `.eslintrc.cjs` **already** has a `pathGroups` entry for
  `@/**` (`grep -n "pattern: '@/\*\*'" .eslintrc.cjs`, line 227) — no ESLint change is needed for
  import ordering. `docs/guides/CONVENTIONS.md` documents a different alias set
  (`grep -n "@components" docs/guides/CONVENTIONS.md`, lines 430 and 444); plan 003 updates it.
- `vitest.config.ts` governs unit tests; when it exists vitest ignores `vite.config.ts`
  entirely, including its duplicate `test:` block (`grep -n "test:" vite.config.ts`, lines 49–70).
  Leave that block alone.
- `tsconfig.json` excludes `**/*.test.ts(x)` and `src/test`; only `npm run test:run` catches a
  broken test file.
- ESLint (`.eslintrc.cjs`, `wc -c` → `13536` bytes) runs with `--max-warnings 0`. Rules that fire
  on shadcn's generated code: `prettier/prettier` (error, double quotes vs `singleQuote`),
  `import/order` (error, auto-fixable), `import/no-unused-modules` (warn, `unusedExports: true`,
  `grep -n "no-unused-modules" .eslintrc.cjs`, line 244), `react-refresh/only-export-components`
  (warn, line 266, fires on `buttonVariants`), `@typescript-eslint/explicit-function-return-type`
  (warn, line 75, fires on shadcn's function declarations). `.ai-rules.md` bans `any` without a
  justifying comment (`grep -n "any" .ai-rules.md | head -3`).
- Husky runs lint-staged on every commit: `eslint --fix` and `prettier --write` on staged
  `*.{ts,tsx}`, `prettier --write` on `*.{css,md,json}`. It **will** rewrite the CLI's double
  quotes to single quotes and reorder imports. That is expected. Never `--no-verify`.
- Theme is a `data-theme="light|dark"` attribute on `<html>` (`src/components/ThemeManager.tsx`,
  `grep -n "data-theme" src/components/ThemeManager.tsx`). shadcn assumes a `.dark` class and
  `prefers-color-scheme`. The bridge must map, not replace.
- Escape protocol: `src/components/SessionConsole/useSessionConsoleHotkeys.ts` stops Session
  Console audio on Escape unless an element with `data-esc-owns="true"` is in the DOM
  (`grep -n 'data-esc-owns' …/useSessionConsoleHotkeys.ts`, line 34; the STOP dispatch is line
  75). When it does stop audio it also calls `stopImmediatePropagation()`, so a Radix dialog
  without `data-esc-owns` would lose its Escape.
- Playwright `Web-Chromium` starts `npm run dev:web` (no `CI`) or `npm run preview:web`
  (`CI=1`). The spike scaffold is `import.meta.env.DEV`-only, so **never** run the spike spec with
  `CI=1`.

### The four questions this spike answers

1. Does `shadcn@1.1.23` install and generate working components on React 18.3.1 without a
   peer-dependency flag?
2. Can the components be re-themed onto `--app-*` through an `@theme inline` bridge and pass
   `npm run test:a11y` in both themes?
3. Do Radix portals behave: portal to `body`, focus trap, Escape (with `data-esc-owns`), focus
   return, tooltip collision flip, `dark:` bound to `data-theme`, nothing rendered in the World
   View page?
4. What does it cost: bytes on `build:web` and `build:electron`, dependency count, ESLint rules
   that need a scoped override, jsdom mocks plan 003's unit tests will need?

## Inputs & resources

Gates: `plans/CONVENTIONS.md` §4.

| Purpose                      | Command                                                                                                 | Expected                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------- |
| shadcn init (pinned)         | `npx shadcn@1.1.23 init -y -d --base-color neutral`                                                     | exit 0, `components.json` |
| shadcn add (pinned)          | `npx shadcn@1.1.23 add button dialog tooltip -y`                                                        | exit 0, three files       |
| Spike portal spec            | `npx playwright test tests/spike-portals.spec.ts --project=Web-Chromium --reporter=list`                | `8 passed`                |
| Web bytes                    | `find dist-web/assets -type f \( -name '*.js' -o -name '*.css' \) -print0 \| xargs -0 wc -c \| tail -1` | `<n> total`               |
| Electron bytes               | `find dist dist-electron -type f -print0 \| xargs -0 wc -c \| tail -1`                                  | `<n> total`               |
| Dependency count             | `npm ls --depth=0 \| wc -l`                                                                             | `<n>`                     |
| Lint rules in generated code | see Step 4 (`lint-rules.txt`)                                                                           | list of rule ids          |

## Scope

**Spike branch `spike/shadcn-compat`** (thrown away): `package.json`, `package-lock.json`,
`tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.eslintrc.cjs`, `components.json`,
`src/index.css`, `src/lib/utils.ts`, `src/components/ui/**`, `src/components/SpikeScaffold.tsx`,
`src/App.tsx`, `src/components/DesignSystemPlayground/{playground-registry.tsx,types.ts}`,
`tests/spike-portals.spec.ts`, `docs/planning/shadcn-adoption-decision.md`,
`docs/planning/shadcn-spike.patch`, `docs/planning/screenshots/002-final/`.

**Docs branch `plan/002-shadcn-decision`** (merged): `docs/planning/shadcn-adoption-decision.md`,
`docs/planning/shadcn-spike.patch`, `docs/planning/screenshots/002-final/*.png`,
`plans/reports/002.md`, `plans/README.md`.

**Out of scope**: migrating any existing component (plan 004); editing `src/styles/theme.css`;
upgrading React; adding any primitive beyond `button`, `dialog`, `tooltip`; changing any
`--app-*` value; editing `tests/accessibility.spec.ts`.

## Step budget

If any single step's **If it fails** path has been taken twice, fill
`docs/planning/shadcn-adoption-decision.md` with what is known (rubric rows you cannot compute
are written `UNANSWERED`), then STOP per CONVENTIONS §10.

## Landing

Branch, commits, PR, CI and rollback: `plans/CONVENTIONS.md` §7. Branch name:
`plan/002-shadcn-decision`. Specific to this plan: Steps 1–9 run on a second branch
`spike/shadcn-compat` (also from `origin/main`) that is never pushed and never gets a PR; Step 10
copies the decision doc, the patch and the screenshots onto `plan/002-shadcn-decision`, opens a
docs-only PR, and deletes the spike branch only after the patch is committed.

## Steps

### Step 1: Create the spike branch, the decision-doc skeleton, and the baseline

**Files**: `docs/planning/shadcn-adoption-decision.md` (new)
**Do**: Pre-flight ran on `plan/002-shadcn-decision`. Create the spike branch from
`origin/main`, run the full gate, measure, and create the decision doc with this exact skeleton
(fill `<…>` values now; later steps fill their sections):

```markdown
# shadcn/ui adoption decision (plan 002)

Verdict: PENDING

## 1. Environment

| Item             | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| Node             | <`node --version`>                                       |
| npm              | <`npm --version`>                                        |
| react (lockfile) | <`grep -n '"node_modules/react"' -A2 package-lock.json`> |
| shadcn CLI       | 1.1.23                                                   |
| origin/main      | <`git rev-parse --short origin/main`>                    |

## 2. Baseline (origin/main)

| Measure          | Command                         | Value |
| ---------------- | ------------------------------- | ----- |
| web bytes        | find dist-web/assets … wc -c    | <n>   |
| electron bytes   | find dist dist-electron … wc -c | <n>   |
| dependency count | npm ls --depth=0 \| wc -l       | <n>   |
| npm run verify   | exit code                       | <n>   |

## 3. What the CLI did (init, add)

## 4. ESLint findings (lint-rules.txt) and the scoped override

## 5. Bridge and final src/index.css

## 6. Portal spec output (tests/spike-portals.spec.ts)

## 7. jsdom probe: stubs required

## 8. Cost

| Measure          | Baseline | Spike | Delta |
| ---------------- | -------- | ----- | ----- |
| web bytes        |          |       |       |
| electron bytes   |          |       |       |
| dependency count |          |       |       |

Extrapolated 12-primitive delta: <bytes>

## 9. Answers to the four questions

## 10. Required changes to plan 003

1.

## 11. Surprises

## 12. Install sequence for plan 003
```

**Do NOT**: run `npm run test:e2e`; run any `shadcn` command yet; edit `src/` or configs;
push the spike branch.
**Commands**:

```bash
git fetch origin main && git checkout -b spike/shadcn-compat origin/main
node --version; npm --version; grep -n '"node_modules/react"' -A2 package-lock.json
npm ls --depth=0 | wc -l
npm run verify
find dist-web/assets -type f \( -name '*.js' -o -name '*.css' \) -print0 | xargs -0 wc -c | tail -1
find dist dist-electron -type f -print0 | xargs -0 wc -c | tail -1
git add docs/planning/shadcn-adoption-decision.md && git commit -m "plan-002 step-1: spike branch and baseline"
```

**Expected**: `git checkout` prints `Switched to a new branch 'spike/shadcn-compat'`; version
lines; a count; `npm run verify` exit 0; two `<n> total` lines; commit succeeds.
**Check**: `grep -c '<n>' docs/planning/shadcn-adoption-decision.md` prints `0` for sections 1–2
(every placeholder in §1 and §2 replaced by a real value).
**If it fails**: `npm run verify` non-zero on a clean `origin/main` is drift in the previous plan:
STOP with the failing command's output.
**Commit**: `plan-002 step-1: spike branch and baseline`

### Step 2: Add the `@/` alias to tsconfig, Vite and vitest, and prove it

**Files**: `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `src/spike-alias.test.ts`
(created and deleted in this step)
**Do**: In `tsconfig.json` `compilerOptions`, add after `"types": ["node"],`:

```json
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
```

In `vite.config.ts`, inside the returned object, add directly after the `define: { … },` block
(`path` is already imported on line 2):

```ts
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
```

Replace `vitest.config.ts` in full:

```ts
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**/*', 'src/vite-env.d.ts'],
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
  },
});
```

Create `src/spike-alias.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { useGameStore } from '@/store/gameStore';

describe('plan 002 alias probe', () => {
  it('resolves @/ through vitest.config.ts', () => {
    expect(typeof useGameStore.getState).toBe('function');
  });
});
```

Run the commands; then `rm src/spike-alias.test.ts`. The Vite alias is exercised for real in
Step 4, when generated files that import `@/lib/utils` are built.
**Do NOT**: touch the `test:` block in `vite.config.ts`; add `@components/*`-style aliases from
`docs/guides/CONVENTIONS.md`; leave `src/spike-alias.test.ts` in the tree.
**Commands**:

```bash
npm run test:run 2>&1 | grep -E "spike-alias|Test Files"
npm run type-check
rm src/spike-alias.test.ts
npm run verify:static
git add -A && git commit -m "plan-002 step-2: add the @/ alias to tsconfig, vite and vitest"
```

**Expected**: a line containing `spike-alias.test.ts` with a pass mark and a `Test Files … passed`
line; exit 0; exit 0.
**Check**: `npm run verify:static` exits 0 and `git ls-files src/spike-alias.test.ts` prints
nothing.
**If it fails**: if the probe test cannot resolve `@/store/gameStore`, re-read the
`vitest.config.ts` block above and paste it again once; a second failure is a STOP.
**Commit**: `plan-002 step-2: add the @/ alias to tsconfig, vite and vitest`

### Step 3: Run the pinned shadcn init and record exactly what it did

**Files**: `components.json` (new), `src/lib/utils.ts` (new), `package.json`,
`package-lock.json`, `src/index.css` (restored), `tsconfig.json`, `vite.config.ts`,
`tailwind.config.js` (deleted if the CLI recreates it),
`docs/planning/shadcn-adoption-decision.md`
**Do**: Run the init, then capture and clean up:

1. `npx shadcn@1.1.23 init -y -d --base-color neutral`.
2. Paste into decision doc §3: the exact command, the full `components.json`,
   `git status --porcelain`, `git diff package.json`, and `git diff src/index.css` **verbatim**
   (this is the record of the OKLCH `:root`/`.dark` blocks, `@custom-variant dark (&:is(.dark *))`,
   `@import "tw-animate-css"`, the `@layer base { * { @apply border-border … } }` rules and the
   `@theme inline` block the CLI writes; Step 5 replaces all of them).
3. If `components.json` has a `tailwind.css` value other than `src/index.css`, edit it to
   `src/index.css`.
4. `git checkout origin/main -- src/index.css` (restores plans 000/001's file; the bridge is
   built in Step 5). If `tailwind.config.js` exists, `git rm -f tailwind.config.js` and record
   that the CLI recreated it.
5. If `git status --porcelain` lists `tsconfig.json` or `vite.config.ts`, paste `git diff` of
   them into §3; keep the CLI's edits if `npm run type-check` and `npm run build:web` exit 0,
   otherwise `git checkout -- <file>` (Step 2's committed version) and record that.
6. Record in §3 every dependency added and its resolved version
   (`git diff package.json`; `grep -n '"node_modules/<name>"' -A1 package-lock.json`), and whether
   npm printed `ERESOLVE` or `peer dep` warnings (paste them).

**Do NOT**: write the bridge yet; answer any prompt with anything other than the repo's facts
(TypeScript yes, CSS `src/index.css`, alias `@/components` and `@/lib/utils`); keep the CLI's
`src/index.css`; run `add` yet.
**Commands**:

```bash
npx shadcn@1.1.23 init -y -d --base-color neutral
git status --porcelain
git diff package.json src/index.css tsconfig.json vite.config.ts
git checkout origin/main -- src/index.css
test -f tailwind.config.js && git rm -f tailwind.config.js; true
npm run type-check && npm run build:web
grep -c '^@theme' src/index.css
git add -A && git commit -m "plan-002 step-3: shadcn init (pinned 1.1.23), index.css restored"
```

**Expected**: init exit 0; a status list containing `components.json` and `src/lib/utils.ts`;
diffs; exit 0; exit 0; `1`.
**Check**: `test -f components.json && grep -c "export function cn" src/lib/utils.ts` prints `1`
and `npm run type-check` exits 0.
**If it fails**: if the CLI rejects a flag, run `npx shadcn@1.1.23 init --help`, paste the output
into §3, use the equivalent flag and retry once; if it is interactive with no non-interactive
path, answer as in **Do NOT** and record every answer verbatim in §3. If npm fails with
`ERESOLVE`, retry once as `npm install --legacy-peer-deps` and record it in §3 (rubric row B1).
If it still fails, or the CLI demands React 19: STOP (rubric row A1; do not upgrade React).
**Commit**: `plan-002 step-3: shadcn init (pinned 1.1.23), index.css restored`

### Step 4: Add the three primitives and pin down the ESLint findings

**Files**: `src/components/ui/button.tsx`, `src/components/ui/dialog.tsx`,
`src/components/ui/tooltip.tsx` (new), `package.json`, `package-lock.json`, `.eslintrc.cjs`,
`docs/planning/shadcn-adoption-decision.md`
**Do**: `npx shadcn@1.1.23 add button dialog tooltip -y`. Then:

1. `npm run lint:fix` (fixes `prettier/prettier` and `import/order`).
2. Produce the list of rules still firing in generated code:

   ```bash
   npx eslint src/components/ui src/lib --ext ts,tsx --max-warnings 0 --format json \
     | node -e 'const r=JSON.parse(require("fs").readFileSync(0,"utf8"));const s=new Set();for(const f of r)for(const m of f.messages)s.add(m.ruleId);console.log([...s].sort().join("\n"))' \
     | tee lint-rules.txt
   ```

3. Append to the `overrides` array in `.eslintrc.cjs`, before its closing `],`, one entry whose
   `rules` turns **off every rule id in `lint-rules.txt`** (start from this block and add lines):

   ```js
    // Plan 002 spike: shadcn-generated code. Every rule here is recorded in
    // docs/planning/shadcn-adoption-decision.md section 4.
    {
      files: ['src/components/ui/**/*.tsx', 'src/lib/utils.ts', 'src/components/SpikeScaffold.tsx'],
      rules: {
        'import/no-unused-modules': 'off',
        'react-refresh/only-export-components': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
      },
    },
   ```

4. Paste `lint-rules.txt` and the final override block into decision doc §4. Record any new
   dependency `add` installed (`git diff package.json`), e.g. `@radix-ui/react-slot`,
   `@radix-ui/react-dialog`, `@radix-ui/react-tooltip`, `lucide-react`.
5. `rm lint-rules.txt`.

**Do NOT**: hand-edit the generated files; add rules to the override that did not appear in
`lint-rules.txt`; add a fourth component; edit `tests/`.
**Commands**:

```bash
npx shadcn@1.1.23 add button dialog tooltip -y
ls src/components/ui/
npm run lint:fix; true
# (the JSON listing command from item 2)
# (edit .eslintrc.cjs per item 3)
rm lint-rules.txt
npm run verify:static
npm run build:web
git add -A && git commit -m "plan-002 step-4: add button, dialog, tooltip; scoped ESLint override"
```

**Expected**: exit 0; `button.tsx dialog.tsx tooltip.tsx`; a list of rule ids; exit 0; exit 0.
**Check**: `npm run verify:static` exits 0 and decision doc §4 contains the rule list.
**If it fails**: if `npm run lint` still fails inside `src/components/ui/` after the override,
re-run the listing command, add the missing ids, retry once; twice is a STOP. If the pre-commit
hook rejects the commit, paste its output into §4 and treat the rule it names the same way.
**Commit**: `plan-002 step-4: add button, dialog, tooltip; scoped ESLint override`

### Step 5: Build the theming bridge, register the primitives, run the a11y gate

**Files**: `src/index.css`, `src/components/DesignSystemPlayground/playground-registry.tsx`,
`src/components/DesignSystemPlayground/types.ts`, `docs/planning/shadcn-adoption-decision.md`
**Do**:

1. Edit `src/index.css` so its head reads exactly as follows. Line 2 (`tw-animate-css`) is
   present **only if** `grep -c tw-animate-css package.json` prints `1`. The comment line inside
   `@theme` stands for plans 000/001's declarations, which stay byte-for-byte (do not type the
   comment). `@custom-variant` replaces the CLI's `.dark`-class variant. The bridge is a
   **second** `@theme inline` block (Tailwind merges multiple `@theme` blocks; both must be
   `inline`, because plain `@theme` snapshots values and would break the light/dark swap). Do
   not add `--radius`, `--radius-*`, `--chart-*` or `--sidebar-*`: plan 000's `@theme`
   already aliases `--radius-*` to `--app-radius-*`.

   ```css
   @import 'tailwindcss';
   @import 'tw-animate-css';
   @import './styles/fonts.css';
   @import './styles/theme.css';
   @import './styles/app.css';

   @custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));

   @theme inline {
     /* …plan 000's token aliases and plan 001's --animate-slide-down, unchanged… */
   }

   @keyframes slideDown {
     /* …plan 001's keyframes, unchanged… */
   }

   /* Plan 002 bridge: shadcn token names defined in terms of Graphium's --app-* variables.
      `inline` keeps the var() references so theme.css's [data-theme='dark'] swap reaches every
      shadcn utility. shadcn's `accent` is the neutral row-hover colour, NOT Graphium's brand
      accent; it maps to --app-bg-hover on purpose. */
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
     --color-accent: var(--app-bg-hover);
     --color-accent-foreground: var(--app-text-primary);
     --color-destructive: var(--app-error-solid);
     --color-destructive-foreground: var(--app-accent-solid-text);
     --color-border: var(--app-border-subtle);
     --color-input: var(--app-border-default);
     --color-ring: var(--app-accent-solid);
   }

   /* Ensure html, body, and root fill viewport */
   html,
   body {
   ```

   Every `--app-*` name above exists in `src/styles/theme.css`
   (`grep -c -- "--app-accent-solid-text:" src/styles/theme.css` → `2`, one per theme).

2. Prove the bridge covers every token the three files use (prints nothing when complete):

   ```bash
   grep -ohE "(bg|text|border|ring|outline|fill|stroke)-(background|foreground|card|popover|primary|secondary|muted|accent|destructive|border|input|ring|white)(-foreground)?(/[0-9]+)?" src/components/ui/*.tsx \
     | sed -E 's#^[a-z]+-##; s#/[0-9]+$##' | sort -u | grep -v '^white$' \
     | while read -r t; do grep -q -- "--color-$t:" src/index.css || echo "MISSING --color-$t"; done
   grep -ohE "rounded-(sm|md|lg|xl|2xl|full)" src/components/ui/*.tsx | sort -u
   ```

   Paste both outputs into decision doc §5. `text-white` is a Tailwind built-in; radius
   utilities beyond `sm|md|lg` fall through to Tailwind defaults — record which appear.

3. Record the destructive contrast (the generated `destructive` variant uses `text-white` on
   `--app-error-solid` = `--red-9` = `#e5484d`):

   ```bash
   node -e 'const L=h=>{const c=[1,3,5].map(i=>parseInt(h.substr(i,2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]};console.log(((1+0.05)/(L("#e5484d")+0.05)).toFixed(2))'
   ```

   Expected `3.91`. Write it in §5; it is rubric row B6. Because it is below 4.5:1, the
   playground example below renders the `default`, `secondary` and `outline` variants only; the
   destructive variant is rendered inside the spike dialog (Step 6), which axe does not scan.

4. In `src/components/DesignSystemPlayground/types.ts`, change `| 'performance';` (line 22) to:

   ```ts
       | 'performance'
       | 'shadcn-spike';
   ```

5. In `playground-registry.tsx`, add after the `@remixicon/react` import block:

   ```tsx
   import { Button } from '@/components/ui/button';
   import {
     Dialog,
     DialogContent,
     DialogDescription,
     DialogTitle,
     DialogTrigger,
   } from '@/components/ui/dialog';
   import {
     Tooltip,
     TooltipContent,
     TooltipProvider,
     TooltipTrigger,
   } from '@/components/ui/tooltip';
   ```

   Append to the `categories` array, after the `id: 'performance'` object
   (`grep -n "id: 'performance'" …/playground-registry.tsx`, line 101; an example's `category`
   must also exist here or it never renders):

   ```tsx
     {
       id: 'shadcn-spike',
       name: 'shadcn spike (plan 002)',
       description: 'Generated primitives rendered through the @theme inline bridge',
     },
   ```

   Append to the `componentExamples` array, before the file's final `];`:

   ```tsx
     // PLAN 002 SPIKE (spike branch only)
     {
       id: 'spike-shadcn-button',
       name: 'shadcn Button',
       category: 'shadcn-spike',
       description: 'CVA variants through the bridge',
       component: (
         <div className="flex gap-2">
           <Button>Default</Button>
           <Button variant="secondary">Secondary</Button>
           <Button variant="outline">Outline</Button>
         </div>
       ),
       code: `<Button variant="secondary">Secondary</Button>`,
       tags: ['spike', 'shadcn'],
     },
     {
       id: 'spike-shadcn-dialog',
       name: 'shadcn Dialog',
       category: 'shadcn-spike',
       description: 'Radix portal, focus trap, Escape',
       component: (
         <Dialog>
           <DialogTrigger asChild>
             <Button>Open dialog</Button>
           </DialogTrigger>
           <DialogContent data-esc-owns="true">
             <DialogTitle>Spike dialog</DialogTitle>
             <DialogDescription>Rendered through a Radix portal.</DialogDescription>
           </DialogContent>
         </Dialog>
       ),
       code: `<DialogContent data-esc-owns="true">…</DialogContent>`,
       tags: ['spike', 'shadcn', 'dialog'],
     },
     {
       id: 'spike-shadcn-tooltip',
       name: 'shadcn Tooltip',
       category: 'shadcn-spike',
       description: 'Second portal type',
       component: (
         <TooltipProvider>
           <Tooltip>
             <TooltipTrigger asChild>
               <Button variant="outline">Hover me</Button>
             </TooltipTrigger>
             <TooltipContent>Tooltip through the bridge</TooltipContent>
           </Tooltip>
         </TooltipProvider>
       ),
       code: `<TooltipContent>Tooltip through the bridge</TooltipContent>`,
       tags: ['spike', 'shadcn', 'tooltip'],
     },
   ```

6. Run the gate. Record the number of scans and the result in §5.

**Do NOT**: edit `src/styles/theme.css`; create a second plain `@theme`; keep any `:root`,
`.dark`, `@layer base` or `--radius` line from the CLI; render the destructive variant in the
playground; edit `tests/accessibility.spec.ts` or any axe `exclude()`.
**Commands**:

```bash
grep -c '^@theme' src/index.css
grep -c '^@custom-variant dark' src/index.css
grep -nE "^\s*--color-[a-z-]+: [^v]" src/index.css
# (coverage and contrast commands from items 2–3)
npx playwright test accessibility.spec.ts --project=Web-Chromium --list | tail -1
npm run test:a11y
npm run verify:static
git add -A && git commit -m "plan-002 step-5: theming bridge, dark variant, playground registration"
```

**Expected**: `2` (plan 000's `@theme inline` block and the bridge block); `1`; nothing (every bridge value is a
`var()`); nothing / a radius list; `3.91`; `Total: N tests in 1 file`; `N passed`; exit 0.
**Check**: `npm run test:a11y` exits 0 with the same `N` that `--list` printed.
**If it fails**: an axe `color-contrast` violation names an element; find its Tailwind class,
map it back through the bridge, record the pair in §5 and retry once after correcting a typo
in the block above. If a correctly transcribed bridge still fails: STOP (rubric row A2). Never
hardcode a colour or exclude the element.
**Commit**: `plan-002 step-5: theming bridge, dark variant, playground registration`

### Step 6: Prove portal, focus, Escape, `data-esc-owns`, tooltip flip, dark variant and World View

**Files**: `src/components/SpikeScaffold.tsx` (new), `src/App.tsx`,
`tests/spike-portals.spec.ts` (new), `docs/planning/screenshots/002-final/spike-dialog-light.png`,
`docs/planning/screenshots/002-final/spike-dialog-dark.png`,
`docs/planning/shadcn-adoption-decision.md`
**Do**:

1. Create `src/components/SpikeScaffold.tsx` (spike branch only; renders only in DEV, in the
   Architect page, when `localStorage` has `graphium-spike=1`):

   ```tsx
   import { useState } from 'react';

   import { Button } from '@/components/ui/button';
   import {
     Dialog,
     DialogContent,
     DialogDescription,
     DialogTitle,
     DialogTrigger,
   } from '@/components/ui/dialog';
   import {
     Tooltip,
     TooltipContent,
     TooltipProvider,
     TooltipTrigger,
   } from '@/components/ui/tooltip';
   import { useGameStore } from '@/store/gameStore';

   interface SpikeScaffoldProps {
     onSelectMarker: () => void;
   }

   function fakePlay(): void {
     useGameStore.setState((state) => ({
       sessionConsoleRuntime: {
         ...state.sessionConsoleRuntime,
         audio: { ...state.sessionConsoleRuntime.audio, status: 'playing' as const },
       },
     }));
   }

   export function SpikeScaffold({ onSelectMarker }: SpikeScaffoldProps): React.JSX.Element | null {
     const audioStatus = useGameStore((state) => state.sessionConsoleRuntime.audio.status);
     const drawingCount = useGameStore((state) => state.drawings.length);
     const [open, setOpen] = useState(false);
     if (localStorage.getItem('graphium-spike') !== '1') {
       return null;
     }
     return (
       <TooltipProvider>
         <div
           data-testid="spike-root"
           style={{ position: 'fixed', top: 8, right: 8, zIndex: 1000 }}
         >
           <span data-testid="spike-audio-status">{audioStatus}</span>
           <span data-testid="spike-drawing-count">{drawingCount}</span>
           <button type="button" data-testid="spike-fake-play" onClick={fakePlay}>
             fake play
           </button>
           <button type="button" data-testid="spike-select-marker" onClick={onSelectMarker}>
             marker tool
           </button>
           <div data-testid="spike-dark-probe" className="h-4 w-4 bg-white dark:bg-black" />
           <Dialog open={open} onOpenChange={setOpen}>
             <DialogTrigger asChild>
               <Button data-testid="spike-dialog-trigger">Open spike dialog</Button>
             </DialogTrigger>
             <DialogContent data-testid="spike-dialog-content" data-esc-owns="true">
               <DialogTitle>Spike dialog</DialogTitle>
               <DialogDescription>Radix portal, focus trap and Escape probe.</DialogDescription>
               <Button data-testid="spike-dialog-primary">Primary</Button>
               <Button variant="destructive" data-testid="spike-dialog-destructive">
                 Destructive
               </Button>
               <Tooltip>
                 <TooltipTrigger asChild>
                   <Button variant="outline" data-testid="spike-tooltip-in-dialog-trigger">
                     Hover me
                   </Button>
                 </TooltipTrigger>
                 <TooltipContent data-testid="spike-tooltip-in-dialog-content">
                   Tooltip inside dialog
                 </TooltipContent>
               </Tooltip>
             </DialogContent>
           </Dialog>
         </div>
         <div style={{ position: 'fixed', bottom: 0, left: '50%', zIndex: 1000 }}>
           <Tooltip>
             <TooltipTrigger asChild>
               <Button variant="secondary" data-testid="spike-tooltip-edge-trigger">
                 Edge tooltip
               </Button>
             </TooltipTrigger>
             <TooltipContent side="bottom" data-testid="spike-tooltip-edge-content">
               Should flip to top
             </TooltipContent>
           </Tooltip>
         </div>
       </TooltipProvider>
     );
   }
   ```

2. In `src/App.tsx`, add after `import Sidebar from './components/Sidebar';`
   (`grep -n "import Sidebar from" src/App.tsx`, line 29):

   ```tsx
   import { SpikeScaffold } from './components/SpikeScaffold';
   ```

   and, in the editor branch, directly after the three-line block ending
   `</UpdateManagerErrorBoundary>` that contains
   `<UpdateManager isOpen={isUpdateManagerOpen} onClose=` (line 499; the only single-line
   occurrence):

   ```tsx
   {
     import.meta.env.DEV && isArchitectView && (
       <SpikeScaffold onSelectMarker={() => setTool('marker')} />
     );
   }
   ```

3. Create `tests/spike-portals.spec.ts`:

   ```ts
   import { expect, test, type Page } from '@playwright/test';

   import { bypassLandingPageAndInjectState } from './helpers/bypassLandingPage';
   import { injectMockElectronAPIs } from './helpers/mockElectronAPIs';

   const SHOTS = 'docs/planning/screenshots/002-final';

   async function openArchitect(page: Page): Promise<void> {
     await page.addInitScript(() => {
       localStorage.setItem('graphium-spike', '1');
     });
     await bypassLandingPageAndInjectState(page);
     if (!(await page.getByTestId('editor-view').isVisible())) {
       await page.getByTestId('new-campaign-button').click();
     }
     await expect(page.getByTestId('editor-view')).toBeVisible();
     await expect(page.getByTestId('spike-root')).toBeVisible();
   }

   async function focusIsInsideDialog(page: Page): Promise<boolean> {
     return page.evaluate(
       () => document.activeElement?.closest('[data-testid="spike-dialog-content"]') !== null,
     );
   }

   test.describe('plan 002 spike: Radix portals on this stack', () => {
     test.beforeEach(async ({ page }) => {
       await openArchitect(page);
     });

     test('portal: dialog renders under body, Escape closes it, focus returns', async ({
       page,
     }) => {
       const trigger = page.getByTestId('spike-dialog-trigger');
       const content = page.getByTestId('spike-dialog-content');
       await trigger.click();
       await expect(content).toBeVisible();
       expect(await content.evaluate((el) => el.closest('#root') === null)).toBe(true);
       await page.keyboard.press('Escape');
       await expect(content).toBeHidden();
       await expect(trigger).toBeFocused();
     });

     test('focus: Tab cycles inside the open dialog', async ({ page }) => {
       await page.getByTestId('spike-dialog-trigger').click();
       await expect(page.getByTestId('spike-dialog-content')).toBeVisible();
       for (let i = 0; i < 10; i += 1) {
         await page.keyboard.press('Tab');
         expect(await focusIsInsideDialog(page), `Tab #${i + 1}`).toBe(true);
       }
     });

     test('esc-owns: Escape closes the dialog and does not stop audio', async ({ page }) => {
       await page.getByTestId('spike-fake-play').click();
       await expect(page.getByTestId('spike-audio-status')).toHaveText('playing');
       await page.getByTestId('spike-dialog-trigger').click();
       await expect(page.getByTestId('spike-dialog-content')).toBeVisible();
       await page.keyboard.press('Escape');
       await expect(page.getByTestId('spike-dialog-content')).toBeHidden();
       await expect(page.getByTestId('spike-audio-status')).toHaveText('playing');
     });

     test('pointer: the canvas receives nothing while the dialog is open', async ({ page }) => {
       await page.getByTestId('spike-select-marker').click();
       await page.getByTestId('spike-dialog-trigger').click();
       await expect(page.getByTestId('spike-dialog-content')).toBeVisible();
       expect(await page.evaluate(() => getComputedStyle(document.body).pointerEvents)).toBe(
         'none',
       );
       const box = await page.locator('.konvajs-content').first().boundingBox();
       if (!box) {
         throw new Error('Konva stage not found');
       }
       const x = box.x + box.width / 2;
       const y = box.y + box.height / 2;
       await page.mouse.move(x, y);
       await page.mouse.down();
       await page.mouse.move(x + 80, y + 80, { steps: 8 });
       await page.mouse.up();
       await expect(page.getByTestId('spike-dialog-content')).toBeHidden();
       await expect(page.getByTestId('spike-drawing-count')).toHaveText('0');
     });

     test('tooltip: opens inside the dialog', async ({ page }) => {
       await page.getByTestId('spike-dialog-trigger').click();
       await page.getByTestId('spike-tooltip-in-dialog-trigger').hover();
       await expect(page.getByTestId('spike-tooltip-in-dialog-content')).toBeVisible();
     });

     test('tooltip: flips away from the viewport edge', async ({ page }) => {
       await page.getByTestId('spike-tooltip-edge-trigger').hover();
       const edge = page.getByTestId('spike-tooltip-edge-content');
       await expect(edge).toBeVisible();
       await expect(edge).toHaveAttribute('data-side', 'top');
     });

     test('dark variant follows data-theme, not the OS preference', async ({ page }) => {
       const probe = page.getByTestId('spike-dark-probe');
       await page.emulateMedia({ colorScheme: 'dark' });
       await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
       await expect(probe).toHaveCSS('background-color', 'rgb(255, 255, 255)');
       await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
       await expect(probe).toHaveCSS('background-color', 'rgb(0, 0, 0)');
       await page.getByTestId('spike-dialog-trigger').click();
       await expect(page.getByTestId('spike-dialog-content')).toBeVisible();
       await page.screenshot({ path: `${SHOTS}/spike-dialog-dark.png` });
       await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
       await page.screenshot({ path: `${SHOTS}/spike-dialog-light.png` });
     });

     test('world view: the Architect dialog renders nothing in the World page', async ({
       page,
       context,
     }) => {
       const world = await context.newPage();
       await world.addInitScript(injectMockElectronAPIs);
       await world.goto('/?type=world');
       await expect(world.getByTestId('editor-view')).toBeVisible();
       await page.getByTestId('spike-dialog-trigger').click();
       await expect(page.getByTestId('spike-dialog-content')).toBeVisible();
       await world.waitForTimeout(500);
       expect(await world.locator('[role="dialog"]').count()).toBe(0);
       expect(await world.getByTestId('spike-dialog-content').count()).toBe(0);
       expect(await world.getByTestId('spike-root').count()).toBe(0);
       await world.close();
     });
   });
   ```

4. Run the spec (dev server; **no** `CI=1`). Paste the full `--reporter=list` output into
   decision doc §6, verbatim, including any failure and its message.

**Do NOT**: convert `AboutModal` or any real overlay; run with `CI=1`; edit
`playwright.config.ts`; add `test.skip`; put the scaffold anywhere but the editor branch.
**Commands**:

```bash
npm run type-check
npx playwright test tests/spike-portals.spec.ts --project=Web-Chromium --reporter=list
ls docs/planning/screenshots/002-final/
npm run verify:static
git add -A && git commit -m "plan-002 step-6: spike scaffold and portal spec"
```

**Expected**: exit 0; `8 passed`; `spike-dialog-dark.png  spike-dialog-light.png`; exit 0.
**Check**: decision doc §6 contains the reporter output and both PNGs exist.
**If it fails**: a failing test is a **finding, not a defect of this plan**: re-run once to rule
out flake; if it fails again, record it in §6 as-is and continue (rubric rows A3/B4 read it).
The step's Check still holds. If the spec cannot reach `spike-root` at all (scaffold not
rendered), re-check item 2's insertion point once; twice is a STOP.
**Commit**: `plan-002 step-6: spike scaffold and portal spec`

### Step 7: Probe jsdom for the mocks plan 003's unit tests will need

**Files**: `src/components/ui/spike-jsdom.test.tsx` (new),
`docs/planning/shadcn-adoption-decision.md`
**Do**: Create the test with an **empty** MOCKS block, run it, and add stubs only as the failing
output names them (at most three iterations):

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// MOCKS — empty on the first run. Add only the stubs the failing output names (plan 002 Step 7).

describe('plan 002 jsdom probe', () => {
  it('opens a Dialog on click and closes it on Escape', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Probe</DialogTitle>
          <DialogDescription>jsdom probe</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows a Tooltip on hover', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button>Hover</Button>
          </TooltipTrigger>
          <TooltipContent>Tip</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    await user.hover(screen.getByRole('button', { name: 'Hover' }));
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
    expect(vi.isMockFunction(vi.fn())).toBe(true);
  });
});
```

Stubs, keyed by the error text in the run output; paste the matching line(s) into the MOCKS
block:

| Output contains                       | Add to MOCKS                                                                                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ResizeObserver is not defined`       | `window.ResizeObserver = vi.fn(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() })) as unknown as typeof ResizeObserver;`                                |
| `hasPointerCapture is not a function` | `Element.prototype.hasPointerCapture = vi.fn(() => false);` plus `Element.prototype.setPointerCapture = vi.fn();` and `Element.prototype.releasePointerCapture = vi.fn();` |
| `scrollIntoView is not a function`    | `Element.prototype.scrollIntoView = vi.fn();`                                                                                                                              |
| `PointerEvent is not defined`         | record in §7 as a caveat; jsdom 24.1.3 is expected to have it                                                                                                              |
| anything else                         | record verbatim in §7                                                                                                                                                      |

Record in §7: the first run's error lines, the final MOCKS block, and the number of iterations.
**Do NOT**: edit `src/test/setup.ts` (plan 003 does that, using §7); mock React or Radix
modules; leave the probe red.
**Commands**:

```bash
npx vitest run src/components/ui/spike-jsdom.test.tsx 2>&1 | tail -40
# (add stubs per the table; repeat at most three times)
npm run verify:static
git add -A && git commit -m "plan-002 step-7: jsdom probe"
```

**Expected**: first run: errors naming missing globals (or `2 passed`); final run: `2 passed`;
exit 0.
**Check**: `npm run verify:static` exits 0 and §7 lists the stubs.
**If it fails**: still red after three iterations: `git rm -f src/components/ui/spike-jsdom.test.tsx`,
paste the final output into §7, and continue (rubric row B7 = caveat with that output).
**Commit**: `plan-002 step-7: jsdom probe`

### Step 8: Measure the cost

**Files**: `docs/planning/shadcn-adoption-decision.md`
**Do**: Run the full gate and the three measurements from Step 1 with identical commands; fill
decision doc §8 with baseline, spike and delta (bytes and count). Compute
`Extrapolated 12-primitive delta = 2 × (spike web bytes − baseline web bytes)` and write it on
the line `Extrapolated 12-primitive delta: <bytes>` **exactly in that form** — plan 003 reads
that line. (Rationale, one sentence, also in §8: `tailwind-merge`, `clsx` and CVA are paid once
and are roughly half of a three-primitive delta; nine more Radix primitives roughly equal the
other half.)
**Do NOT**: change any file other than the decision doc; use `du -sh`; compare hashed asset
filenames.
**Commands**:

```bash
npm run verify
find dist-web/assets -type f \( -name '*.js' -o -name '*.css' \) -print0 | xargs -0 wc -c | tail -1
find dist dist-electron -type f -print0 | xargs -0 wc -c | tail -1
npm ls --depth=0 | wc -l
grep -n "^Extrapolated 12-primitive delta: [0-9]" docs/planning/shadcn-adoption-decision.md
git add -A && git commit -m "plan-002 step-8: measure the cost"
```

**Expected**: exit 0 (a non-zero exit is recorded in §8 and §11, and the step continues);
`<n> total` ×2; a count; one matching line.
**Check**: the `grep` prints exactly one line with a number.
**If it fails**: if `npm run verify` fails in a project unrelated to the spike files, paste the
failing test names into §11 and continue; if it fails inside `src/components/ui/`, fix once and
retry, twice is a STOP.
**Commit**: `plan-002 step-8: measure the cost`

### Step 9: Compute the verdict mechanically, write the patch, finish the doc

**Files**: `docs/planning/shadcn-adoption-decision.md`, `docs/planning/shadcn-spike.patch` (new)
**Do**: Fill §9–§12, then replace `Verdict: PENDING` with the first row that matches, top to
bottom. Every row is a fact already in the doc; do not weigh them.

| Row | Observable (where in the doc)                                                                                                                                                                                                    | If true → verdict |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| A1  | init/add could not install on React 18.3.1 even with `--legacy-peer-deps` (§3)                                                                                                                                                   | **NO-GO**         |
| A2  | `npm run test:a11y` fails on a correctly transcribed bridge (§5)                                                                                                                                                                 | **NO-GO**         |
| A3  | spec test `world view: …` failed (§6)                                                                                                                                                                                            | **NO-GO**         |
| A4  | spike web bytes − baseline web bytes > 500000 (§8)                                                                                                                                                                               | **NO-GO**         |
| B1  | `--legacy-peer-deps` or an `overrides` entry was needed (§3)                                                                                                                                                                     | GO-WITH-CAVEATS   |
| B2  | §4 rule list has any id outside {`import/no-unused-modules`, `react-refresh/only-export-components`, `@typescript-eslint/explicit-function-return-type`} (`prettier/prettier` and `import/order` are auto-fixed and never count) | GO-WITH-CAVEATS   |
| B3  | the coverage command in Step 5 printed a `MISSING` line, or `grep -nE "^\s*--color-[a-z-]+: [^v]" src/index.css` prints anything (§5)                                                                                            | GO-WITH-CAVEATS   |
| B4  | any spec test other than `world view: …` failed (§6)                                                                                                                                                                             | GO-WITH-CAVEATS   |
| B5  | the CLI added a dependency outside {`clsx`, `tailwind-merge`, `class-variance-authority`, `tw-animate-css`, `@radix-ui/*`} — e.g. `lucide-react` (§3, §4)                                                                        | GO-WITH-CAVEATS   |
| B6  | white on `--color-destructive` < 4.50 (§5; known `3.91`)                                                                                                                                                                         | GO-WITH-CAVEATS   |
| B7  | the jsdom probe needed one or more stubs, or was deleted (§7)                                                                                                                                                                    | GO-WITH-CAVEATS   |
| B8  | web delta > 150000 bytes (§8)                                                                                                                                                                                                    | GO-WITH-CAVEATS   |
| —   | none of the above                                                                                                                                                                                                                | **GO**            |

For every B row that is true, write one numbered entry in §10 "Required changes to plan 003"
with the exact edit, using these templates:

- B1: "Run `npm install --legacy-peer-deps` (or keep the `overrides` block below) in every
  install step; add it to `scripts/preflight.sh`."
- B2: "Extend the `.eslintrc.cjs` override for `src/components/ui/**` with: `<rule ids>`."
- B3: "Add to the bridge: `<line>`", or "Replace literal `<value>` with `var(--app-…)`."
- B4: "Test `<name>` failed with `<message>`; plan 003's `<Dialog|Tooltip>` wrapper must
  `<workaround>`." (For an esc-owns failure: "Dialog and Sheet wrappers take `ownsEscape`
  defaulting to `true` and render `data-esc-owns` themselves.")
- B5: "`lucide-react` was added by `dialog`; plan 003 either adds it to its allowed dependency
  list or replaces `XIcon` with `RiCloseLine` from `@remixicon/react` in `dialog.tsx` — raise
  decision file `003-icon-library` before Step 1."
- B6: "`destructive` variant text is 3.91:1 on `--app-error-solid`; plan 003 must not render
  `variant="destructive"` on any scanned surface until plan 006b changes the palette, or must map
  `--color-destructive` to an AA-passing value — raise decision file `003-destructive-contrast`."
- B7: "Add to `src/test/setup.ts`: `<final MOCKS block>`."
- B8: "Investigate the chunk list in `dist-web/assets` before adding tranche 2."

Also in §10 always add: "Update `docs/guides/CONVENTIONS.md` alias section (lines 430–444 at
d3d3642) to `@/*` → `./src/*`." and "`tw-animate-css` is/is not present; `dialog` animations
depend on it — keep/remove accordingly (record what §3 says)." and "The CLI's `@layer base`
universal `border-border`/`outline-ring/50` rules were dropped; do not reintroduce them."

§12 "Install sequence for plan 003" is exactly:

```markdown
1. `git apply --3way docs/planning/shadcn-spike.patch`
2. `npm install` (add `--legacy-peer-deps` only if §10 says so)
3. `npm run verify:static && npm run build:web`
   The patch contains: package.json/lock, tsconfig, vite and vitest aliases, components.json,
   .eslintrc.cjs override, src/index.css bridge, src/lib/utils.ts, src/components/ui/{button,dialog,tooltip}.tsx,
   playground registration. It does NOT contain the scaffold, the spike spec, the jsdom probe or
   screenshots. Re-run `npx shadcn@1.1.23 add <name> -y` only for new primitives.
```

§9 answers each of the four questions in one sentence citing the doc section. Then write the
patch (code only; the exclusions keep the scaffold, spec, probe and docs out) and commit.
**Do NOT**: write the verdict by judgement; leave any §-section empty (write `none`); include
`docs/planning` or the scaffold in the patch; `--amend`.
**Commands**:

```bash
git diff origin/main..spike/shadcn-compat -- . \
  ':(exclude)docs/planning' ':(exclude)src/App.tsx' ':(exclude)src/components/SpikeScaffold.tsx' \
  ':(exclude)tests/spike-portals.spec.ts' ':(exclude)src/components/ui/spike-jsdom.test.tsx' \
  > docs/planning/shadcn-spike.patch
grep -c '^diff --git' docs/planning/shadcn-spike.patch
grep -n "^Verdict: \(GO\|GO-WITH-CAVEATS\|NO-GO\)$" docs/planning/shadcn-adoption-decision.md
git add -A && git commit -m "plan-002 step-9: verdict, required changes, spike patch"
```

**Expected**: a count ≥ 12 (package.json, package-lock.json, tsconfig.json, vite.config.ts,
vitest.config.ts, .eslintrc.cjs, components.json, src/index.css, src/lib/utils.ts, three ui
files, types.ts, playground-registry.tsx); exactly one matching `Verdict:` line (line 3).
**Check**: the `Verdict:` grep prints exactly one line and `git status --porcelain` is empty
after the commit.
**If it fails**: a `Verdict:` line that does not match the pattern is a typo; fix once. If two
rows contradict (e.g. A3 true but §6 shows `8 passed`), the doc is inconsistent: STOP.
**Commit**: `plan-002 step-9: verdict, required changes, spike patch`

### Step 10: Land the decision on `plan/002-shadcn-decision`, write the report, delete the spike

**Files**: `docs/planning/shadcn-adoption-decision.md`, `docs/planning/shadcn-spike.patch`,
`docs/planning/screenshots/002-final/spike-dialog-light.png`,
`docs/planning/screenshots/002-final/spike-dialog-dark.png`, `plans/reports/002.md` (new),
`plans/README.md`
**Do**: Move only the docs artefacts to the docs branch, prove the patch applies to
`origin/main`, write the report (`plans/reports/002.md`, CONVENTIONS §11; the **Numbers**
section is §2 and §8 of the decision doc; **Screenshots** lists the two PNGs with "open spike
dialog in light/dark for Kyle to compare with the surrounding UI"), then push and open the PR
(`Plan 002: Prove shadcn/ui works on this stack before committing to it`, body = the report).
No `CHANGELOG.md` entry: nothing user-visible changes. After the PR is merged, set this plan's
row in `plans/README.md` to `DONE <merge sha>` and write the merge SHA into the `Grounded at`
line of `plans/003-build-primitive-layer.md`. Delete the spike branch only after the commit
below exists.
**Do NOT**: open a PR from `spike/shadcn-compat`; push `spike/shadcn-compat`; copy any file
outside `docs/planning`; delete the spike branch before the docs commit; squash.
**Commands**:

```bash
git status --porcelain                                   # on spike/shadcn-compat
git fetch origin main && git checkout -b plan/002-shadcn-decision origin/main
git status --porcelain
git checkout spike/shadcn-compat -- docs/planning/shadcn-adoption-decision.md \
  docs/planning/shadcn-spike.patch docs/planning/screenshots/002-final
git apply --check docs/planning/shadcn-spike.patch
git add docs/planning && git commit -m "plan-002 step-10: land the shadcn decision, patch and screenshots"
# write plans/reports/002.md; set plans/README.md row 002 to IN PROGRESS → (after merge) DONE
git add plans/reports/002.md plans/README.md && git commit -m "plan-002 step-10: report"
npm run verify
git push -u origin plan/002-shadcn-decision
git branch -D spike/shadcn-compat
```

**Expected**: empty; `Switched to a new branch 'plan/002-shadcn-decision'`; **empty** (if not,
spike files leaked: STOP); three paths restored; exit 0; commit; commit; exit 0; push output;
`Deleted branch spike/shadcn-compat`.
**Check**: `git ls-files docs/planning/shadcn-adoption-decision.md docs/planning/shadcn-spike.patch docs/planning/screenshots/002-final | wc -l`
prints `4` on `plan/002-shadcn-decision`, and `git branch --list spike/shadcn-compat` prints
nothing.
**If it fails**: `git apply --check` non-zero means the patch was cut against the wrong base:
`git checkout spike/shadcn-compat`, re-run Step 9's diff command against a fresh
`git fetch origin main`, recommit, and retry once; twice is a STOP.
**Commit**: `plan-002 step-10: land the shadcn decision, patch and screenshots`

## Validation

- Every rubric row in Step 9 is a value in the decision doc produced by a command in Steps 1–8;
  a verdict with an `UNANSWERED` row is only allowed via the Step budget STOP.
- `docs/planning/shadcn-spike.patch` applies to `origin/main` (`git apply --check`, Step 10).
- `npm run test:a11y` passed on the spike branch with the bridge in place (Step 5).
- The docs-only PR review is Kyle's sign-off; he annotates the decision doc in the PR.

## Done criteria

- [ ] `docs/planning/shadcn-adoption-decision.md` line 3 is `Verdict: GO|GO-WITH-CAVEATS|NO-GO`
- [ ] §9 answers all four questions; §10 lists every true B row as a numbered required change
- [ ] `Extrapolated 12-primitive delta: <bytes>` line present (§8)
- [ ] §12 install sequence present; `docs/planning/shadcn-spike.patch` applies to `origin/main`
- [ ] §6 holds the verbatim output of `tests/spike-portals.spec.ts`
- [ ] Two screenshots under `docs/planning/screenshots/002-final/`
- [ ] `spike/shadcn-compat` deleted; nothing but `docs/planning/**` and `plans/**` in the PR
- [ ] `plans/reports/002.md` written; `plans/README.md` row updated

## STOP conditions

- The CLI cannot install on React 18.3.1 even with `--legacy-peer-deps` (Step 3). Do not upgrade
  React; write the doc with `Verdict: NO-GO` (row A1) before stopping.
- A correctly transcribed bridge fails `npm run test:a11y` (Step 5). Do not weaken the test or
  hardcode a colour; write the doc with `Verdict: NO-GO` (row A2) before stopping.
- `git status --porcelain` is non-empty right after `git checkout -b plan/002-shadcn-decision`
  (Step 10): spike files leaked; do not commit them.

Whenever a STOP fires, the decision doc must exist with the verdict reached so far — plan 003's
first instruction is to stop when the file is absent.

## Handoff / after it lands

- Plan 003 reads `docs/planning/shadcn-adoption-decision.md` before its Step 1: it applies
  `docs/planning/shadcn-spike.patch`, runs `npm install`, then follows §10's numbered required
  changes and compares its bundle delta against the `Extrapolated 12-primitive delta` line.
- What a reviewer should scrutinise: the bridge (§5) and the portal spec output (§6).
  Everything downstream inherits both.
- Deliberately deferred: the full primitive roster (plan 003), the destructive-contrast fix
  (decision file raised by plan 003 if row B6 is true), the icon-library choice (row B5).
