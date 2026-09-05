# Plan 003: Build the shared UI primitive layer

> **Executor instructions**: Read `plans/CONVENTIONS.md` first. Run the pre-flight (§3), then the
> Drift check below. Follow the steps in order; each step's **Check** must hold before the next.
> If any **If it fails** or STOP condition fires, follow CONVENTIONS §10. Finish with the report
> in §11.

**Drift check** (run after pre-flight; `<grounded-at>` is the SHA in the Status block):

```bash
git fetch origin main
G=$(grep -oE 'Grounded at\*\*: `[0-9a-f]{7,40}' plans/003-build-primitive-layer.md | grep -oE '[0-9a-f]{7,40}$')
git diff --stat "$G"..origin/main -- src/index.css src/styles/ src/components/DesignSystemPlayground/ src/components/ui/ src/test/setup.ts .eslintrc.cjs tsconfig.json vite.config.ts vitest.config.ts package.json tests/   # Expected: empty
```

**Citation re-check** (each command must print exactly the expected number; line numbers in this
plan are hints, the greps are authoritative):

| Anchor (grep)                                                                                             | File                                                      | Expected hits |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------- |
| `grep -c '^@theme' src/index.css`                                                                         | `src/index.css`                                           | 2             |
| `grep -c '^@custom-variant dark' src/index.css`                                                           | `src/index.css`                                           | 1             |
| `grep -c 'overrides: \[' .eslintrc.cjs`                                                                   | `.eslintrc.cjs`                                           | 1             |
| `grep -c '^export const categories' src/components/DesignSystemPlayground/playground-registry.tsx`        | `playground-registry.tsx`                                 | 1             |
| `grep -c "from './playground-registry'" src/components/DesignSystemPlayground/DesignSystemPlayground.tsx` | `DesignSystemPlayground.tsx`                              | 1             |
| `grep -c 'data-esc-owns' src/components/SessionConsole/useSessionConsoleHotkeys.ts`                       | `useSessionConsoleHotkeys.ts`                             | 1             |
| `grep -c '^\.btn-tool\.is-paused' src/styles/app.css`                                                     | `src/styles/app.css` (added by plan 001)                  | 1             |
| `grep -c -- '--app-success-solid-text' src/styles/theme.css`                                              | `src/styles/theme.css` (added by plan 001, one per theme) | 2             |
| `grep -c 'Extrapolated 12-primitive delta' docs/planning/shadcn-adoption-decision.md`                     | decision doc (plan 002)                                   | 1             |
| `grep -c '^export async function gotoSurface' tests/helpers/surfaces.ts`                                  | `tests/helpers/surfaces.ts` (plan 000)                    | 1             |
| `grep -c 'Mock matchMedia' src/test/setup.ts`                                                             | `src/test/setup.ts`                                       | 1             |
| `ls src/components/ui 2>/dev/null \| wc -l`                                                               | `src/components/ui/` must not exist yet                   | 0             |

If any row differs: STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/000-repair-verification-infrastructure.md,
  plans/001-stabilize-styling-foundation.md, plans/002-shadcn-compatibility-spike.md
- **Category**: migration
- **Requires**: `docs/planning/shadcn-adoption-decision.md`, `docs/planning/shadcn-spike.patch`,
  `docs/planning/verification-baseline.md`, `scripts/preflight.sh`, `tests/helpers/surfaces.ts`
- **Grounded at**: ‹merge SHA of plan 002, written there by its final step› (citations verified
  at d3d3642)

## Why this matters

Graphium has no shared component layer. Eleven components hand-roll a modal overlay
(`grep -rl 'aria-modal' src/components --include=*.tsx | grep -v test | wc -l` prints `11` at
d3d3642; ten after plan 000 deletes `PreferencesDialog.tsx`), and three more overlays
(`MapSettingsSheet`, `AddToLibraryDialog`, `ImageCropper`) have no `role="dialog"` at all.
`AboutModal.tsx` carries a hand-written Tab trap (`grep -n 'handleTabKey' src/components/AboutModal.tsx`,
line 282 at d3d3642); the others do not. Adding a dialog to Graphium therefore costs a rebuild of
modal behaviour, and the rebuild is usually incomplete. This plan adds Radix-based primitives
under `src/components/ui/`, themed through the `@theme inline` bridge plan 002 proved, each with
a playground example and automated tests. It migrates **no** existing screen; that is plan 004.

## Context the executor needs

- **`src/styles/theme.css`** owns colour. Primitives never define colours; they use the bridge
  tokens (`bg-primary`, `text-foreground`, `border-input`, …) or, where the bridge has no token,
  `[var(--app-*)]` arbitrary values. Never a raw Tailwind palette class.
- **Bridge tokens** (19, defined by plan 002 in the second `@theme inline` block of
  `src/index.css`; `grep -n -- '--color-' src/index.css` lists them): `background`→`--app-bg-base`,
  `foreground`→`--app-text-primary`, `card`/`popover`→`--app-bg-surface`,
  `card-foreground`/`popover-foreground`/`secondary-foreground`/`accent-foreground`→`--app-text-primary`,
  `primary`→`--app-accent-solid`, `primary-foreground`/`destructive-foreground`→`--app-accent-solid-text`,
  `secondary`→`--app-bg-active`, `muted`→`--app-bg-subtle`, `muted-foreground`→`--app-text-secondary`,
  `accent`→`--app-bg-hover`, `destructive`→`--app-error-solid`, `border`→`--app-border-subtle`,
  `input`→`--app-border-default`, `ring`→`--app-accent-solid`.
- **`--radius` is not bridged.** Plan 000 aliased Tailwind's `--radius-*` to `--app-radius-*`
  (`grep -n 'radius' src/index.css` shows the alias lines); the bridge block must not define
  `--radius`. shadcn's `rounded-md` etc. already resolve.
- **`@custom-variant dark`** in `src/index.css` keys `dark:` utilities off `[data-theme='dark']`,
  not `prefers-color-scheme`. Step 8's portal spec proves it.
- **Playground** (`/design-system`, `src/App.tsx`, `grep -n "isDesignSystemPlayground" src/App.tsx`,
  lines 123 and 441 at d3d3642) renders `categories` × `componentExamples` from
  `playground-registry.tsx`. An example whose `category` is not in the `categories` array is
  **never rendered** (`grep -n 'categories.map' src/components/DesignSystemPlayground/DesignSystemPlayground.tsx`
  finds the loop, line 270). Every registration edits both `types.ts` and the `categories`
  array; the contract test in Step 5 enforces it.
- **`data-esc-owns`**: `useSessionConsoleHotkeys.ts` defers the global Escape while
  `[data-esc-owns="true"]` is in the DOM. Every overlay primitive renders it by default (Step 5,
  Step 7).
- **Button class mapping** plan 004 relies on (record it in `src/components/ui/README.md`):
  `.btn-primary`→`variant="default"`, `.btn-default`→`"secondary"`,
  `.btn-secondary`/`.btn-ghost`/`.btn-destructive` (undefined in `app.css`, render as bare `.btn`)
  →`"ghost"`, `.btn-tool`→`"tool"`, `.btn-mode`→`"mode"`, `.btn-broadcast`→`"broadcast"`;
  `.active`→`active`; `.is-paused`/`.is-running`→`state`.
- **Existing adapters stay**: `Tooltip.tsx`, `Toast.tsx`, `ConfirmDialog.tsx`,
  `ToggleSwitch.tsx`, `CollapsibleSection.tsx` are not touched or deleted here.
- Icons: the repo uses `@remixicon/react`; shadcn generates `lucide-react` imports. Both are
  allowed inside `src/components/ui/`.

### The primitive roster (all required except `scroll-area`)

| Tranche | Primitives                                                       | Why                                                                                                                                                                                                                                                                 |
| ------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A       | `button`, `dialog`, `tooltip`, `input`, `label`                  | `.btn*` classes; eleven hand-rolled overlays; `Tooltip.tsx`; inline field styles                                                                                                                                                                                    |
| B       | `switch`, `select`, `slider`, `tabs`, `collapsible`, `separator` | `ToggleSwitch.tsx`; `<select` in `MapSettingsSheet.tsx` (`grep -n '<select' src/components/MapSettingsSheet.tsx`, line 361); `.tab-button` in `AboutModal.tsx` (`grep -n 'tab-button' src/components/AboutModal.tsx`); `CollapsibleSection.tsx`; `.toolbar-divider` |
| C       | `sheet`, `popover`, `dropdown-menu`                              | `MapSettingsSheet`/`SessionConsoleEditorSheet` are side panels; token quick-actions; context menus                                                                                                                                                                  |

**Deferred**: `scroll-area` (recorded in `ui/README.md`, Step 9). **Not primitives here**: toast
(keep `Toast.tsx`, do not add `sonner`; CONVENTIONS §9) and `command` (out of scope for the
program; CONVENTIONS §9).

## Inputs & resources

Gates: `plans/CONVENTIONS.md` §4.

The packages the pinned CLI installs for the primitives a step names (`radix-ui` or
`@radix-ui/react-*`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`,
`tw-animate-css`) count as named by this plan for CONVENTIONS §2's dependency rule.

| Purpose                 | Command                                                                             | Expected                               |
| ----------------------- | ----------------------------------------------------------------------------------- | -------------------------------------- |
| Generate a primitive    | `npx shadcn@4.21.0 add <name> -y` (version pinned by plan 002)                      | exit 0, `src/components/ui/<name>.tsx` |
| Run one vitest file     | `npx vitest run src/components/ui/<file>`                                           | exit 0                                 |
| Run one Playwright spec | `npm run build:web && CI=1 npx playwright test tests/<file> --project=Web-Chromium` | exit 0                                 |
| Screenshot set          | `SHOTS_OUT=docs/planning/screenshots/003-final npm run shots`                       | exit 0                                 |

## Scope

**In scope**: `.eslintrc.cjs` (one override, Step 1); `components.json`, `src/lib/utils.ts`,
`tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `package.json`, `package-lock.json`
(from the spike patch); `src/index.css` (only if the decision doc's required changes say so);
`src/components/ui/**`; `src/components/DesignSystemPlayground/{types.ts,playground-registry.tsx,registry/**,registry.test.ts}`;
`src/test/setup.ts`; `tests/theme-bridge.spec.ts`, `tests/functional/primitives-portals.spec.ts`;
`docs/guides/UI_RECIPES.md`, `docs/guides/CONVENTIONS.md`, `docs/architecture/DECISIONS.md`,
`docs/architecture/ARCHITECTURE.md`, `.github/copilot-instructions.md`, `.cursorrules`;
`docs/planning/screenshots/003-final/`; `plans/reports/003.md`, `plans/README.md`,
`plans/004-migrate-screens-to-primitives.md`, `plans/006-visual-redesign.md` (Grounded-at lines).

**Out of scope**: any existing feature component (`src/components/*.tsx` other than the
playground); deleting the five adapters; `src/styles/app.css` and `src/styles/theme.css` (plan
001 already added every token this plan needs); `src/components/Canvas/**`; performance work;
visual redesign. Primitives must look like Graphium looks today.

Branch, commits, PR, CI and rollback: `plans/CONVENTIONS.md` §7. Branch name:
`plan/003-primitive-layer`.

## Steps

### Step 1: Add the scoped ESLint override for `src/components/ui/**`

**Files**: `.eslintrc.cjs`
**Do**: In the `overrides` array (`grep -n 'overrides: \[' .eslintrc.cjs`, line 399 at d3d3642),
insert the following object as the **last** element, immediately before the array's closing
`],` (`grep -n "files: \['docs/\*\*/\*'\]" .eslintrc.cjs` finds the current last element; add
after its closing `},`):

