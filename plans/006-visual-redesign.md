# Plan 006: Redesign the visual language and information architecture

> **Executor instructions**: This plan has a different shape from 001–005. Its
> **first four steps are design decisions that must be made and signed off by Kyle
> before any code is written.** Do not skip to implementation. Steps 5+ are
> deliberately specified at a lower resolution than the earlier plans, because they
> depend on decisions that do not exist yet — Step 4 is where this plan gets
> rewritten at full resolution.
>
> If anything in "STOP conditions" occurs, stop and report. When done, update the
> status row in `plans/README.md`.
>
> **Read `docs/planning/ui-redesign-ideas.md` before Step 1.** It is the output of
> plan 004 Step 12 and is written by whoever just read every UI file in the app.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/000-repair-verification-infrastructure.md, plans/001-stabilize-styling-foundation.md, plans/003-build-primitive-layer.md
- **Partial dependency**: plans/004 — Steps 1-4 of this plan can and should run *before* 004 completes; only Steps 5+ need it. See the sequencing note below.
- **Category**: design
- **Grounded at**: `d3d3642` (2026-09-04) — but see the note below

> **On grounding**: the "current state" facts here are accurate at `d3d3642`, but the
> earlier plans change the code substantially. **Re-ground before starting**: re-read
> `src/styles/theme.css`, `src/components/ui/README.md`, `src/index.css`, and
> `docs/planning/verification-baseline.md`. If `src/components/ui/README.md` does not
> exist, plan 003 has not landed — **STOP**, do not merely update prose.
>
> **Sequencing — this changed after review.** Steps 1–4 (audit, direction, IA, and
> rewriting Steps 5+) have **no technical dependency on plan 004**. They need 001's
> token plumbing and 003's primitives, and they prototype on `/design-system`. Running
> them early is strongly recommended: it gives Kyle something to look at while 004 is
> still in progress, gives 004 a target instead of a promise, and surfaces token gaps
> while there is still foundation budget. Steps 5+ wait for 004.

## Why this matters

Kyle's original framing was that the UI is "stale." Plans 001–005 fix the reasons
the UI is *hard to change*. They do not, by design, change how it *looks* — plan 004
is explicitly behavior- and visually-neutral, so that the migration is provable.

That work is the prerequisite, not the goal. This plan is the goal.

The honest diagnosis of "stale": **Graphium has a strong, specific brand identity
that its interface does not express.** The README commits to it in detail —
*"Tactile Cartography," "The Weight of Creation," "funicular friction — a satisfying
bite to every interaction," "Whiteboards are for brainstorming. Graphium is for
history," the Roman wax tablet, the stylus, the permanent etching.* That is a
genuinely distinctive product position for a VTT.

The interface, meanwhile, is neutral dark-slate Radix on Tailwind defaults. It could
be any developer tool built in the last five years. Nothing about it feels like
carving, weight, or permanence. **The gap between the stated identity and the
delivered interface is what reads as "stale"** — not the absence of a trend, but the
absence of a point of view.

After plans 001–005, acting on that is cheap: change a token, every component
follows; add a variant, every button gets it. That is what the foundation was for.

## Context the executor needs

### What exists after plans 001–005

- **A token layer covering colour *and*, after plan 000 Step 5, radius, elevation,
  duration, easing and type scale.** Changing a token changes every component that
  consumes it.
  > **Verify this before relying on it.** At `d3d3642` all 43 `--app-*` variables were
  > colours — including `--app-shadow-sm|md|lg`, which are `var(--slate-a3)`/`a6`/`a8`,
  > *colours* rather than `box-shadow` values. Plan 000 Step 5 adds the non-colour
  > families. If it did not, Step 5 of this plan cannot "re-skin the entire app" in one
  > commit for anything but colour, and you must add the missing families before
  > proceeding — that is plumbing, not a design decision.
- **~370 hardcoded Tailwind palette classes still in files plan 004 did not touch**
  (396 at `d3d3642`, across 35 files, with **zero `dark:` variants anywhere**). A
  palette change will **not** reach them. Plan 004 records the surviving count; treat it
  as a known limit on how far Step 5 propagates, and decide in Step 3 whether closing
  the gap is in this plan's scope.
- **A primitive layer** in `src/components/ui/`, with a documented contribution
  contract in `src/components/ui/README.md`, including Graphium-specific CVA
  variants (`tool`, `mode`, `broadcast` on `button`).
