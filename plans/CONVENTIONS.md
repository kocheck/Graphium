# Executor conventions for the UI redesign plans

**Read this file first, then your plan, then nothing else.** Everything an executor
needs is in this file, in the plan it was given, and in the artefacts that plan names by
path. Do not open other plans in `plans/` to "get context"; they describe other work
and will confuse you. If your plan says "see plan 00X", that is a bug in the plan: STOP
and report it.

These conventions are written for an executor that follows instructions literally and
should not improvise. When a step is unclear, the correct action is always to STOP
(section 10), never to guess.

---

## 1. Glossary

| Term                 | Meaning                                                                                                                                                                                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architect View**   | The DM's full control window: home screen, editor, toolbar, sidebar, dialogs. Rendered when the URL has no `?type=world`.                                                                                                                                                                                             |
| **World View**       | The player-facing projection window: canvas only, no DM chrome. Rendered when the URL has `?type=world`. In the web build it is `http://localhost:5173/?type=world`. It only shows content when an Architect tab in the same browser is broadcasting (BroadcastChannel).                                              |
| **Playground**       | The Design System Playground at `/design-system` (`src/components/DesignSystemPlayground/`). The place every new primitive is rendered and screenshotted. Not reachable in the packaged Electron app.                                                                                                                 |
| **Stress fixture**   | 200 tokens and no map, loaded when the URL has `?stress=1` (`src/utils/stressFixture.ts`). Also loadable from a button in the Resource Monitor.                                                                                                                                                                       |
| **Resource Monitor** | `src/components/ResourceMonitor.tsx`. In Electron it is the **View → Performance Monitor** menu item (`Cmd/Ctrl+Shift+M`).                                                                                                                                                                                            |
| **`data-esc-owns`**  | An attribute (`data-esc-owns="true"`) on an open overlay's content element. While any element carrying it is in the DOM, the global Escape key does **not** stop Session Console audio. Drop it from a dialog and Escape kills the DM's music.                                                                        |
| **Session Console**  | The audio/ambience panel inside the sidebar (`src/components/SessionConsole/`).                                                                                                                                                                                                                                       |
| **Primitive**        | A component in `src/components/ui/` (shadcn-generated, Radix-based). Not a feature component.                                                                                                                                                                                                                         |
| **Bridge**           | The second `@theme inline` block in `src/index.css` (added by plan 002) whose `--color-*` declarations define shadcn's token names (`--color-primary`, …) in terms of Graphium's `--app-*` variables. Plan 000's alias block is the first `@theme inline` block; there are never more than these two `@theme` blocks. |
| **Adapter**          | A thin existing component (`Tooltip.tsx`, `ToggleSwitch.tsx`, `CollapsibleSection.tsx`) whose internals are replaced by a primitive while its props API stays unchanged.                                                                                                                                              |
| **Tranche**          | A group of primitives added and committed together in plan 003.                                                                                                                                                                                                                                                       |
| **Surface**          | One of the named screens the test helpers can navigate to: `home`, `editor`, `editor-mobile`, `confirm-dialog`, `world`, `world-dialog`, `design-system`. Defined in `tests/helpers/surfaces.ts` after plan 000.                                                                                                      |
| **Gate**             | A command whose exit code decides whether a step is done. See section 4.                                                                                                                                                                                                                                              |
| **Grounded at**      | The commit a plan's file/line citations were checked against. See section 5.                                                                                                                                                                                                                                          |
| **Kyle**             | The repository owner and the only person who makes design and product decisions. You cannot talk to Kyle during a run. See section 9.                                                                                                                                                                                 |

## 2. What you may and may not do

**Allowed**

- Run shell commands, edit files, run `npm run …` scripts, and use `git` on the branch
  named in your plan.
- Run Playwright headlessly, including `npx playwright test`, `--list`, and screenshot
  scripts.
- Run the Electron E2E project **under `xvfb-run -a`** on Linux (there is no display).
- Create files only at the paths your plan names.

