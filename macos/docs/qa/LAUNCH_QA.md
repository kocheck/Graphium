# Launch QA: first success, critical path and pre-registered predictions

Written 2026-10-19, before any persona run, so the predictions below can be scored honestly
afterwards. The git history of this file is the timestamp. Results go in
[LAUNCH_QA_RESULTS.md](LAUNCH_QA_RESULTS.md); nothing below is edited after the runs start.

Graphium is a native Mac app with no backend, accounts, pricing, signup or telemetry
([PRINCIPLES.md](../PRINCIPLES.md)). Each step of the original web-shaped QA ask maps to its
native equivalent:

| Asked for                                 | Native equivalent used here                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Playwright session with video and trace   | XCUITest persona scripts (`App/GraphiumUITests`), screenshots at every step, xcresult with screen capture, a JSON trace per run |
| DevTools / HAR                            | The app's unified log (`subsystem:com.graphium`) and `~/Library/Logs/Graphium`, network checks with `nettop`, the `activation` log event     |
| Backend validation rules                  | Import validation in `GraphiumCore/Import`, `Document/Assets.swift`, `BoardPackIO.swift` (size caps, types, names)  |
| Pricing, terms, privacy text              | Welcome hero, About and Tutorial tabs, README and PRINCIPLES claims. There is no pricing or terms page              |
| Funnel and session-replay data            | None exists, by design: the app sends nothing. The baseline is the KLM estimate per step plus the scripted run timings |
| Mobile, Slow 3G, 4× CPU, real iPhone      | Smallest window sizes, a background-QoS (throttled) launch. No iPhone app, no network on the path, so Slow 3G, Lighthouse and WebPageTest don't apply |
| Duplicate POSTs and server errors         | Duplicate documents or edits from double-triggered actions, crashes, save faults and error toasts                  |
| axe-core                                  | XCTest `performAccessibilityAudit()`                                                                                |
| VoiceOver run                             | A scripted VoiceOver checklist for Kyle; an agent can't drive VoiceOver                                             |
| 5 think-aloud sessions and SUS            | A script and SUS form for Kyle to run with real DMs ([THINK_ALOUD.md](THINK_ALOUD.md)). Agent runs are never reported as human results |

## First success

**Activation event: the players see the DM's map with their character on it.** Measured as the
first moment in a launch when a World View window is open and not paused, its active map has art
(a background image or video, or walls), and at least one PC token is on it, so fog of war shows
ground around that PC instead of black.

The app logs this once per launch as `activation` (log category `qa`) with seconds since launch.
Nothing is sent anywhere; the persona scripts and think-aloud sessions read it from the log.

## Critical path (new install, the DM brings a map image)

1. Launch Graphium. The Welcome window opens.
2. Choose New Campaign (⌘N). An Architect window opens on a blank map.
3. Add the map image: drop it on the canvas, or Choose… in the "Drop a map image here" banner.
4. Calibrate the grid: zoom in and drag a box around one grid cell (it starts on its own), or Cancel.
5. Place a token: Generic Token in the sidebar's Library section, or Add Tokens.
6. Make that token a PC: Token inspector > Type > PC.
7. Open the World View (toolbar TV button, ⇧⌘W) and move it to the projector (Show on Display).
8. The players see the map around their PC. **Activation.**
9. Save (⌘S) and name the campaign. (Retention, not part of activation.)

Alternative entry at step 2: Welcome > Generate Dungeon (⇧⌘D) or Templates (⇧⌘T).

## Funnel baseline per step

There is no traffic data and there won't be: the app has no telemetry, and adding any would
break the first tiebreaker. The baseline is a Keystroke-Level Model estimate from the code
(K 0.28 s, P 1.1 s, B 0.1 s, H 0.4 s, M 1.35 s), to be replaced by measured script timings.

| Step | Operators                                       | KLM est. | What the DM has to know that the screen doesn't say         |
| ---- | ----------------------------------------------- | -------- | ----------------------------------------------------------- |
| 1    | M                                               | 1.4 s    |                                                             |
| 2    | M P BB                                          | 2.7 s    |                                                             |
| 3    | M P BB, M P BB, P BB (file dialog)              | 6.6 s    | plus image import time                                      |
| 4    | M, H K K K (zoom), M P B P B                    | 6.3 s    | that calibration has started on its own                     |
| 5    | M P BB                                          | 2.7 s    | that Generic Token is a button                              |
| 6    | M P BB P BB                                     | 4.0 s    | **that a token must be a PC or the TV shows only black**    |
| 7    | M P BB, P BB P BB                               | 5.3 s    | that the World View is a second window to move               |
| 8    | (activation)                                    |          |                                                             |
| 9    | M H K K, M K×8 (name), K                        | 6.8 s    |                                                             |
|      | **Launch to activation**                        | **~29 s + import** |                                                   |