- **Most screens consuming those primitives**, with substantially fewer inline styles.
  Not *all*: plan 004 deliberately excludes `ErrorFallbackUI.tsx` and
  `UpdateErrorFallbackUI.tsx` (they render when React has already failed, so a
  portal-based primitive would add a failure mode to the last line of defence), and the
  `CommandPalette` is out of the roster program-wide. Those stay hand-rolled by design.
- **A Design System Playground** at `/design-system` where every primitive renders
  in both themes — the natural place to prototype a new visual language before
  touching a single screen.
- **A repaired verification suite** (plan 000): `npm run test:a11y` scanning five
  surfaces in both themes, an E2E suite with `testIgnore` emptied of stale entries, and
  an executable touch-target baseline. Read `docs/planning/verification-baseline.md` for
  what covers what — and note whether plan 000 **restored or deleted
  `tests/visual.spec.ts`**. If restored, it is this plan's single most useful gate and
  you should rebaseline its screenshots in Step 5. If deleted, this plan has **no
  visual-regression net** and every visual check falls to eyes and Kyle — say so
  explicitly rather than discovering it late.

### Constraints that do not change

- **The World View is sacred.** It is projected to players, often on a TV. It must
  stay clean, high-contrast, legible at distance, and free of new DM chrome. Any
  redesign decision that makes the Architect View prettier at its expense is wrong.
  > **It has an objective check — use it.** `src/utils/useWindowType.ts` documents the
  > `?type=world` query parameter, so `http://localhost:5173/?type=world` renders the
  > player projection in the web build: axe-scannable, screenshot-diffable, assertable.
  > An earlier draft asked a human to "ideally" squint at a TV, on the surface it itself
  > calls sacred and admits nobody remembers to check. Do both — the automated scan every
  > step that touches shared tokens, the TV once at the end.
- **WCAG 2.1 AA is a hard floor.** After plan 000, `npm run test:a11y` scans five
  surfaces in both themes — it is a real gate, not the home-screen-only scan it was.
  > `docs/features/wcag-audit.md` **cannot serve as the bar for a new palette.** Its
  > ratios are inherited from Radix ("Steps 11-12 … *guaranteed* WCAG AA"), so the
  > moment a direction leaves the Radix scales the document is void. Compute real
  > ratios for the proposed palette, and **update that document in Step 5** — it is
  > listed in Done criteria.
  > One known existing failure to fix rather than inherit: `--app-error-solid`
  > (`--red-9`, `#e5484d`) with white text is ~**3.9:1**, below the 4.5:1 normal-text
  > floor. Plan 000 recorded it and deferred the fix here.
- **Both themes must work.** Dark is the likely default for a table-side tool in a
  dim room, but light mode is not optional.
- **Touch and pen are first-class.** `TOUCH_SUPPORT_MIGRATION.md` and
  `DEVICE_COMPATIBILITY.md` describe device capabilities but contain **no pixel
  minimums** — do not cite them as the baseline. The real minimums are inline and
  inconsistent (48px at `src/App.tsx:528-529`, 44px in `TokenInspector` and
  `HomeScreen`, 56px in `MobileToolbar`, and none at all on `.btn-tool`). **Plan 000
  Step 4 captured them as an executable spec**; that spec is the gate. A redesign that
  shrinks controls for elegance breaks the tablet story the README sells.
- **The canvas is the product.** Chrome should recede. Graphium is a tool used for
  hours at a time; a UI that demands attention is a worse UI here.
- **Fonts**: `@ibm/plex` is already a dependency, wired through `src/styles/fonts.css`
  (139 lines). Typography changes should start there.

### What is NOT yet decided

This is the part that makes this plan different. **None of these have answers yet,
and inventing them is out of scope for the executor:**

- ‹**The visual direction itself.** What does "etched, weighty, permanent" look like
  as an interface? Kyle decides this in Step 2.›
- ‹**The information architecture.** Is the current layout — left sidebar, bottom
  floating toolbar, modal-heavy settings — right? Or should the redesign change what
  lives where? Decided in Step 3.›
- ‹**Scope of change.** Every screen, or the high-traffic ones only (toolbar, sidebar,
  home screen)? Decided in Step 4.›

## Inputs & resources

