# Graphium UI redesign — design brief

Status: CONFIRMED 2026-09-06
Kyle confirmed the draft as written ("Looks good continue"). Plan 006 treats every
statement here as Kyle's instruction. Anything Kyle strikes out is gone; anything he
adds is binding.

This brief exists so that the executor of plan 006 **renders Kyle's taste into options**
rather than inventing a brand. It was assembled from three sources: the brand language in
`README.md`, the interface as it exists today, and the UI and graphic work Kyle has saved
to his myMind collection over the past two years (titles cited below so he can find them).

---

## 1. What "stale" is, precisely

The interface is neutral dark-slate Radix on Tailwind defaults with a blue accent. It
could be any developer tool built since 2019. Specifically:

- **No point of view.** The README promises "Tactile Cartography", "the weight of
  creation", "funicular friction", "a permanent etching", "no slippery controls". The UI
  delivers a floating pill toolbar with a soft drop shadow, rounded-everything, and a
  tech-blue accent. The words and the pixels disagree.
- **Inconsistency reads as age.** Four styling systems, 396 hardcoded palette classes,
  three separate settings surfaces, three sidebar implementations, an 1,792-line home
  screen. Nothing looks _wrong_; nothing looks _decided_.
- **Generic accent.** Blue is the default accent of every design system. Kyle's own
  brand notes say it outright: "No tech-blue sameness."
- **Floaty depth.** Elevation is expressed with blurred shadows and translucent overlays.
  Nothing is etched, recessed, or inked.

"Fresh" is therefore not "newer" and not "more minimal". It is **the interface finally
saying what the README says**, with one opinion carried through every surface.

## 2. What "fresh" means for Graphium

Six statements. Every direction in plan 006 Step 2 must satisfy all six.

1. **An instrument, not a dashboard.** The chrome reads like a control surface: dense
   where the DM works, labelled, with numeric readouts (grid size, distance, token
   count, session time) treated as display elements. Keyboard shortcuts are visible on
   controls and menus. Evidence in Kyle's collection: the _OP-1 Synthesizer UI Screens
   Grid_, the _Professional Camera App Interface with Analog Display System_, the
   _Datapoint 3300_ terminal advertisement, the _Retro Terminal Display with TUI
   Dashboard_, and _Departure Mono_.
2. **Ink on dark stock, one warm accent that glows.** Near-black surfaces, low-chroma
   greys, and a single warm accent in the orange/amber/tomato family used sparingly for
   state (active tool, broadcasting, paused). No blue as accent. Evidence: _Osmo asterisk
   on a red glow_, _Bold Orange Typography on Black Fabric_, the _EVA-02 Psychographic
   Display_, the _Annular Solar Eclipse_, and the AFK brand brief's "anchored by a warm
   orange".
3. **Etched, not floating.** Depth comes from hairline rules, recessed (inset) active
   states, and hard edges, the way an engraved plate or a letterpress impression reads.
   No blurred drop shadows, no glassmorphism, no gradients. From Kyle's typographic brief:
   "Never a gradient, never an amorphous blob."
4. **Typography does the work.** IBM Plex is already a dependency. Plex Sans for
   labels, Plex Mono for every number and measurement. Numerals are allowed to be large
   and expressive (see _Wonktown Sans Numerals_). One family, two cuts, a strict scale.
