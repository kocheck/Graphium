# Plans

UI redesign program for Graphium. Developed with the `improve` skill on 2026-09-04,
grounded at commit `d3d3642`.

**Read the plan fully before starting it. Honor its STOP conditions. Update your row
below when done.**

## The shape of this program

Kyle's ask: the UI is stale and should be completely rethought, with the result being
more extendible and more performant, probably via shadcn components.

Three framing decisions, made 2026-09-04:

1. **Both layers, sequenced** — rebuild the foundation first (tokens, primitives,
   performance), then do the visual redesign on top of it.
2. **Full shadcn adoption** — `components.json`, the CLI, Radix Primitives, CVA, with
   the source owned in-repo and re-themed onto Graphium's existing Radix Colors
   variables. Gated on a compatibility spike (plan 002) because shadcn's happy path
   is React 19 and Graphium is React 18.
3. **Strangler-fig, always shippable** — the new layer lands alongside the old,
   screens migrate one at a time, and every commit is releasable.

**The value is realized in plan 004, and the goal is plan 006.** Plans 001–003 are
foundation: real work, but the user sees nothing. Stopping between 003 and 004 is the
worst outcome available — two component systems, permanently. If the program has to be
cut short, cut it after 004, not before.

## Order & status

| Plan | Title | Priority | Effort | Risk | Depends on | Status |
|------|-------|----------|--------|------|------------|--------|
| 001 | Make the styling layer have exactly one source of truth | P1 | S | LOW | — | TODO |
| 002 | Prove shadcn/ui works on this stack before committing to it | P1 | S | LOW | 001 | TODO |
| 003 | Build the shared UI primitive layer | P1 | L | MED | 001, 002 | TODO |
| 004 | Migrate every screen onto the primitive layer | P1 | L | MED | 003 | TODO |
| 005 | Fix the DOM-layer performance drags | P2 | M | MED | 001 | TODO |
| 006 | Redesign the visual language and information architecture | P2 | L | MED | 003, 004 | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (one-line reason) | REJECTED (one-line rationale)

## Dependency notes

- **002 depends on 001** because the spike installs against the Tailwind v4 CSS
  config that 001 establishes. Spiking against the broken config would prove nothing.
- **003 depends on 002** because 003's first step is executing the install sequence
  that 002 proved. Without the spike's decision doc, 003 improvises — which is exactly
  what this plan set is built to prevent.
- **004 depends on 003** and is where the program pays off. Do not let 003 land and 004
  stall.
- **005 only hard-depends on 001**, so it *can* run in parallel with 003/004.
  **Recommended: run it after 004**, because 004 rewrites most of the components 005
  would optimize. Run it earlier only if a performance problem is actively hurting
  users now.
- **006 depends on 004** for two reasons: the token architecture must be in place for
  a palette change to propagate, and 006's Step 1 consumes
  `docs/planning/ui-redesign-ideas.md`, written during 004's migration by whoever has
  just read every UI file in the app.

## What grounds these plans

Verified in the codebase at `d3d3642`, not assumed:

- **Four competing styling systems**: `theme.css` semantic variables, `app.css`
  hand-rolled utilities (with hardcoded colors), Tailwind classes, and **286 inline
  `style={{}}` objects across 41 files**. The toolbar at `src/App.tsx:556` declares its
  background twice, in two systems, and is black in light mode either way.
- **Tailwind v4 is running a v3 config it silently ignores.** `src/index.css:1` uses
  v4 syntax; `tailwind.config.js` is v3-style with no `@config` directive. The
  `slide-down` keyframe it defines is consumed at `Toast.tsx:82` — so the toast
  animation is very likely dead in the shipped app. *(High confidence, not yet
  executed — plan 001 Step 1 is the empirical check.)*
- **Nine components hand-roll a modal overlay; exactly one has a focus trap**
  (`AboutModal.tsx:279–297`). Three — `MapSettingsSheet`, `AddToLibraryDialog`,
  `ImageCropper` — have no `role="dialog"` or `aria-modal` at all. Four never handle
  Escape.
- **All eleven `React.memo` calls are in `src/components/Canvas/`.** The canvas is
  well optimized (see `docs/architecture/PERFORMANCE_OPTIMIZATIONS.md`); the DOM chrome
  layer has zero memoization, one lazy import, and no manual chunking.
- **A 1274-line internal developer tool** (`playground-registry.tsx`) is statically
  imported at `src/App.tsx:21` and ships to every user.
- **A universal-selector CSS transition** at `src/styles/theme.css:291` applies five
  transitioning properties to every element in a canvas app.
- **`src/App.css` is dead** — leftover Vite scaffolding, imported by nothing.

Two assets that make this program tractable:

- **E2E selectors are `data-testid`-based, not CSS/DOM-based** (51 uses of
  `[data-testid^="token-"]` alone). A migration that preserves testids is verifiable
  at every step. This is why plan 004 can be twelve steps and still be safe.
- **A Design System Playground already exists** at `/design-system` — a ready-made
  surface for validating primitives and prototyping the redesign without touching a
  real screen.
- **Radix *Colors* is already a dependency** (not Radix Primitives). shadcn is built on
  Radix Primitives, so the adoption is directionally consistent with where the codebase
  already is, and the audited WCAG-AA color system survives the move rather than being
  replaced.

## Considered and set aside

- **Replacing `CommandPalette` with shadcn's `command`.** Graphium has a working
  420-line palette with its own registry (`src/utils/commandRegistry.ts`). Replacing it
  is a feature decision, not a primitive-layer one. Out of scope across the whole set.
- **Upgrading to React 19** to match shadcn's documented happy path. A large
  independent migration touching Konva, react-konva, and the Electron renderer.
  Plan 002 explicitly forbids doing it as a means to unblock the spike; if the spike
  concludes it is required, that is a finding to report, not a change to make.
- **Sweeping all 286 inline `style={{}}` objects in one pass.** Most read theme
  variables correctly and are not wrong, just un-reusable. They get resolved for free,
  per component, during plan 004's migration. A standalone sweep would be a large,
  risky, low-value diff.
- **A big-bang UI rewrite behind a feature freeze.** Rejected in favor of
  strangler-fig: 93 test files and a shipping app at v0.5.3 make a long red branch a bad
  trade.
- **Optimizing the canvas / fog-of-war rendering.** Already tuned deliberately —
  delta IPC, cached visibility polygons, Web Worker image processing. Plan 005 has
  nothing to add there and is explicitly forbidden from touching it.
- **Fixing the placeholder `via.placeholder.com` GIFs in `README.md`.** Real, but
  unrelated to the UI architecture. Noted at the end of plan 006 as a follow-up.