**Read first**:
- `docs/planning/ui-redesign-ideas.md` (from plan 004 Step 12) — the deferred-ideas list
- `README.md` — the brand language this redesign must deliver on
- `src/components/ui/README.md` — the contribution contract
- `docs/features/wcag-audit.md` — the contrast floor
- `TOUCH_SUPPORT_MIGRATION.md` and `DEVICE_COMPATIBILITY.md` — the touch constraints

| Purpose        | Command                    | Expected on success        |
|----------------|----------------------------|----------------------------|
| Lint           | `npm run lint`             | exit 0                     |
| Typecheck      | `npm run type-check`       | exit 0                     |
| Unit tests     | `npm run test:run`         | all pass                   |
| Web build      | `npm run build:web`        | exit 0                     |
| Electron dev   | `npm run dev`              | app + World View launch    |
| A11y E2E       | `npm run test:a11y`        | all pass                   |
| Web E2E        | `npm run build:web && npx playwright test --project=Web-Chromium` | all pass |
| Electron E2E   | `npm run build:electron && npx playwright test --project=Electron-App` | all pass — **never run bare `npm run test:e2e`**; it launches the Electron project without building it |

## Suggested toolkit

- **The Figma MCP server** is available in this environment (`get_design_context`,
  `create_new_file`, `get_screenshot`, `generate_figma_design`). Useful for Step 2 if
  Kyle wants to explore directions visually before committing to code.
- **The `/design-system` playground route** is the cheapest prototyping surface —
  a new palette can be tried there against every primitive at once, in both themes,
  without touching a screen.
- **`npm run test:a11y`** should be run *during* palette exploration, not after. It
  is much cheaper to discover a contrast failure while choosing colors than after
  applying them everywhere.
- **The `ui-prototype-variations` skill** (available in this session) is built for
  generating multiple UI directions to compare — a good fit for Step 2.

## Scope

**In scope**: `src/styles/theme.css`, `src/styles/fonts.css`, `src/index.css`,
`src/components/ui/**` (variant and style changes), **`src/App.tsx`** (it holds the
toolbar, the touch minimums at :528-529, and the default marker colour at :138 — an
earlier draft omitted it and thereby put most of the work out of scope), the screens
selected in Step 4, `docs/features/wcag-audit.md`, and `docs/features/theming.md`.

**Out of scope**:
- **Anything decided in Steps 1–4 without Kyle's sign-off.** This plan's whole
  premise is that the design direction is Kyle's call.
- **New features.** This is a redesign of what exists, not a product expansion. A
  feature idea belongs in a separate plan.
- **Changing `data-testid` values.** Same reason as plan 004: they are the safety net.
- **`src/components/Canvas/**` rendering logic.** Grid *styling* is fair game (grid
  color is already a theme variable, `--app-grid-color`); Konva rendering internals
  are not.
- **Regressing WCAG AA.** Not negotiable, in either theme.
- **Reintroducing hardcoded colors.** Everything routes through theme tokens. The
  entire point of plans 001–004 was to make that true.

## Working approach

### How this plan lands

**Program-wide rule**: each plan is developed on its own branch off `main` and merged as
a **single pull request into `main`** before the next begins, because that is the only
way CI runs — every workflow in `.github/workflows/` (`lint`, `test`, `e2e`,
`accessibility`, `documentation-check`) triggers on `pull_request` → `main`, and nothing
fires on a long-lived feature branch. See plan 001's "How this plan lands" section for
the full table and consequences.

**This plan lands as two PRs, matching its own split.**

- **`plan/006a-design-direction`** — Steps 1–4. Docs, the `[data-direction]` prototypes
  in the playground, and the rewritten Steps 5+ of this file. It touches no production
  screen, so it can merge while plan 004 is still in flight — which is the entire point
  of running it early.
- **`plan/006b-apply-redesign`** — the rewritten Steps 5+. Branch it off `main` *after*
  004 has merged. Split further at step boundaries if it grows past ~1,500 lines; the
  natural seams are the token commit, the primitive variants, and each screen.

## Steps

### Step 1: Audit what the interface says today versus what the brand claims

Before designing anything, articulate the gap precisely.

Take annotated screenshots (both themes) of: the home screen; the editor with toolbar
and sidebar; **`ConfirmDialog`** (named so the choice is not arbitrary — it is
store-driven and opens deterministically); the Session Console; and the World View. Save
them under `docs/planning/ui-redesign-audit/`.

