# Decision 007: Map-first glass for the native Architect window

Status: DECIDED

## Question

Round 2 of the Sketch concepts (`graphum-ui-explorations`, page "Concepts — Round 2 (map-first)") tried two map-first directions after Kyle called round 1 "too blocky and late 90s" and pointed at Apple Maps:

1. **Glass over Ground**: the map runs edge to edge; controls float over it on neutral system glass (capsules, 20 pt cards); SF Pro only; amber stays the one accent.
2. **Ink Cartography**: the same layout on warm, smoky glass, with New York titles and hatched DM fog.

Screenshots: claude.ai project folder `design/concepts-round2-2026-10-17/` (`glass-1-architect.png`, `glass-2-world-view.png`, `ink-*.png`).

## Kyle's answer

1 — Glass over Ground. Recorded 2026-10-17: "I like the glass. Let's make sure this is HIG friendly and start building these UI updates into the app."

## What changes

- **Supersedes in 006 (native app only):** "Etched, not floating" (brief §2.3) and the glassmorphism and rounded-everything anti-references (brief §5) for overlays Graphium draws over the map. Amber as the single accent, monospaced readouts, state without colour and decisive motion all stay.
- **HIG fit:** glass is the control layer that floats above content, never the content. Apple's own sidebar, inspector, toolbar, sheets and menus stay native (on macOS 26 they are Liquid Glass already), so Graphium never stacks its glass on theirs. The tool picker stays a native, customisable toolbar item, rather than the concept's custom bottom capsule, so View > Customize Toolbar, menus and VoiceOver keep working.
- **Rules:** `macos/design/harness/rules/glass-overlays.md` replaces `etched-overlays.md`; taste rules 3 and 8 are updated.
- **Not yet decided:** the World View keeps its etched `world-*` look until a separate decision covers projector legibility of glass.