**Forbidden, always**

- `git push --force`, `git rebase` of shared history, `git commit --no-verify`, `git
commit --amend` on a pushed commit.
- Editing `playwright.config.ts` `testIgnore`, any `test.skip` / `test.fixme`, or any
  axe `exclude()` to make a gate pass. A gate that fails is information; report it.
- Touching any path outside your plan's **In scope** list. If a step seems to need it,
  STOP.
- Changing an existing `--app-*` colour value (only plan 006b may).
- Renaming or removing a `data-testid`.
- Deciding anything the plan marks as Kyle's decision (section 9).
- Installing a dependency the plan does not name.
- Using tools the environment may not have: a display, Electron with a window you can
  see, subagents, Figma, or any MCP server. Every plan is written to run on a headless
  Linux box with Node 20+, npm, Chromium via Playwright, and `xvfb-run`.
- Assuming a "manual" or "by eye" check passed. There are none in these plans; if you
  find one, STOP and report it as a plan defect.

## 3. Pre-flight (run before Step 1 of every plan)

After plan 000 lands, run:

```bash
bash scripts/preflight.sh NNN     # NNN = your plan number, e.g. 001, 006a, 006b
```

It exits 0 only when: every plan in your plan's **Depends on** line has a `DONE` row in
`plans/README.md`, every
artefact your plan lists under **Requires** exists, `node_modules/` and the Playwright
Chromium binary are installed, and you are on the branch your plan names. On non-zero
exit it prints the reason; STOP and report that reason.

Before plan 000 lands (i.e. when executing plan 000 itself), do the same checks by hand:

```bash
npm install
npx playwright install chromium
git branch --show-current            # must be the branch your plan names
```

## 4. Gates

Plan 000 adds these scripts to `package.json`. Use them by name; do not paste their
contents.

| Script                                     | Runs                                                                                                                                                                                                                                        | When                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `npm run verify:static`                    | `lint:strict`, `type-check`, `format:check`, `test:run`                                                                                                                                                                                     | After every step                                 |
| `npm run verify:web`                       | `build:web`, then Playwright `Web-Chromium` project, then `test:a11y`                                                                                                                                                                       | After every step that touches `src/` or `tests/` |
| `npm run verify:electron`                  | `build:electron`, then Playwright `Electron-App` under `xvfb-run -a`                                                                                                                                                                        | Where the plan says so (it is slow)              |
| `npm run verify`                           | All three, in that order                                                                                                                                                                                                                    | Before every push                                |
| `bash scripts/plan-lint.sh plans/NNN-*.md` | Structural lint of a plan file (eight fields per step, mechanical Check on its first line, no `‹…›` after the first step). Created by plan 006a Step 4; required only once that script exists (plans 000–003 and 006a runs 1–2 predate it). | Before editing a plan; before opening a PR       |
| `SHOTS_OUT=D npm run shots`                | Screenshots every surface in both themes into directory `D` (Playwright cannot take custom flags, so the output directory is an environment variable)                                                                                       | Where the plan says so                           |

Hand-pasted code is not always byte-exact Prettier or `import/order` output. If
`verify:static` fails **only** on `format:check`, `prettier/prettier` or `import/order`, run
`npm run format && npm run lint:fix` and retry once; that is not a STOP and needs no report
entry. Any other lint failure follows the step's **If it fails**.

`verify:web` and `shots` run with `CI=1`, so Playwright serves the **built** output on port 4173
(`preview:web`), matching CI; `shots` builds first. Running a single spec by hand therefore needs
`npm run build:web` first. `test:a11y` runs the `Web-Chromium` project only.

Until plan 000 lands, the equivalents are:

```bash
npm run lint:strict && npm run type-check && npm run format:check && npm run test:run
npm run build:web && npx playwright test --project=Web-Chromium && npm run test:a11y
npm run build:electron && xvfb-run -a npx playwright test --project=Electron-App
```

