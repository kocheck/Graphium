# Design harness index

Start here for any visual, UI, copy or interaction work in `macos/`. Read this file, then only the cards and DESIGN.md sections your task needs. Find cards by tag with `grep -l "applies_to:.*world-view" macos/design/harness/rules`. Tags in use: architect, world-view, canvas, overlay, toolbar, inspector, welcome, console, readout, motion, copy; add one only when none fits.

## Design system (macos/docs/design/DESIGN.md; generated in part, never copy values)

- [Overview: who owns what](../../docs/design/DESIGN.md#overview) · [Colors](../../docs/design/DESIGN.md#colors) · [Typography](../../docs/design/DESIGN.md#typography) · [Layout](../../docs/design/DESIGN.md#layout) · [Depth](../../docs/design/DESIGN.md#depth) · [Shapes](../../docs/design/DESIGN.md#shapes)
- [Components](../../docs/design/DESIGN.md#components) · [Motion](../../docs/design/DESIGN.md#motion) · [Do's and Don'ts](../../docs/design/DESIGN.md#dos-and-donts) · [Platform mapping](../../docs/design/DESIGN.md#platform-mapping)
- Copy voice: [voice.md](../../docs/design/voice.md)

## Rules (one per card; read when the task touches it)

- [world-view-player-safe](rules/world-view-player-safe.md): anything the World View draws
- [native-chrome-stays-native](rules/native-chrome-stays-native.md): toolbar, sidebar, inspector, sheets, menus
- [one-warm-accent](rules/one-warm-accent.md): any colour choice in the Architect window or canvas
- [state-without-colour](rules/state-without-colour.md): pause, broadcast, active tool, selection, locks
- [etched-overlays](rules/etched-overlays.md): toasts, banners, HUDs, cards on app-owned surfaces
- [readouts-in-mono](rules/readouts-in-mono.md): any number the DM reads
- [canvas-marks-read-on-any-map](rules/canvas-marks-read-on-any-map.md): selection, labels, measurements on the map

## Taste

[taste/principles.md](taste/principles.md): Kyle's likes and dislikes, seeded from the confirmed 006 brief, capped at 15 rules. Read it for any visual design or critique.

## Workflows

- Build, screenshot and critique a change: [review-loop.md](review-loop.md)
- Feedback, misses and consolidation: the `design-feedback` skill (`.claude/skills/design-feedback/`)
- Critique: the `design-advisor` agent (`.claude/agents/design-advisor.md`)
- Budgets and index check: `bash macos/scripts/check-design-docs.sh`