```js
    // Plan 003: shadcn-generated primitives. They have no consumers until plan 004 (unused
    // exports), export non-component helpers (buttonVariants), and omit return types.
    {
      files: ['src/components/ui/**/*.tsx', 'src/lib/utils.ts'],
      excludedFiles: ['src/components/ui/**/*.test.tsx'],
      rules: {
        'import/no-unused-modules': 'off',
        'prettier/prettier': 'off',
        'react-refresh/only-export-components': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '../*',
                  '../../*',
                  '@/store/*',
                  '@/utils/*',
                  '@/components/*',
                  '@/services/*',
                  '@components/*',
                  '@store/*',
                  '@utils/*',
                ],
                message:
                  'Primitives import only react, @radix-ui/*, class-variance-authority, lucide-react, @remixicon/react, ./siblings and @/lib/utils.',
              },
            ],
          },
        ],
      },
    },
```

**Do NOT**: relax any other rule; widen `files` beyond `src/components/ui/**/*.tsx`; edit the
test-file override above it; create `src/components/ui/` yet.
**Commands**: `npm run verify:static`
**Expected**: exit 0.
**Check**: `grep -c "files: \['src/components/ui/\*\*/\*.tsx'\]" .eslintrc.cjs` prints `1` and
`grep -c "no-restricted-imports" .eslintrc.cjs` prints `1`.
**If it fails**: if ESLint reports a config schema error, re-check the pasted block for a missing
comma and retry once; otherwise STOP with the ESLint output.
**Commit**: `plan-003 step-1: scoped ESLint override for src/components/ui`

### Step 2: Apply the spike patch and the decision doc's required changes

**Files**: `components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx`,
`src/components/ui/dialog.tsx`, `src/components/ui/tooltip.tsx`, `tsconfig.json`,
`vite.config.ts`, `vitest.config.ts`, `package.json`, `package-lock.json`, `src/index.css`
**Do**:

1. Read the `Verdict` line of `docs/planning/shadcn-adoption-decision.md`
   (`grep -n '^Verdict' docs/planning/shadcn-adoption-decision.md`).
   - `GO` → continue at 2.
   - `GO-WITH-CAVEATS` → continue at 2; item 3 applies the numbered required changes.
   - `NO-GO` → STOP: "plan 003 assumes the shadcn CLI path; decision doc says NO-GO".
2. Apply the spike. The bridge is already in `src/index.css`; the spike's own ESLint override
   is superseded by Step 1; its scaffold, `App.tsx` edit and throwaway alias test never merge.
   All five are excluded:
   ```bash
   git fetch --unshallow origin main 2>/dev/null || true
   git apply --3way --exclude=src/index.css --exclude=.eslintrc.cjs --exclude=src/App.tsx \
     --exclude='src/components/SpikeScaffold.tsx' --exclude='src/spike-alias.test.ts' \
     docs/planning/shadcn-spike.patch
   npm install
   ```
3. Apply, in order, every entry of the decision doc's numbered "required changes" list
   (`grep -n 'required change' -i docs/planning/shadcn-adoption-decision.md`). Each entry is a
   checklist line: do it, then run its stated verification. If the list is empty, skip.
4. `npm run format` (shadcn emits double quotes; `.prettierrc` sets `singleQuote`).
5. If `src/index.css` contains any `oklch(` or `.dark {` left by the CLI, that is drift from
   plan 002: STOP.

**Do NOT**: run `npx shadcn init` (the patch already carries `components.json`); add any
primitive beyond the three in the patch; edit `src/index.css` unless item 3 says so; touch
`.eslintrc.cjs` again; add `sonner`.
**Commands**: `npm run verify:static && npm run verify:web`
**Expected**: both exit 0.
**Check**: `ls components.json src/lib/utils.ts src/components/ui/button.tsx src/components/ui/dialog.tsx src/components/ui/tooltip.tsx | wc -l`
prints `5`; `grep -c 'export function cn' src/lib/utils.ts` prints `1`;
`grep -c '^@theme' src/index.css` prints `2`; `grep -c 'oklch(' src/index.css` prints `0`.
**If it fails**: if `git apply` reports a conflict, STOP with the conflict hunk (the spike patch
has drifted from `main`). If lint fails inside `src/components/ui/` on a rule other than the four
in Step 1, STOP with the rule name. Otherwise fix once and retry.
**Commit**: `plan-003 step-2: apply shadcn spike patch and decision-doc changes`

### Step 3: Split the playground registry

**Files**: `src/components/DesignSystemPlayground/playground-registry.tsx`,
`src/components/DesignSystemPlayground/types.ts`,
`src/components/DesignSystemPlayground/registry/index.ts`,
`src/components/DesignSystemPlayground/registry/legacy.tsx`,
`src/components/DesignSystemPlayground/registry/buttons.tsx`,
`src/components/DesignSystemPlayground/registry/overlays.tsx`,
`src/components/DesignSystemPlayground/registry/forms.tsx`,
`src/components/DesignSystemPlayground/registry/layout.tsx`
**Do**:

1. `mkdir -p src/components/DesignSystemPlayground/registry && git mv src/components/DesignSystemPlayground/playground-registry.tsx src/components/DesignSystemPlayground/registry/legacy.tsx`.
2. In `registry/legacy.tsx`: fix the relative imports
   (`../../store/gameStore` → `../../../store/gameStore`,
   `../ToggleSwitch` → `../../ToggleSwitch`, `../UpdateManager` → `../../UpdateManager`,
   `./types` → `../types`); delete the `RiTreeLine,` import line and the two lines
   `// @ts-expect-error - RiTreeLine is used in code example strings` / `const _unused = RiTreeLine;`
   (the icon is only named inside a code string); rename the two exports:
   `export const categories` → `export const legacyCategories`,
   `export const componentExamples` → `export const legacyExamples`. Change nothing else.
3. Create the four tranche files with this exact content (each will be filled in later steps):

   ```ts
   import type { ComponentExample } from '../types';

   export const buttonExamples: ComponentExample[] = [];
   ```

   (`overlays.tsx` exports `overlayExamples`, `forms.tsx` exports `formExamples`, `layout.tsx`
   exports `layoutExamples`.)

4. Create `registry/index.ts`:

   ```ts
   import type { ComponentCategory, ComponentExample } from '../types';
   import { buttonExamples } from './buttons';
   import { formExamples } from './forms';
   import { layoutExamples } from './layout';
   import { legacyCategories, legacyExamples } from './legacy';
   import { overlayExamples } from './overlays';

   /** New categories for src/components/ui primitives. Legacy categories stay first. */
   export const categories: ComponentCategory[] = [
     ...legacyCategories,
     {
       id: 'overlay',
       name: 'Overlays (ui)',
       description: 'Dialog, sheet, popover, dropdown menu, tooltip',
     },
     {
       id: 'form',
       name: 'Form controls (ui)',
       description: 'Input, label, switch, select, slider',
     },
     {
       id: 'layout',
       name: 'Layout (ui)',
       description: 'Tabs, collapsible, separator, theme bridge probe',
     },
   ];

   export const componentExamples: ComponentExample[] = [
     ...legacyExamples,
     ...buttonExamples,
     ...overlayExamples,
     ...formExamples,
     ...layoutExamples,
   ];
   ```

5. Create the new `playground-registry.tsx` with exactly one line:
   `export { categories, componentExamples } from './registry';`
6. In `types.ts`, extend the `category` union with `| 'overlay' | 'form' | 'layout'` after
   `| 'performance'`.

**Do NOT**: rewrite, reorder or delete any legacy example; rename any legacy `id`; edit
`DesignSystemPlayground.tsx` or its test; register a primitive yet.
**Commands**: `npm run verify:static && npm run verify:web`
**Expected**: both exit 0.
**Check**: `grep -o "category: '[a-z-]*'" src/components/DesignSystemPlayground/registry/legacy.tsx | wc -l`
prints `37` (same command on the old file at d3d3642 prints `37`), and
`wc -l < src/components/DesignSystemPlayground/playground-registry.tsx` prints `1`.
**If it fails**: if `DesignSystemPlayground.test.tsx` fails, an export name or import path in
item 2 or 5 is wrong; fix once and retry. Otherwise STOP.
**Commit**: `plan-003 step-3: split playground registry into registry/*`

### Step 4: Give `button` Graphium's variants and register it

**Files**: `src/components/ui/button.tsx`, `src/components/DesignSystemPlayground/registry/buttons.tsx`
**Do**:

