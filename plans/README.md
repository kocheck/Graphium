# Plans

UI redesign program for Graphium. Developed with the `improve` skill on 2026-09-04, grounded
at commit `d3d3642`, then revised twice: once after a seven-reviewer cold audit (which
invalidated the verification gates every plan relied on), and once after an eight-reviewer
**weak-executor dry run** (which found that no plan could be run by a literal-minded model
as written). This README describes the program as it stands after the second revision.

**Executors: read `plans/CONVENTIONS.md` first, then your plan, and nothing else.** The
conventions file is the shared contract: glossary, gates, pre-flight, grounding, step
format, branching and PRs, how to STOP, how to raise a decision for Kyle, and the report
template. Every plan assumes you have read it.

## The shape of this program

Kyle's ask: the UI is stale and should be completely rethought, with the result more
extendible and more performant, probably via shadcn components.

Three framing decisions, made 2026-09-04:

1. **Both layers, sequenced** — rebuild the foundation first, then redesign visually.
2. **Full shadcn adoption** — CLI (pinned to `shadcn@1.1.23`), `components.json`, Radix
   Primitives, CVA, source owned in-repo and re-themed onto Graphium's existing Radix
   Colors variables. Gated on a compatibility spike (002) because shadcn's happy path is
   React 19 and this is React 18.
3. **Strangler-fig, always shippable** — the new layer lands alongside the old, screens
   migrate one at a time, every commit is releasable.

Six further decisions were made on 2026-09-04 during the second review. They are recorded
in `plans/CONVENTIONS.md` §9 so executors never re-ask them: delete `PreferencesDialog`;
pin the web deploy to manual dispatch for the program's duration; executors are headless
and every visual check is a screenshot Kyle reviews in the PR; the nine stale functional
specs are deleted rather than "restored"; plan 006 runs against a written design brief
(`docs/planning/ui-redesign-brief.md`); and Kyle's decisions travel as files with a
`PENDING`/`DECIDED` status.

## What the two audits found

**First audit (seven reviewers): every plan's gates were gates in name only.** The a11y
suite scanned the home screen only; `npm run test:e2e` ran 4 of 22 spec files; the perf
spec selected zero tests; plan 005's premise about memoisation was wrong. Plan 000 was
added to repair this and every other plan was made to depend on it. The audit also
surfaced the `data-esc-owns` Escape protocol, eleven (not nine) hand-rolled overlays, the
unlayered-`app.css` cascade bug that keeps the pause button grey, three undefined
`btn-*` classes, three undefined CSS variables in `ConfirmDialog`, 396 hardcoded palette
classes with zero `dark:` variants, and a colour-only token layer.

**Second audit (eight reviewers, simulating a weak executor): none of the seven plans could
be executed as written.** The causes clustered:

- Every plan's drift check compared against `d3d3642`, so honouring the dependency on the
  previous plan guaranteed a STOP on line one. Fixed by grounding each plan at the previous
  plan's merge commit (CONVENTIONS §5).
- Plan 000's restore-or-delete triage was not a real choice: the ignored specs need ~190
  test ids for UI that does not exist, and the helper meant to reach the editor silently
  fell back to the home screen. Fixed by pre-deciding deletion, fixing the helper, and
  building a shared surface helper, screenshot harness and overlay-contract spec.
- Plan 001's `@theme` code block contradicted its prose and its keyframe double-shifted the
  toast under Tailwind v4. Plan 002 pinned no CLI version and had an unreachable GO verdict.
  Plan 005's profiler discriminator was false. Plan 006's first instruction read a file plan
  004 writes last. Seven cross-references pointed at the wrong step or count. All fixed.
- Structurally: ~200 lines of verbatim duplication, "Kyle confirms" and "by eye" checks a
  model cannot perform, no per-file checklist for plan 004's twenty files, no code where a
  weak model needs code to copy, no report template, no way to raise a decision. All now
  live in `CONVENTIONS.md` and the plans use them.

## Order & status

| Plan | Title                                           | Priority | Effort | Risk | Depends on        | Grounded at                           | Status |
| ---- | ----------------------------------------------- | -------- | ------ | ---- | ----------------- | ------------------------------------- | ------ |
| 000  | Make the verification gates actually verify     | **P0**   | L      | LOW  | —                 | `d3d3642`                             | TODO   |
| 001  | One source of truth for styling                 | P1       | S      | LOW  | 000               | ‹000 merge SHA›                       | TODO   |
| 002  | Prove shadcn works on this stack                | P1       | S      | LOW  | 000, 001          | ‹001 merge SHA›                       | TODO   |
| 003  | Build the shared UI primitive layer             | P1       | L      | MED  | 000, 001, 002     | ‹002 merge SHA›                       | TODO   |
| 006a | Audit, three directions, IA, write 006b's steps | **P1**   | M      | LOW  | 000, 001, 003     | ‹003 merge SHA›                       | TODO   |
| 004  | Migrate every screen onto the primitive layer   | P1       | **XL** | HIGH | 000, 003          | ‹003 merge SHA› (six PRs, sequential) | TODO   |
| 005  | Fix the DOM-layer performance drags             | P2       | M      | MED  | 000, 001, **004** | ‹004 final merge SHA›                 | TODO   |
| 006b | Apply the redesign                              | P2       | L      | MED  | 004, 005, 006a    | ‹005 merge SHA›                       | TODO   |

