# shadcn/ui adoption decision (plan 002)

Verdict: GO-WITH-CAVEATS

## 1. Environment

| Item             | Value                                                       |
| ---------------- | ----------------------------------------------------------- |
| Node             | v22.14.0                                                    |
| npm              | 10.9.7                                                      |
| react (lockfile) | package-lock.json:10709 `node_modules/react` version 18.3.1 |
| shadcn CLI       | 4.21.0                                                      |
| origin/main      | 918e736                                                     |

## 2. Baseline (origin/main)

| Measure          | Command                         | Value    |
| ---------------- | ------------------------------- | -------- |
| web bytes        | find dist-web/assets … wc -c    | 1188167  |
| electron bytes   | find dist dist-electron … wc -c | 11806565 |
| dependency count | npm ls --depth=0 \| wc -l       | 53       |
| npm run verify   | exit code                       | 0        |

## 3. What the CLI did (init, add)

### Init command

First attempt (plan's exact command) failed:

```
$ npx shadcn@4.21.0 init -y -d --base-color neutral
npm warn exec The following package was not found and will be installed: shadcn@4.21.0
error: unknown option '--base-color'
```

`npx shadcn@4.21.0 init --help` (verbatim):

```
Usage: shadcn init|create [options] [components...]

initialize your project and install dependencies

Arguments:
  components                 names, url or local path to component

Options:
  -t, --template <template>  the template to use. (next, start, vite,
                             react-router, laravel, astro)
  -b, --base <base>          the component library to use. (base, radix, aria)
  --monorepo                 scaffold a monorepo project.
  --no-monorepo              skip the monorepo prompt.
  -p, --preset [name]        use a preset configuration
  -y, --yes                  skip confirmation prompt. (default: true)
  -d, --defaults             use default configuration: --template=next
                             --preset=base-nova (default: false)
  -f, --force                force overwrite of existing configuration.
                             (default: false)
  -c, --cwd <cwd>            the working directory. defaults to the current
                             directory. (default: "/workspace")
  -n, --name <name>          the name for the new project.
  -s, --silent               mute output. (default: false)
  --css-variables            use css variables for theming. (default: true)
  --no-css-variables         do not use css variables for theming.
  --rtl                      enable RTL support.
  --no-rtl                   disable RTL support.
  --pointer                  enable pointer cursor for buttons.
  --no-pointer               disable pointer cursor for buttons.
  --reinstall                re-install existing UI components.
  --no-reinstall             do not re-install existing UI components.
  -h, --help                 display help for command
```

`--base-color` is gone. `-d/--defaults` now forces `--template=next --preset=base-nova` (wrong for this Vite app). `-b/--base` is the primitive library (base, radix, aria), not a colour.

Second attempt `npx shadcn@4.21.0 init -y --base radix` was interactive (no TTY selected anything; wrote nothing):

```
? Which preset would you like to use? › - Use arrow-keys. Return to submit.
❯   Nova - Lucide / Geist
    Vega
    Maia
    Lyra
    Mira
    Luma
    Sera
    Rhea
    Custom
```

Equivalent non-interactive command that succeeded (If-it-fails, one retry):

```
$ npx shadcn@4.21.0 init -y --base radix --preset nova --no-monorepo
- Preflight checks.
✔ Preflight checks.
- Verifying framework.
✔ Verifying framework. Found Vite.
- Validating Tailwind CSS. Found v4.
✔ Validating Tailwind CSS. Found v4.
- Validating import alias.
✔ Validating import alias.
- Writing components.json.
✔ Writing components.json.
- Checking registry.
✔ Checking registry.
- Installing dependencies.
- Installing dependencies.
✔ Installing dependencies.
- Updating files.
✔ Created 1 file:
  - src/lib/utils.ts
- Updating src/index.css
✔ Updating src/index.css

Project initialization completed.
You may now add components.
```

No `ERESOLVE` and no `peer dep` warnings. React stayed 18.3.1. Did not use `--legacy-peer-deps`.

`npx shadcn@4.21.0 info` before init (detected existing project):

```
framework         Vite (vite)
srcDirectory      Yes
rsc               No
typescript        Yes
tailwindVersion   v4
tailwindCss       src/index.css
importAlias       @
```

### components.json (full, after init)

`tailwind.css` was already `src/index.css`. No edit.

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-nova",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "menuColor": "default",
  "menuAccent": "subtle",
  "registries": {}
}
```

### git status --porcelain (after init, before restore)

```
 M package-lock.json
 M package.json
 M src/index.css
