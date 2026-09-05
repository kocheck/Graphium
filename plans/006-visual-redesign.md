# Plan 006: Redesign the visual language and information architecture

> **Executor instructions**: Read `plans/CONVENTIONS.md` first. Run the pre-flight (§3), then the
> Drift check below. Follow the steps in order; each step's **Check** must hold before the next.
> If any **If it fails** or STOP condition fires, follow CONVENTIONS §10. Finish with the report
> in §11.

This plan is two plans in one file. **006a** (Steps 0–4) audits, renders three directions from the
design brief, collects Kyle's decisions as decision files, and rewrites Steps 5+. **006b** (Steps
5+) applies the chosen direction. 006a runs before plan 004 finishes; 006b runs after plans 004 and
005 merge. Every design statement this plan acts on comes from
`docs/planning/ui-redesign-brief.md` (the brief). The executor renders the brief; it never
invents.

## Status

- **Priority**: P1 (006a), P2 (006b)
- **Effort**: M (006a), L (006b)
- **Risk**: LOW (006a), MED (006b)
- **Depends on**: 006a: plans 000, 001, 003. 006b: plans 004, 005, 006a.
- **Category**: design
- **Requires** (006a, before Step 0): `scripts/preflight.sh`, `src/components/ui/README.md`,
  `docs/planning/verification-baseline.md`, `tests/helpers/surfaces.ts`, `tests/shots.spec.ts`,
  `tests/touch-targets.spec.ts`, `docs/planning/ui-redesign-brief.md`.
- **Requires** (006b, before Step 5): `docs/planning/ui-redesign-ideas.md`,
  `docs/planning/decisions/006-direction.md` with `Status: DECIDED`,
  `docs/planning/decisions/006-ia.md` with `Status: DECIDED`, `tests/performance/profile.spec.ts`
  (plan 005), and a line `Reviewed-by: Kyle <date>` as the first line after
  `<!-- steps-5-plus:start -->` in this file.
- **Grounded at** (006a): ‹merge SHA of plan 003, written there by its final step› (citations
  verified at d3d3642)
- **Grounded at** (006b): ‹merge SHA of plan 005, written there by its final step› (citations
  re-verified by 006a Step 4)

## Drift check

```bash
git fetch origin main
git diff --stat <grounded-at>..origin/main -- src/styles/theme.css src/styles/fonts.css \
  src/index.css src/components/DesignSystemPlayground tests/accessibility.spec.ts \
  tests/helpers/surfaces.ts docs/features/wcag-audit.md docs/planning/ui-redesign-brief.md \
  docs/planning/decisions     # Expected: empty
```

Plan 004's PRs may merge into `main` while 006a runs; they do not touch the paths above. Any
difference is drift: STOP.

**Citation re-check** (run each; "If any row differs: STOP."):

| Anchor (grep)                                                                                                  | File                                                            | Expected hits |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------- |
| `grep -n "prefers-reduced-motion" src/styles/theme.css`                                                        | `src/styles/theme.css`                                          | 1 (line 303)  |
| `grep -c "^@import '@radix-ui/colors/" src/styles/theme.css`                                                   | `src/styles/theme.css`                                          | 14            |
| `grep -c "app-accent-solid-text" src/styles/theme.css`                                                         | `src/styles/theme.css`                                          | 2             |
| `grep -n "import { componentExamples, categories } from './playground-registry'" src/components/DesignSystemPlayground/DesignSystemPlayground.tsx` | `DesignSystemPlayground.tsx` | 1 (line 30)   |
| `grep -n "{/\* Theme Toggle \*/}" src/components/DesignSystemPlayground/DesignSystemPlayground.tsx`          | `DesignSystemPlayground.tsx`                                    | 1 (line 173)  |
| `grep -n "'/design-system'" src/App.tsx`                                                                       | `src/App.tsx`                                                   | 1 (line 123)  |
| `grep -n "'performance';" src/components/DesignSystemPlayground/types.ts`                                      | `types.ts`                                                      | 1 (line 22)   |
| `grep -n "#### Text on Background Combinations" docs/features/wcag-audit.md`                                   | `docs/features/wcag-audit.md`                                   | 1 (line 30)   |
| `grep -c "^export async function gotoSurface" tests/helpers/surfaces.ts`                                       | `tests/helpers/surfaces.ts` (plan 000)                          | 1             |
| `grep -c "import AxeBuilder from '@axe-core/playwright'" tests/accessibility.spec.ts`                          | `tests/accessibility.spec.ts`                                   | 1             |

## Why this matters

Kyle's framing was that the UI is "stale". Plans 000–005 make the UI cheap to change; they do not
change how it looks. The brief §1 diagnoses "stale" as the interface not saying what `README.md`
says ("Tactile Cartography", "funicular friction", "permanent etching";
`grep -n "funicular\|permanent etching\|slippery" README.md`, lines 32–48 at d3d3642) and gives
six statements, five mood words, a reference list, anti-references, World View rules, a rubric
and three named directions. After the earlier plans, one token change reaches every primitive;
this plan spends that.

## Context the executor needs

- **Tokens.** At d3d3642 `src/styles/theme.css` (308 lines) defines 43 `--app-*` colour tokens
  (`grep -oE "^\s*--app-[a-z0-9-]+" src/styles/theme.css | sort -u | wc -l` → 43), all colours,
  including `--app-shadow-sm|md|lg` which are shadow *colours*. Plan 000 adds the `radius`,
  `elevation`, `duration`, `ease`, `space`, `font-size` and `font-weight` families; their exact
  role names are read with a grep in Step 2a, never assumed.
- **Radix scales in the browser.** `theme.css` imports 14 Radix CSS files (slate, blue, red, amber,
  green and alphas). Radix's `-dark.css` files use a `.dark` class selector that Graphium never
  sets; `theme.css` copies the dark values under `[data-theme='dark']`
  (`grep -n "This copies the dark mode variables" src/styles/theme.css`, line 56). Any new scale
  needs the same copy.
- **Palette classes.** `grep -rhoE "\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange|yellow|purple|indigo)(-[0-9]{2,3})?\b" src --include=*.tsx | wc -l`
  → 400 at d3d3642; 396 after plan 000 deletes `PreferencesDialog.tsx` (4 hits). `dark:` variants:
  `grep -rc "dark:" src --include=*.tsx | awk -F: '{s+=$2} END {print s}'` → 0. Literal colours:
  `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(" src/components/ src/App.tsx src/index.css src/styles/app.css src/styles/fonts.css | wc -l`
  → 151 at d3d3642 (`.btn-tool` in `src/styles/app.css` line 54 is `rgb(64, 64, 64)`).
- **Playground.** `/design-system` renders `src/components/DesignSystemPlayground/` (one registry
  file `playground-registry.tsx`, 12 categories in `types.ts`). Reached only in the web build.
- **Surfaces.** `tests/helpers/surfaces.ts` (plan 000) navigates to `home`, `editor`,
  `editor-mobile`, `confirm-dialog`, `world`, `world-dialog`, `design-system` and sets the theme.
  The `world` surfaces are broadcast-fed, so screenshots of them are not blank.
- **Gates that already exist.** `tests/touch-targets.spec.ts` (48 px mobile menu, 44 px inspector
  and home, 56 px mobile toolbar), `tests/visual.spec.ts` with committed baselines,
  `tests/accessibility.spec.ts` with a `CONTRAST_DEFERRED` surface list that 006b empties.
- **Known contrast debts** (deferred to 006b by plan 000): white on `--app-error-solid` (`red-9`,
  `#e5484d`) is below 4.5:1, and `docs/features/wcag-audit.md` line 47 wrongly marks it ✅.
- **Settings surfaces are two**, not three: `src/components/MapSettingsSheet.tsx` (461 lines) and
  `src/components/SessionConsole/SessionConsoleSettingsSheet.tsx` (plus
  `sessionConsoleSettingsSections.tsx`). `PreferencesDialog.tsx` is deleted by plan 000.
- **Sidebars are three**: `Sidebar.tsx` (477 lines), `QuickTokenSidebar.tsx` (165),
  `MobileSidebarDrawer.tsx` (91). Home screen: `HomeScreen.tsx`, 1,792 lines (`wc -l`).
- **Toolbar** is `src/App.tsx` (`grep -n 'className="toolbar fixed bottom-4' src/App.tsx`, line
  556) until plan 004 Step 10 extracts `src/components/Toolbar.tsx`; grep both.
- **Reduced motion**: `theme.css` lines 303–308 set `transition: none !important; animation: none
  !important` on `*`. Step 2a adds token zeroing beside it; only 006b may remove the `*` rule.
- **World View** is `?type=world` (`grep -n "type=world" src/utils/useWindowType.ts`, line 9).
- **Fonts**: `src/styles/fonts.css` (139 lines) declares IBM Plex Sans 400–700 and Plex Mono from
  `@ibm/plex`. No Plex Serif face exists; direction C adds one in `directions.css`.

## Inputs & resources

Read first: the brief, `README.md` lines 16–56, `src/components/ui/README.md`,
`docs/planning/verification-baseline.md`, `docs/features/wcag-audit.md`, `.ai-rules.md`.

Gates: `plans/CONVENTIONS.md` §4. Commands specific to this plan:

