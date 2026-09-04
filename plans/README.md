# Plans

UI redesign program for Graphium. Developed with the `improve` skill on 2026-09-04,
grounded at commit `d3d3642`, then **revised after a seven-reviewer cold audit** — one
reviewer per plan reading it with no context as the executor would, plus one on the set
as a whole. Every plan changed; two were rewritten; one (000) was added.

**Read the plan fully before starting it. Honour its STOP conditions. Update your row
below when done.**

## The shape of this program

Kyle's ask: the UI is stale and should be completely rethought, with the result more
extendible and more performant, probably via shadcn components.

Three framing decisions, made 2026-09-04:

1. **Both layers, sequenced** — rebuild the foundation first, then redesign visually.
2. **Full shadcn adoption** — CLI, `components.json`, Radix Primitives, CVA, source
   owned in-repo and re-themed onto Graphium's existing Radix Colors variables. Gated on
   a compatibility spike (002) because shadcn's happy path is React 19 and this is React 18.
3. **Strangler-fig, always shippable** — the new layer lands alongside the old, screens
   migrate one at a time, every commit is releasable.

Those hold. **What the audit changed is the honesty of the verification and the
sequencing of the visible work.**

## What the audit found

**The systemic defect: every plan built its gates on test infrastructure nobody had
checked actually runs.**

- `tests/accessibility.spec.ts` contains exactly one navigation — `page.goto(baseURL)` —
  and scans the **home screen only**. It never reaches the editor, a dialog,
  `/design-system`, or the World View. Plans 001, 002, 003 and 006 each called it their
  most important gate, and each changes things it cannot see.
- `npm run test:e2e` ran **4 of 22 spec files**. `playwright.config.ts` ignored ten
  functional specs, the performance spec and the visual spec, because they wait on
  testids — `campaign-title`, `token-*`, `add-token-button`, `tool-marker` — that have
  **zero occurrences in `src/`**. Plan 004's entire twelve-step design rested on that
  suite. **Not one of the ~20 files plan 004 migrates contains a `data-testid` at all.**
- `tests/performance/drawing-performance.spec.ts`, cited by plan 005 as "the existing
  bar", selected **zero tests** in every project.
- Plan 005's premise was wrong: a grep that missed `export default memo(...)` produced
  "all eleven memos are in `Canvas/`". There are **twelve**, and `Sidebar` (memoised,
  zero props) and `CanvasManager` are among them — so two of that plan's acceptance
  criteria were respectively already-true and impossible.

**Plan 000 is new and fixes this.** It runs first, and every other plan now depends on it.

**Other things the audit surfaced, now folded into the plans:**

- **Eleven components hand-roll a modal overlay, not nine.** The two worst omissions were
  the DM's own asset surfaces: `AssetLibrary/LibraryManager.tsx` (442 lines) and
  `AssetLibrary/TokenMetadataEditor.tsx` (322) — neither with Escape nor `aria-modal`.
- **The entire mobile surface was invisible.** `MobileToolbar.tsx` (325),
  `MobileSidebarDrawer.tsx`, `MobileBottomSheet.tsx`. Leaving them would have guaranteed
  "two component systems" for every touch user — the outcome this program exists to
  prevent — while the README sells touch and pen as first-class. Now in plan 004.
- **An undocumented `data-esc-owns="true"` protocol** across nine overlays gates whether
  Escape stops Session Console audio. Rebuilding on Radix without re-attaching it kills
  the DM's music mid-session. No plan mentioned it. Now a Done criterion in 004.
- **396 hardcoded Tailwind palette classes across 35 files, with zero `dark:` variants
  anywhere.** The hex/rgb greps every plan used catch none of them. This is the bulk of
  the theme-invariance problem — 400× the single `.toolbar` case plan 001 fixes.
- **The token layer is colour-only.** All 43 `--app-*` variables are colours, including
  `--app-shadow-*` which are colours rather than shadows. Plan 006 asked for decisions on
  spacing, type, elevation and motion, then claimed one token commit re-skins the app.
  True for colour, false for the rest. Creating the families is plumbing; plan 000 does it.
- **`PreferencesDialog.tsx` is dead code** — zero importers, and it carries
  `eslint-disable import/no-unused-modules` at line 677. It also holds 45 of the 286
  inline styles. Plan 004 no longer migrates it; Kyle decides its fate.