?? components.json
?? src/lib/
```

`tailwind.config.js` was not recreated. `tsconfig.json` and `vite.config.ts` were not modified.

### git diff package.json (verbatim)

```
diff --git a/package.json b/package.json
index e3524a7..8948c34 100644
--- a/package.json
+++ b/package.json
@@ -40,18 +40,25 @@
     "prepare": "husky"
   },
   "dependencies": {
+    "@fontsource-variable/geist": "^5.3.0",
     "@radix-ui/colors": "^3.0.0",
     "@remixicon/react": "^4.8.0",
+    "class-variance-authority": "^0.7.1",
+    "cn": "^0.2.5",
     "electron-log": "^5.2.4",
     "electron-store": "^11.0.2",
     "electron-updater": "^6.3.9",
     "idb": "^8.0.3",
     "jszip": "^3.10.1",
     "konva": "^10.0.12",
+    "lucide-react": "^1.41.0",
+    "radix-ui": "^1.6.7",
     "react": "^18.2.0",
     "react-dom": "^18.2.0",
     "react-easy-crop": "^5.5.6",
     "react-konva": "^18.2.14",
+    "shadcn": "^4.21.0",
+    "tw-animate-css": "^1.4.0",
     "use-image": "^1.1.4",
     "zustand": "^5.0.9"
   },
```

### Resolved versions (`grep -n '"node_modules/<name>"' -A1 package-lock.json`)

| Package                    | Lockfile line                     | Version |
| -------------------------- | --------------------------------- | ------- |
| @fontsource-variable/geist | 1978                              | 5.3.0   |
| class-variance-authority   | 7014                              | 0.7.1   |
| cn                         | 7118                              | 0.2.5   |
| lucide-react               | 12293                             | 1.41.0  |
| radix-ui                   | 14059                             | 1.6.7   |
| shadcn                     | 15054                             | 4.21.0  |
| tw-animate-css             | 16262                             | 1.4.0   |
| clsx (transitive)          | 7109                              | 2.1.1   |
| tailwind-merge             | not present as a lockfile package | —       |

`cn@0.2.5` is "Fast, small, compiled class-name merging for Tailwind CSS. Drop-in replacement for clsx + tailwind-merge." (`node_modules/cn/package.json`).

### src/lib/utils.ts as the CLI wrote it

```
export { cn } from "cn"
```

The plan Check looks for `export function cn`. The 4.21.0 CLI no longer emits that function; it re-exports the `cn` package. Recorded as a surprise. A one-line wrapper is added after this record so the Check holds (same runtime).

### git diff src/index.css (verbatim, before `git checkout origin/main -- src/index.css`)

The CLI appended `tw-animate-css`, `shadcn/tailwind.css`, Geist, `@custom-variant dark (&:is(.dark *))`, OKLCH `:root` / `.dark` blocks, extra `--color-*` / `--radius-*` / `--sidebar-*` / `--chart-*` inside the existing `@theme inline`, and `@layer base { * { @apply border-border outline-ring/50 } }`. Restored to origin/main after capture. Full diff:

```
diff --git a/src/index.css b/src/index.css
index f44dcfc..42d861b 100644
--- a/src/index.css
+++ b/src/index.css
@@ -2,6 +2,13 @@
 @import './styles/fonts.css';
 @import './styles/theme.css';
 @import './styles/app.css';