1. Overwrite `src/components/ui/button.tsx` with the file below. Values come from
   `src/styles/app.css` (`grep -n '^\.btn' src/styles/app.css`, lines 25–118 at d3d3642):
   `.btn` = `padding: 0.25rem 0.75rem; border-radius: 0.25rem; font-size: 0.875rem; font-weight: 500`;
   `.btn-mode`/`.btn-broadcast` = `padding: 0.125rem 0.5rem; font-size: 0.75rem`; `.btn-tool`
   sets **no** padding (inherits `.btn`). Colours are plan 001's semantic tokens via the bridge:
   toolbar button bg `--app-bg-active`→`bg-secondary`, fg
   `--app-text-primary`→`text-secondary-foreground`, border `--app-border-default`→`border-input`, hover bg `--app-bg-hover`→`hover:bg-accent`,
   hover border `--app-border-hover` (no bridge token → arbitrary value), active
   `--app-accent-solid`→`bg-primary`, broadcast-active `--app-success-solid` +
   `--app-success-solid-text`, paused `--app-error-solid`→`bg-destructive` + `--app-error-solid-text`.

   ```tsx
   import { Slot } from '@radix-ui/react-slot';
   import { cva, type VariantProps } from 'class-variance-authority';
   import * as React from 'react';

   import { cn } from '@/lib/utils';

   const buttonVariants = cva(
     "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
     {
       variants: {
         variant: {
           /** .btn-primary */
           default: 'bg-primary text-primary-foreground hover:bg-[var(--app-accent-solid-hover)]',
           /** .btn-default */
           secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
           /** bare .btn (also .btn-secondary / .btn-ghost / .btn-destructive, undefined in app.css) */
           ghost: 'bg-transparent text-foreground hover:bg-accent',
           destructive:
             'bg-destructive text-[var(--app-error-solid-text)] hover:bg-[var(--app-error-solid-hover)]',
           outline: 'border border-input bg-background text-foreground hover:bg-accent',
           link: 'text-[var(--app-accent-text)] underline-offset-4 hover:underline',
           /** .btn-tool */
           tool: 'border border-input bg-secondary text-secondary-foreground hover:bg-accent hover:border-[var(--app-border-hover)]',
           /** .btn-mode */
           mode: 'bg-secondary text-secondary-foreground hover:bg-accent',
           /** .btn-broadcast */
           broadcast: 'bg-secondary text-secondary-foreground hover:bg-accent',
         },
         size: {
           default: 'h-9 px-4 py-2',
           sm: 'h-8 gap-1.5 px-3 text-xs',
           lg: 'h-10 px-6',
           icon: 'size-9',
           /** .btn padding/font; pair with variant="tool" */
           tool: 'px-3 py-1 text-sm',
           /** .btn-mode / .btn-broadcast padding/font; pair with variant="mode" | "broadcast" */
           mode: 'px-2 py-0.5 text-xs',
         },
         /** .active on .btn-tool / .btn-mode / .btn-broadcast (colours set in compoundVariants) */
         active: {
           true: '',
           false: '',
         },
         /** .is-paused / .is-running on .btn-tool (plan 001) */
         state: {
           none: '',
           paused: '',
           running: '',
         },
       },
       compoundVariants: [
         {
           variant: ['tool', 'mode'],
           active: true,
           class:
             'bg-primary text-primary-foreground border-primary hover:bg-[var(--app-accent-solid-hover)] hover:border-[var(--app-accent-solid-hover)]',
         },
         {
           variant: 'broadcast',
           active: true,
           class:
             'bg-[var(--app-success-solid)] text-[var(--app-success-solid-text)] hover:bg-[var(--app-success-solid-hover)]',
         },
         {
           variant: 'tool',
           state: 'paused',
           class:
             'bg-destructive text-[var(--app-error-solid-text)] border-destructive hover:bg-[var(--app-error-solid-hover)] hover:border-[var(--app-error-solid-hover)]',
         },
         {
           variant: 'tool',
           state: 'running',
           class:
             'bg-[var(--app-success-solid)] text-[var(--app-success-solid-text)] border-[var(--app-success-solid)] hover:bg-[var(--app-success-solid-hover)] hover:border-[var(--app-success-solid-hover)]',
         },
       ],
       defaultVariants: {
         variant: 'default',
         size: 'default',
         active: false,
         state: 'none',
       },
     },
   );

   type ButtonProps = React.ComponentProps<'button'> &
     VariantProps<typeof buttonVariants> & {
       asChild?: boolean;
     };

   function Button({
     className,
     variant,
     size,
     active,
     state,
     asChild = false,
     ...props
   }: ButtonProps): JSX.Element {
     const Comp = asChild ? Slot : 'button';
     return (
       <Comp
         data-slot="button"
         data-active={active === true ? 'true' : undefined}
         className={cn(buttonVariants({ variant, size, active, state, className }))}
         {...props}
       />
     );
   }

   export { Button, buttonVariants };
   export type { ButtonProps };
   ```

   If `npm run type-check` cannot resolve `@radix-ui/react-slot`, use the `Slot` import line the
   spike generated (`git show HEAD:src/components/ui/button.tsx | grep -n Slot`) and nothing else
   from it.

2. Replace `registry/buttons.tsx` with:

   ```tsx
   import { Button } from '@/components/ui/button';

   import type { ComponentExample } from '../types';

   function ToolbarButtonsExample(): JSX.Element {
     return (
       <div className="flex flex-wrap items-center gap-2">
         <Button variant="tool" size="tool">
           Tool
         </Button>
         <Button variant="tool" size="tool" active>
           Tool active
         </Button>
         <Button variant="tool" size="tool" state="paused">
           Paused
         </Button>
         <Button variant="tool" size="tool" state="running">
           Running
         </Button>
         <Button variant="mode" size="mode">
           Mode
         </Button>
         <Button variant="mode" size="mode" active>
           Mode active
         </Button>
         <Button variant="broadcast" size="mode">
           Broadcast
         </Button>
         <Button variant="broadcast" size="mode" active>
           Broadcasting
         </Button>
       </div>
     );
   }

   export const buttonExamples: ComponentExample[] = [
     {
       id: 'ui-button',
       name: 'Button (ui)',
       category: 'button',
       description:
         'shadcn Button: default (.btn-primary), secondary (.btn-default), ghost (.btn), destructive, outline, link',
       component: (
         <div className="flex flex-wrap items-center gap-2">
           <Button>Default</Button>
           <Button variant="secondary">Secondary</Button>
           <Button variant="ghost">Ghost</Button>
           <Button variant="destructive">Destructive</Button>
           <Button variant="outline">Outline</Button>
           <Button variant="link">Link</Button>
           <Button disabled>Disabled</Button>
         </div>
       ),
       code: `import { Button } from '@/components/ui/button';
   
   <Button>Default</Button>
   <Button variant="secondary">Secondary</Button>`,
     },
     {
       id: 'ui-button-toolbar',
       name: 'Button toolbar variants (ui)',
       category: 'button',
       description:
         'tool / mode / broadcast variants with active and state, matching .btn-tool, .btn-mode, .btn-broadcast',
       component: <ToolbarButtonsExample />,
       code: `<Button variant="tool" size="tool" active>Tool</Button>
   <Button variant="tool" size="tool" state="paused">Paused</Button>
   <Button variant="broadcast" size="mode" active>Broadcasting</Button>`,
     },
   ];
   ```

**Do NOT**: change `src/styles/app.css`; add tokens to `theme.css`; use `bg-neutral-*` or any
palette class; touch `dialog.tsx`/`tooltip.tsx` (Step 5); migrate `App.tsx`'s toolbar.
**Commands**: `npm run verify:static && npm run verify:web`
**Expected**: both exit 0.
**Check**: `grep -cE "^\s+(tool|mode|broadcast|paused|running): " src/components/ui/button.tsx`
prints `7` (three variants, two sizes, two states) and
`grep -c "id: 'ui-button" src/components/DesignSystemPlayground/registry/buttons.tsx` prints `2`.
**If it fails**: a type error naming `VariantProps` or `active` means the CVA version in
`package.json` is below 0.7; STOP with `npm ls class-variance-authority` output. Otherwise fix
once and retry.
**Commit**: `plan-003 step-4: button variants tool/mode/broadcast/active/state`

### Step 5: Tranche A — dialog `ownsEscape`, tooltip, input, label; contract test; jsdom mocks

**Files**: `src/components/ui/dialog.tsx`, `src/components/ui/input.tsx`,
`src/components/ui/label.tsx`, `src/components/ui/tooltip.tsx`, `package.json`,
`package-lock.json`, `src/components/DesignSystemPlayground/registry/overlays.tsx`,
`src/components/DesignSystemPlayground/registry/forms.tsx`,
`src/components/DesignSystemPlayground/registry.test.ts`, `src/test/setup.ts`
**Do**:

1. `npx shadcn@4.21.0 add input label -y && npm run format`.
2. `ownsEscape` on `DialogContent`. In `dialog.tsx` find the component that renders
   `<DialogPrimitive.Content` (`grep -n 'DialogPrimitive.Content' src/components/ui/dialog.tsx`)
   and make these three edits — the result, in shadcn's current function form, is:

   ```tsx
   function DialogContent({
     className,
     children,
     showCloseButton = true,
     ownsEscape = true,
     ...props
   }: React.ComponentProps<typeof DialogPrimitive.Content> & {
     showCloseButton?: boolean;
     /** Renders data-esc-owns="true" so the global Escape does not stop Session Console audio. */
     ownsEscape?: boolean;
   }) {
     return (
       <DialogPortal data-slot="dialog-portal">
         <DialogOverlay />
         <DialogPrimitive.Content
           data-slot="dialog-content"
           data-esc-owns={ownsEscape ? 'true' : undefined}
   ```

   (a) add `ownsEscape?: boolean` to the props type, (b) destructure `ownsEscape = true`,
   (c) add `data-esc-owns={ownsEscape ? 'true' : undefined}` on `DialogPrimitive.Content`,
   (e) add `aria-modal="true"` next to `data-esc-owns` on the same element (Radix sets
   `role="dialog"` but not `aria-modal`; plan 004's overlay spec asserts it),
   (d) in `DialogOverlay`, replace the generated `bg-black/50` with
   `bg-[var(--app-overlay)]` (`--app-overlay` is `var(--slate-a11)` in both themes:
   `grep -n -- '--app-overlay' src/styles/theme.css`); the purity test in Step 8 rejects
   `bg-black`. Keep every other generated line. If the generated file uses `React.forwardRef` instead, make the
   same three edits inside it. `data-testid` already passes through `...props`
   (plan 004 passes `dialog-<x>-root`).

3. Append to `src/test/setup.ts`, directly after the `// Mock matchMedia` block
   (`grep -n 'Mock matchMedia' src/test/setup.ts`):

   ```ts
   // Radix primitives in jsdom (plan 003): ResizeObserver, pointer capture, scrollIntoView
   if (typeof window.ResizeObserver === 'undefined') {
     window.ResizeObserver = vi.fn(() => ({
       observe: vi.fn(),
       unobserve: vi.fn(),
       disconnect: vi.fn(),
     })) as unknown as typeof ResizeObserver;
   }
   Element.prototype.hasPointerCapture = vi.fn(() => false);
   Element.prototype.setPointerCapture = vi.fn();
   Element.prototype.releasePointerCapture = vi.fn();
   Element.prototype.scrollIntoView = vi.fn();
   ```

4. Replace `registry/overlays.tsx` with (sheet/popover/dropdown examples are appended in Step 7):

   ```tsx
   import { Button } from '@/components/ui/button';
   import {
     Dialog,
     DialogContent,
     DialogDescription,
     DialogFooter,
     DialogHeader,
     DialogTitle,
     DialogTrigger,
   } from '@/components/ui/dialog';
   import {
     Tooltip,
     TooltipContent,
     TooltipProvider,
     TooltipTrigger,
   } from '@/components/ui/tooltip';

   import type { ComponentExample } from '../types';

   function DialogExample(): JSX.Element {
     return (
       <Dialog>
         <DialogTrigger asChild>
           <Button variant="secondary" data-testid="playground-open-dialog">
             Open dialog
           </Button>
         </DialogTrigger>
         <DialogContent data-testid="playground-dialog-content">
           <DialogHeader>
             <DialogTitle>Dialog title</DialogTitle>
             <DialogDescription>Escape closes; focus returns to the trigger.</DialogDescription>
           </DialogHeader>
           <DialogFooter>
             <Button variant="ghost" data-testid="playground-dialog-cancel">
               Cancel
             </Button>
             <Button data-testid="playground-dialog-confirm">Confirm</Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     );
   }

   function TooltipExample(): JSX.Element {
     return (
       <TooltipProvider delayDuration={0}>
         <Tooltip>
           <TooltipTrigger asChild>
             <Button variant="secondary" data-testid="playground-open-tooltip">
               Hover or focus me
             </Button>
           </TooltipTrigger>
           <TooltipContent data-testid="playground-tooltip-content">Tooltip text</TooltipContent>
         </Tooltip>
       </TooltipProvider>
     );
   }

   export const overlayExamples: ComponentExample[] = [
     {
       id: 'ui-dialog',
       name: 'Dialog (ui)',
       category: 'overlay',
       description: 'Radix dialog: focus trap, Escape, focus restore, data-esc-owns',
       component: <DialogExample />,
       code: `<Dialog>
     <DialogTrigger asChild><Button>Open</Button></DialogTrigger>
     <DialogContent data-testid="dialog-example-root">
       <DialogHeader><DialogTitle>Title</DialogTitle></DialogHeader>
     </DialogContent>
   </Dialog>`,
     },
     {
       id: 'ui-tooltip',
       name: 'Tooltip (ui)',
       category: 'overlay',
       description: 'Radix tooltip: opens on hover and focus, flips at viewport edges',
       component: <TooltipExample />,
       code: `<TooltipProvider>
     <Tooltip>
       <TooltipTrigger asChild><Button>Trigger</Button></TooltipTrigger>
       <TooltipContent>Tooltip text</TooltipContent>
     </Tooltip>
   </TooltipProvider>`,
     },
   ];
   ```

5. Replace `registry/forms.tsx` with (switch/select/slider appended in Step 6):

   ```tsx
   import { Input } from '@/components/ui/input';
   import { Label } from '@/components/ui/label';

   import type { ComponentExample } from '../types';

   export const formExamples: ComponentExample[] = [
     {
       id: 'ui-input',
       name: 'Input + Label (ui)',
       category: 'form',
       description: 'Text input with an associated label',
       component: (
         <div className="grid w-64 gap-1.5">
           <Label htmlFor="ui-input-example">Campaign name</Label>
           <Input id="ui-input-example" placeholder="Untitled campaign" />
         </div>
       ),
       code: `<Label htmlFor="name">Campaign name</Label>
   <Input id="name" placeholder="Untitled campaign" />`,
     },
     {
       id: 'ui-label',
       name: 'Label (ui)',
       category: 'form',
       description: 'Radix label; disabled peer styling',
       component: <Label>Standalone label</Label>,
       code: `<Label htmlFor="field">Label</Label>`,
     },
   ];
   ```

6. Create `src/components/DesignSystemPlayground/registry.test.ts`:

   ```ts
   import { describe, expect, it } from 'vitest';

   import { categories, componentExamples } from './playground-registry';

   const uiFiles = Object.keys(import.meta.glob('/src/components/ui/*.tsx')).filter(
     (file) => !file.endsWith('.test.tsx'),
   );

   describe('playground registry contract', () => {
     it('every example category is in the categories array (otherwise it is never rendered)', () => {
       const known = new Set(categories.map((c) => c.id));
       const orphans = componentExamples.filter((e) => !known.has(e.category)).map((e) => e.id);
       expect(orphans).toEqual([]);
     });

     it('every example id is unique', () => {
       const ids = componentExamples.map((e) => e.id);
       expect(new Set(ids).size).toBe(ids.length);
     });

     it('every primitive in src/components/ui has a registry entry id "ui-<file>"', () => {
       expect(uiFiles.length).toBeGreaterThan(0);
       const ids = componentExamples.map((e) => e.id);
       const missing = uiFiles
         .map((file) => file.replace(/^.*\//, '').replace(/\.tsx$/, ''))
         .filter((base) => !ids.some((id) => id === `ui-${base}` || id.startsWith(`ui-${base}-`)));
       expect(missing).toEqual([]);
     });
   });
   ```

**Do NOT**: add `ownsEscape` to `DialogOverlay`; register the examples under legacy categories
(`modal`, `input`); edit `MobileSidebarDrawer`/`MobileBottomSheet` (they never claim Escape;
CONVENTIONS §9); touch `Tooltip.tsx`.
**Commands**: `npm run verify:static && npm run verify:web`
**Expected**: both exit 0.
**Check**: `npx vitest run src/components/DesignSystemPlayground/registry.test.ts` exits 0 and
`grep -c 'data-esc-owns={ownsEscape' src/components/ui/dialog.tsx` prints `1`.
**If it fails**: if the contract test lists a missing id, the `id` in the registry file does not
start with `ui-<basename>`; fix once and retry. If `shadcn add` exits non-zero, STOP with its
output.
**Commit**: `plan-003 step-5: tranche A primitives, registry contract test, jsdom mocks`

### Step 6: Tranche B — switch, select, slider, tabs, collapsible, separator

**Files**: `src/components/ui/switch.tsx`, `src/components/ui/select.tsx`,
`src/components/ui/slider.tsx` (plus the `thumbLabel` edit below), `src/components/ui/tabs.tsx`, `src/components/ui/collapsible.tsx`,
`src/components/ui/separator.tsx`, `package.json`, `package-lock.json`,
`src/components/DesignSystemPlayground/registry/forms.tsx`,
`src/components/DesignSystemPlayground/registry/layout.tsx`
**Do**:

1. `npx shadcn@4.21.0 add switch select slider tabs collapsible separator -y && npm run format`.
   Then, in `slider.tsx`: add `thumbLabel: string` to the props type (required), destructure it,
   and pass `aria-label={thumbLabel}` to every `<SliderPrimitive.Thumb`. The generated thumb has
   no accessible name, and axe's `aria-input-field-name` rule fails the `design-system` surface
   without it.
2. Overwrite `src/components/ui/separator.tsx` with the file below. `.toolbar-divider` sets only
   `background: var(--app-border-subtle)` (`grep -n 'toolbar-divider' -A2 src/styles/app.css`,
   line 20 at d3d3642) = `bg-border`; the call sites add `w-px mx-1` and, once, `h-6`
   (`grep -n 'toolbar-divider' src/App.tsx`, lines 581, 648, 683). The `toolbar` variant carries
   `w-px mx-1`; callers keep passing `h-6` via `className` where they do today.

   Keep the import lines the CLI generated (shadcn 4.x emits `import { Separator as
SeparatorPrimitive } from 'radix-ui'`); replace only the rest of the file with the block
   below, whose first two lines show the older `@radix-ui/react-separator` form for reference.

   ```tsx
   import * as SeparatorPrimitive from '@radix-ui/react-separator';
   import * as React from 'react';

   import { cn } from '@/lib/utils';

   type SeparatorProps = React.ComponentProps<typeof SeparatorPrimitive.Root> & {
     /** 'toolbar' reproduces `.toolbar-divider w-px mx-1` from App.tsx (vertical, no fixed height). */
     variant?: 'default' | 'toolbar';
   };

   function Separator({
     className,
     orientation = 'horizontal',
     decorative = true,
     variant = 'default',
     ...props
   }: SeparatorProps): JSX.Element {
     const isToolbar = variant === 'toolbar';
     return (
       <SeparatorPrimitive.Root
         data-slot="separator"
         decorative={decorative}
         orientation={isToolbar ? 'vertical' : orientation}
         className={cn(
           isToolbar
             ? 'mx-1 w-px shrink-0 bg-border'
             : 'shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
           className,
         )}
         {...props}
       />
     );
   }

   export { Separator };
   export type { SeparatorProps };
   ```

3. Append to the `formExamples` array in `registry/forms.tsx` (add the imports at the top of the
   file, alphabetical, keeping the blank line before `import type`):

   ```tsx
   import {
     Select,
     SelectContent,
     SelectItem,
     SelectTrigger,
     SelectValue,
   } from '@/components/ui/select';
   import { Slider } from '@/components/ui/slider';
   import { Switch } from '@/components/ui/switch';
   ```

   ```tsx
     {
       id: 'ui-switch',
       name: 'Switch (ui)',
       category: 'form',
       description: 'Radix switch (replaces ToggleSwitch.tsx in plan 004)',
       component: (
         <div className="flex items-center gap-2">
           <Switch id="ui-switch-example" defaultChecked />
           <Label htmlFor="ui-switch-example">Snap to grid</Label>
         </div>
       ),
       code: `<Switch id="snap" checked={value} onCheckedChange={setValue} />`,
     },
     {
       id: 'ui-select',
       name: 'Select (ui)',
       category: 'form',
       description: 'Radix select (replaces the native <select> in MapSettingsSheet in plan 004)',
       component: (
         <Select defaultValue="square">
           <SelectTrigger className="w-48" data-testid="playground-open-select">
             <SelectValue placeholder="Grid type" />
           </SelectTrigger>
           <SelectContent data-testid="playground-select-content">
             <SelectItem value="square">Square</SelectItem>
             <SelectItem value="hex">Hex</SelectItem>
             <SelectItem value="none">None</SelectItem>
           </SelectContent>
         </Select>
       ),
       code: `<Select value={v} onValueChange={setV}>
     <SelectTrigger><SelectValue /></SelectTrigger>
     <SelectContent><SelectItem value="square">Square</SelectItem></SelectContent>
   </Select>`,
     },
     {
       id: 'ui-slider',
       name: 'Slider (ui)',
       category: 'form',
       description: 'Radix slider for grid size, opacity, audio volume',
       component: <Slider defaultValue={[50]} max={100} step={1} className="w-64" thumbLabel="Opacity" />,
       code: `<Slider value={[opacity]} onValueChange={([v]) => setOpacity(v)} max={100} />`,
     },
   ```

4. Replace `registry/layout.tsx` with (the bridge probe is appended in Step 8):

   ```tsx
   import { Button } from '@/components/ui/button';
   import {
     Collapsible,
     CollapsibleContent,
     CollapsibleTrigger,
   } from '@/components/ui/collapsible';
   import { Separator } from '@/components/ui/separator';
   import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

   import type { ComponentExample } from '../types';

   export const layoutExamples: ComponentExample[] = [
     {
       id: 'ui-tabs',
       name: 'Tabs (ui)',
       category: 'layout',
       description: 'Radix tabs (replaces .tab-button in AboutModal in plan 004)',
       component: (
         <Tabs defaultValue="about" className="w-80">
           <TabsList>
             <TabsTrigger value="about">About</TabsTrigger>
             <TabsTrigger value="tutorial">Tutorial</TabsTrigger>
             <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
           </TabsList>
           <TabsContent value="about">About panel</TabsContent>
           <TabsContent value="tutorial">Tutorial panel</TabsContent>
           <TabsContent value="shortcuts">Shortcuts panel</TabsContent>
         </Tabs>
       ),
       code: `<Tabs defaultValue="about">
     <TabsList><TabsTrigger value="about">About</TabsTrigger></TabsList>
     <TabsContent value="about">…</TabsContent>
   </Tabs>`,
     },
     {
       id: 'ui-collapsible',
       name: 'Collapsible (ui)',
       category: 'layout',
       description: 'Radix collapsible (replaces CollapsibleSection.tsx in plan 004)',
       component: (
         <Collapsible defaultOpen className="w-80">
           <CollapsibleTrigger asChild>
             <Button variant="ghost" data-testid="playground-open-collapsible">
               Section title
             </Button>
           </CollapsibleTrigger>
           <CollapsibleContent className="pt-2">Section content</CollapsibleContent>
         </Collapsible>
       ),
       code: `<Collapsible open={open} onOpenChange={setOpen}>
     <CollapsibleTrigger asChild><Button variant="ghost">Title</Button></CollapsibleTrigger>
     <CollapsibleContent>…</CollapsibleContent>
   </Collapsible>`,
     },
     {
       id: 'ui-separator',
       name: 'Separator (ui)',
       category: 'layout',
       description: 'Horizontal, vertical, and the toolbar variant (.toolbar-divider w-px mx-1)',
       component: (
         <div className="w-80">
           <p>Above</p>
           <Separator className="my-2" />
           <div className="flex h-6 items-center gap-2">
             <span>Tool</span>
             <Separator variant="toolbar" className="h-6" />
             <span>Tool</span>
             <Separator orientation="vertical" />
             <span>Tool</span>
           </div>
         </div>
       ),
       code: `<Separator />
   <Separator variant="toolbar" className="h-6" />`,
     },
   ];
   ```

**Do NOT**: touch `ToggleSwitch.tsx`, `CollapsibleSection.tsx`, `AboutModal.tsx`,
`MapSettingsSheet.tsx` or `App.tsx`; add `scroll-area`; add a `toolbar` variant to anything but
`separator`.
**Commands**: `npm run verify:static && npm run verify:web`
**Expected**: both exit 0.
**Check**: `ls src/components/ui/*.tsx | wc -l` prints `11` and
`npx vitest run src/components/DesignSystemPlayground/registry.test.ts` exits 0.
**If it fails**: if `verify:web` fails in a spec that does not visit `/design-system`, a primitive
has introduced a global style; STOP with the failing spec name (do not edit the spec). Otherwise
fix once and retry.
**Commit**: `plan-003 step-6: tranche B primitives`

### Step 7: Tranche C — sheet, popover, dropdown-menu with `ownsEscape`; esc-owns test

**Files**: `src/components/ui/sheet.tsx`, `src/components/ui/popover.tsx`,
`src/components/ui/dropdown-menu.tsx`, `src/components/ui/esc-owns.test.tsx`, `package.json`,
`package-lock.json`, `src/components/DesignSystemPlayground/registry/overlays.tsx`
**Do**:

1. `npx shadcn@4.21.0 add sheet popover dropdown-menu -y && npm run format`.
2. Make the Step 5 item 2 edits (props type `ownsEscape?: boolean`, destructure
   `ownsEscape = true`, attribute `data-esc-owns={ownsEscape ? 'true' : undefined}`,
   `aria-modal="true"`, and `bg-black/50` → `bg-[var(--app-overlay)]` on `SheetOverlay`) in:
   - `sheet.tsx`, on `<SheetPrimitive.Content` inside `SheetContent`
     (`grep -n 'SheetPrimitive.Content' src/components/ui/sheet.tsx`);
   - `popover.tsx`, on `<PopoverPrimitive.Content` inside `PopoverContent`;
   - `dropdown-menu.tsx`, on `<DropdownMenuPrimitive.Content` inside `DropdownMenuContent`
     (not on `SubContent`).
     `sheet.tsx` diff, for reference (the other two are identical in shape):

   ```diff
    function SheetContent({
      className,
      children,
      side = 'right',
   +  ownsEscape = true,
      ...props
    }: React.ComponentProps<typeof SheetPrimitive.Content> & {
      side?: 'top' | 'right' | 'bottom' | 'left';
   +  /** Renders data-esc-owns="true" so the global Escape does not stop Session Console audio. */
   +  ownsEscape?: boolean;
    }) {
      return (
        <SheetPortal>
          <SheetOverlay />
          <SheetPrimitive.Content
            data-slot="sheet-content"
   +        data-esc-owns={ownsEscape ? 'true' : undefined}
   ```

3. In `registry/overlays.tsx` add imports (alphabetical among the `@/components/ui/*` group):

   ```tsx
   import {
     DropdownMenu,
     DropdownMenuContent,
     DropdownMenuItem,
     DropdownMenuTrigger,
   } from '@/components/ui/dropdown-menu';
   import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
   import {
     Sheet,
     SheetContent,
     SheetDescription,
     SheetHeader,
     SheetTitle,
     SheetTrigger,
   } from '@/components/ui/sheet';
   ```

   add these components after `TooltipExample`:

   ```tsx
   function SheetExample(): JSX.Element {
     return (
       <Sheet>
         <SheetTrigger asChild>
           <Button variant="secondary" data-testid="playground-open-sheet">
             Open sheet
           </Button>
         </SheetTrigger>
         <SheetContent data-testid="playground-sheet-content">
           <SheetHeader>
             <SheetTitle>Sheet title</SheetTitle>
             <SheetDescription>Side panel, same focus rules as Dialog.</SheetDescription>
           </SheetHeader>
         </SheetContent>
       </Sheet>
     );
   }

   function PopoverExample(): JSX.Element {
     return (
       <Popover>
         <PopoverTrigger asChild>
           <Button variant="secondary" data-testid="playground-open-popover">
             Open popover
           </Button>
         </PopoverTrigger>
         <PopoverContent data-testid="playground-popover-content">
           <p>Popover content</p>
           <Button variant="ghost" data-testid="playground-popover-action">
             Action
           </Button>
         </PopoverContent>
       </Popover>
     );
   }

   function DropdownMenuExample(): JSX.Element {
     return (
       <DropdownMenu>
         <DropdownMenuTrigger asChild>
           <Button variant="secondary" data-testid="playground-open-dropdown">
             Open menu
           </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent data-testid="playground-dropdown-content">
           <DropdownMenuItem>First item</DropdownMenuItem>
           <DropdownMenuItem>Second item</DropdownMenuItem>
           <DropdownMenuItem>Third item</DropdownMenuItem>
         </DropdownMenuContent>
       </DropdownMenu>
     );
   }
   ```

   and append to `overlayExamples`:

   ```tsx
     {
       id: 'ui-sheet',
       name: 'Sheet (ui)',
       category: 'overlay',
       description: 'Side panel (MapSettingsSheet / SessionConsoleEditorSheet migrate here in plan 004)',
       component: <SheetExample />,
       code: `<Sheet><SheetTrigger asChild><Button>Open</Button></SheetTrigger>
     <SheetContent side="right" data-testid="sheet-example-root">…</SheetContent></Sheet>`,
     },
     {
       id: 'ui-popover',
       name: 'Popover (ui)',
       category: 'overlay',
       description: 'Non-modal popover for colour pickers and token quick-actions',
       component: <PopoverExample />,
       code: `<Popover><PopoverTrigger asChild><Button>Open</Button></PopoverTrigger>
     <PopoverContent>…</PopoverContent></Popover>`,
     },
     {
       id: 'ui-dropdown-menu',
       name: 'Dropdown menu (ui)',
       category: 'overlay',
       description: 'Keyboard-navigable menu for token and map context actions',
       component: <DropdownMenuExample />,
       code: `<DropdownMenu><DropdownMenuTrigger asChild><Button>Menu</Button></DropdownMenuTrigger>
     <DropdownMenuContent><DropdownMenuItem>Item</DropdownMenuItem></DropdownMenuContent></DropdownMenu>`,
     },
   ```

4. Create `src/components/ui/esc-owns.test.tsx` (mirrors
   `grep -n 'esc-owns' src/components/SessionConsole/useSessionConsoleHotkeys.test.ts`, line 53):

   ```tsx
   import { render } from '@testing-library/react';
   import { describe, expect, it } from 'vitest';

   import { Dialog, DialogContent, DialogTitle } from './dialog';
   import {
     DropdownMenu,
     DropdownMenuContent,
     DropdownMenuItem,
     DropdownMenuTrigger,
   } from './dropdown-menu';
   import { Popover, PopoverContent, PopoverTrigger } from './popover';
   import { Sheet, SheetContent, SheetTitle } from './sheet';

   const OWNER = '[data-esc-owns="true"]';

   const cases: Array<[name: string, render: (ownsEscape: boolean) => JSX.Element]> = [
     [
       'DialogContent',
       (ownsEscape) => (
         <Dialog open>
           <DialogContent ownsEscape={ownsEscape}>
             <DialogTitle>t</DialogTitle>
           </DialogContent>
         </Dialog>
       ),
     ],
     [
       'SheetContent',
       (ownsEscape) => (
         <Sheet open>
           <SheetContent ownsEscape={ownsEscape}>
             <SheetTitle>t</SheetTitle>
           </SheetContent>
         </Sheet>
       ),
     ],
     [
       'PopoverContent',
       (ownsEscape) => (
         <Popover open>
           <PopoverTrigger>t</PopoverTrigger>
           <PopoverContent ownsEscape={ownsEscape}>c</PopoverContent>
         </Popover>
       ),
     ],
     [
       'DropdownMenuContent',
       (ownsEscape) => (
         <DropdownMenu open>
           <DropdownMenuTrigger>t</DropdownMenuTrigger>
           <DropdownMenuContent ownsEscape={ownsEscape}>
             <DropdownMenuItem>i</DropdownMenuItem>
           </DropdownMenuContent>
         </DropdownMenu>
       ),
     ],
   ];

   describe.each(cases)('%s claims the global Escape', (_name, renderCase) => {
     it('renders data-esc-owns="true" by default', () => {
       const view = render(renderCase(true));
       expect(document.querySelector(OWNER)).not.toBeNull();
       view.unmount();
       expect(document.querySelector(OWNER)).toBeNull();
     });

     it('renders no data-esc-owns with ownsEscape={false}', () => {
       const view = render(renderCase(false));
       expect(document.querySelector(OWNER)).toBeNull();
       view.unmount();
     });
   });
   ```

**Do NOT**: add `ownsEscape` to `DropdownMenuSubContent` or to tooltip; add `scroll-area`;
touch `MobileSidebarDrawer.tsx`/`MobileBottomSheet.tsx`; migrate `MapSettingsSheet`.
**Commands**: `npm run verify:static && npm run verify:web`
**Expected**: both exit 0.
**Check**: `grep -l 'data-esc-owns={ownsEscape' src/components/ui/*.tsx | wc -l` prints `4`
and `npx vitest run src/components/ui/esc-owns.test.tsx` reports `8 passed`.
**If it fails**: a `ResizeObserver`/`hasPointerCapture`/`scrollIntoView` error means Step 5
item 3 was not applied; fix once and retry. Otherwise STOP with the vitest output.
**Commit**: `plan-003 step-7: tranche C primitives with ownsEscape; esc-owns test`

### Step 8: Automated proofs — axe, keyboard, purity, bridge, portals

**Files**: `src/components/ui/a11y.test.tsx`, `src/components/ui/keyboard.test.tsx`,
`src/components/ui/purity.test.ts`, `tests/theme-bridge.spec.ts`,
`tests/functional/primitives-portals.spec.ts`,
`src/components/DesignSystemPlayground/registry/layout.tsx`
**Do**:

1. Append the bridge probe to `registry/layout.tsx`. Utilities must appear as literal strings so
   Tailwind generates them; the probe pairs each bridged utility with the `--app-*` value it must
   resolve to, plus a negative control and a `dark:` probe. Add after the imports:

   ```tsx
   /** One row per bridge token: the shadcn utility and the --app-* value it must equal. */
   const BRIDGE_PROBES: ReadonlyArray<{ token: string; utility: string; expected: string }> = [
     { token: 'background', utility: 'bg-background', expected: 'bg-[var(--app-bg-base)]' },
     { token: 'foreground', utility: 'bg-foreground', expected: 'bg-[var(--app-text-primary)]' },
     { token: 'card', utility: 'bg-card', expected: 'bg-[var(--app-bg-surface)]' },
     {
       token: 'card-foreground',
       utility: 'bg-card-foreground',
       expected: 'bg-[var(--app-text-primary)]',
     },
     { token: 'popover', utility: 'bg-popover', expected: 'bg-[var(--app-bg-surface)]' },
     {
       token: 'popover-foreground',
       utility: 'bg-popover-foreground',
       expected: 'bg-[var(--app-text-primary)]',
     },
     { token: 'primary', utility: 'bg-primary', expected: 'bg-[var(--app-accent-solid)]' },
     {
       token: 'primary-foreground',
       utility: 'bg-primary-foreground',
       expected: 'bg-[var(--app-accent-solid-text)]',
     },
     { token: 'secondary', utility: 'bg-secondary', expected: 'bg-[var(--app-bg-active)]' },
     {
       token: 'secondary-foreground',
       utility: 'bg-secondary-foreground',
       expected: 'bg-[var(--app-text-primary)]',
     },
     { token: 'muted', utility: 'bg-muted', expected: 'bg-[var(--app-bg-subtle)]' },
     {
       token: 'muted-foreground',
       utility: 'bg-muted-foreground',
       expected: 'bg-[var(--app-text-secondary)]',
     },
     { token: 'accent', utility: 'bg-accent', expected: 'bg-[var(--app-bg-hover)]' },
     {
       token: 'accent-foreground',
       utility: 'bg-accent-foreground',
       expected: 'bg-[var(--app-text-primary)]',
     },
     { token: 'destructive', utility: 'bg-destructive', expected: 'bg-[var(--app-error-solid)]' },
     {
       token: 'destructive-foreground',
       utility: 'bg-destructive-foreground',
       expected: 'bg-[var(--app-accent-solid-text)]',
     },
     { token: 'border', utility: 'bg-border', expected: 'bg-[var(--app-border-subtle)]' },
     { token: 'input', utility: 'bg-input', expected: 'bg-[var(--app-border-default)]' },
     { token: 'ring', utility: 'bg-ring', expected: 'bg-[var(--app-accent-solid)]' },
   ];

   function BridgeProbe(): JSX.Element {
     return (
       <div className="flex flex-wrap gap-2" data-testid="bridge-probe">
         {BRIDGE_PROBES.map((p) => (
           <div key={p.token} className="flex items-center gap-1" title={p.token}>
             <div
               data-testid={`bridge-swatch-${p.token}`}
               className={`size-4 rounded-sm ${p.utility}`}
             />
             <div
               data-testid={`bridge-expected-${p.token}`}
               className={`size-4 rounded-sm ${p.expected}`}
             />
           </div>
         ))}
         <div
           data-testid="bridge-swatch-none"
           className="size-4 bg-[var(--color-does-not-exist)]"
         />
         <div
           data-testid="bridge-dark-probe"
           className="size-4 bg-[var(--app-bg-base)] dark:bg-[var(--app-accent-solid)]"
         />
         <div data-testid="bridge-dark-ref-light" className="size-4 bg-[var(--app-bg-base)]" />
         <div data-testid="bridge-dark-ref-dark" className="size-4 bg-[var(--app-accent-solid)]" />
       </div>
     );
   }
   ```

   and this entry at the end of `layoutExamples`:

   ```tsx
     {
       id: 'ui-bridge-probe',
       name: 'Theme bridge probe (ui)',
       category: 'layout',
       description: 'Each bridged shadcn utility next to the --app-* value it must equal (tests/theme-bridge.spec.ts)',
       component: <BridgeProbe />,
       code: `// bg-primary === bg-[var(--app-accent-solid)] in both themes`,
     },
   ```

   If plan 002's bridge maps a token to a different `--app-*` variable than the table above
   (`grep -n -- '--color-' src/index.css`), change the `expected` string to match the bridge; the
   bridge is authoritative.

2. Create `src/components/ui/purity.test.ts`:

   ```ts
   import { describe, expect, it } from 'vitest';

   const RAW_PALETTE =
     /\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange)(-[0-9]{2,3})?\b/g;
   const LITERAL_COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\boklch\(/g;

   const sources = import.meta.glob<string>('./*.tsx', {
     query: '?raw',
     import: 'default',
     eager: true,
   });

   describe('src/components/ui purity', () => {
     const files = Object.entries(sources).filter(([file]) => !file.endsWith('.test.tsx'));

     it('has primitives to check', () => {
       expect(files.length).toBeGreaterThanOrEqual(14);
     });

     it.each(files)('%s uses no raw Tailwind palette class', (_file, source) => {
       expect(source.match(RAW_PALETTE) ?? []).toEqual([]);
     });

     it.each(files)('%s contains no literal colour', (_file, source) => {
       expect(source.match(LITERAL_COLOUR) ?? []).toEqual([]);
     });
   });
   ```

3. Create `src/components/ui/a11y.test.tsx` (`axe-core` is a devDependency:
   `grep -n '"axe-core"' package.json`; `color-contrast` is disabled because jsdom does not
   compute styles; the tag filter matches `tests/accessibility.spec.ts`):

   ```tsx
   import { render } from '@testing-library/react';
   import axe from 'axe-core';
   import { describe, expect, it } from 'vitest';

   import { Button } from './button';
   import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible';
   import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';
   import {
     DropdownMenu,
     DropdownMenuContent,
     DropdownMenuItem,
     DropdownMenuTrigger,
   } from './dropdown-menu';
   import { Input } from './input';
   import { Label } from './label';
   import { Popover, PopoverContent, PopoverTrigger } from './popover';
   import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
   import { Separator } from './separator';
   import { Sheet, SheetContent, SheetDescription, SheetTitle } from './sheet';
   import { Slider } from './slider';
   import { Switch } from './switch';
   import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
   import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

   const cases: Array<[name: string, element: JSX.Element]> = [
     [
       'button',
       <div key="b">
         <Button>Default</Button>
         <Button variant="secondary">Secondary</Button>
         <Button variant="tool" size="tool" active>
           Tool
         </Button>
         <Button variant="broadcast" size="mode" state="running">
           Broadcast
         </Button>
       </div>,
     ],
     [
       'dialog (open)',
       <Dialog key="d" open>
         <DialogContent>
           <DialogTitle>Title</DialogTitle>
           <DialogDescription>Description</DialogDescription>
           <Button>Ok</Button>
         </DialogContent>
       </Dialog>,
     ],
     [
       'tooltip (open)',
       <TooltipProvider key="t">
         <Tooltip open>
           <TooltipTrigger asChild>
             <Button>Trigger</Button>
           </TooltipTrigger>
           <TooltipContent>Tip</TooltipContent>
         </Tooltip>
       </TooltipProvider>,
     ],
     [
       'input + label',
       <div key="i">
         <Label htmlFor="a11y-input">Name</Label>
         <Input id="a11y-input" />
       </div>,
     ],
     [
       'switch',
       <div key="sw">
         <Label htmlFor="a11y-switch">Snap</Label>
         <Switch id="a11y-switch" />
       </div>,
     ],
     [
       'select (open)',
       <Select key="se" open defaultValue="a">
         <SelectTrigger aria-label="Grid">
           <SelectValue />
         </SelectTrigger>
         <SelectContent>
           <SelectItem value="a">A</SelectItem>
           <SelectItem value="b">B</SelectItem>
         </SelectContent>
       </Select>,
     ],
     ['slider', <Slider key="sl" defaultValue={[50]} thumbLabel="Opacity" />],
     [
       'tabs',
       <Tabs key="ta" defaultValue="one">
         <TabsList>
           <TabsTrigger value="one">One</TabsTrigger>
           <TabsTrigger value="two">Two</TabsTrigger>
         </TabsList>
         <TabsContent value="one">One</TabsContent>
         <TabsContent value="two">Two</TabsContent>
       </Tabs>,
     ],
     [
       'collapsible (open)',
       <Collapsible key="c" open>
         <CollapsibleTrigger asChild>
           <Button>Toggle</Button>
         </CollapsibleTrigger>
         <CollapsibleContent>Content</CollapsibleContent>
       </Collapsible>,
     ],
     ['separator', <Separator key="sp" />],
     [
       'sheet (open)',
       <Sheet key="sh" open>
         <SheetContent>
           <SheetTitle>Title</SheetTitle>
           <SheetDescription>Description</SheetDescription>
         </SheetContent>
       </Sheet>,
     ],
     [
       'popover (open)',
       <Popover key="p" open>
         <PopoverTrigger asChild>
           <Button>Trigger</Button>
         </PopoverTrigger>
         <PopoverContent>Content</PopoverContent>
       </Popover>,
     ],
     [
       'dropdown-menu (open)',
       <DropdownMenu key="dm" open>
         <DropdownMenuTrigger asChild>
           <Button>Menu</Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent>
           <DropdownMenuItem>Item</DropdownMenuItem>
         </DropdownMenuContent>
       </DropdownMenu>,
     ],
   ];

   describe.each(cases)(
     '%s has no axe violations (WCAG 2.1 AA, contrast excluded)',
     (_name, element) => {
       it('passes', async () => {
         const view = render(element);
         const results = await axe.run(document.body, {
           runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
           rules: { 'color-contrast': { enabled: false } },
         });
         expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
         view.unmount();
       });
     },
   );
   ```

4. Create `src/components/ui/keyboard.test.tsx` (`@testing-library/user-event` is installed:
   `grep -n 'user-event' package.json`):

   ```tsx
   import { render, screen } from '@testing-library/react';
   import userEvent from '@testing-library/user-event';
   import { describe, expect, it } from 'vitest';

   import { Button } from './button';
   import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './dialog';
   import {
     DropdownMenu,
     DropdownMenuContent,
     DropdownMenuItem,
     DropdownMenuTrigger,
   } from './dropdown-menu';
   import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

   function DialogFixture(): JSX.Element {
     return (
       <Dialog>
         <DialogTrigger asChild>
           <Button>Open</Button>
         </DialogTrigger>
         <DialogContent data-testid="dialog-root">
           <DialogTitle>Title</DialogTitle>
           <DialogDescription>Description</DialogDescription>
           <Button>Cancel</Button>
           <Button>Confirm</Button>
         </DialogContent>
       </Dialog>
     );
   }

   describe('Dialog keyboard behaviour', () => {
     it('Escape closes and focus returns to the trigger', async () => {
       const user = userEvent.setup();
       render(<DialogFixture />);
       const trigger = screen.getByRole('button', { name: 'Open' });
       await user.click(trigger);
       expect(await screen.findByTestId('dialog-root')).toBeInTheDocument();
       await user.keyboard('{Escape}');
       expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
       expect(trigger).toHaveFocus();
     });

     it('Tab stays inside the open dialog', async () => {
       const user = userEvent.setup();
       render(<DialogFixture />);
       await user.click(screen.getByRole('button', { name: 'Open' }));
       const root = await screen.findByTestId('dialog-root');
       for (let i = 0; i < 6; i += 1) {
         await user.tab();
         expect(root.contains(document.activeElement)).toBe(true);
       }
     });
   });

   describe('DropdownMenu keyboard behaviour', () => {
     it('ArrowDown moves focus through the items', async () => {
       const user = userEvent.setup();
       render(
         <DropdownMenu>
           <DropdownMenuTrigger asChild>
             <Button>Menu</Button>
           </DropdownMenuTrigger>
           <DropdownMenuContent>
             <DropdownMenuItem>First</DropdownMenuItem>
             <DropdownMenuItem>Second</DropdownMenuItem>
           </DropdownMenuContent>
         </DropdownMenu>,
       );
       screen.getByRole('button', { name: 'Menu' }).focus();
       await user.keyboard('{Enter}');
       await screen.findByRole('menu');
       // Radix focuses the first item itself when the menu opens from the keyboard.
       expect(screen.getByRole('menuitem', { name: 'First' })).toHaveFocus();
       await user.keyboard('{ArrowDown}');
       expect(screen.getByRole('menuitem', { name: 'Second' })).toHaveFocus();
     });
   });

   describe('Tooltip keyboard behaviour', () => {
     it('opens when the trigger receives focus', async () => {
       const user = userEvent.setup();
       render(
         <TooltipProvider delayDuration={0}>
           <Tooltip>
             <TooltipTrigger asChild>
               <Button>Trigger</Button>
             </TooltipTrigger>
             <TooltipContent>Tip</TooltipContent>
           </Tooltip>
         </TooltipProvider>,
       );
       await user.tab();
       expect(screen.getByRole('button', { name: 'Trigger' })).toHaveFocus();
       expect((await screen.findAllByText('Tip')).length).toBeGreaterThanOrEqual(1);
     });
   });
   ```

5. Create `tests/theme-bridge.spec.ts` (Web-Chromium; `gotoSurface` from plan 000):

   ```ts
   import { expect, test } from '@playwright/test';

   import { gotoSurface } from './helpers/surfaces';

   const TOKENS = [
     'background',
     'foreground',
     'card',
     'card-foreground',
     'popover',
     'popover-foreground',
     'primary',
     'primary-foreground',
     'secondary',
     'secondary-foreground',
     'muted',
     'muted-foreground',
     'accent',
     'accent-foreground',
     'destructive',
     'destructive-foreground',
     'border',
     'input',
     'ring',
   ] as const;
   const TRANSPARENT = 'rgba(0, 0, 0, 0)';

   async function bg(page: import('@playwright/test').Page, testId: string): Promise<string> {
     return page.getByTestId(testId).evaluate((el) => getComputedStyle(el).backgroundColor);
   }

   for (const theme of ['light', 'dark'] as const) {
     test(`every bridged token resolves to its --app-* value (${theme})`, async ({ page }) => {
       await gotoSurface(page, 'design-system', theme);
       await expect(page.getByTestId('bridge-probe')).toBeVisible();
       for (const token of TOKENS) {
         const actual = await bg(page, `bridge-swatch-${token}`);
         const expected = await bg(page, `bridge-expected-${token}`);
         expect(actual, token).not.toBe(TRANSPARENT);
         expect(actual, token).toBe(expected);
       }
       // Negative control: an unbridged token must NOT resolve, proving the probe can fail.
       expect(await bg(page, 'bridge-swatch-none')).toBe(TRANSPARENT);
     });
   }
   ```

6. Create `tests/functional/primitives-portals.spec.ts` (Web-Chromium). World-View isolation is
   already covered by plan 000's `world-dialog` surface and is not re-tested here.

   ```ts
   import { expect, test } from '@playwright/test';

   import { gotoSurface } from '../helpers/surfaces';

   const OVERLAYS = ['dialog', 'sheet', 'popover', 'dropdown'] as const;

   async function bgOf(page: import('@playwright/test').Page, testId: string): Promise<string> {
     return page.getByTestId(testId).evaluate((el) => getComputedStyle(el).backgroundColor);
   }

   for (const name of OVERLAYS) {
     test(`${name}: opens, claims Escape, re-themes while open, closes, restores focus`, async ({
       page,
     }) => {
       await gotoSurface(page, 'design-system', 'light');
       const trigger = page.getByTestId(`playground-open-${name}`);
       await trigger.scrollIntoViewIfNeeded();
       await trigger.click();
       const content = page.getByTestId(`playground-${name}-content`);
       await expect(content).toBeVisible();
       await expect(content).toHaveAttribute('data-esc-owns', 'true');

       const lightBg = await bgOf(page, `playground-${name}-content`);
       await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
       await expect.poll(() => bgOf(page, `playground-${name}-content`)).not.toBe(lightBg);
       await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

       await page.keyboard.press('Escape');
       await expect(content).toBeHidden();
       await expect(trigger).toBeFocused();
     });
   }

   test('tooltip: opens on focus and closes on Escape', async ({ page }) => {
     await gotoSurface(page, 'design-system', 'light');
     const trigger = page.getByTestId('playground-open-tooltip');
     await trigger.scrollIntoViewIfNeeded();
     await trigger.focus();
     await expect(page.getByTestId('playground-tooltip-content')).toBeVisible();
     await page.keyboard.press('Escape');
     await expect(page.getByTestId('playground-tooltip-content')).toBeHidden();
   });

   test('dark: utilities follow data-theme, not the OS colour scheme', async ({ page }) => {
     await gotoSurface(page, 'design-system', 'light');
     await page.emulateMedia({ colorScheme: 'dark' });
     await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
     await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
     expect(await bgOf(page, 'bridge-dark-probe')).toBe(await bgOf(page, 'bridge-dark-ref-light'));

     await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
     await expect
       .poll(() => bgOf(page, 'bridge-dark-probe'))
       .toBe(await bgOf(page, 'bridge-dark-ref-dark'));
   });
   ```

**Do NOT**: add `exclude()` or `test.skip` anywhere; disable any axe rule other than
`color-contrast`; edit `tests/accessibility.spec.ts` or `playwright.config.ts`; add a dev-only
scaffold to `src/App.tsx`.
**Commands**: `npm run verify:static && npm run verify:web`
**Expected**: both exit 0.
**Check**: `npx vitest run src/components/ui` reports `0 failed`, and
`npm run build:web && CI=1 npx playwright test tests/theme-bridge.spec.ts tests/functional/primitives-portals.spec.ts --project=Web-Chromium`
reports `8 passed`.
**If it fails**: a bridge-probe mismatch (`expect(actual).toBe(expected)`) means the bridge in
`src/index.css` maps that token to a different variable than the probe: fix the probe's
`expected` once and retry. A `dark:` probe failure means `@custom-variant dark` is missing or
wrong: STOP with `grep -n '^@custom-variant' src/index.css`. An axe violation: STOP with the
violation id and primitive; do not disable the rule.
**Commit**: `plan-003 step-8: axe, keyboard, purity, bridge and portal proofs`

### Step 9: Contribution contract, recipes stub, ADR and doc updates

**Files**: `src/components/ui/README.md`, `docs/guides/UI_RECIPES.md`,
`docs/architecture/DECISIONS.md`, `docs/architecture/ARCHITECTURE.md`,
`docs/guides/CONVENTIONS.md`, `.github/copilot-instructions.md`, `.cursorrules`
**Do**:

1. Create `src/components/ui/README.md` with exactly these `##` headings, in this order, each
   filled as described:
   - `## What lives here` — primitives only (shadcn-generated, Radix-based). Feature components
     (`TokenCard`, dialogs with app state) do not.
   - `## Colour rule` — bridge tokens or `[var(--app-*)]` only; never a raw palette class or a
     literal colour; enforced by `purity.test.ts` and the regex it contains (paste the regex).
   - `## Imports rule` — only `react`, `@radix-ui/*`, `class-variance-authority`, `lucide-react`,
     `@remixicon/react`, `./siblings`, `@/lib/utils`; enforced by the `no-restricted-imports`
     override in `.eslintrc.cjs`.
   - `## Add a primitive` — this exact ordered list, one command per line, with its expected
     output:
     1. `npx shadcn@4.21.0 add <name> -y` → exit 0, `src/components/ui/<name>.tsx` exists.
     2. `npm run format` → exit 0.
     3. If it renders an overlay `Content`: add the `ownsEscape` prop (three edits, as in
        `dialog.tsx`; `grep -n 'ownsEscape' src/components/ui/dialog.tsx`).
     4. Register it: add an entry with `id: 'ui-<name>'` to the matching
        `src/components/DesignSystemPlayground/registry/*.tsx`; if it needs a new category, add it
        to `types.ts` **and** the `categories` array in `registry/index.ts`.
     5. Add it to the `cases` arrays in `a11y.test.tsx` (open state) and, if it owns Escape, in
        `esc-owns.test.tsx`.
     6. `npm run verify:static && npm run verify:web` → exit 0 (`registry.test.ts` fails until 4
        is done; `purity.test.ts` fails on any palette class).
   - `## Add a Graphium variant` — the CVA pattern, using `button.tsx` `tool`/`mode`/`broadcast`
     - `active` + `state` as the worked example (copy the `compoundVariants` block).
   - `## Button class mapping (plan 004)` — the table from "Context the executor needs".
   - `## ESLint rules relaxed here` — the four rules and why, plus `no-restricted-imports`.
   - `## Decisions` — toast: keep `Toast.tsx`, no `sonner` (`gameStore` models one toast on a
     5 s timer, `grep -n '5000' src/components/Toast.tsx`; sonner stacks and owns timers; `Toast`
     is mounted twice, in `App.tsx` and `DesignSystemPlayground.tsx`). `command`: out of scope
     for the program. `scroll-area`: deferred; no consumer until plan 004 needs one.
   - `## dark: utilities` — `dark:` keys off `[data-theme='dark']` via `@custom-variant dark` in
     `src/index.css`; portals stay inside `<html>` so theme scope is never escaped; proven by
     `tests/functional/primitives-portals.spec.ts`.
   - `## Bundle` — filled in Step 10.
2. Create `docs/guides/UI_RECIPES.md` with the title `# UI recipes` and exactly these `##`
   headings, in this order: `## Add a dialog`, `## Add a sheet`, `## Add a toolbar tool`,
   `## Add a surface to the test harness`, `## Add a primitive`. The first four contain only the
   line `_Filled by plan 004._`. `## Add a primitive` contains one line pointing at
   `src/components/ui/README.md` § "Add a primitive".
3. ADR: append to `docs/architecture/DECISIONS.md`, immediately before `## Summary Table`
   (`grep -n '^## Summary Table' docs/architecture/DECISIONS.md`), a section numbered one higher
   than `grep -oE '^## [0-9]+\.' docs/architecture/DECISIONS.md | tail -1` (prints `## 13.` at
   d3d3642, so the new section is `## 14.`), in
   the file's format (`## N. Title` / `### Context` / `### Alternatives Considered` /
   `### Decision: …`; `grep -n '^## \|^### ' docs/architecture/DECISIONS.md | head -12`):
   title `Adopt shadcn/ui primitives bridged onto the --app-* theme`; alternatives: hand-rolled
   primitives, Radix + CVA without the CLI; decision: CLI-generated primitives in
   `src/components/ui/`, Radix Colors kept and bridged, link to
   `docs/planning/shadcn-adoption-decision.md`.