5. **Weight and resistance in motion.** Transitions are fast, decisive, and slightly
   weighted: no bounce, no overshoot, snap points, and resistance near boundaries (Kyle
   saved exactly this: "Add resistance near important boundaries. It makes interfaces
   feel physical instead of digital."). The reduced-motion variant is the same design
   with durations set to zero, not a second design.
6. **Timeless over trendy.** The bar from Kyle's own brief: a mark or screen that could
   have existed fifteen years ago and still works today. The **hell-yes test**: a
   stranger sees one screenshot and knows what Graphium is and that it is not a generic
   tool.

## 3. Mood words

Five. Use them as the rubric adjectives in the audit and the direction docs.

**Etched · Instrument · Warm ink · Decisive · Quiet**

("Quiet" because the canvas is the product. Chrome recedes. Graphium is used for hours
in a dim room; a UI that demands attention is a worse UI here.)

## 4. References Kyle has already saved (take from each what is named)

| Saved item (myMind title)                                      | Take this                                                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| OP-1 Synthesizer UI Screens Grid (Teenage Engineering)         | Dense monochrome panels, one or two accent hues carrying meaning, numerals as graphics.      |
| Professional Camera App Interface with Analog Display System   | Analog gauges and readouts for numeric state; manual-mode seriousness.                       |
| Retro Terminal Display with TUI Dashboard (amber CRT)          | Amber-on-black as a legitimate accent; progress and charts as text-weight elements.          |
| Datapoint 3300 Computer Terminal Advertisement                 | Warm, physical, purpose-built hardware. The feel of a tool you own.                          |
| Orion TSS/01 Tablet Screen System Design Collection            | Manual-cover typography: bold sans, rules, numbered systems. Documentation as design.        |
| Osmo asterisk on red glow                                      | A single glowing accent on near-black. Restraint everywhere else.                            |
| Bold Orange Typography on Black Fabric                         | Orange on black with texture; warmth without gradient.                                       |
| Psychographic Display — EVA-02 Pilot                           | Orange line-work on black; labelled scales; fiction that still reads as an instrument.       |
| Departure Mono                                                 | A candidate for readouts only (never body text). Lo-fi technical.                            |
| Dark UI Component Toolbar with Code Review Badges              | Segmented pill groups in dark neutral; what the current toolbar wants to be, minus the blur. |
| Dark Mode Context Menu with Layout Options                     | Shortcuts shown inline; tight vertical rhythm.                                               |
| Linear theme editor (Behind the latest design refresh)         | Counter-reference: competent and _generic_. Use it to define what to avoid.                  |
| Vintage Solar System Diagram with Comets (engraving)           | Line weight and labelling for the cartographic layer (grid, measurement, fog edge).          |
| "Part 2: Design is a search for the opinions" (Karri Saarinen) | The argument for an opinionated tool. Graphium should have opinions.                         |
| "Timeless Typographic Marks — brief" (Kyle's own note)         | The bar: timeless, tactile, letterpress/risograph textures allowed, never a gradient.        |
| "AFK — Ownable, Not Generic — brief" (Kyle's own note)         | "No tech-blue sameness. The hell-yes test governs everything."                               |

## 5. Anti-references (if a screen looks like these, it failed)

- Stock shadcn/ui or Vercel-style grey-on-black with blue focus rings.
- Linear, Notion, Raycast: excellent, and interchangeable. Graphium must not be
  interchangeable.
- Foundry VTT's parchment-and-leather skeuomorphism. "Etched" is not "medieval".
- Roll20's density of unrelated panels.
- Glassmorphism, gradients, blurred shadows, springy bounce, rounded-everything.
- Anything Kyle's brief calls "AI-everything positioning".

## 6. Comparison set for the audit (plan 006 Step 1)

Screenshot the same three surfaces (landing, editor, player view) from **Foundry VTT**,
**Owlbear Rodeo**, and **Roll20**, and place them beside Graphium's. Then place the OP-1
grid and the amber CRT beside Graphium's editor. The audit must state, per surface,
which reference Graphium is currently nearest to and which it should move toward.

## 7. What must not change

- The dual-window architecture and the World View's cleanliness (section 8).
- Touch and pen as first-class: no target below the minimums plan 000 asserts (48 px
  mobile menu, 44 px inspector and home, 56 px mobile toolbar).
- Every keyboard shortcut and every `data-testid`.
- Light theme stays supported. Dark is the default and the design lead; light is a
  faithful inversion (paper stock instead of dark stock), not a second design.
- The Radix Colors token _architecture_ (`--app-*` semantic names). Values may change;
  names may not. New families may be added.
- WCAG 2.1 AA in both themes. This also fixes the known 3.9:1 white-on-red.

## 8. World View rules

The World View is projected to players, often on a TV across a room. It is the surface
that cannot advocate for itself.

- No DM chrome, ever. Nothing new appears there without a decision file.
- Canvas and tokens dominate; any overlay text is large (no computed font size below
  18 px at 1080p) and 7:1 contrast against its background.
- No hairline strokes thinner than 2 px at 1080p; projectors eat them.
- No colour-only state; players cannot lean in.
- The redesign may give the World View its **own** token set (`[data-view="world"]`) so
  the Architect's warm-ink accent does not bleed onto the projection. Whether it should
  is a Step 3 question.

## 9. DM-at-the-table rubric (score every direction pass/fail on each line)

| #   | Heuristic                          | Pass condition                                                                   |
| --- | ---------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Dim room: chrome must not glow     | Largest chrome surface luminance ≤ 12% in dark theme (`--app-bg-surface`)        |
| 2   | Glance-readable at 2 m on a laptop | Tool labels and readouts ≥ 13 px, weight ≥ 500, contrast ≥ 7:1                   |
| 3   | One-handed / pen                   | Every control on the toolbar and mobile toolbar ≥ 44 px, primary ones ≥ 48 px    |
| 4   | Four-hour fatigue                  | Chroma of chrome ≤ Radix step 3 equivalents; accent used on ≤ 3 elements at once |
| 5   | State without colour               | Active tool, paused, broadcasting each have a non-colour cue (shape, fill, icon) |
| 6   | Projector-safe World View          | Section 8 rules hold in a 1920×1080 screenshot                                   |
| 7   | Hell-yes test                      | Kyle answers "yes" to "would a stranger know this is Graphium?" per screenshot   |

## 10. The three directions plan 006 Step 2 must render (named, so nothing is invented)

Each is prototyped on `/design-system` under `[data-direction="a|b|c"]`, in both
themes. Palettes start from Radix scales so the WCAG audit stays partially valid;
leaving the scales is allowed only where the direction needs it and the contrast script
proves the pair.

| Direction                   | Accent anchor (dark)                        | Surfaces                                              | Depth                                        | Type                                   |
| --------------------------- | ------------------------------------------- | ----------------------------------------------------- | -------------------------------------------- | -------------------------------------- |
| **A · Instrument panel**    | Amber `--amber-9` (#ffc53d) on `--slate-1`  | Panels with 1 px `--slate-6` rules, no radius > 4 px  | Recessed active states (inset ring)          | Plex Sans + Plex Mono readouts         |
| **B · Etched plate**        | Tomato `--tomato-9` (#e54d2e) on near-black | Continuous dark stock, hairline dividers, 2 px radius | Engraved: 1 px light-on-top / dark-on-bottom | Plex Sans, generous numerals           |
| **C · Cartographer's desk** | Orange `--orange-9` (#f76b15)               | Slightly warm dark greys; light theme is paper stock  | Flat with letterpress-style pressed states   | Plex Sans + Plex Serif for titles only |

"Distinct" means: different accent hue **and** at least one of depth model or type
treatment differs. Three tints of one idea do not count. Kyle picks one, or names a
hybrid in the decision file.

## 11. Kyle's answers

Leave these for Kyle. Plan 006 STOPs if any is still blank.

- Mood words confirmed or edited: as written
- References vetoed (titles): none
- References added (titles or URLs): none
- Anti-references added: none
- Direction table edits (rows added, removed, renamed): none
- Does the World View get its own token set? (decide in 006 Step 3, may pre-answer): decide in Step 3