**Never run bare `npm run test:e2e`.** It launches the Electron project without building
it and fails with a missing `dist-electron/main.js`, which looks like a real defect.

"Expected" for every gate is **exit code 0**. A plan may state a stricter expectation
(a count, a string in the output); then that is the expectation.

## 5. Grounding and drift

Every plan's Status block has **Grounded at: `<sha>`**. That is the commit its file paths,
line numbers, and counts were checked against. Line numbers are **hints**, not
addresses: every citation in a plan is accompanied by a `grep` pattern, and the grep is
authoritative.

Before Step 1, run the plan's **Drift check** block. It diffs the in-scope paths against
the Grounded-at commit and lists the differences the previous plans are **expected** to
have made. Any difference not on that list is drift: STOP and report it with the diff
excerpt.

When you finish a plan, its last step tells you to write the merge commit's SHA into the
**next** plan's Grounded-at line and into `plans/README.md`. You cannot do that inside the
plan's own PR (the SHA does not exist until Kyle merges), so it happens in a **post-merge
run**: a later run on a fresh branch `plan/NNN-post-merge` off `origin/main`, one commit
`plan-NNN post-merge: record merge sha`, landed as a docs-only PR. The next executor's
drift check depends on it. The drift check reads the SHA from the plan's own Status block:

```bash
G=$(grep -oE 'Grounded at\*\*: `[0-9a-f]{7,40}' plans/NNN-<slug>.md | grep -oE '[0-9a-f]{7,40}$')
git diff --stat "$G"..origin/main -- <in-scope paths>     # Expected: empty
```

If `$G` is empty the previous plan's post-merge run has not happened: STOP.

## 6. Step format

Every step in every plan has the same eight fields. If a step is missing one, the plan
is defective: STOP and say which step and which field.

```
### Step N: <imperative title>