4. `docs/architecture/ARCHITECTURE.md`: insert a `## UI Primitive Layer` section (≤ 25 lines:
   what `src/components/ui/` is, the bridge, `ownsEscape`, the registry contract, link to the
   README) immediately before `## Build and Deployment`
   (`grep -n '^## Build and Deployment' docs/architecture/ARCHITECTURE.md`, line 1590 at d3d3642).
5. `docs/guides/CONVENTIONS.md`: in the `paths` JSON example
   (`grep -n '"@components/\*"' docs/guides/CONVENTIONS.md`, line 430 at d3d3642) add the line
   `"@/*": ["src/*"],` above `"@components/*"` and one sentence after the block: "`@/*` is the
   shadcn alias; primitives and their tests use it."
6. `.github/copilot-instructions.md` (`grep -n 'inline styles' .github/copilot-instructions.md`,
   lines 135 and 229 at d3d3642): change both to "No inline styles — use Tailwind classes; in
   `src/components/ui/` compose them with `cva()` and `cn()`". `.cursorrules` line 14
   (`grep -n 'Styling' .cursorrules`): append " + shadcn/Radix primitives in `src/components/ui/`
   (see its README)".

**Do NOT**: edit `.ai-rules.md` (it has no conflicting line); rewrite existing ADRs or the
Summary Table; write plan 004's recipes; create `docs/planning/decisions/*` (nothing here is
Kyle's decision).
**Commands**: `npm run verify:static`
**Expected**: exit 0.
**Check**: `grep -c '^## ' src/components/ui/README.md` prints `10`;
`grep -c '^## Add a \(dialog\|sheet\|toolbar tool\|surface to the test harness\|primitive\)$' docs/guides/UI_RECIPES.md`
prints `5`; `grep -c 'Adopt shadcn/ui primitives' docs/architecture/DECISIONS.md` prints `1`;
`grep -c '^## UI Primitive Layer' docs/architecture/ARCHITECTURE.md` prints `1`.
**If it fails**: `format:check` failing on Markdown means Prettier rewrapped a table; run
`npm run format` and retry once.
**Commit**: `plan-003 step-9: ui README, UI_RECIPES stub, ADR, doc updates`