## Personas and pre-registered predictions

Each persona predicts three failures, with the step and the reason. Scoring after the runs:
predicted-and-hit, predicted-and-missed, unpredicted.

### 1. Impatient (aborts at the first error state)

- **I1, step 8:** the World View is all black. The Generic Token is an NPC, so no PC sees
  anything and fog covers the whole map. Nothing in the app says why. The DM reads it as broken.
- **I2, step 4:** calibration starts by itself after the import. A quick drag that isn't around one
  cell gives "That box was too small" as an error toast: the first error state, so they abort.
- **I3, step 2 (Templates):** "Classic Dungeon: 5-room dungeon with fog of war" opens a blank
  map with a "Created Classic Dungeon campaign!" toast. The promised dungeon isn't there.

### 2. Skeptic (reads every claim literally)

- **S1, Templates:** the descriptions ("5-room dungeon", "Large outdoor exploration area",
  "30 × 30 cells") describe content and sizes the template doesn't create. Applying one only
  renames the map and sets 50 px cells.
- **S2, About and Tutorial:** "Hardware-accelerated raycasting" (raycasting runs on the CPU; only
  fog drawing uses Metal), "blurred aesthetics", "Dynamic lighting and shadows" and "no cloud
  wizard can touch" (a campaign saved to iCloud Drive syncs, and App Sandbox is off, so the
  promise isn't enforced by macOS) overstate what the app does.
- **S3, "No accounts":** the Agent window needs a Claude Code or Codex account, and Report Bug
  needs a GitHub account. Both are opt-in, but nothing near "No accounts" says so.

### 3. Small window and slow Mac ("mobile")

- **M1, step 7:** at the minimum Architect width the toolbar overflows; World View and Pause end up
  behind the » menu, so the DM can't find the TV button.
- **M2, steps 3 to 6:** with the sidebar and inspector open, a 1000 pt window leaves a narrow
  canvas, and the calibration banner and toasts cover the part of the map the DM needs.
- **M3, step 3:** on a throttled CPU a large map image takes seconds under "Importing image…" with
  no progress, and the first token drag stutters while fog recomputes.

### 4. Non-native English (follows only what the UI literally says)

- **N1, jargon:** PC, NPC, Daylight (meaning "no fog"), World View, Architect, Calibrate, Reveal,
  Duck, plates. None is explained where it appears.
- **N2, idioms:** "Master of Dungeons", "arcane battlemat", "demanding tribute to corporate
  overlords", "Quick Start Incantations", random subtitles such as "Rules Lawyers (The Good Kind)",
  and rolled flavour toasts. They read as noise or as instructions.
- **N3, labels at +30% length:** Welcome cards (150 pt wide), the icon-only tool picker and the
  toolbar truncate or overflow under doubled strings; icon-only controls have only tooltips.

### 5. Breaker (fuzz, double-trigger, quit mid-work)

- **B1, double-trigger:** double-clicking New Campaign or Generate Dungeon on the Welcome window
  opens two campaigns, and the second Generate Dungeon window gets no dungeon dialog.
- **B2, naughty strings:** map, token and campaign names with RTL marks, zalgo, 1,000 characters
  or `/` and `:` break the sidebar, the window title or the saved file name.
- **B3, quit mid-work:** quitting during an image import or right after an edit loses the edit or
  leaves an orphaned asset; no crash, but a save fault in the diagnostics log.

### 6. Keyboard and VoiceOver

- **K1, steps 3 to 5:** calibration and token placement need a pointer drag; there is no keyboard
  route except Cancel and the sidebar's Generic Token button.
- **K2, feedback:** toasts ("Map calibrated", errors) are never announced to VoiceOver, so a
  screen reader user doesn't hear that a step worked or failed.
- **K3, step 6:** after placing a token, focus stays in the sidebar; reaching the inspector's Type
  picker takes many Tab presses, and the World View opening isn't announced.

## Ranking and triage rules

Every stall gets an observation (screenshot, timestamp, literal action, log errors) and, in a
separate column, an interpretation, a Nielsen severity 0 to 4 and a cognitive-walkthrough step
(the critical path number above). The merged list is ranked by severity × frequency (personas that
hit it, out of 6) × reach (share of DMs who walk that step: 1.0 on steps 1 to 8, 0.5 on
alternatives, 0.2 on edge input). Then:

- **Copy and strings** ship now.
- **Flow changes** go in the same PR for diff review.
- **Architectural** findings become GitHub issues.

Each fix names the metric it should move.