**Files**: <exact paths this step may create or change; nothing else>
**Do**: <what to change, precisely; code blocks are to be copied exactly>
**Do NOT**: <the tempting adjacent things that are out of bounds for this step>
**Commands**: <what to run, in order>
**Expected**: <exit code or literal output for each command>
**Check**: <the single condition that means the step is done>
**If it fails**: <fix-and-retry once, or STOP with reason X>
**Commit**: `plan-NNN step-N: <title>`
```

A step's **Files** list is a hard cap. If completing the step requires touching a file
not listed, STOP.

## 7. Commits, branches, pull requests

- Branch: `plan/NNN-<slug>` created from **`origin/main`**:
  ```bash
  git fetch origin main && git checkout -b plan/NNN-<slug> origin/main
  ```
  The clone may be shallow and may not have a local `main`; the fetch is required.
- One commit per step, message exactly as the step's **Commit** line. The commit history
  is the reviewer's map of the plan.
- Push with `git push -u origin plan/NNN-<slug>` after `npm run verify` exits 0.
- Open one pull request into `main` per plan (plan 004 opens six; plan 006 opens two: 006a is
  opened at its first BLOCKED stop and updated across runs, 006b may split at its `PR boundary`
  seams, as their text says). PR title: `Plan NNN: <plan title>`. PR body: the **Report**
  (section 11) pasted in full.
- CI runs only on pull requests into `main` (`lint.yml`, `test.yml`, `e2e.yml`,
  `accessibility.yml`, `documentation-check*.yml`). Nothing runs on the branch alone.
  `lint.yml` runs `format:check`; that is why `verify:static` includes it.
- **Merge method: merge commit, never squash.** Per-step commits are the revert unit.
- Rollback of a landed plan: `git revert -m 1 <merge-sha>` on a new branch, PR into
  `main`. Plan 004's five PRs are sequential; revert them newest-first.
- `deploy-web.yml` is pinned to `workflow_dispatch` for the duration of this program
  (plan 000 does it; plan 006b restores `push: main`). Merging to `main` therefore does
  **not** publish the web demo.
- A plan is DONE only when its PR is merged, its report is committed, and its row in
  `plans/README.md` says `DONE` with the merge SHA.

## 8. Naming

- `data-testid`: kebab-case, `<surface>-<element>`, e.g. `toolbar-tool-marker`,
  `dialog-confirm-root`, `sheet-map-settings-root`, `library-token-item`. Prefixes in
  use: `toolbar-`, `dialog-`, `sheet-`, `sidebar-`, `library-`, `token-`, `session-console-`,
  `world-`, `home-`, `playground-` (playground triggers and probes such as `playground-open-dialog`,
  `bridge-swatch-*`). Never renamed once added.
- New `--app-*` tokens: `--app-<family>-<role>` (`--app-radius-md`,
  `--app-toolbar-bg`). Families in use after plan 000: `bg`, `text`, `border`, `accent`,
  `success`, `warning`, `error`, `overlay`, `grid`, `shadow` (colour), `elevation`
  (real box-shadows), `radius`, `duration`, `ease`, `space`, `font-size`,
  `font-weight`.
- Decision files: `docs/planning/decisions/NNN-<topic>.md` (section 9).
- Reports: `plans/reports/NNN.md` (section 11). Plan 004 writes `004-pr1.md` … `004-pr6.md`.
- Screenshot sets: `docs/planning/screenshots/<plan>-<step>/<surface>-<theme>.png`, or
  `<plan>-baseline` / `<plan>-final` for a plan's opening and closing sets.

## 9. Decisions that belong to Kyle

Some steps need a decision only Kyle can make (a design direction, whether a behaviour
change is acceptable). You cannot ask Kyle during a run. The protocol:

1. Create `docs/planning/decisions/NNN-<topic>.md` with exactly this shape:

   ```markdown
   # Decision NNN-<topic>: <one-line question>

   Status: PENDING

   ## Question

   <the question, in one paragraph>

   ## Options

   1. <option> — <consequence>
   2. <option> — <consequence>

   ## Recommendation

   <one option and one sentence of reasoning>

   ## Kyle's answer

   <leave empty>
   ```

2. Commit it, set the plan's README row to `BLOCKED (decision NNN-<topic>)`, write your
   report, and end the run. **Never write anything under "Kyle's answer".**
3. A later run reads the file. If Status is `DECIDED`, follow the answer literally. If
   still `PENDING`, STOP again.

Decisions already made on 2026-09-04 (do not re-ask):

| Topic                                | Decision                                                                                                                                                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PreferencesDialog.tsx`              | Delete it (plan 000). It has zero importers. Git history keeps it.                                                                                                                                                                |
| Web deploy on merge to `main`        | Pin `deploy-web.yml` to manual dispatch for the program (plan 000); restore in plan 006b.                                                                                                                                         |
| Executor environment                 | Headless only. Every visual check is a Playwright screenshot Kyle reviews in the PR.                                                                                                                                              |
| Ignored functional specs             | Delete the nine that need UI that does not exist plus `campaign-workflow.spec.ts` (8 of 9 tests skipped); keep `door-sync` and `dm-world-sync`; rewrite `visual.spec.ts` on the surface helper; add small smoke specs (plan 000). |
| Design brief for plan 006            | Written: `docs/planning/ui-redesign-brief.md`. Plan 006 executes against it.                                                                                                                                                      |
| Sign-off mechanism                   | Decision files (this section) plus PR review.                                                                                                                                                                                     |
| `ConfirmDialog` initial focus        | Cancel (the safe action on a destructive dialog).                                                                                                                                                                                 |
| Tooltip adapter                      | Keep the `inline-flex` wrapper; accept opening on focus and edge flipping as improvements.                                                                                                                                        |
| Mobile sheets and `data-esc-owns`    | `MobileSidebarDrawer` and `MobileBottomSheet` do **not** claim Escape (matches existing tests).                                                                                                                                   |
| Toolbar extraction                   | Plan 004 Step 10 extracts `src/components/Toolbar.tsx`; plan 005 depends on it.                                                                                                                                                   |
| Toast                                | Keep `src/components/Toast.tsx`; do not add `sonner`.                                                                                                                                                                             |
| `command` palette                    | Out of scope for the whole program.                                                                                                                                                                                               |
| Reduced motion                       | The `* { transition: none !important }` rule in `theme.css` stays until plan 006b Step 6; 006a only adds token zeroing beside it.                                                                                                 |
| New Radix scales for 006 directions  | `tomato`, `orange`, `sand` are imported in `src/styles/directions.css` (playground-only, 006a Step 2a) with a `[data-theme='dark']` copy of each; 006b Step 5 moves the chosen scale's imports into `theme.css`.                  |
| `docs/planning/ui-redesign-ideas.md` | Created by whichever of 006a Step 1 or 004 Step 14 runs first; the other appends under its own heading.                                                                                                                           |