### Step 10: Dry-run the README, record the bundle, screenshots, report

**Files**: `src/components/ui/README.md`, `docs/planning/screenshots/003-final/`,
`plans/reports/003.md`, `plans/README.md`, `plans/004-migrate-screens-to-primitives.md`,
`plans/006-visual-redesign.md`, `CHANGELOG.md`
**Do**:

1. README dry-run with a throwaway primitive, following `## Add a primitive` literally:
   `aspect-ratio` (it contains no palette class, so the purity gate can pass; `badge` would not)
   (register it in `registry/layout.tsx` with `id: 'ui-aspect-ratio'`, add it to `a11y.test.tsx`
   `cases`). Run `npm run verify:static`. Record exit code and any step of the README that was
   ambiguous in the report; fix the README wording if so. Then discard the throwaway:
   `git checkout -- src/components/DesignSystemPlayground/registry/layout.tsx src/components/ui/a11y.test.tsx package.json package-lock.json && rm -f src/components/ui/aspect-ratio.tsx`
   and confirm `git status --porcelain` lists only `src/components/ui/README.md` (if edited).
2. Bundle: `npm run build:web`, then run the byte-count command recorded next to the
   `Extrapolated 12-primitive delta` field in `docs/planning/shadcn-adoption-decision.md`
   (`grep -n -B3 'Extrapolated 12-primitive delta' docs/planning/shadcn-adoption-decision.md`).
   Write under `## Bundle` in `src/components/ui/README.md`: plan 002's before number, today's
   number, the delta, the extrapolation, and the command.