Reaching them: use `npm run dev:web`. The World View is at **`?type=world`** (see
`src/utils/useWindowType.ts` — no second monitor needed). Force the theme with
`document.documentElement.setAttribute('data-theme', …)`, as `tests/visual.spec.ts:39`
does; **do not** use `window.themeAPI?.setThemeMode()` from
`tests/accessibility.spec.ts:50` — it optional-chains to a silent no-op in a browser.
Plan 004 Step 0 may already have most of these; reuse it.

For each, write what it currently communicates.

Then read `README.md` and extract the brand's explicit claims — "funicular
friction," "weight over fluff," "permanent etching," "the stylus," "no slippery
controls."

Produce `docs/planning/ui-redesign-audit.md`: a side-by-side of claim versus current
delivery, naming the specific gaps. Fold in the deferred ideas from
`docs/planning/ui-redesign-ideas.md`.

Ground the audit in measurements, not adjectives: the computed font stack from
`src/styles/fonts.css`; every `--app-*` token value in play; the actual Tailwind spacing
and radius values per surface; the surviving hardcoded-palette-class count; and the
`dark:` variant count (zero at `d3d3642`).

**Check**: The audit exists, covers all five surfaces in both themes, and for each of
typography, colour, density, motion and iconography states **a measured current value**
alongside the gap — not an adjective. A reviewer must be able to check any claim against
the code. Kyle reads it and agrees it describes what he meant by "stale."

> **On the diagnosis this plan opens with**: that the gap between the README's brand
> language and the delivered interface is what reads as "stale" is a *hypothesis* — well
> evidenced, but nobody has asked Kyle whether he meant that, or "looks like 2019
> Bootstrap", or "too many modals". A competing reading is equally supported by the
> code: 396 hardcoded colours, three separate settings surfaces, an 1792-line home
> screen — which reads as *inconsistent*, a different problem with a different cure.
> **Step 1 is where that gets settled.** If the audit points at inconsistency rather
> than identity, say so and adjust Step 2 accordingly.

### Step 2: Choose a visual direction

Produce **two or three distinct directions**, not one. A single proposal is a
decision disguised as an option.

Each direction must specify:
- **Palette** — as `--app-*` token values for both themes, with contrast ratios
  computed against `docs/features/wcag-audit.md`'s bar. This is the highest-leverage
  choice; everything else follows.
- **Typography** — the type scale, weights, and whether IBM Plex stays
  (it is already a dependency). Plex Mono for numeric/measurement UI is worth
  considering given the cartography framing.
- **Density and spacing** — the spacing scale, and how the chrome sits against
  the canvas.
- **Elevation and depth** — how surfaces separate. This is where "etched" versus
  "floating" is most legible: carved recesses and hard edges read very differently
  from soft drop shadows.
- **Motion** — what "funicular friction" means as an easing curve and duration.
  Probably: fast, decisive, slightly weighted, with no bouncing. Must respect
  `prefers-reduced-motion`.
  > **This needs its own design decision, not just a nod.** `src/styles/theme.css:303-307`
  > currently kills *all* transitions and animations under that query with
  > `!important`. If "funicular friction" is expressed through motion, the
  > reduced-motion path becomes a **second visual design** that nobody has been asked to
  > approve. Specify what it looks like as part of the direction.
- **Iconography** — whether Remixicon stays, and at what weight.

**Prototype each direction on `/design-system`**, not in the real screens.

> **Do not use a branch per direction.** You cannot view three branches at one URL from
> one checkout, so the Check below would be unsatisfiable and genuine side-by-side
> comparison — the whole point — becomes hardest. Instead scope each direction's tokens
> under a `[data-direction="a"|"b"|"c"]` selector and add a switcher to the playground.
> All directions then live in one build and flip instantly.

**Check**: Two or three directions are switchable at `/design-system`, in both themes,
and genuinely distinct — differing in palette **and** at least one of density,
elevation or type. Three variations on one palette do not satisfy "a single proposal is
a decision disguised as an option". Each passes `npm run test:a11y`, which after plan
000 does scan `/design-system` — confirm that before trusting it. **Kyle picks one.**
Record the choice and the rejected alternatives with reasons in
`docs/planning/ui-redesign-direction.md`.

