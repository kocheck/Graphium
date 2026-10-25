# Decision 020: World View plates share the 12 pt corner

Status: DEFAULT BUILT (2026-10-25), waiting on Kyle's look on a real projector

## Question

Decision 019 moves glass cards to 12 pt and tiles to 8 pt. The World View's plates (initiative strip, minimap, note card) were 4 pt and 20 pt. How far should the redesign reach into the player screen?

## Default built

- **Corners only.** The initiative strip, the minimap and the note card all use `Radius.card` (12 pt). The current-turn row inside the strip keeps the 4 pt `Radius.control`, so it sits concentric with its plate. `Radius.panel` had no other user and is deleted.
- **Unchanged:** opaque `world-scrim` and `world-panel` backings (never glass: projectors wash out translucency), 2 pt strokes, text at least 24 pt at 1080p, 7:1 contrast, the fixed `world-*` tokens, and the pause and fog behaviour.

## Not built

Soft surfaces, grain, serif type or tiles on the player screen. The World View is a projected instrument, not a canvas to decorate.

## What would change it

A 1920 x 1080 capture or a real projector showing a plate edge reads worse at 12 pt than it did at 4 pt.