3. `npm run verify` (all three gates).
4. `SHOTS_OUT=docs/planning/screenshots/003-final npm run shots`. Only `design-system-*.png` may
   differ from plan 001's set; `tests/visual.spec.ts` inside `verify:web` enforces the others.
5. Write the report (`plans/reports/003.md`, CONVENTIONS §11): include the raw-palette count
   before/after (`grep -rnE '\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange)(-[0-9]{2,3})?\b' src/ --include=*.tsx --include=*.ts | wc -l`,
   243 hits in 39 files at d3d3642 — unchanged by this plan; compare with the field in
   `docs/planning/verification-baseline.md`), `ls src/components/ui/*.tsx | wc -l` (`17`: 14
   primitives + 3 `.test.tsx`; `purity.test.ts` is `.ts`), the bundle numbers, and the README
   dry-run outcome. No user-visible
   change ships: add no `CHANGELOG.md` bullet unless a gate forced a `src/` change outside
   `src/components/ui/` and the playground; then add one under `## [Unreleased]`. After merge:
   set this plan's row in `plans/README.md` to `DONE <merge sha>`; write the merge SHA into the
   `Grounded at` line of `plans/004-migrate-screens-to-primitives.md` and of
   `plans/006-visual-redesign.md` (006a starts after this plan merges).