| Purpose                     | Command                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Contrast, base theme        | `npm run contrast` (Step 2b adds it)                                                                    |
| Contrast, one direction     | `npm run contrast -- --direction a`                                                                     |
| Regenerate wcag-audit table | `npm run contrast -- --write`                                                                           |
| Audit measurements          | `npm run build:web && AUDIT_OUT=docs/planning/ui-redesign-audit.json CI=1 npx playwright test tests/audit-measure.spec.ts --project=Web-Chromium` |
| Direction screenshots       | `npm run build:web && SHOTS_OUT=docs/planning/screenshots/006a-step2 CI=1 npx playwright test tests/direction-shots.spec.ts --project=Web-Chromium` |
| Plan lint                   | `bash scripts/plan-lint.sh plans/006-visual-redesign.md`                                                |

## Scope

**In scope (006a)**: `src/styles/directions.css`, `src/styles/directions.test.ts`,
`src/styles/theme.css` (reduced-motion block only), `src/components/DesignSystemPlayground/**`,
`scripts/contrast.mjs`, `scripts/contrast-pairs.json`, `scripts/plan-lint.sh`, `package.json`
(one script), `tests/audit-measure.spec.ts`, `tests/direction-shots.spec.ts`,
`tests/accessibility.spec.ts` (append only), `docs/features/wcag-audit.md` (markers),
`docs/planning/ui-redesign-audit.md`, `docs/planning/ui-redesign-audit.json`,
`docs/planning/ui-redesign-ideas.md`, `docs/planning/screenshots/006a-*/**`,
`docs/planning/decisions/006-*.md`, this file.

**In scope (006b)**: `src/styles/theme.css`, `src/styles/fonts.css`, `src/index.css`,
`src/styles/app.css`, `src/components/ui/**`, `src/App.tsx`, `src/components/Toolbar.tsx`, the
screens named in `006-ia.md`, `tests/world-legibility.spec.ts`, `tests/visual.spec.ts`
baselines, `tests/accessibility.spec.ts`, `scripts/contrast-pairs.json`,
`docs/features/wcag-audit.md`, `docs/features/theming.md`, `README.md` (images only),
`public/screenshots/`, `.github/workflows/deploy-web.yml`, `CHANGELOG.md`, `plans/reports/`.

**Out of scope**: new features; renaming or removing any `data-testid`; `src/components/Canvas/**`
rendering logic (grid *colour* via `--app-grid-color` is in scope); the `CommandPalette`;
`ErrorFallbackUI.tsx` and `UpdateErrorFallbackUI.tsx` (hand-rolled by design); any new World View
chrome without a decision file; any Figma or MCP tooling (the executor is headless).

## Landing

Branch, commits, PR, CI and rollback: `plans/CONVENTIONS.md` §7. Branch names:
`plan/006a-design-direction` and `plan/006b-apply-redesign`.

006a lands as one PR that is opened at the first STOP (end of Step 2b, BLOCKED on
`006-direction`) and updated by later runs: run 2 executes Step 3 (BLOCKED on `006-ia`), run 3
executes Step 4. Each run writes its own `## Run N` section into `plans/reports/006a.md`. 006b
branches from `main` after plan 005 merges and may be split into further PRs at the seams Step 4
marks (`PR boundary` lines).

---

## Steps — 006a

### Step 0: Confirm the brief is answered

**Files**: `docs/planning/decisions/006-brief-unanswered.md` (only if the check fails)
**Do**: Nothing to edit when the checks pass. If either check fails, create the decision file
below and STOP.

```markdown
# Decision 006-brief-unanswered: Has Kyle confirmed docs/planning/ui-redesign-brief.md?

Status: PENDING

## Question

Plan 006a renders the brief and cannot start until every line under "## 11. Kyle's answers" is
filled and the Status line reads `CONFIRMED <date>`. Which lines are still blank is listed here:
<paste `grep -n "____" docs/planning/ui-redesign-brief.md`>.

## Options

1. Kyle fills the blanks and sets `Status: CONFIRMED <date>` — 006a proceeds unchanged.
2. Kyle strikes sections — 006a proceeds; struck rows of §10 are not rendered.

## Recommendation

Option 1; the brief was drafted for confirmation, not for redesign.

## Kyle's answer

```

**Do NOT**: Edit the brief. Fill any blank yourself. Start Step 1 with a `DRAFTED` brief.
**Commands**:

```bash
grep -c "____" docs/planning/ui-redesign-brief.md
grep -n "^Status: CONFIRMED" docs/planning/ui-redesign-brief.md
```

**Expected**: `0` (exit 1, because grep -c prints 0 and exits 1 on no match), then one line.
**Check**: `grep -c "____" docs/planning/ui-redesign-brief.md` prints `0` and
`grep -c "^Status: CONFIRMED" docs/planning/ui-redesign-brief.md` prints `1`.
**If it fails**: Create the decision file, commit it, STOP (CONVENTIONS §9).
**Commit**: `plan-006a step-0: confirm the brief` (only when the decision file was created)

### Step 1: Measure the interface and write the audit

**Files**: `tests/audit-measure.spec.ts`, `docs/planning/ui-redesign-audit.json`,
`docs/planning/ui-redesign-audit.md`, `docs/planning/screenshots/006a-baseline/**`,
`docs/planning/ui-redesign-ideas.md` (create only if absent),
`docs/planning/decisions/006-reference-shots.md` (only if reference shots are missing)
**Do**:

1. Screenshots: `SHOTS_OUT=docs/planning/screenshots/006a-baseline npm run shots` (seven surfaces
   × two themes = 14 files named `<surface>-<theme>.png`).
2. Reference set (brief §6). Kyle drops eleven files into
   `docs/planning/screenshots/006a-baseline/reference/` before this step: `foundry-landing.png`,
   `foundry-editor.png`, `foundry-player.png`, `owlbear-landing.png`, `owlbear-editor.png`,
   `owlbear-player.png`, `roll20-landing.png`, `roll20-editor.png`, `roll20-player.png`,
   `op1-grid.png`, `amber-crt.png`. If any is missing, write the audit without it and create
   `docs/planning/decisions/006-reference-shots.md` (CONVENTIONS §9 shape; Question: "Which of
   the eleven reference files are still needed?"; Options: 1. Kyle adds them, 2. Kyle waives them;
   Recommendation: 1). Do not STOP for this.
3. Create `tests/audit-measure.spec.ts` exactly:

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { test } from '@playwright/test';

import { gotoSurface } from './helpers/surfaces';

// Plan 006a Step 1. Dumps computed styles and resolved --app-* tokens per surface and theme.
// Runs only when AUDIT_OUT names the output file (same pattern as SHOTS_OUT for shots.spec.ts).
const out = process.env.AUDIT_OUT;
test.skip(!out, 'AUDIT_OUT not set: this spec only runs when an audit dump is requested');

const SURFACES = [
  'home',
  'editor',
  'editor-mobile',
  'confirm-dialog',
  'world',
  'world-dialog',
  'design-system',
] as const;
const THEMES = ['light', 'dark'] as const;
const SELECTORS = [
  'body',
  'h1',
  'button',
  'input',
  '.toolbar',
  '.btn-tool',
  '[role="dialog"]',
  '[data-testid="editor-view"]',
  '[data-testid="session-console-panel"]',
  '[data-testid="playground-readout"]',
] as const;
const PROPS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'padding',
  'borderRadius',
  'borderWidth',
  'boxShadow',
  'backgroundColor',
  'color',
] as const;

interface SelectorSample {
  selector: string;
  found: boolean;
  styles: Record<string, string>;
}

interface SurfaceSample {
  surface: string;
  theme: string;
  tokens: Record<string, string>;
  selectors: SelectorSample[];
}

const tokenNames = Array.from(
  new Set(readFileSync('src/styles/theme.css', 'utf8').match(/--app-[a-z0-9-]+/g) ?? []),
).sort();

test('audit: measure every surface in both themes', async ({ page }) => {
  test.setTimeout(180_000);
  const samples: SurfaceSample[] = [];
  for (const surface of SURFACES) {
    for (const theme of THEMES) {
      await gotoSurface(page, surface, theme);
      const sample = await page.evaluate(
        ({ names, selectors, props }) => {
          const root = getComputedStyle(document.documentElement);
          const tokens: Record<string, string> = {};
          for (const name of names) tokens[name] = root.getPropertyValue(name).trim();
          const results = selectors.map((selector) => {
            const el = document.querySelector(selector);
            const styles: Record<string, string> = {};
            if (el) {
              const cs = getComputedStyle(el);
              for (const prop of props) styles[prop] = cs[prop as keyof CSSStyleDeclaration] as string;
            }
            return { selector, found: el !== null, styles };
          });
          return { tokens, selectors: results };
        },
        { names: tokenNames, selectors: [...SELECTORS], props: [...PROPS] },
      );
      samples.push({ surface, theme, ...sample });
    }
  }
  mkdirSync(path.dirname(out as string), { recursive: true });
  writeFileSync(out as string, JSON.stringify({ generatedAt: new Date().toISOString(), samples }, null, 2));
});
```

4. Run it (command in Inputs & resources). Commit the JSON.
5. If `docs/planning/ui-redesign-ideas.md` does not exist, create it with the single heading
   `## From plan 006 audit` (plan 004 Step 14 appends its own section later; it must not
   overwrite).