## 10. How to STOP

STOP means: do not continue to the next step, do not improvise around the problem.

1. Leave the working tree in a state where `npm run verify:static` passes (revert the
   half-done step if needed; `git stash` is fine).
2. Write the report (section 11) with a **STOPPED** section: the step, the condition
   that fired, the exact command output, and what you think the fix is (one sentence).
3. Set the plan's row in `plans/README.md` to `BLOCKED (<one-line reason>)`.
4. Commit and push what you have on the plan branch. Do not open a PR for a BLOCKED
   plan unless the plan says otherwise.
5. End the run.

A step whose **Check** fails after one fix-and-retry is a STOP. A drift-check mismatch
is a STOP. A missing **Requires** artefact is a STOP. A "manual" check is a STOP.

## 11. Report

Every plan ends by writing `plans/reports/NNN.md` from this template. Fill every field;
write `n/a` rather than leaving a field blank.

```markdown
# Report: Plan NNN — <title>

- Branch: plan/NNN-<slug>
- Grounded at: <sha>
- Started at commit: <sha of origin/main when the branch was created>
- Executor: <model or person>
- Result: DONE | STOPPED at Step N

## Pre-flight

<output of `bash scripts/preflight.sh NNN`, or the manual checks>

## Steps

| Step | Commit | verify:static | verify:web | verify:electron | Notes |
| ---- | ------ | ------------- | ---------- | --------------- | ----- |
| 1    | <sha>  | 0             | 0          | n/a             |       |

## Numbers

<every number the plan asked you to record: before / after, with the command that
produced it>

## Screenshots

<list of `docs/planning/screenshots/...` paths for Kyle to review, one line each, with
what changed and why it was expected>

## Decisions raised

<list of `docs/planning/decisions/...` files created, or "none">

## Deviations

<anything you did that the plan did not say, with the reason; or "none">

## STOPPED

<only if Result is STOPPED: step, condition, output, suggested fix>

## Handoff

- Next plan's Grounded at: <merge sha, filled after merge>
- Things the next executor should know: <bullets>
```

## 12. Environment facts every plan relies on

- Node 20 or newer, npm 10 or newer. CI uses Node 20.
- `npm install` does **not** install Playwright browsers; `npx playwright install
chromium` does.
- Playwright's `Web-Chromium` project starts `npm run dev:web` locally and `npm run
preview:web` when `CI=1`. To test the built output locally, set `CI=1`.
- The Electron project needs `npm run build:electron` first and `xvfb-run -a` on Linux.
- `tsconfig.json` excludes `**/*.test.tsx`; only `npm run test:run` catches a broken
  test file.
- ESLint runs with `--max-warnings 0` and `--report-unused-disable-directives`; an
  unused `eslint-disable` comment fails lint.
- Husky runs lint-staged on commit: `eslint --fix` + `prettier --write` on staged
  `*.{ts,tsx}`, `prettier --write` on `*.{js,jsx,json,md,css}`. Expect it to reformat
  what you stage; that is normal. Do not bypass it.
- `.ai-rules.md` at the repo root is mandatory reading for any `src/` change.