> **STOP here if Kyle has not picked.** Everything downstream depends on this
> single decision, and building on a guess wastes the entire plan.

### Step 3: Decide the information architecture

Separately from how it looks: is what-lives-where right?

Open questions to put to Kyle, each with the current state:
- **Toolbar**: currently a floating bar at bottom-center (`src/App.tsx:556`). Right
  position? Right grouping? Should tool options (color, measurement mode, door
  orientation) be inline, or contextual to the active tool?
- **Sidebar**: three components, not one — `Sidebar.tsx` (desktop panel),
  `QuickTokenSidebar.tsx`, and `MobileSidebarDrawer.tsx`. Does the desktop panel earn
  permanent space, and should the three converge on one model?
- **Settings**: currently spread across `PreferencesDialog`, `MapSettingsSheet`, and
  the Session Console's own settings sections. Three surfaces. Should it be one?
- **Home screen**: does it present the right things at the right level — recent
  campaigns, templates, new campaign, settings — or is it several screens in one? (Its
  1792 lines are a code-health fact, not an IA question; that belongs to plan 005.)
- **Session Console**: a large recent addition (`docs/planning/session-console-design.md`).
  Is it integrated into the IA, or bolted alongside it?
- **World View**: does it need anything at all, or is "nothing" correct?

For each, Kyle decides: keep, adjust, or restructure.

Add a seventh: **do the ~370 hardcoded palette classes in untouched files get fixed
here?** If not, the palette swap will not reach them and the app stays partly
theme-invariant. Keep / fix-in-this-plan / defer-to-a-follow-up.

Use one format per question — *Decision: keep | adjust | restructure*, then two to four
sentences of rationale — so the artefact is a record, not an essay.

**Check**: `docs/planning/ui-redesign-ia.md` records a decision for all seven in that
format, signed off by Kyle. "Keep as-is" is legitimate and often correct — record it
explicitly so it reads as a decision rather than an omission.

### Step 4: Rewrite Steps 5+ of this plan at full resolution

**This is the most important step in the plan.**

With the direction (Step 2) and IA (Step 3) decided, rewrite this file's Steps 5+ to
the same standard as plans 001–005: named files, exact changes, concrete per-step
verification, real STOP conditions. Sequence it so the app is shippable at every
commit, exactly as plan 004 was.

Recommended shape, to be confirmed against the actual decisions:

- **5.** Apply the new token values to `src/styles/theme.css` and `src/styles/fonts.css`.
  One commit. Because every component consumes tokens, this alone re-skins the entire
  app — which is the payoff of plans 001–004 and the moment to verify it was worth it.
- **6.** Update primitive variants in `src/components/ui/**` to match the direction
  (elevation, radii, motion). Verify at `/design-system`.
- **7.** Screen-by-screen refinement, highest-traffic first: toolbar → sidebar → home
  screen → dialogs → Session Console. One commit per screen, gated each time.
- **8.** IA restructuring from Step 3, only where "restructure" was chosen. This is
  the only part that changes behavior, so it needs its own E2E attention and may
  require `data-testid` additions (additions are fine; renames are not).
- **9.** Verify the World View is unharmed and still legible at projection distance.
- **10.** Full verification and a before/after screenshot set.

Each of those needs the detail this bullet list lacks. **Write it before building it.**

**Check**: Steps 5+ of this file have been rewritten and meet the same quality bar as
plans 001–005: every step has a concrete Check, the scope lists are explicit, and the
STOP conditions are specific to the chosen direction rather than generic. Kyle
reviews the rewritten plan before implementation begins.

### Steps 5+: ‹to be written in Step 4›

‹Do not implement from the outline above. Step 4 replaces this section with real
steps grounded in the actual design decisions.›

## Validation plan

Fully specifiable only after Step 4, but these hold regardless:

- **`npm run test:a11y` passes in both themes at every commit.** A redesign that
  regresses accessibility has failed, however good it looks. Run it during palette
  selection, not only at the end.
- **Both Playwright projects pass** (`--project=Web-Chromium` after `build:web`, `--project=Electron-App` after `build:electron` — never bare `npm run test:e2e`). Steps 5–7 change appearance, not behavior; only
  Step 8 (IA restructuring) legitimately changes flows, and its E2E updates should be
  additive.
