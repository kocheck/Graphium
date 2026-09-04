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
- **Depends on**: plans/003-build-primitive-layer.md, plans/004-migrate-screens-to-primitives.md
- **Category**: design
- **Grounded at**: `d3d3642` (2026-09-04) — but see the note below

> **On grounding**: the "current state" facts here are accurate at `d3d3642`, but
> plans 001–005 will have changed the code substantially before this plan runs.
> **Re-ground before starting**: re-read `src/styles/theme.css`,
> `src/components/ui/README.md`, and `src/index.css`, and update this plan's Context
> section to match what is actually there.

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

- **A single source of truth for color**: `src/styles/theme.css` semantic variables,
  bridged to shadcn token names in `src/index.css`. Changing a token changes every
  component.
- **A primitive layer** in `src/components/ui/`, with a documented contribution
  contract in `src/components/ui/README.md`, including Graphium-specific CVA
  variants (`tool`, `mode`, `broadcast` on `button`).
- **Every screen consuming those primitives**, with no hand-rolled overlays and
  substantially fewer inline styles.
- **A Design System Playground** at `/design-system` where every primitive renders
  in both themes — the natural place to prototype a new visual language before
  touching a single screen.
- **A behavior safety net**: `data-testid`-based E2E specs that pass, and
  `npm run test:a11y` enforcing WCAG 2.1 AA in both themes.

### Constraints that do not change

- **The World View is sacred.** It is projected to players, often on a TV. It must
  stay clean, high-contrast, legible at distance, and free of DM chrome. Any
  redesign decision that makes the Architect View prettier at the World View's
  expense is wrong.
- **WCAG 2.1 AA is a hard floor.** `npm run test:a11y` gates both themes.
  `docs/features/wcag-audit.md` documents the current guarantees. A new palette must
  meet the same bar — this is a real constraint on how moody the "etched" direction
  can get, and it should shape the design rather than be discovered at the end.
- **Both themes must work.** Dark is the likely default for a table-side tool in a
  dim room, but light mode is not optional.
- **Touch and pen are first-class.** See `TOUCH_SUPPORT_MIGRATION.md` and
  `DEVICE_COMPATIBILITY.md`. Hit targets have minimum sizes; `src/App.tsx` already
  uses `minWidth/minHeight: 48px` for the mobile menu button. A redesign that
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
| Full E2E       | `npm run test:e2e`         | all pass                   |

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
`src/components/ui/**` (variant and style changes), and the screens selected in
Step 4.

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

## Steps

### Step 1: Audit what the interface says today versus what the brand claims

Before designing anything, articulate the gap precisely.

Take annotated screenshots (both themes) of: the home screen, the editor with the
toolbar and sidebar, an open dialog, the Session Console, and the World View. For
each, write what it currently communicates.

Then read `README.md` and extract the brand's explicit claims — "funicular
friction," "weight over fluff," "permanent etching," "the stylus," "no slippery
controls."

Produce `docs/planning/ui-redesign-audit.md`: a side-by-side of claim versus current
delivery, naming the specific gaps. Fold in the deferred ideas from
`docs/planning/ui-redesign-ideas.md`.

**Check**: The audit exists, covers all five surfaces in both themes, and names at
least the gaps in typography, color, density, motion, and iconography. Kyle reads it
and agrees it describes the problem he meant by "stale."

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
  `prefers-reduced-motion`, which `src/styles/theme.css` already honors.
- **Iconography** — whether Remixicon stays, and at what weight.

**Prototype each direction on `/design-system`**, not in the real screens. Every
primitive re-themed, in both themes, in a branch per direction. This is exactly what
the playground and the token architecture were built for, and it makes the
comparison honest rather than imagined.

**Check**: Two or three directions are viewable at `/design-system`, in both themes.
Each passes `npm run test:a11y`. **Kyle picks one.** Record the choice and the
rejected alternatives (with reasons) in `docs/planning/ui-redesign-direction.md`.

> **STOP here if Kyle has not picked.** Everything downstream depends on this
> single decision, and building on a guess wastes the entire plan.

### Step 3: Decide the information architecture

Separately from how it looks: is what-lives-where right?

Open questions to put to Kyle, each with the current state:
- **Toolbar**: currently a floating bar at bottom-center (`src/App.tsx:556`). Right
  position? Right grouping? Should tool options (color, measurement mode, door
  orientation) be inline, or contextual to the active tool?
- **Sidebar**: currently a left panel holding the token library. Does it earn
  permanent space, or should it be summonable?
- **Settings**: currently spread across `PreferencesDialog`, `MapSettingsSheet`, and
  the Session Console's own settings sections. Three surfaces. Should it be one?
- **Home screen**: 1792 lines, the largest file in the app. Is it doing too much?
- **Session Console**: a large recent addition (`docs/planning/session-console-design.md`).
  Is it integrated into the IA, or bolted alongside it?
- **World View**: does it need anything at all, or is "nothing" correct?

For each, Kyle decides: keep, adjust, or restructure.

**Check**: `docs/planning/ui-redesign-ia.md` records a decision for each of the six,
signed off by Kyle. "Keep as-is" is a legitimate and often correct answer — record it
explicitly so it is a decision rather than an omission.

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
- **`npm run test:e2e` passes.** Steps 5–7 change appearance, not behavior; only
  Step 8 (IA restructuring) legitimately changes flows, and its E2E updates should be
  additive.
- **The World View is verified separately**, ideally on an actual second display or
  TV, at realistic viewing distance. It is the surface Kyle's users' *players* see,
  and it is the one nobody remembers to check.
- **Touch targets stay at or above their current minimums** — verify on a touch
  device or emulation, per `DEVICE_COMPATIBILITY.md`.
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
- [ ] `npm run test:e2e` passes; no `data-testid` was renamed
- [ ] `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(" src/components/ src/styles/app.css` returns nothing outside `theme.css`
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