Status values: `TODO` | `IN PROGRESS` | `DONE <merge sha>` | `BLOCKED (one-line reason, or
decision NNN-topic)` | `REJECTED (rationale)`. The executor of each plan writes the merge
SHA into the next plan's **Grounded at** line and into this table as its final step.

## Sequencing notes

- **Everything depends on 000.** It is now the infrastructure plan: `npm run verify:*`,
  `scripts/preflight.sh`, `tests/helpers/surfaces.ts`, `npm run shots`, the overlay-contract
  spec, the touch-target spec, the non-colour token families, the `PreferencesDialog`
  deletion, the `deploy-web.yml` pin, and the docs that lied about how to run tests.
- **002 depends on 001** — the spike installs against the Tailwind v4 CSS config 001
  finishes. 002 leaves `docs/planning/shadcn-adoption-decision.md` **and**
  `docs/planning/shadcn-spike.patch`; 003 applies the patch rather than re-running an
  interactive CLI.
- **003 branches on 002's verdict.** GO or GO-WITH-CAVEATS proceed (caveats are numbered
  required changes); NO-GO is a STOP and 003 must be rewritten for "pattern only, no CLI".
- **006a runs after 003 and before 004 finishes.** Its first step no longer requires
  `docs/planning/ui-redesign-ideas.md` (plan 004's last output); it creates the file if
  absent and 004 appends. 006a ends BLOCKED on two decision files (direction, IA) and a
  reviewed Steps 5+ section; 006b starts only after 004 and 005 merge.
- **004 is six sequential PRs**, each releasable, each under ~1,500 changed lines. It also
  extracts `src/components/Toolbar.tsx` (Step 10), which 005 depends on.
- **005 runs after 004**, never in parallel: 004 rewrites the components 005 optimises, and
  005 moves the toolbar's state into a store the extracted `Toolbar.tsx` reads.
- **006b is the end of the program.** Its final steps restore the `deploy-web.yml` push
  trigger, empty plan 000's contrast-deferral list, and fix the README hero image.

## Considered and set aside

- **Replacing `CommandPalette` with shadcn's `command`.** Graphium has a working 420-line
  palette with its own registry. A feature decision, not a primitive-layer one.
- **Migrating `ErrorFallbackUI.tsx` / `UpdateErrorFallbackUI.tsx`.** They render when React
  has already failed; making the last line of defence depend on a portal-based primitive
  adds a failure mode. Deliberately excluded, recorded in 004.
- **Upgrading to React 19.** A large independent migration touching Konva, react-konva and
  the Electron renderer. 002 forbids doing it to unblock the spike.
- **Sweeping all inline styles or all hardcoded palette classes in one pass.** Both are
  resolved per-component as 004 touches each file, with a ratchet test (001) and an ESLint
  override that grows file by file (004) so the count only goes down.
- **A big-bang rewrite behind a feature freeze.** 93 test files and a shipping app at
  v0.5.3 make a long red branch a bad trade.
- **Optimising the canvas / fog-of-war.** Already tuned deliberately. 005 is forbidden from
  touching it.
- **`sonner` for toasts.** `gameStore` models a single toast; sonner stacks. Keep `Toast.tsx`.
- **Restoring the nine stale functional specs.** They wait on ~190 test ids for UI that was
  never shipped. Deleted in 000 with their lost coverage recorded; replaced by small
  smoke specs on the surface helper.

## Known gaps this program does not close

- **Versioning.** Each plan adds a bullet under `CHANGELOG.md` `## [Unreleased]` for
  user-visible changes, but nobody cuts a release; `build-release.yml` fires on `v*.*.*`
  tags only.
- **The Electron package** (`npm run build`, electron-builder) is exercised once in 003
  and once in 005; it is not a per-PR gate.
- **Real-display checks** (the World View on an actual TV at viewing distance, the
  Electron windows side by side) are not gates. They are notes in the 006b PR body for
  Kyle. The gates are the `world`/`world-dialog` surfaces and `tests/world-legibility.spec.ts`.
- **The design brief is Claude's draft of Kyle's taste**, assembled from the README and
  his saved references. Plan 006a's Step 0 refuses to run until Kyle has confirmed it.