- **The World View is verified two ways**: automatically at `?type=world` (axe scan
  plus screenshot diff) on every step touching shared tokens, and once at the end on a
  real second display at viewing distance. The automated half is the gate.
- **Touch targets stay at or above their current minimums** — plan 000 Step 4's spec
  asserts this and must stay green. Do not rely on `DEVICE_COMPATIBILITY.md`; it
  contains no pixel minimums.
- **Kyle is the acceptance authority on every visual judgment.** This plan's Checks
  are deliberately weighted toward "Kyle confirms" in a way plans 001–005 were not,
  because design quality is not a command exit code.
- **The before/after screenshot set** from Step 10 is the artifact that shows whether
  the "stale" problem was actually solved.

## Done criteria

- [ ] `docs/planning/ui-redesign-audit.md` exists and Kyle agrees it describes the problem
- [ ] Two or three directions were prototyped at `/design-system` in both themes
- [ ] Kyle picked one; the choice and the rejected alternatives are recorded in `docs/planning/ui-redesign-direction.md`
- [ ] `docs/planning/ui-redesign-ia.md` records a decision for all six IA questions
- [ ] **Steps 5+ of this plan were rewritten at full resolution and reviewed before implementation**
- [ ] The rewritten steps were executed, each leaving the app shippable
- [ ] `npm run test:a11y` passes in both themes
- [ ] Both Playwright projects pass; no `data-testid` was renamed
- [ ] `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(" src/components/ src/App.tsx src/index.css src/styles/app.css src/styles/fonts.css` returns nothing
      (the earlier version omitted `src/App.tsx` — which has 4 hits today — and said "outside `theme.css`" while never searching it)
- [ ] The surviving hardcoded-palette-class count is recorded and matches the Step 3 decision on whether to close that gap
- [ ] `docs/features/wcag-audit.md` updated with real computed ratios for the chosen palette
- [ ] `docs/features/theming.md` updated — it documents the superseded token architecture
- [ ] `--app-error-solid` with white text now meets 4.5:1, or that pairing is no longer used for normal text
- [ ] `tests/visual.spec.ts` rebaselined if plan 000 restored it; if deleted, the absence of a visual-regression net is recorded
- [ ] The reduced-motion variant of the chosen direction was specified and reviewed
- [ ] The World View was verified at projection distance
- [ ] Touch targets verified at or above current minimums
- [ ] Before/after screenshots captured for all five surfaces in both themes
- [ ] Kyle signs off that the interface now expresses the brand the README claims
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back — do not improvise — if:

- **Kyle has not picked a direction in Step 2.** Do not proceed on a guess. This is
  the plan's single load-bearing decision.
- **You are about to implement from the Step 4 outline rather than the rewritten
  steps.** The outline is a sketch, not a plan.
- **A chosen palette cannot meet WCAG AA** in both themes. Report the specific
  failing pairs and their ratios; the direction needs adjusting, and the a11y test is
  not the thing to change.
- **A redesign decision would degrade the World View's legibility at distance.**
  Players are the constituency that cannot advocate for themselves here.
- **A change would shrink a touch target below its current minimum.**
- **You need to reintroduce a hardcoded color** to achieve a visual effect. Add the
  token instead. Reintroducing hardcoded colors undoes plans 001–004 entirely.
- **The redesign is turning into a feature addition.** New capability belongs in its
  own plan.
- **Any E2E spec fails** during Steps 5–7 (appearance-only changes). Only Step 8 may
  legitimately require test updates, and those should be additive.

## Handoff / after it lands

- **This is the end of the program.** Plans 001–005 built the capacity to change the
  UI cheaply; this one spends it. If a future redesign is expensive again, the
  foundation has eroded — check whether `src/components/ui/README.md` is still being
  followed and whether hardcoded colors have crept back.
- **What a reviewer should scrutinize most**: the a11y results and the World View.
  Redesigns reliably regress contrast, and the World View is the surface nobody
  remembers to check because the person doing the work is looking at the DM's screen.
- **Deliberately deferred**: any feature work, and the `CommandPalette` (out of scope
  across this whole plan set).
- **Consider afterward**: capturing the finished visual language in a Figma library
  via the Figma MCP server, so future design work starts from the real system rather
  than from screenshots. And updating `README.md`'s screenshot and the placeholder
  GIFs at its "Artifacts in Motion" section — they currently point at
  `via.placeholder.com` URLs.