**Do NOT**: keep `aspect-ratio.tsx`; commit `test-results/`; edit `tests/visual.spec.ts` snapshots;
squash-merge.
**Commands**: `npm run verify` then `SHOTS_OUT=docs/planning/screenshots/003-final npm run shots`
**Expected**: both exit 0.
**Check**: `git status --porcelain | grep -c aspect-ratio` prints `0`;
`ls docs/planning/screenshots/003-final/design-system-*.png | wc -l` prints `2`;
`D=$(grep -oE 'Bundle delta: [0-9]+' src/components/ui/README.md | grep -oE '[0-9]+$'); E=$(grep -oE 'Extrapolated 12-primitive delta: [0-9]+' docs/planning/shadcn-adoption-decision.md | grep -oE '[0-9]+$'); test "$D" -le $((2 * E)) && echo bundle-ok`
prints `bundle-ok` (both lines are written as `<label>: <bytes>`).
**If it fails**: bundle delta > 2× → STOP with both numbers (something is bundled twice, e.g.
two Radix versions: `npm ls @radix-ui/react-dialog`). Otherwise STOP with the gate output.
**Commit**: `plan-003 step-10: bundle record, screenshots, report`

## Validation plan

- `npm run verify` after Step 10; `verify:static` + `verify:web` after every step that touches
  `src/` or `tests/`.
- Unit (vitest): `registry.test.ts` (categories + one entry per primitive), `esc-owns.test.tsx`
  (8 tests), `a11y.test.tsx` (13 primitives in open state), `keyboard.test.tsx` (4 tests),
  `purity.test.ts` (2 × 14 files + 1).
- E2E (Web-Chromium): `tests/theme-bridge.spec.ts` (2 tests), `tests/functional/primitives-portals.spec.ts`
  (6 tests), plus the existing `accessibility.spec.ts`, `visual.spec.ts` and surface smoke specs.
- Kyle reviews `docs/planning/screenshots/003-final/design-system-{light,dark}.png` in the PR;
  the `tool`/`mode`/`broadcast` rows must read as today's toolbar buttons. No other surface
  changes (`visual.spec.ts`).

## Done criteria

- [ ] `.eslintrc.cjs` has the one `src/components/ui/**/*.tsx` override (Step 1)
- [ ] Spike patch applied; `components.json`, `src/lib/utils.ts` (`cn`), aliases present (Step 2)
- [ ] `grep -c '^@theme' src/index.css` prints `2`; `grep -c 'oklch(' src/index.css` prints `0`
- [ ] Registry split into `registry/{index.ts,buttons,overlays,forms,layout,legacy}.tsx`; 37 legacy examples intact
- [ ] 14 primitives exist: `ls src/components/ui/*.tsx | grep -vc test` prints `14`
- [ ] `button` has `tool`/`mode`/`broadcast`, `active`, `state` (Step 4 Check)
- [ ] `dialog`, `sheet`, `popover`, `dropdown-menu` render `data-esc-owns` by default with `ownsEscape` opt-out
- [ ] `separator` has `variant="toolbar"`
- [ ] `npx vitest run src/components/ui src/components/DesignSystemPlayground/registry.test.ts` reports `0 failed`
- [ ] `tests/theme-bridge.spec.ts` and `tests/functional/primitives-portals.spec.ts` pass (8 tests)
- [ ] Purity: `grep -rnE '\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange)(-[0-9]{2,3})?\b' src/components/ui/` returns nothing
- [ ] `src/components/ui/README.md` (10 sections) and `docs/guides/UI_RECIPES.md` (5 headings) exist; README dry-run recorded
- [ ] ADR in `docs/architecture/DECISIONS.md`; `## UI Primitive Layer` in `ARCHITECTURE.md`
- [ ] Bundle delta recorded and ≤ 2 × the decision doc's `Extrapolated 12-primitive delta`
- [ ] `docs/planning/screenshots/003-final/` committed
- [ ] `git diff --stat <grounded-at>..HEAD` touches only in-scope paths
- [ ] `plans/reports/003.md` written; `plans/README.md` row `DONE <merge sha>`; Grounded-at written into plans 004 and 006

## STOP conditions

- Decision doc verdict `NO-GO`, or `git apply` of the spike patch conflicts (Step 2).
- Lint fails inside `src/components/ui/` on a rule other than the four in Step 1 — report the
  rule name; do not widen the override.
- An axe violation in `a11y.test.tsx` or `test:a11y` — report id and primitive; never disable a
  rule or hardcode a colour.
- A primitive needs a colour the bridge lacks — use `[var(--app-*)]`; if no `--app-*` token
  fits either, STOP (adding a token is plan 006b's call).
- The `dark:` probe fails (Step 8) — `@custom-variant dark` is wrong; affects every overlay.
- Bundle delta > 2 × the extrapolation (Step 10).
- Any step seems to need an edit to an existing feature component.

## Handoff / after it lands

- Plan 004 consumes this layer directly; until screens migrate it is pure cost. Its migration
  uses the button mapping in `src/components/ui/README.md` and passes
  `data-testid="dialog-<x>-root"` / `sheet-<x>-root` through `DialogContent`/`SheetContent`.
- Plan 006a may start once this plan merges (both read the same Grounded-at).
- Reviewer focus: (1) the `tool`/`mode`/`broadcast` rows in the design-system screenshots;
  (2) `src/components/ui/README.md`, the only thing preventing drift from restarting.
- Watch for `src/components/ui/` accumulating feature components; `registry.test.ts` will demand
  an example for each file, which makes the mistake visible.
