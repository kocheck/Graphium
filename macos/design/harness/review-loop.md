# Build, screenshot and critique a UI change

Graphium has no design document to prototype in; the SwiftUI app is the prototype. Follow [INDEX.md](INDEX.md) for what to read; this file adds the loop, not new rules.

## Where it runs

Builds need Xcode, so they run on Kyle's Mac: a cloud thread starts a Remote Control session in the Graphium folder there, which builds with `xcodebuild`, launches the app and captures windows with `screencapture -o -l <window id>`. Screenshots go in `design-shots/<round>/<surface>-<light|dark>.png` at the repo root, which is git-ignored. Use synthetic campaigns only (Welcome templates, Generate Dungeon); never a real campaign's maps or names.

## Loop

1. **Brief.** The change's goal, surfaces and states in three lines.
2. **Load.** INDEX.md, the cards and DESIGN.md sections that match, and `taste/principles.md`. Nothing else.
3. **Build** the change with existing tokens (`Palette`, `Spacing`, `Radius`, `.etchedPanel()`, `.readoutStyle()`). A missing token is a finding: add it to DESIGN.md front matter and run `python3 macos/scripts/design-tokens.py`; never a literal colour.
4. **Screenshot** each surface touched, light and dark, plus the states the brief names. For World View changes, also a 1920 × 1080 capture.
5. **Critique.** Run the `design-advisor` agent in critique mode on each screenshot. Fix its findings.
6. **Repeat** steps 3–5 at most three times, then stop and show Kyle what's left.
7. **Record** a decision Kyle makes in `docs/planning/decisions/` (the web app's decision folder covers both apps).
8. **Misses.** When a card was wrong or missing, or the advisor flagged a rule gap, file it as the `design-feedback` skill describes.

## Limits

- A screenshot is visual inspection, not an accessibility or performance check; say which one you did.
- Sketch's MCP server on Kyle's Mac is available for a mockup before code, as in Project Icarus's prototype workflow, but no Graphium Sketch document exists yet.