6. Write `docs/planning/ui-redesign-audit.md` with, in this order: a `## Counts` list giving the
   palette-class count, the `dark:` count and the literal-colour count, each with the exact command
   from "Context the executor needs" and its output; then **seven** sections (one per surface,
   heading `## Surface: <name>`), each containing one line `Nearest: <reference>. Move toward:
   <reference>.` (references are brief §4/§6 names; for surfaces with no reference shot write
   `Nearest: none.`) and one table with exactly these columns and exactly six rows (`Typography`,
   `Colour`, `Density`, `Motion`, `Iconography`, `Depth`):

   `| Axis | Measured (dark) | Measured (light) | Brief line | Gap |`

   "Measured" cells hold literal values copied from the JSON (`fontFamily`, `fontSize`,
   `fontWeight` for Typography; `--app-accent-solid` and `--app-bg-surface` for Colour;
   `padding` and `lineHeight` of `button` for Density; `borderRadius` and `boxShadow` of the
   toolbar or dialog for Depth) or from greps (Motion: `grep -c "transition" <surface file>`;
   Iconography: `grep -c "@remixicon/react" <surface file>`). "Brief line" quotes the §2 statement
   number, e.g. `§2.3`. "Gap" starts with `brief:` when the measured value contradicts the quoted
   line, or `inconsistency:` when it differs from the same axis on another surface.
   Finish with one line: `Conclusion: identity gap` if `grep -c "| brief:"` is ≥ 21, else
   `Conclusion: inconsistency`. Append the deferred ideas as bullets under
   `## From plan 006 audit` in `docs/planning/ui-redesign-ideas.md`.

**Do NOT**: Write adjectives in a "Measured" cell. Change any `src/` file. Annotate screenshots.
Change Step 2's direction set because of the conclusion (the brief fixed it); the conclusion only
weights Step 3's seventh question.
**Commands**:

```bash
SHOTS_OUT=docs/planning/screenshots/006a-baseline npm run shots
npm run build:web && AUDIT_OUT=docs/planning/ui-redesign-audit.json CI=1 npx playwright test tests/audit-measure.spec.ts --project=Web-Chromium
ls docs/planning/screenshots/006a-baseline/*.png | wc -l
grep -c "^| " docs/planning/ui-redesign-audit.md
grep -c "^Nearest: " docs/planning/ui-redesign-audit.md
grep -c "^Conclusion: " docs/planning/ui-redesign-audit.md
npm run verify:static && npm run verify:web
```