- **`ConfirmDialog` renders with three undefined CSS variables** (`--app-bg`,
  `--app-border`, `--app-text` — the real names are `--app-bg-surface` etc.), so it has
  no surface colour today. "Visually neutral" was undefinable for it; plan 004 now fixes
  the bug as part of the migration.
- **`btn-secondary` (18 uses), `btn-ghost` (8), `btn-destructive` (1) are defined in no
  CSS file.** They all render as bare `.btn` — transparent. Mapping them onto shadcn
  variants by name would have restyled 27 buttons inside a "neutral" migration.
- **The pause button is grey.** `src/App.tsx:564-568` puts `bg-red-500`/`bg-green-500`
  on an element carrying `.btn-tool`; `src/index.css` imports `app.css` **unlayered**
  and Tailwind v4 emits utilities into `@layer utilities`, so the unlayered rule wins and
  the pause state never shows. A live, user-facing bug in a shipping app — **now fixed in
  plan 001 Step 8**, rather than deferred to 004 (XL, far out). It also means plan 001
  Step 7 is a no-op, and plan 004 must *preserve* the fix rather than expect to make it.
  The same cascade rule applies to any element carrying both a `.btn*` class and a
  Tailwind colour utility.
- **`bare npm run test:e2e` cannot pass on a clean machine** — it runs the Electron
  project, which needs `npm run build:electron` first. Every plan's STOP conditions would
  have read that self-inflicted failure as a real coupling problem. All six plans now use
  the two project-scoped commands.

## Order & status

| Plan | Title | Priority | Effort | Risk | Depends on | Status |
|------|-------|----------|--------|------|------------|--------|
| 000 | Make the verification gates actually verify | **P0** | M | LOW | — | TODO |
| 001 | One source of truth for styling | P1 | S | LOW | 000 | TODO |
| 002 | Prove shadcn works on this stack | P1 | S | LOW | 000, 001 | TODO |
| 003 | Build the shared UI primitive layer | P1 | L | MED | 000, 001, 002 | TODO |
| 006 **Steps 1–4** | Audit, direction, IA, and write 006's real steps | **P1** | M | LOW | 000, 001, 003 | TODO |
| 004 | Migrate every screen onto the primitive layer | P1 | **XL** | **HIGH** | 000, 003 | TODO |
| 006 **Steps 5+** | Apply the redesign | P2 | L | MED | 004, 006 Steps 1–4 | TODO |
| 005 | Fix the DOM-layer performance drags | P2 | M | MED | 000, 001, **004** | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (one-line reason) | REJECTED (rationale)

## What changed in the sequencing, and why

**006 Steps 1–4 moved earlier, and split from Steps 5+.** They have no technical
dependency on 004 — the audit, the prototyped directions, and the IA decisions need only
001's tokens and 003's primitives, and they prototype on `/design-system`. Under the
original order, Kyle would have seen nothing visible for months: five fully-specified
plans that change nothing a user notices, then one unwritten plan carrying all of it.
Running the design work early gives 004 a target instead of a promise, and forces the
token gaps into the open while there is still foundation budget.

**005 moved after 004, and is no longer "parallel".** The original note warned that 004
would invalidate 005's work. The reverse is worse and was unstated: 005 moves tool state
into a store and adds `lazy()` boundaries around exactly the components and the toolbar
that 004 rewrites, and 004 has no instruction to preserve either. Running 005 first means
doing it twice.

**004's effort went L → XL and risk MED → HIGH.** Twenty files, ~4,600 lines, fifteen
commits, and — now that the E2E claim is corrected — far thinner automated coverage than
the original plan assumed. Its new Step 0 captures a screenshot baseline, because for
many of these components that is the only evidence available.

## Dependency notes

- **Everything depends on 000.** Plans 001, 002, 003 and 006 name `npm run test:a11y` as
  their most important gate; 004's design assumes a meaningful E2E suite; 005 cited a
  spec selecting zero tests. None of those claims was true beforehand.
- **002 depends on 001** — the spike installs against the Tailwind v4 CSS config 001
  establishes. Spiking against the broken config proves nothing.
- **003 depends on 002** and now branches on its verdict: a NO-GO means 003 must be
  rewritten for the "pattern only, no CLI" fallback, not improvised through.