+@import "tw-animate-css";
+@import "shadcn/tailwind.css";
+@import "@fontsource-variable/geist";
+/*
+ ---break---
+ */
+@custom-variant dark (&:is(.dark *));

 /*
  * Tailwind namespace aliases → Graphium tokens. `rounded-lg`, `shadow-2xl`, `ease-out`,
@@ -29,6 +36,43 @@
   --font-weight-semibold: var(--app-font-weight-semibold);
   --font-weight-bold: var(--app-font-weight-bold);
   --animate-slide-down: slideDown 0.3s ease-out;
+  --font-heading: var(--font-sans);
+  --font-sans: 'Geist Variable', sans-serif;
+  --color-sidebar-ring: var(--sidebar-ring);
+  --color-sidebar-border: var(--sidebar-border);
+  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
+  --color-sidebar-accent: var(--sidebar-accent);
+  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
+  --color-sidebar-primary: var(--sidebar-primary);
+  --color-sidebar-foreground: var(--sidebar-foreground);
+  --color-sidebar: var(--sidebar);
+  --color-chart-5: var(--chart-5);
+  --color-chart-4: var(--chart-4);
+  --color-chart-3: var(--chart-3);
+  --color-chart-2: var(--chart-2);
+  --color-chart-1: var(--chart-1);
+  --color-ring: var(--ring);
+  --color-input: var(--input);
+  --color-border: var(--border);
+  --color-destructive: var(--destructive);
+  --color-accent-foreground: var(--accent-foreground);
+  --color-accent: var(--accent);
+  --color-muted-foreground: var(--muted-foreground);
+  --color-muted: var(--muted);
+  --color-secondary-foreground: var(--secondary-foreground);
+  --color-secondary: var(--secondary);
+  --color-primary-foreground: var(--primary-foreground);
+  --color-primary: var(--primary);
+  --color-popover-foreground: var(--popover-foreground);
+  --color-popover: var(--popover);
+  --color-card-foreground: var(--card-foreground);
+  --color-card: var(--card);
+  --color-foreground: var(--foreground);
+  --color-background: var(--background);
+  --radius-xl: calc(var(--radius) * 1.4);
+  --radius-2xl: calc(var(--radius) * 1.8);
+  --radius-3xl: calc(var(--radius) * 2.2);
+  --radius-4xl: calc(var(--radius) * 2.6);
 }

 @keyframes slideDown {
@@ -56,3 +100,90 @@ body {
   width: 100%;
   height: 100%;
 }
+/*
+ ---break---
+ */
+:root {
+  --background: oklch(1 0 0);
+  --foreground: oklch(0.145 0 0);
+  --card: oklch(1 0 0);
+  --card-foreground: oklch(0.145 0 0);
+  --popover: oklch(1 0 0);
+  --popover-foreground: oklch(0.145 0 0);
+  --primary: oklch(0.205 0 0);
+  --primary-foreground: oklch(0.985 0 0);
+  --secondary: oklch(0.97 0 0);
+  --secondary-foreground: oklch(0.205 0 0);
+  --muted: oklch(0.97 0 0);
+  --muted-foreground: oklch(0.556 0 0);
+  --accent: oklch(0.97 0 0);
+  --accent-foreground: oklch(0.205 0 0);
+  --destructive: oklch(0.577 0.245 27.325);
+  --border: oklch(0.922 0 0);
+  --input: oklch(0.922 0 0);
+  --ring: oklch(0.708 0 0);
+  --chart-1: oklch(0.87 0 0);
+  --chart-2: oklch(0.556 0 0);
+  --chart-3: oklch(0.439 0 0);
+  --chart-4: oklch(0.371 0 0);
+  --chart-5: oklch(0.269 0 0);
+  --radius: 0.625rem;
+  --sidebar: oklch(0.985 0 0);
+  --sidebar-foreground: oklch(0.145 0 0);
+  --sidebar-primary: oklch(0.205 0 0);
+  --sidebar-primary-foreground: oklch(0.985 0 0);
+  --sidebar-accent: oklch(0.97 0 0);
+  --sidebar-accent-foreground: oklch(0.205 0 0);
+  --sidebar-border: oklch(0.922 0 0);
+  --sidebar-ring: oklch(0.708 0 0);
+}
+/*
+ ---break---
+ */
+.dark {
+  --background: oklch(0.145 0 0);
+  --foreground: oklch(0.985 0 0);
+  --card: oklch(0.205 0 0);
+  --card-foreground: oklch(0.985 0 0);
+  --popover: oklch(0.205 0 0);
+  --popover-foreground: oklch(0.985 0 0);
+  --primary: oklch(0.922 0 0);
+  --primary-foreground: oklch(0.205 0 0);
+  --secondary: oklch(0.269 0 0);
+  --secondary-foreground: oklch(0.985 0 0);
+  --muted: oklch(0.269 0 0);
+  --muted-foreground: oklch(0.708 0 0);
+  --accent: oklch(0.269 0 0);
+  --accent-foreground: oklch(0.985 0 0);
+  --destructive: oklch(0.704 0.191 22.216);
+  --border: oklch(1 0 0 / 10%);
+  --input: oklch(1 0 0 / 15%);
+  --ring: oklch(0.556 0 0);
+  --chart-1: oklch(0.87 0 0);
+  --chart-2: oklch(0.556 0 0);
+  --chart-3: oklch(0.439 0 0);
+  --chart-4: oklch(0.371 0 0);
+  --chart-5: oklch(0.269 0 0);
+  --sidebar: oklch(0.205 0 0);
+  --sidebar-foreground: oklch(0.985 0 0);
+  --sidebar-primary: oklch(0.488 0.243 264.376);
+  --sidebar-primary-foreground: oklch(0.985 0 0);
+  --sidebar-accent: oklch(0.269 0 0);
+  --sidebar-accent-foreground: oklch(0.985 0 0);
+  --sidebar-border: oklch(1 0 0 / 10%);
+  --sidebar-ring: oklch(0.556 0 0);
+}
+/*
+ ---break---
+ */
+@layer base {
+  * {
+    @apply border-border outline-ring/50;
+  }
+  body {
+    @apply bg-background text-foreground;
+  }
+  html {
+    @apply font-sans;
+  }
+}
```

`git checkout origin/main -- src/index.css` restored plans 000/001. `grep -c '^@theme' src/index.css` → `1`.

## 4. ESLint findings (lint-rules.txt) and the scoped override

`npx shadcn@4.21.0 add button dialog tooltip -y` created:

- `src/components/ui/button.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/tooltip.tsx`

`git diff package.json` after add: empty. No new dependencies. `lucide-react`, `radix-ui`, `class-variance-authority`, and `cn` were already added by init (see §3). Generated files import `cn` from `'cn'` and primitives from `'radix-ui'` (umbrella), not `@/lib/utils` / `@radix-ui/react-*`. `dialog.tsx` imports `XIcon` from `lucide-react`.

`npm run lint:fix` then `--max-warnings 0 --format json` listing (`lint-rules.txt`):

```
@typescript-eslint/explicit-function-return-type
import/no-unused-modules
react-refresh/only-export-components
```

32 warnings, 0 errors, all three rule ids. No ids outside the plan's starter override.

Scoped override appended to `.eslintrc.cjs` `overrides`:

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

## 5. Bridge and final src/index.css

`src/index.css` after this step:

- `@import 'tw-animate-css'` (present: `grep -c tw-animate-css package.json` → 1)
- `@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));` (replaces the CLI's `&:is(.dark *)`)
- First `@theme inline` is plans 000/001 unchanged (token aliases + `--animate-slide-down`)
- `@keyframes slideDown` unchanged
- Second `@theme inline` is the bridge: every `--color-*` is a `var(--app-*)`
- No `:root`, `.dark`, `@layer base`, `--radius`, `--chart-*`, or `--sidebar-*` from the CLI

Commands:

```
grep -c '^@theme' src/index.css                          → 2
grep -c '^@custom-variant dark' src/index.css            → 1
grep -nE "^\s*--color-[a-z-]+: [^v]" src/index.css       → (empty)
```

Token coverage (first command printed nothing; no `MISSING` lines). Tokens used by the three UI files all resolve through the bridge.

Radius utilities in `src/components/ui/*.tsx`:

```
rounded-lg
rounded-md
rounded-sm
rounded-xl
```

`sm|md|lg` come from plan 000's first `@theme`. `rounded-xl` is not aliased there and falls through to Tailwind's default. `text-white` is a Tailwind built-in (not used by the generated `destructive` variant in 4.21.0; that variant is `bg-destructive/10 text-destructive`).

Destructive contrast (white on `--app-error-solid` `#e5484d`): `3.91` (rubric B6; not a verdict row). Playground examples render `default`, `secondary`, `outline` only.

a11y:

- `--list`: `Total: 14 tests in 1 file`
- First `npm run test:a11y` (DEV, no `CI`): 14 failed. Every scan reported `button-name` on `<button class="styles-module__controlButton___8Q0jc">` — the Agentation DEV toolbar already on `origin/main` (`import.meta.env.DEV && <Agentation />` in `src/App.tsx`). Not `color-contrast` and not a bridge typo.
- Retry: `npm run build:web && CI=1 npm run test:a11y` (the `verify:web` a11y path, preview, no Agentation): **14 passed**.

Playground: category `shadcn-spike` plus three examples (`spike-shadcn-button`, `spike-shadcn-dialog`, `spike-shadcn-tooltip`).

## 6. Portal spec output (tests/spike-portals.spec.ts)

Command: `npm run build:web && CI=1 npx playwright test tests/spike-portals.spec.ts --project=Web-Chromium --reporter=list --retries=0`

First run and flake re-run: same result. 6 passed. Screenshots written: `docs/planning/screenshots/002-final/spike-dialog-dark.png`, `spike-dialog-light.png`.

Passed: focus Tab cycle; esc-owns (audio stays `playing`); pointer (body `pointer-events: none`, drawing count 0); tooltip inside dialog; dark variant follows `data-theme` (white/black probe); world view (0 dialogs / 0 spike-root on `/?type=world`).

Failed (not flake; findings, not defects of this plan):

1. `portal: dialog renders under body, Escape closes it, focus returns` — portal under `body` and Escape hide both succeeded; `expect(trigger).toBeFocused()` failed: trigger `Received: inactive` after Escape. Dialog closed; focus did not return to the trigger.

2. `tooltip: flips away from the viewport edge` — tooltip visible; `data-side` Expected `"top"` Received `"bottom"`. Collision flip did not move the edge tooltip off `side="bottom"`.

World-view test passed (A3 false). The two failures are B4.

## 7. jsdom probe: stubs required

Iterations: 3. Dialog test passed on the first run with an empty MOCKS block. Tooltip failed.

First run error (verbatim excerpt):

```
ReferenceError: ResizeObserver is not defined
 ❯ node_modules/@radix-ui/react-use-size/dist/index.mjs:12:30
```

Plus `findByRole('tooltip')` timeout. Tests: 1 failed | 1 passed.

Second run used the table stub `window.ResizeObserver = vi.fn(() => ({ observe, unobserve, disconnect }))`. Failed:

```
TypeError: () => ({ observe: … }) is not a constructor
 ❯ new Mock node_modules/@vitest/spy/dist/index.js:262:27
 ❯ node_modules/@radix-ui/react-use-size/dist/index.mjs:12:30
```

Third run: constructor-compatible stub (Radix calls `new ResizeObserver`). Final: `2 passed`.

Final MOCKS block:

```ts
window.ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as unknown as typeof ResizeObserver;
```

No `hasPointerCapture`, `scrollIntoView`, or `PointerEvent` stubs. `src/test/setup.ts` was not edited.

## 8. Cost

`npm run verify` exit code: 1. Failures (same two as §6, retries exhausted):

- `portal: dialog renders under body, Escape closes it, focus returns`
- `tooltip: flips away from the viewport edge`

`verify:static` passed. `verify:electron` did not run because `verify:web` stopped on those two tests. Electron bytes below are from a follow-up `npm run build:electron` so the spike column is comparable to the Step 1 baseline.

| Measure          | Baseline | Spike    | Delta  |
| ---------------- | -------- | -------- | ------ |
| web bytes        | 1188167  | 1322720  | 134553 |
| electron bytes   | 11806565 | 11941103 | 134538 |
| dependency count | 53       | 60       | 7      |

Extrapolated 12-primitive delta: 269106

Rationale: `tailwind-merge`/`clsx` were replaced by `cn` (paid once) together with CVA, `radix-ui`, `lucide-react`, `tw-animate-css`, `shadcn`, and Geist; those shared deps are roughly half of a three-primitive delta; nine more Radix primitives roughly equal the other half.

## 9. Answers to the four questions

1. Does `shadcn@4.21.0` install and generate working components on React 18.3.1 without a peer-dependency flag? Yes (§3): init/add exited 0 on React 18.3.1 with no `ERESOLVE` and no `--legacy-peer-deps`. The plan's `--base-color` flag is gone; the equivalent was `init -y --base radix --preset nova --no-monorepo`.
2. Can the components be re-themed onto `--app-*` through an `@theme inline` bridge and pass `npm run test:a11y` in both themes? Yes (§5): two `@theme inline` blocks, every bridge value is `var()`, `CI=1 npm run test:a11y` is 14 passed. Bare DEV `test:a11y` fails on the pre-existing Agentation toolbar, not the bridge.
3. Do Radix portals behave? Mixed (§6): portal-to-body, focus trap, `data-esc-owns` Escape, pointer lock, tooltip-in-dialog, `data-theme` dark variant, and World View isolation all passed. Focus-return after Escape and tooltip collision flip failed (B4).
4. What does it cost? Web +134553 bytes, electron +134538 bytes, +7 top-level deps; extrapolated 12-primitive delta 269106 (§8). ESLint needs the three-rule scoped override (§4). jsdom needs a `ResizeObserver` constructor stub (§7).

## 10. Required changes to plan 003

1. Test `portal: dialog renders under body, Escape closes it, focus returns` failed with `expect(trigger).toBeFocused()` Received `inactive` after Escape (dialog did close). Plan 003's Dialog wrapper must restore focus to the trigger on close (or wrap Dialog so Radix focus-return is not swallowed by `data-esc-owns` / the Session Console Escape handler).
2. Test `tooltip: flips away from the viewport edge` failed with `data-side` Expected `top` Received `bottom`. Plan 003's Tooltip wrapper must not assume collision flip at the viewport edge; set `avoidCollisions` / collision padding explicitly or treat flip as optional.
3. `lucide-react` was added by init (used by `dialog` as `XIcon`); `cn`, `radix-ui`, `shadcn`, and `@fontsource-variable/geist` were also added. Plan 003 either adds them to its allowed dependency list or replaces `XIcon` with `RiCloseLine` from `@remixicon/react` in `dialog.tsx` — raise decision file `003-icon-library` before Step 1. Do not expect `@radix-ui/react-dialog` / `clsx` / `tailwind-merge` as direct deps; 4.21.0 uses `radix-ui` + `cn`.
4. `destructive` variant text is 3.91:1 on `--app-error-solid`; plan 003 must not render `variant="destructive"` on any scanned surface until plan 006b changes the palette, or must map `--color-destructive` to an AA-passing value — raise decision file `003-destructive-contrast`. Generated 4.21.0 `destructive` is `bg-destructive/10 text-destructive` (not white-on-solid); still do not put it on axe-scanned surfaces.
5. Add to `src/test/setup.ts`:
   ```ts
   window.ResizeObserver = class {
     observe = vi.fn();
     unobserve = vi.fn();
     disconnect = vi.fn();
   } as unknown as typeof ResizeObserver;
   ```
   The plan table's `vi.fn(() => ({…}))` stub is not a constructor; Radix calls `new ResizeObserver`.
6. Update `docs/guides/CONVENTIONS.md` alias section (lines 430–444 at d3d3642) to `@/*` → `./src/*`.
7. `tw-animate-css` is present; `dialog` animations depend on it — keep it (`@import 'tw-animate-css'` in `src/index.css`).
8. The CLI's `@layer base` universal `border-border`/`outline-ring/50` rules were dropped; do not reintroduce them.
9. Init command for any new primitive: `npx shadcn@4.21.0 add <name> -y` (no `--base-color`). `init` must use `--base radix --preset nova --no-monorepo`, never `-d` (that forces `--template=next`).
10. `src/lib/utils.ts` may re-export `cn` from the `cn` package; generated UI files import `cn` from `'cn'` directly. Keep both.

## 11. Surprises

- `shadcn@4.21.0 init -y -d --base-color neutral` fails: `unknown option '--base-color'`. `-d` now means `--template=next --preset=base-nova`.
- Init without `--preset` is interactive (`Which preset would you like to use?`).
- CLI writes `export { cn } from "cn"` instead of a `clsx`+`tailwind-merge` helper; installs `cn`, `radix-ui` (umbrella), `shadcn` itself, Geist, `lucide-react`.
- CLI injects `shadcn/tailwind.css`, OKLCH `:root`/`.dark`, and `@layer base` into `src/index.css` (restored; bridge rebuilt).
- Bare `npm run test:a11y` in DEV fails on Agentation (`styles-module__controlButton___8Q0jc` button-name). `CI=1` preview is the real gate (14 passed).
- Generated `destructive` is no longer `text-white` on solid red.
- `npm run verify` is 1 only because of the two spike portal findings (B4). Electron bytes required a separate `build:electron` after verify stopped at web.

## 12. Install sequence for plan 003

1. `git apply --3way docs/planning/shadcn-spike.patch`
2. `npm install` (add `--legacy-peer-deps` only if §10 says so)
3. `npm run verify:static && npm run build:web`
   The patch contains: package.json/lock, tsconfig, vite and vitest aliases, components.json,
   .eslintrc.cjs override, src/index.css bridge, src/lib/utils.ts, src/components/ui/{button,dialog,tooltip}.tsx,
   playground registration. It does NOT contain the scaffold, the spike spec, the jsdom probe or
   screenshots. Re-run `npx shadcn@4.21.0 add <name> -y` only for new primitives.