**Expected**: exit 0; exit 0; `14`; `56`; `7`; `1`; exit 0.
**Check**: `grep -c "^| " docs/planning/ui-redesign-audit.md` prints `56` and
`node -e "const j=require('./docs/planning/ui-redesign-audit.json');process.exit(j.samples.length===14?0:1)"`
exits 0.
**If it fails**: If `gotoSurface` cannot reach a surface, STOP with the surface name and the
Playwright error (plan 000's helper is the fix, not this spec). Otherwise fix the doc and retry
once.
**Commit**: `plan-006a step-1: measure the interface and write the audit`

### Step 2a: Render the three directions on the playground

**Files**: `src/styles/directions.css`, `src/styles/directions.test.ts`,
`src/styles/theme.css`, `src/components/DesignSystemPlayground/DesignSystemPlayground.tsx`,
`src/components/DesignSystemPlayground/playground-registry.tsx`,
`src/components/DesignSystemPlayground/types.ts`
**Do**:

1. Read the non-colour token names plan 000 created:

```bash
grep -oE "^\s*--app-(radius|elevation|duration|ease)-[a-z0-9-]+" src/styles/theme.css | tr -d ' ' | sort -u
```

2. Create `src/styles/directions.css`. The direction-A block below is copy-exact; B and C are
   derived from it by the rules that follow. Values are **seeded** from the brief §10 table (Radix
   `amber-9` `#ffc53d`, `tomato-9` `#e54d2e`, `orange-9` `#f76b15`, slate steps); Step 2b's
   contrast script validates every pair and is the authority.

```css
/* src/styles/directions.css — plan 006a Step 2a. Prototype only: imported by the playground
   and deleted by plan 006b Step 5. Each block overrides --app-* tokens under [data-direction]. */
@import '@radix-ui/colors/tomato.css';
@import '@radix-ui/colors/tomato-dark.css';
@import '@radix-ui/colors/orange.css';
@import '@radix-ui/colors/orange-dark.css';
@import '@radix-ui/colors/sand.css';
@import '@radix-ui/colors/sand-dark.css';

/* IBM Plex Serif (direction C titles only). Path mirrors src/styles/fonts.css. */
@font-face {
  font-family: 'IBM Plex Serif';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('@ibm/plex/IBM-Plex-Serif/fonts/complete/woff2/IBMPlexSerif-SemiBold.woff2')
    format('woff2');
}

/* ---- A · Instrument panel (brief §10 row A) ------------------------------------------
   amber-9 (#ffc53d) on slate-1; 1 px slate-6 rules; no radius above 4 px; recessed (inset)
   active states; Plex Sans labels, Plex Mono readouts. Seeded; validated by npm run contrast. */
[data-direction='a'] {
  --app-bg-base: var(--slate-1);
  --app-bg-subtle: var(--slate-2);
  --app-bg-surface: var(--slate-3);
  --app-bg-hover: var(--slate-4);
  --app-bg-active: var(--slate-5);
  --app-border-subtle: var(--slate-6);
  --app-border-default: var(--slate-6);
  --app-border-hover: var(--slate-8);
  --app-text-primary: var(--slate-12);
  --app-text-secondary: var(--slate-11);
  --app-text-muted: var(--slate-11);
  --app-text-disabled: var(--slate-9);
  --app-accent-bg: var(--amber-3);
  --app-accent-bg-hover: var(--amber-4);
  --app-accent-bg-active: var(--amber-5);
  --app-accent-text: var(--amber-11);
  --app-accent-text-contrast: var(--amber-12);
  --app-accent-solid: var(--amber-9);
  --app-accent-solid-hover: var(--amber-10);
  --app-accent-solid-text: var(--slate-12);
  --app-shadow-sm: transparent;
  --app-shadow-md: transparent;
  --app-shadow-lg: transparent;
  --app-elevation-active: inset 0 0 0 1px var(--slate-8);
  --app-font-family-title: 'IBM Plex Sans', system-ui, sans-serif;
  --app-font-family-readout: 'IBM Plex Mono', ui-monospace, monospace;
  --app-font-size-readout: 13px;
  --app-font-weight-readout: 500;
  /* NON-COLOUR: add one line per name printed by the grep in Do 1 —
     --app-radius-*: 4px   (skip names whose base value is 9999px or 50%)
     --app-elevation-*: 0 0 0 1px var(--slate-6)   (except --app-elevation-active above) */
}

[data-theme='dark'][data-direction='a'] {
  --app-accent-solid-text: var(--slate-1);
}

/* Shared by every direction (brief §2.5): fast, decisive, no overshoot. Add one line per
   --app-duration-* name (120ms) and per --app-ease-* name (cubic-bezier(0.2, 0, 0, 1)). */
[data-direction] {
}
```

   Then append, in this order:

   - `[data-direction='b']` and `[data-theme='dark'][data-direction='b']` — **B · Etched plate**:
     copy the A blocks, change every `amber` to `tomato`; in the light block set
     `--app-accent-solid: var(--tomato-11); --app-accent-solid-hover: var(--tomato-12);
     --app-accent-solid-text: white;` (white on `tomato-9` is below 4.5:1); in the dark block set
     `--app-accent-solid: var(--tomato-9); --app-accent-solid-hover: var(--tomato-10);
     --app-accent-solid-text: var(--slate-1);`. Surfaces are continuous dark stock:
     `--app-bg-surface: var(--slate-2); --app-bg-hover: var(--slate-3); --app-bg-active:
     var(--slate-4); --app-border-subtle: var(--slate-4); --app-border-default: var(--slate-5);`.
     Depth is engraved: `--app-elevation-active: inset 0 1px 0 0 var(--slate-1), inset 0 -1px 0 0
     var(--slate-7);`. Type: `--app-font-family-readout: 'IBM Plex Sans', system-ui, sans-serif;
     --app-font-size-readout: 15px; --app-font-weight-readout: 600;`. Radius lines: `2px`.
   - `[data-direction='c']` and `[data-theme='dark'][data-direction='c']` — **C · Cartographer's
     desk**: copy the A blocks, change every `amber` to `orange` and every `slate` to `sand` (warm
     greys; the light theme becomes paper stock). Depth is flat with a pressed state:
     `--app-elevation-active: inset 0 1px 0 0 var(--sand-7);` and no `--app-elevation-*` or
     `--app-radius-*` lines (base values stay). Type: `--app-font-family-title: 'IBM Plex Serif',
     Georgia, serif;`.
   - Dark values for the three new scales (Radix's `.dark` selector never matches; see Context):

```bash
for s in tomato orange sand; do
  sed -n '1,/^}/p' "node_modules/@radix-ui/colors/$s-dark.css" \
    | sed "s/^\.dark, \.dark-theme {/[data-theme='dark'] {/" >> src/styles/directions.css
done
grep -c "^\[data-theme='dark'\] {" src/styles/directions.css   # Expected: 3
```

3. In `src/styles/theme.css`, inside the existing `@media (prefers-reduced-motion: reduce)` block
   (line 303), add before the `* {` rule a `:root {` rule that sets every `--app-duration-*` name
   from the grep in Do 1 to `0ms`. Keep the `* { transition: none !important; … }` rule; 006b
   removes it once no literal duration remains.
4. `types.ts`: add `| 'motion'` after `| 'performance'` in the `category` union.
5. `playground-registry.tsx`: append `{ id: 'motion', name: 'Motion', description: 'Duration and
   easing tokens, with the reduced-motion twin' }` to `categories`, and append two examples to
   `componentExamples` (the `code` string of each is the same JSX as a template literal):

```tsx
  {
    id: 'readout',
    name: 'Readout',
    category: 'typography',
    description: 'Numeric readout in the direction readout face (brief §2.1, §2.4)',
    component: (
      <div
        data-testid="playground-readout"
        className="inline-flex items-baseline gap-3 px-3 py-2 border border-[var(--app-border-default)] bg-[var(--app-bg-surface)] text-[var(--app-text-primary)]"
        style={{
          fontFamily: 'var(--app-font-family-readout, "IBM Plex Mono", monospace)',
          fontSize: 'var(--app-font-size-readout, 13px)',
          fontWeight: 'var(--app-font-weight-readout, 500)' as React.CSSProperties['fontWeight'],
        }}
      >
        <span>GRID 70 px</span>
        <span>1,024 tokens</span>
        <span>02:14:09</span>
      </div>
    ),
    code: `<div data-testid="playground-readout" style={{ fontFamily: 'var(--app-font-family-readout)' }}>…</div>`,
    tags: ['readout', 'mono', 'numeral'],
  },
  {
    id: 'motion-press',
    name: 'Press',
    category: 'motion',
    description: 'Active state animates with --app-duration-fast / --app-ease-standard; zero under prefers-reduced-motion',
    component: (
      <button
        type="button"
        data-testid="playground-motion-press"
        className="px-4 py-2 border border-[var(--app-border-default)] bg-[var(--app-bg-surface)] text-[var(--app-text-primary)] active:bg-[var(--app-bg-active)] active:[box-shadow:var(--app-elevation-active,none)]"
        style={{
          transition: 'background-color var(--app-duration-fast, 120ms) var(--app-ease-standard, ease-out), box-shadow var(--app-duration-fast, 120ms) var(--app-ease-standard, ease-out)',
        }}
      >
        Press and hold
      </button>
    ),
    code: `<button style={{ transition: 'background-color var(--app-duration-fast) var(--app-ease-standard)' }}>Press and hold</button>`,
    tags: ['motion', 'duration', 'easing', 'reduced-motion'],
  },
```

   The tile names `--app-duration-fast` and `--app-ease-standard`. If the grep in Do 1 does not
   print those exact names, replace them (in both the `style` and the `code` string) with the
   first `--app-duration-*` and first `--app-ease-*` names it prints. `types.ts` imports
   `React` as a type already; the registry needs `import type React from 'react';` added to its
   type imports for `React.CSSProperties`.
6. `DesignSystemPlayground.tsx`: add `import '../../styles/directions.css';` as the last
   non-type import; add the constants and helper below the existing imports (before
   `PlaygroundShell`), the state and effect inside `PlaygroundContent` after the
   `handleToggleTheme` function, and the button row immediately before the `{/* Theme Toggle */}`
   comment (line 173):

```tsx
const DIRECTIONS = ['none', 'a', 'b', 'c'] as const;
type Direction = (typeof DIRECTIONS)[number];
const DIRECTION_KEY = 'graphium-direction';

function readDirection(): Direction {
  try {
    const stored = window.localStorage.getItem(DIRECTION_KEY);
    return DIRECTIONS.includes(stored as Direction) ? (stored as Direction) : 'none';
  } catch {
    return 'none';
  }
}
```

```tsx
  const [direction, setDirection] = useState<Direction>(readDirection);

  useEffect(() => {
    if (direction === 'none') {
      delete document.documentElement.dataset.direction;
    } else {
      document.documentElement.dataset.direction = direction;
    }
    try {
      window.localStorage.setItem(DIRECTION_KEY, direction);
    } catch {
      // Storage may be unavailable (private mode); the attribute still applies.
    }
    return () => {
      delete document.documentElement.dataset.direction;
    };
  }, [direction]);
```

```tsx
              {/* Direction switcher (plan 006a): prototypes from docs/planning/ui-redesign-brief.md §10 */}
              <div className="flex items-center gap-1" role="group" aria-label="Design direction">
                {DIRECTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    data-testid={`playground-direction-${d}`}
                    aria-pressed={direction === d}
                    onClick={() => setDirection(d)}
                    className={`px-2 py-1 text-xs font-mono uppercase rounded border border-[var(--app-border-subtle)] ${
                      direction === d
                        ? 'bg-[var(--app-accent-solid)] text-[var(--app-accent-solid-text)]'
                        : 'bg-[var(--app-bg-surface)] text-[var(--app-text-secondary)]'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
```

7. Create `src/styles/directions.test.ts` exactly (the brief §10 distinctness rule as a test):

```ts
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./directions.css', import.meta.url), 'utf8');
const DIRECTIONS = ['a', 'b', 'c'] as const;
type Direction = (typeof DIRECTIONS)[number];

function block(direction: Direction): string {
  const match = css.match(new RegExp(`^\\[data-direction='${direction}'\\]\\s*\\{([^}]*)\\}`, 'm'));
  if (!match) throw new Error(`no [data-direction='${direction}'] block`);
  return match[1] as string;
}

function token(direction: Direction, name: string): string {
  const match = block(direction).match(new RegExp(`--app-${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`--app-${name} missing in direction ${direction}`);
  return (match[1] as string).trim();
}

describe('directions.css (brief §10: distinct = accent differs AND depth or type differs)', () => {
  const pairs: Array<[Direction, Direction]> = [
    ['a', 'b'],
    ['a', 'c'],
    ['b', 'c'],
  ];
  it.each(pairs)('%s and %s are distinct', (x, y) => {
    expect(token(x, 'accent-solid')).not.toBe(token(y, 'accent-solid'));
    const depthOrTypeDiffers =
      token(x, 'elevation-active') !== token(y, 'elevation-active') ||
      token(x, 'font-family-readout') !== token(y, 'font-family-readout') ||
      token(x, 'font-family-title') !== token(y, 'font-family-title');
    expect(depthOrTypeDiffers).toBe(true);
  });
  it.each(DIRECTIONS)('%s keeps chrome on a grey scale (brief §9 row 4)', (d) => {
    const chrome = block(d).match(/--app-(bg|border)-[a-z-]+:\s*([^;]+);/g) ?? [];
    expect(chrome.length).toBeGreaterThan(0);
    for (const line of chrome) expect(line).toMatch(/var\(--(slate|sand)-\d+\)/);
  });
  it.each(DIRECTIONS)('%s readouts meet brief §9 row 2 size and weight', (d) => {
    expect(parseFloat(token(d, 'font-size-readout'))).toBeGreaterThanOrEqual(13);
    expect(parseInt(token(d, 'font-weight-readout'), 10)).toBeGreaterThanOrEqual(500);
  });
});
```

**Do NOT**: Import `directions.css` anywhere but `DesignSystemPlayground.tsx`. Change any
existing `--app-*` value in `theme.css` (only the reduced-motion block changes). Remove the `* {
transition: none !important }` rule. Add a fourth direction or a hybrid. Touch any screen outside
the playground. Use a branch per direction.
**Commands**:

```bash
ls node_modules/@ibm/plex/IBM-Plex-Serif/fonts/complete/woff2/IBMPlexSerif-SemiBold.woff2
grep -c "^\[data-direction='[abc]'\] {" src/styles/directions.css
grep -rln "directions.css" src
npm run verify:static && npm run verify:web
```

**Expected**: the path; `3`; exactly
`src/components/DesignSystemPlayground/DesignSystemPlayground.tsx`; exit 0.
**Check**: `npx vitest run src/styles/directions.test.ts` exits 0 and
`grep -rln "directions.css" src` prints exactly one path.
**If it fails**: If the Plex Serif file is missing, STOP with the `ls` output (the `@ibm/plex`
version differs from d3d3642). Otherwise fix and retry once.
**Commit**: `plan-006a step-2a: render the three directions on the playground`

### Step 2b: Prove contrast, screenshot the directions, raise the direction decision

**Files**: `scripts/contrast.mjs`, `scripts/contrast-pairs.json`, `package.json`,
`docs/features/wcag-audit.md`, `tests/accessibility.spec.ts`, `tests/direction-shots.spec.ts`,
`docs/planning/screenshots/006a-step2/**`, `docs/planning/decisions/006-direction.md`
**Do**:

1. Create `scripts/contrast.mjs` exactly:

```js
#!/usr/bin/env node
// scripts/contrast.mjs — WCAG 2.1 contrast for --app-* token pairs (plan 006a Step 2b).
// Usage: node scripts/contrast.mjs [--direction a|b|c] [--write]
//   --direction  also apply src/styles/directions.css blocks for that direction
//   --write      regenerate the table in docs/features/wcag-audit.md between the markers
// Exit 1 when any pair without a "deferred" key is below its "min" ratio or cannot be resolved.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const THEME = 'src/styles/theme.css';
const DIRECTIONS = 'src/styles/directions.css';
const PAIRS = 'scripts/contrast-pairs.json';
const AUDIT = 'docs/features/wcag-audit.md';
const RADIX = 'node_modules/@radix-ui/colors';
const START = '<!-- contrast:start -->';
const END = '<!-- contrast:end -->';

const args = process.argv.slice(2);
const dirIdx = args.indexOf('--direction');
const direction = dirIdx === -1 ? null : args[dirIdx + 1];
const write = args.includes('--write');

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Top-level `selector { body }` blocks; every @-rule (imports, media, supports) is skipped. */
function blocks(css) {
  const out = [];
  let i = 0;
  for (;;) {
    const open = css.indexOf('{', i);
    if (open === -1) return out;
    const selector = css.slice(i, open).trim().split(';').pop().trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth += 1;
      if (css[j] === '}') depth -= 1;
      j += 1;
    }
    if (!selector.startsWith('@')) out.push({ selector, body: css.slice(open + 1, j - 1) });
    i = j;
  }
}

function apply(body, maps) {
  for (const m of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    for (const map of maps) map[m[1]] = m[2].trim();
  }
}

const isDark = (selector) => /dark/.test(selector);
const mentionsDirection = (selector) => /data-direction/.test(selector);
const hasDirection = (selector, d) => new RegExp(`data-direction=['"]${d}['"]`).test(selector);

function loadRadix(css, light, dark) {
  for (const m of css.matchAll(/@import\s+'@radix-ui\/colors\/([a-z-]+)\.css';/g)) {
    const file = path.join(RADIX, `${m[1]}.css`);
    const maps = m[1].includes('-dark') ? [dark] : [light, dark];
    for (const b of blocks(stripComments(readFileSync(file, 'utf8')))) apply(b.body, maps);
  }
}

function loadTheme(css, light, dark, keep) {
  loadRadix(css, light, dark);
  for (const b of blocks(css)) {
    if (!keep(b.selector)) continue;
    apply(b.body, isDark(b.selector) ? [dark] : [light, dark]);
  }
}

const light = {};
const dark = {};
loadTheme(stripComments(readFileSync(THEME, 'utf8')), light, dark, (s) => !mentionsDirection(s));
if (direction) {
  if (!existsSync(DIRECTIONS)) {
    console.error(`--direction ${direction} given but ${DIRECTIONS} does not exist`);
    process.exit(1);
  }
  const css = stripComments(readFileSync(DIRECTIONS, 'utf8'));
  loadTheme(css, light, dark, (s) => !mentionsDirection(s) || hasDirection(s, direction));
}

function resolve(value, map, depth = 0) {
  if (value === undefined || depth > 25) return null;
  const v = value.trim();
  const ref = v.match(/^var\(--([a-z0-9-]+)\)$/i);
  if (ref) return resolve(map[ref[1]], map, depth + 1);
  if (v === 'white') return '#ffffff';
  if (v === 'black') return '#000000';
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg, bg) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

const pairs = JSON.parse(readFileSync(PAIRS, 'utf8'));
const lines = [
  `| Theme | Foreground | Background | fg | bg | Ratio | Min | Result |`,
  `| ----- | ---------- | ---------- | -- | -- | ----- | --- | ------ |`,
];
let failed = false;
for (const theme of ['light', 'dark']) {
  const map = theme === 'light' ? light : dark;
  for (const pair of pairs) {
    const fg = resolve(pair.fg.startsWith('app-') ? `var(--${pair.fg})` : pair.fg, map);
    const bg = resolve(`var(--${pair.bg})`, map);
    let result;
    let r = null;
    if (fg === null || bg === null) {
      result = pair.deferred ? `DEFER (${pair.deferred}, unresolved)` : 'FAIL (unresolved)';
      if (!pair.deferred) failed = true;
    } else {
      r = ratio(fg, bg);
      if (r >= pair.min) result = 'PASS';
      else if (pair.deferred) result = `DEFER (${pair.deferred})`;
      else {
        result = 'FAIL';
        failed = true;
      }
    }
    const shown = r === null ? 'n/a' : `${r.toFixed(2)}:1`;
    lines.push(
      `| ${theme} | \`${pair.fg}\` | \`${pair.bg}\` | ${fg ?? '?'} | ${bg ?? '?'} | ${shown} | ${pair.min}:1 | ${result} |`,
    );
  }
}
for (const theme of ['light', 'dark']) {
  const bg = resolve('var(--app-bg-surface)', theme === 'light' ? light : dark);
  if (bg) lines.push(`| ${theme} | luminance | \`app-bg-surface\` | ${bg} |  | ${(luminance(bg) * 100).toFixed(1)}% | ≤12% dark | brief §9 row 1 |`);
}
const table = lines.join('\n');
console.log(`Contrast (${direction ? `direction ${direction}` : 'base theme'})\n${table}`);

if (write && !direction) {
  const doc = readFileSync(AUDIT, 'utf8');
  const a = doc.indexOf(START);
  const b = doc.indexOf(END);
  if (a === -1 || b === -1 || b < a) {
    console.error(`${AUDIT} must contain ${START} before ${END}`);
    process.exit(1);
  }
  const generated = `${START}\n\nGenerated by \`npm run contrast -- --write\`; do not edit by hand.\n\n${table}\n\n`;
  writeFileSync(AUDIT, doc.slice(0, a) + generated + doc.slice(b));
}
process.exit(failed ? 1 : 0);
```

2. Create `scripts/contrast-pairs.json` exactly (`fg` is a token name without `--` or a literal
   colour keyword; `deferred` names the plan that must remove the key):

```json
[
  { "fg": "app-text-primary", "bg": "app-bg-base", "min": 4.5 },
  { "fg": "app-text-primary", "bg": "app-bg-surface", "min": 7, "why": "brief §9 row 2 readouts" },
  { "fg": "app-text-secondary", "bg": "app-bg-base", "min": 4.5 },
  { "fg": "app-text-secondary", "bg": "app-bg-surface", "min": 4.5 },
  { "fg": "app-text-muted", "bg": "app-bg-surface", "min": 4.5, "deferred": "006b" },
  { "fg": "app-accent-text", "bg": "app-bg-base", "min": 4.5 },
  { "fg": "app-accent-solid-text", "bg": "app-accent-solid", "min": 4.5 },
  { "fg": "app-accent-solid-text", "bg": "app-accent-solid-hover", "min": 4.5 },
  { "fg": "app-error-text", "bg": "app-error-bg", "min": 4.5 },
  { "fg": "white", "bg": "app-error-solid", "min": 4.5, "deferred": "006b" },
  { "fg": "white", "bg": "app-success-solid", "min": 4.5, "deferred": "006b" },
  { "fg": "white", "bg": "app-warning-solid", "min": 4.5, "deferred": "006b" },
  { "fg": "app-border-default", "bg": "app-bg-base", "min": 3 }
]
```

3. `package.json`: add `"contrast": "node scripts/contrast.mjs"` to `scripts`, directly after
   `"test:a11y"`.
4. `docs/features/wcag-audit.md`: insert a line `<!-- contrast:start -->` immediately before
   `#### Text on Background Combinations` (line 30) and a line `<!-- contrast:end -->`
   immediately before `#### Borders & Dividers` (line 50). Move the paragraph starting
   `**Note:** \`--app-text-disabled\`` to directly after the end marker. Run
   `npm run contrast -- --write`; the two hand-written tables between the markers are replaced
   by the generated one.
5. Append to `tests/accessibility.spec.ts` (the file already imports `AxeBuilder`, `test` and
   `expect`; add nothing else at the top):

```ts
test.describe('Design directions on /design-system (plan 006a)', () => {
  for (const direction of ['a', 'b', 'c'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      test(`direction ${direction} — ${theme} — no WCAG AA violations`, async ({ page }) => {
        await page.goto('/design-system');
        await page.getByTestId(`playground-direction-${direction}`).click();
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        await page.waitForFunction(
          ([d, t]) =>
            document.documentElement.dataset.direction === d &&
            document.documentElement.getAttribute('data-theme') === t,
          [direction, theme] as const,
        );
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa'])
          .exclude('canvas')
          .exclude('[aria-disabled="true"]')
          .analyze();
        expect(results.violations).toEqual([]);
      });
    }
  }
});
```

6. Create `tests/direction-shots.spec.ts` exactly:

```ts
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { test } from '@playwright/test';

// Plan 006a Step 2b: one full-page screenshot of /design-system per direction and theme.
const out = process.env.SHOTS_OUT;
test.skip(!out, 'SHOTS_OUT not set: this spec only runs when a screenshot set is requested');

for (const direction of ['a', 'b', 'c'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`design-system-${direction}-${theme}`, async ({ page }) => {
      await page.goto('/design-system');
      await page.getByTestId(`playground-direction-${direction}`).click();
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await page.waitForFunction(
        ([d, t]) =>
          document.documentElement.dataset.direction === d &&
          document.documentElement.getAttribute('data-theme') === t,
        [direction, theme] as const,
      );
      await page.evaluate(() => document.fonts.ready);
      mkdirSync(out as string, { recursive: true });
      await page.screenshot({
        path: path.join(out as string, `design-system-${direction}-${theme}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
}
```

7. Run the contrast script for the base theme and each direction and the screenshot spec (see
   Commands). If a direction pair prints `FAIL`, apply this rule and rerun: for
   `app-accent-solid-text` pairs, move `--app-accent-solid` one Radix step toward 11 in the light
   block, or swap `--app-accent-solid-text` between `white` and the theme's ink (`var(--slate-12)`
   light, `var(--slate-1)` dark; `sand` for C) in the failing theme's block — whichever the next
   run passes; for text pairs, move the text token one step toward 12. Record every change in the
   decision file's "Contrast" section.
8. Create `docs/planning/decisions/006-direction.md`:

```markdown
# Decision 006-direction: Which of the brief's three directions (or which hybrid) does Graphium adopt?

Status: PENDING

## Question

The brief (`docs/planning/ui-redesign-brief.md` §10) names three directions. All three are
rendered at `/design-system` (switcher `playground-direction-a|b|c`), pass `npm run test:a11y`
and `npm run contrast -- --direction <x>`, and are screenshotted under
`docs/planning/screenshots/006a-step2/` (six files, listed below). Which one is applied by plan
006b, or which hybrid (named as "<base direction> + <one named element of another>")?

## Options

1. A · Instrument panel — amber-9 accent, slate-6 rules, ≤ 4 px radius, inset active ring, Plex
   Mono readouts. Screenshots: `design-system-a-dark.png`, `design-system-a-light.png`.
2. B · Etched plate — tomato accent, continuous dark stock, 2 px radius, engraved active state,
   Plex Sans numerals. Screenshots: `design-system-b-dark.png`, `design-system-b-light.png`.
3. C · Cartographer's desk — orange-9 accent, sand greys / paper light theme, flat with pressed
   state, Plex Serif titles. Screenshots: `design-system-c-dark.png`, `design-system-c-light.png`.

## Rubric (brief §9; rows 1–6 scored from measurements, row 7 is Kyle's)

| Row | Heuristic                     | Source                                                              | A | B | C |
| --- | ----------------------------- | ------------------------------------------------------------------- | - | - | - |
| 1   | Chrome must not glow          | `npm run contrast -- --direction <x>`: luminance line, dark ≤ 12 % |   |   |   |
| 2   | Glance-readable at 2 m        | `directions.test.ts` readout size/weight + 7:1 pair                 |   |   |   |
| 3   | One-handed / pen              | n/a here: directions set no size token; `tests/touch-targets.spec.ts` gates 006b | n/a | n/a | n/a |
| 4   | Four-hour fatigue             | `directions.test.ts` grey-scale chrome test                         |   |   |   |
| 5   | State without colour          | `grep -c "elevation-active: inset" src/styles/directions.css` per direction ≥ 1 |   |   |   |
| 6   | Projector-safe World View     | pass by construction: `[data-direction]` never applies to `?type=world` | pass | pass | pass |
| 7   | Hell-yes test                 | Kyle, per screenshot                                                |   |   |   |

## Contrast

<paste the four tables printed by `npm run contrast` and `npm run contrast -- --direction a|b|c`,
and list every seed value changed by the rule in Step 2b Do 7>

## Recommendation

<the direction with the most `pass` cells in rows 1–6; on a tie, the one whose
`app-accent-solid-text` / `app-accent-solid` dark ratio is highest> — one sentence.

## Kyle's answer

```

   Fill every `<…>` placeholder from real outputs before committing. Then set the README row
   `006a` to `BLOCKED (decision 006-direction)`, write `plans/reports/006a.md` (`## Run 1`), push,
   and open the 006a PR (CONVENTIONS §7; the PR body is the report). STOP.

**Do NOT**: Edit `tests/accessibility.spec.ts` above its last line. Add an axe `exclude()` to make
a direction pass. Change a Radix scale value (change which step a token points at). Write under
"Kyle's answer". Continue to Step 3 in this run.
**Commands**:

```bash
npm run contrast
npm run contrast -- --direction a && npm run contrast -- --direction b && npm run contrast -- --direction c
npm run contrast -- --write && grep -c "contrast:start\|contrast:end" docs/features/wcag-audit.md
npm run build:web && SHOTS_OUT=docs/planning/screenshots/006a-step2 CI=1 npx playwright test tests/direction-shots.spec.ts --project=Web-Chromium
ls docs/planning/screenshots/006a-step2/*.png | wc -l
npm run verify:static && npm run verify:web
```

**Expected**: exit 0 (rows marked `DEFER (006b)` are allowed); exit 0 three times; exit 0 then
`2`; exit 0; `6`; exit 0.
**Check**: `npm run contrast -- --direction a && npm run contrast -- --direction b && npm run contrast -- --direction c`
exits 0 and `test -f docs/planning/decisions/006-direction.md`.
**If it fails**: A direction that still prints `FAIL` after the Do 7 rule was applied twice is a
STOP: report the failing pair, both hex values and the ratio (the brief allows leaving a Radix
scale only with proof, and that proof is Kyle's to accept).
**Commit**: `plan-006a step-2b: prove contrast and raise the direction decision`

### Step 3: Raise the information-architecture decision

**Files**: `docs/planning/decisions/006-ia.md`
**Do**: Precondition: `grep -n "^Status: DECIDED" docs/planning/decisions/006-direction.md`
prints one line; otherwise STOP again (CONVENTIONS §9.3). Create `006-ia.md` from this template,
replacing each `<…>` with the measured value and its command:

```markdown
# Decision 006-ia: For each of seven IA questions, keep, adjust or restructure?

Status: PENDING

## Question

Separately from appearance, is what-lives-where right? Answer each numbered question with
exactly one of `keep | adjust | restructure`. "Keep" is a legitimate answer and is recorded as
one. Direction chosen in 006-direction: <A | B | C | hybrid>. Audit conclusion:
<identity gap | inconsistency> (`grep "^Conclusion" docs/planning/ui-redesign-audit.md`).

### Q1 Toolbar

Current: floating bar, `fixed bottom-4 left-1/2` (`grep -rn "toolbar fixed bottom-4" src/App.tsx src/components/Toolbar.tsx`,
<hit>). Tool options (colour, measurement mode, door orientation) are inline.

### Q2 Sidebar

Current: three components — `src/components/Sidebar.tsx` (<n> lines), `QuickTokenSidebar.tsx`
(<n>), `MobileSidebarDrawer.tsx` (<n>) (`wc -l`).

### Q3 Settings

Current: two surfaces — `src/components/MapSettingsSheet.tsx` (<n> lines) and
`src/components/SessionConsole/SessionConsoleSettingsSheet.tsx` with
`sessionConsoleSettingsSections.tsx` (<n> sections: `grep -c "id: '" src/components/SessionConsole/sessionConsoleSettingsSections.tsx`).

### Q4 Home screen

Current: `src/components/HomeScreen.tsx`, <n> lines; presents recent campaigns, templates, new
campaign and settings on one screen (`grep -c "data-testid=\"home-" src/components/HomeScreen.tsx`
→ <n> test ids).

### Q5 Session Console

Current: `src/components/SessionConsole/` (<n> files, `ls | wc -l`), designed in
`docs/planning/session-console-design.md`; opens inside the sidebar.

### Q6 World View

Current: canvas only at `?type=world`; overlay text elements: <n>
(`[data-testid^="world-"]` count from `docs/planning/ui-redesign-audit.json`, surface `world`).
The brief §8 allows a `[data-view="world"]` token set; answer whether it gets one.

### Q7 Hardcoded colours in files plan 004 does not touch

Current: <n> palette classes and <n> literal colours (commands in the audit's Counts section).
Options here are `keep | fix-in-006b | defer`.

## Options

For Q1–Q6: 1. keep — no behaviour change, 006b Step 7 restyles in place. 2. adjust — same
elements, new placement or grouping; additive `data-testid`s only. 3. restructure — flows change;
006b Step 8 owns it with its own E2E additions. For Q7: 1. keep — the palette swap does not reach
those files. 2. fix-in-006b — 006b Step 7 adds a per-file sub-step. 3. defer — a follow-up plan.

## Recommendation

Q1 <one>, Q2 <one>, Q3 <one>, Q4 <one>, Q5 <one>, Q6 <one>, Q7 <one> — one sentence each,
citing the audit row that motivates it. If the audit conclusion is `inconsistency`, recommend
`fix-in-006b` for Q7.

## Kyle's answer

```

Set the README row `006a` to `BLOCKED (decision 006-ia)`, append `## Run 2` to
`plans/reports/006a.md`, push. STOP.
**Do NOT**: Answer any question. Restructure anything. Edit `src/`.
**Commands**:

```bash
grep -c "^### Q[1-7]" docs/planning/decisions/006-ia.md
grep -c "<" docs/planning/decisions/006-ia.md
```

**Expected**: `7`; `0`.
**Check**: `grep -c "^### Q[1-7]" docs/planning/decisions/006-ia.md` prints `7` and
`grep -c "<" docs/planning/decisions/006-ia.md` prints `0`.
**If it fails**: Fill the remaining placeholder and retry once.
**Commit**: `plan-006a step-3: raise the information-architecture decision`

### Step 4: Rewrite Steps 5+ of this plan at full resolution

**Files**: `scripts/plan-lint.sh`, `plans/006-visual-redesign.md`, `plans/reports/006a.md`,
`CHANGELOG.md`, `docs/planning/decisions/006-steps-review.md`
**Do**: Precondition: both `006-direction.md` and `006-ia.md` have `Status: DECIDED`.

1. Create `scripts/plan-lint.sh` exactly and `chmod +x` it:

```bash
#!/usr/bin/env bash
# scripts/plan-lint.sh <plan.md> — structural lint for executor plans (plans/CONVENTIONS.md §6).
# Exit 0 only when every "### Step" has all eight labelled fields, every **Check** names a
# mechanical condition on its first line, no forbidden phrase appears outside a prohibition, and
# no angle-quote placeholder (U+2039 / U+203A) remains from the first "### Step" onward.
set -u
file="${1:?usage: plan-lint.sh plans/NNN-*.md}"
fail=0
steps=$(grep -c '^### Step ' "$file")
for label in 'Files' 'Do' 'Do NOT' 'Commands' 'Expected' 'Check' 'If it fails' 'Commit'; do
  n=$(grep -c "^\*\*${label}\*\*:" "$file")
  if [ "$n" -ne "$steps" ]; then
    echo "FAIL: $n '**${label}**' lines for $steps steps"
    fail=1
  fi
done
if ! awk '/^\*\*Check\*\*:/ && $0 !~ /npm run|npx |grep |node |bash |test -f|Status: DECIDED|exits 0/ { print "FAIL: non-mechanical Check at line " NR ": " $0; bad=1 } END { exit bad }' "$file"; then
  fail=1
fi
forbidden='by e[y]e|manual[l]y|visual[l]y|Kyle conf[i]rms|see plan 0[0]' # plan-lint: own pattern
if grep -nE "$forbidden" "$file" | grep -vE "must not|never|Do NOT|no plan may|prohibit|plan-lint"; then
  echo "FAIL: forbidden phrase (above)"
  fail=1
fi
lt=$(printf '\342\200\271')
gt=$(printf '\342\200\272')
if ! awk -v lt="$lt" -v gt="$gt" '/^### Step /{inside=1} inside && (index($0, lt) || index($0, gt)) { print "FAIL: placeholder at line " NR ": " $0; bad=1 } END { exit bad }' "$file"; then
  fail=1
fi
[ "$fail" -eq 0 ] && echo "OK: $steps steps, all eight fields present"
exit "$fail"
```

2. Replace everything between `<!-- steps-5-plus:start -->` and `<!-- steps-5-plus:end -->`
   below with the completed Steps 5–10, keeping the step titles and order of the template,
   filling every angle-quote placeholder, and obeying: every step has the eight fields; every **Do** quotes the line
   of `006-direction.md` or `006-ia.md` it implements; every **Files** entry is an existing path or
   one created by an earlier step; every **Check** starts with a command; Step 8 exists only for
   questions answered `restructure` (otherwise its **Do** is "No question was answered
   restructure; nothing to do" and its commands are `true`); each screen in Step 7 gets its own
   `### Step 7.n` with `PR boundary` in its title when the running diff would exceed 1,500 lines
   (`git diff --stat main | tail -1`).
3. Re-verify every citation in Steps 5+ against `origin/main` at that moment (plans 004 and 005
   have merged) and refresh the Citation re-check table rows for 006b paths.
4. Create `docs/planning/decisions/006-steps-review.md` (CONVENTIONS §9 shape; Question: "Are
   Steps 5–10 of `plans/006-visual-redesign.md` approved for execution?"; Options: 1. approve —
   Kyle writes `Reviewed-by: Kyle <date>` as the first line after the start marker; 2. amend —
   Kyle edits the steps then adds the line; Recommendation: 1).
5. Write `plans/reports/006a.md` `## Run 3` (CONVENTIONS §11); add one bullet under
   `## [Unreleased]` in `CHANGELOG.md`: "Design System Playground: direction switcher and motion
   tile (prototype)". After merge, set the `006a` row in `plans/README.md` to `DONE <merge sha>`;
   006b's `Grounded at` is plan 005's merge SHA (already written there by plan 005's final step).
   The next plan file is this one (006b, Steps 5+).

**Do NOT**: Implement anything from Steps 5+. Change Steps 0–3. Write the `Reviewed-by` line
yourself. Leave an angle-quote placeholder anywhere after the first `### Step`. Add steps that the decision files do
not call for.
**Commands**:

```bash
bash scripts/plan-lint.sh plans/006-visual-redesign.md
grep -c "006-direction.md\|006-ia.md" plans/006-visual-redesign.md
npm run verify:static
```

**Expected**: `OK: <n> steps, all eight fields present` and exit 0; a number ≥ 8; exit 0.
**Check**: `bash scripts/plan-lint.sh plans/006-visual-redesign.md` exits 0.
**If it fails**: Fix the reported line and retry once; a second failure is a STOP naming the line.
**Commit**: `plan-006a step-4: rewrite steps 5+ at full resolution`

---

## Steps — 006b

<!-- steps-5-plus:start -->

‹Reviewed-by: Kyle <date> — Kyle writes this line; until it exists 006b is BLOCKED (decision
006-steps-review)›

Template for Step 4. Every `‹…›` is filled by Step 4; the code blocks and the concrete actions
already decided (CONVENTIONS §9 table and this plan's Context) are kept verbatim.

### Step 5: Apply the chosen tokens and delete the prototypes

**Files**: `src/styles/theme.css`, `src/styles/fonts.css`, `src/styles/directions.css`
(delete), `src/styles/directions.test.ts` (delete),
`src/components/DesignSystemPlayground/DesignSystemPlayground.tsx`, `scripts/contrast-pairs.json`,
`tests/accessibility.spec.ts`, `tests/direction-shots.spec.ts` (delete),
`docs/planning/screenshots/006b-baseline/**`
**Do**: Implements `006-direction.md` line: ‹quote the "Kyle's answer" line›.
`SHOTS_OUT=docs/planning/screenshots/006b-baseline npm run shots` first. Copy the chosen
direction's light and dark blocks from `directions.css` into the matching `:root, [data-theme='light']`
and `[data-theme='dark']` blocks of `theme.css` (replacing the values of tokens with the same name,
adding the new `--app-elevation-active`, `--app-font-family-*`, `--app-font-size-readout`,
`--app-font-weight-readout` tokens after the existing families); add the new Radix `@import`
lines and the `[data-theme='dark']` scale copy that direction needs; move any `@font-face` into
`fonts.css`. Add `--app-error-solid-text`, `--app-success-solid-text`, `--app-warning-solid-text`
(the ink or `white`, whichever `npm run contrast` passes; if neither passes at step 9, move the
solid to step 10 then 11 and rerun) and remove every `"deferred"` key from
`scripts/contrast-pairs.json`, replacing `"fg": "white"` with the new token names; set
`--app-text-muted` to `var(--slate-11)` (or the chosen grey's step 11). Delete `directions.css`,
`directions.test.ts`, `direction-shots.spec.ts`, the switcher, `readDirection`, the `DIRECTIONS`
constants and the `directions.css` import from the playground, and the "Design directions" describe
block from `tests/accessibility.spec.ts`; empty `CONTRAST_DEFERRED` there. ‹fill remaining specifics›
**Do NOT**: Change any component file. Keep any `data-direction` selector. Leave a `deferred` key.
Change a `data-testid`.
**Commands**:

```bash
npm run contrast
grep -rn "data-direction\|graphium-direction" src tests
grep -c '"deferred"' scripts/contrast-pairs.json
npm run verify:static && npm run verify:web
```

**Expected**: exit 0 with no `DEFER` row; no output (exit 1); `0`; exit 0.
**Check**: `npm run contrast` exits 0 and `grep -rn "data-direction" src tests` prints nothing.
**If it fails**: A `FAIL` row after the step-10/11 rule is a STOP naming the pair and ratio.
**Commit**: `plan-006b step-5: apply the chosen tokens and delete the prototypes`

### Step 6: Align primitive variants and motion with the direction

**Files**: `src/components/ui/‹files›`, `src/styles/theme.css` (reduced-motion block),
`src/styles/app.css`
**Do**: Implements `006-direction.md` line: ‹quote›. Radius, elevation and pressed states of every
primitive consume `--app-radius-*`, `--app-elevation-*` and `--app-elevation-active`; `.btn-tool`
in `src/styles/app.css` (line 54) drops its `rgb()` literals for tokens. Motion: replace every
literal Tailwind duration (`grep -rnE "\bduration-[0-9]+\b" src --include=*.tsx`) with the token
classes ‹names›; when that grep prints nothing, delete the `* { transition: none !important;
animation: none !important; }` rule from `theme.css` (the `:root` zeroing from 006a Step 2a
remains and is the reduced-motion design: same design, zero durations). ‹fill›
**Do NOT**: Add a primitive. Change a variant's props API. Delete the `*` rule while the duration
grep still prints a line.
**Commands**:

```bash
grep -rnE "\bduration-[0-9]+\b" src --include=*.tsx | wc -l
grep -c "transition: none !important" src/styles/theme.css
npm run verify:static && npm run verify:web
```

**Expected**: `0`; `0`; exit 0.
**Check**: `grep -rnE "\bduration-[0-9]+\b" src --include=*.tsx | wc -l` prints `0` and
`npm run verify:web` exits 0.
**If it fails**: Fix and retry once; a second failure is a STOP.
**Commit**: `plan-006b step-6: align primitive variants and motion with the direction`

Step 4 writes one step in this shape per screen, highest traffic first: 7.1 toolbar, 7.2 sidebar,
7.3 home screen, 7.4 dialogs, 7.5 Session Console.

### Step 7.1: Refine the toolbar

**Files**: ‹the screen's files; `src/components/Toolbar.tsx` after plan 004 Step 10›
**Do**: Implements `006-ia.md` line: ‹quote Q1 answer› and `006-direction.md` line: ‹quote›.
‹exact edits; palette classes and literal colours in this screen are replaced with tokens when Q7
is `fix-in-006b`›
**Do NOT**: Change a flow (that is Step 8). Rename a `data-testid`. Shrink any control below the
`tests/touch-targets.spec.ts` minimums.
**Commands**:

```bash
SHOTS_OUT=docs/planning/screenshots/006b-step7.1 npm run shots
npm run verify:static && npm run verify:web
```

**Expected**: exit 0; exit 0.
**Check**: `npm run verify:web` exits 0 (includes `tests/touch-targets.spec.ts`).
**If it fails**: Fix and retry once; a second failure is a STOP.
**Commit**: `plan-006b step-7.1: refine the toolbar`

### Step 8: Restructure where 006-ia says restructure

**Files**: ‹files of the restructured questions, plus the E2E specs that need additive `data-testid`s›
**Do**: Implements `006-ia.md` lines: ‹quote each `restructure` answer›. Additive `data-testid`s
only. ‹fill; or "No question was answered restructure; nothing to do"›
**Do NOT**: Rename or remove a `data-testid`. Touch a question answered `keep` or `adjust`.
**Commands**:

```bash
npm run verify:static && npm run verify:web && npm run verify:electron
```

**Expected**: exit 0.
**Check**: `npm run verify:electron` exits 0.
**If it fails**: STOP with the failing spec name (a flow change that breaks a spec needs Kyle).
**Commit**: `plan-006b step-8: restructure where 006-ia says restructure`

### Step 9: Gate the World View against the brief §8 rules

**Files**: `tests/world-legibility.spec.ts`, ‹World View files only if the spec fails and Q6 permits›
**Do**: Implements `006-ia.md` line: ‹quote Q6 answer›. Create the spec exactly:

```ts
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { gotoSurface } from './helpers/surfaces';

// Brief §8: the World View is projected; overlay text ≥ 18 px and 7:1, strokes ≥ 2 px, no DM chrome.
test.use({ viewport: { width: 1920, height: 1080 } });

const MIN_FONT_PX = 18;
const MIN_STROKE_PX = 2;
const MIN_RATIO = 7;

interface Sample {
  tag: string;
  text: string;
  fontSize: number;
  strokes: number[];
  ratio: number;
}

async function sampleText(page: Page): Promise<Sample[]> {
  return page.evaluate(() => {
    const lum = (rgb: string): number | null => {
      const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!m || (m[4] !== undefined && parseFloat(m[4]) === 0)) return null;
      const [r, g, b] = [m[1], m[2], m[3]].map((v) => {
        const c = parseInt(v as string, 10) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number);
    };
    const bgLum = (start: Element): number => {
      let el: Element | null = start;
      while (el) {
        const l = lum(getComputedStyle(el).backgroundColor);
        if (l !== null) return l;
        el = el.parentElement;
      }
      return lum(getComputedStyle(document.body).backgroundColor) ?? 0;
    };
    const out: Sample[] = [];
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      if (el.tagName === 'CANVAS' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
      const text = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent?.trim() ?? '')
        .join('');
      const rect = el.getBoundingClientRect();
      if (!text || rect.width === 0 || rect.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const fg = lum(cs.color) ?? 0;
      const bg = bgLum(el);
      const [hi, lo] = fg > bg ? [fg, bg] : [bg, fg];
      const strokes = [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth]
        .map((w) => parseFloat(w))
        .filter((w) => w > 0);
      out.push({ tag: el.tagName, text: text.slice(0, 40), fontSize: parseFloat(cs.fontSize), strokes, ratio: (hi + 0.05) / (lo + 0.05) });
    }
    return out;
  });
}

for (const surface of ['world', 'world-dialog'] as const) {
  test(`${surface}: brief §8 rules hold at 1920×1080`, async ({ page }) => {
    await gotoSurface(page, surface, 'dark');
    await expect(page.locator('[data-testid^="toolbar-"], [data-testid^="sidebar-"]')).toHaveCount(0);
    const samples = await sampleText(page);
    const small = samples.filter((s) => s.fontSize < MIN_FONT_PX);
    const thin = samples.filter((s) => s.strokes.some((w) => w < MIN_STROKE_PX));
    const faint = samples.filter((s) => s.ratio < MIN_RATIO);
    expect(small, `text below ${MIN_FONT_PX}px: ${JSON.stringify(small)}`).toEqual([]);
    expect(thin, `strokes below ${MIN_STROKE_PX}px: ${JSON.stringify(thin)}`).toEqual([]);
    expect(faint, `contrast below ${MIN_RATIO}:1: ${JSON.stringify(faint)}`).toEqual([]);
  });
}
```

Fix failures in the World View's own files only when Q6 was answered `adjust` or `restructure`;
when Q6 is `keep`, a failure means Step 5's tokens leaked and the fix is in `theme.css` (a
`[data-view="world"]` block per brief §8, added only if Q6 says the World View gets its own set).
**Do NOT**: Add any element to the World View. Loosen a threshold. Exclude an element.
**Commands**:

```bash
npm run build:web && CI=1 npx playwright test tests/world-legibility.spec.ts --project=Web-Chromium
npm run verify:static && npm run verify:web
```

**Expected**: exit 0; exit 0.
**Check**: `CI=1 npx playwright test tests/world-legibility.spec.ts --project=Web-Chromium` exits 0.
**If it fails**: One fix in the permitted files, one retry; then STOP with the failing sample
JSON.
**Commit**: `plan-006b step-9: gate the World View against the brief`

### Step 10: Close the program

**Files**: `tests/visual.spec.ts` snapshots, `docs/planning/screenshots/006b-final/**`,
`docs/features/wcag-audit.md`, `docs/features/theming.md`, `README.md`,
`public/screenshots/graphium-overview.png`, `.github/workflows/deploy-web.yml`, `CHANGELOG.md`,
`plans/reports/006b.md`, `plans/README.md`
**Do**: `SHOTS_OUT=docs/planning/screenshots/006b-final npm run shots`. Rebaseline:
`npm run build:web && CI=1 npx playwright test tests/visual.spec.ts --project=Web-Chromium --update-snapshots`,
then rerun without the flag. `npm run contrast -- --write`; update `docs/features/theming.md`
"Full Variable Reference" (line 105) with the new families and values; copy
`docs/planning/screenshots/006b-final/editor-dark.png` to `public/screenshots/graphium-overview.png`
(README line 40 currently points at a file that does not exist) and replace the two
`via.placeholder.com` images (README lines 61–62) with `public/screenshots/Graphium-show.gif` and
`editor-dark.png`. Restore `deploy-web.yml` to trigger on `push: branches: [main]` (CONVENTIONS
§9 table). Write `plans/reports/006b.md` (CONVENTIONS §11), including the note for Kyle that the
World View was gated by `tests/world-legibility.spec.ts` and a look on a real second display is
his to do at review; add one bullet under `## [Unreleased]` in `CHANGELOG.md` for the redesign;
after merge set the `006b` row in `plans/README.md` to `DONE <merge sha>`. This is the last plan of
the program; there is no next `Grounded at` to write.
**Do NOT**: Edit README prose. Change any token. Restore `deploy-web.yml` before every other step
is committed.
**Commands**:

```bash
npm run contrast -- --write
grep -c "placeholder.com" README.md
test -f public/screenshots/graphium-overview.png && echo present
grep -n "^      - main" .github/workflows/deploy-web.yml
grep -rnE "#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(" src/components/ src/App.tsx src/index.css src/styles/app.css src/styles/fonts.css | wc -l
npm run verify
```

**Expected**: exit 0; `0`; `present`; one line; `0` (or the count `006-ia.md` Q7 permits); exit 0.
**Check**: `npm run verify` exits 0 and `grep -c "placeholder.com" README.md` prints `0`.
**If it fails**: Fix and retry once; a second failure is a STOP.
**Commit**: `plan-006b step-10: close the program`

<!-- steps-5-plus:end -->

## Validation plan

- `npm run verify:web` (which runs `tests/accessibility.spec.ts`, `tests/touch-targets.spec.ts`
  and `tests/visual.spec.ts`) after every step that touches `src/` or `tests/`.
- `npm run contrast` after every token change; `npm run contrast -- --direction <x>` for each
  prototype in 006a.
- `tests/world-legibility.spec.ts` (006b Step 9) is the World View gate; the real-display look is
  a review note, not a gate.
- `npm run verify:electron` at 006b Step 8 and before the 006b push (`npm run verify`).

## Done criteria

006a:

- [ ] `docs/planning/ui-redesign-audit.md` has 7 surface tables (56 `| ` lines), 7 `Nearest:` lines
      and 1 `Conclusion:` line; `docs/planning/ui-redesign-audit.json` has 14 samples
- [ ] Three directions switch at `/design-system` in both themes; `src/styles/directions.test.ts`
      passes; `npm run contrast -- --direction a|b|c` all exit 0; six screenshots under
      `docs/planning/screenshots/006a-step2/`
- [ ] `docs/planning/decisions/006-direction.md` and `006-ia.md` exist with `Status: DECIDED`
- [ ] `bash scripts/plan-lint.sh plans/006-visual-redesign.md` exits 0 and the `Reviewed-by`
      line exists

006b:

- [ ] `grep -rn "data-direction" src tests` prints nothing
- [ ] `npm run contrast` exits 0 with no `DEFER` row (white-on-`--app-error-solid` fixed)
- [ ] `CONTRAST_DEFERRED` in `tests/accessibility.spec.ts` is empty
- [ ] `tests/world-legibility.spec.ts` passes; no `data-testid` renamed
      (`git diff <006b grounded-at> -- src | grep "^-.*data-testid" | wc -l` → 0)
- [ ] `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(" src/components/ src/App.tsx src/index.css src/styles/app.css src/styles/fonts.css | wc -l`
      → 0, or the number `006-ia.md` Q7 permits (151 at d3d3642)
- [ ] `docs/features/wcag-audit.md` regenerated; `docs/features/theming.md` updated
- [ ] `tests/visual.spec.ts` rebaselined; `006b-baseline` and `006b-final` screenshot sets committed
- [ ] `deploy-web.yml` triggers on `push: main` again
- [ ] `plans/reports/006a.md` and `plans/reports/006b.md` exist; both README rows `DONE`

## STOP conditions (specific to this plan)

- The brief still has a `____` line or is not `CONFIRMED` (Step 0).
- A decision file is `PENDING` when a step needs it `DECIDED` (Steps 3, 4, 5).
- A direction's contrast pair still fails after the Step 2b Do 7 rule was applied twice.
- `tests/world-legibility.spec.ts` fails and Q6 is `keep`.
- Any step would add an element to the World View without a decision file.
- Any step would set a `--app-*` value outside 006b Step 5 or 006b Step 9.

## Handoff / after it lands

- This is the end of the program. If a future redesign is expensive again, check whether
  `src/components/ui/README.md` is still followed and whether literal colours crept back
  (the grep in Done criteria).
- Reviewer focus: `npm run contrast` output, `tests/world-legibility.spec.ts`, and the
  `006b-baseline` versus `006b-final` screenshot sets.
- The program-complete note in `plans/README.md` is Kyle's to write; this plan only sets its two
  rows.