- **004 depends on 003**, and 003's `sheet`, `popover` and `dropdown-menu` are now
  **required, not optional** — 004 Steps 4–5 have no fallback without `sheet`.
- **006 Steps 5+ depend on 004** for the migrated screens and on 006 Steps 1–4 for the
  decisions.

## Considered and set aside

- **Replacing `CommandPalette` with shadcn's `command`.** Graphium has a working
  420-line palette with its own registry. A feature decision, not a primitive-layer one.
- **Migrating `ErrorFallbackUI.tsx` / `UpdateErrorFallbackUI.tsx`.** They render when
  React has already failed; making the last line of defence depend on a portal-based
  primitive adds a failure mode. Deliberately excluded, recorded in 004.
- **Upgrading to React 19.** A large independent migration touching Konva, react-konva
  and the Electron renderer. 002 forbids doing it to unblock the spike.
- **Sweeping all 286 inline styles, or all 396 hardcoded palette classes, in one pass.**
  Both are resolved per-component as 004 touches each file. A standalone sweep would be a
  large, risky, low-value diff. The surviving count is recorded for 006.
- **A big-bang rewrite behind a feature freeze.** 93 test files and a shipping app at
  v0.5.3 make a long red branch a bad trade.
- **Optimising the canvas / fog-of-war.** Already tuned deliberately. 005 is forbidden
  from touching it.
- **Fixing `README.md`'s broken hero image** (`public/screenshots/graphium-overview.png`
  does not exist; the directory has `Graphium-1..4.png` and `Graphium-show.gif`) and its
  `via.placeholder.com` GIFs. Real, unrelated to UI architecture; noted at the end of 006.

## How the work lands: one PR per plan, into `main`

**Decided 2026-09-04.** Each plan is developed on its own branch off `main` and merged
as a single PR into `main` before the next begins. Every plan's "How this plan lands"
section carries the details.

The reason is that this is the only way CI runs. Verified in `.github/workflows/`:
`lint.yml`, `test.yml` and `e2e.yml` trigger on `pull_request` → `main`;
`accessibility.yml` on `main` or `NEXT`; both `documentation-check` workflows on `main`.
**Nothing fires on a long-lived feature branch.** The original approach ("one branch,
don't open a PR") would have run ~40 commits of work against local `npm run` on one
machine — which is exactly how the unverified-gate problem got in.

Two exceptions and two consequences:

- **002 is docs-only.** The spike branch is deleted; only
  `docs/planning/shadcn-adoption-decision.md` reaches `main`, as a small PR.
- **006 lands as two PRs** — `006a` (Steps 1–4, docs and playground prototypes, mergeable
  while 004 is still in flight) and `006b` (Steps 5+, after 004).
- **004 will not fit in one PR** and is pre-split at five step boundaries, each a
  releasable unit. 003 splits at its three tranche boundaries if needed.
- **Merging to `main` auto-deploys the public web build** (`deploy-web.yml` runs on every
  push to `main`). Intermediate migration states will go live on GitHub Pages. That
  follows from "every commit is releasable" — but if the web demo must stay pinned, say
  so before starting 001, not after.

## Known gaps this program does not close

Recorded so they are decisions rather than oversights:

- **No changelog or versioning guidance.** The app is at v0.5.3 with a maintained
  `CHANGELOG.md`, `build-release.yml` and an auto-updater. A program that rewrites the UI
  should produce entries; none of these plans does. (`build-release.yml` fires on
  `v*.*.*` tags only, so nothing here triggers a release by accident.)
- **Docs falsified by this work and unowned**: `docs/architecture/ARCHITECTURE.md`,
  `docs/guides/CONVENTIONS.md` (which prescribes `@components/*` aliases while 002 adds
  `@/*`), `.cursorrules`, `.ai-rules.md`, and `docs/documentation-inventory.md`.
  (`src/components/README.md` was in this list and is now plan 000 Step 6 — the doc-check
  bot comments on nearly every PR under the new workflow, so leaving it wrong would train
  reviewers to ignore it.)
- **The World View is treated only as a constraint, never as a design surface.** For a
  product whose distinctive feature is the player-facing projection, "completely
  rethought" leaving that half untouched is a scope decision — made explicit as the sixth
  question in 006 Step 3, but worth Kyle's attention now.
