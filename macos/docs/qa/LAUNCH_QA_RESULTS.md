# Launch QA results

Agent runs only, on 2026-10-19: seven XCUITest persona scripts on a GitHub macOS 15 runner, fresh
install, synthetic fixtures (a 1400 × 1050 parchment grid map and a 9100 × 9100 one). The plan and
the predictions registered before any run are in [LAUNCH_QA.md](LAUNCH_QA.md). No human has used
the build yet; the five think-aloud sessions, SUS and the VoiceOver checklist are in
[THINK_ALOUD.md](THINK_ALOUD.md) and their results go at the end of this file.

## Headline

Before the fixes, no scripted session reached first success. After them, the three sessions that
make a PC reach it. In the reference session it takes 25.7 s from launch, against the KLM estimate
of about 29 s plus import.

| Metric (same scripts, same runner)                        | Before (8b6d6da)            | After (9c057a0)                 |
| --------------------------------------------------------- | --------------------------- | ------------------------------- |
| `activation` log events (sessions reaching first success) | 0 of 7                      | 3 of 7: reference 25.7 s, small window 31.6 s, keyboard 75.9 s |
| Map image via Choose… becomes the map                     | no: it became a tiny token, map blank | yes, in all 4 sessions that chose one |
| Calibration starts by itself after the image              | no (30 s script timeout)    | yes, "Map calibrated to the grid" |
| World View near-black share (reference / small / keyboard) | 88% / 88% / 88%            | 31% / 40% / 17%                 |
| Classic Dungeon template                                  | blank map, "Created Classic Dungeon campaign!" | 5 rooms with walls and doors |
| Accessibility audit issues (Welcome / Architect / World View) | 6 / 11 / 21             | 5 / 11 / 30 (+9 contrast over map art, [#387](https://github.com/kocheck/Graphium/issues/387)) |
| Zoom readout under doubled strings                        | "lld 195%"                  | "88%"                           |
| Smallest Architect window                                 | 181 × 156 pt, no canvas     | 741 × 524 pt                    |
| Duplicate windows from double-clicks (New Campaign, World View) | 0, 0                  | 0, 0                            |
| Crash reports, error or fault log lines                   | 0, 0                        | 0, 0                            |
| Network sockets 15 s after launch                         | none                        | none                            |
| 17 naughty map names, 80 undo/redo                        | no crash                    | no crash                        |

Time to first action (launch to a clickable Welcome window) was 1.5 to 3.0 s in every session of
both builds.

## Where the evidence is

Each CI run force-pushes its traces (one JSON per persona), screenshots, `app-log.txt`,
`activation.txt`, crash and log-error lists and the xcresult summary to a branch:

- `qa-results-0f16e6c` is the first fixed build. Its map import worked, but the World View was still
  black: the finding that led to the 9c057a0 fix below.
- `qa-results-9c057a0` is the final fixed build.
- `qa-results` is the latest pushed run. The before run is CI run 39186245614, on 8b6d6da.

Read them with `git fetch origin +qa-results-9c057a0` and a worktree. A pushed screenshot is
`shots/<persona>-<n>-<step>-<action>.jpg`.

## Stalls, ranked

Score = Nielsen severity (0 to 4) × frequency (personas out of 6 that hit it) × reach (1.0 on
path steps 1 to 8, 0.5 on alternatives, 0.2 on edge input). The step is the critical-path number in
LAUNCH_QA.md, used as the cognitive-walkthrough step.

| #  | Step | Observation                                                                                                     | Interpretation                                                                                         | Sev | Freq | Reach | Score | Batch | Status |
| -- | ---- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --- | ---- | ----- | ----- | ----- | ------ |
| B  | 6, 8 | After Type > PC the World View was still all black except the token (`qa-results-0f16e6c`, reference shot 08)  | A PC with no vision radius sees nothing; the Generic Token has none. The DM did everything the screens say | 4   | 5/6  | 1.0   | 3.3   | flow  | Fixed |
| C  | 6    | The Generic Token is an NPC; nothing on the path says to make it a PC, and the inspector said "Only PC tokens emit vision" | The DM doesn't know step 6 exists, so the TV stays black and reads as broken (prediction I1)            | 3   | 5/6  | 1.0   | 2.5   | copy, flow | Fixed |
| A  | 3    | Choose… (banner or Map > Map Image…) made a token from the map image; the map stayed blank (before, reference shot 04) | The file importer's `isPresented` setter cleared the import target before the completion ran          | 4   | 3/6  | 1.0   | 2.0   | flow  | Fixed |
| D  | 7    | World View and Pause behind » at the default size, while hidden-by-default items showed                         | The DM can't find the TV button; macOS 15 toolbar placement, not verified on a Mac                      | 3   | 4/6  | 1.0   | 2.0   | architectural | [#383](https://github.com/kocheck/Graphium/issues/383) |
| J  | 5    | Library's Place… Add… Manage… links rendered near-white on the sidebar (every Architect shot, before)           | The way to add tokens is invisible                                                                      | 2   | 6/6  | 1.0   | 2.0   | copy (style) | Fixed |
| S  | 4    | A 20 pt quick drag and a box sized from a stale zoom readout were both accepted as "calibrated"; the app grid and image grid then disagree | Calibration accepts any box above a minimum, with no preview                                            | 2   | 5/6  | 1.0   | 1.7   | architectural | [#385](https://github.com/kocheck/Graphium/issues/385) |
| P  | 8    | The World View opened with the PC at the bottom edge under Center on Party (3 of 3 after runs)                  | The first World View viewport follows the Architect, not the party                                     | 2   | 4/6  | 1.0   | 1.3   | architectural | [#385](https://github.com/kocheck/Graphium/issues/385) |
| E  | 3–6  | Tab loops Zoom In → Zoom Out → Zoom to Fit → canvas; Generic Token and Type > PC not reached in 60 presses       | A keyboard or VoiceOver DM can't finish the path without a pointer                                      | 4   | 1/6  | 1.0   | 0.7   | architectural | [#384](https://github.com/kocheck/Graphium/issues/384) |
| N  | all  | Toasts are SwiftUI views with no announcement (code reading; CI can't hear VoiceOver)                           | A screen-reader DM never hears "Map calibrated" or an error                                             | 3   | 1/6  | 1.0   | 0.5   | flow  | Fixed, unverified: VoiceOver checklist |
| F  | 4    | Calibration has no keyboard route except Esc                                                                    | Skippable, so not blocking                                                                              | 2   | 1/6  | 1.0   | 0.3   | architectural | [#384](https://github.com/kocheck/Graphium/issues/384) |
| G  | 2    | ⌘N from the Welcome window opened nothing (both builds); File > New worked                                       | Unknown; may be focus or the Welcome window's key handling                                              | 2   | 1/6  | 1.0   | 0.3   | architectural | [#384](https://github.com/kocheck/Graphium/issues/384) |
| Q  | all  | Audit: unlabelled elements, "Unknown role" readouts, contrast; canvas tokens never found by XCUITest           | See #387                                                                                                | 2   | 1/6  | 1.0   | 0.3   | architectural | [#387](https://github.com/kocheck/Graphium/issues/387) |
| H  | alt 2 | Classic Dungeon promised "5-room dungeon with fog of war" and made a blank map (before, skeptic shot 03)       | The descriptions described content the templates never made (prediction S1, I3)                        | 3   | 1/6  | 0.5   | 0.25  | copy, flow | Fixed |
| M  | 3    | ⌘Q during a 9100 px import quit at once with no prompt (all runs)                                               | The import isn't in the document yet, so nothing is "unsaved" and the image is dropped (inferred)       | 3   | 1/6  | 0.2   | 0.1   | architectural | [#386](https://github.com/kocheck/Graphium/issues/386) |
| L  | 7    | The Architect window shrank to 181 × 156 pt with no canvas or toolbar                                           | No minimum size                                                                                         | 2   | 1/6  | 0.2   | 0.07  | flow  | Fixed |
| I  | —    | About and Tutorial: "Hardware-accelerated raycasting", "blurred aesthetics", "no cloud wizard can touch"       | Overclaims (raycasting is on the CPU; App Sandbox is off)                                               | 1   | 1/6  | 0.2   | 0.03  | copy  | Fixed; the rest in [#388](https://github.com/kocheck/Graphium/issues/388) |
| K  | —    | Zoom readout showed "lld 195%" under doubled strings                                                            | A bare `%` in a string key breaks once localised                                                        | 1   | 1/6  | 0.2   | 0.03  | copy  | Fixed |
| O  | 2    | Doubled strings truncate the window subtitle to "New Cam…"                                                       | Real translations at +30% will truncate it too                                                          | 1   | 1/6  | 0.2   | 0.03  | architectural | Not filed: system title bar |

## Fixes and the metric each moves

Copy batch (shipped):

- Templates say what they make, and Classic Dungeon now makes it: the template metric, prediction S1.
- About and Tutorial claims match the code. The Tutorial opens with "Your First Session", the
  five critical-path steps: a lower share of think-aloud participants stalling at step 6.
- The inspector says "Players see only what PCs see. Make your players' tokens PCs." The
  activation rate in the think-aloud sessions.
- Formatted percents (zoom, console volume, duck): the pseudo-localisation metric.
- Library links in the accent colour: the Welcome contrast count (3 → 2 contrast items).

Flow batch (in the same PR for diff review):

- The map image import keeps its target until the panel's completion runs: the map-image step,
  now 4 of 4 sessions.
- Making a token a PC gives it 60 ft of sight when it has none (`GameMap.makePCs`, unit-tested).
  An explicit None and library vision are kept: the World View near-black share and activation
  events (0 → 3).
- "Players see only fog: no PC on this map can see" appears over the canvas while a World View is
  open, with Make PC and Turn On Daylight: the activation rate for DMs who skip step 6. CI didn't
  reach this state (the impatient script stops at step 5), so it is unverified.
- Command Palette: Choose Map Image…, Place Generic Token and Make Selected Tokens PCs, giving a
  ⌘K route for steps 3, 5 and 6: the keyboard Tab-count metric once #384 lands.
- Toasts are announced to VoiceOver (high priority for errors). This is the VoiceOver checklist
  item; CI can't hear it.
- Architect minimum size 560 × 420: the smallest-window metric (181 × 156 → 741 × 524 pt with the
  sidebar).

Tried and reverted: moving the toolbar's secondary items to primary placement emptied the
toolbar on macOS 15 ([#383](https://github.com/kocheck/Graphium/issues/383)).

The `activation` event was also tightened between the two fixed runs: it now needs a PC that can
see, not just a PC. The 0f16e6c run logged 3 activations while the World View was black, so the
first definition counted a failure as a success. The before run would score 0 under either
definition (no map art).

## Predictions, scored

12 hit, 4 missed, 2 untested. 9 stalls were not predicted.

| ID | Prediction                                           | Result |
| -- | ---------------------------------------------------- | ------ |
| I1 | World View black because the Generic Token is an NPC | Hit, and deeper than predicted: even as a PC it had no sight (B) |
| I2 | A quick calibration drag gives a "too small" error toast | Missed: before, calibration never started (A); after, a 20 pt drag was accepted (S) |
| I3 | Classic Dungeon template is blank                    | Hit (H) |
| S1 | Template descriptions overclaim                      | Hit (H) |
| S2 | About and Tutorial overclaim                         | Hit (I) |
| S3 | "No accounts" versus the Agent window and Report Bug | Hit by reading; left as a call for Kyle ([#388](https://github.com/kocheck/Graphium/issues/388)) |
| M1 | World View and Pause behind » at the minimum width   | Hit, and at the default width too (D) |
| M2 | Narrow canvas with banners covering the map          | Untested: the script didn't measure canvas cover |
| M3 | Slow import with no progress on a throttled CPU      | Untested: CI has no CPU throttle; "Importing image…" did show |
| N1 | Jargon unexplained                                   | Hit: PC, NPC, World View and Fog of War on every screen of the path |
| N2 | Idioms read as noise                                 | Hit by reading (About intro); [#388](https://github.com/kocheck/Graphium/issues/388) |
| N3 | Truncation at +30%                                   | Hit (O, K) |
| B1 | Double-click opens two campaigns                     | Missed: one window each time |
| B2 | Naughty names break the sidebar or title             | Missed: 17 names, no crash, titles truncate cleanly |
| B3 | Quit mid-import loses work                           | Hit in a different form: no prompt at all (M) |
| K1 | Calibration and placement need a pointer             | Hit (F, E) |
| K2 | Toasts not announced                                 | Hit by code reading (N) |
| K3 | Focus doesn't reach the inspector                    | Hit, worse: Tab is trapped in the zoom controls (E) |

Not predicted: A (the import bug, the worst one), B (a PC with no sight), J, L, P, Q, S, G and M's
exact form.

## What doesn't apply, and what the agents couldn't do

- **Pricing, terms, backend validation, funnel and session-replay data:** there are none. The app
  has no server, accounts or telemetry ([PRINCIPLES.md](../PRINCIPLES.md)). The baseline is the KLM
  estimate plus the scripted timings above, and the human sessions will add the only real numbers.
- **Mobile, Slow 3G, real iPhone, Lighthouse, WebPageTest:** there is no iOS app and nothing on the
  path uses the network. The stand-ins were the smallest window and the network check. A throttled
  CPU wasn't available on the CI runner.
- **VoiceOver:** an agent can't hear it. The checklist in [THINK_ALOUD.md](THINK_ALOUD.md#voiceover-checklist)
  is for Kyle.
- **Video:** the xcresult records screenshots at every step, not continuous video.

## What the agents got wrong (so far)

Caught by the agents themselves, before any human:

- The first `activation` definition counted a blind PC as success.
- The first toolbar fix made the toolbar worse, which only the screenshots showed.
- XCUITest never saw the canvas's token elements, so every "token on the canvas" and "is a PC"
  flag in the traces is false in both builds. Those steps were judged from the screenshots and the
  `activation` log instead.
- Text queries on SwiftUI glass labels failed on macOS, which made the first two baselines
  unusable until the banners were tagged with identifiers.
- The non-native script crashed on a static-text snapshot in the final run (an XCUITest
  "automation type mismatch"), so its after trace stops at step 5.

What the humans caught that the agents didn't: to be filled in after the think-aloud sessions.
